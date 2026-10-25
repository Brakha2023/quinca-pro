import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useFilialeCourante } from '../auth/useFilialeCourante';

const LIBELLE_CONSOLIDE = 'Groupe (consolidé)';

/** Sélecteur de périmètre. Affiché en lecture seule pour un non-directeur. */
export default function FilialeSelector() {
  const { filiales, filiale, filialeId, peutChangerDeFiliale, setFilialeId } = useFilialeCourante();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const libelle = filiale?.nom ?? (peutChangerDeFiliale ? LIBELLE_CONSOLIDE : 'Filiale en cours de synchronisation…');

  if (!peutChangerDeFiliale) {
    return (
      <div className="px-4 py-6 border-b border-primary-800">
        <p className="text-xs text-primary-300 uppercase tracking-wider mb-2 font-medium">Filiale</p>
        <p className="px-3 py-2.5 bg-primary-800 rounded-lg text-sm font-medium text-white truncate">{libelle}</p>
      </div>
    );
  }

  // La maison mère n'est pas une holding : c'est la filiale où siège la
  // direction, et elle vend comme les autres. L'écarter du sélecteur revenait
  // à interdire au directeur de regarder sa propre filiale — la consolidation
  // et les transferts, eux, l'ont toujours comptée.
  const options: Array<{ id: string | null; nom: string }> = [
    { id: null, nom: LIBELLE_CONSOLIDE },
    ...filiales.map((f) => ({ id: f.id, nom: f.nom ?? f.code ?? f.id })),
  ];

  return (
    <div className="px-4 py-6 border-b border-primary-800" ref={dropdownRef}>
      <p className="text-xs text-primary-300 uppercase tracking-wider mb-2 font-medium">Périmètre</p>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-primary-800 hover:bg-primary-700 rounded-lg text-sm font-medium text-white transition-colors"
        >
          <span className="truncate">{libelle}</span>
          <ChevronDownIcon className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50">
            {options.map((option) => {
              const actif = option.id === filialeId;
              return (
                <button
                  key={option.id ?? 'consolide'}
                  onClick={() => {
                    setFilialeId(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-neutral-50 transition-colors ${
                    actif ? 'bg-primary-50 text-primary-700' : 'text-neutral-700'
                  }`}
                >
                  <span className="truncate">{option.nom}</span>
                  {actif && <CheckIcon className="w-4 h-4 text-primary-600" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
