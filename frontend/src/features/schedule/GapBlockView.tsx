import { Link, useInRouterContext } from 'react-router-dom';
import type { ReactNode } from 'react';
import { gapLabel } from './gapBlocks';
import type { GapBlock } from './gapBlocks';

/** Enlace a «Huecos»: usa el router cuando existe (sin recargar la página) y un `<a>` normal si no (p. ej. en pruebas aisladas). */
export function GapLink({ className, style, children, label }: { className?: string; style?: React.CSSProperties; children: ReactNode; label: string }) {
  const inRouter = useInRouterContext();
  return inRouter
    ? <Link to="/gaps" className={className} style={style} aria-label={label} title={label}>{children}</Link>
    : <a href="/gaps" className={className} style={style} aria-label={label} title={label}>{children}</a>;
}

const timeLabel = (b: GapBlock) => `${b.startTime}–${b.endTime}`;
export const gapAria = (b: GapBlock) => `${b.occupied && !b.title ? 'Hueco ocupado' : `Tu actividad: ${gapLabel(b)}`}, ${b.startTime} a ${b.endTime}. Ir a Tiempos libres`;

/** Bloque dentro de la cuadrícula del calendario semanal (se distingue de una clase: borde punteado y color verde/gris). */
export function GapCell({ block, style }: { block: GapBlock; style: React.CSSProperties }) {
  const mine = block.title !== null;
  return (
    <GapLink
      label={gapAria(block)} style={style}
      className={`m-px flex flex-col overflow-hidden rounded-md border-2 border-dashed px-1.5 py-1 text-left text-body-sm hover:brightness-95 ${mine ? 'border-[#1E7E34]/60 bg-[#E8F5E9] text-[#14532d]' : 'border-outline bg-surface-container-high text-on-surface-variant'}`}
    >
      <span className="flex items-center gap-1 font-bold leading-tight">
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{mine ? 'event' : 'lock'}</span>
        <span className="truncate">{gapLabel(block)}</span>
      </span>
      <span className="block">{timeLabel(block)}</span>
    </GapLink>
  );
}

/** Tarjeta para las vistas de lista (agenda móvil y «Hoy»). */
export function GapCard({ block }: { block: GapBlock }) {
  const mine = block.title !== null;
  return (
    <GapLink
      label={gapAria(block)}
      className={`flex items-center gap-3 rounded-[10px] border-2 border-dashed p-3 ${mine ? 'border-[#1E7E34]/50 bg-[#E8F5E9] text-[#14532d]' : 'border-outline-variant bg-surface-container-high text-on-surface-variant'}`}
    >
      <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{mine ? 'event' : 'lock'}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-title-sm font-bold">{gapLabel(block)}</span>
        <span className="block text-body-sm">{timeLabel(block)} · {mine ? 'Tu actividad en un hueco' : 'Hueco marcado como ocupado'}</span>
      </span>
    </GapLink>
  );
}
