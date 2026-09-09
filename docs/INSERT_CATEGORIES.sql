-- ==============================================================================
-- SCRIPT DE CATEGORIAS PF E PJ COMPLETO - FINANÇAS PF/PJ
-- Execute este script no SQL Editor do Supabase para atualizar as categorias!
-- Dashboard Supabase -> SQL Editor -> New Query -> Cole este arquivo -> Run
-- ==============================================================================

-- 1. Assegurar que as Entidades padrão (PF e PJ) existam antes das categorias
INSERT INTO entities (id, user_id, name, type)
VALUES 
  ('11111111-1111-1111-1111-111111111111', NULL, 'Pessoal (PF)', 'PF'),
  ('22222222-2222-2222-2222-222222222222', NULL, 'Empresa (PJ)', 'PJ')
ON CONFLICT (id) DO NOTHING;

-- 2. Inserir / Atualizar Categorias de Pessoa Física (PF)
INSERT INTO categories (id, entity_id, name, nature, icon, color_hex)
VALUES
  -- Categorias PF existentes
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Alimentação', 'EXPENSE', 'utensils', '#ef4444'),
  ('c1111111-1111-1111-1111-222222222222', '11111111-1111-1111-1111-111111111111', 'Moradia', 'EXPENSE', 'home', '#8b5cf6'),
  ('c1111111-1111-1111-1111-333333333333', '11111111-1111-1111-1111-111111111111', 'Combustível / Transporte', 'EXPENSE', 'fuel', '#f59e0b'),
  ('c1111111-1111-1111-1111-444444444444', '11111111-1111-1111-1111-111111111111', 'Lazer & Entretenimento', 'EXPENSE', 'film', '#ec4899'),
  ('c1111111-1111-1111-1111-555555555555', '11111111-1111-1111-1111-111111111111', 'Saúde & Bem-Estar', 'EXPENSE', 'heart-pulse', '#10b981'),
  ('c1111111-1111-1111-1111-666666666666', '11111111-1111-1111-1111-111111111111', 'Salário / Pró-labore', 'INCOME', 'dollar-sign', '#06b6d4'),
  -- Novas Categorias PF
  ('c1111111-1111-1111-1111-777777777777', '11111111-1111-1111-1111-111111111111', 'Investimentos & Dividendos', 'INCOME', 'trending-up', '#10b981'),
  ('c1111111-1111-1111-1111-888888888888', '11111111-1111-1111-1111-111111111111', 'Outras Receitas / Extras', 'INCOME', 'plus-circle', '#3b82f6'),
  ('c1111111-1111-1111-1111-999999999999', '11111111-1111-1111-1111-111111111111', 'Educação & Cursos', 'EXPENSE', 'book-open', '#6366f1'),
  ('c1111111-1111-1111-1111-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Vestuário & Compras', 'EXPENSE', 'shopping-bag', '#f43f5e'),
  ('c1111111-1111-1111-1111-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Assinaturas & Serviços', 'EXPENSE', 'tv', '#a855f7'),
  ('c1111111-1111-1111-1111-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Seguros & Financiamentos', 'EXPENSE', 'shield-check', '#0284c7'),
  ('c1111111-1111-1111-1111-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Tarifas Bancárias & Impostos PF', 'EXPENSE', 'percent', '#64748b'),
  ('c1111111-1111-1111-1111-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Pets / Animais', 'EXPENSE', 'dog', '#d97706')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  nature = EXCLUDED.nature,
  icon = EXCLUDED.icon,
  color_hex = EXCLUDED.color_hex;

-- 3. Inserir / Atualizar Categorias de Pessoa Jurídica (PJ)
INSERT INTO categories (id, entity_id, name, nature, icon, color_hex)
VALUES
  -- Categorias PJ existentes
  ('c2222222-2222-2222-2222-111111111111', '22222222-2222-2222-2222-222222222222', 'Vendas / Serviços Prestados', 'INCOME', 'briefcase', '#10b981'),
  ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Fornecedores & Insumos', 'EXPENSE', 'truck', '#3b82f6'),
  ('c2222222-2222-2222-2222-333333333333', '22222222-2222-2222-2222-222222222222', 'Impostos & DAS / Tributos', 'EXPENSE', 'file-text', '#dc2626'),
  ('c2222222-2222-2222-2222-444444444444', '22222222-2222-2222-2222-222222222222', 'Custos Operacionais Gerais', 'EXPENSE', 'settings', '#64748b'),
  ('c2222222-2222-2222-2222-555555555555', '22222222-2222-2222-2222-222222222222', 'Pró-labore / Distribuição de Lucros', 'EXPENSE', 'corner-up-right', '#8b5cf6'),
  -- Novas Categorias PJ
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
