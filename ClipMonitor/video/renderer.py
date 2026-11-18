"""Renderização de um clipe com FFmpeg (um único passe).

Entrada: um ou mais segmentos MPEG-TS (demuxer concat), corte preciso por
``-ss`` (antes do ``-i``: busca rápida, e precisa porque há recodificação).
Saída: MP4 H.264 High / AAC 48 kHz, 1080x1920, ``+faststart`` (exigido para
upload/streaming). Áudio normalizado em -14 LUFS.

Presets x264 pensados para o i3-10100F (4 núcleos, sem encoder de hardware
confiável na RX 550 para este uso): "equilibrado" = veryfast/CRF 21 renderiza
um clipe de 45 s em aproximadamente 1x tempo real.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Sequence

from utils.ffmpeg_input import ffmpeg_input
from video.layout import OUT_H, OUT_W, audio_filter, video_filter

log = logging.getLogger(__name__)
_CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

ENCODE_PRESETS = {
    "rapido": ("superfast", 23, "Rápido (arquivo maior)"),
    "equilibrado": ("veryfast", 21, "Equilibrado (recomendado)"),
    "qualidade": ("medium", 19, "Máxima qualidade (mais lento)"),
}
SUBTITLES_FILE = "legendas.ass"


class RenderError(RuntimeError):
    pass


class RenderCancelled(Exception):
    pass


@dataclass
class RenderRequest:
    paths: Sequence[str]
    durations: Sequence[float]
    start: float            # relativo ao início do primeiro arquivo
    duration: float
    output: Path
    layout: str = "blur"
    fps: int = 30
    preset: str = "equilibrado"
    subtitles_ass: str | None = None


@dataclass
class MediaInfo:
    width: int
    height: int
    duration: float
    has_audio: bool
    has_video: bool


def sibling_tool(ffmpeg: str, name: str) -> str:
    """ffprobe/ffplay ficam na mesma pasta do ffmpeg nas builds do Windows."""
    if os.path.isabs(ffmpeg):
        exe = name + (".exe" if sys.platform == "win32" else "")
        candidate = Path(ffmpeg).with_name(exe)
        if candidate.exists():
            return str(candidate)
    return name


class Renderer:
    def __init__(self, ffmpeg: str = "ffmpeg"):
        self.ffmpeg = ffmpeg
        self.ffprobe = sibling_tool(ffmpeg, "ffprobe")

    # ------------------------------------------------------------ inspeção
    def probe(self, path: str | Path) -> MediaInfo:
        try:
            proc = subprocess.run(
                [self.ffprobe, "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration",
                 "-of", "json", str(path)],
                capture_output=True, text=True, timeout=60, creationflags=_CREATE_NO_WINDOW,
            )
        except FileNotFoundError as exc:
            raise RenderError("ffprobe não encontrado (vem junto do FFmpeg).") from exc
        if proc.returncode != 0:
            raise RenderError(f"ffprobe não conseguiu ler {Path(path).name}: {proc.stderr.strip()[:200]}")
        data = json.loads(proc.stdout or "{}")
        streams = data.get("streams", [])
        video = next((s for s in streams if s.get("codec_type") == "video"), {})
        return MediaInfo(
            width=int(video.get("width") or 0), height=int(video.get("height") or 0),
            duration=float(data.get("format", {}).get("duration") or 0),
            has_audio=any(s.get("codec_type") == "audio" for s in streams),
            has_video=bool(video),
        )

    # ------------------------------------------------------------ render
    def build_command(self, req: RenderRequest, input_args: list[str], has_audio: bool, tmp_output: str) -> list[str]:
        x264_preset, crf, _ = ENCODE_PRESETS.get(req.preset, ENCODE_PRESETS["equilibrado"])
        vf = video_filter(req.layout, req.fps, SUBTITLES_FILE if req.subtitles_ass else None)
        cmd = [self.ffmpeg, "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-progress", "pipe:1",
               "-nostats", "-ss", f"{max(0.0, req.start):.3f}", *input_args]
        if has_audio:
            af = audio_filter()
        else:  # live sem áudio: trilha muda, para o arquivo ser aceito pelas plataformas
            cmd += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
            af = "[1:a]anull[a]"
        cmd += [
            "-t", f"{req.duration:.3f}", "-filter_complex", f"{vf};{af}", "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", x264_preset, "-crf", str(crf), "-profile:v", "high",
            "-g", str(req.fps * 2), "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000",
            "-movflags", "+faststart", "-shortest", tmp_output,
        ]
        return cmd

    def render(self, req: RenderRequest, workdir: Path, progress: Callable[[float], None] = lambda f: None,
               cancelled: Callable[[], bool] = lambda: False) -> MediaInfo:
        workdir.mkdir(parents=True, exist_ok=True)
        if req.subtitles_ass:
            (workdir / SUBTITLES_FILE).write_text(req.subtitles_ass, encoding="utf-8")
        source = self.probe(req.paths[0])
        if not source.has_video:
            raise RenderError("A gravação não contém vídeo.")
        tmp_output = workdir / "render.mp4"
        log_path = workdir / "ffmpeg.log"
        with ffmpeg_input([str(p) for p in req.paths], req.durations) as input_args, open(log_path, "wb") as errlog:
            cmd = self.build_command(req, input_args, source.has_audio, tmp_output.name)
            log.info("Renderizando %s (%.1f s, %s)", req.output.name, req.duration, req.layout)
            try:
                proc = subprocess.Popen(cmd, cwd=str(workdir), stdout=subprocess.PIPE, stderr=errlog,
                                        stdin=subprocess.DEVNULL, text=True, creationflags=_CREATE_NO_WINDOW)
            except FileNotFoundError as exc:
                raise RenderError("FFmpeg não encontrado. Instale-o e adicione ao PATH.") from exc
            try:
                for line in proc.stdout:  # -progress: blocos key=value a cada ~0,5 s
                    if cancelled():
                        proc.terminate()
                        break
                    key, _, value = line.strip().partition("=")
                    if key == "out_time_us" and value.isdigit():
                        progress(min(0.99, int(value) / 1e6 / max(req.duration, 0.1)))
                proc.wait(timeout=60)
            finally:
                if proc.poll() is None:
                    proc.kill()
        if cancelled():
            raise RenderCancelled()
        if proc.returncode != 0:
            tail = log_path.read_text(encoding="utf-8", errors="replace").strip().splitlines()
            raise RenderError(f"FFmpeg falhou ({proc.returncode}): {tail[-1] if tail else 'sem detalhes'}")

        info = self.probe(tmp_output)
        # Nunca reportar sucesso sem conferir o arquivo de verdade.
        if (info.width, info.height) != (OUT_W, OUT_H):
            raise RenderError(f"Vídeo gerado com {info.width}x{info.height}, esperado {OUT_W}x{OUT_H}.")
        if abs(info.duration - req.duration) > 1.0:
            raise RenderError(f"Duração gerada ({info.duration:.1f} s) difere da esperada ({req.duration:.1f} s).")
        if not info.has_audio:
            raise RenderError("Vídeo gerado sem trilha de áudio.")
        req.output.parent.mkdir(parents=True, exist_ok=True)
        os.replace(tmp_output, req.output)  # atômico: nunca deixa arquivo pela metade na pasta final
        progress(1.0)
        return info

    def thumbnail(self, video: Path, at: float, target: Path) -> Path:
        target.parent.mkdir(parents=True, exist_ok=True)
        proc = subprocess.run(
            [self.ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-ss", f"{max(0.0, at):.2f}",
             "-i", str(video), "-frames:v", "1", "-vf", "scale=360:640", "-q:v", "3", str(target)],
            capture_output=True, timeout=60, creationflags=_CREATE_NO_WINDOW,
        )
        if proc.returncode != 0 or not target.exists():
            raise RenderError("Não foi possível gerar a miniatura.")
        return target
