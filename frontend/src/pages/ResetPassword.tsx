import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client'; // Ajusta esta ruta a donde tengas tu cliente de Axios
import axios from 'axios';

export default function ResetPassword() {
  // Atrapamos el uid y el token que vienen en la URL del correo
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
        uid,
        token,
        new_password1: newPassword,
        new_password2: confirmPassword,
      });
      
      setStatus('success');
    } catch (error) {
      console.error("Error al cambiar contraseña:", error);
      setStatus('error');
      
      // Comprobamos de forma segura si el error viene de nuestro backend (Axios)
      if (axios.isAxiosError(error)) {
        setErrorMsg(
          error.response?.data?.detail || 
          error.response?.data?.token?.[0] || 
          'El enlace es inválido o ha expirado. Solicita uno nuevo.'
        );
      } else {
        // Fallback si el error es de red o algo inesperado
        setErrorMsg('Ocurrió un error inesperado. Revisa tu conexión a internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Si alguien entra a la ruta sin token, le mostramos error
  if (!uid || !token) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Enlace Inválido</h2>
          <p className="text-slate-500 mb-6 text-sm">Faltan los parámetros de seguridad en la URL.</p>
          <Link to="/login" className="text-blue-600 text-sm font-semibold">Volver al Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans flex flex-col relative overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-4 relative z-10 w-full">
        <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className="text-center mb-10 items-center flex flex-col gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
              Nueva <span className="text-blue-600">Clave</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm">
              Ingresa tu nueva contraseña para acceder.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_40px_rgb(0,0,0,0.04)] border border-white">
            
            {status === 'success' ? (
              <div className="text-center animate-in fade-in zoom-in-95">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">¡Contraseña Actualizada!</h3>
                <p className="text-slate-500 text-sm mb-6">Tu clave ha sido cambiada con éxito.</p>
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold text-[15px] hover:bg-slate-800 transition-all shadow-md"
                >
                  Ir al Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {status === 'error' && (
                  <div className="bg-red-50/80 text-red-600 p-3.5 rounded-xl text-sm font-medium text-center border border-red-100 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Nueva Contraseña</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Confirmar Contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold text-[15px] hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 transition-all shadow-md flex justify-center items-center"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Guardar Contraseña'
                  )}
                </button>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}