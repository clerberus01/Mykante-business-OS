import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 text-center">
        <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-8 text-white text-3xl font-bold">
          M
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Mykante Business OS</h1>
        <p className="text-slate-500 mb-10 text-sm leading-relaxed">
          Tudo o que você precisa para gerenciar sua agência de soluções digitais em um só lugar.
        </p>

        <button 
          onClick={signIn}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-[0.98]"
        >
          <LogIn className="w-5 h-5" />
          Acessar com Google
        </button>

        <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
          Powered by Mykante Tech
        </p>
      </div>
    </div>
  );
}
