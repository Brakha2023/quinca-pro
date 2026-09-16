import { useMemo } from 'react';
import { usePOSStore } from '../../stores/pos.store';
import { ARTICLES_MOCK } from '../../stores/mock-data';
import SearchBar from '../../components/pos/SearchBar';
import ArticleCard from '../../components/pos/ArticleCard';
import TicketPanel from '../../components/pos/TicketPanel';

export default function POSPage() {
  const { familleActive, recherche } = usePOSStore();

  const articlesFiltres = useMemo(() => {
    return ARTICLES_MOCK.filter((article) => {
      const matchFamille = familleActive === 'Tous' || article.famille === familleActive;
      const matchRecherche = article.designation.toLowerCase().includes(recherche.toLowerCase()) ||
                            article.code_auto.toLowerCase().includes(recherche.toLowerCase());
      return matchFamille && matchRecherche;
    });
  }, [familleActive, recherche]);

  return (
    <div className="h-full flex gap-6">
      {/* Colonne gauche - Catalogue (65%) */}
      <div className="flex-1 flex flex-col min-w-0">
        <SearchBar />
        
        <div className="mt-4 flex-1 overflow-y-auto">
          {articlesFiltres.length === 0 ? (
            <div className="text-center py-20 text-neutral-400">
              <p className="text-5xl mb-3">🔍</p>
              <p className="text-lg font-medium">Aucun article trouvé</p>
              <p className="text-sm mt-1">Essayez une autre recherche ou famille</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {articlesFiltres.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Colonne droite - Ticket (35%) */}
      <div className="w-96 flex-shrink-0">
        <TicketPanel />
      </div>
    </div>
  );
}