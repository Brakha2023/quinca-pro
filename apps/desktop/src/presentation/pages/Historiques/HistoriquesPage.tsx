import { useMemo, useState } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { TYPES_MOUVEMENT_SECTION, estSectionHistorique } from '../../../core/historiques';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import NoteHistorique from '../../components/ui/NoteHistorique';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import { useDepots } from '../../features/articles/hooks';
import SectionHistoriqueVue from '../../features/historiques/SectionsHistorique';
import { SECTIONS_HISTORIQUES, SECTION_HISTORIQUE_DEFAUT, cheminHistorique } from './onglets';

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const premierDuMois = () => `${new Date().toISOString().slice(0, 7)}-01`;
const enJour = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR');

/**
 * Historiques : les pièces déjà passées, réunies sous un même menu.
 *
 * Chaque section répond de la même façon — une liste de pièces, filtrée par
 * période, imprimable en A4 et exportable en Excel, d'où l'on rouvre la pièce
 * d'origine. Les écrans de saisie restent dans leurs modules ; ici, on relit.
 */
export default function HistoriquesPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const { section } = useParams();
  const [debut, setDebut] = useState(premierDuMois);
  const [fin, setFin] = useState(aujourdhui);
  const [depotId, setDepotId] = useState('');
  const [recherche, setRecherche] = useState('');
  const { depots } = useDepots(filialeId);

  const filtres = useMemo(() => ({ debut, fin, depotId: depotId || null, recherche }), [debut, fin, depotId, recherche]);

  if (!estSectionHistorique(section)) return <Navigate to={cheminHistorique(SECTION_HISTORIQUE_DEFAUT)} replace />;

  const infosFiliale = { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };
  // Le dépôt ne veut rien dire sur une vente ou une commande : le filtre ne
  // s'affiche que là où il trie vraiment quelque chose.
  const avecDepot = section === 'productions' || TYPES_MOUVEMENT_SECTION[section] !== undefined;
  const affichage = {
    debut: enJour(debut),
    fin: enJour(fin),
    depotNom: avecDepot ? depots.find((d) => d.id === depotId)?.nom ?? null : null,
    recherche,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Historiques</h1>
        <p className="text-sm text-neutral-500 mt-1">{filiale ? `${filiale.nom} · ` : ''}Les pièces déjà enregistrées : relecture, impression et export.</p>
      </div>

      {!filialeId ? (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
          {estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-neutral-200 bg-neutral-50 print:hidden">
            {SECTIONS_HISTORIQUES.map((s) => (
              <NavLink
                key={s.id}
                to={cheminHistorique(s.id)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  }`
                }
              >
                <s.icon className="w-4 h-4" />
                {s.label}
              </NavLink>
            ))}
          </div>

          <div className="p-6 space-y-4">
            <NoteHistorique quoi="les pièces" />

            <div className="flex flex-wrap items-end gap-3 print:hidden">
              <label className="text-sm"><span className="block text-xs font-medium text-neutral-700 mb-1">Du</span><input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={controleInlineClass} data-testid="historique-debut" /></label>
              <label className="text-sm"><span className="block text-xs font-medium text-neutral-700 mb-1">Au</span><input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={controleInlineClass} data-testid="historique-fin" /></label>
              <button type="button" onClick={() => { setDebut(aujourdhui()); setFin(aujourdhui()); }} className="px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg">Aujourd'hui</button>
              <button type="button" onClick={() => { setDebut(premierDuMois()); setFin(aujourdhui()); }} className="px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg">Ce mois</button>
              {avecDepot && (
                <label className="text-sm">
                  <span className="block text-xs font-medium text-neutral-700 mb-1">Dépôt</span>
                  <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className={controleInlineClass} data-testid="historique-depot">
                    <option value="">Tous les dépôts</option>
                    {depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                  </select>
                </label>
              )}
              <label className="text-sm flex-1 min-w-[14rem] max-w-xs">
                <span className="block text-xs font-medium text-neutral-700 mb-1">Rechercher</span>
                <span className="relative block">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="N° de pièce, tiers, article…" className={`${inputClass} pl-10`} data-testid="historique-recherche" />
                </span>
              </label>
            </div>

            <SectionHistoriqueVue section={section} filialeId={filialeId} filiale={infosFiliale} filtres={filtres} affichage={affichage} />
          </div>
        </div>
      )}
    </div>
  );
}
