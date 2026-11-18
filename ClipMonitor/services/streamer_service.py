"""Regras de negócio de cadastro de streamers."""
from __future__ import annotations

import logging
import re
from dataclasses import replace

from database.repositories import ActivityRepository, StreamerRepository
from models.streamer import Streamer
from twitch.errors import TwitchError

log = logging.getLogger(__name__)

# Regra de nomes de usuário da Twitch: 4–25 caracteres, letras, números e "_".
# Contas antigas podem ter 3 caracteres, por isso aceitamos a partir de 3.
LOGIN_RE = re.compile(r"^[a-z0-9_]{3,25}$")
_URL_RE = re.compile(r"^(?:https?://)?(?:www\.|m\.)?twitch\.tv/([^/?#\s]+)", re.IGNORECASE)


class ValidationError(ValueError):
    pass


def normalize_login(raw: str) -> str:
    """Aceita ``nome``, ``@nome`` ou URL do canal e devolve o login normalizado."""
    value = (raw or "").strip()
    match = _URL_RE.match(value)
    if match:
        value = match.group(1)
    value = value.lstrip("@").strip().lower()
    if not value:
        raise ValidationError("Informe o nome do canal.")
    if not LOGIN_RE.match(value):
        raise ValidationError("Nome de canal inválido. Use 3 a 25 caracteres: letras, números ou '_'.")
    return value


class StreamerService:
    def __init__(self, repo: StreamerRepository, activity: ActivityRepository, helix_provider=None):
        """``helix_provider``: callable que retorna um ``HelixClient`` ou ``None`` se não configurado."""
        self.repo = repo
        self.activity = activity
        self.helix_provider = helix_provider or (lambda: None)

    def list(self) -> list[Streamer]:
        return self.repo.list_all()

    def get(self, streamer_id: int) -> Streamer | None:
        return self.repo.get(streamer_id)

    def _validate(self, s: Streamer) -> Streamer:
        login = normalize_login(s.login)
        if s.monitoring_enabled and not s.authorized:
            raise ValidationError(
                "Para monitorar este canal, confirme que você tem autorização do streamer."
            )
        return replace(
            s,
            login=login,
            display_name=s.display_name.strip(),
            authorization_note=s.authorization_note.strip()[:500],
            notes=s.notes.strip()[:2000],
        )

    def _enrich_from_twitch(self, s: Streamer, verify: bool) -> Streamer:
        helix = self.helix_provider()
        if helix is None:
            return s
        try:
            user = helix.get_user(s.login)
        except TwitchError as exc:
            log.warning("Não foi possível verificar %s na Twitch: %s", s.login, exc)
            return s
        if user is None:
            if verify:
                raise ValidationError(f"O canal '{s.login}' não foi encontrado na Twitch.")
            return s
        return replace(
            s,
            twitch_user_id=user.id,
            display_name=s.display_name or user.display_name,
            profile_image_url=user.profile_image_url,
        )

    def add(self, s: Streamer, verify_on_twitch: bool = True) -> Streamer:
        s = self._validate(s)
        s = self._enrich_from_twitch(s, verify_on_twitch)
        created = self.repo.add(s)
        self.activity.add(f"Streamer {created.name} adicionado.", streamer_id=created.id)
        return created

    def update(self, s: Streamer, verify_on_twitch: bool = True) -> Streamer:
        if s.id is None:
            raise ValidationError("Streamer inválido.")
        current = self.repo.get(s.id)
        if current is None:
            raise ValidationError("Streamer não encontrado.")
        s = self._validate(s)
        if s.login != current.login:
            # Canal mudou: limpa identidade antiga e verifica de novo.
            s = replace(s, twitch_user_id=None, profile_image_url=None)
            s = self._enrich_from_twitch(s, verify_on_twitch)
        else:
            s = replace(s, twitch_user_id=current.twitch_user_id, profile_image_url=current.profile_image_url)
        updated = self.repo.update(s)
        self.activity.add(f"Streamer {updated.name} atualizado.", streamer_id=updated.id)
        return updated

    def set_monitoring(self, streamer_id: int, enabled: bool) -> Streamer:
        s = self.repo.get(streamer_id)
        if s is None:
            raise ValidationError("Streamer não encontrado.")
        if enabled and not s.authorized:
            raise ValidationError("Confirme a autorização do streamer antes de ativar o monitoramento.")
        self.repo.set_monitoring(streamer_id, enabled)
        state = "ativado" if enabled else "pausado"
        self.activity.add(f"Monitoramento de {s.name} {state}.", streamer_id=streamer_id)
        return self.repo.get(streamer_id)  # type: ignore[return-value]

    def remove(self, streamer_id: int) -> None:
        s = self.repo.get(streamer_id)
        if s is None:
            return
        self.repo.delete(streamer_id)
        self.activity.add(f"Streamer {s.name} removido.")
