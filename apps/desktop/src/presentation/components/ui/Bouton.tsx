import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { libelleAttente, peindre } from '../../../core/commun/attente';

/**
 * Un bouton qui se désarme pendant qu'il travaille.
 *
 * Entre le clic et le résultat — un aperçu de trois cents lignes, un classeur
 * Excel, une question au serveur — il s'écoule une à trois secondes pendant
 * lesquelles rien ne bougeait. Le caissier recliquait, et le travail partait
 * deux fois : deux boîtes d'enregistrement, deux suppressions demandées.
 *
 * Le bouton prend donc en charge les trois gestes, une fois pour toutes :
 *
 *   * il ignore les clics suivants tant que le premier n'a pas rendu la main ;
 *   * il montre un tourniquet à la place de son icône et dit ce qu'il fait
 *     (« Impression… ») ;
 *   * il revient **quoi qu'il arrive**, y compris si l'opération échoue —
 *     sans cela le bouton resterait mort et il faudrait recharger l'écran.
 *
 * Le style reste celui de l'appelant : `className` n'est pas touchée, et le
 * bouton ne cherche pas à remplacer les trois cents boutons de l'application,
 * seulement ceux qui font attendre.
 *
 * ### Le travail qui ne rend jamais la main
 *
 * Ouvrir un aperçu n'est pas asynchrone : c'est un rendu qui bloque le fil
 * d'exécution. Demander le tourniquet puis enchaîner ne montrerait rien — le
 * navigateur n'aurait pas eu une occasion de peindre entre les deux. Le
 * travail est donc toujours lancé **après** un affichage, qu'il rende une
 * promesse ou non. Le tourniquet reste alors figé à l'écran pendant le rendu
 * qui bloque, ce qui est précisément ce qu'on veut : il est visible.
 */

interface Props {
  /**
   * Le travail. Rendant une promesse, le bouton reste désarmé jusqu'à ce
   * qu'elle se dénoue ; sinon jusqu'à ce qu'il ait rendu la main.
   */
  onClick: () => void | Promise<unknown>;
  /** Le libellé. Absent — un bouton réduit à son icône —, le tourniquet suffit. */
  children?: ReactNode;
  /** Icône de repos ; remplacée par le tourniquet pendant le travail. */
  icone?: ComponentType<{ className?: string }>;
  /** Taille de l'icône, et du tourniquet qui la remplace — ils doivent faire la même. */
  tailleIcone?: string;
  className?: string;
  /** Désarmé pour une autre raison que le travail en cours (droits, formulaire vide). */
  disabled?: boolean;
  /**
   * Attente **pilotée de l'extérieur**, pour un bouton dont le travail ne part
   * pas de son `onClick` : l'envoi d'un formulaire, par exemple, est tenu par
   * `isSubmitting`. Fournie, elle décide seule ; le bouton ne compte plus son
   * propre travail.
   */
  enCours?: boolean;
  type?: 'button' | 'submit';
  title?: string;
  'aria-label'?: string;
  'data-testid'?: string;
  /**
   * Ce que le bouton dit pendant le travail. Par défaut, le verbe du libellé
   * mis au travail — encore faut-il que le libellé soit du texte ; quand il ne
   * l'est pas (une icône seule), rien ne s'écrit.
   */
  libelleEnCours?: string;
}

/** Le tourniquet : un anneau qui tourne, de la couleur du texte du bouton. */
export function Tourniquet({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin flex-shrink-0`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Bouton({
  onClick, children, icone: Icone, tailleIcone = 'h-4 w-4', className = '', disabled, type = 'button',
  title, 'aria-label': ariaLabel, 'data-testid': testid, libelleEnCours,
  enCours: enCoursPilote,
}: Props) {
  const [enCoursPropre, setEnCours] = useState(false);
  const enCours = enCoursPilote ?? enCoursPropre;
  // Le travail peut se dénouer après que l'écran a changé : on ne réveille pas
  // un bouton qui n'est plus là. Le drapeau se **relève** à chaque montage :
  // en mode strict React monte, démonte, remonte, et un drapeau qui ne
  // ferait que tomber laisserait le bouton désarmé pour toujours.
  const monte = useRef(true);
  useEffect(() => {
    monte.current = true;
    return () => { monte.current = false; };
  }, []);

  const lancer = useCallback(async () => {
    if (enCours || disabled) return;
    if (enCoursPilote !== undefined) { await onClick(); return; }
    setEnCours(true);
    try {
      // L'affichage d'abord, le travail ensuite. Enchaîner aussitôt ne
      // montrerait rien : React n'aurait pas encore rendu le tourniquet quand
      // le travail — souvent un rendu qui bloque — s'emparerait du fil.
      // Deux trames, soit une trentaine de millisecondes : invisible sur une
      // action rapide, décisif sur un aperçu de trois cents lignes.
      await peindre();
      await onClick();
    } finally {
      if (monte.current) setEnCours(false);
    }
  }, [enCours, enCoursPilote, disabled, onClick]);

  const texte = typeof children === 'string' ? children : null;
  const attente = libelleEnCours ?? (texte ? libelleAttente(texte) : null);

  return (
    <button
      type={type}
      onClick={lancer}
      disabled={disabled || enCours}
      aria-busy={enCours || undefined}
      title={title}
      aria-label={ariaLabel}
      data-testid={testid}
      data-en-cours={enCours || undefined}
      className={className}
    >
      {enCours ? <Tourniquet className={tailleIcone} /> : Icone && <Icone className={`${tailleIcone} flex-shrink-0`} />}
      {enCours && attente ? attente : children}
    </button>
  );
}
