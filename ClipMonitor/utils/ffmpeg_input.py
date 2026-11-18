"""Entrada do FFmpeg para trechos que cruzam vários segmentos de gravação.

Os segmentos são MPEG-TS com timestamps reiniciados em cada arquivo
(``-reset_timestamps 1``). O protocolo ``concat:`` apenas junta bytes e o
FFmpeg não consegue buscar (``-ss``) corretamente nesse fluxo — o resultado
pode sair vazio. O *demuxer* concat (lista ``ffconcat`` com a duração exata de
cada arquivo, vinda do ``segments.csv``) monta uma linha do tempo contínua,
onde a busca é precisa.
"""
from __future__ import annotations

import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Sequence


def _quote(path: str | Path) -> str:
    p = Path(path).resolve().as_posix()
    return "'" + p.replace("'", "'\\''") + "'"


def write_ffconcat(paths: Sequence[str | Path], durations: Sequence[float | None], target: Path) -> Path:
    lines = ["ffconcat version 1.0"]
    for path, duration in zip(paths, durations):
        lines.append(f"file {_quote(path)}")
        if duration:
            lines.append(f"duration {duration:.6f}")
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return target


@contextmanager
def ffmpeg_input(paths: Sequence[str | Path], durations: Sequence[float | None] | None = None) -> Iterator[list[str]]:
    """Gera os argumentos ``-i`` para um ou mais arquivos consecutivos.

    Uso: ``with ffmpeg_input(paths, durations) as args: cmd = [..., "-ss", x, *args, ...]``
    """
    if len(paths) == 1:
        yield ["-i", str(paths[0])]
        return
    fd, name = tempfile.mkstemp(prefix="clipmonitor_", suffix=".ffconcat")
    os.close(fd)
    try:
        write_ffconcat(paths, durations or [None] * len(paths), Path(name))
        yield ["-f", "concat", "-safe", "0", "-i", name]
    finally:
        try:
            os.unlink(name)
        except OSError:
            pass
