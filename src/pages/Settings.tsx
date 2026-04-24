import React from 'react';
import { 
  User, 
  Bell, 
  Shield, 
  Database, 
  Code,
  LogOut,
  Save,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export default function Settings() {
  const { user, signOut } = useAuth();

  const sections = [
    { id: 'profile', label: 'Meu Perfil', icon: User },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'database', label: 'Banco de Dados', icon: Database },
    { id: 'api', label: 'API Integrations', icon: Code },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">Control Center</span>
          <span className="text-[10px] font-mono text-gray-400">CONFIG_SYMMETRIC: ACTIVE</span>
        </div>
        <h2 className="text-2xl font-bold text-os-text tracking-tight">Configurações do OS</h2>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation */}
        <nav className="space-y-1">
          {sections.map(section => (
            <button 
              key={section.id}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-bold uppercase tracking-wider transition-all",
                section.id === 'profile' ? "bg-os-dark text-white" : "text-gray-400 hover:bg-white hover:text-os-text"
              )}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
          <div className="pt-8">
             <button 
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
             >
                <LogOut className="w-4 h-4" />
                Finalizar Sessão
             </button>
          </div>
        </nav>

        {/* Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* Profile Section */}
          <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">Perfil do Operador</div>
             <div className="p-6 space-y-6">
                <div className="flex items-center gap-6">
                   <div className="w-20 h-20 rounded-full bg-os-dark flex items-center justify-center text-white text-3xl font-black shadow-lg">
                      {user?.displayName?.charAt(0) || 'U'}
                   </div>
                   <div>
                      <h4 className="text-lg font-bold text-os-text leading-tight">{user?.displayName || 'Admin Operator'}</h4>
                      <p className="text-xs font-mono text-gray-400 mb-2">{user?.email}</p>
                      <button className="text-[10px] font-bold uppercase text-brand hover:underline">Trocar foto de perfil</button>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Nome de Exibição</label>
                      <input 
                        defaultValue={user?.displayName || ''} 
                        className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Cargo / Função</label>
                      <input 
                        defaultValue="Business Manager" 
                        className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-brand outline-none transition-all"
                      />
                   </div>
                </div>
             </div>
          </section>

          {/* Identity Section */}
          <section className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-gray-50 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status da Conta</div>
             <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 rounded bg-green-50 border border-green-100">
                   <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <div>
                         <p className="text-xs font-bold text-green-700">Verificação de Identidade Concluída</p>
                         <p className="text-[10px] text-green-600 opacity-80">Nível de acesso máximo permitido pelo Mykante OS.</p>
                      </div>
                   </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                   <div>
                      <p className="text-xs font-bold text-os-text">Autenticação de Dois Fatores</p>
                      <p className="text-[10px] text-gray-400">Proteção adicional para acessos críticos.</p>
                   </div>
                   <div className="w-10 h-5 bg-gray-200 rounded-full relative cursor-pointer group">
                      <div className="w-3 h-3 bg-white rounded-full absolute top-1 left-1 group-hover:left-6 transition-all shadow-sm"></div>
                   </div>
                </div>
             </div>
          </section>

          <div className="flex justify-end gap-3">
             <button className="px-6 py-2 bg-gray-100 text-gray-500 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-gray-200 transition-all">Descartar</button>
             <button className="px-6 py-2 bg-brand text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-os-dark transition-all shadow-sm shadow-brand/20">
                <Save className="w-4 h-4" />
                Salvar Alterações
             </button>
          </div>

          <div className="p-6 rounded border border-amber-100 bg-amber-50/30 flex items-start gap-4">
             <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
             <div>
                <p className="text-xs font-bold text-amber-800">Zona de Deploy Crítico</p>
                <p className="text-[10px] text-amber-700 leading-relaxed opacity-80">Alterações no banco de dados sincronizado (FIREBASE_ENTROPY) podem causar inconsistências em múltiplos terminais. Proceda com cautela.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
