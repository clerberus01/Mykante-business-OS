import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  MoreHorizontal, 
  Folder, 
  Download,
  Share2,
  Trash2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState('');

  const documents = [
    { id: '1', name: 'Proposta_Comercial_TechCorp.pdf', size: '2.4 MB', type: 'pdf', date: '2026-04-10', folder: 'Propostas' },
    { id: '2', name: 'Briefing_Projeto_Alpha.docx', size: '1.1 MB', type: 'doc', date: '2026-04-12', folder: 'Briefings' },
    { id: '3', name: 'Relatorio_Abril.pdf', size: '5.8 MB', type: 'pdf', date: '2026-04-20', folder: 'Relatórios' },
    { id: '4', name: 'Contrato_Assinado_V1.pdf', size: '3.2 MB', type: 'pdf', date: '2026-04-15', folder: 'Contratos' },
    { id: '5', name: 'Assets_Branding_Final.zip', size: '42 MB', type: 'zip', date: '2026-04-18', folder: 'Assets' },
  ];

  const folders = ['Propostas', 'Contratos', 'Briefings', 'Relatórios', 'Assets'];

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-2 py-0.5 rounded uppercase tracking-widest">Document Registry</span>
              <span className="text-[10px] font-mono text-gray-400">STORAGE_USED: 1.2GB / 10GB</span>
           </div>
           <h2 className="text-2xl font-bold text-os-text tracking-tight">Arquivos e Documentos</h2>
        </div>

        <button className="bg-brand text-white text-[10px] px-4 py-2 rounded font-bold hover:bg-os-dark transition-all uppercase tracking-wider flex items-center gap-2 shadow-sm shadow-brand/20">
          <Plus className="w-3.5 h-3.5" />
          Upload Arquivo
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden">
        {/* Sidebar Folders */}
        <div className="lg:col-span-3 space-y-6 overflow-y-auto pr-2 scrollbar-hide">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Pastas</h3>
            <div className="space-y-1">
               <button className="w-full flex items-center gap-3 p-2 bg-os-dark text-white rounded shadow-sm text-xs font-bold transition-all transform translate-x-1">
                  <Folder className="w-4 h-4 opacity-60" />
                  Todos os Arquivos
               </button>
               {folders.map(folder => (
                 <button key={folder} className="w-full flex items-center justify-between p-2 text-gray-500 hover:text-os-text hover:bg-white rounded text-xs font-medium transition-all group">
                    <div className="flex items-center gap-3">
                       <Folder className="w-4 h-4 text-gray-300 group-hover:text-brand transition-colors" />
                       {folder}
                    </div>
                    <span className="text-[9px] font-mono text-gray-300">12</span>
                 </button>
               ))}
            </div>
          </div>

          <div className="p-4 rounded border border-gray-100 bg-white/50 space-y-3">
             <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Quick Share</h4>
             <p className="text-[10px] text-gray-500 leading-relaxed">Arraste arquivos aqui para gerar links temporários e seguros.</p>
             <div className="border-2 border-dashed border-gray-200 rounded p-4 flex items-center justify-center">
                <Share2 className="w-6 h-6 text-gray-200" />
             </div>
          </div>
        </div>

        {/* File List */}
        <div className="lg:col-span-9 flex flex-col bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex items-center gap-4 bg-gray-50/30">
             <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Pesquisar por nome, extensão ou tag..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-100 rounded text-xs focus:ring-1 focus:ring-brand outline-none transition-all"
                />
             </div>
             <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                <span>FILTRAR_POR:</span>
                <select className="bg-transparent border-none focus:ring-0 text-os-text font-bold uppercase cursor-pointer">
                   <option>Recentes</option>
                   <option>Tamanho</option>
                   <option>Nome</option>
                </select>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 sticky top-0 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Nome do Arquivo</th>
                  <th className="px-6 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Tamanho</th>
                  <th className="px-6 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Modificado</th>
                  <th className="px-6 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Pasta</th>
                  <th className="px-6 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {documents.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer">
                    <td className="px-6 py-4 text-xs font-bold text-os-text flex items-center gap-3">
                       <div className={cn(
                         "w-8 h-8 rounded flex items-center justify-center text-white font-black",
                         doc.type === 'pdf' ? "bg-red-500" : doc.type === 'doc' ? "bg-blue-500" : "bg-amber-500"
                       )}>
                          {doc.type.toUpperCase()}
                       </div>
                       {doc.name}
                    </td>
                    <td className="px-6 py-4 text-[10px] font-mono text-gray-500">{doc.size}</td>
                    <td className="px-6 py-4 text-[10px] font-mono text-gray-500">{doc.date}</td>
                    <td className="px-6 py-4">
                       <span className="px-1.5 py-0.5 rounded-[2px] bg-gray-100 border border-gray-200 text-[9px] font-bold text-gray-500 uppercase tracking-widest uppercase">
                          {doc.folder}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button className="p-1.5 text-gray-400 hover:text-os-text hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all" title="Baixar">
                             <Download className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all" title="Excluir">
                             <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-brand hover:bg-white rounded border border-transparent hover:border-gray-100 transition-all">
                             <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {documents.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center grayscale opacity-10">
                 <FileText className="w-12 h-12 mb-4" />
                 <p className="text-[11px] font-bold uppercase tracking-[0.4em]">Empty Registry</p>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-[10px] font-mono text-gray-400">
             <div className="flex gap-4">
                <span>PÁGINA: 01 / 04</span>
                <span>REGISTROS: 42</span>
             </div>
             <div className="flex gap-1">
                <button className="px-2 py-1 bg-white border border-gray-200 rounded disabled:opacity-30">ANT</button>
                <button className="px-2 py-1 bg-white border border-gray-200 rounded">PRÓX</button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
