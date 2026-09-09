-- 1. Sincronizar todos os usuários existentes em auth.users para public.users tratando conflito por EMAIL
INSERT INTO public.users (id, email, name)
SELECT 
  id, 
  email, 
  COALESCE(
    raw_user_meta_data->>'name', 
    raw_user_meta_data->>'full_name', 
    CASE 
      WHEN email LIKE '%eduardo%' THEN 'Eduardo Saba'
      WHEN email LIKE '%melsaba%' THEN 'Mel Saba'
      ELSE split_part(email, '@', 1)
    END
  )
FROM auth.users
ON CONFLICT (email) DO UPDATE
SET id = EXCLUDED.id,
    name = COALESCE(EXCLUDED.name, public.users.name);

-- 2. Criar função de Trigger no PostgreSQL do Supabase para sincronizar automaticamente novos usuários criados no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name text;
BEGIN
  IF NEW.email LIKE '%eduardo%' THEN
    user_name := 'Eduardo Saba';
  ELSIF NEW.email LIKE '%melsaba%' THEN
    user_name := 'Mel Saba';
  ELSE
    user_name := COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email, '@', 1)
    );
  END IF;

  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, user_name)
  ON CONFLICT (email) DO UPDATE
  SET id = EXCLUDED.id,
      name = EXCLUDED.name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ativar Trigger na tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
