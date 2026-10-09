import { useState } from 'react';
import type { FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../../../src/components/j40/Button';
import { Field, Input } from '../../../src/components/j40/Field';
import { SITIO } from '../configuracion';
import { guardarConexion } from './almacen';
import type { Conexion } from './almacen';
import { mensajeDe, pedir } from './api';
import { Aviso, Marca, Pie } from './comun';
import { abrirPagina } from './pestana';
import type { Vinculacion, Yo } from './tipos';
import { formatearCodigo, nombrePorDefecto } from './util';

/**
 * Primera vez en este computador: se conecta con el código de un solo uso que
 * da Jornada40 → Dirección del Trabajo. A cambio queda un token propio de la
 * extensión (no la sesión del panel).
 */
export function Conectar({ motivo, onConectado }: { motivo: string | null; onConectado: (c: Conexion, yo: Yo) => void }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState(() => nombrePorDefecto());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conectar = async (e: FormEvent) => {
    e.preventDefault();
    const limpio = codigo.replace(/-/g, '');
    if (limpio.length !== 8) {
      setError('El código tiene 8 letras y números. Revísalo en Jornada40.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await pedir<Vinculacion>('/extension/v1/vincular/', {
        metodo: 'POST', cuerpo: { codigo: limpio, nombre: nombre.trim() }, sinToken: true,
      });
      const conexion: Conexion = { token: r.token, cuenta: r.cuenta, persona: r.persona, dispositivo: r.dispositivo };
      await guardarConexion(conexion);
      onConectado(conexion, { cuenta: r.cuenta, persona: r.persona, dispositivo: r.dispositivo, empresas: r.empresas });
    } catch (err) {
      setError(mensajeDe(err));
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2.5">
        <Marca />
        <p className="font-semibold text-[16px]">Jornada40 para Mi DT</p>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-[20px] font-semibold leading-tight">Conecta la extensión con tu cuenta</h1>
        <p className="text-fg-2">Se hace una sola vez en este computador.</p>
      </div>
      {motivo && <Aviso tono="aviso" titulo="La extensión se desconectó">{motivo}</Aviso>}
      <ol className="list-decimal pl-5 flex flex-col gap-2 text-fg-2">
        <li>
          En Jornada40, entra a <b className="text-fg">Dirección del Trabajo</b> y presiona{' '}
          <b className="text-fg">Conectar un navegador</b>.
          <div className="mt-1.5">
            <Button variante="secundario" onClick={() => void abrirPagina(`${SITIO}/app/dt`)}
              iconoFin={<ExternalLink className="size-4" strokeWidth={2} />}>Abrir Jornada40</Button>
          </div>
        </li>
        <li>Escribe aquí el código que aparece.</li>
      </ol>
      <form onSubmit={(e) => void conectar(e)} className="flex flex-col gap-3.5" noValidate>
        <Field etiqueta="Código">
          {(p) => (
            <Input {...p} tamano="lg" mono value={codigo} placeholder="ABCD-EFGH" autoComplete="off" spellCheck={false}
              autoCapitalize="characters" onChange={(e) => setCodigo(formatearCodigo(e.target.value))}
              className="text-center text-[22px] tracking-[0.12em]" />
          )}
        </Field>
        <Field etiqueta="Nombre de este computador" ayuda="Para reconocerlo en Jornada40, en la lista de navegadores conectados.">
          {(p) => <Input {...p} tamano="lg" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />}
        </Field>
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <Button type="submit" tamano="lg" bloque cargando={enviando}>{enviando ? 'Conectando…' : 'Conectar'}</Button>
      </form>
      <Aviso tono="info">
        La extensión nunca ve tu Clave Única: entras a Mi DT como siempre, revisas lo que llena y tú presionas el botón final.
      </Aviso>
      <Pie />
    </div>
  );
}
