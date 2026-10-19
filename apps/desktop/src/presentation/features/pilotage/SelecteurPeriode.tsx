import { PERIODES, type Periode } from '../../../core/pilotage';

/**
 * La période, choisie une fois pour tout l'écran.
 *
 * Une seule rangée, au-dessus de tout : chaque tuile et chaque graphique
 * parle de la même tranche de temps. Un filtre par carte ferait un tableau
 * de bord où deux chiffres voisins ne se comparent plus.
 */
export default function SelecteurPeriode({ periode, onChange }: { periode: Periode; onChange: (p: Periode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm" role="group" aria-label="Période">
      {PERIODES.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          aria-pressed={periode === p.id}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            periode === p.id ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
          data-testid={`periode-${p.id}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
