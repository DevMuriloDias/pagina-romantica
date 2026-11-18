"""Proteção de segredos em repouso.

No Windows usa DPAPI (``CryptProtectData``), vinculando o segredo à conta do
usuário: o arquivo SQLite copiado para outra máquina/conta não revela o
Client Secret. Em outros sistemas (ex.: testes no Linux) usa apenas
codificação base64 marcada, sem pretensão de segurança.
"""
from __future__ import annotations

import base64
import sys

_DPAPI_PREFIX = "dpapi:"
_PLAIN_PREFIX = "b64:"


def _dpapi(data: bytes, protect: bool) -> bytes:
    import ctypes
    from ctypes import wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    crypt32 = ctypes.windll.crypt32  # type: ignore[attr-defined]
    kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
    buffer = ctypes.create_string_buffer(data, len(data))
    blob_in = DATA_BLOB(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_char)))
    blob_out = DATA_BLOB()
    func = crypt32.CryptProtectData if protect else crypt32.CryptUnprotectData
    ok = func(ctypes.byref(blob_in), None, None, None, None, 0x1, ctypes.byref(blob_out))
    if not ok:
        raise OSError("Falha na DPAPI do Windows")
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        kernel32.LocalFree(blob_out.pbData)


def protect(value: str) -> str:
    if not value:
        return ""
    raw = value.encode("utf-8")
    if sys.platform == "win32":
        return _DPAPI_PREFIX + base64.b64encode(_dpapi(raw, True)).decode("ascii")
    return _PLAIN_PREFIX + base64.b64encode(raw).decode("ascii")


def unprotect(stored: str) -> str:
    if not stored:
        return ""
    if stored.startswith(_DPAPI_PREFIX):
        if sys.platform != "win32":
            return ""  # segredo criado em outra plataforma: não recuperável
        try:
            return _dpapi(base64.b64decode(stored[len(_DPAPI_PREFIX):]), False).decode("utf-8")
        except (OSError, ValueError):
            return ""
    if stored.startswith(_PLAIN_PREFIX):
        return base64.b64decode(stored[len(_PLAIN_PREFIX):]).decode("utf-8")
    return stored  # legado / texto puro
