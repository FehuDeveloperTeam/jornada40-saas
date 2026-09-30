import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { CircleCheck, CircleDashed, Send } from 'lucide-react';
import { Button } from '../../j40';
import client from '../../../api/client';
import { usePermisos } from '../../../hooks/usePermisos';
import type { Empleado, EstadoPortal } from '../../../types';
import { fechaCL } from '../../../utils/formato';
import { Seccion } from './comun';

/** Si el trabajador puede entrar a su portal, si ya lo usa y el botón para invitarlo. */
export function PortalTrabajador({ empleado, avisar }: {
  empleado: Empleado; avisar: (texto: string, tipo?: 'ok' | 'error') => void;
}) {
  const queryClient = useQueryClient();
  const { esTitular, puede } = usePermisos();
  const gestionar = puede('TRABAJADORES', true);
  const [enviando, setEnviando] = useState(false);
  const clave = ['portal-trabajador', empleado.id, empleado.email];
  const portal = useQuery({
    queryKey: clave,
    queryFn: async () => (await client.get<EstadoPortal>(`/empleados/${empleado.id}/portal/`)).data,
  });
  const p = portal.data;

  const invitar = async () => {
    setEnviando(true);
    try {
      const { data } = await client.post<EstadoPortal>(`/empleados/${empleado.id}/portal/`);
      queryClient.setQueryData(clave, data);
      avisar(`Invitación enviada a ${data.correo}`);
    } catch (err) {
      avisar((isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || 'No pudimos enviar la invitación.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const activo = p?.estado === 'ACTIVO';
  return (
    <Seccion titulo="Portal del trabajador">
      <div className="px-[18px] py-4 flex flex-col gap-3">
        {!p && <p className="text-[14px] text-fg-3" role="status">Cargando…</p>}
        {p && (
          <>
            <p className="flex gap-2.5 items-start text-[14px] leading-relaxed">
              {activo
                ? <CircleCheck className="size-5 shrink-0 text-ok mt-px" strokeWidth={2} aria-hidden />
                : <CircleDashed className="size-5 shrink-0 text-fg-3 mt-px" strokeWidth={2} aria-hidden />}
              <span>{p.texto}</span>
            </p>
            {p.ultimo_ingreso && <p className="text-[13px] text-fg-2">Último ingreso: {fechaCL(p.ultimo_ingreso)}</p>}
            {p.acceso_hasta && p.estado !== 'SIN_ACCESO' && (
              <p className="text-[13px] text-fg-2">Puede entrar hasta el {fechaCL(p.acceso_hasta)}.</p>
            )}
            {p.estado === 'SIN_CORREO' && gestionar && (
              <Link to={`/app/trabajadores/${empleado.id}?tab=personal`} className="text-[14px] font-medium">Agregar correo</Link>
            )}
            {p.estado === 'SIN_PLAN' && esTitular && <Link to="/app/plan" className="text-[14px] font-medium">Ver planes</Link>}
            {(p.estado === 'NO_INGRESA' || p.estado === 'ACTIVO') && gestionar && (
              <>
                <Button variante={activo ? 'secundario' : 'primario'} onClick={() => void invitar()} cargando={enviando}
                  disabled={!p.puede_invitar} iconoInicio={<Send className="size-4" strokeWidth={2} />} className="self-start">
                  {activo ? 'Reenviar instrucciones' : 'Invitar a su portal'}
                </Button>
                <p className="text-[12.5px] text-fg-3">
                  {p.invitado_en ? `Última invitación: ${fechaCL(p.invitado_en)}. ` : ''}
                  Le llega un correo a {p.correo} con los pasos para entrar con su RUT; no necesita contraseña.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </Seccion>
  );
}
