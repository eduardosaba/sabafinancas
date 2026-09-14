'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  KeyRound,
  Lock,
  Plus,
} from 'lucide-react';
import { useToast } from '@/contexts/toast-context';
import { User, UserRole, UserStatus } from '@/types/finance';
import {
  fetchUsersList,
  createUserWithTempPassword,
  updateUserStatus,
  updateUserLicense,
} from '@/lib/services/user-service';
import { cn } from '@/lib/utils';

export default function UsersManagementPage() {
  const { toast, confirm } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal para criar novo usuário
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newTempPassword, setNewTempPassword] = useState('123456');
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [licenseDays, setLicenseDays] = useState(365);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await fetchUsersList();
      setUsers(list);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      toast.error('Erro ao carregar a lista de usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleStatus = async (user: User) => {
    const nextStatus: UserStatus = user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    const actionText = nextStatus === 'BLOCKED' ? 'bloquear' : 'ativar';

    const confirmed = await confirm({
      title: `${nextStatus === 'BLOCKED' ? 'Bloquear' : 'Ativar'} Usuário`,
      message: `Tem certeza que deseja ${actionText} o acesso de "${user.name}" (${user.email})?`,
      confirmText: nextStatus === 'BLOCKED' ? 'Bloquear Acesso' : 'Ativar Acesso',
      variant: nextStatus === 'BLOCKED' ? 'danger' : 'primary',
    });

    if (!confirmed) return;

    try {
      await updateUserStatus(user.id, nextStatus);
      toast.success(`Usuário ${user.name} foi ${nextStatus === 'BLOCKED' ? 'bloqueado' : 'ativado'} com sucesso!`);
      loadUsers();
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      toast.error(`Falha ao alterar status: ${err?.message || ''}`);
    }
  };

  const handleExtendLicense = async (user: User, daysToAdd: number) => {
    const currentExp = user.licenseExpiresAt ? new Date(user.licenseExpiresAt) : new Date();
    const baseDate = currentExp > new Date() ? currentExp : new Date();
    baseDate.setDate(baseDate.getDate() + daysToAdd);
    const newExpiry = baseDate.toISOString().split('T')[0];

    const confirmed = await confirm({
      title: 'Renovar Licença de Uso',
      message: `Deseja prorrogar a licença de "${user.name}" por +${daysToAdd} dias (Nova validade: ${new Date(newExpiry).toLocaleDateString('pt-BR')})?`,
      confirmText: 'Renovar Licença',
      variant: 'primary',
    });

    if (!confirmed) return;

    try {
      await updateUserLicense(user.id, newExpiry);
      toast.success(`Licença de ${user.name} renovada até ${new Date(newExpiry).toLocaleDateString('pt-BR')}!`);
      loadUsers();
    } catch (err: any) {
      console.error('Erro ao renovar licença:', err);
      toast.error(`Falha ao renovar licença: ${err?.message || ''}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName || !newTempPassword) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setIsSaving(true);
      await createUserWithTempPassword({
        email: newEmail,
        name: newName,
        tempPassword: newTempPassword,
        role: newRole,
        licenseDays: Number(licenseDays),
      });

      toast.success(`Usuário "${newName}" cadastrado com sucesso! Senha provisória: ${newTempPassword}`);
      setIsModalOpen(false);
      setNewEmail('');
      setNewName('');
      setNewTempPassword('123456');
      loadUsers();
    } catch (err: any) {
      console.error('Erro ao criar usuário:', err);
      toast.error(`Falha ao cadastrar: ${err?.message || ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              Gestão de Usuários & Licenças
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Administração SaaS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre novos clientes com senha temporária, controle o status de ativação e vencimentos de licença.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex-shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          <span>+ Criar Usuário com Senha Provisória</span>
        </button>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <button
          type="button"
          onClick={loadUsers}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Atualizar lista"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <RefreshCw className="h-6 w-6 text-purple-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Carregando lista de usuários e licenças...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <Users className="h-8 w-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">Nenhum usuário encontrado com os filtros atuais.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Usuário / E-mail</th>
                  <th className="p-3.5">Função</th>
                  <th className="p-3.5">Status Acesso</th>
                  <th className="p-3.5">Validade da Licença</th>
                  <th className="p-3.5 text-right">Ações de Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredUsers.map((u) => {
                  const isBlocked = u.status === 'BLOCKED';
                  const isExpired =
                    u.licenseExpiresAt && new Date(u.licenseExpiresAt) < new Date();
                  const isAdmin = u.role === 'ADMIN';

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-100 flex items-center gap-2">
                          <span>{u.name}</span>
                          {u.mustChangePassword && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Senha Provisória
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase',
                            isAdmin
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          )}
                        >
                          {isAdmin ? 'Administrador' : 'Cliente / Usuário'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1.5',
                            isBlocked
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          )}
                        >
                          {isBlocked ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          <span>{isBlocked ? 'Bloqueado' : 'Ativo'}</span>
                        </span>
                      </td>

                      <td className="p-3.5">
                        {u.licenseExpiresAt ? (
                          <div className="space-y-0.5">
                            <span
                              className={cn(
                                'font-mono text-[11px] font-bold flex items-center gap-1',
                                isExpired ? 'text-rose-400' : 'text-slate-200'
                              )}
                            >
                              <Calendar className="h-3 w-3 text-slate-500" />
                              <span>{new Date(u.licenseExpiresAt).toLocaleDateString('pt-BR')}</span>
                            </span>
                            {isExpired && (
                              <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider block">
                                ⚠️ Licença Expirada
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Sem expiração (Ilimitado)</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Botão Renovar Licença (+365 dias) */}
                          <button
                            type="button"
                            onClick={() => handleExtendLicense(u, 365)}
                            title="Renovar Licença por +1 ano"
                            className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Clock className="h-3 w-3 text-purple-400" />
                            <span>+1 Ano</span>
                          </button>

                          {/* Botão Ativar / Bloquear */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors flex items-center gap-1',
                              isBlocked
                                ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/60'
                                : 'bg-rose-950/60 border-rose-800/60 text-rose-400 hover:bg-rose-900/60'
                            )}
                          >
                            {isBlocked ? 'Ativar' : 'Bloquear'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para Criar Novo Usuário com Senha Provisória */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-100">Novo Usuário Provisório</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Nome do Cliente / Usuário</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">E-mail de Acesso</label>
                <input
                  type="email"
                  required
                  placeholder="cliente@exemplo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Senha Temporária</label>
                <input
                  type="text"
                  required
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-400 font-mono font-bold focus:outline-none focus:border-purple-500"
                />
                <span className="text-[10px] text-slate-500">
                  O usuário precisará alterar esta senha no primeiro login.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Função no Sistema</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="USER">Cliente / Usuário</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Validade Licença</label>
                  <select
                    value={licenseDays}
                    onChange={(e) => setLicenseDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value={30}>30 Dias</option>
                    <option value={90}>90 Dias</option>
                    <option value={180}>6 Meses</option>
                    <option value={365}>1 Ano (365 dias)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
                >
                  {isSaving ? 'Cadastrando...' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
