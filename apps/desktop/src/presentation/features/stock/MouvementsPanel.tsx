import { useState } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { TYPES_MOUVEMENT_STOCK, type TypeMouvementStock } from '@quinca/shared-types';
import Bouton from '../../components/ui/Bouton';
import Pagination from '../../components/ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { LIBELLES_MOUVEMENT, SENS_MOUVEMENT } from '../../../core/stock';
import { controleInlineClass } from '../../components/ui/FormField';
import NoteHistorique from '../../components/ui/NoteHistorique';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useDepots } from '../articles/hooks';
import { useFournisseurs } from '../fournisseurs/hooks';
import { BonImprimable, type InfosFiliale } from './EnteteBon';
import { useMouvements } from './hooks';

function formaterDateHeure(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Journal des mouvements de stock (200 derniers, filtrables). */
export default function MouvementsPanel({ filialeId, filiale }: { filialeId: string; filiale: InfosFiliale }) {
  const { depots } = useDepots(filialeId);
  const [depotId, setDepotId] = useState('');
  const [type, setType] = useState<TypeMouvementStock | ''>('');
  const [reference, setReference] = useState('');
  const [fournisseurId, setFournisseurId] = useState('');
  const [bon, setBon] = useState<string | null>(null);
  const { fournisseurs } = useFournisseurs(filialeId);
  const { mouvements, isLoading } = useMouvements(filialeId, { depotId: depotId || null, type: type || null, reference: reference.trim() || null, fournisseurId: fournisseurId || null });
  // Seule la page courante est rendue ; l'impression et l'export, eux,
  // reçoivent toujours `mouvements` en entier.
  const pages = usePagination(mouvements.length, [depotId, type, reference, fournisseurId]);
  const affiches = pages.trancher(mouvements);

  return (
    <div className="space-y-4">
      <NoteHistorique quoi="les mouvements" />
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className={controleInlineClass}>
          <option value="">Tous les dépôts</option>
          {depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as TypeMouvementStock | '')} className={controleInlineClass}>
          <option value="">Tous les types</option>
          {TYPES_MOUVEMENT_STOCK.map((t) => <option key={t} value={t}>{LIBELLES_MOUVEMENT[t]}</option>)}
        </select>
        <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className={controleInlineClass} data-testid="filtre-fournisseur">
          <option value="">Tous les fournisseurs</option>
          {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.raison_sociale}</option>)}
        </select>
        <input type="search" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence exacte (bon)…" className={`${controleInlineClass} w-64 font-mono`} />
        <span className="ml-auto text-sm text-neutral-600">{mouvements.length} mouvement(s)</span>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tableau">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Article</th>
                <th className="px-3 py-2 text-left">Dépôt</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">Avant → Après</th>
                <th className="px-3 py-2 text-right">Coût unit.</th>
                <th className="px-3 py-2 text-left">Référence</th>
                <th className="px-3 py-2 text-left">Fournisseur</th>
                <th className="px-3 py-2 text-left">Motif</th>
                <th className="px-3 py-2 text-left">Par</th>
                <th className="px-3 py-2 text-center print:hidden">Bon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {affiches.map((m) => {
                const t = (m.type ?? 'AJUSTEMENT') as TypeMouvementStock;
                const delta = (m.quantite_apres ?? 0) - (m.quantite_avant ?? 0);
                const entree = SENS_MOUVEMENT[t] === 1 || delta > 0;
                return (
                  <tr key={m.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(m.created_at)}</td>
                    <td className="px-3 py-2 text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${entree ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{LIBELLES_MOUVEMENT[t]}</span></td>
                    <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{m.article_code}</span>{m.article_designation}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600">{m.depot_nom}</td>
                    <td className={`px-3 py-2 text-sm text-right font-mono font-semibold ${delta < 0 ? 'text-red-600' : 'text-green-700'}`}>{delta > 0 ? `+${delta}` : delta}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-neutral-500">{m.quantite_avant} → {m.quantite_apres}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{m.cout_unitaire != null ? formaterFcfa(m.cout_unitaire) : '—'}</td>
                    <td className="px-3 py-2 text-sm font-mono text-neutral-600">{m.reference ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600" data-testid="mouvement-fournisseur">{m.fournisseur_nom ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600 max-w-xs truncate" title={m.motif ?? ''}>{m.motif ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600">{[m.utilisateur_prenom, m.utilisateur_nom].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-3 py-2 text-center print:hidden">
                      {m.reference && (
                        <Bouton onClick={() => setBon(m.reference)} icone={PrinterIcon} className="p-1.5 hover:bg-primary-50 rounded text-primary-700" title={`Imprimer le bon ${m.reference}`} data-testid={`bon-${m.reference}`}></Bouton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && mouvements.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun mouvement.</div>}
      </div>

      <Pagination etat={pages} nom="mouvement" data-testid="pagination-mouvements" />

      {bon && <BonImprimable filialeId={filialeId} filiale={filiale} reference={bon} onClose={() => setBon(null)} />}
    </div>
  );
}
