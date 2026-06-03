"""Desafios (estilo Strava): metas recorrentes semanais e mensais por esporte.

A pessoa aceita um desafio e o progresso é calculado a partir dos treinos do
período corrente (semana ISO ou mês).
"""
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Workout
from metrics import SPORT_COLORS


@dataclass
class Challenge:
    code: str
    title: str
    sport: Optional[str]   # None = qualquer esporte
    metric: str            # 'distance' | 'duration' | 'count' | 'calories'
    target: float
    period: str            # 'week' | 'month'
    icon: str
    color: str
    unit: str              # 'km' | 'min' | 'treinos' | 'kcal'


def _c(code, title, sport, metric, target, period, icon, unit):
    color = SPORT_COLORS.get(sport, "#60a5fa")
    return Challenge(code, title, sport, metric, target, period, icon, color, unit)


# Catálogo de desafios. Semanais e mensais, cobrindo todos os esportes.
CHALLENGES = [
    # ---- semanais ----
    _c("run_w_15", "15 km de corrida", "corrida", "distance", 15, "week", "run", "km"),
    _c("run_w_25", "25 km de corrida", "corrida", "distance", 25, "week", "run", "km"),
    _c("run_w_3x", "Correr 3 vezes", "corrida", "count", 3, "week", "target", "corridas"),
    # ---- mensais ----
    _c("run_m_50", "50 km de corrida", "corrida", "distance", 50, "month", "run", "km"),
    _c("run_m_100", "100 km de corrida", "corrida", "distance", 100, "month", "run", "km"),
    _c("run_m_12x", "12 corridas no mês", "corrida", "count", 12, "month", "target", "corridas"),
    _c("cal_m_10000", "10.000 kcal queimadas", "corrida", "calories", 10000, "month", "flame", "kcal"),
]

CHALLENGES_BY_CODE = {c.code: c for c in CHALLENGES}


@dataclass
class EventChallenge:
    code: str
    title: str
    desc: str
    legs: list           # ["5K · sábado (26/09)", "10K · domingo (27/09)"]
    icon: str = "flag"
    color: str = "#05e0a3"
    period: str = "event"


# Desafios oficiais da prova (corridas especiais) — medalhas especiais.
# A pessoa aceita/recusa; não têm barra de progresso (é participação na prova).
EVENT_CHALLENGES = [
    EventChallenge(
        "voo_curto", "Voo Curto",
        "Encare as duas provas e leve a medalha especial do desafio.",
        ["5K · sábado (26/09)", "10K · domingo (27/09)"],
    ),
    EventChallenge(
        "voo_longo", "Voo Longo",
        "O desafio completo: a abertura no sábado e a meia no domingo.",
        ["5K · sábado (26/09)", "21K · domingo (27/09)"],
    ),
]

ALL_BY_CODE = {**CHALLENGES_BY_CODE, **{e.code: e for e in EVENT_CHALLENGES}}


def period_key(period: str, today: date) -> str:
    if period == "event":
        return "integracao-2026"
    if period == "month":
        return today.strftime("%Y-%m")
    iso = today.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def build_event(joined: set) -> list:
    """Lista os desafios da prova com status de aceito."""
    pk = period_key("event", date.today())
    return [
        {"ch": e, "joined": (e.code, pk) in joined}
        for e in EVENT_CHALLENGES
    ]


def period_window(period: str, today: date) -> tuple[date, date]:
    if period == "month":
        return today.replace(day=1), today
    monday = today - timedelta(days=today.weekday())
    return monday, today


def period_label(period: str) -> str:
    return "mês" if period == "month" else "semana"


def progress(db: Session, athlete_id: int, ch: Challenge, today: date) -> float:
    start, end = period_window(ch.period, today)
    q = db.query(Workout).filter(
        Workout.athlete_id == athlete_id,
        Workout.date >= start, Workout.date <= end,
    )
    if ch.sport:
        q = q.filter(Workout.sport == ch.sport)
    if ch.metric == "distance":
        val = q.with_entities(func.coalesce(func.sum(Workout.distance_km), 0.0)).scalar()
    elif ch.metric == "duration":
        val = q.with_entities(func.coalesce(func.sum(Workout.duration_min), 0.0)).scalar()
    elif ch.metric == "calories":
        val = q.with_entities(func.coalesce(func.sum(Workout.calories), 0.0)).scalar()
    else:  # count
        val = q.count()
    return float(val or 0)


def _fmt(value: float, unit: str) -> str:
    if unit in ("treinos",):
        return f"{int(round(value))}"
    if unit == "kcal":
        return f"{int(round(value)):,}".replace(",", ".")
    # km / min com 1 casa quando faz sentido
    s = f"{value:.1f}".rstrip("0").rstrip(".").replace(".", ",")
    return s


def build(db: Session, athlete_id: int, today: date, joined: set) -> dict:
    """Monta as listas de desafios (semanais/mensais) com status e progresso.
    `joined` = set de (code, period_key) que o atleta aceitou."""
    weekly, monthly = [], []
    for ch in CHALLENGES:
        pk = period_key(ch.period, today)
        is_joined = (ch.code, pk) in joined
        prog = progress(db, athlete_id, ch, today) if is_joined else 0.0
        pct = min(100, round(prog / ch.target * 100)) if ch.target else 0
        item = {
            "ch": ch,
            "joined": is_joined,
            "progress": prog,
            "progress_fmt": _fmt(prog, ch.unit),
            "target_fmt": _fmt(ch.target, ch.unit),
            "pct": pct,
            "done": prog >= ch.target,
        }
        (monthly if ch.period == "month" else weekly).append(item)
    return {"weekly": weekly, "monthly": monthly}
