import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      {/* NAVBAR BÁSICO */}
      <nav className="flex justify-between items-center py-6 px-8 max-w-7xl mx-auto w-full">
        <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Jornada<span className="text-blue-600">40</span>
        </div>
        <div className="flex gap-4">
          <Link to="/login" className="px-5 py-2.5 text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors">
            Iniciar Sesión
          </Link>
          <Link to="/register" className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm">
            Crear Cuenta
          </Link>
        </div>
      </nav>

      {/* HERO SECTION (El gancho comercial) */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl space-y-8">
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight">
            Adapta tu empresa a la <br />
            <span className="text-blue-600">Ley de 40 Horas</span> sin estrés
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Automatiza la generación de anexos de contrato, controla los límites de jornada y protege a tu empresa de multas laborales en segundos.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link to="/register" className="px-8 py-4 text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
              Comienza Gratis Hoy
            </Link>
            <Link to="/login" className="px-8 py-4 text-lg font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all">
              Ya tengo una cuenta
            </Link>
          </div>
          
          <p className="text-sm text-gray-400 mt-6">
            ✨ Plan Semilla incluye 1 empresa y hasta 3 trabajadores gratis de por vida.
          </p>
        </div>
      </main>
    </div>
  );
}