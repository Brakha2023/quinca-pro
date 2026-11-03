import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  libellePagination, listePlafonnee, numerosDePage, TAILLES_PAGE,
} from '../../../core/commun/pagination';
import type { EtatPage } from '../../hooks/usePagination';

/**
 * La barre de pagination d'une liste : où l'on en est, et comment en changer.
 *
 * Le calcul est dans `core/commun/pagination`, la page courante dans
 * `hooks/usePagination` ; il ne reste ici que ce qui se voit.
 */

interface Props {
  etat: EtatPage;
  /** Nom de la chose comptée, au singulier : « article », « client », « ligne ». */
  nom: string;
  /**
   * Plafond de la requête qui a rempli la liste, quand elle en a un. Une liste
   * qui s'arrête pile dessus est probablement incomplète, et le dire vaut
   * mieux que laisser croire que le compte est bon.
   */
  plafond?: number | null;
  'data-testid'?: string;
}

const bouton = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export default function Pagination({ etat, nom, plafond, 'data-testid': testid = 'pagination' }: Props) {
  const tronquee = listePlafonnee(etat.total, plafond);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 print:hidden" data-testid={testid}>
      {/* `data-total` : le texte dit « 51 à 100 sur 312 », où trois nombres se
          disputent la lecture. Le total se lit ici sans l'interpréter. */}
      <p className="text-sm text-neutral-600" data-testid={`${testid}-compte`} data-total={etat.total}>
        {libellePagination(etat, nom)}
        {tronquee && (
          <span className="ml-2 text-xs text-orange-700" data-testid={`${testid}-plafond`}>
            — liste arrêtée à {plafond?.toLocaleString('fr-FR')} lignes ; resserrez les filtres pour voir le reste.
          </span>
        )}
      </p>

      {!etat.pageUnique && (
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1" aria-label="Pages">
            <button
              type="button"
              onClick={() => etat.allerA(etat.page - 1)}
              disabled={etat.page === 1}
              className={`${bouton} text-neutral-700 hover:bg-neutral-100`}
              data-testid={`${testid}-precedent`}
            >
              <ChevronLeftIcon className="h-4 w-4" /> Précédent
            </button>

            {numerosDePage(etat).map((p, i) => (p === null ? (
              <span key={`trou-${i}`} className="px-1 text-sm text-neutral-400">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => etat.allerA(p)}
                aria-current={p === etat.page ? 'page' : undefined}
                className={`${bouton} ${p === etat.page ? 'bg-primary-600 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
              >
                {p}
              </button>
            )))}

            <button
              type="button"
              onClick={() => etat.allerA(etat.page + 1)}
              disabled={etat.page === etat.pages}
              className={`${bouton} text-neutral-700 hover:bg-neutral-100`}
              data-testid={`${testid}-suivant`}
            >
              Suivant <ChevronRightIcon className="h-4 w-4" />
            </button>
          </nav>

          <label className="flex items-center gap-1.5 text-sm text-neutral-600">
            <span className="sr-only sm:not-sr-only">Par page</span>
            <select
              value={etat.taille}
              onChange={(e) => etat.changerTaille(Number(e.target.value))}
              className="rounded-lg border border-neutral-200 px-2 py-1 text-sm"
              data-testid={`${testid}-taille`}
            >
              {TAILLES_PAGE.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
