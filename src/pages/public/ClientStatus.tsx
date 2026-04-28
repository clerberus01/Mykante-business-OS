import React, { useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { CheckCircle2, Clock, FileText, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { getBrandingStyle, normalizeBranding, type OrganizationBranding } from '../../lib/branding';

type PublicClientStatus = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  organization?: {
    name: string | null;
    defaultLocale: string;
    defaultCurrency: string;
    branding: OrganizationBranding;
  };
  proposals: Array<{
    id: string;
    title: string;
    status: 'draft' | 'sent' | 'accepted' | 'rejected';
    value: number;
    description: string | null;
    validUntil: string;
    updatedAt: string;
  }>;
  pipeline: Array<{
    id: string;
    title: string;
    status: 'open' | 'won' | 'lost';
    value: number;
    probability: number;
    updatedAt: string;
    stageName: string | null;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
    deadline: string;
    updatedAt: string;
  }>;
  invoices: Array<{
    id: string;
    description: string;
    amount: number;
    status: string;
    dueDate: string;
    paymentUrl: string | null;
  }>;
  documents: Array<{
    id: string;
    name: string;
    signatureStatus: string;
    signatureUrl: string | null;
    updatedAt: string;
  }>;
  contracts: Array<{
    id: string;
    title: string;
    status: string;
    amount: number;
    currency: string;
    startsAt: string;
    endsAt: string | null;
    autoRenew: boolean;
    nextRenewalAt: string | null;
  }>;
};

const proposalStatusLabel = {
  draft: 'Em preparacao',
  sent: 'Enviada para analise',
  accepted: 'Aprovada',
  rejected: 'Encerrada',
};

export default function ClientStatus() {
  const { token } = useParams({ from: '/status/$token' });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [client, setClient] = useState<PublicClientStatus | null>(null);

  const latestPipeline = client?.pipeline[0];
  const branding = normalizeBranding(client?.organization?.branding);
  const portalLocale = client?.organization?.defaultLocale ?? 'pt-BR';
  const portalCurrency = client?.organization?.defaultCurrency ?? 'BRL';
  const statusText = useMemo(() => {
    if (!client) return null;
    if (client.proposals.some((proposal) => proposal.status === 'accepted')) return 'Proposta aprovada';
    if (client.proposals.length > 0) return 'Proposta em acompanhamento';
    if (latestPipeline?.stageName) return latestPipeline.stageName;
    return 'Pedido recebido';
  }, [client, latestPipeline?.stageName]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/public/client-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Nao foi possivel consultar este pedido.');
      }

      setClient(payload.client);
    } catch (requestError) {
      setClient(null);
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel consultar este pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-os-bg text-os-text flex items-center justify-center p-6" style={getBrandingStyle(branding)}>
      <div className="w-full max-w-2xl bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-os-dark text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.appName} className="w-full h-full object-cover" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-[0.2em]">{branding.portalTitle}</h1>
              <p className="text-[10px] font-mono text-white/50 uppercase">{branding.portalSubtitle}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 border-b border-gray-100">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-2">
              <Mail className="w-3 h-3" />
              Email usado no atendimento
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded text-sm font-bold text-os-text outline-none focus:bg-white focus:border-brand transition-all"
              placeholder="voce@email.com"
            />
          </label>
          {error && <div className="p-3 rounded bg-red-50 text-red-600 text-xs font-bold">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand text-white rounded text-[10px] font-black uppercase tracking-[0.2em] hover:bg-os-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Consultar pedido
          </button>
        </form>

        {client && (
          <div className="p-6 space-y-5">
            <div className="p-5 rounded-lg bg-gray-50 border border-gray-100 flex gap-4">
              <div className="w-10 h-10 rounded bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-gray-400 uppercase mb-1">{client.name}</p>
                <h2 className="text-lg font-black text-os-text">{statusText}</h2>
                <p className="text-xs font-medium text-gray-500 mt-1">
                  Pedido registrado em {formatDate(client.createdAt)}.
                </p>
              </div>
            </div>

            {client.pipeline.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pipeline</p>
                {client.pipeline.map((deal) => (
                  <div key={deal.id} className="p-4 border border-gray-100 rounded flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-os-text">{deal.title}</p>
                      <p className="text-[10px] font-mono text-gray-400 uppercase">
                        {deal.stageName || 'Em andamento'} . {deal.probability}%
                      </p>
                    </div>
                    <p className="text-xs font-mono font-black text-brand">{formatCurrency(deal.value, portalCurrency, portalLocale)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Propostas</p>
              {client.proposals.length > 0 ? (
                client.proposals.map((proposal) => (
                  <div key={proposal.id} className="p-4 border border-gray-100 rounded">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-os-text">{proposal.title}</p>
                        <p className="text-[10px] font-mono text-gray-400 uppercase">
                          Valida ate {formatDate(proposal.validUntil)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest',
                          proposal.status === 'accepted'
                            ? 'bg-green-50 text-green-600'
                            : proposal.status === 'rejected'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-blue-50 text-blue-600',
                        )}
                      >
                        {proposalStatusLabel[proposal.status]}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs font-mono font-black text-brand">{formatCurrency(proposal.value, portalCurrency, portalLocale)}</p>
                      {proposal.status === 'accepted' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <FileText className="w-4 h-4 text-gray-300" />}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 border border-dashed border-gray-200 rounded text-xs font-bold text-gray-400">
                  Ainda nao ha proposta publicada para este pedido.
                </div>
              )}
            </div>

            {client.projects.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Projetos</p>
                {client.projects.map((project) => (
                  <div key={project.id} className="p-4 border border-gray-100 rounded">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-os-text">{project.name}</p>
                        <p className="text-[10px] font-mono text-gray-400 uppercase">
                          Prazo {formatDate(project.deadline)} . {project.status}
                        </p>
                      </div>
                      <p className="text-xs font-mono font-black text-brand">{project.progress}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {client.invoices.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Faturas</p>
                {client.invoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 border border-gray-100 rounded flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-os-text">{invoice.description}</p>
                      <p className="text-[10px] font-mono text-gray-400 uppercase">{invoice.status} . {formatDate(invoice.dueDate)}</p>
                    </div>
                    <p className="text-xs font-mono font-black text-brand">{formatCurrency(invoice.amount, portalCurrency, portalLocale)}</p>
                  </div>
                ))}
              </div>
            )}

            {client.contracts.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Contratos</p>
                {client.contracts.map((contract) => (
                  <div key={contract.id} className="p-4 border border-gray-100 rounded">
                    <p className="text-sm font-black text-os-text">{contract.title}</p>
                    <p className="text-[10px] font-mono text-gray-400 uppercase">
                      {contract.status} . {contract.autoRenew ? 'renovacao automatica' : 'renovacao manual'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {client.documents.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Documentos para assinatura</p>
                {client.documents.map((document) => (
                  <div key={document.id} className="p-4 border border-gray-100 rounded flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-os-text">{document.name}</p>
                      <p className="text-[10px] font-mono text-gray-400 uppercase">{document.signatureStatus}</p>
                    </div>
                    {document.signatureUrl && (
                      <a className="text-[10px] font-black uppercase text-brand" href={document.signatureUrl} target="_blank" rel="noreferrer">
                        Assinar
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
