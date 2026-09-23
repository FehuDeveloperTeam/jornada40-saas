import { useEffect, useRef, useState } from 'react';

/**
 * Muestra un PDF como hojas de papel, dibujadas con pdf.js. Un <iframe> no
 * sirve en móvil: Android no muestra PDF embebidos e iOS solo la primera
 * página. Avisa con `onLeidoHastaElFinal` cuando el trabajador llegó al final
 * del documento (condición para poder firmarlo).
 */
export function VisorPdf({ datos, onLeidoHastaElFinal }: { datos: ArrayBuffer; onLeidoHastaElFinal: () => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const hojas = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const avisado = useRef(false);
  const avisar = useRef(onLeidoHastaElFinal);
  useEffect(() => { avisar.current = onLeidoHastaElFinal; }, [onLeidoHastaElFinal]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        // Carga diferida: pdf.js pesa y solo se usa en esta página. Build
        // "legacy": la normal exige funciones de JavaScript muy recientes que
        // no tienen muchos teléfonos (Safari o Android de hace un par de años).
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const { default: worker } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const pdf = await pdfjs.getDocument({ data: datos.slice(0) }).promise;
        const destino = hojas.current;
        if (!destino || cancelado) return;
        destino.replaceChildren();
        const ancho = Math.max(280, (contenedor.current?.clientWidth ?? 600) - 24);
        const dpr = window.devicePixelRatio || 1;
        for (let n = 1; n <= pdf.numPages; n++) {
          const pagina = await pdf.getPage(n);
          if (cancelado) return;
          const base = pagina.getViewport({ scale: 1 });
          const vista = pagina.getViewport({ scale: (ancho / base.width) * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = vista.width;
          canvas.height = vista.height;
          canvas.className = 'block w-full h-auto bg-white rounded-[4px] shadow-card';
          canvas.setAttribute('aria-label', `Página ${n} de ${pdf.numPages}`);
          destino.appendChild(canvas);
          await pagina.render({ canvas, viewport: vista }).promise;
        }
        if (!cancelado) setEstado('listo');
      } catch (err) {
        console.error('No se pudo dibujar el PDF', err);
        if (!cancelado) setEstado('error');
      }
    })();
    return () => { cancelado = true; };
  }, [datos]);

  // Al terminar de dibujar: si el documento cabe entero, o si el trabajador
  // ya bajó hasta el final mientras cargaba, cuenta como leído.
  const revisarFinal = () => {
    const c = contenedor.current;
    if (!c || avisado.current) return;
    if (c.scrollTop + c.clientHeight >= c.scrollHeight - 24) { avisado.current = true; avisar.current(); }
  };
  useEffect(() => { if (estado === 'listo') revisarFinal(); }, [estado]);

  const alDesplazar = () => { if (estado === 'listo') revisarFinal(); };

  return (
    <div ref={contenedor} onScroll={alDesplazar} tabIndex={0} aria-label="Documento a firmar"
      className="relative max-h-[62vh] overflow-y-auto rounded-[12px] bg-sunken p-3 outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft">
      <div ref={hojas} className="flex flex-col gap-3" />
      {estado === 'cargando' && <p className="py-10 text-center text-[13px] text-fg-3" role="status">Cargando documento…</p>}
      {estado === 'error' && <p className="py-10 text-center text-[13px] text-danger">No pudimos mostrar el documento. Descárgalo para revisarlo.</p>}
    </div>
  );
}
