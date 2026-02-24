import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatRut, validateRut } from '../utils/rutUtils'; // Asegúrate de tener este archivo creado

export default function Login() {
  const [rut, setRut] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isValidRut, setIsValidRut] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const navigate = useNavigate();

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    // 🚪 BACKDOOR PARA EL SUPERUSUARIO
    // Si la persona empieza a escribir con letras (ej: 'admin'), no aplicamos el formato de RUT
    if (/[a-zA-Z]/.test(rawValue) && !rawValue.toUpperCase().includes('K')) {
      setRut(rawValue);
      // Solo consideramos "válido" (para encender el botón) si escribe exactamente "admin"
      setIsValidRut(rawValue.toLowerCase() === 'admin');
      setErrorMsg('');
      return;
    }

    // 👤 FLUJO NORMAL PARA CLIENTES (Formateo y validación de RUT)
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
      // Hacemos la petición real a tu backend en Railway
      // Ajusta las llaves del JSON según lo que espere tu backend (ej: username o rut)
      await axios.post(
        'https://jornada40-saas-production.up.railway.app/api/auth/login/',
        { username: rut, password: password }, 
        { withCredentials: true }
      );
      
      // Si el login es exitoso, viajamos al Lobby de Empresas
      navigate('/empresas');
      
    } catch (error) {
      console.error("Error en login:", error);
      setErrorMsg('Credenciales incorrectas o problema de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center p-4 font-sans">
      <div className="bg-white/70 backdrop-blur-xl p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-md border border-white/50 relative overflow-hidden">
        
        {/* Decoración de fondo */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-100 rounded-full blur-3xl opacity-50"></div>

        <div className="text-center mb-10 relative z-10">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Jornada 40h</h1>
          <p className="text-gray-500 font-light">Ingresa a tu espacio de trabajo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">RUT de Usuario</label>
            <input
              type="text"
              value={rut}
              onChange={handleRutChange}
              placeholder="12.345.678-9"
              className={`w-full px-5 py-4 rounded-2xl bg-gray-50 border ${
                rut.length > 5 && !isValidRut ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'
              } focus:bg-white focus:outline-none focus:ring-2 transition-all duration-300`}
            />
            {rut.length > 5 && !isValidRut && (
              <p className="text-red-500 text-xs mt-2 ml-2 font-medium">El RUT ingresado no es válido.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
            />
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center border border-red-100">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValidRut || password.length < 4 || loading}
            className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 transform active:scale-[0.98] shadow-lg flex justify-center items-center"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Ingresar al sistema"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}