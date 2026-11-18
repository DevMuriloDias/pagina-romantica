import re

import pytest

from models.candidate import TranscriptSegment, TranscriptWord
from video.layout import audio_filter, video_filter
from video.subtitles import HIGHLIGHT_BGR, build_cues, to_ass, to_srt


def words(spec):
    """spec: [(start, end, 'palavra'), ...]"""
    return [TranscriptSegment(spec[0][0], spec[-1][1], " ".join(w for *_t, w in spec),
                              [TranscriptWord(s, e, w) for s, e, w in spec])]


def test_cues_break_on_length_words_pauses_and_punctuation():
    spec = [(0.0, 0.3, "meu"), (0.3, 0.6, "deus"), (0.6, 0.9, "não"), (0.9, 1.2, "acredito!"),
            (1.3, 1.6, "olha"), (1.6, 1.9, "isso"),
            (3.0, 3.3, "depois"), (3.3, 3.6, "da"), (3.6, 3.9, "pausa"),
            (4.0, 4.4, "extraordinariamente"), (4.4, 4.8, "inacreditável")]
    cues = build_cues(words(spec), 10.0)
    assert [c.text for c in cues] == ["meu deus não acredito!", "olha isso", "depois da pausa",
                                      "extraordinariamente", "inacreditável"]
    assert all(len(c.text) <= 22 or len(c.words) == 1 for c in cues)


def test_cue_timing_lingers_but_never_overlaps_next():
    cues = build_cues(words([(1.0, 1.4, "oi"), (1.5, 1.8, "tudo"), (5.0, 5.3, "bem")]), 6.0)
    assert (cues[0].start, cues[0].end) == (1.0, pytest.approx(2.3))   # 1,8 + 0,5 de permanência
    assert cues[1].end <= 6.0
    tight = build_cues(words([(0.0, 0.2, "a."), (0.3, 0.5, "b")]), 1.0)
    assert tight[0].end <= tight[1].start                                # sem sobreposição


def test_words_outside_clip_are_dropped():
    cues = build_cues(words([(-1.0, -0.5, "antes"), (0.5, 0.8, "dentro"), (12.0, 12.5, "depois")]), 10.0)
    assert [c.text for c in cues] == ["dentro"]


def test_ass_highlights_each_word_in_turn():
    cues = build_cues(words([(0.0, 0.4, "que"), (0.4, 0.8, "jogada"), (0.8, 1.2, "{absurda}\\")]), 5.0)
    ass = to_ass(cues)
    events = [l for l in ass.splitlines() if l.startswith("Dialogue:")]
    assert len(events) == 3                                       # um por palavra
    assert "PlayResX: 1080" in ass and "PlayResY: 1920" in ass
    assert all(e.count(f"\\c&H{HIGHLIGHT_BGR}&") == 1 for e in events)
    assert f"{{\\c&H{HIGHLIGHT_BGR}&}}JOGADA" in events[1]          # palavra atual destacada, maiúsculas
    assert "ABSURDA" in events[2] and "{ABSURDA}" not in events[2]  # chaves/barras removidas (seguro p/ ASS)
    times = [re.findall(r"Dialogue: 0,([^,]+),([^,]+)", e)[0] for e in events]
    assert times == [("0:00:00.00", "0:00:00.40"), ("0:00:00.40", "0:00:00.80"), ("0:00:00.80", "0:00:01.70")]
    plain = to_ass(cues, uppercase=False, highlight=False)
    assert len([l for l in plain.splitlines() if l.startswith("Dialogue:")]) == 1 and "que jogada" in plain


def test_srt_format():
    cues = build_cues(words([(61.25, 61.5, "olá"), (61.5, 62.0, "mundo")]), 3600)
    assert to_srt(cues) == "1\n00:01:01,250 --> 00:01:02,500\nolá mundo\n"


def test_layout_filters():
    blur = video_filter("blur", 30, "legendas.ass")
    assert "boxblur" in blur and "overlay" in blur and blur.endswith("ass=legendas.ass,format=yuv420p[v]")
    assert "fps=30" in blur and "scale=1080:-2" in blur
    crop = video_filter("crop", 60, None)
    assert "crop=" in crop and "scale=1080:1920" in crop and "ass=" not in crop and "fps=60" in crop
    assert "loudnorm=I=-14" in audio_filter()
    with pytest.raises(ValueError):
        video_filter("x", 30, None)
