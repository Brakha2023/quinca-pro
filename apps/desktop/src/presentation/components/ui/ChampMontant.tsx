import { useEffect, useRef, useState } from 'react';
import { grouperMilliers, lireMontant } from '../../../core/commun/prix';

/**
 * Saisie d'un montant en francs, groupé par milliers pendant la frappe.
 *
 * Un caissier tape « 1250000 » et doit lire **1 250 000** : sans les groupes,
 * un zéro de trop passe inaperçu, et c'est le genre d'erreur qu'on ne retrouve
 * qu'au comptage du soir. Le champ reste un `text` — un `number` natif refuse
 * les espaces et sort ses petites flèches, inutiles au comptoir.
 *
 * Le FCFA n'a pas de centimes : seuls les chiffres sont retenus. On peut donc
 * coller « 1 250 000 F » ou « 1.250.000 », il en sortira 1250000.
 */
interface Props {
  valeur: number;
  onChange: (valeur: number) => void;
  /** Rendu vide tant que rien n'est saisi, au lieu d'un « 0 » à effacer. */
  zeroVide?: boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  title?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  'data-testid'?: string;
}

export default function ChampMontant({ valeur, onChange, zeroVide = false, className = '', ...reste }: Props) {
  const [texte, setTexte] = useState(() => (zeroVide && valeur === 0 ? '' : grouperMilliers(valeur)));
  const champ = useRef<HTMLInputElement>(null);
  /** Vrai pendant que l'utilisateur tape : la valeur du parent ne reprend pas la main. */
  const saisieEnCours = useRef(false);

  // Le parent peut imposer un montant (bouton « Compte juste », reprise d'un
  // brouillon, remise commerciale d'un client) : le champ suit, sauf en pleine
  // frappe, où il écraserait ce qui est en train d'être tapé.
  useEffect(() => {
    if (!saisieEnCours.current) setTexte(zeroVide && valeur === 0 ? '' : grouperMilliers(valeur));
  }, [valeur, zeroVide]);

  return (
    <input
      {...reste}
      ref={champ}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={texte}
      className={className}
      onChange={(e) => {
        saisieEnCours.current = true;
        const montant = lireMontant(e.target.value);
        setTexte(e.target.value === '' ? '' : grouperMilliers(montant));
        onChange(montant);
        // Le regroupement réécrit la chaîne : sans cela le curseur reviendrait
        // se placer avant l'espace qu'on vient d'insérer.
        requestAnimationFrame(() => {
          const el = champ.current;
          if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
          saisieEnCours.current = false;
        });
      }}
      onBlur={() => {
        saisieEnCours.current = false;
        setTexte(zeroVide && valeur === 0 ? '' : grouperMilliers(valeur));
      }}
    />
  );
}
