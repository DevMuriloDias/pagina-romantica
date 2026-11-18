"""Autenticação da Twitch via *Client Credentials* (app access token).

Para consultar status ao vivo (``GET /helix/streams`` e ``/helix/users``) um
app access token basta: não há login do usuário nem servidor de callback.
O token é guardado em cache (SQLite, protegido por DPAPI) e renovado
automaticamente perto do vencimento ou após um 401.

Observação para fases futuras: EventSub via WebSocket exige *user* access
token; será obtido com o Device Code Flow (sem servidor local).
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta
from typing import Callable, Protocol

import requests

from twitch.errors import TwitchAuthError, TwitchNetworkError
from utils.logging_setup import register_secret
from utils.timeutils import utcnow

log = logging.getLogger(__name__)

TOKEN_URL = "https://id.twitch.tv/oauth2/token"
VALIDATE_URL = "https://id.twitch.tv/oauth2/validate"
REFRESH_MARGIN = timedelta(minutes=10)


class TokenStore(Protocol):
    def load_cached_token(self) -> tuple[str, datetime] | None: ...
    def save_cached_token(self, token: str, expires_at: datetime) -> None: ...
    def clear_cached_token(self) -> None: ...


class MemoryTokenStore:
    def __init__(self) -> None:
        self._value: tuple[str, datetime] | None = None

    def load_cached_token(self):
        return self._value

    def save_cached_token(self, token, expires_at):
        self._value = (token, expires_at)

    def clear_cached_token(self):
        self._value = None


class TwitchAuth:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        session: requests.Session | None = None,
        store: TokenStore | None = None,
        clock: Callable[[], datetime] = utcnow,
        timeout: float = 10.0,
    ):
        self.client_id = client_id.strip()
        self.client_secret = client_secret.strip()
        register_secret(self.client_secret)
        self.session = session or requests.Session()
        self.store = store or MemoryTokenStore()
        self.clock = clock
        self.timeout = timeout
        self._lock = threading.Lock()
        self._token: str | None = None
        self._expires_at: datetime | None = None

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def get_token(self, force_refresh: bool = False) -> str:
        if not self.configured:
            raise TwitchAuthError("Configure o Client ID e o Client Secret da Twitch nas Configurações.")
        with self._lock:
            if not force_refresh:
                if self._token is None:
                    cached = self.store.load_cached_token()
                    if cached:
                        self._token, self._expires_at = cached
                if self._token and self._expires_at and self.clock() < self._expires_at - REFRESH_MARGIN:
                    return self._token
            return self._request_token()

    def invalidate(self) -> None:
        with self._lock:
            self._token = None
            self._expires_at = None
            self.store.clear_cached_token()

    def _request_token(self) -> str:
        log.info("Solicitando novo app access token da Twitch")
        try:
            resp = self.session.post(
                TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "client_credentials",
                },
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise TwitchNetworkError("Não foi possível conectar à Twitch. Verifique sua internet.") from exc

        if resp.status_code in (400, 401, 403):
            self.store.clear_cached_token()
            raise TwitchAuthError("Client ID ou Client Secret inválidos. Confira os dados no console da Twitch.")
        if resp.status_code >= 400:
            raise TwitchNetworkError(f"A Twitch respondeu com erro {resp.status_code} ao gerar o token.")

        payload = resp.json()
        token = payload.get("access_token")
        if not token:
            raise TwitchAuthError("Resposta de autenticação da Twitch sem token.")
        register_secret(token)
        expires_in = int(payload.get("expires_in", 3600))
        self._token = token
        self._expires_at = self.clock() + timedelta(seconds=expires_in)
        self.store.save_cached_token(token, self._expires_at)
        return token

    def validate(self) -> dict:
        """Valida o token atual em ``/oauth2/validate`` (recomendado pela Twitch)."""
        token = self.get_token()
        try:
            resp = self.session.get(VALIDATE_URL, headers={"Authorization": f"OAuth {token}"}, timeout=self.timeout)
        except requests.RequestException as exc:
            raise TwitchNetworkError("Não foi possível conectar à Twitch.") from exc
        if resp.status_code == 401:
            self.invalidate()
            token = self.get_token(force_refresh=True)
            resp = self.session.get(VALIDATE_URL, headers={"Authorization": f"OAuth {token}"}, timeout=self.timeout)
        if resp.status_code != 200:
            raise TwitchAuthError("Token da Twitch rejeitado.")
        return resp.json()
