import type { ReactNode } from 'react';
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
  children: ReactNode;
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
export default function CorpsDocument({ titre, filiale, nature, children }: Props) {
  const { filialeId } = useFilialeCourante();
  const entreprise = useEntrepriseDocument(filialeId);
  const entete = enteteDocument(entreprise, filiale, nature ? entreprise?.documents[nature] : undefined);

  return (
    <div className="document">
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
