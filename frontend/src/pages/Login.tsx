import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import client from '../api/client';
import { formatRut, validateRut } from '../utils/rutUtils';
import { AlertCircle } from 'lucide-react'; // Para el ícono de error

export default function Login() {
  const [rut, setRut] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isValidRut, setIsValidRut] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const navigate = useNavigate();

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    // 👤 FLUJO NORMAL PARA CLIENTES
    const formateado = formatRut(rawValue);
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
      await client.post('/auth/login/', { username: rut, password: password });
      navigate('/empresas');
    } catch (error) {
      console.error("Error en login:", error);
      setLoading(false); 
      
      if (axios.isAxiosError(error)) {
        // Si Django nos responde con un 400 (Bad Request), significa que las credenciales no coinciden
        if (error.response?.status === 400) {
          setErrorMsg("El RUT o la contraseña son incorrectos. Por favor, revisa tus datos.");
        } 
        // Si el usuario fue desactivado o bloqueado
        else if (error.response?.status === 403) {
          setErrorMsg("Esta cuenta no tiene permisos para acceder.");
        }
        else {
          setErrorMsg("Problema de conexión con el servidor. Inténtalo más tarde.");
        }
      } else {
        setErrorMsg("Ocurrió un error inesperado. Revisa tu conexión a internet.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans flex flex-col relative overflow-hidden selection:bg-blue-100 selection:text-blue-900">
      
      {/* ========================================== */}
      {/* 1. TOP BAR: BOTÓN VOLVER Y BADGE SEGURIDAD */}
      {/* ========================================== */}
      <div className="absolute top-0 left-0 w-full p-6 sm:p-8 flex items-center justify-between z-20">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-lg pr-2"
        >
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all group-hover:-translate-x-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </div>
          Volver al Inicio
        </button>
        
        <div className="flex items-center gap-2 text-slate-400 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Conexión Cifrada</span>
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. FONDOS ABSTRACTOS (ESTILO 2026)         */}
      {/* ========================================== */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center z-0 overflow-hidden">
        {/* Malla sutil (Grid) */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wNSkiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] opacity-60"></div>
        {/* Resplandor superior técnico */}
        <div className="absolute -top-40 w-[800px] h-[400px] bg-blue-500/10 blur-[100px] rounded-[100%]"></div>
      </div>

      {/* ========================================== */}
      {/* 3. CONTENEDOR PRINCIPAL DEL LOGIN          */}
      {/* ========================================== */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10 w-full">
        <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* LOGO Y CABECERA */}
          <div className="text-center mb-10 items-center flex flex-col gap-2">
            <img 
              src="/vite.svg" 
              alt="Logo Jornada40" 
              className="h-16 w-auto mb-2 drop-shadow-sm" 
            />
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
              Jornada<span className="text-blue-600">40</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm">
              Accede al portal de administración de recursos humanos.
            </p>
          </div>

          {/* TARJETA DEL FORMULARIO */}
          <div className="bg-white/80 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_40px_rgb(0,0,0,0.04)] border border-white">
            
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* INPUT RUT */}
              <div className="space-y-2 relative">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">RUT Corporativo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={rut}
                    onChange={handleRutChange}
                    placeholder="12.345.678-9"
                    className={`w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-50 border ${
                      rut.length > 5 && !isValidRut ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-slate-900'
                    } focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 text-slate-900 font-medium`}
                  />
                </div>
                {rut.length > 5 && !isValidRut && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" /></svg>
                    El RUT ingresado no es válido.
                  </p>
                )}
              </div>

              {/* INPUT CONTRASEÑA */}
              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all duration-300 text-slate-900 font-medium"
                  />
                </div>
              </div>

              {/* MENSAJE DE ERROR */}
              {errorMsg && (
              <div className="flex items-center gap-3 bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100 animate-shake">
                <AlertCircle size={20} className="shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

              {/* ENLACE DE RECUPERACIÓN DE CONTRASEÑA */}
              <div className="flex justify-end mt-2 mb-6">
                <Link 
                  to="/forgot-password" 
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* BOTÓN SUBMIT */}
              <button
                type="submit"
                disabled={!isValidRut || password.length < 4 || loading}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold text-[15px] hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 shadow-md shadow-slate-900/10 flex justify-center items-center group relative overflow-hidden"
              >
                {/* Efecto de brillo sutil en hover */}
                <div className="absolute inset-0 w-full h-full bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none"></div>
                
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span className="flex items-center gap-2">
                    Iniciar Sesión
                    <svg className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                )}
              </button>
            </form>
          </div>

          <p className="text-center mt-6 text-sm text-slate-400">
            Contratos · Liquidaciones · Documentos laborales
          </p>

          <p className="text-center mt-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Uso Exclusivo Autorizado
          </p>

        </div>
      </div>
    </div>
  );
}