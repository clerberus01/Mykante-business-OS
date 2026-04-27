import React, { useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { CheckCircle2, Clock, FileText, Loader2, Mail, ShieldCheck, XCircle } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';

type PublicProposalStatus = {
  id: string;
  title: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  value: number;
  description: string | null;
  validUntil: string;
  updatedAt: string;
  clientName: string | null;
};

const statusMeta = {
  draft: {
    label: 'Em preparacao',
    detail: 'Estamos organizando as informacoes para enviar a proposta.',
    icon: Clock,
    className: 'bg-gray-100 text-gray-600',
  },
  sent: {
    label: 'Enviado para analise',
    detail: 'Sua proposta foi enviada e esta aguardando retorno.',
    icon: FileText,
    className: 'bg-blue-50 text-blue-600',
  },
  accepted: {
    label: 'Aprovado',
    detail: 'A proposta foi aprovada. Nosso time dara sequencia ao atendimento.',
    icon: CheckCircle2,
    className: 'bg-green-50 text-green-600',
  },
  rejected: {
    label: 'Nao aprovado',
    detail: 'Esta proposta foi encerrada. Entre em contato para uma nova avaliacao.',
    icon: XCircle,
    className: 'bg-red-50 text-red-600',
  },
} satisfies Record<PublicProposalStatus['status'], {
  label: string;
  detail: string;
  icon: React.ElementType;
  className: string;
}>;

export default function ProposalStatus() {
  const { token } = useParams({ from: '/proposal/$token' });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<PublicProposalStatus | null>(null);

  const currentStatus = useMemo(
    () => (proposal ? statusMeta[proposal.status] : null),
    [proposal],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/public/proposal-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Nao foi possivel consultar este pedido.');
      }

      setProposal(payload.proposal);
    } catch (requestError) {
      setProposal(null);
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel consultar este pedido.');
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = currentStatus?.icon ?? ShieldCheck;

  return (
    <div className="min-h-screen bg-os-bg text-os-text flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-os-dark text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-[0.2em]">Status do pedido</h1>
              <p className="text-[10px] font-mono text-white/50 uppercase">
                Consulta segura por email
              </p>
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
          {error && (
            <div className="p-3 rounded bg-red-50 text-red-600 text-xs font-bold">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand text-white rounded text-[10px] font-black uppercase tracking-[0.2em] hover:bg-os-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Consultar pedido
          </button>
        </form>

        {proposal && currentStatus && (
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono text-gray-400 uppercase mb-1">
                  {proposal.clientName || 'Cliente'}
                </p>
                <h2 className="text-lg font-black text-os-text leading-tight">{proposal.title}</h2>
              </div>
              <span className={cn('px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest', currentStatus.className)}>
                {currentStatus.label}
              </span>
            </div>

            <div className="p-5 rounded-lg bg-gray-50 border border-gray-100 flex gap-4">
              <div className={cn('w-10 h-10 rounded flex items-center justify-center shrink-0', currentStatus.className)}>
                <StatusIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-os-text">{currentStatus.label}</p>
                <p className="text-xs font-medium text-gray-500 mt-1">{currentStatus.detail}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 border border-gray-100 rounded">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">Valor</p>
                <p className="text-sm font-mono font-black text-os-text">{formatCurrency(proposal.value)}</p>
              </div>
              <div className="p-4 border border-gray-100 rounded">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-1">Validade</p>
                <p className="text-sm font-mono font-black text-os-text">{formatDate(proposal.validUntil)}</p>
              </div>
            </div>

            {proposal.description && (
              <div className="p-4 border border-gray-100 rounded">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mb-2">Resumo</p>
                <p className="text-xs font-medium text-gray-500 leading-relaxed">{proposal.description}</p>
              </div>
            )}

            <p className="text-[10px] font-mono text-gray-300 uppercase">
              Atualizado em {formatDate(proposal.updatedAt)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
