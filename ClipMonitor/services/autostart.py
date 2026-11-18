"""Inicialização automática com o Windows.

Usa a chave do usuário ``HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run``:
não exige administrador, vale só para a conta atual e o próprio Windows mostra
o item em Gerenciador de Tarefas → Aplicativos de inicialização, onde o usuário
pode desativá-lo. O registro é a fonte da verdade (não duplicamos no banco).

O comando usa ``pythonw.exe`` (sem janela de console) do mesmo ambiente em que o
app está rodando (ex.: a ``.venv``) e abre minimizado.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Protocol

RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
VALUE_NAME = "ClipMonitor"


class AutostartUnsupported(RuntimeError):
    pass


class RegistryBackend(Protocol):
    def get(self, name: str) -> str | None: ...
    def set(self, name: str, value: str) -> None: ...
    def delete(self, name: str) -> None: ...


class WinRegBackend:
    def __init__(self) -> None:
        import winreg  # só existe no Windows

        self._winreg = winreg

    def get(self, name: str) -> str | None:
        wr = self._winreg
        try:
            with wr.OpenKey(wr.HKEY_CURRENT_USER, RUN_KEY, 0, wr.KEY_READ) as key:
                return wr.QueryValueEx(key, name)[0]
        except FileNotFoundError:
            return None

    def set(self, name: str, value: str) -> None:
        wr = self._winreg
        with wr.CreateKeyEx(wr.HKEY_CURRENT_USER, RUN_KEY, 0, wr.KEY_SET_VALUE) as key:
            wr.SetValueEx(key, name, 0, wr.REG_SZ, value)

    def delete(self, name: str) -> None:
        wr = self._winreg
        try:
            with wr.OpenKey(wr.HKEY_CURRENT_USER, RUN_KEY, 0, wr.KEY_SET_VALUE) as key:
                wr.DeleteValue(key, name)
        except FileNotFoundError:
            pass


def gui_python(executable: str | None = None) -> str:
    exe = Path(executable or sys.executable)
    if exe.name.lower() == "python.exe":
        windowed = exe.with_name("pythonw.exe")
        if windowed.exists():
            return str(windowed)
    return str(exe)


def launch_command(main_script: Path, python: str | None = None) -> str:
    return f'"{gui_python(python)}" "{Path(main_script).resolve()}" --minimized'


class Autostart:
    def __init__(self, main_script: Path, backend: RegistryBackend | None = None, python: str | None = None):
        self.main_script = Path(main_script)
        self.python = python
        self._backend = backend
        if backend is None and sys.platform == "win32":
            self._backend = WinRegBackend()

    @property
    def supported(self) -> bool:
        return self._backend is not None

    def _require(self) -> RegistryBackend:
        if self._backend is None:
            raise AutostartUnsupported("A inicialização automática só está disponível no Windows.")
        return self._backend

    @property
    def command(self) -> str:
        return launch_command(self.main_script, self.python)

    def is_enabled(self) -> bool:
        return self.supported and self._require().get(VALUE_NAME) is not None

    def is_current(self) -> bool:
        """True se o item aponta para ESTA instalação (a pasta pode ter sido movida)."""
        return self.supported and self._require().get(VALUE_NAME) == self.command

    def enable(self) -> None:
        self._require().set(VALUE_NAME, self.command)

    def disable(self) -> None:
        self._require().delete(VALUE_NAME)

    def set(self, enabled: bool) -> None:
        self.enable() if enabled else self.disable()
