import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import client from '../api/client';
import FirmaCanvas from '../components/FirmaCanvas';
import {
  FileText, Shield, CheckCircle2, AlertCircle,
  Clock, XCircle, Building2, User, Mail, Calendar,
  ArrowRight, Send, RotateCcw, KeyRound, Pen,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Step =
  | 'loading'
  | 'info'
  | 'solicitar_otp'
  | 'verificar_otp'
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

  // ── Estado general ──────────────────────────────────────────────────────────
  const [step, setStep]   = useState<Step>('loading');
  const [info, setInfo]   = useState<InfoData | null>(null);

  // ── Estado OTP ──────────────────────────────────────────────────────────────
  const [otpDigits, setOtpDigits]   = useState<string[]>(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError]     = useState('');
  const [cooldown, setCooldown]     = useState(0);         // segundos restantes para reenviar
  const [sesionToken, setSesionToken] = useState('');
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null);
  const [firmaLoading, setFirmaLoading] = useState(false);
  const [firmaError, setFirmaError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Countdown del cooldown ──────────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(s => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

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

      if (data.estado === 'FIRMADO')   { setStep('firmado_ok');           return; }
      if (data.estado === 'EXPIRADO')  { setStep('terminal_expirado');    return; }
      if (data.estado === 'CANCELADO') { setStep('terminal_cancelado');   return; }
      if (data.estado === 'RECHAZADO') { setStep('terminal_cancelado');   return; }

      // Si ya completó OTP en esta sesión del navegador, saltar directo a firmar
      const storedToken = sessionStorage.getItem(`firma_sesion_${token}`);
      if (storedToken) {
        setSesionToken(storedToken);
        setStep('firmar');
        return;
      }

      setStep('info');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setStep('terminal_no_encontrado');
      } else {
        setStep('terminal_no_encontrado');
      }
    }
  };

  // ── Solicitar OTP ──────────────────────────────────────────────────────────
  const solicitarOtp = async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      await client.post(`/firma-publica/${token}/solicitar-otp/`);
      setCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      setStep('verificar_otp');
      // Foco al primer input tras render
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error ?? 'Error al enviar el código.';
        // Extraer segundos del mensaje de rate-limit para arrancar el countdown
        const match = msg.match(/(\d+) segundo/);
        if (match) setCooldown(parseInt(match[1], 10));
        setOtpError(msg);
      } else {
        setOtpError('Error de conexión. Intenta nuevamente.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Verificar OTP ──────────────────────────────────────────────────────────
  const verificarOtp = async () => {
    const codigo = otpDigits.join('');
    if (codigo.length !== 6) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await client.post(`/firma-publica/${token}/verificar-otp/`, { codigo });
      const tkn: string = res.data.sesion_token;
      setSesionToken(tkn);
      sessionStorage.setItem(`firma_sesion_${token}`, tkn);
      setStep('firmar');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setOtpError(err.response?.data?.error ?? 'Código incorrecto.');
      } else {
        setOtpError('Error de conexión. Intenta nuevamente.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Firmar documento ───────────────────────────────────────────────────────
  const firmarDocumento = async () => {
    if (!firmaDataUrl) return;
    setFirmaLoading(true);
    setFirmaError('');
    try {
      await client.post(`/firma-publica/${token}/firmar/`, {
        sesion_token: sesionToken,
        firma_trabajador: firmaDataUrl,
      });
      sessionStorage.removeItem(`firma_sesion_${token}`);
      setStep('firmado_ok');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setFirmaError(err.response?.data?.error ?? 'Error al procesar la firma. Intenta nuevamente.');
      } else {
        setFirmaError('Error de conexión. Intenta nuevamente.');
      }
    } finally {
      setFirmaLoading(false);
    }
  };

  // ── Manejadores de inputs OTP ──────────────────────────────────────────────
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otpDigits];
    next[idx] = val;
    setOtpDigits(next);
    setOtpError('');
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter') verificarOtp();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pegado = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pegado) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pegado.length; i++) next[i] = pegado[i];
    setOtpDigits(next);
    setOtpError('');
    inputRefs.current[Math.min(pegado.length, 5)]?.focus();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Layout compartido
  // ─────────────────────────────────────────────────────────────────────────────
  const PageWrapper = ({ children }: { children: React.ReactNode }) => (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: '#060f20' }}
    >
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

      <div className="flex-1 flex items-center justify-center p-4 pt-20 relative z-10">
        {children}
      </div>

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060f20' }}>
        <div style={{
          width: 48, height: 48,
          border: '3px solid rgba(255,255,255,0.08)',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
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
              Este enlace de firma ya no está disponible porque superó el plazo de validez.
              Contacta a tu empleador para que te envíe un nuevo enlace.
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
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{info.empresa_nombre}</p>
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
              Esta solicitud de firma fue cancelada por el empleador. Comunícate con tu
              empresa para obtener un nuevo enlace si corresponde.
            </p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: firmado_ok
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
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{info.empresa_nombre}</p>
              </div>
            )}
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: info
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'info' && info) {
    return (
      <PageWrapper>
        <div className="w-full max-w-md animate-fade-up space-y-4">

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
            <h1 className="text-2xl font-bold text-white mb-1">Solicitud de Firma</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Revisa los datos y continúa para verificar tu identidad
            </p>
          </div>

          <div className="rounded-3xl p-6 glass-card space-y-5">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.25)' }}
              >
                <FileText size={16} style={{ color: '#60a5fa' }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Documento</p>
                <p className="text-base font-semibold text-white">{info.tipo_documento_label}</p>
              </div>
            </div>

            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}
              >
                <Building2 size={16} style={{ color: '#a78bfa' }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Empresa</p>
                <p className="text-sm font-semibold text-white">{info.empresa_nombre}</p>
              </div>
            </div>

            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.25)' }}
              >
                <User size={16} style={{ color: '#34d399' }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Trabajador</p>
                <p className="text-sm font-semibold text-white">{info.trabajador_nombre}</p>
              </div>
            </div>

            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <Mail size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Código OTP a</p>
                  <p className="text-xs font-semibold" style={{ color: '#93c5fd' }}>{info.email_firmante_enmascarado}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <Calendar size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Válido hasta</p>
                  <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{formatFecha(info.expira_en)}</p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl px-4 py-3 flex items-start gap-3"
            style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}
          >
            <Shield size={15} className="shrink-0 mt-0.5" style={{ color: '#60a5fa' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Para firmar, verificaremos tu identidad enviando un código de 6 dígitos
              al correo registrado. Este proceso cumple con la Ley N° 19.799.
            </p>
          </div>

          <button className="btn-primary" onClick={() => setStep('solicitar_otp')}>
            Verificar mi Identidad <ArrowRight size={16} />
          </button>

        </div>
      </PageWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: solicitar_otp  (7.2)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'solicitar_otp' && info) {
    return (
      <PageWrapper>
        <div className="w-full max-w-md animate-fade-up space-y-4">

          {/* Encabezado */}
          <div className="text-center mb-2">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(29,78,216,0.15))',
                border: '1px solid rgba(37,99,235,0.35)',
                boxShadow: '0 8px 24px rgba(37,99,235,0.2)',
              }}
            >
              <Mail size={26} style={{ color: '#60a5fa' }} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Verificar Identidad</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Enviaremos un código de 6 dígitos a tu correo para confirmar tu identidad
            </p>
          </div>

          {/* Tarjeta destino */}
          <div className="rounded-3xl p-6 glass-card space-y-4">

            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.25)' }}
              >
                <Mail size={18} style={{ color: '#60a5fa' }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Código se enviará a
                </p>
                <p className="text-base font-semibold" style={{ color: '#93c5fd' }}>
                  {info.email_firmante_enmascarado}
                </p>
              </div>
            </div>

            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            <div className="flex items-start gap-2.5">
              <Clock size={14} className="shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                El código es válido por <strong style={{ color: 'rgba(255,255,255,0.6)' }}>10 minutos</strong> y
                solo puede usarse una vez.
              </p>
            </div>

          </div>

          {/* Error */}
          {otpError && (
            <div
              className="flex items-start gap-3 p-3.5 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{otpError}</span>
            </div>
          )}

          {/* Botón enviar */}
          <button
            className="btn-primary"
            onClick={solicitarOtp}
            disabled={otpLoading || cooldown > 0}
          >
            {otpLoading ? (
              <div style={{
                width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
            ) : cooldown > 0 ? (
              <>
                <Clock size={16} />
                Reenviar en {cooldown}s
              </>
            ) : (
              <>
                <Send size={16} />
                Enviar Código al Correo
              </>
            )}
          </button>

          {/* Volver */}
          <button
            className="w-full text-sm font-medium transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onClick={() => { setOtpError(''); setStep('info'); }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          >
            ← Volver
          </button>

        </div>
      </PageWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: verificar_otp  (7.2)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'verificar_otp' && info) {
    const codigoCompleto = otpDigits.join('').length === 6 && otpDigits.every(d => d !== '');

    return (
      <PageWrapper>
        <div className="w-full max-w-md animate-fade-up space-y-4">

          {/* Encabezado */}
          <div className="text-center mb-2">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(29,78,216,0.15))',
                border: '1px solid rgba(37,99,235,0.35)',
                boxShadow: '0 8px 24px rgba(37,99,235,0.2)',
              }}
            >
              <KeyRound size={26} style={{ color: '#60a5fa' }} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Ingresa el Código</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Enviamos un código a{' '}
              <span style={{ color: '#93c5fd' }}>{info.email_firmante_enmascarado}</span>
            </p>
          </div>

          {/* Tarjeta con inputs */}
          <div className="rounded-3xl p-6 glass-card space-y-5">

            {/* 6 cajas OTP */}
            <div className="flex gap-2 justify-center">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  onPaste={handleOtpPaste}
                  disabled={otpLoading}
                  style={{
                    width: 48,
                    height: 56,
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    background: digit ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${digit ? 'rgba(37,99,235,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    outline: 'none',
                    transition: 'all 0.15s ease',
                    caretColor: '#2563eb',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.2)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = digit ? 'rgba(37,99,235,0.5)' : 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              ))}
            </div>

            {/* Separador visual entre grupos 3+3 */}
            <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)', marginTop: -12 }}>
              Ingresa los 6 dígitos del código recibido
            </p>

            {/* Error */}
            {otpError && (
              <div
                className="flex items-start gap-3 p-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{otpError}</span>
              </div>
            )}

            {/* Botón verificar */}
            <button
              className="btn-primary"
              onClick={verificarOtp}
              disabled={!codigoCompleto || otpLoading}
            >
              {otpLoading ? (
                <div style={{
                  width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
              ) : (
                <>
                  <Shield size={16} />
                  Verificar Código
                </>
              )}
            </button>

          </div>

          {/* Reenviar código */}
          <div className="text-center">
            {cooldown > 0 ? (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Puedes solicitar un nuevo código en{' '}
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>{cooldown}s</span>
              </p>
            ) : (
              <button
                className="text-sm font-semibold flex items-center gap-1.5 mx-auto transition-colors"
                style={{ color: '#60a5fa' }}
                onClick={solicitarOtp}
                disabled={otpLoading}
                onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}
              >
                <RotateCcw size={13} />
                Reenviar código
              </button>
            )}
          </div>

        </div>
      </PageWrapper>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: firmar  (7.3)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'firmar' && info) {
    return (
      <PageWrapper>
        <div className="w-full max-w-lg animate-fade-up space-y-4">

          {/* Encabezado */}
          <div className="text-center mb-2">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(29,78,216,0.15))',
                border: '1px solid rgba(37,99,235,0.35)',
                boxShadow: '0 8px 24px rgba(37,99,235,0.2)',
              }}
            >
              <Pen size={26} style={{ color: '#60a5fa' }} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Firmar Documento</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Revisa el documento y dibuja tu firma para completar el proceso
            </p>
          </div>

          {/* Resumen del documento */}
          <div className="rounded-3xl p-5 glass-card space-y-3">

            {/* Badge identidad verificada */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl w-fit"
              style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.25)' }}
            >
              <CheckCircle2 size={13} style={{ color: '#34d399' }} />
              <span className="text-xs font-semibold" style={{ color: '#34d399' }}>
                Identidad verificada
              </span>
            </div>

            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* Datos del doc */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Documento
                </p>
                <p className="text-sm font-semibold text-white">{info.tipo_documento_label}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Empresa
                </p>
                <p className="text-sm font-semibold text-white">{info.empresa_nombre}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Firmante
                </p>
                <p className="text-sm font-semibold text-white">{info.trabajador_nombre}</p>
              </div>
            </div>
          </div>

          {/* Área de firma */}
          <div className="rounded-3xl p-5 glass-card space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Pen size={14} style={{ color: '#60a5fa' }} />
              <p className="text-sm font-bold text-white">Tu Firma</p>
              {firmaDataUrl && (
                <span
                  className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(5,150,105,0.15)', color: '#34d399', border: '1px solid rgba(5,150,105,0.25)' }}
                >
                  ✓ Capturada
                </span>
              )}
            </div>
            <FirmaCanvas
              onChange={url => { setFirmaDataUrl(url); setFirmaError(''); }}
              width={560}
              height={160}
              disabled={firmaLoading}
            />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Usa el mouse o tu dedo (en móvil) para dibujar tu firma en el recuadro blanco.
            </p>
          </div>

          {/* Aviso legal */}
          <div
            className="rounded-2xl px-4 py-3 flex items-start gap-3"
            style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}
          >
            <Shield size={14} className="shrink-0 mt-0.5" style={{ color: '#60a5fa' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Al presionar <strong style={{ color: 'rgba(255,255,255,0.7)' }}>«Firmar Documento»</strong>, declaras
              haber leído y aceptado el contenido del documento indicado. Esta acción
              constituye tu firma electrónica simple conforme a la Ley N° 19.799.
            </p>
          </div>

          {/* Error */}
          {firmaError && (
            <div
              className="flex items-start gap-3 p-3.5 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{firmaError}</span>
            </div>
          )}

          {/* Botón firmar */}
          <button
            className="btn-primary"
            onClick={firmarDocumento}
            disabled={!firmaDataUrl || firmaLoading}
          >
            {firmaLoading ? (
              <div style={{
                width: 20, height: 20,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <>
                <Pen size={16} />
                Firmar Documento
              </>
            )}
          </button>

          {!firmaDataUrl && (
            <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Dibuja tu firma para habilitar el botón
            </p>
          )}

        </div>
      </PageWrapper>
    );
  }

  return null;
}
