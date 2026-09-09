-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Entidades Patrimoniais (PF e PJ)
CREATE TYPE entity_type AS ENUM ('PF', 'PJ');

CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type entity_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Contas Bancárias / Carteiras (Origem e Destino)
CREATE TYPE account_type AS ENUM ('CHECKING', 'CREDIT_CARD', 'INVESTMENT', 'CASH');

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_type account_type NOT NULL DEFAULT 'CHECKING',
    initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    color_hex TEXT DEFAULT '#64748b',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Categorias Dinâmicas
CREATE TYPE transaction_nature AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE, -- NULL = Categoria Compartilhada
    name TEXT NOT NULL,
    nature transaction_nature NOT NULL,
    icon TEXT DEFAULT 'tag',
    color_hex TEXT DEFAULT '#64748b',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Gestão de Dívidas e Financiamentos
CREATE TYPE debt_status AS ENUM ('ACTIVE', 'PAID_OFF', 'RENEGOTIATED');

CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    creditor TEXT NOT NULL,
    description TEXT,
    total_amount NUMERIC(14,2) NOT NULL,
    interest_rate_monthly NUMERIC(5,2) DEFAULT 0.00,
    installments_count INT NOT NULL,
    start_date DATE NOT NULL,
    status debt_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Parcelas das Dívidas
CREATE TYPE installment_status AS ENUM ('PENDING', 'PAID');

CREATE TABLE debt_installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    installment_number INT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    status installment_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Transações Financeiras (Entradas, Saídas e Transferências)
CREATE TYPE transaction_type AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'PAID');

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    destination_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT, -- Para TRANSFER
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    debt_installment_id UUID REFERENCES debt_installments(id) ON DELETE SET NULL,
    type transaction_type NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    status transaction_status NOT NULL DEFAULT 'PAID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Orçamento Planejado (Planejado vs. Realizado)
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL, -- Formato "YYYY-MM"
    planned_amount NUMERIC(14,2) NOT NULL CHECK (planned_amount >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (entity_id, category_id, month_year)
);

-- Índices de Desempenho
CREATE INDEX idx_transactions_entity_date ON transactions(entity_id, transaction_date);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_debt_installments_due ON debt_installments(due_date, status);
CREATE INDEX idx_budgets_lookup ON budgets(entity_id, month_year);