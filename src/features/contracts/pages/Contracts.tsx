import React from 'react';
import { FileSignature, Loader2, Plus, RefreshCw, Store } from 'lucide-react';
import { useSupabaseContracts } from '@/src/hooks/supabase';
import { formatCurrency, formatDate } from '@/src/lib/utils';
import type { Contract } from '@/src/types';

export default function Contracts() {
  const { contracts, marketplaceItems, loading, createContract } = useSupabaseContracts();
  const [creating, setCreating] = React.useState(false);

  const handleCreateContract = async () => {
    const title = window.prompt('Nome do contrato recorrente');
    if (!title?.trim()) return;

    const amountInput = window.prompt('Valor recorrente', '0');
    const amount = Number(amountInput?.replace(',', '.') ?? 0);

    setCreating(true);
    try {
      await createContract({
        title: title.trim(),
        status: 'draft',
        contractType: 'service',
        amount: Number.isFinite(amount) ? amount : 0,
        currency: 'BRL',
        startsAt: new Date().toISOString(),
        renewalInterval: 'monthly',
        autoRenew: true,
        renewalNoticeDays: 30,
      } satisfies Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);
    } catch (error) {
      console.error('Contract create failed:', error);
      window.alert('Nao foi possivel criar o contrato.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">
              Contract Ops
            </span>
            <span className="text-[10px] font-mono text-gray-400">RENOVACAO_AUTOMATICA: ATIVA</span>
          </div>
          <h2 className="text-2xl font-bold text-os-text tracking-tight">Contratos & Templates</h2>
        </div>
        <button
          type="button"
          onClick={() => void handleCreateContract()}
          disabled={creating}
          className="bg-brand text-white text-[10px] px-4 py-2 rounded font-bold hover:bg-os-dark transition-all uppercase tracking-wider flex items-center gap-2 shadow-sm shadow-brand/20 disabled:opacity-60"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Novo Contrato
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded border border-gray-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Contratos Ativos</p>
          <p className="mt-2 text-2xl font-black text-os-text">{contracts.filter((contract) => contract.status === 'active').length}</p>
        </div>
        <div className="bg-white p-5 rounded border border-gray-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Renovacao Automatica</p>
          <p className="mt-2 text-2xl font-black text-brand">{contracts.filter((contract) => contract.autoRenew).length}</p>
        </div>
        <div className="bg-white p-5 rounded border border-gray-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Templates Disponiveis</p>
          <p className="mt-2 text-2xl font-black text-os-text">{marketplaceItems.length}</p>
        </div>
      </div>

      <section className="bg-white rounded border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-brand" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-os-text">Gestao de Contratos</h3>
        </div>
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand" /></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {contracts.map((contract) => (
              <div key={contract.id} className="p-5 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                <div className="md:col-span-2">
                  <p className="text-sm font-black text-os-text">{contract.title}</p>
                  <p className="text-[10px] font-mono uppercase text-gray-400">
                    {contract.renewalInterval} - {contract.autoRenew ? 'auto-renew' : 'manual'}
                  </p>
                </div>
                <p className="text-xs font-mono font-black text-brand">{formatCurrency(contract.amount, contract.currency)}</p>
                <p className="text-[10px] font-mono uppercase text-gray-400">
                  {contract.nextRenewalAt ? `Aviso ${formatDate(contract.nextRenewalAt)}` : 'Sem renovacao'}
                </p>
                <span className="justify-self-start px-2 py-1 rounded bg-gray-50 border border-gray-100 text-[9px] font-black uppercase tracking-widest text-gray-500">
                  {contract.status}
                </span>
              </div>
            ))}
            {contracts.length === 0 && (
              <div className="p-10 text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
                Nenhum contrato cadastrado.
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white rounded border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <Store className="w-4 h-4 text-brand" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-os-text">Marketplace de Templates</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
          {marketplaceItems.map((item) => (
            <div key={item.id} className="border border-gray-100 rounded p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-os-text">{item.name}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{item.description ?? 'Template pronto para instalar.'}</p>
                </div>
                <RefreshCw className="w-4 h-4 text-gray-300" />
              </div>
              <p className="mt-4 text-[9px] font-mono uppercase text-gray-400">
                {item.templateType} - {item.locale} - {item.currency}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
