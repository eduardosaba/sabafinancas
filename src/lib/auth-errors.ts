export function translateAuthError(message?: string): string {
  if (!message) return 'Usuário ou senha incorretos. Por favor, tente novamente.';
  const msg = message.toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return 'Usuário ou senha incorretos. Por favor, verifique seus dados.';
  }
  if (msg.includes('email not confirmed')) {
    return 'E-mail ainda não verificado. Por favor, confira sua caixa de entrada.';
  }
  if (msg.includes('user not found')) {
    return 'Usuário não encontrado. Cadastre-se para acessar.';
  }
  if (msg.includes('invalid password')) {
    return 'Senha incorreta.';
  }
  if (msg.includes('password should be at least')) {
    return 'A senha deve ter no mínimo 6 caracteres.';
  }
  if (msg.includes('user already registered') || msg.includes('already registered')) {
    return 'Este usuário/e-mail já está cadastrado no sistema.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Muitas tentativas em pouco tempo. Por favor, aguarde alguns segundos e tente novamente.';
  }
  return 'Falha ao autenticar. Por favor, verifique seu usuário e senha.';
}
