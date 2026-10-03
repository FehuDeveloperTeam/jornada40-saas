import { History } from 'lucide-react';
import { Button } from '../j40';

/** Ofrece recuperar lo escrito antes de que la sesión se cerrara (useBorrador). */
export function AvisoBorrador({ en, recuperar, descartar }: { en: number; recuperar: () => void; descartar: () => void }) {
  const cuando = new Date(en).toLocaleString('es-CL', {
    timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  return (
    <div role="status" className="flex items-center gap-3 flex-wrap rounded-[10px] bg-brand-soft px-4 py-3 text-[14px] text-fg">
      <History className="size-5 shrink-0 text-brand" strokeWidth={2} aria-hidden />
      <span className="flex-1 min-w-[200px]">Tienes cambios sin guardar del {cuando}. ¿Quieres recuperarlos?</span>
      <Button tamano="sm" onClick={recuperar}>Recuperar</Button>
      <Button tamano="sm" variante="secundario" onClick={descartar}>Descartar</Button>
    </div>
  );
}
