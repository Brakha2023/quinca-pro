import { useMemo, useState } from 'react';
import { ArrowDownTrayIcon, MagnifyingGlassIcon, PrinterIcon } from '@heroicons/react/24/outline';
import {
  NATURES_ALERTE,
  SEUILS_DORMANCE,
  SEUIL_DORMANCE_DEFAUT,
  alertesStock,
  etatAlerte,
  montantACommander,
  quantiteACommander,
  recapAlertes,
  recapRotation,
  type LigneAlerteStock,
  type LigneRotation,
  type NatureAlerte,
} from '../../../core/stock';
import Pagination from '../../components/ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots, useFamilles } from '../articles/hooks';
import AlertesStockDocument from './AlertesStockDocument';
import RotationStockDocument from './RotationStockDocument';
import type { InfosFiliale } from './EnteteBon';
import { useRotationStock, useStocksParArticle } from './hooks';

function Tableau({ titre, lignes, vide, tone }: { titre: string; lignes: LigneAlerteStock[]; vide: string; tone: string }) {
  // Ruptures et stocks faibles ont chacun leur pagination : ce sont deux
  // listes, on en parcourt une sans perdre sa place dans l'autre.
  const pages = usePagination(lignes.length, [titre]);
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-neutral-200 font-semibold ${tone}`}>{titre} <span className="font-normal text-neutral-500">({lignes.length})</span></div>
      {lignes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-400">{vide}</p>
      ) : (
        <div className="overflow-x-auto">
          {/* Le titre reste en place : seul le tableau glisse. */}
          <table className="tableau">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr><th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right">Stock</th><th className="px-3 py-2 text-right">Min</th><th className="px-3 py-2 text-right">À commander</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pages.trancher(lignes).map((l) => (
                <tr key={l.article_id}>
                  <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{l.code}</span>{l.designation}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono font-semibold">{l.quantite}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-500">{l.stock_min}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{quantiteACommander(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lignes.length > 0 && (
        <div className="px-4 pb-3">
          <Pagination etat={pages} nom="article" data-testid={`pagination-${titre.toLowerCase().replace(/\s+/g, '-')}`} />
        </div>
      )}
    </div>
  );
}

const jourDe = (l: LigneRotation) => (l.derniere_sortie ? `il y a ${l.jours} j` : 'jamais vu sortir');

/**
 * Un côté de la rotation : ce qui dort, ou ce qui tourne.
 *
 * La valeur figure en face de chaque ligne, et non la seule quantité : devant
 * un rayon, c'est la somme immobilisée qui décide de brader ou d'attendre.
 */
function TableauRotation({ titre, lignes, vide, tone, colonne, testid }: { titre: string; lignes: LigneRotation[]; vide: string; tone: string; colonne: string; testid: string }) {
  const total = lignes.reduce((s, l) => s + l.valeur, 0);
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-neutral-200 font-semibold flex items-baseline gap-2 ${tone}`}>
        {titre} <span className="font-normal text-neutral-500">({lignes.length})</span>
        <span className="ml-auto font-mono text-sm">{formaterFcfa(total)}</span>
      </div>
      {lignes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-400">{vide}</p>
      ) : (
        <div className="overflow-x-auto">
          {/* Le titre reste en place : seul le tableau glisse. */}
          <table className="tableau">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr><th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right">Stock</th><th className="px-3 py-2 text-right">Valeur</th><th className="px-3 py-2 text-right">{colonne}</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lignes.slice(0, 15).map((l) => (
                <tr key={l.article_id} data-testid={`${testid}-${l.code}`}>
                  <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{l.code}</span>{l.designation}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{l.quantite}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono font-semibold whitespace-nowrap">{formaterFcfa(l.valeur)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600 whitespace-nowrap">{colonne === 'Sorti' ? l.quantite_sortie : jourDe(l)}</td>
                </tr>
              ))}
            </tbody>
            {lignes.length > 15 && (
              <tfoot className="bg-neutral-50 text-xs text-neutral-500">
                <tr><td colSpan={4} className="px-3 py-2">Les 15 premiers · la liste entière est sur la feuille imprimée et dans l'export.</td></tr>
              </tfoot>
            )}
          </table>
        </div>
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
  const [seuilJours, setSeuilJours] = useState<number>(SEUIL_DORMANCE_DEFAUT);
  const [apercuRotation, setApercuRotation] = useState(false);

  const filtres = useMemo(() => ({ depotId: depotId || null, familleId: familleId || null, recherche }), [depotId, familleId, recherche]);
  const { lignes } = useStocksParArticle(filialeId, filtres);
  // La période observée suit le seuil : ce qui est sorti depuis fait l'actif.
  // L'heure est prise une fois, à l'ouverture de l'écran : la borne et le
  // décompte des jours doivent parler du même instant, et une liste ne doit
  // pas changer de sens entre deux rafraîchissements.
  const [maintenant] = useState(() => new Date());
  const depuis = useMemo(() => new Date(maintenant.getTime() - seuilJours * 24 * 60 * 60 * 1000).toISOString(), [maintenant, seuilJours]);
  const filtresRotation = useMemo(() => ({ ...filtres, depuis }), [filtres, depuis]);
  const { dormants, actifs } = useRotationStock(filialeId, filtresRotation, { seuilJours, maintenant });
  const recapR = recapRotation(dormants, actifs);

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

  const exporterRotation = async () => {
    try {
      const feuille = (l: LigneRotation) => ({
        Code: l.code,
        Désignation: l.designation,
        Famille: l.famille_nom ?? '',
        Unité: l.unite,
        Stock: l.quantite,
        Valeur: l.valeur,
        'Sorti sur la période': l.quantite_sortie,
        'Dernière sortie': l.derniere_sortie ? formaterDate(l.derniere_sortie) : '',
        'Jours sans sortie': l.jours ?? '',
      });
      const chemin = await exporterExcel(`rotation-stock-${seuilJours}j${depotNom ? `-${depotNom}` : ''}`, [
        { nom: 'Stock dormant', lignes: dormants.map(feuille) },
        { nom: 'Stock actif', lignes: actifs.map(feuille) },
      ]);
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

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h3 className="font-semibold text-neutral-800">Rotation du stock</h3>
            <p className="text-sm text-neutral-500">Ce qui dort sur les rayons, et ce qui tourne. Une sortie, ici, est une vente, un déstockage ou une consommation en production.</p>
          </div>
          <div className="flex items-center gap-2 ml-auto print:hidden">
            <label className="text-sm text-neutral-600" htmlFor="seuil-dormance">Dormant au-delà de</label>
            <select id="seuil-dormance" value={seuilJours} onChange={(e) => setSeuilJours(Number(e.target.value))} className={controleInlineClass} data-testid="seuil-dormance">
              {SEUILS_DORMANCE.map((j) => <option key={j} value={j}>{j} jours</option>)}
            </select>
            <button onClick={() => setApercuRotation(true)} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid="imprimer-rotation">
              <PrinterIcon className="w-4 h-4" /> Imprimer / PDF
            </button>
            <button onClick={exporterRotation} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid="exporter-rotation">
              <ArrowDownTrayIcon className="w-4 h-4" /> Exporter Excel
            </button>
          </div>
        </div>
        <p className="text-sm text-neutral-600" data-testid="compteur-rotation">
          <strong>{recapR.articles_dormants}</strong> article(s) dormant(s) · <strong className="font-mono">{formaterFcfa(recapR.valeur_dormante)}</strong> immobilisés,
          soit <strong>{recapR.part_dormante} %</strong> de la valeur du stock · {recapR.articles_actifs} en mouvement
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TableauRotation titre="Stock dormant" lignes={dormants} vide="Rien ne dort : tout a bougé sur la période." tone="text-amber-700" colonne="Dernière sortie" testid="dormant" />
          <TableauRotation titre="Stock actif" lignes={actifs} vide="Aucune sortie sur la période." tone="text-green-700" colonne="Sorti" testid="actif" />
        </div>
      </section>

      {apercuRotation && (
        <RotationStockDocument
          dormants={dormants}
          actifs={actifs}
          filiale={filiale}
          filtres={{ seuilJours, depotNom, familleNom, recherche }}
          onClose={() => setApercuRotation(false)}
        />
      )}

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
