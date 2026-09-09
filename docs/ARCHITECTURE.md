# Arquitetura do Sistema: Gestão Financeira PF/PJ

## 1. Visão Geral
Aplicação web full-stack e PWA para controle financeiro integrado de Pessoa Física (PF) e Pessoa Jurídica (PJ). Foco em separação patrimonial estrita, tomada de decisão preventiva, gestão de endividamento e entrada rápida de dados sem custos operacionais de IA.

---

## 2. Stack Tecnológica
- **Framework:** Next.js 15+ (App Router, Server Actions, Route Handlers)
- **Linguagem:** TypeScript (strict mode)
- **Estilização & UI:** Tailwind CSS, Shadcn/UI, Lucide React
- **Gráficos:** Recharts
- **Banco de Dados:** PostgreSQL (via Supabase ou Prisma ORM com SQLite local)
- **Autenticação:** Supabase Auth ou NextAuth.js com sessões via Cookies HttpOnly
- **PWA:** `next-pwa` ou Web App Manifest nativo

---

## 3. Estrutura de Pastas Sugerida

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx             # Contexto global PF/PJ e Header
│   │   ├── page.tsx               # Dashboard de Decisão
│   │   ├── transactions/page.tsx  # Extrato e Lançamentos
│   │   ├── debts/page.tsx         # Gestão de Dívidas e Parcelas
│   │   ├── budgets/page.tsx       # Planejado vs. Realizado
│   │   └── settings/
│   │       ├── accounts/page.tsx  # Contas Bancárias (Origem/Destino)
│   │       └── categories/page.tsx# Categorias Dinâmicas
│   ├── api/                       # Rotas de webhook / exportação
│   ├── manifest.json              # Configuração PWA
│   └── layout.tsx                 # Splash Screen Handler & Providers
├── components/
│   ├── dashboard/                 # Gráficos, métricas executivas, alertas
│   ├── transactions/
│   │   ├── quick-input.tsx        # Caixa de texto inteligente (Zero Tokens)
│   │   └── transaction-modal.tsx  # Formulário tradicional completo
│   ├── layout/                    # Header, seletor PF/PJ, Splash
│   └── ui/                        # Primitivos Shadcn/UI
├── lib/
│   ├── parsers/
│   │   └── quick-input.ts         # Algoritmo de regex e fuzzy match local
│   ├── db/                        # Cliente Prisma ou Supabase Client
│   └── utils.ts
├── hooks/                         # useEntityContext, useDateFilter
└── types/                         # Interfaces TypeScript e Enums