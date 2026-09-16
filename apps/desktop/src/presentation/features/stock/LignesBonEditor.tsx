import { TrashIcon } from '@heroicons/react/24/outline';
import type { Article } from '../../../core/articles';
import { inputClass } from '../../components/ui/FormField';
import { formaterFcfa } from '../../hooks/useFormatage';
import ArticlePicker from './ArticlePicker';
import { useStockArticleDepot } from './hooks';

export interface LigneBonUI {
  article: Article;
  quantite: number;
  cout_unitaire: number | '';
}

interface Props {
  filialeId: string;
  /** Dépôt de référence pour afficher le stock disponible (source pour un transfert). */
  depotId: string | null;
  lignes: LigneBonUI[];
  onChange: (lignes: LigneBonUI[]) => void;
  avecCout?: boolean;
  /** Bloque visuellement les quantités supérieures au disponible (sorties). */
  controlerDisponible?: boolean;
}

function CelluleStock({ articleId, depotId, quantiteDemandee, controler }: { articleId: string; depotId: string | null; quantiteDemandee: number; controler: boolean }) {
  const stock = useStockArticleDepot(articleId, depotId);
  const insuffisant = controler && quantiteDemandee > stock.quantite_disponible;
  return (
    <span className={`font-mono text-sm ${insuffisant ? 'text-red-600 font-semibold' : 'text-neutral-600'}`} title={insuffisant ? 'Stock insuffisant' : undefined}>
      {stock.quantite_disponible}
    </span>
  );
}

/** Saisie des lignes d'un bon : ajout par recherche d'article, quantité, coût optionnel. */
export default function LignesBonEditor({ filialeId, depotId, lignes, onChange, avecCout = false, controlerDisponible = false }: Props) {
  const ajouter = (article: Article) => {
    if (lignes.some((l) => l.article.id === article.id)) return;
    onChange([...lignes, { article, quantite: 1, cout_unitaire: avecCout ? article.prix_achat : '' }]);
  };
  const modifier = (i: number, patch: Partial<LigneBonUI>) => onChange(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const supprimer = (i: number) => onChange(lignes.filter((_, j) => j !== i));
  const total = lignes.reduce((s, l) => s + (l.cout_unitaire === '' ? 0 : l.cout_unitaire) * l.quantite, 0);

  return (
    <div className="space-y-3">
      <ArticlePicker filialeId={filialeId} onSelect={ajouter} placeholder="Ajouter un article (code ou désignation)…" />
      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
            <tr>
              <th className="px-3 py-2 text-left">Article</th>
              <th className="px-3 py-2 text-right">Stock dispo</th>
              <th className="px-3 py-2 text-right w-32">Quantité</th>
              {avecCout && <th className="px-3 py-2 text-right w-36">Coût unitaire</th>}
              {avecCout && <th className="px-3 py-2 text-right">Total</th>}
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lignes.map((l, i) => (
              <tr key={l.article.id}>
                <td className="px-3 py-2 text-sm">
                  <span className="font-mono text-primary-700 mr-2">{l.article.code}</span>{l.article.designation}
                  <span className="text-neutral-400 text-xs ml-2">{l.article.unite}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <CelluleStock articleId={l.article.id} depotId={depotId} quantiteDemandee={l.quantite} controler={controlerDisponible} />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min="0" step="any" value={l.quantite} onChange={(e) => modifier(i, { quantite: Number(e.target.value) })} className={`${inputClass} text-right font-mono`} />
                </td>
                {avecCout && (
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="1" value={l.cout_unitaire} onChange={(e) => modifier(i, { cout_unitaire: e.target.value === '' ? '' : Number(e.target.value) })} className={`${inputClass} text-right font-mono`} />
                  </td>
                )}
                {avecCout && <td className="px-3 py-2 text-right font-mono text-sm">{formaterFcfa((l.cout_unitaire === '' ? 0 : l.cout_unitaire) * l.quantite)}</td>}
                <td className="px-3 py-2 text-center">
                  <button type="button" onClick={() => supprimer(i)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Retirer">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr><td colSpan={avecCout ? 6 : 4} className="px-3 py-6 text-center text-sm text-neutral-400">Aucune ligne — recherchez un article ci-dessus.</td></tr>
            )}
          </tbody>
          {avecCout && lignes.length > 0 && (
            <tfoot className="bg-neutral-50 font-semibold text-sm">
              <tr><td colSpan={4} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right font-mono">{formaterFcfa(total)}</td><td /></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
