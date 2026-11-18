"""Constrói e mantém o cliente Twitch de acordo com as configurações atuais."""
from __future__ import annotations

import threading

import requests

from database.repositories import SettingsRepository
from twitch.auth import TwitchAuth
from twitch.client import HelixClient
from twitch.errors import TwitchError


class TwitchService:
    def __init__(self, settings_repo: SettingsRepository, session_factory=requests.Session):
        self.settings_repo = settings_repo
        self.session_factory = session_factory
        self._lock = threading.Lock()
        self._key: tuple[str, str] | None = None
        self._client: HelixClient | None = None

    def client(self) -> HelixClient | None:
        """Retorna um ``HelixClient`` ou ``None`` se as credenciais não estiverem configuradas."""
        settings = self.settings_repo.load()
        if not settings.has_twitch_credentials():
            return None
        key = (settings.twitch_client_id, settings.twitch_client_secret)
        with self._lock:
            if self._client is None or self._key != key:
                auth = TwitchAuth(
                    key[0], key[1], session=self.session_factory(), store=self.settings_repo
                )
                self._client = HelixClient(auth)
                self._key = key
            return self._client

    def test_credentials(self, client_id: str, client_secret: str) -> str:
        """Testa credenciais sem salvá-las. Retorna mensagem de sucesso ou lança ``TwitchError``."""
        auth = TwitchAuth(client_id, client_secret, session=self.session_factory())
        auth.get_token(force_refresh=True)
        info = auth.validate()
        expires = int(info.get("expires_in", 0)) // 86400
        return f"Conexão com a Twitch OK. Token válido por cerca de {expires} dia(s)."

    def reset(self) -> None:
        with self._lock:
            self._client = None
            self._key = None


__all__ = ["TwitchService", "TwitchError"]
