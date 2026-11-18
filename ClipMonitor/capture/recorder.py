"""Gravação de uma live: Streamlink → FFmpeg (segmentador, sem recodificar).

    streamlink --stdout twitch.tv/<canal> <qualidade>  |  ffmpeg -c copy -f segment ...

- ``-c copy``: só copia os pacotes — praticamente zero CPU, sem perda de qualidade.
- Segmentos MPEG-TS de N segundos: cada segmento concluído é analisado enquanto a
  gravação continua, e um arquivo corrompido nunca invalida a live inteira.
- ``segments.csv`` (escrito pelo FFmpeg ao fechar cada segmento) informa o início
  e o fim exatos de cada arquivo na linha do tempo da gravação.
- O Streamlink já descarta os anúncios da Twitch (comportamento padrão).
"""
from __future__ import annotations

import csv
import logging
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import IO

log = logging.getLogger(__name__)

_CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0
SEGMENT_LIST = "segments.csv"
SEGMENT_PATTERN = "seg_%05d.ts"


@dataclass(frozen=True)
class SegmentInfo:
    index: int
    filename: str
    start: float
    end: float

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


def streamlink_command(streamlink: list[str], login: str, quality: str) -> list[str]:
    return [
        *streamlink, "--stdout", "--loglevel", "info",
        "--retry-open", "3", "--retry-streams", "10", "--retry-max", "6",
        "--stream-segment-threads", "2",
        f"https://www.twitch.tv/{login}", quality,
    ]


def segmenter_command(ffmpeg: str, segment_seconds: int) -> list[str]:
    return [
        ffmpeg, "-hide_banner", "-loglevel", "warning", "-nostdin",
        "-fflags", "+genpts+discardcorrupt", "-i", "pipe:0",
        "-map", "0:v:0?", "-map", "0:a:0?", "-c", "copy",
        "-f", "segment", "-segment_time", str(segment_seconds), "-segment_format", "mpegts",
        "-reset_timestamps", "1", "-segment_list", SEGMENT_LIST, "-segment_list_type", "csv",
        SEGMENT_PATTERN,
    ]


def parse_segment_list(path: Path) -> list[SegmentInfo]:
    if not path.exists():
        return []
    out = []
    with path.open(newline="", encoding="utf-8", errors="replace") as fh:
        for row in csv.reader(fh):
            if len(row) != 3:
                continue  # linha sendo escrita neste instante
            name, start, end = row
            try:
                index = int(Path(name).stem.split("_")[-1])
                out.append(SegmentInfo(index, name, float(start), float(end)))
            except ValueError:
                continue
    return out


class Recorder:
    def __init__(self, source_cmd: list[str], out_dir: Path, segment_seconds: int, ffmpeg: str = "ffmpeg"):
        self.source_cmd = source_cmd
        self.out_dir = Path(out_dir)
        self.segment_cmd = segmenter_command(ffmpeg, segment_seconds)
        self._source: subprocess.Popen | None = None
        self._segmenter: subprocess.Popen | None = None
        self._log: IO | None = None
        self._seen: set[int] = set()

    @property
    def log_path(self) -> Path:
        return self.out_dir / "capture.log"

    def start(self) -> None:
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self._log = open(self.log_path, "ab")
        try:
            self._source = subprocess.Popen(
                self.source_cmd, stdout=subprocess.PIPE, stderr=self._log, stdin=subprocess.DEVNULL,
                creationflags=_CREATE_NO_WINDOW,
            )
            self._segmenter = subprocess.Popen(
                self.segment_cmd, stdin=self._source.stdout, stdout=subprocess.DEVNULL, stderr=self._log,
                cwd=str(self.out_dir), creationflags=_CREATE_NO_WINDOW,
            )
        except FileNotFoundError as exc:
            self._cleanup()
            raise RuntimeError(f"Programa não encontrado: {exc.filename}") from exc
        # O segmentador é o único leitor do pipe: assim ele recebe EOF quando a fonte terminar.
        self._source.stdout.close()

    def alive(self) -> bool:
        return self._segmenter is not None and self._segmenter.poll() is None

    def source_exit_code(self) -> int | None:
        return self._source.poll() if self._source else None

    def stop(self, timeout: float = 20.0) -> None:
        """Encerra a fonte; o FFmpeg recebe EOF, fecha o último segmento e o registra."""
        if self._source and self._source.poll() is None:
            self._source.terminate()
            try:
                self._source.wait(5)
            except subprocess.TimeoutExpired:
                self._source.kill()
        if self._segmenter and self._segmenter.poll() is None:
            try:
                self._segmenter.wait(timeout)
            except subprocess.TimeoutExpired:
                log.warning("Segmentador não finalizou a tempo; encerrando à força")
                self._segmenter.kill()
        self._cleanup()

    def wait(self, timeout: float | None = None) -> None:
        if self._segmenter:
            self._segmenter.wait(timeout)

    def _cleanup(self) -> None:
        if self._log:
            self._log.close()
            self._log = None

    def new_segments(self) -> list[SegmentInfo]:
        """Segmentos concluídos ainda não reportados."""
        fresh = [s for s in parse_segment_list(self.out_dir / SEGMENT_LIST) if s.index not in self._seen]
        self._seen.update(s.index for s in fresh)
        return fresh

    def total_bytes(self) -> int:
        return sum(p.stat().st_size for p in self.out_dir.glob("seg_*.ts") if p.exists())

    def error_tail(self, lines: int = 3) -> str:
        try:
            text = self.log_path.read_text(encoding="utf-8", errors="replace").strip().splitlines()
        except OSError:
            return ""
        meaningful = [l for l in text if l.strip()]
        return " | ".join(meaningful[-lines:])
