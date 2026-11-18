"""Conversão para vertical 1080x1920 (9:16).

- ``blur`` (padrão): o vídeo inteiro, na largura total, centralizado sobre uma
  cópia ampliada e desfocada — nada da tela do jogo é cortado. O fundo é
  desfocado em baixa resolução (270x480) e depois ampliado: ~16x menos pixels
  para o boxblur, importante num i3 sem GPU dedicada para encode.
- ``crop``: recorte central 9:16 ocupando a tela toda (bom para câmera/conversa).
"""
from __future__ import annotations

OUT_W, OUT_H = 1080, 1920
LAYOUTS = {"blur": "Vídeo inteiro com fundo desfocado", "crop": "Recorte central (tela cheia)"}


def video_filter(layout: str, fps: int, subtitles_file: str | None) -> str:
    if layout == "crop":
        chain = (f"[0:v]crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale={OUT_W}:{OUT_H}:flags=lanczos,"
                 f"setsar=1,fps={fps}")
    elif layout == "blur":
        chain = (
            f"[0:v]fps={fps},split=2[bgsrc][fgsrc];"
            f"[bgsrc]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=10:2,"
            f"scale={OUT_W}:{OUT_H},eq=brightness=-0.08[bg];"
            f"[fgsrc]scale={OUT_W}:-2:flags=lanczos[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1"
        )
    else:
        raise ValueError(f"Layout desconhecido: {layout}")
    if subtitles_file:
        chain += f",ass={subtitles_file}"
    return chain + ",format=yuv420p[v]"


def audio_filter() -> str:
    # -14 LUFS: nível usado por TikTok/Reels/Shorts; picos limitados a -1,5 dBTP.
    return "[0:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]"
