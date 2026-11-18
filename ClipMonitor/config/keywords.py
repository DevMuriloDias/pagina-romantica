"""Léxico de empolgação em português (live/gaming) para a pontuação por texto.

Os termos são comparados sem acentos e sem pontuação. Peso maior = sinal mais
forte de momento "clipável". Termos personalizados (Configurações) recebem
peso 2. Palavrões comuns em lives entram como sinal de intensidade; o texto não
é exibido nem publicado por causa disso.
"""

KEYWORDS: dict[str, float] = {
    # Pedido explícito de clipe
    "clipa": 4, "clipa isso": 5, "clipou": 3, "clipem": 4, "faz o clip": 4,
    # Espanto
    "nao acredito": 3, "meu deus": 3, "ai meu deus": 3, "mano do ceu": 3, "que isso": 2.5,
    "caraca": 2.5, "nossa": 1.5, "jesus": 2, "misericordia": 3, "socorro": 2.5, "eita": 2,
    "olha isso": 2, "voces viram": 2.5, "ta maluco": 2.5, "ta doido": 2, "impossivel": 2.5,
    "inacreditavel": 3, "surreal": 2.5, "absurdo": 2.5, "insano": 2.5, "doidera": 2,
    "puta que pariu": 3, "caralho": 2, "porra": 1.5,
    # Jogo / resultado
    "ganhamos": 2.5, "ganhei": 2, "vitoria": 2, "perdemos": 2, "perdi": 1.5, "morri": 2,
    "matei": 1.5, "que jogada": 3, "que tiro": 2.5, "ace": 2.5, "clutch": 3, "brabo": 1.5,
    "vai vai vai": 2.5, "nao nao nao": 2.5, "corre": 1, "gol": 2.5,
    # Riso
    "risos": 2, "rindo": 1.5,
}

# Padrões de risada escritos (k, ha, rs) — contados à parte.
LAUGH_PATTERNS = (r"\bk{3,}\b", r"\b(?:ha){2,}h?\b", r"\b(?:rs){2,}\b", r"\b(?:he){3,}\b")

EXPLICIT_CLIP_TERMS = ("clipa", "clipa isso", "clipem", "faz o clip")
