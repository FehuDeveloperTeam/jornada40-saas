import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, User, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import client from '../api/client';
import { formatRut } from '../utils/rutUtils';

export default function ForgotPassword() {
  const [rut, setRut] = useState('');
  const [hiddenEmail, setHiddenEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRut(formatRut(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rut) return;
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await client.post('/auth/recuperar-por-rut/', { rut });
      setHiddenEmail(response.data.correo_oculto);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.error || 'Ocurrió un error al enviar el correo. Inténtalo más tarde.');
      } else {
        setErrorMessage('Ocurrió un error inesperado. Revisa tu conexión.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#060f20' }}>

      {/* Orbes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-fade-up">

        {/* Volver */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-sm font-medium mb-8 transition-colors group"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="group-hover:text-white transition-colors">Volver al Login</span>
        </button>

        {/* Cabecera */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Recuperar Contraseña</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Ingresa tu RUT y enviaremos las instrucciones de recuperación a tu correo corporativo.
          </p>
        </div>

        {/* Tarjeta */}
        <div className="rounded-3xl p-8 glass-card">

          {status === 'success' ? (
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">¡Enlace Enviado!</h3>
              <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Se envió un enlace de recuperación al correo:
              </p>
              <p className="font-bold text-white mb-6">{hiddenEmail}</p>
              <p className="text-xs mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Si no lo ves en unos minutos, revisa tu carpeta de Spam.
              </p>
              <button onClick={() => navigate('/login')} className="btn-primary">
                Entendido
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {status === 'error' && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  <AlertCircle size={18} className="shrink-0" />
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  RUT Corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User size={17} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </div>
                  <input
                    type="text"
                    required
                    value={rut}
                    onChange={handleRutChange}
                    placeholder="12.345.678-9"
                    className="input-dark"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'loading' || rut.length < 8}
                className="btn-primary"
              >
                {status === 'loading' ? (
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                ) : (
                  <><Send size={15} /> Enviar Enlace de Recuperación</>
                )}
              </button>

            </form>
          )}

        </div>
      </div>
    </div>
  );
}
