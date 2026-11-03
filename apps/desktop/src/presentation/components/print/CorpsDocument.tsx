import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { enteteDocument } from '../../../core/parametres';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { useEntrepriseDocument } from '../../features/parametres/hooks';

interface Props {
  titre: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  /**
   * Nature de la pièce (voir `NATURES_DOCUMENTS`) : décide du logo et du
   * filigrane réglés dans Paramètres → Documents & impressions. Absente, la
   * pièce prend l'en-tête complet sans filigrane.
   */
  nature?: string;
  /**
   * Feuille couchée. Laissée de côté, l'orientation se décide toute seule :
   * la feuille est mesurée, et elle se couche si son tableau le plus large ne
   * tient pas debout. Passer `true` ou `false` tranche à la main.
   */
  paysage?: boolean;
  children: ReactNode;
}

/**
 * La feuille doit-elle se coucher ?
 *
 * On mesure la largeur **naturelle** de chaque tableau — celle qu'il prendrait
 * si rien ne le contraignait — et on la compare à ce que la feuille offre
 * debout. Un tableau qui dépasse n'est pas perdu pour autant : le navigateur
 * le resserre en repliant le texte de ses cellules. Mais une liste de gestion
 * resserrée devient une bouillie de mots coupés, là où la même liste tient à
 * l'aise en travers de la page.
 *
 * La mesure se fait toujours en portrait : prise sur une feuille déjà couchée,
 * elle conclurait que tout tient et la feuille se redresserait aussitôt, pour
 * se recoucher au rendu suivant.
 */
function tableauTropLarge(feuille: HTMLElement): boolean {
  const style = getComputedStyle(feuille);
  const disponible = feuille.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  if (disponible <= 0) return false;
  for (const table of feuille.querySelectorAll('table')) {
    const avant = table.style.width;
    table.style.width = 'max-content';
    const naturelle = table.offsetWidth;
    table.style.width = avant;
    // Une tolérance d'un point : une feuille ne se couche pas pour un arrondi.
    if (naturelle > disponible + 1) return true;
  }
  return false;
}

/**
 * Une feuille A4 à l'identité de la maison : en-tête, titre, contenu,
 * mentions légales. Sans portail ni barre d'outils — c'est l'appelant qui
 * décide où elle est rendue, seule dans un aperçu (`DocumentImprimable`) ou à
 * la file dans une liasse (plusieurs feuilles en une impression).
 *
 * L'en-tête vient de **Paramètres → Entreprise** : raison sociale, adresse,
 * identifiants fiscaux, logo, mentions légales. Vingt-sept documents passent
 * par ici, et c'est voulu — l'identité de la maison s'y règle une fois.
 *
 * Si la fiche n'est pas encore arrivée sur le poste, la pièce s'imprime quand
 * même avec ce que porte la filiale : un document incomplet vaut mieux qu'un
 * document impossible.
 */
export default function CorpsDocument({ titre, filiale, nature, paysage, children }: Props) {
  const { filialeId } = useFilialeCourante();
  const entreprise = useEntrepriseDocument(filialeId);
  const entete = enteteDocument(entreprise, filiale, nature ? entreprise?.documents[nature] : undefined);

  const feuille = useRef<HTMLDivElement>(null);
  /*
   * L'orientation est une conséquence de la mise en page, pas un état de
   * l'application : elle se pose donc sur le nœud, après le rendu et avant
   * l'affichage, sans repasser par React. Une mesure rangée dans un `useState`
   * demanderait un second rendu à chaque fois pour n'apprendre à React que ce
   * que le navigateur venait déjà de calculer.
   *
   * L'effet tourne après chaque rendu : si le contenu de la feuille change —
   * un filtre, une ligne de plus —, la mesure est refaite. `paysage` fourni,
   * on ne mesure rien : l'appelant a tranché.
   */
  useLayoutEffect(() => {
    const el = feuille.current;
    if (paysage !== undefined || !el) return;
    el.classList.remove('document-paysage');
    if (tableauTropLarge(el)) el.classList.add('document-paysage');
    el.dataset.orientation = el.classList.contains('document-paysage') ? 'paysage' : 'portrait';
  });

  return (
    <div
      ref={feuille}
      className={`document${paysage ? ' document-paysage' : ''}`}
      data-orientation={paysage === undefined ? undefined : paysage ? 'paysage' : 'portrait'}
    >
      {entete.filigrane && <img src={entete.filigrane} alt="" aria-hidden className="document-filigrane" />}
      <header className="document-entete">
        {entete.logo
          ? <img src={entete.logo} alt="" className="document-logo-image" data-testid="document-logo" />
          : <div className="document-logo">{entete.initiales}</div>}
        <div className="document-societe">
          <p className="document-societe-nom">{entete.nom}</p>
          {entete.raison_sociale && entete.raison_sociale !== entete.nom && <p>{entete.raison_sociale}</p>}
          {entete.adresse && <p>{entete.adresse}{entete.ville ? ` — ${entete.ville}` : ''}</p>}
          {entete.telephone && <p>Tél. {entete.telephone}{entete.email ? ` · ${entete.email}` : ''}</p>}
          {entete.identifiants && <p className="document-societe-identifiants" data-testid="document-identifiants">{entete.identifiants}</p>}
        </div>
      </header>
      <h1 className="document-titre">{titre}</h1>
      {children}
      {entete.mentions_legales && (
        <p className="document-mentions" data-testid="document-mentions">{entete.mentions_legales}</p>
      )}
    </div>
  );
}
