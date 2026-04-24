import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Download, 
  Filter, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft,
  Calendar as CalendarIcon,
  Search,
  MoreHorizontal,
  MessageSquare,
  Mail,
  AlertCircle,
  FileUp,
  History,
  LayoutDashboard,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { cn, formatDate, formatCurrency } from '../lib/utils';
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { useTransactions, useClients, useProjects } from '../hooks/useFirebase';
import { Transaction, TransactionStatus } from '../types';
import TransactionModal from '../components/TransactionModal';

export default function Finance() {
  const { transactions, loading, addTransaction, updateTransaction } = useTransactions();
  const { clients } = useClients();
  const { projects } = useProjects();
  const [activeTab, setActiveTab ] = useState<'flow' | 'receivables' | 'payables' | 'reconciliation'>('flow');
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  // DRE Calculations
  const metrics = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    const monthlyIncome = transactions
      .filter(t => t.type === 'income' && t.status === 'liquidated' && new Date(t.date).getMonth() === curMonth)
      .reduce((acc, t) => acc + t.amount, 0);

    const monthlyExpense = transactions
      .filter(t => t.type === 'expense' && t.status === 'liquidated' && new Date(t.date).getMonth() === curMonth)
      .reduce((acc, t) => acc + t.amount, 0);

    const pendingReceivables = transactions
      .filter(t => t.type === 'income' && t.status === 'pending')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalBalance = transactions
      .reduce((acc, t) => t.type === 'income' && t.status === 'liquidated' ? acc + t.amount : t.type === 'expense' && t.status === 'liquidated' ? acc - t.amount : acc, 0);

    return { monthlyIncome, monthlyExpense, pendingReceivables, totalBalance };
  }, [transactions]);

  const filteredTransactions = transactions.filter(t => 
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.categoryId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (tx: Transaction) => {
    if (tx.status === 'liquidated') return 'text-green-500';
    const isOverdue = tx.dueDate < Date.now();
    const isToday = new Date(tx.dueDate).toDateString() === new Date().toDateString();
    
    if (isOverdue) return 'text-red-500';
    if (isToday) return 'text-amber-500';
    return 'text-blue-500';
  };

  const currentMonthData = useMemo(() => {
     // Aggregate by day for chart
     return []; // Simplified for now
  }, [transactions]);

  const handleQuickCollection = (tx: Transaction) => {
    const client = clients.find(c => c.id === tx.clientId);
    if (!client) {
      alert('Nenhum cliente vinculado para cobrança.');
      return;
    }
    const message = `Olá ${client.name}, identificamos um pagamento pendente no valor de ${formatCurrency(tx.amount)}. Você pode nos enviar o comprovante? Segue nossa chave PIX: ${client.pixKey || 'CHAVE_PADRAO'}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encoded}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-os-bg overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 p-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">Financial_Node_v2</span>
               <span className="text-[10px] font-mono text-gray-400">LIQUID_CASH: {formatCurrency(metrics.totalBalance)}</span>
            </div>
            <h2 className="text-2xl font-black text-os-text tracking-tight uppercase">Fluxo de Caixa & DRE</h2>
          </div>

          <div className="flex items-center gap-2">
             <button className="bg-white border border-gray-100 p-2 rounded text-gray-400 hover:text-os-text transition-all shadow-sm">
               <Download className="w-4 h-4" />
             </button>
             <button 
               onClick={() => { setEditingTransaction(undefined); setShowModal(true); }}
               className="bg-brand text-white text-[10px] px-4 py-2 rounded font-black hover:bg-os-dark transition-all uppercase tracking-widest flex items-center gap-2 shadow-sm shadow-brand/20"
             >
               <Plus className="w-3.5 h-3.5" />
               Novo Lançamento
             </button>
          </div>
        </div>

        {/* Global Summary */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
           {[
             { label: 'Saldo Acumulado', value: formatCurrency(metrics.totalBalance), icon: DollarSign, color: 'text-os-text' },
             { label: 'Receita do Mês', value: formatCurrency(metrics.monthlyIncome), icon: TrendingUp, color: 'text-green-500' },
             { label: 'Despesa do Mês', value: formatCurrency(metrics.monthlyExpense), icon: TrendingDown, color: 'text-red-500' },
             { label: 'Contas a Receber', value: formatCurrency(metrics.pendingReceivables), icon: Clock, color: 'text-brand' },
           ].map((stat, i) => (
             <div key={i} className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 flex items-center gap-4">
                <div className={cn("p-2 rounded-lg bg-white shadow-sm", stat.color)}>
                   <stat.icon className="w-4 h-4" />
                </div>
                <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                   <p className="text-sm font-black text-os-text">{stat.value}</p>
                </div>
             </div>
           ))}
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-8">
          {[
            { id: 'flow', label: 'DRE / Fluxo de Caixa', icon: LayoutDashboard },
            { id: 'receivables', label: 'Contas a Receber', icon: ArrowUpRight },
            { id: 'payables', label: 'Contas a Pagar', icon: ArrowDownLeft },
            { id: 'reconciliation', label: 'Conciliação Bancária', icon: FileUp },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "py-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2",
                activeTab === tab.id ? "border-brand text-brand" : "border-transparent text-gray-400 hover:text-os-text"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto custom-scrollbar">
         <div className="max-w-7xl mx-auto p-8">
            
            {activeTab === 'flow' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                 <div className="lg:col-span-8 space-y-8">
                    {/* Charts */}
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                       <div className="flex items-center justify-between mb-8">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Movimentação Acumulada</h3>
                          <div className="flex gap-4">
                             <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-brand"></div><span className="text-[9px] font-bold text-gray-400 uppercase">Receita</span></div>
                             <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gray-200"></div><span className="text-[9px] font-bold text-gray-400 uppercase">Despesa</span></div>
                          </div>
                       </div>
                       <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                             <AreaChart data={[
                               { name: 'S1', income: 4000, expense: 2400 },
                               { name: 'S2', income: 3000, expense: 1398 },
                               { name: 'S3', income: 2000, expense: 3800 },
                               { name: 'S4', income: 2780, expense: 1908 },
                             ]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip />
                                <Area type="monotone" dataKey="income" stroke="#0F172A" fill="#0F172A" fillOpacity={0.05} strokeWidth={2} />
                                <Area type="monotone" dataKey="expense" stroke="#CBD5E1" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                             </AreaChart>
                          </ResponsiveContainer>
                       </div>
                    </div>

                    {/* All Transactions List */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                       <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Histórico de Lançamentos</h3>
                          <div className="relative">
                             <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                             <input 
                               value={searchQuery}
                               onChange={e => setSearchQuery(e.target.value)}
                               type="text" 
                               placeholder="Filtrar por descrição..." 
                               className="pl-9 pr-4 py-1.5 bg-white border border-gray-100 rounded text-[10px] focus:ring-1 focus:ring-brand outline-none" 
                             />
                          </div>
                       </div>
                       <div className="overflow-x-auto">
                          <table className="w-full text-left">
                             <thead>
                                <tr className="bg-gray-50/30 border-b border-gray-50">
                                   <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Data / Venc</th>
                                   <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Descrição / Categoria</th>
                                   <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Vínculos</th>
                                   <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Valor</th>
                                   <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Liquidação</th>
                                   <th className="px-6 py-4"></th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-50">
                                {filteredTransactions.map(tx => (
                                  <tr key={tx.id} className="hover:bg-gray-50/30 transition-colors group">
                                     <td className="px-6 py-4">
                                        <div className="text-[10px] font-mono font-bold text-os-text">{formatDate(tx.date)}</div>
                                        <div className="text-[9px] font-mono text-gray-400 mt-0.5">VENC: {formatDate(tx.dueDate)}</div>
                                     </td>
                                     <td className="px-6 py-4">
                                        <div className="text-xs font-black text-os-text">{tx.description}</div>
                                        <div className="text-[9px] font-bold text-brand uppercase mt-0.5">{tx.categoryId}</div>
                                     </td>
                                     <td className="px-6 py-4">
                                        {tx.clientId && (
                                           <div className="text-[9px] font-bold text-gray-400 uppercase mb-0.5 max-w-[120px] truncate">
                                              CLI: {clients.find(c => c.id === tx.clientId)?.name}
                                           </div>
                                        )}
                                        {tx.projectId && (
                                           <div className="text-[9px] font-bold text-gray-400 uppercase max-w-[120px] truncate">
                                              PROJ: {projects.find(p => p.id === tx.projectId)?.name}
                                           </div>
                                        )}
                                     </td>
                                     <td className={cn("px-6 py-4 text-[10px] font-mono font-black", tx.type === 'income' ? "text-green-600" : "text-os-text")}>
                                        {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                                     </td>
                                     <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                           <div className={cn("w-1.5 h-1.5 rounded-full", tx.status === 'liquidated' ? "bg-green-500" : tx.status === 'cancelled' ? "bg-gray-300" : "bg-amber-500 animate-pulse")}></div>
                                           <span className={cn("text-[9px] font-black uppercase tracking-widest", getStatusColor(tx))}>
                                              {tx.status === 'liquidated' ? 'NO BOLSO' : tx.status === 'cancelled' ? 'CANCELADO' : 'PROMESSA'}
                                           </span>
                                        </div>
                                     </td>
                                     <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                           {tx.type === 'income' && tx.status === 'pending' && (
                                              <button 
                                                onClick={() => handleQuickCollection(tx)}
                                                className="p-1 text-green-500 hover:bg-green-50 rounded"
                                                title="Cobrança Rápida (WhatsApp)"
                                              >
                                                 <MessageSquare className="w-4 h-4" />
                                              </button>
                                           )}
                                           <button onClick={() => { setEditingTransaction(tx); setShowModal(true); }} className="p-1 text-gray-300 hover:text-os-text"><MoreHorizontal className="w-4 h-4" /></button>
                                        </div>
                                     </td>
                                  </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 </div>

                 <div className="lg:col-span-4 space-y-8">
                    {/* Simplified DRE */}
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Regime de Caixa (DRE)</h3>
                       <div className="space-y-4">
                          <div className="flex justify-between items-center text-xs">
                             <span className="font-bold text-gray-400 uppercase">Receita Bruta</span>
                             <span className="font-black text-green-600">+{formatCurrency(metrics.monthlyIncome)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                             <span className="font-bold text-gray-400 uppercase">Custos / Despesas</span>
                             <span className="font-black text-red-600">-{formatCurrency(metrics.monthlyExpense)}</span>
                          </div>
                          <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                             <span className="font-black text-os-text uppercase">Resultado Líquido</span>
                             <span className={cn("font-black", metrics.monthlyIncome - metrics.monthlyExpense >= 0 ? "text-os-text" : "text-red-600")}>
                                {formatCurrency(metrics.monthlyIncome - metrics.monthlyExpense)}
                             </span>
                          </div>
                       </div>
                       
                       <div className="mt-8 pt-8 border-t border-gray-50 space-y-4">
                          <h4 className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Inadimplência Assistida</h4>
                          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                             <div className="flex items-center gap-2 mb-1">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-[10px] font-black text-amber-600 uppercase">Atenção</span>
                             </div>
                             <p className="text-[10px] font-medium text-amber-800 leading-tight">Você tem {filteredTransactions.filter(t => t.status === 'pending' && t.dueDate < Date.now()).length} cobranças em atraso totalizando {formatCurrency(filteredTransactions.filter(t => t.status === 'pending' && t.dueDate < Date.now()).reduce((a,b)=>a+b.amount,0))}.</p>
                          </div>
                       </div>
                    </div>

                    {/* Quick Shortcuts */}
                    <div className="bg-os-dark text-white p-6 rounded-xl shadow-lg shadow-os-dark/20 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-8 opacity-10"><DollarSign className="w-32 h-32" /></div>
                       <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 relative z-10">Automações On/Off</h3>
                       <div className="space-y-3 relative z-10">
                          <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-gray-400">Baixa Automática (Resend)</span>
                             <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          </div>
                          <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-gray-400">Sync Gateway (Stripe)</span>
                             <div className="w-2 h-2 rounded-full bg-os-highlight animate-pulse"></div>
                          </div>
                       </div>
                       <button className="w-full mt-6 py-2 bg-white/10 hover:bg-white/20 rounded text-[9px] font-black uppercase tracking-widest transition-all">Configurar Webhooks</button>
                    </div>
                 </div>
              </div>
            )}

            {(activeTab === 'receivables' || activeTab === 'payables') && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                 <div className="p-6 border-b border-gray-100">
                    <h3 className="text-sm font-black text-os-text uppercase tracking-widest">
                       {activeTab === 'receivables' ? 'Fluxo de Recebimento' : 'Compromissos Financeiros'}
                    </h3>
                    <p className="text-[10px] font-medium text-gray-400 uppercase mt-1">Previsão e alertas de inadimplência</p>
                 </div>
                 <div className="divide-y divide-gray-50">
                    {filteredTransactions.filter(t => t.type === (activeTab === 'receivables' ? 'income' : 'expense')).map(tx => (
                      <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-all">
                         <div className="flex items-center gap-6">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              tx.status === 'liquidated' ? "bg-green-50 text-green-600" : 
                              tx.dueDate < Date.now() ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                            )}>
                               {tx.status === 'liquidated' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                            </div>
                            <div>
                               <h4 className="text-sm font-black text-os-text">{tx.description}</h4>
                               <div className="flex items-center gap-4 mt-1">
                                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase flex items-center gap-1">
                                     <CalendarIcon className="w-3 h-3" /> VENC: {formatDate(tx.dueDate)}
                                  </span>
                                  <span className="text-[9px] font-bold text-brand uppercase">{tx.categoryId}</span>
                               </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-8">
                            <div className="text-right">
                               <p className={cn("text-lg font-black", tx.type === 'income' ? "text-green-600" : "text-os-text")}>
                                  {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                               </p>
                               <span className={cn("text-[9px] font-black uppercase tracking-widest", getStatusColor(tx))}>
                                  {tx.status === 'liquidated' ? 'LIQUIDADO' : tx.dueDate < Date.now() ? 'ATRASADO' : 'PENDENTE'}
                               </span>
                            </div>
                            <div className="flex gap-2">
                               {tx.status === 'pending' && (
                                  <button 
                                    onClick={() => updateTransaction(tx.id, { status: 'liquidated' })}
                                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all shadow-lg shadow-green-500/20"
                                    title="Marcar como Pago"
                                  >
                                     <CheckCircle2 className="w-4 h-4" />
                                  </button>
                               )}
                               {tx.type === 'income' && tx.status === 'pending' && (
                                  <button 
                                    onClick={() => handleQuickCollection(tx)}
                                    className="p-2 border border-green-500 text-green-500 rounded-lg hover:bg-green-50 transition-all"
                                    title="Cobrança Rápida"
                                  >
                                     <MessageSquare className="w-4 h-4" />
                                  </button>
                               )}
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

            {activeTab === 'reconciliation' && (
              <div className="max-w-3xl mx-auto space-y-8">
                 <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-100 text-center flex flex-col items-center gap-4 hover:border-brand transition-all cursor-pointer group">
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:text-brand bg-brand/5">
                       <FileUp className="w-8 h-8" />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-os-text uppercase">Upload de Extrato Bancário</h3>
                       <p className="text-xs text-gray-400 mt-2">Arraste arquivos OFX ou CSV para iniciar a conciliação automática via AI</p>
                    </div>
                    <button className="mt-4 px-6 py-2 bg-os-dark text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Selecionar Arquivo</button>
                 </div>

                 <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Como funciona a conciliação?</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       {[
                         { title: 'Passo 01', text: 'Você sobe o arquivo do seu banco.', icon: FileUp },
                         { title: 'Passo 02', text: 'O sistema cruza data e valores.', icon: Search },
                         { title: 'Passo 03', text: 'Damos baixa automática nos registros.', icon: CheckCircle2 }
                       ].map((step, i) => (
                         <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="w-8 h-8 bg-brand/5 text-brand rounded flex items-center justify-center mb-3">
                               <step.icon className="w-4 h-4" />
                            </div>
                            <h4 className="text-[9px] font-black uppercase text-os-text mb-1">{step.title}</h4>
                            <p className="text-[10px] font-medium text-gray-400 leading-tight">{step.text}</p>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            )}

         </div>
      </main>

      {showModal && (
        <TransactionModal 
          onClose={() => setShowModal(false)}
          initialData={editingTransaction}
          onSave={async (data) => {
             if (editingTransaction) {
                await updateTransaction(editingTransaction.id, data);
             } else {
                await addTransaction(data);
             }
          }}
        />
      )}
    </div>
  );
}
