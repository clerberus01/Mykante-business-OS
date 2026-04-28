import React, { useEffect, useState } from 'react';
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
  RefreshCw,
  Upload,
  Palette,
} from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { cn } from '@/src/lib/utils';
import { useSupabaseNotifications, useSupabasePrivacy, useSupabaseSettings } from '@/src/hooks/supabase';
import { defaultBranding, normalizeBranding } from '@/src/lib/branding';

type TestChannel = 'email' | 'push' | null;
type PrivacyAction = 'export' | 'deletion' | 'anonymization' | null;
type SettingsSection = 'profile' | 'branding' | 'notifications' | 'security' | 'database' | 'api';

async function sendTestNotification(accessToken: string, organizationId: string | null, channel: 'email' | 'push') {
  const endpoint = channel === 'email' ? '/api/notifications/email' : '/api/notifications/push';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(organizationId ? { 'X-Organization-Id': organizationId } : {}),
    },
    body: JSON.stringify({
      test: true,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    success?: boolean;
    accepted?: boolean;
    id?: string | null;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || 'Falha ao enviar notificação de teste.');
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
  const {
    user,
    signOut,
    session,
    organization,
    role,
    isAdmin,
    refreshAuth,
  } = useAuth();
  const { preferences, pushStatus, summary, loading, setChannelEnabled } = useSupabaseNotifications();
  const { requests, retentionPolicies, organizationPrivacy, createDataRequest, refreshPrivacy } = useSupabasePrivacy();
  const {
    mfaFactorCount,
    securityLoading,
    savingProfile,
    uploadingAvatar,
    saveProfile,
    uploadProfileAvatar,
    loadMfaStatus,
    requestPasswordReset,
    checkApiHealth,
  } = useSupabaseSettings();

  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [savingChannel, setSavingChannel] = useState<'email' | 'push' | 'whatsapp' | null>(null);
  const [testingChannel, setTestingChannel] = useState<TestChannel>(null);
  const [privacyAction, setPrivacyAction] = useState<PrivacyAction>(null);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [lgpdContactEmail, setLgpdContactEmail] = useState('');
  const [appName, setAppName] = useState(defaultBranding.appName);
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState(defaultBranding.primaryColor);
  const [darkColor, setDarkColor] = useState(defaultBranding.darkColor);
  const [backgroundColor, setBackgroundColor] = useState(defaultBranding.backgroundColor);
  const [textColor, setTextColor] = useState(defaultBranding.textColor);
  const [portalTitle, setPortalTitle] = useState(defaultBranding.portalTitle);
  const [portalSubtitle, setPortalSubtitle] = useState(defaultBranding.portalSubtitle);
  const [apiHealth, setApiHealth] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [apiHealthMessage, setApiHealthMessage] = useState('');

  const sections: { id: SettingsSection; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Meu Perfil', icon: User },
    { id: 'branding', label: 'Marca & Portal', icon: Palette },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'database', label: 'Banco de Dados', icon: Database },
    { id: 'api', label: 'Integrações API', icon: Code },
  ];

  useEffect(() => {
    setFullName(user?.displayName || '');
    setAvatarUrl(user?.avatarUrl || '');
  }, [user?.avatarUrl, user?.displayName]);

  useEffect(() => {
    setOrganizationName(organizationPrivacy?.name || organization?.name || '');
    setLgpdContactEmail(organizationPrivacy?.lgpdContactEmail || '');
  }, [organization?.name, organizationPrivacy?.lgpdContactEmail, organizationPrivacy?.name]);

  useEffect(() => {
    const branding = normalizeBranding(organization?.branding);
    setAppName(branding.appName);
    setLogoUrl(branding.logoUrl);
    setPrimaryColor(branding.primaryColor);
    setDarkColor(branding.darkColor);
    setBackgroundColor(branding.backgroundColor);
    setTextColor(branding.textColor);
    setPortalTitle(branding.portalTitle);
    setPortalSubtitle(branding.portalSubtitle);
  }, [organization?.branding]);

  useEffect(() => {
    if (activeSection === 'security') {
      void loadMfaStatus();
    }
  }, [activeSection, loadMfaStatus]);

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      await saveProfile({
        fullName,
        avatarUrl,
        organizationName,
        lgpdContactEmail,
        branding: {
          appName,
          logoUrl,
          primaryColor,
          darkColor,
          backgroundColor,
          textColor,
          portalTitle,
          portalSubtitle,
        },
      });
      if (organization?.id && isAdmin) {
        await refreshPrivacy();
      }
      window.alert('Configurações salvas.');
    } catch (error) {
      console.error('Settings save failed:', error);
      window.alert('Não foi possível salvar as configurações.');
    }
  };

  const handleDiscardProfile = () => {
    setFullName(user?.displayName || '');
    setAvatarUrl(user?.avatarUrl || '');
    setOrganizationName(organizationPrivacy?.name || organization?.name || '');
    setLgpdContactEmail(organizationPrivacy?.lgpdContactEmail || '');
    const branding = normalizeBranding(organization?.branding);
    setAppName(branding.appName);
    setLogoUrl(branding.logoUrl);
    setPrimaryColor(branding.primaryColor);
    setDarkColor(branding.darkColor);
    setBackgroundColor(branding.backgroundColor);
    setTextColor(branding.textColor);
    setPortalTitle(branding.portalTitle);
    setPortalSubtitle(branding.portalSubtitle);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      window.alert('Selecione uma imagem válida.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      window.alert('A imagem deve ter até 5 MB.');
      return;
    }

    try {
      const publicUrl = await uploadProfileAvatar(file);
      setAvatarUrl(publicUrl);
      await refreshAuth();
      window.alert('Foto de perfil atualizada.');
    } catch (error) {
      console.error('Avatar upload failed:', error);
      window.alert('Não foi possível enviar a foto de perfil.');
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      window.alert('Usuário sem e-mail válido.');
      return;
    }

    try {
      await requestPasswordReset();
      window.alert('E-mail de redefinição enviado.');
    } catch (error) {
      console.error('Password reset request failed:', error);
      window.alert('Não foi possível enviar o e-mail de redefinição.');
    }
  };

  const handleApiHealthCheck = async () => {
    setApiHealth('checking');
    setApiHealthMessage('');

    try {
      const result = await checkApiHealth();
      setApiHealth(result.status);
      setApiHealthMessage(result.message);
    } catch (error) {
      setApiHealth('error');
      setApiHealthMessage(error instanceof Error ? error.message : 'Falha ao consultar o Supabase.');
    }
  };

  const handleToggleChannel = async (channel: 'email' | 'push' | 'whatsapp') => {
    setSavingChannel(channel);

    try {
      await setChannelEnabled(channel, !preferences[channel].enabled);
    } catch (error) {
      console.error('Notification channel update failed:', error);
      window.alert(
        channel === 'push'
          ? 'Não foi possível atualizar as permissões de push.'
          : 'Não foi possível atualizar a preferência de notificação.',
      );
    } finally {
      setSavingChannel(null);
    }
  };

  const handleSendTest = async (channel: 'email' | 'push') => {
    if (!session?.access_token) {
      window.alert('Sessão inválida para envio de teste.');
      return;
    }

    setTestingChannel(channel);

    try {
      const result = await sendTestNotification(session.access_token, organization?.id ?? null, channel);
      if (channel === 'email') {
        window.alert(
          result.message ||
            'O envio foi aceito pelo provedor. Verifique caixa de entrada, spam e o painel da Resend.',
        );
      } else {
        window.alert('Push de teste enviado.');
      }
    } catch (error) {
      console.error('Notification test failed:', error);
      window.alert(channel === 'email' ? 'Falha ao enviar e-mail de teste.' : 'Falha ao enviar push de teste.');
    } finally {
      setTestingChannel(null);
    }
  };

  const handlePrivacyExport = async () => {
    if (!session?.access_token) {
      window.alert('Sessão inválida para exportação.');
      return;
    }

    setPrivacyAction('export');

    try {
      const response = await fetch('/api/privacy/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          ...(organization?.id ? { 'X-Organization-Id': organization.id } : {}),
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
      window.alert('Não foi possível exportar os dados pessoais.');
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
          ? 'Solicitação de eliminação dos dados pessoais tratados com base em consentimento.'
          : 'Solicitação de anonimização de dados pessoais desnecessários ou excessivos.',
      );
      window.alert('Solicitação registrada no Centro de Privacidade.');
    } catch (error) {
      console.error('Privacy request failed:', error);
      window.alert('Não foi possível registrar a solicitação LGPD.');
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
        <h2 className="text-2xl font-bold text-os-text tracking-tight">Configurações do OS</h2>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-bold uppercase tracking-wider transition-all',
                activeSection === section.id ? 'bg-os-dark text-white' : 'text-gray-400 hover:bg-white hover:text-os-text',
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
              Finalizar Sessão
            </button>
          </div>
        </nav>

        <div className="lg:col-span-3 space-y-8">
          {activeSection === 'profile' && (
            <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Perfil do Operador
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-os-dark flex items-center justify-center text-white text-3xl font-black shadow-lg overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      (fullName || user?.email || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-os-text leading-tight">{fullName || 'Operador'}</h4>
                    <p className="text-xs font-mono text-gray-400 mb-2">{user?.email}</p>
                    <label className="inline-flex items-center gap-2 mb-2 px-3 py-1.5 bg-gray-100 text-[9px] font-bold uppercase tracking-widest text-gray-500 rounded hover:bg-gray-200 transition-all cursor-pointer">
                      {uploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Enviar Foto
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={uploadingAvatar}
                        onChange={(uploadEvent) => void handleAvatarUpload(uploadEvent)}
                      />
                    </label>
                    <p className="text-[10px] font-bold uppercase text-brand">{role ? `Papel: ${role}` : 'Papel não identificado'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Nome de Exibição</label>
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">URL do Avatar</label>
                    <input
                      value={avatarUrl}
                      onChange={(event) => setAvatarUrl(event.target.value)}
                      placeholder="https://..."
                      className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Organização</label>
                    <input
                      value={organizationName}
                      onChange={(event) => setOrganizationName(event.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">E-mail LGPD</label>
                    <input
                      value={lgpdContactEmail}
                      onChange={(event) => setLgpdContactEmail(event.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'branding' && (
            <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Personalização da Empresa
              </div>
              <div className="p-6 space-y-6">
                {!isAdmin && (
                  <div className="p-3 rounded bg-amber-50 border border-amber-100 text-[10px] font-bold text-amber-700 uppercase tracking-widest">
                    Apenas administradores podem alterar a identidade da organização.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Nome no Sistema</label>
                    <input
                      value={appName}
                      onChange={(event) => setAppName(event.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">URL do Logo</label>
                    <input
                      value={logoUrl}
                      onChange={(event) => setLogoUrl(event.target.value)}
                      disabled={!isAdmin}
                      placeholder="https://..."
                      className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    ['Cor Principal', primaryColor, setPrimaryColor],
                    ['Cor Escura', darkColor, setDarkColor],
                    ['Fundo', backgroundColor, setBackgroundColor],
                    ['Texto', textColor, setTextColor],
                  ].map(([label, value, setter]) => (
                    <label key={label as string} className="space-y-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{label as string}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={value as string}
                          disabled={!isAdmin}
                          onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)}
                          className="w-10 h-9 rounded border border-gray-100 bg-white disabled:opacity-60"
                        />
                        <input
                          value={value as string}
                          disabled={!isAdmin}
                          onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)}
                          className="min-w-0 flex-1 bg-gray-50 border border-gray-100 rounded px-2 py-2 text-[10px] font-mono uppercase focus:ring-1 focus:ring-brand outline-none transition-all disabled:opacity-60"
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Título do Portal do Cliente</label>
                    <input
                      value={portalTitle}
                      onChange={(event) => setPortalTitle(event.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Subtítulo do Portal</label>
                    <input
                      value={portalSubtitle}
                      onChange={(event) => setPortalSubtitle(event.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all disabled:opacity-60"
                    />
                  </div>
                </div>

                <div
                  className="p-4 rounded border border-gray-100 flex items-center gap-3"
                  style={{
                    backgroundColor,
                    color: textColor,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center text-white font-black overflow-hidden"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : appName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em]">{appName || defaultBranding.appName}</p>
                    <p className="text-[10px] opacity-70">{portalTitle || defaultBranding.portalTitle}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'notifications' && (
            <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Notificações & Canais
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
                        Usa consentimento explícito e sincroniza a inscrição por usuário/autenticação.
                      </p>
                      <p className="text-[9px] font-mono text-gray-300 mt-1">
                        PUSH_ID: {summary.pushSubscriptionId || 'N/A'} • STATUS: {summary.pushProviderStatus.toUpperCase()}
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
                      <p className="text-[10px] text-gray-400">Preferência armazenada para automações futuras e trilhas de consentimento.</p>
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
                    Permissão do navegador: <strong>{pushStatus.permission ? 'LIBERADA' : 'NÃO LIBERADA'}</strong>
                    {' '}• OneSignal User: <strong>{pushStatus.onesignalId || 'N/A'}</strong>
                    {' '}• Opt-in: <strong>{pushStatus.optedIn ? 'ATIVO' : 'INATIVO'}</strong>
                  </p>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'security' && (
            <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Status da Conta
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 rounded bg-green-50 border border-green-100">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-xs font-bold text-green-700">Sessão Supabase Ativa</p>
                      <p className="text-[10px] text-green-600 opacity-80">
                        {session?.user.email_confirmed_at ? 'E-mail confirmado.' : 'E-mail ainda sem confirmação registrada.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div>
                    <p className="text-xs font-bold text-os-text">Autenticação de Dois Fatores</p>
                    <p className="text-[10px] text-gray-400">
                      {mfaFactorCount === null
                        ? 'Status indisponível para esta sessão.'
                        : `${mfaFactorCount} fator(es) verificado(s) na conta.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadMfaStatus()}
                    disabled={securityLoading}
                    className="px-3 py-1.5 bg-gray-100 text-[9px] font-bold uppercase tracking-widest text-gray-500 rounded hover:bg-gray-200 transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    {securityLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Atualizar
                  </button>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-xs font-bold text-os-text">Redefinição de Senha</p>
                    <p className="text-[10px] text-gray-400">Envia um link seguro para o e-mail autenticado.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePasswordReset()}
                    disabled={securityLoading}
                    className="px-3 py-1.5 bg-os-dark text-white text-[9px] font-bold uppercase tracking-widest rounded hover:bg-brand transition-all disabled:opacity-40"
                  >
                    Enviar Link
                  </button>
                </div>

              </div>
            </section>
          )}

          {activeSection === 'database' && (
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
                    <p className="text-[10px] text-gray-400 leading-relaxed">Gera uma exportação eletrônica dos dados vinculados ao usuário autenticado.</p>
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
                    <p className="text-[10px] font-black uppercase tracking-widest text-os-text mb-1">Solicitar Anonimização</p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">Registra pedido formal de anonimização de dados excessivos ou desnecessários.</p>
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
                    <p className="text-[10px] font-black uppercase tracking-widest text-os-text mb-1">Solicitar Eliminação</p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">Abre pedido para eliminação dos dados tratados com base em consentimento, quando aplicável.</p>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Contato LGPD</p>
                    <p className="text-xs font-bold text-os-text">
                      {organizationPrivacy?.lgpdContactEmail || 'Não configurado'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Organização: {organizationPrivacy?.name || 'Não identificado'}
                    </p>
                  </div>

                  <div className="p-4 rounded bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Solicitações Recentes</p>
                    <div className="space-y-2">
                      {requests.slice(0, 3).map((request) => (
                        <div key={request.id} className="flex items-center justify-between text-[10px]">
                          <span className="font-bold uppercase text-os-text">{request.requestType}</span>
                          <span className="font-mono text-gray-400">{request.status}</span>
                        </div>
                      ))}
                      {requests.length === 0 && (
                        <p className="text-[10px] text-gray-400">Nenhuma solicitação registrada pelo usuário.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Política de Retenção Aplicada</p>
                  <div className="space-y-2">
                    {retentionPolicies.map((policy) => (
                      <div key={policy.id} className="flex items-center justify-between gap-4 text-[10px]">
                        <span className="font-bold uppercase text-os-text">{policy.tableName}</span>
                        <span className="font-mono text-gray-400">
                          {policy.retentionDays} dias • base: {policy.legalBasis}
                        </span>
                      </div>
                    ))}
                    {retentionPolicies.length === 0 && (
                      <p className="text-[10px] text-gray-400">Nenhuma política de retenção cadastrada.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'api' && (
            <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Integrações API
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 rounded bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-xs font-bold text-os-text">Health Check dos Serviços</p>
                    <p className="text-[10px] text-gray-400">
                      {apiHealth === 'idle' ? 'Ainda não verificado nesta sessão.' : apiHealthMessage}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleApiHealthCheck()}
                    disabled={apiHealth === 'checking'}
                    className="px-3 py-1.5 bg-os-dark text-white text-[9px] font-bold uppercase tracking-widest rounded hover:bg-brand transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    {apiHealth === 'checking' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Verificar
                  </button>
                </div>

                <div className={cn(
                  'p-4 rounded border flex items-center gap-3',
                  apiHealth === 'ok' ? 'bg-green-50 border-green-100' : apiHealth === 'error' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100',
                )}>
                  <CheckCircle2 className={cn('w-4 h-4', apiHealth === 'error' ? 'text-red-500' : 'text-green-500')} />
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    O navegador usa somente credenciais públicas necessárias para a sessão. Chaves server-side permanecem nas funções API e no ambiente da Vercel.
                  </p>
                </div>
              </div>
            </section>
          )}

          {(activeSection === 'profile' || activeSection === 'branding') && (
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleDiscardProfile}
                className="px-6 py-2 bg-gray-100 text-gray-500 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-gray-200 transition-all"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={savingProfile}
                className="px-6 py-2 bg-brand text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-os-dark transition-all shadow-sm shadow-brand/20 disabled:opacity-60"
              >
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Alterações
              </button>
            </div>
          )}

          <div className="p-6 rounded border border-amber-100 bg-amber-50/30 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800">Zona de Deploy Crítico</p>
              <p className="text-[10px] text-amber-700 leading-relaxed opacity-80">
                Resend e OneSignal dependem de chaves server-side e origens configuradas corretamente na Vercel e nos respectivos painéis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
