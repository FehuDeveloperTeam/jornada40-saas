import { useState } from 'react';
import { X, Download, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import client from '../../api/client';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Props {
  empresaId: number | string;
  empresaNombre: string;
  onClose: () => void;
}

export default function ModalExportarPrevired({ empresaId, empresaNombre, onClose }: Props) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const aniosDisponibles = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const descargar = async () => {
    setCargando(true);
    setError('');
    setExito(false);
    try {
      const res = await client.get('/liquidaciones/exportar_previred/', {
        params: { mes, anio, empresa: empresaId },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Previred_${MESES[mes - 1]}_${anio}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExito(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr.response?.status === 404) {
        setError('No hay liquidaciones generadas para el período seleccionado. Genera las liquidaciones del mes primero.');
      } else {
        setError('No se pudo generar el archivo. Intenta nuevamente.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'var(--c-overlay)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--c-bg-modal)', border: '1px solid var(--c-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-7 py-5 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg-card-2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(37,99,235,0.15)' }}
            >
              <FileText size={16} style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--c-text-1)' }}>Exportar a Previred</h3>
              <p className="text-xs truncate max-w-[220px]" style={{ color: 'var(--c-text-3)' }}>
                {empresaNombre}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--c-text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-text-1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-text-3)')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-7 space-y-5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-text-2)' }}>
            Genera el archivo TXT en formato <strong style={{ color: 'var(--c-text-1)' }}>DPS V82</strong> compatible
            con Previred con todas las liquidaciones del período indicado.
          </p>

          {/* Selectores mes/año */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="text-xs font-bold uppercase tracking-wider block mb-2"
                style={{ color: 'var(--c-text-3)' }}
              >
                Mes
              </label>
              <select
                value={mes}
                onChange={e => { setMes(Number(e.target.value)); setExito(false); setError(''); }}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-medium appearance-none"
                style={{ background: 'var(--c-bg-input)', border: '1px solid var(--c-border-input)', color: 'var(--c-text-1)', outline: 'none' }}
              >
                {MESES.map((nombre, i) => (
                  <option key={i + 1} value={i + 1} style={{ background: 'var(--c-bg-modal)' }}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="text-xs font-bold uppercase tracking-wider block mb-2"
                style={{ color: 'var(--c-text-3)' }}
              >
                Año
              </label>
              <select
                value={anio}
                onChange={e => { setAnio(Number(e.target.value)); setExito(false); setError(''); }}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-medium appearance-none"
                style={{ background: 'var(--c-bg-input)', border: '1px solid var(--c-border-input)', color: 'var(--c-text-1)', outline: 'none' }}
              >
                {aniosDisponibles.map(a => (
                  <option key={a} value={a} style={{ background: 'var(--c-bg-modal)' }}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Info box campos incluidos */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.18)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#60a5fa' }}>
              Campos incluidos · V82 · 105 campos por fila
            </p>
            <ul className="text-xs space-y-1" style={{ color: 'var(--c-text-2)' }}>
              <li>· Identificación: RUT, nombre, sexo, fecha nac., nacionalidad</li>
              <li>· AFP: código, renta imponible, cotización obligatoria, SIS 1.49%</li>
              <li>· Salud: FONASA / ISAPRE, cotización, UF plan</li>
              <li>· Mutual AT/EP: cotización empleador 0.93%</li>
              <li>· Cesantía AFC: trabajador 0.6%, empleador 2.4% / 3.0%</li>
              <li>· Reforma 2025: tipo jornada (ley 40h), expectativa de vida 0.9%</li>
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Éxito */}
          {exito && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.25)', color: '#6ee7b7' }}
            >
              <CheckCircle2 size={15} className="shrink-0" />
              <span>Archivo descargado correctamente. Súbelo en <strong>app.previred.com</strong>.</span>
            </div>
          )}

          {/* Botón descarga */}
          <button
            onClick={descargar}
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
              opacity: cargando ? 0.6 : 1,
              cursor: cargando ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!cargando) e.currentTarget.style.boxShadow = '0 6px 24px rgba(37,99,235,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.35)'; }}
          >
            {cargando ? (
              <div style={{
                width: 18, height: 18,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <Download size={16} />
            )}
            {cargando ? 'Generando archivo…' : `Descargar TXT · ${MESES[mes - 1]} ${anio}`}
          </button>

          <p className="text-center text-xs" style={{ color: 'var(--c-text-4)' }}>
            Separado por punto y coma · Codificación UTF-8 · Un trabajador por línea
          </p>
        </div>
      </div>
    </div>
  );
}
