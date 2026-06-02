# Corrida Integração — instruções pro Claude

App **oficial da Corrida Integração** (prova 27/09/2026). Fork independente do MultiFit.

## Regra de ouro: NÃO MEXER no MultiFit

- MultiFit (pasta `~/PycharmProjects/exercicios`) está rodando liso e **não deve ser tocado** ao trabalhar aqui.
- Qualquer alteração deste app fica **só nesta pasta** (`~/PycharmProjects/corrida-integracao`), repo `Leovilela88/corrida-integracao`, Railway próprio.
- Antes de editar um arquivo, confira o path: precisa começar com `/Users/leonardovilela/PycharmProjects/corrida-integracao/`.

## Escopo do produto

- **Só corrida.** `SPORTS = ("corrida",)` em `main.py`.
- Strava: importa apenas atividades de corrida (Run/TrailRun/VirtualRun). Ver `strava_api._is_running()` e o filtro em `strava_import.parse_strava_csv`.
- Dashboard mostra só métricas de corrida + calorias + dias ativos.

## Stack

- FastAPI + SQLAlchemy + Jinja templates.
- **Local:** rodar com `/Users/leonardovilela/PycharmProjects/exercicios/.venv/bin/uvicorn main:app --reload --port 8801` (usa a venv do MultiFit por compatibilidade — não criar venv própria, gasta espaço à toa).
- **Banco em produção:** Postgres do Railway. `DATABASE_URL` referenciada via `${{Postgres.DATABASE_URL}}`.
- **URL pública:** `web-production-d71bc.up.railway.app`.

## Identidade visual

- Cor de fundo: `--bg: #010714` (azul quase preto).
- Accent: `#1c7df0`.
- Logo wordmark: `static/INTEGRACAO_LOGO.png` (header/login).
- Favicon: `static/icon.svg` (NÃO é mais o haltere do MultiFit).
