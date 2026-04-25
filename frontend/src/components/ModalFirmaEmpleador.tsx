import { useState } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';
import client from '../api/client';
import FirmaCanvas from './FirmaCanvas';

type Props = {
  empresaId: number;
  empresaNombre: string;
  firmaActual: { nombre: string; cargo: string; configurada_en: string | null } | null;
  onClose: () => void;
  onGuardada: () => void;
};

const inp: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.625rem',
  padding: '0.625rem 0.75rem',
  color: '#f8fafc',
  fontSize: '0.875rem',
  outline: 'none',
};

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '0.25rem',
};

export default function ModalFirmaEmpleador({ empresaId, empresaNombre, firmaActual, onClose, onGuardada }: Props) {
  const [firmaImagen, setFirmaImagen] = useState<string | null>(null);
  const [nombre, setNombre] = useState(firmaActual?.nombre ?? '');
  const [cargo, setCargo] = useState(firmaActual?.cargo ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const puedeGuardar = firmaImagen && nombre.trim() && cargo.trim();

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError('');
    try {
      await client.patch(`/empresas/${empresaId}/configurar-firma/`, {
        firma_imagen: firmaImagen,
        firma_firmante_nombre: nombre.trim().toUpperCase(),
        firma_firmante_cargo: cargo.trim().toUpperCase(),
      });
      onGuardada();
      onClose();
    } catch {
      setError('No se pudo guardar la firma. Intenta nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-7 py-5 flex justify-between items-start"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
          <div>
            <h3 className="text-lg font-bold text-white">Firma del Representante Legal</h3>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{empresaNombre}</p>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-7 space-y-6 overflow-y-auto">

          {/* Aviso legal */}
          <div className="flex gap-3 p-4 rounded-xl" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#60a5fa' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.9)' }}>
              Esta firma quedará asociada a la empresa y se estampará automáticamente en todos los
              documentos laborales una vez que el trabajador firme. Válida como Firma Electrónica
              Simple bajo <strong className="text-white">Ley 19.799</strong>.
            </p>
          </div>

          {/* Si ya tiene firma configurada */}
          {firmaActual?.configurada_en && (
            <div className="flex gap-2 items-center p-3 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: '#34d399' }} />
              <p className="text-xs" style={{ color: '#6ee7b7' }}>
                Firma configurada el {new Date(firmaActual.configurada_en).toLocaleDateString('es-CL')} — dibujar una nueva la reemplazará.
              </p>
            </div>
          )}

          {/* Datos del firmante */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={lbl}>Nombre del firmante</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: MARÍA GONZÁLEZ SOTO"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Cargo</label>
              <input
                type="text"
                value={cargo}
                onChange={e => setCargo(e.target.value)}
                placeholder="Ej: GERENTE GENERAL"
                style={inp}
              />
            </div>
          </div>

          {/* Canvas */}
          <div>
            <label style={lbl}>Firma (dibuja con el mouse o dedo)</label>
            <FirmaCanvas onChange={setFirmaImagen} height={140} />
          </div>

          {error && (
            <div className="flex gap-2 items-center p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#f87171' }} />
              <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 flex justify-end gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl font-semibold transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!puedeGuardar || guardando}
            className="px-6 py-2 text-sm font-bold text-white rounded-xl transition-all"
            style={{
              background: puedeGuardar && !guardando ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'rgba(255,255,255,0.08)',
              opacity: !puedeGuardar || guardando ? 0.5 : 1,
              cursor: !puedeGuardar || guardando ? 'not-allowed' : 'pointer',
            }}>
            {guardando ? 'Guardando...' : 'Guardar Firma'}
          </button>
        </div>
      </div>
    </div>
  );
}
