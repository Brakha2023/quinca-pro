import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline';
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
  onClose: () => void;
  children: ReactNode;
}

/**
 * Aperçu plein écran d'un document A4 (bon de commande, balance, relevé…),
 * rendu dans la zone d'impression : à l'impression, seule cette zone sort
 * (voir `@media print`), sans la barre d'outils.
 *
 * L'en-tête vient de **Paramètres → Entreprise** : raison sociale, adresse,
 * identifiants fiscaux, logo, mentions légales. Vingt-sept documents passent
 * par ici, et c'est voulu — l'identité de la maison s'y règle une fois.
 *
 * Si la fiche n'est pas encore arrivée sur le poste, la pièce s'imprime quand
 * même avec ce que porte la filiale : un document incomplet vaut mieux qu'un
 * document impossible.
 */
export default function DocumentImprimable({ titre, filiale, nature, onClose, children }: Props) {
  const { filialeId } = useFilialeCourante();
  const entreprise = useEntrepriseDocument(filialeId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reglage = nature ? entreprise?.documents[nature] : undefined;
  const entete = enteteDocument(entreprise, filiale, reglage);

  return createPortal(
    <div id="zone-impression" className="apercu-impression" role="dialog" aria-label={`Aperçu — ${titre}`}>
      <div className="apercu-barre">
        <span>{titre}</span>
        <div>
          <button type="button" onClick={() => window.print()} className="apercu-bouton apercu-bouton-primaire"><PrinterIcon className="w-4 h-4" /> Imprimer</button>
          <button type="button" onClick={onClose} className="apercu-bouton" aria-label="Fermer l'aperçu"><XMarkIcon className="w-4 h-4" /> Fermer</button>
        </div>
      </div>
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
    </div>,
    document.body,
  );
}
