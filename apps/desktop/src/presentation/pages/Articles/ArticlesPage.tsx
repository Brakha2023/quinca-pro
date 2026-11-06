import { useState } from 'react';
import { BuildingStorefrontIcon, CubeIcon, TagIcon } from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import ArticlesPanel from '../../features/articles/ArticlesPanel';
import DepotsPanel from '../../features/articles/DepotsPanel';
import FamillesPanel from '../../features/articles/FamillesPanel';

type Onglet = 'articles' | 'familles' | 'depots';

const ONGLETS: Array<{ id: Onglet; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'articles', label: 'Articles', icon: CubeIcon },
  { id: 'familles', label: 'Familles', icon: TagIcon },
  { id: 'depots', label: 'Dépôts', icon: BuildingStorefrontIcon },
];

/** Référentiel de la filiale : catalogue, familles d'articles, dépôts. */
export default function ArticlesPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const [onglet, setOnglet] = useState<Onglet>('articles');
  const infosFiliale = { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Catalogue</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {filiale ? `${filiale.nom} · ` : ''}Disponible hors ligne, synchronisé automatiquement.
        </p>
      </div>

      {!filialeId ? (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
          {estVueConsolidee ? (
            <>
              <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p>
              <p className="text-sm mt-1">Le catalogue est géré filiale par filiale.</p>
            </>
          ) : (
            <p>Profil utilisateur en cours de synchronisation…</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-neutral-200 bg-neutral-50 print:hidden">
            {ONGLETS.map((o) => (
              <button
                key={o.id}
                onClick={() => setOnglet(o.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  onglet === o.id
                    ? 'border-accent-500 text-accent-600 bg-white'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <o.icon className="w-4 h-4" />
                {o.label}
              </button>
            ))}
          </div>
          <div className="p-6">
            {onglet === 'articles' && <ArticlesPanel filialeId={filialeId} filiale={infosFiliale} />}
            {onglet === 'familles' && <FamillesPanel filialeId={filialeId} />}
            {onglet === 'depots' && <DepotsPanel filialeId={filialeId} />}
          </div>
        </div>
      )}
    </div>
  );
}
