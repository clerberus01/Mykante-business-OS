import React from 'react';
import {
  Activity,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Shield,
  ShieldOff,
  Users,
  Webhook,
} from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { cn } from '@/src/lib/utils';
import { usePlatformAdminConsole } from '../hooks/usePlatformAdmin';

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{label}</span>
        <Icon className="w-4 h-4 text-brand" />
      </div>
      <p className="text-2xl font-black text-os-text tracking-tight">{value.toLocaleString('pt-BR')}</p>
    </div>
  );
}

export default function PlatformAdmin() {
  const { isPlatformAdmin, organization, role } = useAuth();
  const { console: platformConsole, loading, error, refresh, revokeMyPlatformAccess } = usePlatformAdminConsole();
  const [revoking, setRevoking] = React.useState(false);

  const handleRevoke = async () => {
    if (!window.confirm('Revogar seu acesso de admin da plataforma? Sua conta continuará apenas com o papel da empresa atual.')) {
      return;
    }

    setRevoking(true);
    try {
      await revokeMyPlatformAccess();
    } catch (revokeError) {
      console.error('Platform admin revoke failed:', revokeError);
      window.alert(
        revokeError instanceof Error
          ? revokeError.message
          : 'Não foi possível revogar o acesso de plataforma.',
      );
    } finally {
      setRevoking(false);
    }
  };

  if (!isPlatformAdmin) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="max-w-lg bg-white border border-gray-100 rounded shadow-sm p-8 text-center">
          <ShieldOff className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <p className="text-sm font-black uppercase tracking-[0.2em] text-os-text mb-2">Acesso Restrito</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Seu perfil está limitado à organização {organization?.name || 'atual'} como {role || 'membro'}.
            O painel de plataforma exige uma credencial separada de admin do sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">
              Platform
            </span>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Escopo: sistema</span>
          </div>
          <h2 className="text-2xl font-bold text-os-text tracking-tight">Painel ADM da Plataforma</h2>
          <p className="text-xs text-gray-400 mt-1">
            Controles gerais do SaaS separados do papel administrativo da sua empresa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="px-3 py-2 rounded bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-os-text transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => void handleRevoke()}
            disabled={revoking}
            className="px-3 py-2 rounded bg-red-50 border border-red-100 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
            Revogar meu acesso
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded p-4 text-xs font-bold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard label="Organizações" value={platformConsole.metrics.organizations} icon={Building2} />
        <MetricCard label="Membros ativos" value={platformConsole.metrics.activeMembers} icon={Users} />
        <MetricCard label="Perfis" value={platformConsole.metrics.profiles} icon={Users} />
        <MetricCard label="Admins sistema" value={platformConsole.metrics.platformAdmins} icon={Shield} />
        <MetricCard label="Eventos 24h" value={platformConsole.metrics.events24h} icon={Activity} />
        <MetricCard label="Webhooks pendentes" value={platformConsole.metrics.pendingWebhooks} icon={Webhook} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Organizações recentes
          </div>
          <div className="divide-y divide-gray-50">
            {platformConsole.organizations.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black text-os-text truncate">{item.name || 'Organização sem nome'}</p>
                  <p className="text-[10px] font-mono text-gray-400 truncate">{item.slug || item.id}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-black text-os-text">{item.activeMemberCount}/{item.memberCount}</p>
                  <p className="text-[9px] uppercase tracking-widest text-gray-300">membros</p>
                </div>
              </div>
            ))}
            {platformConsole.organizations.length === 0 && (
              <div className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
                Nenhuma organização encontrada.
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Admins da plataforma
          </div>
          <div className="divide-y divide-gray-50">
            {platformConsole.platformAdmins.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black text-os-text truncate">{item.fullName || item.email || item.userId}</p>
                  <p className="text-[10px] font-mono text-gray-400 truncate">{item.email || item.userId}</p>
                </div>
                <span
                  className={cn(
                    'px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest',
                    item.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400',
                  )}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Eventos recentes
          </div>
          <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
            {platformConsole.recentEvents.map((item) => (
              <div key={item.id} className="p-4">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <p className="text-[11px] font-black text-os-text truncate">{item.eventType}</p>
                  <span className="text-[9px] font-mono text-gray-300 shrink-0">
                    {new Date(item.occurredAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-gray-400 truncate">
                  {item.sourceTable} / {item.sourceOperation} / {item.aggregateId || 'sem aggregate'}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Entregas de Webhook
          </div>
          <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
            {platformConsole.webhookDeliveries.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-os-text truncate">{item.eventId}</p>
                  <p className="text-[10px] font-mono text-gray-400 truncate">
                    Tentativas: {item.attempts} / HTTP {item.responseStatus ?? 'N/A'}
                  </p>
                </div>
                <span
                  className={cn(
                    'px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1',
                    item.status === 'delivered'
                      ? 'bg-green-50 text-green-700'
                      : item.status === 'failed'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-600',
                  )}
                >
                  {item.status === 'delivered' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {item.status}
                </span>
              </div>
            ))}
            {platformConsole.webhookDeliveries.length === 0 && (
              <div className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
                Nenhuma entrega registrada.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
