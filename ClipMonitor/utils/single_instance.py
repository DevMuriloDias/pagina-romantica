"""Garante uma única instância do app (duas instâncias gravariam a mesma live duas vezes)."""
from __future__ import annotations

import os
import sys
from pathlib import Path


class AlreadyRunning(RuntimeError):
    pass


class SingleInstance:
    def __init__(self, lock_path: Path):
        self.lock_path = Path(lock_path)
        self._fh = None

    def acquire(self) -> "SingleInstance":
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        fh = open(self.lock_path, "a+b")
        try:
            if sys.platform == "win32":
                import msvcrt

                fh.seek(0)
                msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            fh.close()
            raise AlreadyRunning("O ClipMonitor já está aberto.") from exc
        fh.seek(0)
        fh.truncate()
        fh.write(str(os.getpid()).encode())
        fh.flush()
        self._fh = fh
        return self

    def release(self) -> None:
        if self._fh:
            try:
                if sys.platform == "win32":
                    import msvcrt

                    self._fh.seek(0)
                    msvcrt.locking(self._fh.fileno(), msvcrt.LK_UNLCK, 1)
            except OSError:
                pass
            self._fh.close()
            self._fh = None

    def __enter__(self):
        return self.acquire()

    def __exit__(self, *exc):
        self.release()
