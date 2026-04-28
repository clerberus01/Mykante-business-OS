import React, { useState } from 'react';
import { AlertCircle, Loader2, Lock, LogIn, Phone, UserPlus, UserRound } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const resetFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    resetFeedback();

    try {
      await signIn(identifier, password);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    resetFeedback();

    try {
      const result = await signUp({
        identifier,
        password,
      });

      setMessage(
        result.requiresConfirmation
          ? 'Cadastro criado. Confirme seu e-mail ou telefone para concluir o primeiro acesso.'
          : 'Cadastro criado com sucesso. Voce ja pode entrar no sistema.',
      );
      setMode('login');
      setPassword('');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Falha ao criar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 text-center">
        <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-8 text-white text-3xl font-bold">
          M
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Mykante Business OS</h1>
        <p className="text-slate-500 mb-8 text-sm leading-relaxed">
          Tudo o que voce precisa para gerenciar sua operacao em um so lugar.
        </p>

        <div className="flex bg-slate-100 rounded-2xl p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              resetFeedback();
            }}
            className={`flex-1 py-2.5 rounded-[1rem] text-[11px] font-bold uppercase tracking-[0.18em] transition-all ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              resetFeedback();
            }}
            className={`flex-1 py-2.5 rounded-[1rem] text-[11px] font-bold uppercase tracking-[0.18em] transition-all ${
              mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            Cadastro
          </button>
        </div>

        {message && (
          <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left">
            <p className="text-[11px] font-semibold text-emerald-700 leading-relaxed">{message}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left flex gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold text-red-700 leading-relaxed">{error}</p>
          </div>
        )}

        <form className="space-y-4" onSubmit={mode === 'login' ? handleLogin : handleSignup}>
          <div className="text-left">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              E-mail ou telefone
            </label>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-900 focus-within:bg-white transition-all">
              {mode === 'login' ? (
                <UserRound className="w-4 h-4 text-slate-400" />
              ) : (
                <Phone className="w-4 h-4 text-slate-400" />
              )}
              <input
                type="text"
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full bg-transparent outline-none text-sm font-medium text-slate-900 placeholder:text-slate-300"
                placeholder="voce@empresa.com ou +5511999999999"
              />
            </div>
          </div>

          <div className="text-left">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Senha</label>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-900 focus-within:bg-white transition-all">
              <Lock className="w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                minLength={mode === 'signup' ? 8 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent outline-none text-sm font-medium text-slate-900 placeholder:text-slate-300"
                placeholder={mode === 'signup' ? 'Minimo de 8 caracteres' : 'Sua senha'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === 'login' ? (
              <LogIn className="w-5 h-5" />
            ) : (
              <UserPlus className="w-5 h-5" />
            )}
            {mode === 'login' ? 'Entrar com senha' : 'Criar cadastro'}
          </button>
        </form>

        <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
          Powered by Mykante Tech
        </p>
      </div>
    </div>
  );
}
