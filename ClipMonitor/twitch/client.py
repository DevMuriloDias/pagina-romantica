"""Cliente mínimo da Twitch Helix API (somente o necessário na Fase 1)."""
from __future__ import annotations

import logging
import time
from typing import Iterable, Iterator

import requests

from models.live_status import StreamInfo, TwitchUser
from twitch.auth import TwitchAuth
from twitch.errors import TwitchAuthError, TwitchError, TwitchNetworkError, TwitchRateLimitError
from utils.timeutils import from_iso

log = logging.getLogger(__name__)

HELIX_URL = "https://api.twitch.tv/helix"
BATCH_SIZE = 100  # limite da Helix para parâmetros repetidos (user_login / login)


def _chunks(items: list[str], size: int) -> Iterator[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


class HelixClient:
    def __init__(self, auth: TwitchAuth, session: requests.Session | None = None, timeout: float = 10.0):
        self.auth = auth
        self.session = session or auth.session
        self.timeout = timeout

    def _get(self, path: str, params: list[tuple[str, str]]) -> dict:
        for attempt in range(2):
            token = self.auth.get_token(force_refresh=attempt > 0)
            headers = {"Client-Id": self.auth.client_id, "Authorization": f"Bearer {token}"}
            try:
                resp = self.session.get(f"{HELIX_URL}{path}", params=params, headers=headers, timeout=self.timeout)
            except requests.RequestException as exc:
                raise TwitchNetworkError("Falha de conexão com a Twitch.") from exc

            if resp.status_code == 401 and attempt == 0:
                log.info("Token rejeitado (401); renovando")
                self.auth.invalidate()
                continue
            if resp.status_code == 401:
                raise TwitchAuthError("A Twitch recusou as credenciais. Revise o Client ID/Secret.")
            if resp.status_code == 429:
                reset = resp.headers.get("Ratelimit-Reset")
                raise TwitchRateLimitError(
                    "Limite de requisições da Twitch atingido. Aguardando para tentar novamente.",
                    reset_at=float(reset) if reset else time.time() + 60,
                )
            if resp.status_code >= 400:
                raise TwitchError(f"Erro {resp.status_code} na Twitch API: {resp.text[:200]}")
            return resp.json()
        raise TwitchAuthError("Não foi possível autenticar na Twitch.")

    def get_users(self, logins: Iterable[str]) -> list[TwitchUser]:
        unique = sorted({l.lower() for l in logins if l})
        users: list[TwitchUser] = []
        for batch in _chunks(unique, BATCH_SIZE):
            data = self._get("/users", [("login", l) for l in batch])
            for u in data.get("data", []):
                users.append(
                    TwitchUser(
                        id=u["id"],
                        login=u["login"],
                        display_name=u.get("display_name") or u["login"],
                        profile_image_url=u.get("profile_image_url", ""),
                    )
                )
        return users

    def get_user(self, login: str) -> TwitchUser | None:
        users = self.get_users([login])
        return users[0] if users else None

    def get_live_streams(self, logins: Iterable[str]) -> dict[str, StreamInfo]:
        """Retorna ``{login_minúsculo: StreamInfo}`` apenas para canais ao vivo."""
        unique = sorted({l.lower() for l in logins if l})
        result: dict[str, StreamInfo] = {}
        for batch in _chunks(unique, BATCH_SIZE):
            params = [("user_login", l) for l in batch] + [("type", "live"), ("first", str(BATCH_SIZE))]
            data = self._get("/streams", params)
            for s in data.get("data", []):
                info = StreamInfo(
                    stream_id=s["id"],
                    user_id=s["user_id"],
                    user_login=s["user_login"].lower(),
                    user_name=s.get("user_name", s["user_login"]),
                    title=s.get("title", ""),
                    game_name=s.get("game_name", ""),
                    viewer_count=int(s.get("viewer_count", 0)),
                    started_at=from_iso(s.get("started_at")),
                    thumbnail_url=s.get("thumbnail_url", ""),
                )
                result[info.user_login] = info
        return result
