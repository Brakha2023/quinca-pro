import { useMemo, useState } from 'react';
import { ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/outline';
import Bouton from '../../components/ui/Bouton';
import { formaterFcfa, formaterPourcentage } from '../../../core/commun/prix';
import { consolider, fenetrePilotage, type Periode } from '../../../core/pilotage';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { usePermissions } from '../../auth/usePermissions';
import SelecteurPeriode from '../../features/pilotage/SelecteurPeriode';
import TableauDeBord from '../../features/pilotage/TableauDeBord';
import TableauDeBordDocument from '../../features/pilotage/TableauDeBordDocument';
import { useTableauDeBord } from '../../features/pilotage/hooks';
import { useNotifier } from '../../notifications/useNotifier';

/**
 * Écran de pilotage. **Il suit le périmètre choisi dans le menu** : le groupe
 * entier, ou une filiale.
 *
 * Le sélecteur s'appelle « Périmètre » et propose « Groupe (consolidé) » au
 * milieu des filiales : il doit donc commander cet écran. Tant qu'il ne le
 * faisait pas, changer de filiale ne changeait rien à l'affichage — et le
 * tableau promettait « Ouvrir cette filiale » sans rien ouvrir.
 *
 * Le détail ligne à ligne reste visible dans les deux cas : c'est de là qu'on
 * passe d'une filiale à l'autre, et la ligne de total ramène au groupe.
 */
export default function ConsolidationPage() {
  const { estDirecteur, filialeId, filiale, setFilialeId } = useFilialeCourante();
  const { peut } = usePermissions();
  const notifier = useNotifier();
  const [periode, setPeriode] = useState<Periode>('MOIS');
  const [apercu, setApercu] = useState(false);

  const fenetre = useMemo(() => fenetrePilotage(periode), [periode]);
  const lecture = useTableauDeBord(fenetre, filialeId);
  const { filiales, isLoading } = lecture;
  /** Aucune filiale choisie : on regarde tout ce que le poste reçoit. */
  const vueGroupe = filialeId === null;
  // La ligne de pied porte toujours le groupe, même quand l'écran est réduit à
  // une filiale : c'est ce qui permet de situer la filiale dans l'ensemble.
  const groupe = useMemo(() => consolider(filiales), [filiales]);

  // La page lit des chiffres de toutes les filiales : sans la permission de
  // consolidation, elle n'a rien à montrer.
  if (!peut('consolidation.lire')) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center shadow-sm">
        <p className="text-lg text-neutral-700">La consolidation ne vous est pas ouverte.</p>
        <p className="mt-1 text-sm text-neutral-500">Votre filiale : {filiale?.nom ?? '—'}</p>
      </div>
    );
  }

  const exporter = async () => {
    try {
      const chemin = await exporterExcel('tableau-de-bord', [{
        nom: 'Filiales',
        lignes: filiales.map((f) => ({
          Filiale: f.filiale_nom,
          Code: f.filiale_code,
          'CA TTC': f.ca_ttc,
          'CA HT': f.ca_ht,
          "Coût d'achat": f.cout_ventes,
          Marge: f.marge,
          'Taux de marge (%)': f.taux_marge,
          Dépenses: f.charges,
          'Résultat estimé': f.resultat,
          Ventes: f.ventes,
          'Panier moyen': f.panier_moyen,
          Encaissé: f.encaisse,
          Créances: f.creances,
          Dettes: f.dettes,
          'Valeur du stock': f.valeur_stock,
          Trésorerie: f.tresorerie,
          'Fonds en transit': f.fonds_en_transit,
          'Transferts en transit': f.transferts_en_transit,
          'Fonds à recevoir': f.fonds_a_recevoir,
          'Transferts à recevoir': f.transferts_a_recevoir,
          'Marchandise en route': f.stock_en_transit,
          'Bons de transfert en route': f.transferts_stock_en_transit,
          'Marchandise à recevoir': f.stock_a_recevoir,
          'Bons de transfert à recevoir': f.transferts_stock_a_recevoir,
          'Livraisons en attente': f.livraisons_attente,
          'Livraisons en retard': f.livraisons_retard,
        })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  const cellule = 'px-4 py-3 text-right font-mono text-sm whitespace-nowrap';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {vueGroupe ? 'Vue consolidée — Groupe' : filiale?.nom ?? 'Filiale'}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {vueGroupe ? `${filiales.length} filiale(s)` : 'Périmètre d’une filiale'} · {fenetre.libelle} ·
            {' '}calculé sur ce poste, hors ligne comprise
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SelecteurPeriode periode={periode} onChange={setPeriode} />
          <Bouton onClick={() => setApercu(true)} icone={PrinterIcon} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100" data-testid="imprimer-tableau-de-bord">Imprimer / PDF</Bouton>
          <Bouton onClick={exporter} icone={ArrowDownTrayIcon} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100" data-testid="exporter-tableau-de-bord">Exporter Excel</Bouton>
        </div>
      </div>

      <TableauDeBord fenetre={fenetre} filialeId={filialeId} lecture={lecture} comparerFiliales={vueGroupe} />

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h3 className="text-base font-semibold text-neutral-900">Le détail, filiale par filiale</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {!estDirecteur
              ? 'Lecture seule.'
              : vueGroupe
                ? 'Cliquez une ligne pour n’afficher que cette filiale.'
                : 'Cliquez une autre ligne pour changer de filiale, ou la ligne de total pour revenir au groupe.'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="tableau">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-4 py-3 text-left">Filiale</th>
                <th className="px-4 py-3 text-right">CA TTC</th>
                <th className="px-4 py-3 text-right">Marge</th>
                <th className="px-4 py-3 text-right">Taux</th>
                <th className="px-4 py-3 text-right">Résultat</th>
                <th className="px-4 py-3 text-right">Créances</th>
                <th className="px-4 py-3 text-right">Dettes</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Caisses</th>
                <th className="px-4 py-3 text-center">BL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filiales.map((f) => (
                <tr
                  key={f.filiale_id}
                  onClick={() => estDirecteur && setFilialeId(f.filiale_id)}
                  className={`${estDirecteur ? 'cursor-pointer' : ''} hover:bg-neutral-50 ${filialeId === f.filiale_id ? 'bg-primary-50' : ''}`}
                  title={estDirecteur ? 'Ouvrir cette filiale' : undefined}
                  data-testid={`filiale-${f.filiale_code}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{f.filiale_nom}</p>
                    <p className="text-xs text-neutral-500">{f.filiale_code} · {f.ventes} vente(s)</p>
                  </td>
                  <td className={`${cellule} font-bold text-primary-700`}>{formaterFcfa(f.ca_ttc)}</td>
                  <td className={`${cellule} ${f.marge < 0 ? 'text-red-600' : ''}`}>{formaterFcfa(f.marge)}</td>
                  <td className={`${cellule} text-neutral-500`}>{formaterPourcentage(f.taux_marge)}</td>
                  <td className={`${cellule} ${f.resultat < 0 ? 'text-red-600' : 'text-green-700'}`}>{formaterFcfa(f.resultat)}</td>
                  <td className={`${cellule} text-red-600`}>{formaterFcfa(f.creances)}</td>
                  <td className={`${cellule} text-orange-700`}>{formaterFcfa(f.dettes)}</td>
                  <td className={cellule}>{formaterFcfa(f.valeur_stock)}</td>
                  <td className={`${cellule} text-green-700`}>{formaterFcfa(f.tresorerie)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${f.livraisons_retard > 0 ? 'bg-red-100 text-red-700' : f.livraisons_attente > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                      {f.livraisons_attente}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
              {/* La ligne de total ramène au groupe : sans elle, on ne sait plus
                  comment élargir le périmètre depuis le tableau. */}
              <tr
                data-testid="total-groupe"
                onClick={() => estDirecteur && !vueGroupe && setFilialeId(null)}
                className={estDirecteur && !vueGroupe ? 'cursor-pointer hover:bg-neutral-100' : ''}
                title={estDirecteur && !vueGroupe ? 'Revenir au groupe' : undefined}
              >
                <td className="px-4 py-3 text-sm">Groupe · {groupe.ventes} vente(s)</td>
                <td className={cellule}>{formaterFcfa(groupe.ca_ttc)}</td>
                <td className={cellule}>{formaterFcfa(groupe.marge)}</td>
                <td className={`${cellule} text-neutral-500`}>{formaterPourcentage(groupe.taux_marge)}</td>
                <td className={cellule}>{formaterFcfa(groupe.resultat)}</td>
                <td className={cellule}>{formaterFcfa(groupe.creances)}</td>
                <td className={cellule}>{formaterFcfa(groupe.dettes)}</td>
                <td className={cellule}>{formaterFcfa(groupe.valeur_stock)}</td>
                <td className={cellule}>{formaterFcfa(groupe.tresorerie)}</td>
                <td className="px-4 py-3 text-center text-sm">{groupe.livraisons_attente}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {isLoading && <div className="py-12 text-center text-neutral-400">Chargement…</div>}
      </div>

      {apercu && (
        <TableauDeBordDocument
          fenetre={fenetre}
          filialeId={filialeId}
          lecture={lecture}
          filiales={filiales}
          filiale={vueGroupe ? { nom: 'Cissé & Frères — Groupe' } : { nom: filiale?.nom ?? 'Filiale' }}
          onClose={() => setApercu(false)}
        />
      )}
    </div>
  );
}
