import { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import client, { registrarConfirmacionIdentidad } from './client';

type Respuesta = { status: number; data?: unknown };

/** Adaptador falso: responde según la URL, en orden, y registra lo pedido. */
function simular(guion: Record<string, Respuesta[]>) {
  const pedidos: string[] = [];
  client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    pedidos.push(url);
    const r = guion[url]?.shift() ?? { status: 200 };
    const respuesta: AxiosResponse = { data: r.data ?? {}, status: r.status, statusText: '', headers: {}, config };
    if (r.status >= 400) throw new AxiosError('error', undefined, config, null, respuesta);
    return respuesta;
  };
  return pedidos;
}

describe('cliente de la API', () => {
  const adaptadorOriginal = client.defaults.adapter;
  const asignar = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('location', { pathname: '/app/trabajadores', search: '?tab=1', assign: asignar });
  });
  afterEach(async () => {
    // Las renovaciones y confirmaciones compartidas se liberan en el siguiente tick.
    await new Promise((listo) => { setTimeout(listo, 5); });
    client.defaults.adapter = adaptadorOriginal;
    registrarConfirmacionIdentidad(null);
    vi.unstubAllGlobals();
    asignar.mockReset();
  });

  it('ante un 401 renueva la sesión una vez y repite la petición', async () => {
    const pedidos = simular({ '/empleados/': [{ status: 401 }, { status: 200, data: ['ok'] }] });
    const r = await client.get('/empleados/');
    expect(r.data).toEqual(['ok']);
    expect(pedidos).toEqual(['/empleados/', '/auth/token/refresh/', '/empleados/']);
  });

  it('las peticiones simultáneas comparten la misma renovación', async () => {
    const pedidos = simular({ '/a/': [{ status: 401 }], '/b/': [{ status: 401 }] });
    await Promise.all([client.get('/a/'), client.get('/b/')]);
    expect(pedidos.filter((p) => p === '/auth/token/refresh/')).toHaveLength(1);
  });

  it('si la renovación falla vuelve al login recordando la página', async () => {
    simular({ '/empleados/': [{ status: 401 }], '/auth/token/refresh/': [{ status: 401 }] });
    await expect(client.get('/empleados/')).rejects.toBeInstanceOf(AxiosError);
    expect(asignar).toHaveBeenCalledWith('/login?volver=%2Fapp%2Ftrabajadores%3Ftab%3D1');
  });

  it('no renueva en las rutas con sesión propia (portal del trabajador)', async () => {
    const pedidos = simular({ '/trabajador/yo/': [{ status: 401 }] });
    await expect(client.get('/trabajador/yo/')).rejects.toBeInstanceOf(AxiosError);
    expect(pedidos).toEqual(['/trabajador/yo/']);
  });

  it('ante un 428 pide confirmar la identidad y repite una sola vez', async () => {
    const confirmar = vi.fn().mockResolvedValue(true);
    registrarConfirmacionIdentidad(confirmar);
    const pedidos = simular({ '/firmas/solicitar/': [{ status: 428, data: { codigo: 'confirmar_identidad' } }] });
    await client.post('/firmas/solicitar/', {});
    expect(confirmar).toHaveBeenCalledOnce();
    expect(pedidos).toEqual(['/firmas/solicitar/', '/firmas/solicitar/']);
  });

  it('si el empleador cancela la confirmación, la petición falla sin repetirse', async () => {
    registrarConfirmacionIdentidad(vi.fn().mockResolvedValue(false));
    const pedidos = simular({ '/firmas/solicitar/': [{ status: 428, data: { codigo: 'confirmar_identidad' } }] });
    await expect(client.post('/firmas/solicitar/', {})).rejects.toMatchObject({ response: { status: 428 } });
    expect(pedidos).toEqual(['/firmas/solicitar/']);
  });

  it('un 428 repetido tras confirmar no vuelve a abrir el modal', async () => {
    const confirmar = vi.fn().mockResolvedValue(true);
    registrarConfirmacionIdentidad(confirmar);
    const falta = { status: 428, data: { codigo: 'confirmar_identidad' } };
    simular({ '/firmas/solicitar/': [falta, falta] });
    await expect(client.post('/firmas/solicitar/', {})).rejects.toMatchObject({ response: { status: 428 } });
    expect(confirmar).toHaveBeenCalledOnce();
  });
});
