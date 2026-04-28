import React from 'react';
import { jsPDF } from 'jspdf';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  TrendingUp,
  Users,
} from 'lucide-react';
import ProjectCard from '../components/ProjectCard';
import TaskItem from '../components/TaskItem';
import { cn, formatCurrency } from '../lib/utils';
import { useSupabaseDashboard } from '../hooks/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Client, Project, ProjectTimeEntry, Proposal, Transaction } from '../types';

type DrillDown = {
  title: string;
  rows: Array<Record<string, string | number>>;
} | null;

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseLocalDate(value: string, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function isWithinPeriod(value: string, startDate: Date, endDate: Date) {
  const timestamp = new Date(value).getTime();
  return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
}

function downloadBlob(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(','))].join('\n');
}

function getMonthKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(value: string) {
  const [year, month] = value.split('-');
  return `${month}/${year.slice(2)}`;
}

function buildReportRows(input: {
  clients: Client[];
  projects: Project[];
  proposals: Proposal[];
  transactions: Transaction[];
  timeEntries: ProjectTimeEntry[];
}) {
  const clientMap = new Map(input.clients.map((client) => [client.id, client.name]));
  const projectMap = new Map(input.projects.map((project) => [project.id, project.name]));
  const rows: Array<Record<string, string | number>> = [];

  input.transactions.forEach((transaction) => {
    rows.push({
      tipo: 'Transacao',
      data: transaction.date.slice(0, 10),
      cliente: transaction.clientId ? clientMap.get(transaction.clientId) ?? transaction.clientId : '-',
      projeto: transaction.projectId ? projectMap.get(transaction.projectId) ?? transaction.projectId : '-',
      descricao: transaction.description,
      status: transaction.status,
      valor: transaction.type === 'income' ? transaction.amount : -transaction.amount,
    });
  });

  input.proposals.forEach((proposal) => {
    rows.push({
      tipo: 'Proposta',
      data: proposal.createdAt.slice(0, 10),
      cliente: clientMap.get(proposal.clientId) ?? proposal.clientId,
      projeto: '-',
      descricao: proposal.title,
      status: proposal.status,
      valor: proposal.value,
    });
  });

  input.timeEntries.forEach((entry) => {
    const project = entry.projectId ? projectMap.get(entry.projectId) ?? entry.projectId : '-';
    const hours = (entry.durationMinutes ?? 0) / 60;
    rows.push({
      tipo: 'Horas',
      data: entry.startedAt.slice(0, 10),
      cliente: '-',
      projeto: project,
      descricao: entry.note ?? entry.userId ?? 'Apontamento',
      status: entry.billable === false ? 'nao_faturavel' : 'faturavel',
      valor: Number(hours.toFixed(2)),
    });
  });

  return rows.sort((left, right) => String(right.data).localeCompare(String(left.data)));
}

export default function Dashboard({ onOpenProject }: { onOpenProject?: (projectId: string) => void }) {
  const { user } = useAuth();
  const {
    loading,
    summary,
    clients,
    projects,
    proposals,
    transactions,
    timeEntries,
    featuredProjects,
    backlogTasks,
  } = useSupabaseDashboard();
  const defaultStart = React.useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 2, 1);
  }, []);
  const defaultEnd = React.useMemo(() => new Date(), []);
  const [clientFilter, setClientFilter] = React.useState('all');
  const [projectFilter, setProjectFilter] = React.useState('all');
  const [periodStart, setPeriodStart] = React.useState(toDateInputValue(defaultStart));
  const [periodEnd, setPeriodEnd] = React.useState(toDateInputValue(defaultEnd));
  const [drillDown, setDrillDown] = React.useState<DrillDown>(null);

  const startDate = React.useMemo(() => parseLocalDate(periodStart, defaultStart), [defaultStart, periodStart]);
  const endDate = React.useMemo(() => {
    const parsed = parseLocalDate(periodEnd, defaultEnd);
    parsed.setHours(23, 59, 59, 999);
    return parsed;
  }, [defaultEnd, periodEnd]);

  const filteredProjects = React.useMemo(
    () =>
      projects.filter((project) => {
        if (clientFilter !== 'all' && project.clientId !== clientFilter) return false;
        if (projectFilter !== 'all' && project.id !== projectFilter) return false;
        return true;
      }),
    [clientFilter, projectFilter, projects],
  );

  const filteredTransactions = React.useMemo(
    () =>
      transactions.filter((transaction) => {
        if (!isWithinPeriod(transaction.date, startDate, endDate)) return false;
        if (clientFilter !== 'all' && transaction.clientId !== clientFilter) return false;
        if (projectFilter !== 'all' && transaction.projectId !== projectFilter) return false;
        return true;
      }),
    [clientFilter, endDate, projectFilter, startDate, transactions],
  );

  const filteredProposals = React.useMemo(
    () =>
      proposals.filter((proposal) => {
        if (!isWithinPeriod(proposal.createdAt, startDate, endDate)) return false;
        if (clientFilter !== 'all' && proposal.clientId !== clientFilter) return false;
        if (projectFilter !== 'all') return false;
        return true;
      }),
    [clientFilter, endDate, projectFilter, proposals, startDate],
  );

  const filteredTimeEntries = React.useMemo(
    () =>
      timeEntries.filter((entry) => {
        if (!isWithinPeriod(entry.startedAt, startDate, endDate)) return false;
        if (projectFilter !== 'all' && entry.projectId !== projectFilter) return false;
        return true;
      }),
    [endDate, projectFilter, startDate, timeEntries],
  );

  const reportRows = React.useMemo(
    () =>
      buildReportRows({
        clients,
        projects,
        proposals: filteredProposals,
        transactions: filteredTransactions,
        timeEntries: filteredTimeEntries,
      }),
    [clients, filteredProposals, filteredTimeEntries, filteredTransactions, projects],
  );

  const cashFlowData = React.useMemo(() => {
    const buckets = new Map<string, { month: string; income: number; expense: number; forecast: number; net: number }>();
    const ensureBucket = (key: string) => {
      if (!buckets.has(key)) buckets.set(key, { month: getMonthLabel(key), income: 0, expense: 0, forecast: 0, net: 0 });
      return buckets.get(key)!;
    };

    filteredTransactions.forEach((transaction) => {
      const bucket = ensureBucket(getMonthKey(transaction.status === 'pending' ? transaction.dueDate : transaction.date));
      if (transaction.type === 'income') bucket.income += transaction.amount;
      if (transaction.type === 'expense') bucket.expense += transaction.amount;
    });

    filteredProposals
      .filter((proposal) => ['sent', 'accepted'].includes(proposal.status))
      .forEach((proposal) => {
        const bucket = ensureBucket(getMonthKey(proposal.validUntil));
        bucket.forecast += proposal.status === 'accepted' ? proposal.value : proposal.value * 0.5;
      });

    return [...buckets.values()]
      .map((bucket) => ({ ...bucket, net: bucket.income + bucket.forecast - bucket.expense }))
      .sort((left, right) => left.month.localeCompare(right.month));
  }, [filteredProposals, filteredTransactions]);

  const productivityData = React.useMemo(() => {
    const buckets = new Map<string, { name: string; logged: number; billed: number }>();
    filteredTimeEntries.forEach((entry) => {
      const key = entry.userId ?? 'Equipe';
      if (!buckets.has(key)) buckets.set(key, { name: key.slice(0, 8), logged: 0, billed: 0 });
      const bucket = buckets.get(key)!;
      const hours = (entry.durationMinutes ?? 0) / 60;
      bucket.logged += hours;
      if (entry.billable !== false) bucket.billed += hours;
    });
    return [...buckets.values()].map((bucket) => ({
      ...bucket,
      logged: Number(bucket.logged.toFixed(1)),
      billed: Number(bucket.billed.toFixed(1)),
    }));
  }, [filteredTimeEntries]);

  const proposalPipelineData = React.useMemo(() => {
    const statuses: Proposal['status'][] = ['draft', 'sent', 'accepted', 'rejected'];
    return statuses.map((status) => ({
      status,
      count: filteredProposals.filter((proposal) => proposal.status === status).length,
      value: filteredProposals
        .filter((proposal) => proposal.status === status)
        .reduce((total, proposal) => total + proposal.value, 0),
    }));
  }, [filteredProposals]);

  const biMetrics = React.useMemo(() => {
    const realized = filteredTransactions
      .filter((transaction) => transaction.status === 'liquidated')
      .reduce((total, transaction) => total + (transaction.type === 'income' ? transaction.amount : -transaction.amount), 0);
    const pending = filteredTransactions
      .filter((transaction) => transaction.status === 'pending')
      .reduce((total, transaction) => total + (transaction.type === 'income' ? transaction.amount : -transaction.amount), 0);
    const forecast = filteredProposals
      .filter((proposal) => ['sent', 'accepted'].includes(proposal.status))
      .reduce((total, proposal) => total + (proposal.status === 'accepted' ? proposal.value : proposal.value * 0.5), 0);
    const loggedHours = filteredTimeEntries.reduce((total, entry) => total + (entry.durationMinutes ?? 0) / 60, 0);
    const billedHours = filteredTimeEntries
      .filter((entry) => entry.billable !== false)
      .reduce((total, entry) => total + (entry.durationMinutes ?? 0) / 60, 0);

    return { realized, pending, forecast, loggedHours, billedHours };
  }, [filteredProposals, filteredTimeEntries, filteredTransactions]);

  const handleExportCsv = () => {
    downloadBlob(`dashboard-bi-${periodStart}-${periodEnd}.csv`, toCsv(reportRows), 'text/csv;charset=utf-8');
  };

  const handleExportExcel = () => {
    const tableRows = reportRows
      .map((row) => `<tr>${Object.values(row).map((value) => `<td>${String(value)}</td>`).join('')}</tr>`)
      .join('');
    const headers = reportRows[0] ? `<tr>${Object.keys(reportRows[0]).map((key) => `<th>${key}</th>`).join('')}</tr>` : '';
    downloadBlob(
      `dashboard-bi-${periodStart}-${periodEnd}.xls`,
      `<table>${headers}${tableRows}</table>`,
      'application/vnd.ms-excel;charset=utf-8',
    );
  };

  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Mykante Business OS - Dashboard BI', 14, 18);
    doc.setFontSize(10);
    doc.text(`Periodo: ${periodStart} ate ${periodEnd}`, 14, 28);
    doc.text(`Resultado realizado: ${formatCurrency(biMetrics.realized)}`, 14, 38);
    doc.text(`Forecast: ${formatCurrency(biMetrics.forecast + biMetrics.pending)}`, 14, 46);
    doc.text(`Horas faturaveis/lancadas: ${biMetrics.billedHours.toFixed(1)} / ${biMetrics.loggedHours.toFixed(1)}`, 14, 54);
    reportRows.slice(0, 28).forEach((row, index) => {
      doc.text(`${row.data} | ${row.tipo} | ${row.descricao} | ${row.valor}`, 14, 68 + index * 7);
    });
    doc.save(`dashboard-bi-${periodStart}-${periodEnd}.pdf`);
  };

  const stats = [
    {
      label: 'Receita Mensal',
      value: formatCurrency(summary.monthlyIncome),
      icon: TrendingUp,
      delta: summary.monthlyIncome > 0 ? 'SUPABASE_LIVE' : 'SEM_BAIXAS',
      color: 'text-brand',
      deltaClassName:
        summary.monthlyIncome > 0
          ? 'text-green-500 bg-green-50 border-green-100'
          : 'text-gray-500 bg-gray-50 border-gray-100',
    },
    {
      label: 'Clientes Ativos',
      value: String(summary.activeClients).padStart(2, '0'),
      icon: Users,
      delta: `${summary.activeClients}_NA_BASE`,
      color: 'text-os-text',
      deltaClassName: 'text-os-text bg-gray-50 border-gray-100',
    },
    {
      label: 'Projetos Ativos',
      value: String(summary.activeProjects).padStart(2, '0'),
      icon: CheckCircle2,
      delta: `${summary.overdueProjects}_ATRASADO${summary.overdueProjects === 1 ? '' : 'S'}`,
      color: summary.overdueProjects > 0 ? 'text-amber-500' : 'text-green-500',
      deltaClassName:
        summary.overdueProjects > 0
          ? 'text-amber-600 bg-amber-50 border-amber-100'
          : 'text-green-500 bg-green-50 border-green-100',
    },
    {
      label: 'Acoes Pendentes',
      value: String(summary.pendingTasks).padStart(2, '0'),
      icon: Clock,
      delta: `${summary.urgentTasks}_URGENTE${summary.urgentTasks === 1 ? '' : 'S'}`,
      color: summary.urgentTasks > 0 ? 'text-orange-500' : 'text-os-text',
      deltaClassName:
        summary.urgentTasks > 0
          ? 'text-orange-500 bg-orange-50 border-orange-100'
          : 'text-gray-500 bg-gray-50 border-gray-100',
    },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase opacity-40">
            Loading Dashboard...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">
            Sistema Operacional
          </span>
          <span className="text-[10px] font-mono text-gray-400">BI_AVANCADO: ATIVO</span>
        </div>
        <h2 className="text-2xl font-bold text-os-text tracking-tight">
          Bom dia, {user?.displayName || user?.email?.split('@')[0] || 'Operador'}.{' '}
          <span className="text-brand font-black">!</span>
        </h2>
      </header>

      <section className="bg-white border border-gray-100 rounded p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 mr-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Relatorios</span>
          </div>
          <label className="space-y-1">
            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">Cliente</span>
            <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="h-9 rounded border border-gray-100 bg-gray-50 px-3 text-[11px] font-bold outline-none">
              <option value="all">Todos</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">Projeto</span>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="h-9 rounded border border-gray-100 bg-gray-50 px-3 text-[11px] font-bold outline-none">
              <option value="all">Todos</option>
              {filteredProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">Inicio</span>
            <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="h-9 rounded border border-gray-100 bg-gray-50 px-3 text-[11px] font-bold outline-none" />
          </label>
          <label className="space-y-1">
            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">Fim</span>
            <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="h-9 rounded border border-gray-100 bg-gray-50 px-3 text-[11px] font-bold outline-none" />
          </label>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={handleExportCsv} className="h-9 px-3 rounded bg-gray-50 border border-gray-100 text-[10px] font-bold uppercase flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button type="button" onClick={handleExportExcel} className="h-9 px-3 rounded bg-gray-50 border border-gray-100 text-[10px] font-bold uppercase flex items-center gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button type="button" onClick={handleExportPdf} className="h-9 px-3 rounded bg-os-dark text-white text-[10px] font-bold uppercase flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded border border-gray-100 shadow-sm hover:border-gray-200 transition-all group overflow-hidden relative">
            <div className="flex items-start justify-between mb-3 relative z-10">
              <div className={cn('p-1.5 rounded bg-gray-50', stat.color)}>
                <stat.icon className="w-4 h-4" />
              </div>
              <span className={cn('text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border', stat.deltaClassName)}>
                {stat.delta}
              </span>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5 relative z-10">{stat.label}</p>
            <p className="text-xl font-mono font-bold text-os-text tracking-tighter relative z-10">{stat.value}</p>
            <div className="absolute bottom-[-10px] right-[-10px] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
              <stat.icon className="w-20 h-20 rotate-[-15deg]" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Resultado Realizado</p>
          <p className="mt-2 text-xl font-mono font-bold text-os-text">{formatCurrency(biMetrics.realized)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Forecast Caixa</p>
          <p className="mt-2 text-xl font-mono font-bold text-brand">{formatCurrency(biMetrics.forecast + biMetrics.pending)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Horas Lancadas</p>
          <p className="mt-2 text-xl font-mono font-bold text-os-text">{biMetrics.loggedHours.toFixed(1)}h</p>
        </div>
        <div className="bg-white border border-gray-100 rounded p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Horas Faturaveis</p>
          <p className="mt-2 text-xl font-mono font-bold text-os-text">{biMetrics.billedHours.toFixed(1)}h</p>
        </div>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white border border-gray-100 rounded p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Cash-flow Forecast</h3>
            <span className="text-[9px] font-bold uppercase text-gray-300">Clique nas barras</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="income" name="Receita" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="expense" name="Despesa" stroke="#EF4444" strokeWidth={2} />
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#6D5DF7" strokeWidth={2} />
                <Line type="monotone" dataKey="net" name="Saldo" stroke="#111827" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded p-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Funil de Propostas</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={proposalPipelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value, name) => name === 'value' ? formatCurrency(Number(value)) : value} />
                <Bar
                  dataKey="value"
                  name="Valor"
                  radius={[4, 4, 0, 0]}
                  onClick={(data) => {
                    const status = data.status as Proposal['status'];
                    setDrillDown({
                      title: `Propostas: ${status}`,
                      rows: buildReportRows({ clients, projects, proposals: filteredProposals.filter((proposal) => proposal.status === status), transactions: [], timeEntries: [] }),
                    });
                  }}
                >
                  {proposalPipelineData.map((entry) => <Cell key={entry.status} fill={entry.status === 'accepted' ? '#10B981' : entry.status === 'rejected' ? '#EF4444' : '#6D5DF7'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded p-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Produtividade por Equipe</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}h`} />
                <Bar dataKey="logged" name="Lancadas" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="billed" name="Faturaveis" fill="#6D5DF7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white border border-gray-100 rounded">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
              {drillDown?.title ?? 'Drill-down do Relatorio'}
            </h3>
            {drillDown && (
              <button type="button" onClick={() => setDrillDown(null)} className="text-[10px] font-bold text-brand uppercase">
                Limpar
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-auto">
            {(drillDown?.rows ?? reportRows.slice(0, 12)).map((row, index) => (
              <div key={`${row.tipo}-${row.data}-${index}`} className="px-5 py-3 border-b border-gray-50 last:border-b-0 grid grid-cols-5 gap-3 text-[11px]">
                <span className="font-mono text-gray-400">{row.data}</span>
                <span className="font-bold text-os-text">{row.tipo}</span>
                <span className="col-span-2 truncate text-gray-600">{row.descricao}</span>
                <span className="font-mono font-bold text-right">{typeof row.valor === 'number' ? row.valor.toLocaleString('pt-BR') : row.valor}</span>
              </div>
            ))}
            {reportRows.length === 0 && (
              <div className="px-5 py-10 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-gray-300">
                Sem dados para o filtro selecionado.
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Projetos em Destaque</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredProjects.map((project) => (
              <div key={project.id}>
                <ProjectCard project={project} onClick={() => onOpenProject?.(project.id)} />
              </div>
            ))}
            {featuredProjects.length === 0 && (
              <div className="md:col-span-2 bg-white p-6 rounded border border-gray-100 text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
                Nenhum projeto disponivel na base.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Sprint Backlog</h3>
          </div>
          <div className="space-y-2">
            {backlogTasks.map((task) => (
              <div key={task.id}>
                <TaskItem task={task} />
              </div>
            ))}
            {backlogTasks.length === 0 && (
              <div className="bg-white p-6 rounded border border-gray-100 text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
                Nenhuma tarefa pendente no backlog.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
