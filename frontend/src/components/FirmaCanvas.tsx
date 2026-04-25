import { useRef, useEffect, useState, useCallback } from 'react';

type Props = {
  onChange?: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  disabled?: boolean;
};

export default function FirmaCanvas({ onChange, width = 480, height = 160, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getCtx = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    drawing.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (isEmpty) {
      setIsEmpty(false);
      onChange?.(canvasRef.current!.toDataURL('image/png'));
    }
  };

  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (!isEmpty && canvasRef.current) {
      onChange?.(canvasRef.current.toDataURL('image/png'));
    }
  };

  const limpiar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange?.(null);
  }, [onChange]);

  // Fill white background on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden" style={{ border: '2px solid rgba(255,255,255,0.15)', background: '#fff' }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full block touch-none"
          style={{ cursor: disabled ? 'not-allowed' : 'crosshair', opacity: disabled ? 0.5 : 1 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {isEmpty && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm font-medium select-none" style={{ color: 'rgba(0,0,0,0.2)' }}>
              Dibuja tu firma aquí
            </p>
          </div>
        )}
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={limpiar}
          disabled={isEmpty}
          className="text-xs font-semibold transition-colors disabled:opacity-30"
          style={{ color: '#60a5fa' }}
        >
          Limpiar firma
        </button>
      )}
    </div>
  );
}
