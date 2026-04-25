import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import client from '../api/client';
import { formatRut, validateRut } from '../utils/rutUtils';
import { useToast } from '../context/ToastContext';
import { ShieldCheck, Settings, Trash2, RefreshCcw, Plus, LogOut, X, ArrowRight, Building2, PenLine } from 'lucide-react';
import ModalFirmaEmpleador from '../components/ModalFirmaEmpleador';

interface Empresa {
  id: number;
  nombre_legal: string;
  rut: string;
  representante_legal?: string;
  rut_representante?: string;
  alias?: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  sucursal?: string;
  firma_configurada?: boolean;
  firma_firmante_nombre?: string;
  firma_firmante_cargo?: string;
  firma_configurada_en?: string | null;
  activo?: boolean;
}

export default function LobbyEmpresas() {
  const showToast = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [mostrarInactivas, setMostrarInactivas] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [empresaEditando, setEmpresaEditando] = useState<number | null>(null);
  const [empresaFirma, setEmpresaFirma] = useState<Empresa | null>(null);

  const defaultForm = {
    nombre_legal: '', rut: '', representante_legal: '', rut_representante: '',
    alias: '', giro: '', direccion: '', comuna: '', ciudad: '', sucursal: ''
  };
  const [formData, setFormData] = useState<Partial<Empresa>>(defaultForm);
  const [isValidRut, setIsValidRut] = useState<boolean>(true);
  const [isValidRutRep, setIsValidRutRep] = useState<boolean>(true);

  const navigate = useNavigate();

  const fetchEmpresas = useCallback(async (incluirInactivas: boolean) => {
    try {
      const url = incluirInactivas ? '/empresas/?incluir_inactivas=true' : '/empresas/';
      const response = await client.get(url);
      setEmpresas(response.data.results ?? response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response && (error.response.status === 401 || error.response.status === 403)) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchEmpresas(mostrarInactivas);
  }, [mostrarInactivas, fetchEmpresas]);

  const seleccionarEmpresa = (empresaId: number) => {
    localStorage.setItem('empresaActivaId', empresaId.toString());
    navigate('/dashboard');
  };

  const cerrarSesion = () => {
    localStorage.removeItem('empresaActivaId');
    navigate('/login');
  };

  const abrirModalCrear = () => {
    setEmpresaEditando(null);
    setFormData(defaultForm);
    setIsValidRut(false);
    setIsModalOpen(true);
  };

  const abrirModalEditar = (e: React.MouseEvent, empresa: Empresa) => {
    e.stopPropagation();
    setEmpresaEditando(empresa.id);
    setFormData({
      nombre_legal: empresa.nombre_legal, rut: empresa.rut,
      representante_legal: empresa.representante_legal || '',
      rut_representante: empresa.rut_representante || '',
      alias: empresa.alias || '', giro: empresa.giro || '',
      direccion: empresa.direccion || '', comuna: empresa.comuna || '',
      ciudad: empresa.ciudad || '', sucursal: empresa.sucursal || ''
    });
    setIsValidRut(true);
    setIsModalOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'rut') {
      const f = formatRut(value);
      setFormData({ ...formData, rut: f });
      setIsValidRut(validateRut(f));
    } else if (name === 'rut_representante') {
      const f = formatRut(value);
      setFormData({ ...formData, rut_representante: f });
      setIsValidRutRep(validateRut(f));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const guardarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRut || !formData.nombre_legal) return;
    const payload: Record<string, unknown> = { ...formData } as Record<string, unknown>;
    ['alias', 'giro', 'direccion', 'comuna', 'ciudad', 'sucursal'].forEach(f => { if (payload[f] === '') delete payload[f]; });
    try {
      if (empresaEditando) {
        await client.patch(`/empresas/${empresaEditando}/`, payload);
      } else {
        await client.post('/empresas/', payload);
      }
      setIsModalOpen(false);
      setLoading(true);
      fetchEmpresas(mostrarInactivas);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        showToast('No se pudo guardar la empresa. Revisa los datos e inténtalo de nuevo.', 'error');
      } else {
        showToast('Ocurrió un error desconocido al guardar la empresa.', 'error');
      }
    }
  };

  const desactivarEmpresa = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que deseas desactivar esta empresa?')) return;
    try {
      await client.delete(`/empresas/${id}/`);
      await fetchEmpresas(mostrarInactivas);
    } catch {
      showToast('Hubo un error al desactivar la empresa.', 'error');
    }
  };

  const reactivarEmpresa = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que deseas reactivar esta empresa?')) return;
    try {
      await client.post(`/empresas/${id}/reactivar/`, {});
      fetchEmpresas(mostrarInactivas);
    } catch {
      showToast('Hubo un error al reactivar la empresa.', 'error');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#060f20' }}>
      <div className="w-10 h-10 border-2 rounded-full animate-spin"
        style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#2563eb' }} />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#060f20' }}>

      {/* Orbes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 -left-40 w-[700px] h-[700px] rounded-full opacity-12"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
        <div className="absolute -bottom-60 -right-60 w-[600px] h-[600px] rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-3"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* Top bar */}
      <div className="relative z-20 w-full px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

        <div className="flex items-center gap-3">
          <button onClick={cerrarSesion}
            className="flex items-center gap-2 text-sm font-medium transition-colors group"
            style={{ color: 'rgba(255,255,255,0.4)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:-translate-x-0.5"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <LogOut size={14} />
            </div>
            <span className="group-hover:text-white transition-colors">Cerrar Sesión</span>
          </button>
          <img src="/favicon.svg" alt="Jornada40" className="w-7 h-7 rounded-lg hidden sm:block" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
            <ShieldCheck size={14} /> Conexión Segura
          </div>

          <button onClick={() => navigate('/suscripcion')}
            className="p-2.5 rounded-xl transition-all"
            title="Configuración de Cuenta"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
            <Settings size={18} />
          </button>

          <button onClick={() => setMostrarInactivas(!mostrarInactivas)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: mostrarInactivas ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
              border: mostrarInactivas ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: mostrarInactivas ? '#f87171' : 'rgba(255,255,255,0.5)',
            }}>
            <Trash2 size={16} />
            <span className="hidden sm:inline">{mostrarInactivas ? 'Ocultar Papelera' : 'Ver Papelera'}</span>
          </button>

          <button onClick={abrirModalCrear}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 2px 12px rgba(37,99,235,0.35)' }}>
            <Plus size={16} /> Nueva Empresa
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-6 py-12 animate-fade-up">

        <div className="mb-12">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 20px rgba(37,99,235,0.35)' }}>
            <Building2 size={22} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Tus Empresas</h1>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Selecciona un espacio de trabajo para administrar su personal.
          </p>
        </div>

        {/* Grid */}
        {empresas.length === 0 ? (
          <div className="rounded-3xl p-14 text-center glass-card">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Building2 size={28} style={{ color: 'rgba(255,255,255,0.3)' }} />
            </div>
            <p className="text-base font-medium mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
              No tienes empresas {mostrarInactivas ? 'inactivas' : 'registradas aún'}.
            </p>
            {!mostrarInactivas && (
              <button onClick={abrirModalCrear}
                className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                + Crea tu primera empresa aquí
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {empresas.map((empresa) => (
              <div key={empresa.id}
                onClick={() => empresa.activo !== false && seleccionarEmpresa(empresa.id)}
                className="group relative rounded-3xl p-7 transition-all duration-200"
                style={{
                  background: empresa.activo === false ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.04)',
                  border: empresa.activo === false ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(20px)',
                  cursor: empresa.activo === false ? 'default' : 'pointer',
                  opacity: empresa.activo === false ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (empresa.activo !== false) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = 'rgba(37,99,235,0.35)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(37,99,235,0.12)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.borderColor = empresa.activo === false ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.boxShadow = '';
                }}>

                {/* Botones flotantes (activas) */}
                {empresa.activo !== false && (
                  <div className="absolute top-5 right-5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={(e) => { e.stopPropagation(); setEmpresaFirma(empresa); }}
                      className="p-2 rounded-xl transition-all"
                      style={{ background: empresa.firma_configurada ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: empresa.firma_configurada ? '#34d399' : '#fbbf24' }}
                      title={empresa.firma_configurada ? 'Firma configurada — clic para editar' : 'Configurar firma del representante'}>
                      <PenLine size={14} />
                    </button>
                    <button onClick={(e) => abrirModalEditar(e, empresa)}
                      className="p-2 rounded-xl transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
                      title="Editar datos">
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                      </svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); desactivarEmpresa(empresa.id); }}
                      className="p-2 rounded-xl transition-all"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                      title="Desactivar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                {/* Badge inactiva */}
                {empresa.activo === false && (
                  <div className="absolute top-5 right-5">
                    <span className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                      Inactiva
                    </span>
                  </div>
                )}

                {/* Avatar */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white mb-5 transition-all"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 16px rgba(37,99,235,0.3)' }}>
                  {empresa.nombre_legal.charAt(0).toUpperCase()}
                </div>

                <h2 className="text-base font-bold text-white mb-1 truncate">{empresa.nombre_legal}</h2>
                {empresa.alias && (
                  <p className="text-xs font-medium mb-3 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    "{empresa.alias}"
                  </p>
                )}
                <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg mt-1"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
                  {empresa.rut}
                </span>

                {empresa.activo !== false && (
                  <div className="mt-3">
                    {empresa.firma_configurada ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Firma configurada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                        ⚠ Sin firma configurada
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-6 pt-5 flex justify-between items-center"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {empresa.activo === false ? (
                    <button onClick={(e) => { e.stopPropagation(); reactivarEmpresa(empresa.id); }}
                      className="w-full flex justify-center items-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                      <RefreshCcw size={14} /> Restaurar
                    </button>
                  ) : (
                    <>
                      <span className="text-sm font-medium transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Abrir Dashboard
                      </span>
                      <ArrowRight size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setIsModalOpen(false)} />

          <div className="relative rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-up"
            style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>

            <div className="flex justify-between items-start mb-7">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {empresaEditando ? 'Editar Empresa' : 'Registrar Empresa'}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Completa los datos legales para los contratos.
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardarEmpresa} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Razón Social *</label>
                  <input type="text" name="nombre_legal" required value={formData.nombre_legal} onChange={handleChange} className="input-dark" style={{ paddingLeft: '1rem' }} />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>RUT Empresa *</label>
                  <input type="text" name="rut" required value={formData.rut} onChange={handleChange}
                    className={`input-dark ${formData.rut!.length > 5 && !isValidRut ? 'error' : ''}`} style={{ paddingLeft: '1rem' }} />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Representante Legal *</label>
                  <input type="text" name="representante_legal" required value={formData.representante_legal || ''} onChange={handleChange}
                    placeholder="Nombre Completo" className="input-dark" style={{ paddingLeft: '1rem' }} />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>RUT Representante *</label>
                  <input type="text" name="rut_representante" required value={formData.rut_representante || ''} onChange={handleChange}
                    placeholder="12.345.678-9"
                    className={`input-dark ${!isValidRutRep && formData.rut_representante ? 'error' : ''}`} style={{ paddingLeft: '1rem' }} />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Nombre Fantasía</label>
                  <input type="text" name="alias" value={formData.alias} onChange={handleChange} className="input-dark" style={{ paddingLeft: '1rem' }} />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Giro Comercial</label>
                  <input type="text" name="giro" value={formData.giro} onChange={handleChange} className="input-dark" style={{ paddingLeft: '1rem' }} />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Dirección Completa</label>
                  <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className="input-dark" style={{ paddingLeft: '1rem' }} />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Comuna</label>
                  <input type="text" name="comuna" value={formData.comuna} onChange={handleChange} className="input-dark" style={{ paddingLeft: '1rem' }} />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Ciudad</label>
                  <input type="text" name="ciudad" value={formData.ciudad} onChange={handleChange} className="input-dark" style={{ paddingLeft: '1rem' }} />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Sucursal / Casa Matriz</label>
                  <input type="text" name="sucursal" value={formData.sucursal} onChange={handleChange} className="input-dark" style={{ paddingLeft: '1rem' }} />
                </div>
              </div>

              <div className="flex gap-3 pt-5 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button type="submit"
                  disabled={!isValidRut || !isValidRutRep || !formData.nombre_legal || !formData.representante_legal}
                  className="flex-1 btn-primary">
                  {empresaEditando ? 'Guardar Cambios' : 'Registrar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Firma del Representante Legal */}
      {empresaFirma && (
        <ModalFirmaEmpleador
          empresaId={empresaFirma.id}
          empresaNombre={empresaFirma.nombre_legal}
          firmaActual={empresaFirma.firma_configurada ? {
            nombre: empresaFirma.firma_firmante_nombre ?? '',
            cargo: empresaFirma.firma_firmante_cargo ?? '',
            configurada_en: empresaFirma.firma_configurada_en ?? null,
          } : null}
          onClose={() => setEmpresaFirma(null)}
          onGuardada={() => fetchEmpresas(mostrarInactivas)}
        />
      )}
    </div>
  );
}
