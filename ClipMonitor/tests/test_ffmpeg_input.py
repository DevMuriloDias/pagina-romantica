"""Regressão: trechos que cruzam a divisa entre segmentos precisam sair completos e alinhados."""
import subprocess

import numpy as np
import pytest

from capture.recorder import parse_segment_list, segmenter_command
from detection.audio import decode_audio
from tests.helpers import HAS_FFMPEG
from utils.ffmpeg_input import write_ffconcat

pytestmark = pytest.mark.skipif(not HAS_FFMPEG, reason="FFmpeg não instalado")


@pytest.fixture(scope="module")
def split_recording(tmp_path_factory):
    """Fonte de 20 s com bipe em 15,5–18 s, segmentada pelo MESMO comando usado na captura."""
    d = tmp_path_factory.mktemp("split")
    src = d / "src.ts"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
                    "sine=f=1000:r=16000:d=20,volume='between(t,15.5,18)':eval=frame",
                    "-f", "lavfi", "-i", "testsrc=s=320x240:r=30:d=20", "-c:v", "libx264", "-preset", "ultrafast",
                    "-c:a", "aac", "-f", "mpegts", str(src)], check=True)
    cmd = segmenter_command("ffmpeg", 10)
    cmd[cmd.index("pipe:0")] = str(src)
    subprocess.run(cmd, cwd=d, check=True)
    segs = parse_segment_list(d / "segments.csv")
    assert len(segs) == 2
    return src, [d / s.filename for s in segs], segs


def envelope(audio):
    return np.array([np.sqrt((audio[i:i + 8000] ** 2).mean()) for i in range(0, audio.size - 7999, 8000)])


def test_cross_boundary_decode_matches_unsplit_source(split_recording):
    src, paths, segs = split_recording
    boundary = segs[1].start
    start = boundary - 2.5
    joined = decode_audio(paths, start=start, duration=5, durations=[s.duration for s in segs])
    reference = decode_audio([src], start=start, duration=5)
    assert joined.size == pytest.approx(5 * 16000, abs=400)
    assert np.allclose(envelope(joined), envelope(reference), atol=0.01)
    assert envelope(joined).max() > 0.05  # o bipe está lá


def test_ffconcat_quotes_paths(tmp_path):
    f = write_ffconcat([tmp_path / "a b's.ts", tmp_path / "c.ts"], [1.5, None], tmp_path / "l.ffconcat")
    text = f.read_text(encoding="utf-8")
    assert "'\\''" in text and "duration 1.500000" in text and text.count("file ") == 2
