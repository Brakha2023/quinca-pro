import { useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { Article } from '../../../core/articles';
import { useArticles } from '../articles/hooks';
import { inputClass } from '../../components/ui/FormField';

interface Props {
  filialeId: string;
  onSelect: (article: Article) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Recherche d'article par code ou désignation (filtrage SQL, temps réel), sélection au clavier ou à la souris. */
export default function ArticlePicker({ filialeId, onSelect, placeholder = 'Code ou désignation…', autoFocus }: Props) {
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { articles } = useArticles(filialeId, { recherche });
  const resultats = articles.slice(0, 12);

  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, []);

  const choisir = (article: Article) => {
    onSelect(article);
    setRecherche('');
    setOuvert(false);
    setIndex(0);
  };

  return (
    <div className="relative" ref={ref}>
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
      <input
        type="text"
        value={recherche}
        autoFocus={autoFocus}
        onChange={(e) => { setRecherche(e.target.value); setOuvert(true); setIndex(0); }}
        onFocus={() => setOuvert(true)}
        onKeyDown={(e) => {
          if (!ouvert || resultats.length === 0) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, resultats.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); choisir(resultats[index]); }
          if (e.key === 'Escape') setOuvert(false);
        }}
        placeholder={placeholder}
        className={`${inputClass} pl-9`}
      />
      {ouvert && resultats.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-neutral-200 rounded-lg shadow-lg">
          {resultats.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisir(a)}
                className={`w-full text-left px-3 py-2 text-sm flex justify-between gap-3 ${i === index ? 'bg-primary-50' : 'hover:bg-neutral-50'}`}
              >
                <span><span className="font-mono text-primary-700 mr-2">{a.code}</span>{a.designation}</span>
                <span className="text-neutral-400 text-xs">{a.unite}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
