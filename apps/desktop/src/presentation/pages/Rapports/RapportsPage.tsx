import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { usePermissions } from '../../auth/usePermissions';
import MargesPanel from '../../features/rapports/MargesPanel';

/**
 * Les rapports de gestion : ce que l'on relit pour décider, et que l'on
 * imprime pour le montrer.
 *
 * Le tableau de bord répond à « comment va la filiale aujourd'hui » ; un
 * rapport répond à « où se fait l'argent, et sur quelle période » — d'où des
 * dates libres et non les quatre fenêtres du tableau de bord, et d'où la
 * feuille A4 signée.
 *
 * **Un directeur sans filiale choisie lit le groupe** : la lecture accepte ce
 * périmètre tel quel, et c'est la seule façon de comparer ce que chaque
 * famille d'articles rapporte d'un bout à l'autre de la maison.
 */
export default function RapportsPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const { peut } = usePermissions();

  // Le rapport donne les prix d'achat et la marge article par article : une
  // URL se tape à la main, la page refuse donc d'elle-même.
  if (!peut('consolidation.lire')) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center shadow-sm">
        <p className="text-lg text-neutral-700">Les rapports de gestion ne vous sont pas ouverts.</p>
        <p className="mt-1 text-sm text-neutral-500">Votre filiale : {filiale?.nom ?? '—'}</p>
      </div>
    );
  }

  // Ni filiale ni vue de groupe : le profil n'est pas encore descendu sur le poste.
  if (!filialeId && !estVueConsolidee) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-neutral-400">Profil utilisateur en cours de synchronisation…</p>
      </div>
    );
  }

  const infosFiliale = estVueConsolidee
    ? { nom: 'Toutes les filiales', adresse: null, telephone: null }
    : { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Rapport des marges</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {estVueConsolidee ? 'Toutes les filiales' : filiale?.nom}
          {' · '}Ce que chaque catégorie d'articles rapporte, remises déduites et coût d'achat retranché.
        </p>
      </div>

      <MargesPanel filialeId={filialeId} filiale={infosFiliale} />
    </div>
  );
}
