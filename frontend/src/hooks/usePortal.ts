import { useQuery } from '@tanstack/react-query';
import { portal } from '../api/portal';

/** Todas las consultas del portal cuelgan de esta clave: al salir se borran juntas. */
export const CLAVE_PORTAL = 'portal';
export const CLAVE_CUENTA = [CLAVE_PORTAL, 'yo'] as const;

export const useCuentaTrabajador = () => useQuery({ queryKey: CLAVE_CUENTA, queryFn: portal.yo, retry: false });
export const useLiquidacionesPortal = () => useQuery({ queryKey: [CLAVE_PORTAL, 'liquidaciones'], queryFn: portal.liquidaciones });
export const useDocumentosPortal = () => useQuery({ queryKey: [CLAVE_PORTAL, 'documentos'], queryFn: portal.documentos });
export const useVacacionesPortal = () => useQuery({ queryKey: [CLAVE_PORTAL, 'vacaciones'], queryFn: portal.vacaciones });
export const useFirmasPortal = () => useQuery({ queryKey: [CLAVE_PORTAL, 'firmas'], queryFn: portal.firmas });
export const useSolicitudesPortal = () => useQuery({ queryKey: [CLAVE_PORTAL, 'solicitudes'], queryFn: portal.solicitudes });
export const useCertificadosPortal = () => useQuery({ queryKey: [CLAVE_PORTAL, 'certificados'], queryFn: portal.certificados });
