-- ==============================================================================
-- SCRIPT DE CONEXÃO E PERMISSÕES SUPABASE - FINANÇAS PF/PJ
-- Execute este script no SQL Editor do Supabase para liberar o salvamento no banco!
-- Dashboard -> SQL Editor -> New Query -> Paste & Run (Ctrl + Enter)
-- ==============================================================================

-- 1. Desabilitar restrições RLS em todas as tabelas (permite escrita/leitura pelo app)
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS entities DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS debts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS debt_installments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS budgets DISABLE ROW LEVEL SECURITY;

-- 2. Conceder permissões totais de LEITURA, ESCRITA, ATUALIZAÇÃO e EXCLUSÃO para anon e authenticated
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Inserir Usuário Padrão e Entidades Patrimoniais Iniciais (se não existirem)
INSERT INTO users (id, email, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'usuario@financas.com.br', 'Eduardo Finanças')
ON CONFLICT (id) DO NOTHING;

INSERT INTO entities (id, user_id, name, type)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Pessoal (PF)', 'PF'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Empresa (PJ)', 'PJ')
ON CONFLICT (id) DO NOTHING;

-- 4. Inserir Contas Bancárias Iniciais (se não existirem)
INSERT INTO accounts (id, entity_id, name, account_type, initial_balance, current_balance, color_hex, is_active)
VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Nubank (PF)', 'CHECKING', 2500.00, 7680.00, '#10b981', TRUE),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Carteira / Dinheiro', 'CASH', 300.00, 450.00, '#059669', TRUE),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'Banco Inter PJ', 'CHECKING', 10000.00, 27550.00, '#3b82f6', TRUE),
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'Caixa Operacional', 'CHECKING', 5000.00, 12000.00, '#2563eb', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5. Inserir Categorias Iniciais (PF e PJ Completas)
INSERT INTO categories (id, entity_id, name, nature, icon, color_hex)
VALUES
  -- Categorias PF
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Alimentação', 'EXPENSE', 'utensils', '#ef4444'),
  ('c1111111-1111-1111-1111-222222222222', '11111111-1111-1111-1111-111111111111', 'Moradia', 'EXPENSE', 'home', '#8b5cf6'),
  ('c1111111-1111-1111-1111-333333333333', '11111111-1111-1111-1111-111111111111', 'Combustível / Transporte', 'EXPENSE', 'fuel', '#f59e0b'),
  ('c1111111-1111-1111-1111-444444444444', '11111111-1111-1111-1111-111111111111', 'Lazer & Entretenimento', 'EXPENSE', 'film', '#ec4899'),
  ('c1111111-1111-1111-1111-555555555555', '11111111-1111-1111-1111-111111111111', 'Saúde & Bem-Estar', 'EXPENSE', 'heart-pulse', '#10b981'),
  ('c1111111-1111-1111-1111-666666666666', '11111111-1111-1111-1111-111111111111', 'Salário / Pró-labore', 'INCOME', 'dollar-sign', '#06b6d4'),
  ('c1111111-1111-1111-1111-777777777777', '11111111-1111-1111-1111-111111111111', 'Investimentos & Dividendos', 'INCOME', 'trending-up', '#10b981'),
  ('c1111111-1111-1111-1111-888888888888', '11111111-1111-1111-1111-111111111111', 'Outras Receitas / Extras', 'INCOME', 'plus-circle', '#3b82f6'),
  ('c1111111-1111-1111-1111-999999999999', '11111111-1111-1111-1111-111111111111', 'Educação & Cursos', 'EXPENSE', 'book-open', '#6366f1'),
  ('c1111111-1111-1111-1111-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Vestuário & Compras', 'EXPENSE', 'shopping-bag', '#f43f5e'),
  ('c1111111-1111-1111-1111-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Assinaturas & Serviços', 'EXPENSE', 'tv', '#a855f7'),
  ('c1111111-1111-1111-1111-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Seguros & Financiamentos', 'EXPENSE', 'shield-check', '#0284c7'),
  ('c1111111-1111-1111-1111-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Tarifas Bancárias & Impostos PF', 'EXPENSE', 'percent', '#64748b'),
  ('c1111111-1111-1111-1111-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Pets / Animais', 'EXPENSE', 'dog', '#d97706'),

  -- Categorias PJ
  ('c2222222-2222-2222-2222-111111111111', '22222222-2222-2222-2222-222222222222', 'Vendas / Serviços Prestados', 'INCOME', 'briefcase', '#10b981'),
  ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Fornecedores & Insumos', 'EXPENSE', 'truck', '#3b82f6'),
  ('c2222222-2222-2222-2222-333333333333', '22222222-2222-2222-2222-222222222222', 'Impostos & DAS / Tributos', 'EXPENSE', 'file-text', '#dc2626'),
  ('c2222222-2222-2222-2222-444444444444', '22222222-2222-2222-2222-222222222222', 'Custos Operacionais Gerais', 'EXPENSE', 'settings', '#64748b'),
  ('c2222222-2222-2222-2222-555555555555', '22222222-2222-2222-2222-222222222222', 'Pró-labore / Distribuição de Lucros', 'EXPENSE', 'corner-up-right', '#8b5cf6'),
  ('c2222222-2222-2222-2222-666666666666', '22222222-2222-2222-2222-222222222222', 'Rendimentos Financeiros PJ', 'INCOME', 'trending-up', '#059669'),
  ('c2222222-2222-2222-2222-777777777777', '22222222-2222-2222-2222-222222222222', 'Folha de Pagamento & Salários', 'EXPENSE', 'users', '#f59e0b'),
  ('c2222222-2222-2222-2222-888888888888', '22222222-2222-2222-2222-222222222222', 'Encargos Sociais & Trabalhistas', 'EXPENSE', 'file-check', '#ef4444'),
  ('c2222222-2222-2222-2222-999999999999', '22222222-2222-2222-2222-222222222222', 'Marketing & Publicidade / Ads', 'EXPENSE', 'megaphone', '#ec4899'),
  ('c2222222-2222-2222-2222-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Software, SaaS & TI', 'EXPENSE', 'cpu', '#06b6d4'),
  ('c2222222-2222-2222-2222-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Contabilidade & Jurídico', 'EXPENSE', 'scale', '#475569'),
  ('c2222222-2222-2222-2222-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Aluguel & Infraestrutura PJ', 'EXPENSE', 'building', '#8b5cf6'),
  ('c2222222-2222-2222-2222-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'Viagens & Representação Comercial', 'EXPENSE', 'plane', '#3b82f6'),
  ('c2222222-2222-2222-2222-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'Tarifas Bancárias & Maquininha', 'EXPENSE', 'credit-card', '#64748b'),
  ('c2222222-2222-2222-2222-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'Manutenção & Equipamentos', 'EXPENSE', 'wrench', '#d97706')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  nature = EXCLUDED.nature,
  icon = EXCLUDED.icon,
  color_hex = EXCLUDED.color_hex;
