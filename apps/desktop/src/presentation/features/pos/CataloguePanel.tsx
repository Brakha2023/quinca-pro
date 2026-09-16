import { useEffect, useRef } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formaterFcfa } from '../../hooks/useFormatage';
import { usePOSStore } from '../../stores/pos.store';
import { useFamilles } from '../articles/hooks';
import { useCatalogue, type ArticleCatalogue } from './hooks';

function CarteArticle({ article, onAjouter }: { article: ArticleCatalogue; onAjouter: () => void }) {
  const stock = article.stock_disponible;
  const tone = stock <= 0 ? 'bg-red-100 text-red-700' : stock <= article.stock_min ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700';
  return (
    <button
      onClick={onAjouter}
      className="bg-white rounded-xl border border-neutral-200 p-4 text-left hover:border-primary-400 hover:shadow-md transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-primary-700">{article.code}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>{stock <= 0 ? 'Rupture' : `${stock} ${article.unite}`}</span>
      </div>
      <p className="text-sm font-medium text-neutral-900 line-clamp-2 min-h-[2.5rem]">{article.designation}</p>
      <p className="text-lg font-bold font-mono text-neutral-900 mt-2">{formaterFcfa(article.prix_vente)}</p>
      {article.prix_vip != null && <p className="text-xs text-neutral-500">VIP : {formaterFcfa(article.prix_vip)}</p>}
    </button>
  );
}

/** Catalogue tactile du point de vente : recherche (F2), familles, cartes articles avec stock du dépôt de vente. */
export default function CataloguePanel({ filialeId, depotId }: { filialeId: string; depotId: string }) {
  const { familleId, recherche, setFamilleId, setRecherche, ajouterArticle, client } = usePOSStore();
  const { familles } = useFamilles(filialeId, { actives: true });
  const { articles, isLoading, rechercherUnique } = useCatalogue(filialeId, depotId, { recherche, familleId: familleId || null });
  const inputRef = useRef<HTMLInputElement>(null);
  const prixVip = Boolean(client && client.plafond_credit > 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            ref={inputRef}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== 'Enter' || !recherche.trim()) return;
              e.preventDefault();
              const article = await rechercherUnique(recherche);
              if (article) { ajouterArticle(article, 1, prixVip); setRecherche(''); }
            }}
            placeholder="Rechercher un article (F2) — Entrée ajoute le code exact ou le résultat unique"
            className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFamilleId('')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${!familleId ? 'bg-primary-600 text-white' : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'}`}>Tous</button>
          {familles.map((f) => (
            <button key={f.id} onClick={() => setFamilleId(f.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${familleId === f.id ? 'bg-primary-600 text-white' : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'}`}>{f.nom}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-20 text-neutral-400">Chargement…</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 text-neutral-400">
            <p className="text-lg font-medium">Aucun article</p>
            <p className="text-sm mt-1">Essayez une autre recherche ou famille.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {articles.map((a) => <CarteArticle key={a.id} article={a} onAjouter={() => ajouterArticle(a, 1, prixVip)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
