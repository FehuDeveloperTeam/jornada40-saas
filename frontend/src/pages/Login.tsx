import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import client from '../api/client';
import { formatRut, validateRut } from '../utils/rutUtils';
import { AlertCircle, Lock, User, ArrowRight, ChevronLeft } from 'lucide-react';

export default function Login() {
  const [rut, setRut] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isValidRut, setIsValidRut] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const navigate = useNavigate();

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formateado = formatRut(e.target.value);
    setRut(formateado);
    setIsValidRut(validateRut(formateado));
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValidRut || password.length < 4) return;
    setLoading(true);
    setErrorMsg('');

    try {
      await client.post('/auth/login/', { username: rut, password });
      navigate('/empresas');
    } catch (error) {
      setLoading(false);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          setErrorMsg('El RUT o la contraseña son incorrectos.');
        } else if (error.response?.status === 403) {
          setErrorMsg('Esta cuenta no tiene permisos para acceder.');
        } else {
          setErrorMsg('Problema de conexión con el servidor. Inténtalo más tarde.');
        }
      } else {
        setErrorMsg('Ocurrió un error inesperado. Revisa tu conexión a internet.');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#060f20' }}>

      {/* Orbes de luz de fondo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
        <div className="absolute -bottom-60 -right-40 w-[700px] h-[700px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] opacity-5"
          style={{ background: 'radial-gradient(ellipse, #60a5fa 0%, transparent 60%)' }} />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 w-full p-6 flex items-center justify-between z-20">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm font-medium transition-colors group"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:-translate-x-0.5"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <ChevronLeft size={15} />
          </div>
          <span className="group-hover:text-white transition-colors">Volver al Inicio</span>
        </button>

        <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
          <Lock size={12} className="text-emerald-400" />
          Conexión Cifrada
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-[420px] animate-fade-up">

          {/* Logo y cabecera */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 animate-float overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 8px 32px rgba(37,99,235,0.4)' }}>
              <img src="/favicon.svg" alt="Jornada40" className="w-full h-full object-contain p-1" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Jornada<span style={{ color: '#60a5fa' }}>40</span>
            </h1>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Accede al portal de administración laboral
            </p>
          </div>

          {/* Tarjeta */}
          <div className="rounded-3xl p-8 glass-card">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* RUT */}
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
                    value={rut}
                    onChange={handleRutChange}
                    placeholder="12.345.678-9"
                    className={`input-dark ${rut.length > 5 && !isValidRut ? 'error' : ''}`}
                  />
                </div>
                {rut.length > 5 && !isValidRut && (
                  <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#f87171' }}>
                    <AlertCircle size={12} /> RUT inválido
                  </p>
                )}
              </div>

              {/* Contraseña */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock size={17} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-dark"
                  />
                </div>
              </div>

              {/* Error */}
              {errorMsg && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  <AlertCircle size={18} className="shrink-0" />
                  {errorMsg}
                </div>
              )}

              {/* Olvidé contraseña */}
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-xs font-semibold transition-colors hover:text-blue-400"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* Botón */}
              <button
                type="submit"
                disabled={!isValidRut || password.length < 4 || loading}
                className="btn-primary"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                ) : (
                  <>Iniciar Sesión <ArrowRight size={16} /></>
                )}
              </button>

            </form>
          </div>

          {/* Registro */}
          <p className="text-center mt-6 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            ¿Sin cuenta?{' '}
            <Link to="/register" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Regístrate gratis
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
