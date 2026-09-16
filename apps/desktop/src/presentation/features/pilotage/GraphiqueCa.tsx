import { formaterFcfa } from '../../hooks/useFormatage';
import type { PointCa } from './hooks';

/** Barres du CA quotidien (sans dépendance graphique : HTML/CSS). */
export default function GraphiqueCa({ points }: { points: PointCa[] }) {
  const max = Math.max(...points.map((p) => p.ca), 1);
  return (
    <div className="flex items-end gap-2 h-48">
      {points.map((p) => (
        <div key={p.jour} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${p.ventes} vente(s) · ${formaterFcfa(p.ca)}`}>
          <span className="text-[10px] font-mono text-neutral-600">{p.ca > 0 ? formaterFcfa(p.ca).replace(' F', '') : ''}</span>
          <div className="w-full bg-primary-500 rounded-t" style={{ height: `${Math.max((p.ca / max) * 100, p.ca > 0 ? 4 : 1)}%` }} />
          <span className="text-[11px] text-neutral-500">{new Date(`${p.jour}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })}</span>
        </div>
      ))}
    </div>
  );
}
