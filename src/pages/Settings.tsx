import React, { useState } from 'react';
import {
  User,
  Bell,
  Shield,
  Database,
  Code,
  LogOut,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Mail,
  Smartphone,
  MessageSquare,
  Send,
  Download,
  FileSearch,
  Eraser,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { useSupabaseNotifications, useSupabasePrivacy } from '../hooks/supabase';

type TestChannel = 'email' | 'push' | null;
type PrivacyAction = 'export' | 'deletion' | 'anonymization' | null;

async function sendTestNotification(accessToken: string, channel: 'email' | 'push') {
  const endpoint = channel === 'email' ? '/api/notifications/email' : '/api/notifications/push';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      test: true,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string; success?: boolean };

  if (!response.ok) {
    throw new Error(payload.error || 'Falha ao enviar notificacao de teste.');
  }

  return payload;
}

function Toggle({
  checked,
  disabled,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-10 h-5 rounded-full relative transition-all duration-300 disabled:opacity-50',
        checked ? 'bg-brand' : 'bg-gray-200',
      )}
    >
      <div
        className={cn(
          'w-3 h-3 bg-white rounded-full absolute top-1 transition-all duration-300 shadow-sm',
          checked ? 'left-6' : 'left-1',
        )}
      />
    </button>
  );
}

export default function Settings() {
  const { user, signOut, session } = useAuth();
  const { preferences, pushStatus, summary, loading, setChannelEnabled } = useSupabaseNotifications();
  const { requests, retentionPolicies, organizationPrivacy, createDataRequest } = useSupabasePrivacy();
  const [savingChannel, setSavingChannel] = useState<'email' | 'push' | 'whatsapp' | null>(null);
  const [testingChannel, setTestingChannel] = useState<TestChannel>(null);
  const [privacyAction, setPrivacyAction] = useState<PrivacyAction>(null);

  const sections = [
    { id: 'profile', label: 'Meu Perfil', icon: User },
    { id: 'notifications', label: 'NotificaÃ§Ãµes', icon: Bell },
    { id: 'security', label: 'SeguranÃ§a', icon: Shield },
    { id: 'database', label: 'Banco de Dados', icon: Database },
    { id: 'api', label: 'API Integrations', icon: Code },
  ];

  const handleToggleChannel = async (channel: 'email' | 'push' | 'whatsapp') => {
    setSavingChannel(channel);

    try {
      await setChannelEnabled(channel, !preferences[channel].enabled);
    } catch (error) {
      console.error('Notification channel update failed:', error);
      window.alert(
        channel === 'push'
          ? 'Nao foi possivel atualizar as permissoes de push.'
          : 'Nao foi possivel atualizar a preferencia de notificacao.',
      );
    } finally {
      setSavingChannel(null);
    }
  };

  const handleSendTest = async (channel: 'email' | 'push') => {
    if (!session?.access_token) {
      window.alert('Sessao invalida para envio de teste.');
      return;
    }

    setTestingChannel(channel);

    try {
      await sendTestNotification(session.access_token, channel);
      window.alert(channel === 'email' ? 'E-mail de teste enviado.' : 'Push de teste enviado.');
    } catch (error) {
      console.error('Notification test failed:', error);
      window.alert(channel === 'email' ? 'Falha ao enviar e-mail de teste.' : 'Falha ao enviar push de teste.');
    } finally {
      setTestingChannel(null);
    }
  };

  const handlePrivacyExport = async () => {
    if (!session?.access_token) {
      window.alert('Sessao invalida para exportacao.');
      return;
    }

    setPrivacyAction('export');

    try {
      const response = await fetch('/api/privacy/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = (await response.json()) as { error?: string; data?: unknown };

      if (!response.ok) {
        throw new Error(payload.error || 'Falha ao exportar dados.');
      }

      const blob = new Blob([JSON.stringify(payload.data, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lgpd-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Privacy export failed:', error);
      window.alert('Nao foi possivel exportar os dados pessoais.');
    } finally {
      setPrivacyAction(null);
    }
  };

  const handlePrivacyRequest = async (requestType: 'deletion' | 'anonymization') => {
    setPrivacyAction(requestType);

    try {
      await createDataRequest(
        requestType,
        requestType === 'deletion'
          ? 'Solicitacao de eliminacao dos dados pessoais tratados com base em consentimento.'
          : 'Solicitacao de anonimização de dados pessoais desnecessarios ou excessivos.',
      );
      window.alert('Solicitacao registrada no Centro de Privacidade.');
    } catch (error) {
      console.error('Privacy request failed:', error);
      window.alert('Nao foi possivel registrar a solicitacao LGPD.');
    } finally {
      setPrivacyAction(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">
            Control Center
          </span>
          <span className="text-[10px] font-mono text-gray-400">CONFIG_SYMMETRIC: ACTIVE</span>
        </div>
        <h2 className="text-2xl font-bold text-os-text tracking-tight">ConfiguraÃ§Ãµes do OS</h2>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-bold uppercase tracking-wider transition-all',
                section.id === 'profile' ? 'bg-os-dark text-white' : 'text-gray-400 hover:bg-white hover:text-os-text',
              )}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
          <div className="pt-8">
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
            >
              <LogOut className="w-4 h-4" />
              Finalizar SessÃ£o
            </button>
          </div>
        </nav>

        <div className="lg:col-span-3 space-y-8">
          <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Perfil do Operador
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-os-dark flex items-center justify-center text-white text-3xl font-black shadow-lg">
                  {user?.displayName?.charAt(0) || 'U'}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-os-text leading-tight">{user?.displayName || 'Admin Operator'}</h4>
                  <p className="text-xs font-mono text-gray-400 mb-2">{user?.email}</p>
                  <button type="button" className="text-[10px] font-bold uppercase text-brand hover:underline">
                    Trocar foto de perfil
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Nome de ExibiÃ§Ã£o</label>
                  <input
                    defaultValue={user?.displayName || ''}
                    className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Cargo / FunÃ§Ã£o</label>
                  <input
                    defaultValue="Business Manager"
                    className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              NotificaÃ§Ãµes & Canais
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-brand mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-os-text">E-mail transacional (Resend)</p>
                    <p className="text-[10px] text-gray-400">Ativa alertas e mensagens operacionais enviadas pelo backend.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSendTest('email')}
                    disabled={testingChannel === 'email' || !preferences.email.enabled}
                    className="px-3 py-1.5 bg-gray-100 text-[9px] font-bold uppercase tracking-widest text-gray-500 rounded hover:bg-gray-200 transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    {testingChannel === 'email' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Teste
                  </button>
                  <Toggle
                    checked={preferences.email.enabled}
                    disabled={savingChannel === 'email' || loading}
                    onClick={() => void handleToggleChannel('email')}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-4 h-4 text-brand mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-os-text">Push no navegador (OneSignal)</p>
                    <p className="text-[10px] text-gray-400">
                      Usa consentimento explÃ­cito e sincroniza a inscriÃ§Ã£o por usuÃ¡rio/autenticaÃ§Ã£o.
                    </p>
                    <p className="text-[9px] font-mono text-gray-300 mt-1">
                      PUSH_ID: {summary.pushSubscriptionId || 'N/A'} â€¢ STATUS: {summary.pushProviderStatus.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSendTest('push')}
                    disabled={testingChannel === 'push' || !preferences.push.enabled}
                    className="px-3 py-1.5 bg-gray-100 text-[9px] font-bold uppercase tracking-widest text-gray-500 rounded hover:bg-gray-200 transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    {testingChannel === 'push' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Teste
                  </button>
                  <Toggle
                    checked={preferences.push.enabled}
                    disabled={savingChannel === 'push' || loading}
                    onClick={() => void handleToggleChannel('push')}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 text-brand mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-os-text">Canal WhatsApp</p>
                    <p className="text-[10px] text-gray-400">PreferÃªncia armazenada para automaÃ§Ãµes futuras e trilhas de consentimento.</p>
                  </div>
                </div>
                <Toggle
                  checked={preferences.whatsapp.enabled}
                  disabled={savingChannel === 'whatsapp' || loading}
                  onClick={() => void handleToggleChannel('whatsapp')}
                />
              </div>

              <div className="p-4 rounded bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-os-text">Estado do Push</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  PermissÃ£o do navegador: <strong>{pushStatus.permission ? 'LIBERADA' : 'NAO LIBERADA'}</strong>
                  {' '}â€¢ OneSignal User: <strong>{pushStatus.onesignalId || 'N/A'}</strong>
                  {' '}â€¢ Opt-in: <strong>{pushStatus.optedIn ? 'ATIVO' : 'INATIVO'}</strong>
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Status da Conta
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded bg-green-50 border border-green-100">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-xs font-bold text-green-700">VerificaÃ§Ã£o de Identidade ConcluÃ­da</p>
                    <p className="text-[10px] text-green-600 opacity-80">NÃ­vel de acesso mÃ¡ximo permitido pelo Mykante OS.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-xs font-bold text-os-text">AutenticaÃ§Ã£o de Dois Fatores</p>
                  <p className="text-[10px] text-gray-400">ProteÃ§Ã£o adicional para acessos crÃ­ticos.</p>
                </div>
                <Toggle checked={false} onClick={() => undefined} />
              </div>
            </div>
          </section>

          <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Centro de Privacidade LGPD
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => void handlePrivacyExport()}
                  disabled={privacyAction !== null}
                  className="p-4 rounded border border-gray-100 bg-gray-50/50 text-left hover:border-brand transition-all disabled:opacity-50"
                >
                  <Download className="w-5 h-5 text-brand mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-os-text mb-1">Exportar Meus Dados</p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">Gera uma exportacao eletronica dos dados vinculados ao usuario autenticado.</p>
                </button>

                <button
                  type="button"
                  onClick={() => void handlePrivacyRequest('anonymization')}
                  disabled={privacyAction !== null}
                  className="p-4 rounded border border-gray-100 bg-gray-50/50 text-left hover:border-brand transition-all disabled:opacity-50"
                >
                  {privacyAction === 'anonymization' ? (
                    <Loader2 className="w-5 h-5 text-brand mb-3 animate-spin" />
                  ) : (
                    <FileSearch className="w-5 h-5 text-brand mb-3" />
                  )}
                  <p className="text-[10px] font-black uppercase tracking-widest text-os-text mb-1">Solicitar Anonimizacao</p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">Registra pedido formal de anonimização de dados excessivos ou desnecessarios.</p>
                </button>

                <button
                  type="button"
                  onClick={() => void handlePrivacyRequest('deletion')}
                  disabled={privacyAction !== null}
                  className="p-4 rounded border border-gray-100 bg-gray-50/50 text-left hover:border-brand transition-all disabled:opacity-50"
                >
                  {privacyAction === 'deletion' ? (
                    <Loader2 className="w-5 h-5 text-brand mb-3 animate-spin" />
                  ) : (
                    <Eraser className="w-5 h-5 text-brand mb-3" />
                  )}
                  <p className="text-[10px] font-black uppercase tracking-widest text-os-text mb-1">Solicitar Eliminacao</p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">Abre pedido para eliminacao dos dados tratados com base em consentimento, quando aplicavel.</p>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Contato LGPD</p>
                  <p className="text-xs font-bold text-os-text">
                    {organizationPrivacy?.lgpdContactEmail || 'Nao configurado'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-2">
                    Organizacao: {organizationPrivacy?.name || 'Nao identificado'}
                  </p>
                </div>

                <div className="p-4 rounded bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Solicitacoes Recentes</p>
                  <div className="space-y-2">
                    {requests.slice(0, 3).map((request) => (
                      <div key={request.id} className="flex items-center justify-between text-[10px]">
                        <span className="font-bold uppercase text-os-text">{request.requestType}</span>
                        <span className="font-mono text-gray-400">{request.status}</span>
                      </div>
                    ))}
                    {requests.length === 0 && (
                      <p className="text-[10px] text-gray-400">Nenhuma solicitacao registrada pelo usuario.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded bg-gray-50 border border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Politica de Retencao Aplicada</p>
                <div className="space-y-2">
                  {retentionPolicies.map((policy) => (
                    <div key={policy.id} className="flex items-center justify-between gap-4 text-[10px]">
                      <span className="font-bold uppercase text-os-text">{policy.tableName}</span>
                      <span className="font-mono text-gray-400">
                        {policy.retentionDays} dias â€¢ base: {policy.legalBasis}
                      </span>
                    </div>
                  ))}
                  {retentionPolicies.length === 0 && (
                    <p className="text-[10px] text-gray-400">Nenhuma politica de retencao cadastrada.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="px-6 py-2 bg-gray-100 text-gray-500 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-gray-200 transition-all"
            >
              Descartar
            </button>
            <button
              type="button"
              className="px-6 py-2 bg-brand text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-os-dark transition-all shadow-sm shadow-brand/20"
            >
              <Save className="w-4 h-4" />
              Salvar AlteraÃ§Ãµes
            </button>
          </div>

          <div className="p-6 rounded border border-amber-100 bg-amber-50/30 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800">Zona de Deploy CrÃ­tico</p>
              <p className="text-[10px] text-amber-700 leading-relaxed opacity-80">
                Resend e OneSignal dependem de chaves server-side e origens configuradas corretamente na Vercel e nos respectivos painÃ©is.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
