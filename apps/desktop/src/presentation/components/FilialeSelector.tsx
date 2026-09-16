import { useState, useRef, useEffect } from 'react';
import { useFilialesStore } from '../stores/filiales.store';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function FilialeSelector() {
  const { filiales, filialeSelectionnee, setFilialeSelectionnee } = useFilialesStore();
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

  return (
    <div className="px-4 py-6 border-b border-primary-800" ref={dropdownRef}>
      <p className="text-xs text-primary-300 uppercase tracking-wider mb-2 font-medium">Périmètre</p>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-primary-800 hover:bg-primary-700 rounded-lg text-sm font-medium text-white transition-colors"
        >
          <span className="truncate">{filialeSelectionnee.nom}</span>
          <ChevronDownIcon className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50">
            {filiales.map((filiale) => (
              <button
                key={filiale.id}
                onClick={() => {
                  setFilialeSelectionnee(filiale);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-neutral-50 transition-colors ${
                  filialeSelectionnee.id === filiale.id ? 'bg-primary-50 text-primary-700' : 'text-neutral-700'
                }`}
              >
                <span className="truncate">{filiale.nom}</span>
                {filialeSelectionnee.id === filiale.id && (
                  <CheckIcon className="w-4 h-4 text-primary-600" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}