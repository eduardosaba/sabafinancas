### `DATABASE_SCHEMA.md`

```markdown
# Esquema de Dados Relacional (PostgreSQL / Supabase DDL)

## 1. Diagrama de Relacionamento (ERD)

```text
users ───< entities ───< accounts ──────< transactions
              │               ▲                │
              ├───< categories ┼────────────────┤
              │                │                │
              ├───< debts ─────┴──< debt_installments
              │
              └───< budgets