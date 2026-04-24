import React from 'react';
import { 
  Users, 
  Briefcase, 
  Calendar, 
  Wallet, 
  MessageSquare, 
  FileText, 
  Settings,
  LayoutDashboard,
  Search,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  id: string;
  active: boolean;
  onClick: (id: string) => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, id, active, onClick }) => (
  <button
    id={`nav-${id}`}
    onClick={() => onClick(id)}
    title={label}
    className={cn(
      "p-2 rounded transition-all duration-200 cursor-pointer flex items-center justify-center",
      active 
        ? "bg-white/10 text-white shadow-lg" 
        : "text-white/50 hover:text-white hover:bg-white/5"
    )}
  >
    <Icon className="w-5 h-5" />
  </button>
);

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (tab: string) => void }) => {
  const navItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'crm', label: 'CRM & Timeline', icon: Users },
    { id: 'projects', label: 'Projetos', icon: Briefcase },
    { id: 'calendar', label: 'Calendário', icon: Calendar },
    { id: 'finance', label: 'Financeiro', icon: Wallet },
    { id: 'messages', label: 'Comunicação', icon: MessageSquare },
    { id: 'docs', label: 'Documentos', icon: FileText },
  ];

  return (
    <aside className="w-16 flex flex-col items-center py-4 bg-os-dark border-r border-os-dark shadow-xl fixed h-screen left-0 top-0 z-50">
      <div className="w-10 h-10 bg-brand rounded flex items-center justify-center mb-8 font-bold text-white text-xl shadow-lg shadow-brand/20">
        M
      </div>
      <nav className="flex flex-col gap-6">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            onClick={setActiveTab}
          />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-4 mb-4">
        <NavItem id="settings" label="Configurações" icon={Settings} active={activeTab === 'settings'} onClick={setActiveTab} />
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-brand border border-white/10 shadow-sm"></div>
      </div>
    </aside>
  );
};

const Header = () => {
  const { user } = useAuth();
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-40 fixed top-0 right-0 left-16">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-bold tracking-tight uppercase text-os-text">Mykante Business OS</h1>
        <div className="h-4 w-[1px] bg-gray-300"></div>
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          Usuário: {user?.displayName?.split(' ')[0] || 'Membro'} • <span className="opacity-60">Status: Ativo</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Pesquisar..." 
            className="bg-gray-100 text-[11px] font-medium px-9 py-1.5 rounded-full w-64 border-none focus:ring-1 focus:ring-brand outline-none transition-all placeholder:text-gray-400"
          />
        </div>
        <button className="bg-brand text-white text-[10px] px-4 py-1.5 rounded font-bold hover:shadow-lg hover:shadow-brand/20 transition-all uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-3 h-3" />
          Ação
        </button>
      </div>
    </header>
  );
};

const Footer = () => (
  <footer className="h-8 bg-os-dark text-white/30 px-4 flex items-center justify-between text-[10px] font-mono shrink-0 fixed bottom-0 left-16 right-0 z-40">
    <div className="flex gap-4">
      <span className="text-white/60">SISTEMA: OK</span>
      <span>CANAIS: ATIVOS</span>
      <span>ARMAZENAMENTO: 14%</span>
    </div>
    <div className="flex gap-4">
      <span>v1.2.0-ESTÁVEL</span>
      <span className="text-white/60 uppercase">{new Date().toLocaleTimeString('pt-BR', { hour12: false })} BRT</span>
    </div>
  </footer>
);

export default function Layout({ children, activeTab, setActiveTab }: { children: React.ReactNode, activeTab: string, setActiveTab: (tab: string) => void }) {
  return (
    <div className="h-screen bg-os-bg text-os-text font-sans flex overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col min-w-0 ml-16">
        <Header />
        <main className="flex-1 overflow-hidden mt-14 mb-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
    </div>
  );
}
