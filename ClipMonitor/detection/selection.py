"""Seleção de momentos sem sobreposição (supressão de não-máximos).

Regras para aceitar um novo candidato frente aos já existentes da mesma gravação:
1. Sobreposição (com folga mínima ``gap``): só entra se tiver pontuação maior que
   TODOS os conflitantes; nesse caso eles são substituídos. Aprovados pelo usuário
   nunca são substituídos.
2. Densidade: no máximo ``max_per_hour`` momentos em qualquer janela de 1 hora
   centrada no novo pico; se lotado, substitui o mais fraco se for melhor que ele.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from models.candidate import Candidate, CandidateStatus

PROTECTED = (CandidateStatus.APPROVED, CandidateStatus.RENDERED)
ACTIVE = (CandidateStatus.DETECTED, CandidateStatus.SCORED, CandidateStatus.APPROVED, CandidateStatus.RENDERED)


@dataclass
class Decision:
    accept: bool
    replace: list[int] = field(default_factory=list)
    reason: str = ""


def decide(new: Candidate, existing: list[Candidate], gap: float = 15.0, max_per_hour: int = 6) -> Decision:
    others = [c for c in existing if c.status in ACTIVE and c.id != new.id]

    conflicts = [c for c in others if c.overlaps(new.start, new.end, gap)]
    if any(c.status in PROTECTED for c in conflicts):
        return Decision(False, reason="sobrepõe um momento aprovado")
    if any(c.score >= new.score for c in conflicts):
        return Decision(False, reason="sobrepõe um momento melhor")
    replace = [c.id for c in conflicts]

    remaining = [c for c in others if c.id not in replace and abs(c.peak - new.peak) < 1800]
    if len(remaining) >= max_per_hour:
        replaceable = [c for c in remaining if c.status not in PROTECTED]
        weakest = min(replaceable, key=lambda c: c.score, default=None)
        if weakest is None or weakest.score >= new.score:
            return Decision(False, reason="limite de momentos por hora atingido")
        replace.append(weakest.id)
    return Decision(True, replace=replace)


def suppress(candidates: list[Candidate], gap: float = 15.0, limit: int | None = None) -> list[Candidate]:
    """NMS local: maiores pontuações primeiro, descartando quem sobrepõe um já escolhido."""
    chosen: list[Candidate] = []
    for c in sorted(candidates, key=lambda c: c.score, reverse=True):
        if any(c.overlaps(o.start, o.end, gap) for o in chosen):
            continue
        chosen.append(c)
        if limit is not None and len(chosen) >= limit:
            break
    return sorted(chosen, key=lambda c: c.start)
