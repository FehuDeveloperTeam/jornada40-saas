import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import axios from 'axios';
import { Lock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function ResetPassword() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus('error');
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.length < 8) {
      setStatus('error');
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      await client.post('/auth/password/reset/confirm/', {
        uid, token,
        new_password1: newPassword,
        new_password2: confirmPassword,
      });
      setStatus('success');
    } catch (error) {
      setStatus('error');
      if (axios.isAxiosError(error)) {
        setErrorMsg(
          error.response?.data?.detail ||
          error.response?.data?.token?.[0] ||
          'El enlace es inválido o ha expirado. Solicita uno nuevo.'
        );
      } else {
        setErrorMsg('Ocurrió un error inesperado. Revisa tu conexión a internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!uid || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#060f20' }}>
        <div className="rounded-3xl p-8 text-center glass-card max-w-sm w-full">
          <h2 className="text-xl font-bold text-white mb-2">Enlace Inválido</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>Faltan los parámetros de seguridad en la URL.</p>
          <Link to="/login" className="text-blue-400 text-sm font-semibold hover:text-blue-300">Volver al Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#060f20' }}>

      {/* Orbes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-fade-up">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Nueva <span style={{ color: '#60a5fa' }}>Contraseña</span>
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Ingresa tu nueva contraseña para acceder.
          </p>
        </div>

        <div className="rounded-3xl p-8 glass-card">

          {status === 'success' ? (
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">¡Contraseña Actualizada!</h3>
              <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Tu clave ha sido cambiada con éxito.
              </p>
              <button onClick={() => navigate('/login')} className="btn-primary">
                Ir al Login <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {status === 'error' && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  <AlertCircle size={18} className="shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock size={17} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="input-dark"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock size={17} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    className="input-dark"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="btn-primary"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                ) : (
                  'Guardar Contraseña'
                )}
              </button>

            </form>
          )}

        </div>
      </div>
    </div>
  );
}
