class TwitchError(Exception):
    """Erro genérico da integração com a Twitch (mensagem em pt-BR)."""


class TwitchAuthError(TwitchError):
    """Credenciais ausentes ou inválidas."""


class TwitchRateLimitError(TwitchError):
    def __init__(self, message: str, reset_at: float | None = None):
        super().__init__(message)
        self.reset_at = reset_at


class TwitchNetworkError(TwitchError):
    """Falha de rede/timeout ao falar com a Twitch."""
