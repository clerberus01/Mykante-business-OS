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
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import {
  useSupabaseClients,
  useSupabaseDocuments,
  useSupabaseProjects,
} from '../hooks/supabase';
import { setPendingNavigationIntent } from '../lib/navigation';

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
      'p-2 rounded transition-all duration-200 cursor-pointer flex items-center justify-center',
      active ? 'bg-white/10 text-white shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/5',
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
    { id: 'calendar', label: 'Calendario', icon: Calendar },
    { id: 'finance', label: 'Financeiro', icon: Wallet },
    { id: 'messages', label: 'Comunicacao', icon: MessageSquare },
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
        <NavItem
          id="settings"
          label="Configuracoes"
          icon={Settings}
          active={activeTab === 'settings'}
          onClick={setActiveTab}
        />
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-brand border border-white/10 shadow-sm"></div>
      </div>
    </aside>
  );
};

const Header = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => {
  const { user } = useAuth();
  const { clients } = useSupabaseClients();
  const { projects } = useSupabaseProjects();
  const { documents } = useSupabaseDocuments();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showActions, setShowActions] = React.useState(false);
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const actionsRef = React.useRef<HTMLDivElement | null>(null);
  const searchRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (actionsRef.current && !actionsRef.current.contains(target)) {
        setShowActions(false);
      }

      if (searchRef.current && !searchRef.current.contains(target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = React.useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    const projectResults = projects
      .filter(
        (project) =>
          project.name.toLowerCase().includes(normalizedQuery) ||
          project.description.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 4)
      .map((project) => ({
        id: `project-${project.id}`,
        label: project.name,
        subtitle: 'Projeto',
        action: () => {
          setPendingNavigationIntent({ kind: 'open-project', projectId: project.id });
          setActiveTab('projects');
        },
      }));

    const clientResults = clients
      .filter(
        (client) =>
          client.name.toLowerCase().includes(normalizedQuery) ||
          client.email.toLowerCase().includes(normalizedQuery) ||
          (client.company ?? '').toLowerCase().includes(normalizedQuery) ||
          (client.contactName ?? '').toLowerCase().includes(normalizedQuery) ||
          (client.contactEmail ?? '').toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 4)
      .map((client) => ({
        id: `client-${client.id}`,
        label: client.name,
        subtitle: 'Cliente',
        action: () => {
          setPendingNavigationIntent({ kind: 'open-client', clientId: client.id });
          setActiveTab('crm');
        },
      }));

    const documentResults = documents
      .filter(
        (document) =>
          document.displayName.toLowerCase().includes(normalizedQuery) ||
          document.folder.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 4)
      .map((document) => ({
        id: `document-${document.id}`,
        label: document.displayName,
        subtitle: `Documento - ${document.folder}`,
        action: () => {
          setActiveTab('docs');
        },
      }));

    return [...projectResults, ...clientResults, ...documentResults].slice(0, 8);
  }, [clients, documents, normalizedQuery, projects, setActiveTab]);

  const quickActions = [
    {
      id: 'create-client',
      label: 'Novo Cliente',
      action: () => {
        setPendingNavigationIntent({ kind: 'create-client' });
        setActiveTab('crm');
      },
    },
    {
      id: 'create-project',
      label: 'Novo Projeto',
      action: () => {
        setPendingNavigationIntent({ kind: 'create-project' });
        setActiveTab('projects');
      },
    },
    {
      id: 'create-transaction',
      label: 'Novo Lancamento',
      action: () => {
        setPendingNavigationIntent({ kind: 'create-transaction' });
        setActiveTab('finance');
      },
    },
    {
      id: 'upload-document',
      label: 'Upload Documento',
      action: () => {
        setPendingNavigationIntent({ kind: 'upload-document' });
        setActiveTab('docs');
      },
    },
  ];

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-40 fixed top-0 right-0 left-16">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-bold tracking-tight uppercase text-os-text">Mykante Business OS</h1>
        <div className="h-4 w-[1px] bg-gray-300"></div>
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          Usuario: {user?.displayName?.split(' ')[0] || 'Membro'} . <span className="opacity-60">Status: Ativo</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative" ref={searchRef}>
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && searchResults[0]) {
                searchResults[0].action();
                setSearchQuery('');
                setShowSearchResults(false);
              }
            }}
            className="bg-gray-100 text-[11px] font-medium px-9 py-1.5 rounded-full w-64 border-none focus:ring-1 focus:ring-brand outline-none transition-all placeholder:text-gray-400"
          />
          {showSearchResults && normalizedQuery && (
            <div className="absolute top-full mt-2 left-0 w-80 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      result.action();
                      setSearchQuery('');
                      setShowSearchResults(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                  >
                    <div className="text-[11px] font-bold text-os-text">{result.label}</div>
                    <div className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">{result.subtitle}</div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-300">
                  Nenhum resultado.
                </div>
              )}
            </div>
          )}
        </div>
        <div className="relative" ref={actionsRef}>
          <button
            type="button"
            onClick={() => setShowActions((current) => !current)}
            className="bg-brand text-white text-[10px] px-4 py-1.5 rounded font-bold hover:shadow-lg hover:shadow-brand/20 transition-all uppercase tracking-wider flex items-center gap-2"
          >
            <Plus className="w-3 h-3" />
            Acao
          </button>
          {showActions && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
              {quickActions.map((quickAction) => (
                <button
                  key={quickAction.id}
                  type="button"
                  onClick={() => {
                    quickAction.action();
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                >
                  <div className="text-[11px] font-bold text-os-text">{quickAction.label}</div>
                </button>
              ))}
            </div>
          )}
        </div>
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
      <span>v1.2.0-ESTAVEL</span>
      <span className="text-white/60 uppercase">{new Date().toLocaleTimeString('pt-BR', { hour12: false })} BRT</span>
    </div>
  </footer>
);

export default function Layout({
  children,
  activeTab,
  setActiveTab,
}: {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <div className="h-screen bg-os-bg text-os-text font-sans flex overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col min-w-0 ml-16">
        <Header setActiveTab={setActiveTab} />
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
