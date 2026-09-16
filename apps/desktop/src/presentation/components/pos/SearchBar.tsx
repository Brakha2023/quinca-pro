import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { usePOSStore } from '../../stores/pos.store';
import { FAMILLES } from '../../stores/mock-data';

export default function SearchBar() {
  const { familleActive, recherche, setFamilleActive, setRecherche } = usePOSStore();

  return (
    <div className="space-y-4">
      {/* Recherche */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un article (F2)"
          className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Filtres familles */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FAMILLES.map((famille) => (
          <button
            key={famille}
            onClick={() => setFamilleActive(famille)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              familleActive === famille
                ? 'bg-primary-600 text-white'
                : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {famille}
          </button>
        ))}
      </div>
    </div>
  );
}
