import React from 'react';
import { Activity, Bell, CheckCircle2, Clock, Loader2, Play, Power, Workflow, Zap } from 'lucide-react';
import { useSupabaseAutomations } from '../hooks/supabase';
import type { AutomationRuleKey } from '../types';
import { cn } from '../lib/utils';

const ruleMeta: Record<AutomationRuleKey, { icon: React.ElementType; tone: string; label: string }> = {
  proposal_accepted_create_project: {
    icon: Zap,
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    label: 'Propostas',
  },
  task_overdue_follow_up: {
    icon: Bell,
    tone: 'bg-amber-50 text-amber-700 border-amber-100',
    label: 'Projetos',
  },
  payment_received_mark_paid: {
    icon: CheckCircle2,
    tone: 'bg-blue-50 text-blue-700 border-blue-100',
    label: 'Financeiro',
  },
};

const statusLabel = {
  success: 'Executado',
  skipped: 'Ignorado',
  failed: 'Falhou',
};

export default function Automations() {
  const {
    error,
    lastOverdueScanCount,
    loading,
    rules,
    runOverdueScan,
    runningOverdueScan,
    runs,
    toggleRule,
    togglingRule,
  } = useSupabaseAutomations();
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const activeCount = rules.filter((rule) => rule.isActive).length;

  const handleToggle = async (ruleId: string, isActive: boolean) => {
    setFeedback(null);
    await toggleRule({ ruleId, isActive });
  };

  const handleRunOverdueScan = async () => {
    setFeedback(null);
    const processed = await runOverdueScan();
    setFeedback(`${processed} tarefa(s) atrasada(s) processada(s).`);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded bg-os-dark text-white flex items-center justify-center">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-os-text">Automations</h1>
              <p className="text-[11px] font-medium text-gray-500">
                Fluxos internos no-code para reduzir trabalho manual entre CRM, projetos, financeiro e comunicacao.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 min-w-[360px]">
          <div className="bg-white border border-gray-100 rounded p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400">Ativas</p>
            <p className="text-2xl font-bold text-os-text">{activeCount}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400">Regras</p>
            <p className="text-2xl font-bold text-os-text">{rules.length}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400">Execucoes</p>
            <p className="text-2xl font-bold text-os-text">{runs.length}</p>
          </div>
        </div>
      </div>

      {(error || feedback || lastOverdueScanCount !== undefined) && (
        <div
          className={cn(
            'rounded border px-4 py-3 text-[11px] font-bold',
            error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700',
          )}
        >
          {error instanceof Error ? error.message : feedback ?? `${lastOverdueScanCount} tarefa(s) processada(s).`}
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {rules.map((rule) => {
          const meta = ruleMeta[rule.ruleKey];
          const Icon = meta.icon;

          return (
            <article key={rule.id} className="bg-white border border-gray-100 rounded p-5 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-bold uppercase tracking-[0.16em]',
                      meta.tone,
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {meta.label}
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-os-text">{rule.name}</h2>
                    <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{rule.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={togglingRule}
                  onClick={() => void handleToggle(rule.id, !rule.isActive)}
                  className={cn(
                    'shrink-0 w-10 h-10 rounded flex items-center justify-center border transition-colors',
                    rule.isActive
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-gray-50 text-gray-400 border-gray-100',
                  )}
                  title={rule.isActive ? 'Desativar automacao' : 'Ativar automacao'}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400">Quando</p>
                <div className="rounded bg-gray-50 px-3 py-2 text-[11px] font-mono text-gray-600">{rule.triggerKey}</div>
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400">Acoes</p>
                <div className="space-y-2">
                  {rule.actions.map((action) => (
                    <div key={action.type} className="flex items-center gap-2 text-[11px] font-semibold text-os-text">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                      {action.label}
                    </div>
                  ))}
                </div>
              </div>

              {rule.ruleKey === 'task_overdue_follow_up' && (
                <button
                  type="button"
                  disabled={!rule.isActive || runningOverdueScan}
                  onClick={() => void handleRunOverdueScan()}
                  className="mt-auto w-full py-3 rounded bg-os-dark text-white text-[10px] font-bold uppercase tracking-[0.16em] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {runningOverdueScan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Varrer atrasos agora
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className="bg-white border border-gray-100 rounded">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-os-text">Execucoes recentes</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.16em]">Auditoria operacional</p>
          </div>
          <Activity className="w-5 h-5 text-gray-300" />
        </div>
        <div className="divide-y divide-gray-50">
          {runs.length > 0 ? (
            runs.map((run) => (
              <div key={run.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-os-text truncate">{run.ruleKey}</p>
                  <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-gray-400">
                    {run.eventSource} / {run.eventId}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.14em]',
                      run.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : run.status === 'skipped'
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-red-50 text-red-700',
                    )}
                  >
                    {statusLabel[run.status]}
                  </span>
                  <span className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(run.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-10 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-gray-300">
              Nenhuma execucao registrada.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
