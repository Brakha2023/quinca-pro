import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

/**
 * Le raccourci d'une carte du tableau de bord vers l'écran qui en dit plus.
 *
 * Un tableau de bord répond à « combien » et s'arrête là : pour savoir
 * **lesquels**, il faut rouvrir le menu, trouver le module, puis l'onglet. Ce
 * lien fait le trajet d'un clic — la tuile des créances mène à la relance
 * clients, celle du stock au suivi de stock.
 *
 * Il est **orange** : dans cette maison la couleur d'action est l'orange, et
 * un bandeau de carte ne se clique pas. C'est donc à ce seul mot que l'œil
 * reconnaît ce sur quoi on peut appuyer.
 *
 * ### Il ne s'affiche que s'il mène quelque part
 *
 * En vue groupe, les modules n'ont pas de filiale sur laquelle travailler :
 * `/clients` y répond « Sélectionnez une filiale ». Un raccourci qui ouvre une
 * page vide est pire que pas de raccourci — l'appelant passe donc `to` à
 * `null` dans ce cas, et rien ne s'affiche. Les lignes de comptes font
 * exception : elles connaissent leur filiale, et l'ouvrent en chemin.
 */

interface Props {
  /** Nul : il n'y a rien à ouvrir, et le lien disparaît. */
  to: string | null;
  /** Dit où l'on va, jamais « voir plus » tout court. */
  children: string;
  /** Sur un bandeau sombre de carte, le texte s'éclaircit. */
  surFonce?: boolean;
  /** Exécuté avant la navigation : sert à poser la filiale du compte ouvert. */
  onClick?: () => void;
  'data-testid'?: string;
}

export default function LienVoirPlus({ to, children, surFonce, onClick, 'data-testid': testid }: Props) {
  if (!to) return null;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
        surFonce ? 'text-accent-300 hover:text-accent-200' : 'text-accent-600 hover:text-accent-700'
      }`}
      data-testid={testid}
    >
      {children}
      <ArrowRightIcon className="h-3 w-3" />
    </Link>
  );
}
