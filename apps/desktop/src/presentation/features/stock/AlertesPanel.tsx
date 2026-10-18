import { useMemo, useState } from 'react';
import { ArrowDownTrayIcon, MagnifyingGlassIcon, PrinterIcon } from '@heroicons/react/24/outline';
import {
  NATURES_ALERTE,
  alertesStock,
  etatAlerte,
  montantACommander,
  quantiteACommander,
  recapAlertes,
  type LigneAlerteStock,
  type NatureAlerte,
} from '../../../core/stock';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots, useFamilles } from '../articles/hooks';
import AlertesStockDocument from './AlertesStockDocument';
import type { InfosFiliale } from './EnteteBon';
import { useStocksParArticle } from './hooks';

function Tableau({ titre, lignes, vide, tone }: { titre: string; lignes: LigneAlerteStock[]; vide: string; tone: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-neutral-200 font-semibold ${tone}`}>{titre} <span className="font-normal text-neutral-500">({lignes.length})</span></div>
      {lignes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-400">{vide}</p>
      ) : (
        <table className="w-full">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
            <tr><th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right">Stock</th><th className="px-3 py-2 text-right">Min</th><th className="px-3 py-2 text-right">À commander</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lignes.map((l) => (
              <tr key={l.article_id}>
                <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{l.code}</span>{l.designation}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-semibold">{l.quantite}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-neutral-500">{l.stock_min}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{quantiteACommander(l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Synthèse : valeur du stock, ruptures et stocks faibles, à imprimer ou à exporter. */
export default function AlertesPanel({ filialeId, filiale }: { filialeId: string; filiale: InfosFiliale }) {
  const notifier = useNotifier();
  const { depots } = useDepots(filialeId);
  const { familles } = useFamilles(filialeId, { actives: true });

  const [nature, setNature] = useState<NatureAlerte>('TOUTES');
  const [depotId, setDepotId] = useState('');
  const [familleId, setFamilleId] = useState('');
  const [recherche, setRecherche] = useState('');
  const [apercu, setApercu] = useState(false);

  const filtres = useMemo(() => ({ depotId: depotId || null, familleId: familleId || null, recherche }), [depotId, familleId, recherche]);
  const { lignes } = useStocksParArticle(filialeId, filtres);

  const retenues = useMemo(() => alertesStock(lignes, nature), [lignes, nature]);
  const ruptures = useMemo(() => alertesStock(lignes, 'RUPTURE'), [lignes]);
  const faibles = useMemo(() => alertesStock(lignes, 'FAIBLE'), [lignes]);
  const recap = recapAlertes(retenues, lignes);
  const valeur = lignes.reduce((s, l) => s + l.valeur, 0);

  const depotNom = depots.find((d) => d.id === depotId)?.nom ?? null;
  const familleNom = familles.find((f) => f.id === familleId)?.nom ?? null;

  const exporter = async () => {
    try {
      const chemin = await exporterExcel(`alertes-stock${depotNom ? `-${depotNom}` : ''}`, [{
        nom: 'Alertes',
        lignes: retenues.map((l) => ({
          Code: l.code,
          Désignation: l.designation,
          Famille: l.famille_nom ?? '',
          État: etatAlerte(l) === 'RUPTURE' ? 'Rupture' : 'Sous le minimum',
          Unité: l.unite,
          Stock: l.quantite,
          Mini: l.stock_min,
          Maxi: l.stock_max,
          'À commander': quantiteACommander(l),
          'Prix achat': l.prix_achat,
          'Coût estimé': montantACommander(l),
        })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-xl text-white shadow"><p className="text-sm opacity-90">Valeur du stock (coût moyen)</p><p className="text-2xl font-bold font-mono mt-2">{formaterFcfa(valeur)}</p></div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-xl text-white shadow"><p className="text-sm opacity-90">Articles suivis</p><p className="text-2xl font-bold mt-2">{lignes.length}</p></div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-xl text-white shadow"><p className="text-sm opacity-90">Stock faible</p><p className="text-2xl font-bold mt-2">{faibles.length}</p></div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-xl text-white shadow"><p className="text-sm opacity-90">En rupture</p><p className="text-2xl font-bold mt-2">{ruptures.length}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative flex-1 min-w-[14rem] max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Code ou désignation…" className={`${inputClass} pl-10`} />
        </div>
        <select value={nature} onChange={(e) => setNature(e.target.value as NatureAlerte)} className={controleInlineClass} data-testid="filtre-nature-alerte">
          {NATURES_ALERTE.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
        <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className={controleInlineClass} data-testid="filtre-depot-alerte">
          <option value="">Tous les dépôts</option>
          {depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </select>
        <select value={familleId} onChange={(e) => setFamilleId(e.target.value)} className={controleInlineClass} data-testid="filtre-famille-alerte">
          <option value="">Toutes les familles</option>
          {familles.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>
        <span className="text-sm text-neutral-600" data-testid="compteur-alertes">
          <strong>{retenues.length}</strong> en alerte · à commander <strong className="font-mono">{formaterFcfa(recap.montant_a_commander)}</strong>
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setApercu(true)} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid="imprimer-alertes">
            <PrinterIcon className="w-4 h-4" /> Imprimer / PDF
          </button>
          <button onClick={exporter} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid="exporter-alertes">
            <ArrowDownTrayIcon className="w-4 h-4" /> Exporter Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {nature !== 'FAIBLE' && <Tableau titre="Ruptures" lignes={ruptures} vide="Aucune rupture." tone="text-red-700" />}
        {nature !== 'RUPTURE' && <Tableau titre="Stocks faibles" lignes={faibles} vide="Aucun stock sous le minimum." tone="text-orange-700" />}
      </div>

      {apercu && (
        <AlertesStockDocument
          lignes={retenues}
          suivies={lignes}
          filiale={filiale}
          filtres={{ nature, depotNom, familleNom, recherche }}
          onClose={() => setApercu(false)}
        />
      )}
    </div>
  );
}
