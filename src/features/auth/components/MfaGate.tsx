import React, { useEffect, useState } from 'react';
import { AlertCircle, KeyRound, Loader2, LogOut, QrCode, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';

export default function MfaGate() {
  const { enrollMfa, logout, mfaStatus, verifyMfaChallenge, verifyMfaEnrollment } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const startEnrollment = async () => {
      if (mfaStatus !== 'enrollment_required' || factorId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const enrollment = await enrollMfa();

        if (!active) {
          return;
        }

        setFactorId(enrollment.factorId);
        setQrCode(enrollment.qrCode);
        setSecret(enrollment.secret);
      } catch (enrollmentError) {
        if (active) {
          setError(enrollmentError instanceof Error ? enrollmentError.message : 'Falha ao iniciar MFA.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void startEnrollment();

    return () => {
      active = false;
    };
  }, [enrollMfa, factorId, mfaStatus]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mfaStatus === 'enrollment_required') {
        if (!factorId) {
          throw new Error('Cadastro MFA ainda nao foi iniciado.');
        }

        await verifyMfaEnrollment(factorId, code);
      } else {
        await verifyMfaChallenge(code);
      }
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Codigo MFA invalido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 text-center">
        <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-8 text-white">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Verificacao MFA</h1>
        <p className="text-slate-500 mb-8 text-sm leading-relaxed">
          Acesso ao CRM exige um codigo temporario do aplicativo autenticador.
        </p>

        {mfaStatus === 'enrollment_required' && (
          <div className="mb-6 rounded-3xl border border-slate-100 bg-slate-50 p-5 text-left">
            <div className="flex items-center gap-3 mb-4">
              <QrCode className="w-5 h-5 text-slate-500" />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Configurar TOTP</p>
            </div>
            {qrCode ? (
              <div className="space-y-4">
                <img src={qrCode} alt="QR Code MFA" className="mx-auto h-44 w-44 rounded-2xl bg-white p-2" />
                {secret && (
                  <p className="break-all rounded-2xl bg-white p-3 text-[11px] font-mono font-bold text-slate-500">
                    {secret}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left flex gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold text-red-700 leading-relaxed">{error}</p>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="text-left">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Codigo</label>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-900 focus-within:bg-white transition-all">
              <KeyRound className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                minLength={6}
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-transparent outline-none text-sm font-medium text-slate-900 placeholder:text-slate-300"
                placeholder="000000"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            Verificar e entrar
          </button>
        </form>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-5 mx-auto flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 hover:text-slate-700"
        >
          <LogOut className="w-4 h-4" />
          Sair desta sessao
        </button>
      </div>
    </div>
  );
}
