"""Componentes visuais reutilizáveis (tema escuro ClipMonitor)."""
from __future__ import annotations

from typing import Callable

import customtkinter as ctk

from config import theme as t


class Card(ctk.CTkFrame):
    def __init__(self, master, **kw):
        kw.setdefault("fg_color", t.CARD)
        kw.setdefault("corner_radius", t.RADIUS)
        kw.setdefault("border_width", 1)
        kw.setdefault("border_color", t.BORDER)
        super().__init__(master, **kw)


def label(master, text="", font=t.FONT_BODY, color=t.TEXT, **kw) -> ctk.CTkLabel:
    return ctk.CTkLabel(master, text=text, font=font, text_color=color, anchor="w", justify="left", **kw)


def muted(master, text="", font=t.FONT_SMALL, **kw) -> ctk.CTkLabel:
    return label(master, text, font=font, color=t.TEXT_MUTED, **kw)


class PrimaryButton(ctk.CTkButton):
    def __init__(self, master, text: str, command: Callable | None = None, **kw):
        kw.setdefault("height", 38)
        super().__init__(
            master, text=text, command=command, fg_color=t.ACCENT, hover_color=t.ACCENT_HOVER,
            text_color=t.ACCENT_TEXT, font=(t.FONT_FAMILY, 13, "bold"), corner_radius=10, **kw,
        )


class GhostButton(ctk.CTkButton):
    def __init__(self, master, text: str, command: Callable | None = None, danger: bool = False, **kw):
        kw.setdefault("height", 38)
        color = t.DANGER if danger else t.TEXT
        super().__init__(
            master, text=text, command=command, fg_color="transparent", hover_color=t.CARD_HOVER,
            border_width=1, border_color=t.BORDER, text_color=color, font=(t.FONT_FAMILY, 13),
            corner_radius=10, **kw,
        )


class Entry(ctk.CTkEntry):
    def __init__(self, master, placeholder: str = "", **kw):
        kw.setdefault("height", 38)
        super().__init__(
            master, placeholder_text=placeholder, fg_color=t.SECONDARY, border_color=t.BORDER,
            text_color=t.TEXT, placeholder_text_color=t.TEXT_DIM, corner_radius=10,
            font=t.FONT_BODY, **kw,
        )


class Switch(ctk.CTkSwitch):
    def __init__(self, master, text: str = "", command: Callable | None = None, **kw):
        super().__init__(
            master, text=text, command=command, progress_color=t.ACCENT, button_color=t.TEXT,
            button_hover_color="#DDDDDD", fg_color=t.BORDER, text_color=t.TEXT, font=t.FONT_BODY, **kw,
        )


class Badge(ctk.CTkLabel):
    STYLES = {
        "live": (t.LIVE, t.TEXT),
        "on": (t.ACCENT, t.ACCENT_TEXT),
        "off": (t.BORDER, t.TEXT_MUTED),
        "warn": (t.WARNING, "#1A1200"),
    }

    def __init__(self, master, text: str, style: str = "off", **kw):
        bg, fg = self.STYLES[style]
        super().__init__(
            master, text=f"  {text}  ", fg_color=bg, text_color=fg, corner_radius=8,
            font=(t.FONT_FAMILY, 10, "bold"), height=22, **kw,
        )

    def set(self, text: str, style: str) -> None:
        bg, fg = self.STYLES[style]
        self.configure(text=f"  {text}  ", fg_color=bg, text_color=fg)


class Avatar(ctk.CTkFrame):
    """Círculo com a inicial do canal (sem baixar imagens: leve e offline)."""

    def __init__(self, master, name: str, size: int = 40, live: bool = False, **kw):
        super().__init__(master, width=size, height=size, corner_radius=size // 2,
                         fg_color=t.ACCENT if live else t.SECONDARY, **kw)
        self.grid_propagate(False)
        self.pack_propagate(False)
        ctk.CTkLabel(
            self, text=(name[:1] or "?").upper(), fg_color="transparent",
            text_color=t.ACCENT_TEXT if live else t.ACCENT, font=(t.FONT_FAMILY, size // 2 - 2, "bold"),
        ).place(relx=0.5, rely=0.5, anchor="center")


class StatCard(Card):
    def __init__(self, master, title: str, value: str = "0", hint: str = "", accent: bool = False):
        super().__init__(master)
        self.grid_columnconfigure(0, weight=1)
        muted(self, title.upper(), font=(t.FONT_FAMILY, 10, "bold")).grid(row=0, column=0, sticky="w", padx=18, pady=(16, 0))
        self.value = label(self, value, font=t.FONT_STAT, color=t.ACCENT if accent else t.TEXT)
        self.value.grid(row=1, column=0, sticky="w", padx=18)
        self.hint = muted(self, hint)
        self.hint.grid(row=2, column=0, sticky="w", padx=18, pady=(0, 16))

    def set(self, value: str, hint: str | None = None) -> None:
        self.value.configure(text=value)
        if hint is not None:
            self.hint.configure(text=hint)


class EmptyState(ctk.CTkFrame):
    def __init__(self, master, title: str, message: str, action_text: str | None = None, action=None):
        super().__init__(master, fg_color="transparent")
        ctk.CTkLabel(self, text="◎", font=(t.FONT_FAMILY, 40), text_color=t.ACCENT).pack(pady=(30, 6))
        ctk.CTkLabel(self, text=title, font=t.FONT_SUBTITLE, text_color=t.TEXT).pack()
        ctk.CTkLabel(self, text=message, font=t.FONT_BODY, text_color=t.TEXT_MUTED, wraplength=420).pack(pady=(4, 14))
        if action_text and action:
            PrimaryButton(self, action_text, action, width=200).pack(pady=(0, 30))


class PageHeader(ctk.CTkFrame):
    def __init__(self, master, title: str, subtitle: str = ""):
        super().__init__(master, fg_color="transparent")
        self.grid_columnconfigure(0, weight=1)
        label(self, title, font=t.FONT_TITLE).grid(row=0, column=0, sticky="w")
        if subtitle:
            muted(self, subtitle, font=t.FONT_BODY).grid(row=1, column=0, sticky="w", pady=(2, 0))
        self.actions = ctk.CTkFrame(self, fg_color="transparent")
        self.actions.grid(row=0, column=1, rowspan=2, sticky="e")


class Toast(ctk.CTkFrame):
    """Notificação flutuante no canto inferior direito da janela."""

    COLORS = {"success": t.ACCENT, "error": t.DANGER, "info": t.TEXT_MUTED, "warn": t.WARNING}

    def __init__(self, root, message: str, kind: str = "info", duration_ms: int = 3500):
        super().__init__(root, fg_color=t.CARD, corner_radius=10, border_width=1, border_color=self.COLORS[kind])
        ctk.CTkFrame(self, width=4, fg_color=self.COLORS[kind], corner_radius=2).pack(side="left", fill="y", padx=(8, 0), pady=8)
        ctk.CTkLabel(self, text=message, font=t.FONT_BODY, text_color=t.TEXT, wraplength=340, justify="left").pack(
            side="left", padx=12, pady=12
        )
        self.place(relx=1.0, rely=1.0, x=-24, y=-24, anchor="se")
        self.lift()
        self.after(duration_ms, self.destroy)


def confirm(root, title: str, message: str, confirm_text: str = "Confirmar", danger: bool = False) -> bool:
    """Diálogo modal de confirmação no tema da aplicação."""
    result = {"ok": False}
    win = ctk.CTkToplevel(root)
    win.title(title)
    win.configure(fg_color=t.BG)
    win.resizable(False, False)
    win.transient(root)
    frame = Card(win)
    frame.pack(fill="both", expand=True, padx=16, pady=16)
    label(frame, title, font=t.FONT_SUBTITLE).pack(anchor="w", padx=20, pady=(18, 4))
    ctk.CTkLabel(frame, text=message, font=t.FONT_BODY, text_color=t.TEXT_MUTED, wraplength=360, justify="left").pack(
        anchor="w", padx=20
    )
    row = ctk.CTkFrame(frame, fg_color="transparent")
    row.pack(fill="x", padx=20, pady=18)

    def ok():
        result["ok"] = True
        win.destroy()

    if danger:
        ctk.CTkButton(row, text=confirm_text, command=ok, fg_color=t.DANGER, hover_color=t.DANGER_HOVER,
                      text_color=t.TEXT, height=36, corner_radius=10, font=(t.FONT_FAMILY, 13, "bold")).pack(side="right")
    else:
        PrimaryButton(row, confirm_text, ok).pack(side="right")
    GhostButton(row, "Cancelar", win.destroy).pack(side="right", padx=(0, 8))
    win.after(50, win.grab_set)
    win.wait_window()
    return result["ok"]
