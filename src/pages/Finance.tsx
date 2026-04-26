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
  ArrowRight,
  Tags,
  Building2,
  ReceiptText,
  Wand2
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
import {
  useSupabaseTransactions as useTransactions,
  useSupabaseClients as useClients,
  useSupabaseProjects as useProjects,
} from '../hooks/supabase';
import { Transaction, TransactionStatus } from '../types';
import TransactionModal from '../components/TransactionModal';
import { clearPendingNavigationIntent, getPendingNavigationIntent } from '../lib/navigation';

export default function Finance() {
  const {
    transactions,
    categories,
    costCenters,
    bankStatementLines,
    loading,
    addTransaction,
    updateTransaction,
    createCategory,
    createCostCenter,
    generatePaymentRequest,
    importBankStatement,
  } = useTransactions();
  const { clients } = useClients();
  const { projects } = useProjects();
  const [activeTab, setActiveTab ] = useState<'flow' | 'reports' | 'categories' | 'receivables' | 'payables' | 'reconciliation'>('flow');
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [draftTimestamp, setDraftTimestamp] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const statementInputRef = React.useRef<HTMLInputElement | null>(null);
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const costCenterMap = useMemo(() => new Map(costCenters.map((center) => [center.id, center])), [costCenters]);

  React.useEffect(() => {
    const pendingIntent = getPendingNavigationIntent();

    if (pendingIntent?.kind === 'create-transaction') {
      setEditingTransaction(undefined);
      setDraftTimestamp(pendingIntent.timestamp);
      setShowModal(true);
      clearPendingNavigationIntent();
    }
  }, []);

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
     const now = new Date();
     const month = now.getMonth();
     const year = now.getFullYear();
     const buckets = [
       { name: 'S1', income: 0, expense: 0 },
       { name: 'S2', income: 0, expense: 0 },
       { name: 'S3', income: 0, expense: 0 },
       { name: 'S4', income: 0, expense: 0 },
       { name: 'S5', income: 0, expense: 0 },
     ];

     transactions.forEach((transaction) => {
       const transactionDate = new Date(transaction.date);
       if (transactionDate.getMonth() !== month || transactionDate.getFullYear() !== year) {
         return;
       }

       const day = transactionDate.getDate();
       const bucketIndex = Math.min(Math.floor((day - 1) / 7), buckets.length - 1);
       const bucket = buckets[bucketIndex];

       if (transaction.type === 'income' && transaction.status === 'liquidated') {
         bucket.income += transaction.amount;
       }

       if (transaction.type === 'expense' && transaction.status === 'liquidated') {
         bucket.expense += transaction.amount;
       }
     });

     return buckets;
  }, [transactions]);

  const dreByMonth = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, month) => ({ month, income: 0, expense: 0, result: 0 }));
    const year = new Date().getFullYear();
    transactions
      .filter((transaction) => transaction.status === 'liquidated' && new Date(transaction.date).getFullYear() === year)
      .forEach((transaction) => {
        const bucket = buckets[new Date(transaction.date).getMonth()];
        if (transaction.type === 'income') bucket.income += transaction.amount;
        if (transaction.type === 'expense') bucket.expense += transaction.amount;
        bucket.result = bucket.income - bucket.expense;
      });
    return buckets;
  }, [transactions]);

  const projectedCashFlow = useMemo(() => {
    const projectForecast = projects.reduce((sum, project) => sum + Math.max(0, (project.budget * (project.progress || 0)) / 100 - (project.financialBalance ?? 0)), 0);
    const recurringForecast = transactions
      .filter((transaction) => transaction.isRecurring && transaction.status !== 'cancelled')
      .reduce((sum, transaction) => sum + (transaction.type === 'income' ? transaction.amount : -transaction.amount), 0);
    const pendingForecast = transactions
      .filter((transaction) => transaction.status === 'pending')
      .reduce((sum, transaction) => sum + (transaction.type === 'income' ? transaction.amount : -transaction.amount), 0);
    return { projectForecast, recurringForecast, pendingForecast, total: projectForecast + recurringForecast + pendingForecast };
  }, [projects, transactions]);

  const agingBuckets = useMemo(() => {
    const now = Date.now();
    return transactions.filter((transaction) => transaction.type === 'income' && transaction.status === 'pending').reduce(
      (acc, transaction) => {
        const days = Math.floor((now - transaction.dueDate) / 86400000);
        if (days <= 0) acc.current += transaction.amount;
        else if (days <= 30) acc.d30 += transaction.amount;
        else if (days <= 60) acc.d60 += transaction.amount;
        else acc.d90 += transaction.amount;
        return acc;
      },
      { current: 0, d30: 0, d60: 0, d90: 0 },
    );
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

  const handleGeneratePayment = async (tx: Transaction, method: 'pix' | 'boleto') => {
    const url = await generatePaymentRequest(tx, method);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleStatementFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const imported = await importBankStatement(file.name, await file.text());
    window.alert(`${imported} linhas importadas para conciliacao.`);
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
             <button type="button" className="bg-white border border-gray-100 p-2 rounded text-gray-400 hover:text-os-text transition-all shadow-sm">
               <Download className="w-4 h-4" />
             </button>
             <button 
               type="button"
               onClick={() => { setEditingTransaction(undefined); setDraftTimestamp(undefined); setShowModal(true); }}
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
            { id: 'reports', label: 'Relatorios Avancados', icon: ReceiptText },
            { id: 'categories', label: 'Categorias / Centros', icon: Tags },
            { id: 'receivables', label: 'Contas a Receber', icon: ArrowUpRight },
            { id: 'payables', label: 'Contas a Pagar', icon: ArrowDownLeft },
            { id: 'reconciliation', label: 'Conciliação Bancária', icon: FileUp },
          ].map(tab => (
            <button
              type="button"
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
                             <AreaChart data={currentMonthData}>
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
                                        <div className="text-[9px] font-bold text-brand uppercase mt-0.5">
                                           {categoryMap.get(tx.categoryId)?.name ?? tx.categoryId}
                                           {tx.costCenterId && ` • ${costCenterMap.get(tx.costCenterId)?.name ?? 'Centro'}`}
                                        </div>
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
                                                type="button"
                                                onClick={() => handleQuickCollection(tx)}
                                                className="p-1 text-green-500 hover:bg-green-50 rounded"
                                                title="Cobrança Rápida (WhatsApp)"
                                              >
                                                 <MessageSquare className="w-4 h-4" />
                                              </button>
                                           )}
                                           {tx.type === 'income' && tx.status === 'pending' && (
                                              <button
                                                type="button"
                                                onClick={() => void handleGeneratePayment(tx, 'pix')}
                                                className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                                title="Gerar Pix/Boleto"
                                              >
                                                 <Wand2 className="w-4 h-4" />
                                              </button>
                                           )}
                                           <button type="button" onClick={() => { setEditingTransaction(tx); setDraftTimestamp(undefined); setShowModal(true); }} className="p-1 text-gray-300 hover:text-os-text"><MoreHorizontal className="w-4 h-4" /></button>
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
                       <button type="button" className="w-full mt-6 py-2 bg-white/10 hover:bg-white/20 rounded text-[9px] font-black uppercase tracking-widest transition-all">Configurar Webhooks</button>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">DRE Mensal / Anual</h3>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dreByMonth.map((item) => ({ ...item, name: new Date(2026, item.month, 1).toLocaleDateString('pt-BR', { month: 'short' }) }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip />
                        <Bar dataKey="income" fill="#16a34a" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Fluxo Projetado</h3>
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between"><span className="font-bold text-gray-400 uppercase">Recorrencias</span><strong>{formatCurrency(projectedCashFlow.recurringForecast)}</strong></div>
                      <div className="flex justify-between"><span className="font-bold text-gray-400 uppercase">Pendencias</span><strong>{formatCurrency(projectedCashFlow.pendingForecast)}</strong></div>
                      <div className="flex justify-between"><span className="font-bold text-gray-400 uppercase">Projetos por progresso</span><strong>{formatCurrency(projectedCashFlow.projectForecast)}</strong></div>
                      <div className="flex justify-between pt-3 border-t border-gray-100"><span className="font-black text-os-text uppercase">Forecast</span><strong className="text-brand">{formatCurrency(projectedCashFlow.total)}</strong></div>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Aging Report</h3>
                    {[
                      ['A vencer', agingBuckets.current],
                      ['1-30 dias', agingBuckets.d30],
                      ['31-60 dias', agingBuckets.d60],
                      ['60+ dias', agingBuckets.d90],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex justify-between py-2 border-b border-gray-50 text-xs">
                        <span className="font-bold uppercase text-gray-400">{label}</span>
                        <strong>{formatCurrency(Number(value))}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-os-text">Categorias Financeiras</h3>
                    <button type="button" onClick={() => { const name = window.prompt('Nome da categoria'); if (name) void createCategory(name, 'both'); }} className="text-[9px] font-black uppercase text-brand">+ Categoria</button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {categories.map((category) => (
                      <div key={category.id} className="p-4 flex items-center justify-between">
                        <div><p className="text-xs font-black text-os-text">{category.name}</p><p className="text-[9px] font-bold uppercase text-gray-400">{category.dreGroup}</p></div>
                        <span className="text-[9px] font-black uppercase text-brand">{category.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-os-text">Centros de Custo</h3>
                    <button type="button" onClick={() => { const name = window.prompt('Nome do centro de custo'); if (name) void createCostCenter(name); }} className="text-[9px] font-black uppercase text-brand">+ Centro</button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {costCenters.map((center) => (
                      <div key={center.id} className="p-4 flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-gray-300" />
                        <div><p className="text-xs font-black text-os-text">{center.name}</p><p className="text-[9px] font-bold uppercase text-gray-400">{center.code || 'SEM CODIGO'}</p></div>
                      </div>
                    ))}
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
                                    type="button"
                                    onClick={() => updateTransaction(tx.id, { status: 'liquidated' })}
                                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all shadow-lg shadow-green-500/20"
                                    title="Marcar como Pago"
                                  >
                                     <CheckCircle2 className="w-4 h-4" />
                                  </button>
                               )}
                               {tx.type === 'income' && tx.status === 'pending' && (
                                  <button 
                                    type="button"
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
                 <input ref={statementInputRef} type="file" accept=".csv,.ofx,.txt" className="hidden" onChange={(event) => void handleStatementFile(event)} />
                 <div onClick={() => statementInputRef.current?.click()} className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-100 text-center flex flex-col items-center gap-4 hover:border-brand transition-all cursor-pointer group">
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:text-brand bg-brand/5">
                       <FileUp className="w-8 h-8" />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-os-text uppercase">Upload de Extrato Bancário</h3>
                       <p className="text-xs text-gray-400 mt-2">Arraste arquivos OFX ou CSV para iniciar a conciliação automática via AI</p>
                    </div>
                    <button type="button" className="mt-4 px-6 py-2 bg-os-dark text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Selecionar Arquivo</button>
                 </div>
                 <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                   <div className="p-4 bg-gray-50 border-b border-gray-100">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-os-text">Matching Inteligente</h3>
                   </div>
                   <div className="divide-y divide-gray-50">
                     {bankStatementLines.map((line) => (
                       <div key={line.id} className="p-4 flex items-center justify-between">
                         <div>
                           <p className="text-xs font-black text-os-text">{line.description}</p>
                           <p className="text-[9px] font-mono text-gray-400">{formatDate(line.occurredAt)} • {Math.round(line.matchConfidence ?? 0)}% match</p>
                         </div>
                         <div className="text-right">
                           <p className="text-xs font-black">{formatCurrency(line.amount)}</p>
                           <span className={cn("text-[9px] font-black uppercase", line.status === 'matched' ? "text-green-600" : "text-amber-600")}>{line.status}</span>
                         </div>
                       </div>
                     ))}
                   </div>
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
          onClose={() => {
            setShowModal(false);
            setDraftTimestamp(undefined);
          }}
          initialData={editingTransaction}
          defaultTimestamp={draftTimestamp}
          categories={categories}
          costCenters={costCenters}
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
