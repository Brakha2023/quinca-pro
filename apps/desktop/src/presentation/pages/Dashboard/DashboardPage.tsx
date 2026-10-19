import { useMemo, useState } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { formaterFcfa } from '../../../core/commun/prix';
import { fenetrePilotage, type Periode } from '../../../core/pilotage';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import SelecteurPeriode from '../../features/pilotage/SelecteurPeriode';
import TableauDeBord from '../../features/pilotage/TableauDeBord';
import TableauDeBordDocument from '../../features/pilotage/TableauDeBordDocument';
import { useTableauDeBord } from '../../features/pilotage/hooks';
import { useVentes } from '../../features/ventes/hooks';
import { formaterDateHeure } from '../../features/ventes/VenteDetailsModal';

/**
 * Tableau de bord du gérant : sa filiale, et rien d'autre.
 *
 * C'est le même écran que la consolidation, sur un périmètre d'une seule
 * filiale — mêmes chiffres, mêmes calculs, même disposition. S'y ajoutent les
 * deux listes qui n'ont de sens qu'au comptoir : ce qui s'est vendu, et ce qui
 * vient d'être encaissé.
 */
export default function DashboardPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const [periode, setPeriode] = useState<Periode>('MOIS');
  const [apercu, setApercu] = useState(false);

  const fenetre = useMemo(() => fenetrePilotage(periode), [periode]);
  const lecture = useTableauDeBord(fenetre, filialeId);
  const { ventes } = useVentes(filialeId, { jour: new Date().toISOString().slice(0, 10), limite: 8 });

  if (!filialeId) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center text-neutral-400 shadow-sm">
        {estVueConsolidee
          ? <p className="text-lg">Vue consolidée : voir la page Consolidation, ou sélectionnez une filiale.</p>
          : <p>Profil utilisateur en cours de synchronisation…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{filiale?.nom}</h1>
          <p className="mt-1 text-sm text-neutral-500">Tableau de bord · {fenetre.libelle}</p>
        </div>
        <div className="flex items-center gap-2">
          <SelecteurPeriode periode={periode} onChange={setPeriode} />
          <button
            type="button"
            onClick={() => setApercu(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            data-testid="imprimer-tableau-de-bord"
          >
            <PrinterIcon className="h-4 w-4" /> Imprimer / PDF
          </button>
        </div>
      </div>

      <TableauDeBord fenetre={fenetre} filialeId={filialeId} lecture={lecture} />

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h3 className="text-base font-semibold text-neutral-800">Dernières ventes du jour</h3>
        </div>
        {ventes.length === 0 ? (
          <p className="px-6 py-8 text-sm text-neutral-400">Aucune vente aujourd'hui.</p>
        ) : (
          <table className="w-full">
            <tbody className="divide-y divide-neutral-100">
              {ventes.map((v) => (
                <tr key={v.id} className={v.statut === 'ANNULEE' ? 'opacity-50' : ''}>
                  <td className="px-6 py-3 text-sm text-neutral-600">{formaterDateHeure(v.date_vente)}</td>
                  <td className="px-6 py-3 font-mono text-sm text-primary-700">{v.numero}</td>
                  <td className="px-6 py-3 text-sm">{v.client_nom ?? 'Comptoir'}</td>
                  <td className="px-6 py-3 text-sm text-neutral-600">{[v.utilisateur_prenom, v.utilisateur_nom].filter(Boolean).join(' ')}</td>
                  <td className="px-6 py-3 text-right font-mono text-sm font-semibold">{formaterFcfa(v.total_ttc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {apercu && (
        <TableauDeBordDocument
          fenetre={fenetre}
          filialeId={filialeId}
          lecture={lecture}
          filiales={lecture.filiales.filter((f) => f.filiale_id === filialeId)}
          filiale={{ nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone }}
          onClose={() => setApercu(false)}
        />
      )}
    </div>
  );
}
