"""Planos de treino fixos (5K/10K/21K) de 12 semanas até a prova.

A "semana atual" é calculada pela contagem regressiva até a data da prova
(definida em main/dashboard como 26/09/2026). Planos pensados para corredor
iniciante/intermediário — 4 sessões por semana.
"""
from datetime import date

PLAN_WEEKS = 12
DISTANCES = ["5K", "10K", "21K"]

# Quilometragem do treino longo por semana (12 valores; taper nas 2 últimas)
_LONG = {
    "5K":  [4, 5, 5, 6, 6, 7, 7, 8, 8, 6, 5, 3],
    "10K": [6, 7, 8, 8, 9, 10, 10, 12, 12, 9, 7, 5],
    "21K": [8, 10, 10, 12, 14, 15, 16, 18, 18, 14, 10, 8],
}
# Corrida leve / base por semana
_EASY = {"5K": 4, "10K": 5, "21K": 6}
# Sessões de tiros (rotativas ao longo das semanas)
_INTERVALS = [
    "6 × 400 m forte (trote de 1 min entre)",
    "5 × 800 m em ritmo de prova",
    "4 × 1000 m progressivos",
    "8 × 400 m rápidos",
    "3 × 1600 m em ritmo de limiar",
    "6 × 600 m fortes",
]


def build_plan(distance: str) -> list:
    distance = distance if distance in DISTANCES else "10K"
    longs = _LONG[distance]
    easy = _EASY[distance]
    weeks = []
    for i in range(PLAN_WEEKS):
        n = i + 1
        is_taper = n >= PLAN_WEEKS - 1  # 2 últimas semanas
        is_peak = longs[i] == max(longs)
        if is_taper:
            focus = "Taper (afinar para a prova)"
            sessions = [
                {"tag": "Leve", "desc": f"{max(3, easy-1)} km bem tranquilo"},
                {"tag": "Ritmo", "desc": "2–3 km no ritmo de prova"},
                {"tag": "Solto", "desc": f"{longs[i]} km leve, sem forçar"},
            ]
        else:
            focus = "Pico de volume" if is_peak else "Construção"
            sessions = [
                {"tag": "Leve", "desc": f"{easy} km em ritmo confortável"},
                {"tag": "Intervalado", "desc": _INTERVALS[i % len(_INTERVALS)]},
                {"tag": "Moderado", "desc": f"{easy + 1} km firme + 4 educativos"},
                {"tag": "Longo", "desc": f"{longs[i]} km contínuo (ritmo de conversa)"},
            ]
        weeks.append({
            "week": n,
            "focus": focus,
            "is_taper": is_taper,
            "is_peak": is_peak,
            "long_km": longs[i],
            "sessions": sessions,
        })
    return weeks


def weeks_to_race(race_day: date, today: date) -> int:
    """Quantas semanas (inteiras, arredondando p/ cima) faltam para a prova."""
    days = (race_day - today).days
    if days <= 0:
        return 0
    return (days + 6) // 7


def plan_status(race_day: date, today: date) -> dict:
    """Posição no plano. current_week = None enquanto ainda está na fase de base
    (faltam mais semanas que o plano cobre)."""
    wtr = weeks_to_race(race_day, today)
    if wtr <= 0:
        return {"phase": "race", "current_week": PLAN_WEEKS, "weeks_to_race": 0}
    current = PLAN_WEEKS - wtr + 1
    if current < 1:
        return {"phase": "base", "current_week": None,
                "weeks_to_race": wtr, "starts_in": 1 - current}
    return {"phase": "plan", "current_week": current, "weeks_to_race": wtr}
