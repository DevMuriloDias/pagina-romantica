"""Renderização real com FFmpeg: dimensões, duração, áudio, legendas queimadas e sincronia."""
import subprocess
from pathlib import Path

import numpy as np
import pytest

from capture.recorder import parse_segment_list, segmenter_command
from models.candidate import TranscriptSegment, TranscriptWord
from tests.helpers import HAS_FFMPEG
from video.renderer import RenderCancelled, Renderer, RenderError, RenderRequest
from video.subtitles import build_cues, to_ass

pytestmark = pytest.mark.skipif(not HAS_FFMPEG, reason="FFmpeg não instalado")


def make_recording(d: Path, audio=True, seconds=14):
    src = d / "src.ts"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
           "-f", "lavfi", "-i", f"testsrc2=s=640x360:r=30:d={seconds}"]
    if audio:
        cmd += ["-f", "lavfi", "-i", f"sine=f=440:r=48000:d={seconds}"]
    cmd += ["-c:v", "libx264", "-preset", "ultrafast", "-g", "30"]
    cmd += (["-c:a", "aac"] if audio else []) + ["-f", "mpegts", str(src)]
    subprocess.run(cmd, check=True)
    seg = segmenter_command("ffmpeg", 5)
    seg[seg.index("pipe:0")] = str(src)
    subprocess.run(seg, cwd=d, check=True)
    segs = parse_segment_list(d / "segments.csv")
    assert len(segs) >= 2
    return [str(d / s.filename) for s in segs], [s.duration for s in segs], segs


@pytest.fixture(scope="module")
def recording(tmp_path_factory):
    return make_recording(tmp_path_factory.mktemp("rec"))


def frame(video: Path, t: float) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{t}", "-i", str(video),
                          "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(1920, 1080, 3).astype(np.int16)


TRANSCRIPT = [TranscriptSegment(0.5, 1.9, "que jogada absurda", [
    TranscriptWord(0.5, 0.9, "que"), TranscriptWord(0.9, 1.4, "jogada"), TranscriptWord(1.4, 1.9, "absurda")])]


def request(recording, out, **kw):
    paths, durations, segs = recording
    boundary = segs[1].start
    base = dict(paths=paths[:2], durations=durations[:2], start=boundary - 2.0, duration=5.0, output=out,
                preset="rapido")
    base.update(kw)
    return RenderRequest(**base)


def test_render_vertical_with_synced_burned_subtitles(recording, tmp_path):
    r = Renderer()
    ass = to_ass(build_cues(TRANSCRIPT, 5.0))
    with_subs = tmp_path / "subs.mp4"
    plain = tmp_path / "plain.mp4"
    progress = []
    info = r.render(request(recording, with_subs, subtitles_ass=ass), tmp_path / "w1", progress=progress.append)
    r.render(request(recording, plain), tmp_path / "w2")

    assert (info.width, info.height) == (1080, 1920)
    assert info.duration == pytest.approx(5.0, abs=0.15) and info.has_audio
    assert progress[-1] == 1.0 and len(progress) >= 2
    assert not (tmp_path / "w1" / "render.mp4").exists()              # movido atomicamente

    band = slice(1920 - 560 - 120, 1920 - 560 + 10)                   # faixa da legenda (MarginV 560)
    during = np.abs(frame(with_subs, 1.1) - frame(plain, 1.1))
    after = np.abs(frame(with_subs, 3.5) - frame(plain, 3.5))          # linha some em 1,9 + 0,5 s
    changed_band = (during[band].max(axis=2) > 60).mean()
    changed_elsewhere = (during[:1000].max(axis=2) > 60).mean()
    assert changed_band > 0.02, "legenda não apareceu na faixa esperada"
    assert changed_elsewhere < 0.002, "legenda alterou outras áreas do vídeo"
    assert (after[band].max(axis=2) > 60).mean() < 0.002, "legenda continuou na tela fora do tempo"
    # Palavra "jogada" (0,9–1,4 s) destacada em verde #00FF88 no quadro de 1,1 s
    f = frame(with_subs, 1.1)[band]
    green = (f[..., 1] > 200) & (f[..., 0] < 90) & (f[..., 2] > 80) & (f[..., 2] < 190)
    assert green.mean() > 0.003


def test_cut_is_accurate_across_segment_boundary(recording, tmp_path):
    """testsrc2 desenha um relógio; o 1º quadro do clipe deve ser o mesmo da fonte no instante pedido."""
    paths, durations, segs = recording
    r = Renderer()
    clip = tmp_path / "cut.mp4"
    r.render(request(recording, clip, layout="crop"), tmp_path / "w")
    src = tmp_path / "ref.mp4"
    start = segs[1].start - 2.0
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{start}", "-i",
                    str(Path(paths[0]).parent / "src.ts"), "-t", "5", "-vf",
                    "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920:flags=lanczos,setsar=1,fps=30",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", str(src)], check=True)
    for t in (0.2, 2.5, 4.5):  # antes, logo depois e bem depois da divisa
        diff = np.abs(frame(clip, t) - frame(src, t)).mean()
        assert diff < 6, f"quadro em {t}s não corresponde à fonte (diferença média {diff:.1f})"


def test_crop_layout_and_silent_source(tmp_path):
    rec = make_recording(tmp_path, audio=False, seconds=11)
    info = Renderer().render(request(rec, tmp_path / "c.mp4", layout="crop"), tmp_path / "w")
    assert (info.width, info.height) == (1080, 1920) and info.has_audio  # trilha muda adicionada


def test_cancel_leaves_no_output(recording, tmp_path):
    calls = {"n": 0}

    def cancelled():
        calls["n"] += 1
        return calls["n"] > 1

    out = tmp_path / "x.mp4"
    with pytest.raises(RenderCancelled):
        Renderer().render(request(recording, out, duration=8.0), tmp_path / "w", cancelled=cancelled)
    assert not out.exists()


def test_ffmpeg_error_is_reported(recording, tmp_path):
    bad = request(recording, tmp_path / "bad.mp4")
    bad.paths = [str(tmp_path / "missing.ts")]
    bad.durations = [5.0]
    with pytest.raises(RenderError):
        Renderer().render(bad, tmp_path / "w")


def test_thumbnail(recording, tmp_path):
    r = Renderer()
    clip = tmp_path / "t.mp4"
    r.render(request(recording, clip), tmp_path / "w")
    thumb = r.thumbnail(clip, 2.0, tmp_path / "thumbs" / "t.jpg")
    assert thumb.exists() and thumb.stat().st_size > 1000
