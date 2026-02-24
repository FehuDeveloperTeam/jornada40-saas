import { useState } from 'react';
import { formatRut, validateRut } from './utils/rutUtils'; // Ajusta la ruta

export default function Login() {
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [isValidRut, setIsValidRut] = useState(false);

  const handleRutChange = (e) => {
    const formateado = formatRut(e.target.value);
    setRut(formateado);
    setIsValidRut(validateRut(formateado));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValidRut) return;
    // Aquí va tu lógica de axios.post a /api/auth/login/
    console.log("Haciendo login con:", rut);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center p-4">
      <div className="bg-white/70 backdrop-blur-xl p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-md border border-white/50">
        
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Jornada 40h</h1>
          <p className="text-gray-500 font-light">Ingresa a tu espacio de trabajo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
              <p className="text-red-500 text-xs mt-2 ml-2">El RUT ingresado no es válido.</p>
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

          <button
            type="submit"
            disabled={!isValidRut || password.length < 4}
            className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 transform active:scale-[0.98]"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}