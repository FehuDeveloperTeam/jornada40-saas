import { useState } from 'react';
import {
  X, FileText, Building2, User, Mail, Clock,
  CheckCircle2, XCircle, AlertCircle, Shield,
  Download, Calendar, Wifi, Hash,
} from 'lucide-react';
import client from '../api/client';
import type { SolicitudFirma } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  CONTRATO:       'Contrato Laboral',
  ANEXO_40H:      'Anexo Ley 40 Horas',
  AMONESTACION:   'Carta de Amonestación',
  DESPIDO:        'Carta de Despido',
  CONSTANCIA:     'Constancia Laboral',
  ANEXO_CONTRATO: 'Anexo de Contrato',
};

function formatFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Santiago',
  });
}

type EstadoKey = SolicitudFirma['estado'];

const ESTADO_CONFIG: Record<EstadoKey, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  PENDIENTE: {
    label: 'Pendiente',
    color: '#fbbf24',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    icon: <Clock size={14} />,
  },
  FIRMADO: {
    label: 'Firmado',
    color: '#34d399',
    bg: 'rgba(5,150,105,0.12)',
    border: 'rgba(5,150,105,0.3)',
    icon: <CheckCircle2 size={14} />,
  },
  RECHAZADO: {
    label: 'Rechazado',
    color: '#f87171',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    icon: <XCircle size={14} />,
  },
  EXPIRADO: {
    label: 'Expirado',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.1)',
    border: 'rgba(148,163,184,0.2)',
    icon: <Clock size={14} />,
  },
  CANCELADO: {
    label: 'Cancelado',
    color: '#f87171',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    icon: <XCircle size={14} />,
  },
};

// ─── Filas de datos ────────────────────────────────────────────────────────────

function Fila({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {label}
        </p>
        <p className="text-sm font-medium text-white break-all">{value}</p>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  solicitud: SolicitudFirma;
  onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ModalDetalleFirma({ solicitud, onClose }: Props) {
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState('');

  const cfg = ESTADO_CONFIG[solicitud.estado];

  const descargarPdf = async () => {
    setDescargando(true);
    setErrorDescarga('');
    try {
      const res = await client.post(`/firmas/${solicitud.id}/descargar/`);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch {
      setErrorDescarga('No se pudo generar el enlace de descarga. Intenta nuevamente.');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="px-7 py-5 flex items-start justify-between shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
        >
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Detalle de Firma</h3>
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
            >
              {cfg.icon}
              {cfg.label}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Cuerpo ─────────────────────────────────────────────────────── */}
        <div className="p-7 space-y-6 overflow-y-auto">

          {/* Datos del documento */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Documento
            </p>
            <div
              className="rounded-2xl p-4 space-y-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Fila icon={<FileText size={15} />}  label="Tipo"      value={TIPO_LABELS[solicitud.tipo_documento] ?? solicitud.tipo_documento} />
              <Fila icon={<Building2 size={15} />} label="Empresa"   value={solicitud.empresa_nombre} />
              <Fila icon={<User size={15} />}      label="Trabajador" value={solicitud.empleado_nombre} />
              <Fila icon={<Mail size={15} />}      label="Email"     value={solicitud.email_firmante} />
            </div>
          </div>

          {/* Fechas */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Fechas
            </p>
            <div
              className="rounded-2xl p-4 space-y-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Fila icon={<Calendar size={15} />} label="Enviado"       value={formatFecha(solicitud.enviado_en)} />
              <Fila icon={<Calendar size={15} />} label="Válido hasta"  value={formatFecha(solicitud.expira_en)} />
              {solicitud.firmado_en && (
                <Fila icon={<CheckCircle2 size={15} />} label="Firmado el" value={formatFecha(solicitud.firmado_en)} />
              )}
            </div>
          </div>

          {/* Verificación — solo si está FIRMADO */}
          {solicitud.estado === 'FIRMADO' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield size={13} style={{ color: '#60a5fa' }} />
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Certificado de Verificación
                </p>
              </div>
              <div
                className="rounded-2xl p-4 space-y-4"
                style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)' }}
              >
                <Fila icon={<Hash size={15} />} label="Token UUID"   value={solicitud.token} />
                <Fila icon={<Wifi size={15} />} label="IP firmante"  value={solicitud.ip_firmante ?? 'No registrada'} />
                <Fila icon={<Mail size={15} />} label="Email verificado" value={solicitud.email_firmante} />
                <Fila icon={<Clock size={15} />} label="Timestamp UTC"
                  value={solicitud.firmado_en ? new Date(solicitud.firmado_en).toISOString() : '—'} />
              </div>

              {/* Error descarga */}
              {errorDescarga && (
                <div
                  className="flex items-start gap-2 p-3 rounded-xl mt-3 text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
                >
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{errorDescarga}</span>
                </div>
              )}

              {/* Botón descargar */}
              <button
                onClick={descargarPdf}
                disabled={descargando}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
                  opacity: descargando ? 0.6 : 1,
                  cursor: descargando ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => { if (!descargando) e.currentTarget.style.boxShadow = '0 6px 24px rgba(37,99,235,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.35)'; }}
              >
                {descargando ? (
                  <div style={{
                    width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  }} />
                ) : (
                  <Download size={16} />
                )}
                {descargando ? 'Generando enlace…' : 'Descargar PDF Firmado'}
              </button>

              <p className="text-center text-xs mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                El enlace expira en 5 minutos · Se abrirá en una nueva pestaña
              </p>
            </div>
          )}

          {/* Aviso legal */}
          <div
            className="flex items-start gap-2.5 p-3.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Shield size={13} className="shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Firma Electrónica Simple conforme a la Ley N° 19.799 sobre Documentos
              Electrónicos y Servicios de Certificación de la República de Chile.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
