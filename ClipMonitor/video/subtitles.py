"""Legendas sincronizadas a partir dos tempos por palavra do Whisper.

- Agrupa palavras em linhas curtas (padrão de Shorts/Reels/TikTok): até ~22
  caracteres e 4 palavras, quebrando em pausas (> 0,6 s) e pontuação final.
- ASS (para queimar no vídeo com libass): cada palavra falada no momento fica
  destacada na cor de destaque, as demais em branco com contorno preto.
- SRT (texto simples) é salvo junto, para plataformas que aceitam legenda à parte.
Todos os tempos são relativos ao início do clipe.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from models.candidate import TranscriptSegment, TranscriptWord

MAX_CHARS = 22
MAX_WORDS = 4
MAX_GAP = 0.6
MIN_CUE = 0.5
LINGER = 0.5  # segundos que a linha permanece após a última palavra
SENTENCE_END = re.compile(r"[.!?…]$")

PLAY_W, PLAY_H = 1080, 1920
HIGHLIGHT_BGR = "88FF00"  # #00FF88 em BGR (formato do ASS)


@dataclass
class Cue:
    start: float
    end: float
    words: list[TranscriptWord]

    @property
    def text(self) -> str:
        return " ".join(w.word for w in self.words)


def _clean(word: str) -> str:
    return word.replace("{", "").replace("}", "").replace("\\", "").strip()


def build_cues(segments: list[TranscriptSegment], clip_duration: float) -> list[Cue]:
    words = [TranscriptWord(w.start, w.end, _clean(w.word), w.probability)
             for s in segments for w in s.words if _clean(w.word)]
    words = [w for w in words if w.end > 0 and w.start < clip_duration]
    cues: list[Cue] = []
    line: list[TranscriptWord] = []
    for w in words:
        if line:
            chars = len(" ".join(x.word for x in line)) + 1 + len(w.word)
            if (chars > MAX_CHARS or len(line) >= MAX_WORDS or w.start - line[-1].end > MAX_GAP
                    or SENTENCE_END.search(line[-1].word)):
                cues.append(Cue(line[0].start, line[-1].end, line))
                line = []
        line.append(w)
    if line:
        cues.append(Cue(line[0].start, line[-1].end, line))
    for i, cue in enumerate(cues):
        nxt = cues[i + 1].start if i + 1 < len(cues) else clip_duration
        cue.start = max(0.0, cue.start)
        cue.end = min(max(cue.end + LINGER, cue.start + MIN_CUE), nxt, clip_duration)
    return [c for c in cues if c.end > c.start]


# ---------------------------------------------------------------- SRT

def _srt_time(t: float) -> str:
    ms = int(round(max(0.0, t) * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def to_srt(cues: list[Cue]) -> str:
    blocks = [f"{i}\n{_srt_time(c.start)} --> {_srt_time(c.end)}\n{c.text}\n" for i, c in enumerate(cues, 1)]
    return "\n".join(blocks)


# ---------------------------------------------------------------- ASS

def _ass_time(t: float) -> str:
    cs = int(round(max(0.0, t) * 100))
    h, cs = divmod(cs, 360_000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def ass_header(font: str = "Arial", size: int = 78, margin_v: int = 560) -> str:
    # Cores ASS: &HAABBGGRR. MarginV posiciona acima da área de botões das plataformas.
    return (
        "[Script Info]\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\n"
        f"PlayResX: {PLAY_W}\nPlayResY: {PLAY_H}\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, "
        "Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Clip,{font},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,6,3,"
        f"2,80,80,{margin_v},1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )


def to_ass(cues: list[Cue], uppercase: bool = True, highlight: bool = True, **style) -> str:
    def fmt(word: str) -> str:
        return word.upper() if uppercase else word

    lines = [ass_header(**style)]
    for cue in cues:
        if not highlight:
            lines.append(f"Dialogue: 0,{_ass_time(cue.start)},{_ass_time(cue.end)},Clip,,0,0,0,,"
                         f"{' '.join(fmt(w.word) for w in cue.words)}\n")
            continue
        # Um evento por palavra: a linha inteira, com a palavra atual colorida.
        for i, w in enumerate(cue.words):
            start = cue.start if i == 0 else w.start
            end = cue.words[i + 1].start if i + 1 < len(cue.words) else cue.end
            if end <= start:
                continue
            text = " ".join(
                f"{{\\c&H{HIGHLIGHT_BGR}&}}{fmt(x.word)}{{\\c&HFFFFFF&}}" if j == i else fmt(x.word)
                for j, x in enumerate(cue.words)
            )
            lines.append(f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Clip,,0,0,0,,{text}\n")
    return "".join(lines)
