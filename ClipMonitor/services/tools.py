"""Detecção das ferramentas externas usadas na captura/processamento."""
from __future__ import annotations

import importlib.util
import logging
import re
import shutil
import subprocess
import sys
import threading
from typing import Callable

from models.status import ToolInfo

log = logging.getLogger(__name__)

_CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0  # sem janela de console no Windows

TOOLS = {
    "ffmpeg": {
        "label": "FFmpeg",
        "args": ["-version"],
        "pattern": r"ffmpeg version (\S+)",
        "hint": "Baixe em gyan.dev/ffmpeg/builds e adicione a pasta 'bin' ao PATH.",
    },
    "streamlink": {
        "label": "Streamlink",
        "args": ["--version"],
        "pattern": r"streamlink (\S+)",
        "hint": "Instale com: pip install streamlink",
    },
}

Runner = Callable[[list[str]], str]


def _run(cmd: list[str]) -> str:
    proc = subprocess.run(
        cmd, capture_output=True, text=True, timeout=10, creationflags=_CREATE_NO_WINDOW,
        encoding="utf-8", errors="replace",
    )
    return (proc.stdout or "") + (proc.stderr or "")


def _locate(name: str) -> str | None:
    path = shutil.which(name)
    if path:
        return path
    # Streamlink instalado via pip no mesmo ambiente pode não estar no PATH.
    if name == "streamlink" and importlib.util.find_spec("streamlink") is not None:
        return f"{sys.executable} -m streamlink"
    return None


def detect_tool(name: str, runner: Runner = _run, locate: Callable[[str], str | None] = _locate) -> ToolInfo:
    spec = TOOLS[name]
    path = locate(name)
    if not path:
        return ToolInfo(spec["label"], False, hint=spec["hint"])
    cmd = path.split(" ") if path.endswith("-m streamlink") else [path]
    try:
        output = runner(cmd + spec["args"])
    except (OSError, subprocess.SubprocessError) as exc:
        log.warning("Falha ao executar %s: %s", name, exc)
        return ToolInfo(spec["label"], False, path=path, hint=f"Encontrado, mas não executou: {exc}")
    match = re.search(spec["pattern"], output, re.IGNORECASE)
    return ToolInfo(spec["label"], True, version=match.group(1) if match else "", path=path)


class ToolsService:
    """Cache da detecção (executar binários custa ~0,5 s; não fazer na thread da UI)."""

    def __init__(self, detector: Callable[[str], ToolInfo] = detect_tool):
        self.detector = detector
        self._lock = threading.Lock()
        self._cache: dict[str, ToolInfo] | None = None

    def refresh(self) -> dict[str, ToolInfo]:
        result = {name: self.detector(name) for name in TOOLS}
        with self._lock:
            self._cache = result
        return result

    def cached(self) -> dict[str, ToolInfo] | None:
        with self._lock:
            return dict(self._cache) if self._cache is not None else None

    def capture_ready(self) -> bool:
        cache = self.cached() or {}
        return all(cache.get(n, ToolInfo(n, False)).available for n in TOOLS)
