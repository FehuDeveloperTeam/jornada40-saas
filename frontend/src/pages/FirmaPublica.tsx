import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import client from '../api/client';
import {
  FileText, Shield, CheckCircle2, AlertCircle,
  Clock, XCircle, Building2, User, Mail, Calendar,
  ArrowRight,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Step =
  | 'loading'
  | 'info'
  | 'solicitar_otp'   // 7.2
  | 'verificar_otp'  // 7.2
  | 'firmar'          // 7.3
  | 'firmado_ok'
  | 'terminal_expirado'
  | 'terminal_cancelado'
  | 'terminal_no_encontrado';

interface InfoData {
  estado: string;
  tipo_documento: string;
  tipo_documento_label: string;
  empresa_nombre: string;
  trabajador_nombre: string;
  email_firmante_enmascarado: string;
  expira_en: string;
  ya_verificado: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Santiago',
    });
  } catch {
    return iso;
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FirmaPublica() {
  const { token } = useParams<{ token: string }>();

  const [step, setStep] = useState<Step>('loading');
  const [info, setInfo] = useState<InfoData | null>(null);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStep('terminal_no_encontrado'); return; }
    cargarInfo();
  }, [token]);

  const cargarInfo = async () => {
    try {
      const res = await client.get(`/firma-publica/${token}/`);
      const data: InfoData = res.data;
      setInfo(data);

      if (data.estado === 'FIRMADO')    { setStep('firmado_ok');            return; }
      if (data.estado === 'EXPIRADO')   { setStep('terminal_expirado');      return; }
      if (data.estado === 'CANCELADO')  { setStep('terminal_cancelado');     return; }
      if (data.estado === 'RECHAZADO')  { setStep('terminal_cancelado');     return; }

      setStep('info');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setStep('terminal_no_encontrado');
      } else {
        setStep('terminal_no_encontrado');
      }
    }
  };

  // ── Fondo y orbes comunes ──────────────────────────────────────────────────
  const PageWrapper = ({ children }: { children: React.ReactNode }) => (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#060f20' }}
    >
      {/* Orbes de fondo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-60 -right-40 w-[700px] h-[700px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />
      </div>

      {/* Barra superior */}
      <div className="absolute top-0 left-0 w-full px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
          >
            <img src="/favicon.svg" alt="Jornada40" className="w-full h-full object-contain p-1" />
          </div>
          <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Jornada<span style={{ color: '#60a5fa' }}>40</span>
          </span>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          <Shield size={11} className="text-emerald-400" />
          Firma Electrónica Simple
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 flex items-center justify-center p-4 pt-20 relative z-10">
        {children}
      </div>

      {/* Pie legal */}
      <div className="relative z-10 text-center py-4 px-6">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Firma Electrónica Simple · Ley N° 19.799 · República de Chile · Jornada40
        </p>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: loading
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#060f20' }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: '3px solid rgba(255,255,255,0.08)',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: terminal — No encontrado
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'terminal_no_encontrado') {
    return (
      <PageWrapper>
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-3xl p-8 text-center glass-card">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <AlertCircle size={32} style={{ color: '#f87171' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Enlace Inválido</h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Este enlace de firma no existe o no es válido. Verifica que hayas copiado
              correctamente la URL recibida en tu correo.
            </p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: terminal — Expirado
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'terminal_expirado') {
    return (
      <PageWrapper>
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-3xl p-8 text-center glass-card">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <Clock size={32} style={{ color: '#fbbf24' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Enlace Expirado</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Este enlace de firma ya no está disponible porque superó el plazo de validez
              de 48 horas. Contacta a tu empleador para que te envíe un nuevo enlace.
            </p>
            {info && (
              <div
                className="rounded-xl px-4 py-3 text-left"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Documento
                </p>
                <p className="text-sm font-semibold text-white">{info.tipo_documento_label}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {info.empresa_nombre}
                </p>
              </div>
            )}
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: terminal — Cancelado / Rechazado
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'terminal_cancelado') {
    return (
      <PageWrapper>
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-3xl p-8 text-center glass-card">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <XCircle size={32} style={{ color: '#f87171' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Solicitud Cancelada</h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Esta solicitud de firma fue cancelada por el empleador. Si crees que es un
              error, comunícate con tu empresa para obtener un nuevo enlace.
            </p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: firmado_ok — Ya firmado
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'firmado_ok') {
    return (
      <PageWrapper>
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-3xl p-8 text-center glass-card">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{
                background: 'rgba(5,150,105,0.15)',
                border: '1px solid rgba(5,150,105,0.3)',
                boxShadow: '0 0 28px rgba(5,150,105,0.2)',
              }}
            >
              <CheckCircle2 size={32} style={{ color: '#34d399' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">¡Documento Firmado!</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
              La firma electrónica simple fue registrada exitosamente. Una copia del
              documento firmado fue enviada a tu correo electrónico.
            </p>
            {info && (
              <div
                className="rounded-xl px-4 py-3 text-left"
                style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(52,211,153,0.6)' }}>
                  Documento firmado
                </p>
                <p className="text-sm font-semibold text-white">{info.tipo_documento_label}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {info.empresa_nombre}
                </p>
              </div>
            )}
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: info — Información del documento + CTA
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'info' && info) {
    return (
      <PageWrapper>
        <div className="w-full max-w-md animate-fade-up space-y-4">

          {/* Encabezado */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(29,78,216,0.15))',
                border: '1px solid rgba(37,99,235,0.35)',
                boxShadow: '0 8px 24px rgba(37,99,235,0.2)',
              }}
            >
              <FileText size={26} style={{ color: '#60a5fa' }} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Solicitud de Firma
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Revisa los datos y continúa para verificar tu identidad
            </p>
          </div>

          {/* Tarjeta documento */}
          <div className="rounded-3xl p-6 glass-card space-y-5">

            {/* Tipo de documento */}
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.25)' }}
              >
                <FileText size={16} style={{ color: '#60a5fa' }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Documento
                </p>
                <p className="text-base font-semibold text-white">{info.tipo_documento_label}</p>
              </div>
            </div>

            <div
              className="h-px"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />

            {/* Empresa */}
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}
              >
                <Building2 size={16} style={{ color: '#a78bfa' }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Empresa
                </p>
                <p className="text-sm font-semibold text-white">{info.empresa_nombre}</p>
              </div>
            </div>

            <div
              className="h-px"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />

            {/* Trabajador */}
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.25)' }}
              >
                <User size={16} style={{ color: '#34d399' }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Trabajador
                </p>
                <p className="text-sm font-semibold text-white">{info.trabajador_nombre}</p>
              </div>
            </div>

            <div
              className="h-px"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />

            {/* Email y expiración */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <Mail size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Código OTP a
                  </p>
                  <p className="text-xs font-semibold" style={{ color: '#93c5fd' }}>
                    {info.email_firmante_enmascarado}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <Calendar size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Válido hasta
                  </p>
                  <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {formatFecha(info.expira_en)}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Aviso legal */}
          <div
            className="rounded-2xl px-4 py-3 flex items-start gap-3"
            style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}
          >
            <Shield size={15} className="shrink-0 mt-0.5" style={{ color: '#60a5fa' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Para firmar, verificaremos tu identidad enviando un código de 6 dígitos
              al correo registrado. Este proceso cumple con la Ley N° 19.799 sobre
              Firma Electrónica Simple.
            </p>
          </div>

          {/* Botón CTA */}
          <button
            className="btn-primary"
            onClick={() => setStep('solicitar_otp')}
          >
            Verificar mi Identidad
            <ArrowRight size={16} />
          </button>

        </div>
      </PageWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEPs: solicitar_otp / verificar_otp / firmar — implementados en 7.2 y 7.3
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      <div className="w-full max-w-md animate-fade-up">
        <div className="rounded-3xl p-8 text-center glass-card">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(29,78,216,0.15))',
              border: '1px solid rgba(37,99,235,0.35)',
            }}
          >
            <Shield size={26} style={{ color: '#60a5fa' }} />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Verificación en curso…</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Esta sección estará disponible en breve.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}
