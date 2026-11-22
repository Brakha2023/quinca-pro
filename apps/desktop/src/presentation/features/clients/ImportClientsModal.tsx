import { useRef, useState, type ChangeEvent } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import type { Cellule } from '../../../core/articles';
import { clientsDepuisGrille } from '../../../core/clients';
import type { LigneIgnoree } from '../../../core/commun/importTiers';
import { ClientsRepository } from '../../../infrastructure/powersync/repositories/ClientsRepository';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import Bouton from '../../components/ui/Bouton';
import Modal from '../../components/ui/Modal';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';

/** Le modèle proposé au téléchargement : les entêtes, et deux clients pour l'exemple. */
const MODELE = [
  {
    'Code': 'CLI-001',
    'Nom': 'ETS KOUAME ET FILS',
    'Solde initial': 150000,
    'Date solde': '2026-12-31',
    'Mobile': '07 00 00 00 00',
    'Adresse': 'Yopougon, Rue des Jardins',
    'Ville': 'Abidjan',
    'Contact': 'M. Kouamé',
    'Email': '',
    'RC': '',
    'CC': '',
    'Plafond': 500000,
    'Groupe': 'REVENDEURS',
  },
  {
    'Code': '',
    'Nom': 'MADAME ADJOUA',
    'Solde initial': -25000,
    'Date solde': '2026-12-31',
    'Mobile': '05 00 00 00 00',
    'Adresse': '',
    'Ville': '',
    'Contact': '',
    'Email': '',
    'RC': '',
    'CC': '',
    'Plafond': 0,
    'Groupe': '',
  },
];

function lireFichierExcel(data: ArrayBuffer) {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
  if (!sheet) throw new Error('Fichier illisible : aucune feuille de calcul.');
  const grille = XLSX.utils.sheet_to_json<Cellule[]>(sheet, { header: 1, blankrows: false, defval: null, raw: true });
  return clientsDepuisGrille(grille);
}

/**
 * Reprise du répertoire clients depuis un classeur, soldes d'ouverture
 * compris : ce qu'on fait le jour où la maison passe à QuincaPro.
 *
 * Les consignes sont **lues avant** de choisir le fichier, et non affichées
 * après coup dans un message d'erreur : c'est la seule façon qu'elles servent.
 * Le modèle se télécharge d'ici, déjà rempli de deux exemples — dont un solde
 * négatif, parce que c'est le cas qu'on se demande toujours comment écrire.
 */
export default function ImportClientsModal({ filialeId, onClose }: { filialeId: string; onClose: () => void }) {
  const repository = useRepository(ClientsRepository);
  const notifier = useNotifier();
  const fichierRef = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [ignores, setIgnores] = useState<LigneIgnoree[] | null>(null);

  const telechargerModele = async () => {
    try {
      const chemin = await exporterExcel('modele-import-clients', [{ nom: 'Clients', lignes: MODELE }]);
      if (chemin) notifier('succes', `Modèle enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Téléchargement impossible.');
    }
  };

  const importer = async (event: ChangeEvent<HTMLInputElement>) => {
    const fichier = event.target.files?.[0];
    if (!fichier) return;
    setEnCours(true);
    setIgnores(null);
    try {
      const lignes = lireFichierExcel(await fichier.arrayBuffer());
      const { importes, ignores: rejets, soldeRepris } = await repository.importMany(filialeId, lignes);
      notifier('succes', importes > 0
        ? `${importes} client(s) repris, ${formaterFcfa(soldeRepris)} de solde d'ouverture.`
        : 'Aucun client repris : tout le fichier a été écarté.');
      if (rejets.length > 0) setIgnores(rejets);
      else if (importes > 0) onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : "Échec de l'import.");
    } finally {
      setEnCours(false);
      if (fichierRef.current) fichierRef.current.value = '';
    }
  };

  return (
    <Modal
      titre="Importer des clients"
      sousTitre="Reprise d’un répertoire existant, soldes d’ouverture compris"
      largeur="max-w-2xl"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="mr-auto px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Fermer</button>
          <Bouton onClick={telechargerModele} icone={ArrowDownTrayIcon} tailleIcone="w-4 h-4" className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg" data-testid="telecharger-modele-clients">
            Télécharger le modèle
          </Bouton>
          <Bouton onClick={() => fichierRef.current?.click()} enCours={enCours} icone={ArrowUpTrayIcon} tailleIcone="w-4 h-4" className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" data-testid="choisir-fichier-clients">
            Choisir le fichier
          </Bouton>
        </>
      }
    >
      <input ref={fichierRef} type="file" accept=".xlsx,.xls,.csv" onChange={importer} className="hidden" data-testid="fichier-clients" />

      <div className="space-y-4 text-sm text-neutral-700" data-testid="consignes-import">
        <section>
          <h3 className="font-semibold text-neutral-900">Les colonnes</h3>
          <p className="mt-1">
            Une ligne d’entêtes, puis un client par ligne. Seule <strong>« Nom »</strong> est obligatoire ; les autres
            colonnes peuvent manquer, et leur ordre n’a pas d’importance. Les lignes de titre au-dessus des entêtes et les
            lignes de total en dessous sont ignorées d’elles-mêmes.
          </p>
          <table className="tableau mt-2 text-xs">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr><th className="px-2 py-1 text-left">Colonne</th><th className="px-2 py-1 text-left">Autres noms acceptés</th><th className="px-2 py-1 text-left">Si elle manque</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr><td className="px-2 py-1"><strong>Nom</strong></td><td className="px-2 py-1">Raison sociale, Client, Désignation</td><td className="px-2 py-1 text-red-600">le fichier est refusé</td></tr>
              <tr><td className="px-2 py-1">Code</td><td className="px-2 py-1">Code client, Référence, N° compte</td><td className="px-2 py-1">un code est attribué</td></tr>
              <tr><td className="px-2 py-1">Solde initial</td><td className="px-2 py-1">Solde, Créance, Ancien solde, Dû</td><td className="px-2 py-1">zéro</td></tr>
              <tr><td className="px-2 py-1">Date solde</td><td className="px-2 py-1">Date d’effet, Arrêté au</td><td className="px-2 py-1">vide</td></tr>
              <tr><td className="px-2 py-1">Mobile, Téléphone, Adresse, Ville, Contact, Email, RC, CC, Plafond, Groupe</td><td className="px-2 py-1">—</td><td className="px-2 py-1">vide</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="font-semibold text-neutral-900">Le solde d’ouverture</h3>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            <li><strong>Positif</strong> : ce que le client <strong>doit</strong> à la maison (150000).</li>
            <li><strong>Négatif</strong> : une avance qu’il a versée, à son crédit (−25000).</li>
            <li>Écrivez des nombres, pas des formules. « 150 000 », « 150000 F » et « 150.000 » sont lus pareil.</li>
            <li>
              La <strong>date du solde</strong> dit à quel jour le montant est arrêté : jj/mm/aaaa ou une vraie date Excel.
              Ce qui n’est pas lisible est laissé vide plutôt que deviné — une date fausse déplacerait une créance d’un
              exercice à l’autre.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-neutral-900">Ce que l’import ne fait pas</h3>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            <li>
              Il <strong>ne modifie jamais</strong> un client déjà au répertoire. Le rapprochement se fait sur le code s’il
              y en a un, sur le nom sinon : relancer le même fichier deux fois n’ajoute rien et ne double aucune créance.
            </li>
            <li>Il ne crée ni facture ni règlement : le solde repris est un point de départ, pas une pièce.</li>
            <li>Tout passe en une seule fois — si une ligne fait échouer l’écriture, rien n’est repris.</li>
          </ul>
        </section>

        {ignores && (
          <section className="rounded-lg border border-orange-200 bg-orange-50 p-3" data-testid="lignes-ignorees">
            <h3 className="font-semibold text-orange-900">{ignores.length} ligne(s) écartée(s)</h3>
            <ul className="mt-1 space-y-0.5 text-xs text-orange-900">
              {ignores.slice(0, 12).map((i) => <li key={`${i.ligne}-${i.nom}`}>ligne {i.ligne} — {i.nom} : {i.raison}</li>)}
              {ignores.length > 12 && <li>… et {ignores.length - 12} autre(s).</li>}
            </ul>
            <p className="mt-2 text-xs text-orange-800">
              Les autres clients du fichier, eux, sont bien repris. Corrigez ces lignes et relancez le même fichier :
              ce qui est déjà au répertoire sera laissé tranquille.
            </p>
          </section>
        )}
      </div>
    </Modal>
  );
}
