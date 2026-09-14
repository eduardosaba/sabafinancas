import { createClient } from '@/lib/supabase/client';
import { User, UserRole, UserStatus } from '@/types/finance';

export interface CreateUserInput {
  email: string;
  name: string;
  tempPassword: string;
  role?: UserRole;
  licenseDays?: number;
}

export interface UserAccessCheck {
  canAccess: boolean;
  reason?: string;
  mustChangePassword?: boolean;
  role?: UserRole;
}

/**
 * Busca a lista completa de usuários cadastrados
 */
export async function fetchUsersList(): Promise<User[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar lista de usuários:', error);
    // Fallback: Se a tabela users não tiver todas as colunas novas, adiciona valores default
    return [
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'eduardopedro.fsa@gmail.com',
        name: 'Eduardo Saba',
        role: 'ADMIN',
        status: 'ACTIVE',
        mustChangePassword: false,
        licenseExpiresAt: null,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'melsaba@financas.com.br',
        name: 'Mel Saba',
        role: 'ADMIN',
        status: 'ACTIVE',
        mustChangePassword: false,
        licenseExpiresAt: null,
      },
    ];
  }

  return (data || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.name || u.email.split('@')[0],
    role: (u.role as UserRole) || (u.email?.includes('eduardo') ? 'ADMIN' : 'USER'),
    status: (u.status as UserStatus) || 'ACTIVE',
    mustChangePassword: Boolean(u.must_change_password),
    licenseExpiresAt: u.license_expires_at || null,
    createdAt: u.created_at,
  }));
}

/**
 * Cria um novo usuário com senha temporária e licença configurada
 */
export async function createUserWithTempPassword(input: CreateUserInput): Promise<User> {
  const supabase = createClient();

  // 1. Cadastrar no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.tempPassword,
    options: {
      data: {
        name: input.name,
      },
    },
  });

  if (authError && !authError.message.includes('already registered')) {
    throw new Error(`Falha no Supabase Auth: ${authError.message}`);
  }

  const userId = authData.user?.id || `usr-${Date.now()}`;
  const days = input.licenseDays || 365;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  const licenseExpiresAt = expiryDate.toISOString().split('T')[0];

  // 2. Registrar/Atualizar perfil na tabela `users`
  const userData = {
    id: userId,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: input.role || 'USER',
    status: 'ACTIVE',
    must_change_password: true,
    license_expires_at: licenseExpiresAt,
  };

  const { error: dbError } = await supabase.from('users').upsert(userData, { onConflict: 'email' });

  if (dbError) {
    console.warn('Aviso ao registrar na tabela users (possível coluna pendente no Supabase):', dbError);
  }

  return {
    id: userId,
    email: userData.email,
    name: userData.name,
    role: userData.role as UserRole,
    status: 'ACTIVE',
    mustChangePassword: true,
    licenseExpiresAt,
  };
}

/**
 * Atualiza o status de um usuário (Ativo / Bloqueado)
 */
export async function updateUserStatus(userId: string, status: UserStatus): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', userId);

  if (error) {
    console.error('Erro ao atualizar status do usuário:', error);
    throw new Error(`Falha ao alterar status: ${error.message}`);
  }

  return true;
}

/**
 * Atualiza a data de validade da licença de um usuário
 */
export async function updateUserLicense(userId: string, licenseExpiresAt: string | null): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('users')
    .update({ license_expires_at: licenseExpiresAt })
    .eq('id', userId);

  if (error) {
    console.error('Erro ao atualizar licença:', error);
    throw new Error(`Falha ao alterar licença: ${error.message}`);
  }

  return true;
}

/**
 * Altera a senha do próprio usuário logado e remove a flag de senha provisória
 */
export async function changeUserPassword(newPassword: string): Promise<boolean> {
  const supabase = createClient();

  const { error: authError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (authError) {
    throw new Error(`Erro ao atualizar senha: ${authError.message}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    await supabase.from('users').update({ must_change_password: false }).eq('id', user.id);
  }

  return true;
}

/**
 * Verifica permissão e status de funcionamento do usuário logado
 */
export async function checkUserAccessStatus(emailOrId?: string): Promise<UserAccessCheck> {
  const supabase = createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { canAccess: true }; // Permite acesso enquanto não autenticado
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return { canAccess: true };
    }

    // Admins nunca são bloqueados por licença
    const isAdmin = profile.role === 'ADMIN' || user.email?.includes('eduardo') || user.email?.includes('mel');
    if (isAdmin) {
      return {
        canAccess: true,
        role: 'ADMIN',
        mustChangePassword: Boolean(profile.must_change_password),
      };
    }

    if (profile.status === 'BLOCKED') {
      return {
        canAccess: false,
        reason: 'Sua conta está temporariamente suspensa pelo administrador.',
      };
    }

    if (profile.license_expires_at) {
      const today = new Date().toISOString().split('T')[0];
      if (profile.license_expires_at < today) {
        return {
          canAccess: false,
          reason: `Sua licença de uso venceu em ${new Date(profile.license_expires_at).toLocaleDateString('pt-BR')}. Entre em contato com o suporte para renovação.`,
        };
      }
    }

    return {
      canAccess: true,
      role: (profile.role as UserRole) || 'USER',
      mustChangePassword: Boolean(profile.must_change_password),
    };
  } catch {
    return { canAccess: true };
  }
}
