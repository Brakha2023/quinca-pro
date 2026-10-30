import { useMemo, useState } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import type { TypeMouvementStock } from '@quinca/shared-types';
import { recapBons } from '../../../core/stock';
import FormField, { controleInlineClass } from '../../components/ui/FormField';
import NoteHistorique from '../../components/ui/NoteHistorique';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useDepots } from '../articles/hooks';
import { BonImprimable, type InfosFiliale } from './EnteteBon';
import { useBonsStock } from './hooks';

const cellule = 'px-3 py-2';

const dateHeure = (iso: string) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

interface Props {
  filialeId: string;
  filiale: InfosFiliale;
  /** Les natures de mouvement de l'onglet : l'historique ne montre que ses bons. */
  types: readonly TypeMouvementStock[];
  /** Ce que la colonne des quantités compte ici (un inventaire compte des écarts). */
  libelleQuantite?: string;
  /** Afficher le signe : un écart d'inventaire se lit « +4 » ou « −4 », pas « 4 ». */
  quantiteSignee?: boolean;
  /** Le fournisseur n'a de sens que sur les entrées. */
  avecFournisseur?: boolean;
  /** Le dépôt d'arrivée n'existe que pour un transfert. */
  avecDestination?: boolean;
  videMessage: string;
}

/**
 * Historique d'un onglet de saisie : les bons déjà enregistrés, un par ligne,
 * réimprimables.
 *
 * Un bon vaut mieux qu'un mouvement : c'est la pièce que le magasinier a
 * signée. Le journal ligne par ligne reste l'onglet « Mouvements », qui lui
 * mélange toutes les natures — y compris les ventes.
 */
export default function HistoriqueBons({ filialeId, filiale, types, libelleQuantite = 'Quantité', quantiteSignee, avecFournisseur, avecDestination, videMessage }: Props) {
  const { depots } = useDepots(filialeId);
  const [depotId, setDepotId] = useState('');
  const [recherche, setRecherche] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [apercu, setApercu] = useState<string | null>(null);

  const filtres = useMemo(
    () => ({ types, depotId: depotId || null, recherche, debut, fin }),
    [types, depotId, recherche, debut, fin],
  );
  const { bons, isLoading } = useBonsStock(filialeId, filtres);
  const recap = recapBons(bons);

  return (
    <div className="space-y-4">
      <NoteHistorique quoi="les bons" />
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <FormField label="Du"><input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={controleInlineClass} data-testid="bons-debut" /></FormField>
        <FormField label="Au"><input type="date" value={fin} min={debut} onChange={(e) => setFin(e.target.value)} className={controleInlineClass} data-testid="bons-fin" /></FormField>
        <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className={controleInlineClass} data-testid="bons-depot">
          <option value="">Tous les dépôts</option>
          {depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </select>
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="N° de bon, article, motif…" className={`${controleInlineClass} w-64`} data-testid="bons-recherche" />
        <span className="ml-auto text-sm text-neutral-600 whitespace-nowrap" data-testid="bons-recap">
          <strong>{recap.nombre}</strong> bon(s) · {recap.lignes} ligne(s){recap.valeur > 0 && <> · valeur <strong className="font-mono">{formaterFcfa(recap.valeur)}</strong></>}
        </span>
      </div>

      <div className="border border-neutral-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
            <tr>
              <th className={`${cellule} text-left`}>Date</th>
              <th className={`${cellule} text-left`}>N° de bon</th>
              <th className={`${cellule} text-left`}>Nature</th>
              <th className={`${cellule} text-left`}>{avecDestination ? 'Dépôts' : 'Dépôt'}</th>
              {avecFournisseur && <th className={`${cellule} text-left`}>Fournisseur</th>}
              <th className={`${cellule} text-left`}>Articles</th>
              <th className={`${cellule} text-right`}>Lignes</th>
              <th className={`${cellule} text-right`}>{libelleQuantite}</th>
              <th className={`${cellule} text-right`}>Valeur</th>
              <th className={`${cellule} text-left`}>Par</th>
              <th className={`${cellule} text-center print:hidden`}>Bon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {bons.map((b) => (
              <tr key={b.reference} className="hover:bg-neutral-50" data-testid={`bon-${b.reference}`}>
                <td className={`${cellule} text-sm text-neutral-600 whitespace-nowrap`}>{dateHeure(b.date)}</td>
                <td className={`${cellule} text-sm font-mono`}>{b.reference}</td>
                <td className={`${cellule} text-sm text-neutral-600`}>{b.libelle}</td>
                <td className={`${cellule} text-sm text-neutral-600`}>{b.depot ?? '—'}{avecDestination && b.depot_destination ? ` → ${b.depot_destination}` : ''}</td>
                {avecFournisseur && <td className={`${cellule} text-sm text-neutral-600`}>{b.fournisseur ?? '—'}</td>}
                <td className={`${cellule} text-sm max-w-xs truncate`} title={b.articles}>{b.articles || '—'}</td>
                <td className={`${cellule} text-sm text-right font-mono`}>{b.nombre_lignes}</td>
                <td className={`${cellule} text-sm text-right font-mono font-semibold whitespace-nowrap ${b.quantite < 0 ? 'text-red-600' : ''}`}>{quantiteSignee && b.quantite > 0 ? `+${b.quantite}` : b.quantite}</td>
                <td className={`${cellule} text-sm text-right font-mono whitespace-nowrap`}>{b.valeur == null ? '—' : formaterFcfa(b.valeur)}</td>
                <td className={`${cellule} text-sm text-neutral-600 whitespace-nowrap`}>{b.utilisateur ?? '—'}</td>
                <td className={`${cellule} text-center print:hidden`}>
                  <button type="button" onClick={() => setApercu(b.reference)} className="p-1.5 rounded text-primary-700 hover:bg-primary-50" title={`Imprimer le bon ${b.reference}`} data-testid={`imprimer-bon-${b.reference}`}>
                    <PrinterIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && bons.length === 0 && <div className="text-center py-12 text-neutral-400">{videMessage}</div>}
      </div>

      {apercu && <BonImprimable filialeId={filialeId} filiale={filiale} reference={apercu} onClose={() => setApercu(null)} />}
    </div>
  );
}
