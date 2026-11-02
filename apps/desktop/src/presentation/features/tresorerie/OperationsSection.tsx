import { useMemo, useState } from 'react';
import { ArrowDownTrayIcon, MagnifyingGlassIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { filtrerOperations, perimetreOperations, recapOperations, type LigneOperation } from '../../../core/tresorerie';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import NoteHistorique from '../../components/ui/NoteHistorique';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import OperationsDocument from './OperationsDocument';
import { useCaissesToutes, useMouvementsTresorerie } from './hooks';

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const premierDuMois = () => `${new Date().toISOString().slice(0, 7)}-01`;
const enJour = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR');
const formaterDateHeure = (iso: string) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  /**
   * Catégories que la section produit — intégrées **et** ajoutées par la
   * maison. La liste s'y borne, et le filtre ne propose que celles-là : on ne
   * cherche pas une dépense dans l'onglet des versements.
   */
  codes: string[];
  /** Libellés à afficher, intégrés et ajoutés réunis (voir `useCategoriesTresorerie`). */
  libelles: Record<string, string>;
  titre: string;
  /** Base du nom de fichier à l'export, ex. `depenses`. */
  baseExport: string;
  /** Préfixe des `data-testid`, pour les tests de bout en bout. */
  prefixeTest: string;
}

/**
 * Les opérations d'une section, relues sur une période et imprimables.
 *
 * Les quinze dernières lignes suffisaient pour vérifier ce qu'on venait de
 * saisir ; elles ne suffisent pas pour justifier un mois de dépenses devant le
 * patron ou devant un contrôleur. D'où la même mécanique que l'état des
 * caisses : une période, une caisse, une catégorie, une recherche — et ce qui
 * s'affiche est exactement ce qui s'imprime et ce qui s'exporte.
 */
export default function OperationsSection({ filialeId, filiale, codes, libelles, titre, baseExport, prefixeTest }: Props) {
  const notifier = useNotifier();
  const caisses = useCaissesToutes(filialeId);
  const [dateDebut, setDateDebut] = useState(premierDuMois);
  const [dateFin, setDateFin] = useState(aujourdhui);
  const [caisseId, setCaisseId] = useState('');
  const [categorie, setCategorie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [apercu, setApercu] = useState(false);

  const { mouvements, isLoading } = useMouvementsTresorerie(filialeId, { caisseId: caisseId || null, dateDebut, dateFin, limite: 2000 });

  const lignes = useMemo<LigneOperation[]>(
    () => mouvements
      .filter((m) => codes.includes(m.categorie ?? ''))
      .map((m) => ({
        id: m.id,
        date: m.date_operation ?? '',
        type: m.type === 'DEPENSE' ? 'DEPENSE' : 'RECETTE',
        categorie: m.categorie ?? '',
        categorie_libelle: libelles[m.categorie ?? ''] ?? m.categorie ?? '',
        description: m.description ?? '',
        piece: m.reference ?? '',
        caisse: m.caisse_nom ?? '',
        operateur: [m.utilisateur_prenom, m.utilisateur_nom].filter(Boolean).join(' '),
        montant: m.montant ?? 0,
      })),
    [mouvements, codes, libelles],
  );
  const retenues = useMemo(() => filtrerOperations(lignes, { categorie, recherche }), [lignes, categorie, recherche]);
  const recap = recapOperations(retenues);

  const caisseNom = caisses.find((c) => c.id === caisseId)?.nom ?? null;
  const filtres = { debut: enJour(dateDebut), fin: enJour(dateFin), caisseNom, categorieLibelle: categorie ? libelles[categorie] ?? categorie : null, recherche };

  const exporter = async () => {
    try {
      const chemin = await exporterExcel(baseExport, [{
        nom: 'Opérations',
        lignes: retenues.map((l) => ({
          Date: formaterDateHeure(l.date),
          Caisse: l.caisse,
          Catégorie: l.categorie_libelle,
          Désignation: l.description,
          Pièce: l.piece,
          Par: l.operateur,
          Sens: l.type === 'RECETTE' ? 'Entrée' : 'Sortie',
          Montant: l.montant,
        })),
      }, {
        nom: 'Par catégorie',
        lignes: recap.ventilation.map((v) => ({ Catégorie: v.libelle, Opérations: v.nombre, Montant: v.montant, 'Part %': v.part })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  return (
    <div className="space-y-3">
      <NoteHistorique quoi="ces opérations" />

      <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-neutral-200 p-4 print:hidden">
        <label className="text-sm"><span className="block text-xs font-medium text-neutral-700 mb-1">Du</span><input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={controleInlineClass} data-testid={`${prefixeTest}-debut`} /></label>
        <label className="text-sm"><span className="block text-xs font-medium text-neutral-700 mb-1">Au</span><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={controleInlineClass} data-testid={`${prefixeTest}-fin`} /></label>
        <button type="button" onClick={() => { setDateDebut(aujourdhui()); setDateFin(aujourdhui()); }} className="px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg">Aujourd'hui</button>
        <button type="button" onClick={() => { setDateDebut(premierDuMois()); setDateFin(aujourdhui()); }} className="px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg">Ce mois</button>
        <label className="text-sm">
          <span className="block text-xs font-medium text-neutral-700 mb-1">Caisse</span>
          <select value={caisseId} onChange={(e) => setCaisseId(e.target.value)} className={controleInlineClass} data-testid={`${prefixeTest}-filtre-caisse`}>
            <option value="">Toutes les caisses</option>
            {caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-neutral-700 mb-1">Catégorie</span>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={controleInlineClass} data-testid={`${prefixeTest}-filtre-categorie`}>
            <option value="">Toutes les catégories</option>
            {codes.map((c) => <option key={c} value={c}>{libelles[c] ?? c}</option>)}
          </select>
        </label>
        <label className="text-sm flex-1 min-w-[12rem] max-w-xs">
          <span className="block text-xs font-medium text-neutral-700 mb-1">Rechercher</span>
          <span className="relative block">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Désignation, pièce, bénéficiaire…" className={`${inputClass} pl-10`} data-testid={`${prefixeTest}-recherche`} />
          </span>
        </label>
        <div className="ml-auto flex items-end gap-2">
          <span className="text-sm text-neutral-600 pb-2 whitespace-nowrap" data-testid={`${prefixeTest}-compteur`}>
            <strong>{recap.nombre}</strong> opération(s) · <strong className="font-mono">{formaterFcfa(recap.total)}</strong>
          </span>
          <button type="button" onClick={() => setApercu(true)} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid={`imprimer-${prefixeTest}`}><PrinterIcon className="w-4 h-4" /> Imprimer / PDF</button>
          <button type="button" onClick={exporter} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid={`exporter-${prefixeTest}`}><ArrowDownTrayIcon className="w-4 h-4" /> Exporter Excel</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <p className="px-4 py-3 text-sm font-semibold text-neutral-700 border-b border-neutral-200 bg-neutral-50">
          {titre} <span className="font-normal text-neutral-500">· {perimetreOperations(filtres)}</span>
        </p>
        <div className="overflow-x-auto">
          {/* Le titre reste en place : seul le tableau glisse. */}
          <table className="tableau">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr>
              <th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Caisse</th><th className="px-3 py-2 text-left">Catégorie</th><th className="px-3 py-2 text-left">Désignation</th><th className="px-3 py-2 text-left">Pièce</th><th className="px-3 py-2 text-left">Par</th><th className="px-3 py-2 text-right">Montant</th>
            </tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {retenues.map((l) => (
                <tr key={l.id} className="hover:bg-neutral-50" data-testid="ligne-operation">
                  <td className="px-3 py-2 text-sm text-neutral-600">{formaterDateHeure(l.date)}</td>
                  <td className="px-3 py-2 text-sm">{l.caisse}</td>
                  <td className="px-3 py-2 text-sm"><span className="px-2 py-0.5 rounded-full text-xs bg-neutral-100">{l.categorie_libelle}</span></td>
                  <td className="px-3 py-2 text-sm text-neutral-600 max-w-md truncate" title={l.description}>{l.description || '—'}</td>
                  <td className="px-3 py-2 text-sm font-mono text-neutral-600">{l.piece || '—'}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{l.operateur || '—'}</td>
                  <td className={`px-3 py-2 text-sm text-right font-mono ${l.type === 'RECETTE' ? 'text-green-700' : 'text-orange-700'}`}>{l.type === 'RECETTE' ? '+' : '−'} {formaterFcfa(l.montant)}</td>
                </tr>
              ))}
            </tbody>
            {retenues.length > 0 && (
              <tfoot className="bg-amber-50 border-t-2 border-neutral-300 text-sm font-semibold"><tr>
                <td className="px-3 py-2" colSpan={6}>Total — {recap.nombre} opération(s)</td>
                <td className="px-3 py-2 text-right font-mono" data-testid={`total-${prefixeTest}`}>{formaterFcfa(recap.total)}</td>
              </tr></tfoot>
            )}
          </table>
        </div>
        {isLoading && <div className="text-center py-8 text-neutral-400 text-sm">Chargement…</div>}
        {!isLoading && retenues.length === 0 && <div className="text-center py-8 text-neutral-400 text-sm">Aucune opération dans ce périmètre.</div>}
      </div>

      {apercu && <OperationsDocument titre={titre} lignes={retenues} filiale={filiale} filtres={filtres} onClose={() => setApercu(false)} />}
    </div>
  );
}
