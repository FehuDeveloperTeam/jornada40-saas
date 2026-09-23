import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from './Button';

type Punto = { x: number; y: number };

// Tinta de firma del handoff (--j40-tinta). Se lee del CSS al dibujar; este
// valor solo aplica si la variable no está disponible.
const TINTA_RESPALDO = '#14305C';

interface FirmaPadProps {
  /** Recibe el PNG en base64 (`data:image/png;…`) o `null` si se limpió. */
  onChange: (dataUrl: string | null) => void;
  etiqueta?: string;
  className?: string;
}

/**
 * Área para dibujar una firma con mouse, dedo o lápiz.
 *
 * - Pointer events con `touch-action: none`: en móvil el trazo no hace scroll.
 * - Escalado por devicePixelRatio para que el trazo no se vea borroso.
 * - Los trazos se guardan como puntos y se redibujan al cambiar el tamaño
 *   (girar el teléfono no borra la firma).
 * - El fondo es "papel" en ambos temas y el PNG sale transparente: la firma
 *   se estampa sobre documentos blancos.
 */
export function FirmaPad({ onChange, etiqueta = 'Firma', className }: FirmaPadProps) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const trazos = useRef<Punto[][]>([]);
  const dibujando = useRef(false);
  const [vacia, setVacia] = useState(true);

  const redibujar = useCallback(() => {
    const canvas = lienzo.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const tinta = getComputedStyle(canvas).getPropertyValue('--j40-tinta').trim() || TINTA_RESPALDO;
    ctx.strokeStyle = tinta;
    ctx.fillStyle = tinta;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const trazo of trazos.current) {
      if (trazo.length === 1) {
        // Un toque sin arrastre deja un punto, no nada.
        ctx.beginPath();
        ctx.arc(trazo[0].x, trazo[0].y, 1.2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(trazo[0].x, trazo[0].y);
      for (let i = 1; i < trazo.length - 1; i++) {
        // Curva por puntos medios: suaviza el trazo sin perder la forma.
        const medio = { x: (trazo[i].x + trazo[i + 1].x) / 2, y: (trazo[i].y + trazo[i + 1].y) / 2 };
        ctx.quadraticCurveTo(trazo[i].x, trazo[i].y, medio.x, medio.y);
      }
      const ultimo = trazo[trazo.length - 1];
      ctx.lineTo(ultimo.x, ultimo.y);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    const ajustar = () => {
      // clientWidth excluye el borde punteado: el mapa de bits tiene que
      // medir lo mismo que el área donde cae el puntero.
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      redibujar();
    };
    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(canvas);
    return () => observador.disconnect();
  }, [redibujar]);

  const posicion = (e: React.PointerEvent<HTMLCanvasElement>): Punto => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left - canvas.clientLeft, y: e.clientY - rect.top - canvas.clientTop };
  };

  const alBajar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    trazos.current.push([posicion(e)]);
    redibujar();
  };

  const alMover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    trazos.current[trazos.current.length - 1].push(posicion(e));
    redibujar();
  };

  const alSoltar = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    setVacia(false);
    onChange(lienzo.current?.toDataURL('image/png') ?? null);
  };

  const limpiar = () => {
    trazos.current = [];
    redibujar();
    setVacia(true);
    onChange(null);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-fg-2">{etiqueta}</span>
        <Button variante="fantasma" tamano="sm" onClick={limpiar} disabled={vacia}
          iconoInicio={<Eraser className="size-4" strokeWidth={2} />}>
          Limpiar
        </Button>
      </div>
      <div className="relative">
        <canvas
          ref={lienzo}
          role="img"
          aria-label={vacia ? `${etiqueta}: vacía` : `${etiqueta}: dibujada`}
          className="block w-full h-40 touch-none cursor-crosshair rounded-j40-card border-[1.5px] border-dashed border-line-strong bg-paper"
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        />
        {vacia && (
          // El papel es claro en ambos temas: el texto usa el gris de ayuda del
          // tema claro para no quedar ilegible en oscuro.
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-[#6B7687]">
            Dibuja la firma aquí con el mouse o el dedo
          </span>
        )}
      </div>
    </div>
  );
}
