import { LIBELLES_CATEGORIE } from '../../../core/tresorerie';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useMouvementsTresorerie } from './hooks';

const formaterDateHeure = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

interface Props {
  filialeId: string;
  /** Catégories à retenir : celles que la section du module produit. */
  categories: string[];
  titre: string;
  limite?: number;
}

/** Les dernières opérations d'une section, pour vérifier d'un coup d'œil ce qui vient d'être saisi. */
export default function MouvementsRecents({ filialeId, categories, titre, limite = 15 }: Props) {
  const { mouvements } = useMouvementsTresorerie(filialeId, { limite: 300 });
  const retenus = mouvements.filter((m) => categories.includes(m.categorie ?? '')).slice(0, limite);

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      <p className="px-4 py-3 text-sm font-semibold text-neutral-700 border-b border-neutral-200 bg-neutral-50">{titre}</p>
      <div className="overflow-x-auto">
        {/* Le titre reste en place : seul le tableau glisse. */}
        <table className="tableau">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr>
            <th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Caisse</th><th className="px-3 py-2 text-left">Catégorie</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-left">Pièce</th><th className="px-3 py-2 text-left">Par</th><th className="px-3 py-2 text-right">Montant</th>
          </tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {retenus.map((m) => (
              <tr key={m.id} className="hover:bg-neutral-50" data-testid="mouvement-recent">
                <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(m.date_operation)}</td>
                <td className="px-3 py-2 text-sm">{m.caisse_nom}</td>
                <td className="px-3 py-2 text-sm"><span className="px-2 py-0.5 rounded-full text-xs bg-neutral-100">{LIBELLES_CATEGORIE[m.categorie ?? ''] ?? m.categorie}</span></td>
                <td className="px-3 py-2 text-sm text-neutral-600 max-w-md truncate" title={m.description ?? ''}>{m.description ?? '—'}</td>
                <td className="px-3 py-2 text-sm font-mono text-neutral-600">{m.reference ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{[m.utilisateur_prenom, m.utilisateur_nom].filter(Boolean).join(' ') || '—'}</td>
                <td className={`px-3 py-2 text-sm text-right font-mono ${m.type === 'RECETTE' ? 'text-green-700' : 'text-orange-700'}`}>{m.type === 'RECETTE' ? '+' : '−'} {formaterFcfa(m.montant ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {retenus.length === 0 && <div className="text-center py-8 text-neutral-400 text-sm">Aucune opération pour le moment.</div>}
    </div>
  );
}
