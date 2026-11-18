"""Pré-escuta de um momento com o ffplay (vem junto do FFmpeg no Windows)."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

_CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0


def find_ffplay(ffmpeg_path: str | None = None) -> str | None:
    if ffmpeg_path and os.path.isabs(ffmpeg_path):
        name = "ffplay.exe" if sys.platform == "win32" else "ffplay"
        candidate = Path(ffmpeg_path).with_name(name)
        if candidate.exists():
            return str(candidate)
    return shutil.which("ffplay")


def preview_command(ffplay: str, paths: list[str], start: float, duration: float, title: str) -> list[str]:
    source = paths[0] if len(paths) == 1 else "concat:" + "|".join(paths)
    return [ffplay, "-hide_banner", "-loglevel", "error", "-autoexit", "-window_title", title,
            "-x", "540", "-y", "960", "-ss", f"{max(0.0, start):.2f}", "-t", f"{duration:.2f}", source]


def play(cmd: list[str]) -> None:
    subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     )  # sem CREATE_NO_WINDOW: a janela do vídeo precisa aparecer


def open_folder(path: str) -> None:
    if sys.platform == "win32":
        os.startfile(path)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path])
    else:
        subprocess.Popen(["xdg-open", path])
