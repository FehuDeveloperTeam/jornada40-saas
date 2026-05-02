import { useState } from 'react';
import { X, BarChart3, Download, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import client from '../../api/client';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Props {
  anioInicial: number;
  mesInicial: number | null;
  onClose: () => void;
}

type Formato = 'excel' | 'pdf';

export default function ModalExportarConsolidado({ anioInicial, mesInicial, onClose }: Props) {
  const now = new Date();
  const [anio, setAnio] = useState(anioInicial);
  const [mes, setMes] = useState<number>(mesInicial ?? 0);
  const [cargando, setCargando] = useState<Formato | null>(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState<Formato | null>(null);

  const aniosDisponibles = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const descargar = async (formato: Formato) => {
    setCargando(formato);
    setError('');
    setExito(null);
    try {
      const params: Record<string, string | number> = { anio, formato };
      if (mes) params.mes = mes;
      const res = await client.get('/liquidaciones/consolidado/', {
        params,
        responseType: 'blob',
      });
      const ext  = formato === 'pdf' ? 'pdf' : 'xlsx';
      const mime = formato === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([res.data], { type: mime });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const periodoLabel = mes ? `${MESES[mes - 1]}_${anio}` : `Anio_${anio}`;
      a.download = `Consolidado_${periodoLabel}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExito(formato);
    } catch (err: unknown) {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr.response?.status === 404) {
        setError('No hay liquidaciones generadas para el período seleccionado.');
      } else {
        setError('No se pudo generar el archivo. Intenta nuevamente.');
      }
    } finally {
      setCargando(null);
    }
  };

  const onChangePeriodo = () => { setError(''); setExito(null); };

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
              style={{ background: 'rgba(129,140,248,0.15)' }}
            >
              <BarChart3 size={16} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--c-text-1)' }}>Exportar Consolidado</h3>
              <p className="text-xs" style={{ color: 'var(--c-text-3)' }}>
                Todas las empresas del período
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
            Genera el reporte con KPIs, desglose por empresa y evolución mensual.
            Selecciona{' '}
            <strong style={{ color: 'var(--c-text-1)' }}>Año completo</strong>{' '}
            para incluir los 12 meses.
          </p>

          {/* Selectores */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-2"
                style={{ color: 'var(--c-text-3)' }}>
                Mes
              </label>
              <select
                value={mes}
                onChange={e => { setMes(Number(e.target.value)); onChangePeriodo(); }}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-medium appearance-none"
                style={{ background: 'var(--c-bg-input)', border: '1px solid var(--c-border-input)', color: 'var(--c-text-1)', outline: 'none' }}
              >
                <option value={0} style={{ background: 'var(--c-bg-modal)' }}>Año completo</option>
                {MESES.map((nombre, i) => (
                  <option key={i + 1} value={i + 1} style={{ background: 'var(--c-bg-modal)' }}>{nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-2"
                style={{ color: 'var(--c-text-3)' }}>
                Año
              </label>
              <select
                value={anio}
                onChange={e => { setAnio(Number(e.target.value)); onChangePeriodo(); }}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-medium appearance-none"
                style={{ background: 'var(--c-bg-input)', border: '1px solid var(--c-border-input)', color: 'var(--c-text-1)', outline: 'none' }}
              >
                {aniosDisponibles.map(a => (
                  <option key={a} value={a} style={{ background: 'var(--c-bg-modal)' }}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Info */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: 'rgba(129,140,248,0.07)', border: '1px solid rgba(129,140,248,0.2)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#818cf8' }}>
              Contenido del reporte
            </p>
            <ul className="text-xs space-y-1" style={{ color: 'var(--c-text-2)' }}>
              <li>· KPIs: masa salarial, trabajadores, costo empleador, líquido</li>
              <li>· Desglose por empresa con % del total</li>
              <li>· Evolución mensual de los 12 meses del año</li>
              <li>· Costo empleador: SIS + Mutual + AFC empleador</li>
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Éxito */}
          {exito && (
            <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.25)', color: '#6ee7b7' }}>
              <CheckCircle2 size={15} className="shrink-0" />
              <span>Archivo {exito === 'pdf' ? 'PDF' : 'Excel'} descargado correctamente.</span>
            </div>
          )}

          {/* Botones */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => descargar('excel')}
              disabled={cargando !== null}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'linear-gradient(135deg, #166534, #15803d)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(21,128,61,0.35)',
                opacity: cargando !== null ? 0.6 : 1,
                cursor: cargando !== null ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!cargando) e.currentTarget.style.boxShadow = '0 6px 20px rgba(21,128,61,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(21,128,61,0.35)'; }}
            >
              {cargando === 'excel'
                ? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                : <Download size={15} />}
              {cargando === 'excel' ? 'Generando…' : 'Excel (.xlsx)'}
            </button>

            <button
              onClick={() => descargar('pdf')}
              disabled={cargando !== null}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'linear-gradient(135deg, #7c2d12, #c2410c)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(194,65,12,0.35)',
                opacity: cargando !== null ? 0.6 : 1,
                cursor: cargando !== null ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!cargando) e.currentTarget.style.boxShadow = '0 6px 20px rgba(194,65,12,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(194,65,12,0.35)'; }}
            >
              {cargando === 'pdf'
                ? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                : <FileText size={15} />}
              {cargando === 'pdf' ? 'Generando…' : 'PDF (.pdf)'}
            </button>
          </div>

          <p className="text-center text-xs" style={{ color: 'var(--c-text-4)' }}>
            Excel: 2 hojas (Resumen + Evolución) · PDF: carta horizontal
          </p>
        </div>
      </div>
    </div>
  );
}
