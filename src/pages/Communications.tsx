import React, { useState } from 'react';
import { 
  MessageSquare, 
  Search, 
  Plus, 
  MoreHorizontal, 
  Send,
  Phone,
  Video,
  Info,
  Clock,
  CheckCheck
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Communications() {
  const [activeChat, setActiveChat] = useState('1');
  const [message, setMessage] = useState('');

  const chats = [
    { id: '1', name: 'João Silva', lastMsg: 'O orçamento foi aprovado!', time: '10:24', unread: 2, status: 'online', company: 'Tech Corp' },
    { id: '2', name: 'Maria Souza', lastMsg: 'Pode enviar o contrato?', time: 'Ontem', unread: 0, status: 'offline', company: 'Design Hub' },
    { id: '3', name: 'Squad Alpha', lastMsg: 'Daily amanhã às 10h @canal', time: 'Ontem', unread: 0, status: 'online', isGroup: true },
    { id: '4', name: 'Proposta #421', lastMsg: 'Aguardando revisão interna.', time: '22 Abr', unread: 0, status: 'offline' },
  ];

  const currentChat = chats.find(c => c.id === activeChat) || chats[0];

  const messages = [
    { id: 'm1', text: 'Olá João, tudo bem?', sender: 'me', time: '09:00' },
    { id: 'm2', text: 'Tudo ótimo! Recebemos o briefing.', sender: 'them', time: '09:15' },
    { id: 'm3', text: 'Perfeito. Quando podemos iniciar a etapa de wireframes?', sender: 'me', time: '10:00' },
    { id: 'm4', text: 'O orçamento foi aprovado! Podemos começar na segunda.', sender: 'them', time: '10:24' },
  ];

  return (
    <div className="h-full flex gap-1 bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
      {/* Chats Sidebar */}
      <div className="w-80 flex flex-col border-r border-gray-100">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Mensagens</h3>
              <button className="p-1.5 text-brand hover:bg-brand/10 rounded transition-colors">
                 <Plus className="w-4 h-4" />
              </button>
           </div>
           <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Pesquisar conversas..." 
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-100 rounded text-[10px] focus:ring-1 focus:ring-brand outline-none transition-all"
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto">
           {chats.map(chat => (
             <button 
              key={chat.id}
              onClick={() => setActiveChat(chat.id)}
              className={cn(
                "w-full p-4 flex items-center gap-3 transition-all text-left border-b border-gray-50 relative",
                activeChat === chat.id ? "bg-gray-100/50" : "hover:bg-gray-50"
              )}
             >
                <div className="relative">
                   <div className={cn(
                     "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm",
                     chat.isGroup ? "bg-os-dark" : "bg-brand"
                   )}>
                      {chat.name.charAt(0)}
                   </div>
                   {chat.status === 'online' && (
                     <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                   )}
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-bold text-os-text truncate">{chat.name}</h4>
                      <span className="text-[9px] font-mono text-gray-400">{chat.time}</span>
                   </div>
                   <p className="text-[10px] text-gray-400 truncate">{chat.lastMsg}</p>
                </div>
                {chat.unread > 0 && (
                  <div className="w-4 h-4 rounded-full bg-brand text-white text-[8px] font-bold flex items-center justify-center">
                     {chat.unread}
                  </div>
                )}
             </button>
           ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
         {/* Chat Head */}
         <div className="p-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/20">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white font-bold text-xs uppercase">
                  {currentChat.name.charAt(0)}
               </div>
               <div>
                  <h4 className="text-xs font-bold text-os-text leading-tight">{currentChat.name}</h4>
                  <p className="text-[10px] text-gray-400 font-medium">
                     {currentChat.company || (currentChat.isGroup ? 'Grupo de Projeto' : 'ClienteParticular')}
                  </p>
               </div>
            </div>
            <div className="flex items-center gap-1">
               <button className="p-2 text-gray-400 hover:text-os-text rounded transition-colors"><Phone className="w-4 h-4" /></button>
               <button className="p-2 text-gray-400 hover:text-os-text rounded transition-colors"><Video className="w-4 h-4" /></button>
               <button className="p-2 text-gray-400 hover:text-os-text rounded transition-colors"><Info className="w-4 h-4" /></button>
               <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
               <button className="p-2 text-gray-400 hover:text-os-text rounded transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
            </div>
         </div>

         {/* Messages area */}
         <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
            <div className="flex items-center justify-center">
               <span className="px-3 py-1 bg-white border border-gray-100 rounded-full text-[9px] font-bold text-gray-300 uppercase tracking-widest shadow-sm">Hoje</span>
            </div>
            
            {messages.map(msg => (
              <div key={msg.id} className={cn(
                "flex flex-col max-w-[70%]",
                msg.sender === 'me' ? "ml-auto items-end" : "items-start"
              )}>
                 <div className={cn(
                   "p-3 rounded-lg text-xs leading-relaxed shadow-sm",
                   msg.sender === 'me' ? "bg-os-dark text-white rounded-br-none" : "bg-white border border-gray-100 text-os-text rounded-bl-none"
                 )}>
                    {msg.text}
                 </div>
                 <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-gray-300">{msg.time}</span>
                    {msg.sender === 'me' && <CheckCheck className="w-3 h-3 text-brand" />}
                 </div>
              </div>
            ))}
         </div>

         {/* Input area */}
         <div className="p-4 border-t border-gray-50">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 flex items-end gap-2 focus-within:border-brand focus-within:bg-white transition-all">
               <textarea 
                 value={message}
                 onChange={(e) => setMessage(e.target.value)}
                 placeholder="Digite sua mensagem técnica..."
                 className="flex-1 bg-transparent border-none focus:ring-0 text-xs font-medium resize-none max-h-32 p-2 outline-none"
                 rows={1}
               />
               <button className="p-2 bg-brand text-white rounded shadow-sm hover:bg-os-dark transition-all disabled:opacity-50" disabled={!message.trim()}>
                  <Send className="w-4 h-4" />
               </button>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[9px] font-bold text-gray-300 uppercase tracking-widest">
               <button className="hover:text-brand transition-colors">Anexar Documento</button>
               <button className="hover:text-brand transition-colors">Inserir Template</button>
               <button className="hover:text-brand transition-colors">Nota Interna</button>
            </div>
         </div>
      </div>
    </div>
  );
}
