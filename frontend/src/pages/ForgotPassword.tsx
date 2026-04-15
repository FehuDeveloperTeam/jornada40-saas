import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, User, CheckCircle2, AlertCircle } from 'lucide-react';
import client from '../api/client';
import { formatRut } from '../utils/rutUtils';

export default function ForgotPassword() {
  const [rut, setRut] = useState('');
  const [hiddenEmail, setHiddenEmail] = useState(''); // Aquí guardaremos el correo con asteriscos
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
      // Apuntamos a nuestra nueva ruta personalizada en Django
      const response = await client.post('/auth/recuperar-por-rut/', {
        rut: rut
      });
      
      // Atrapamos el correo enmascarado que nos manda el backend
      setHiddenEmail(response.data.correo_oculto);
      setStatus('success');
      
    } catch (error) {
      console.error("Error al solicitar reseteo:", error);
      setStatus('error');
      
      if (axios.isAxiosError(error)) {
        // Mostramos el error exacto que mandó Django (ej: "No tiene correo" o "RUT no existe")
        if (error.response?.data?.error) {
          setErrorMessage(error.response.data.error);
        } else {
          setErrorMessage("Ocurrió un error al enviar el correo. Inténtalo más tarde.");
        }
      } else {
        setErrorMessage("Ocurrió un error inesperado. Revisa tu conexión.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        
        {/* Cabecera */}
        <div className="mb-8">
          <button 
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-6 text-sm font-medium"
          >
            <ArrowLeft size={16} /> Volver al Login
          </button>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Recuperar Contraseña</h1>
          <p className="text-slate-500 text-sm">
            Ingresa tu RUT y enviaremos las instrucciones de recuperación a tu correo corporativo.
          </p>
        </div>

        {/* Estado de Éxito */}
        {status === 'success' ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">¡Enlace Enviado!</h3>
            <p className="text-slate-600 mb-6 text-sm">
              Se envió un enlace de recuperación asociado al correo:<br/>
              <strong className="text-slate-900 text-base block mt-2">{hiddenEmail}</strong>
            </p>
            <p className="text-slate-500 text-xs mb-6">
              Si no lo ves en unos minutos, revisa tu carpeta de Spam.
            </p>
            <button 
              onClick={() => navigate('/login')}
              className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-md"
            >
              Entendido
            </button>
          </div>
        ) : (
          /* Formulario */
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Mensaje de Error */}
            {status === 'error' && (
              <div className="flex items-center gap-3 bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100 animate-shake">
                <AlertCircle size={20} className="shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">RUT Corporativo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={20} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={rut}
                  onChange={handleRutChange}
                  placeholder="12.345.678-9"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all font-medium text-slate-900 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'loading' || rut.length < 8}
              className="w-full py-4 text-white font-bold bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-xl transition-all shadow-md flex justify-center items-center"
            >
              {status === 'loading' ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Enviar Enlace de Recuperación'
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}