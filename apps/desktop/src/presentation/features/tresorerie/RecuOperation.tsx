import { montantEnLettresFcfa } from '../../../core/commun/montantEnLettres';
import CodeBarres from '../../components/print/CodeBarres';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterFcfa } from '../../hooks/useFormatage';

export interface DonneesRecu {
  /** Titre imprimé en bandeau : « Reçu de versement », « Reçu de retrait »… */
  titre: string;
  /** Numéro de pièce, repris en clair et en code-barres. */
  code: string;
  date: string;
  /** En-tête du cartouche de gauche : « Informations client », « Bénéficiaire »… */
  libelleTiers: string;
  tiersNom: string;
  tiersCompte?: string | null;
  montant: number;
  mode: string;
  designation: string;
  observation?: string;
  caisse: string;
  operateur: string;
  /** Qui signe à droite : « Signature du client (ou remettant) », « du bénéficiaire »… */
  signatureTiers: string;
}

const formaterJour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Reçu de caisse A4 : cartouche du tiers à gauche, montant encadré à droite,
 * montant en toutes lettres, code-barres de la pièce et double signature.
 * Sert au versement, au retrait et à l'entrée en caisse.
 */
export default function RecuOperation({
  recu, filiale, onClose,
}: {
  recu: DonneesRecu;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  onClose: () => void;
}) {
  return (
    <DocumentImprimable titre={recu.titre} filiale={filiale} onClose={onClose}>
      <div className="recu-corps">
        <div className="recu-tiers">
          <p className="recu-tiers-titre">{recu.libelleTiers}</p>
          <dl>
            <div className="recu-ligne"><dt>N° Compte</dt><dd>{recu.tiersCompte || '—'}</dd></div>
            <div className="recu-ligne"><dt>Nom et prénom(s)</dt><dd>{recu.tiersNom}</dd></div>
            <div className="recu-ligne"><dt>Caisse</dt><dd>{recu.caisse}</dd></div>
          </dl>
        </div>
        <div className="recu-chiffres">
          <dl>
            <div className="recu-ligne"><dt>Date</dt><dd>{formaterJour(recu.date)}</dd></div>
            <div className="recu-ligne"><dt>Code reçu</dt><dd>{recu.code}</dd></div>
          </dl>
          <p className="recu-devise">En FCFA</p>
          <p className="recu-montant">{formaterFcfa(recu.montant)}</p>
          <p className="recu-devise">{recu.mode}</p>
        </div>
      </div>

      {/* Le montant en lettres est ce qui fait foi en cas de rature sur les chiffres. */}
      <p className="recu-lettres">Arrêté la présente somme à : <strong>{montantEnLettresFcfa(recu.montant)}</strong>.</p>

      <div>
        <span className="recu-encadre-titre">Désignation</span>
        <div className="recu-encadre">{recu.designation || '—'}</div>
      </div>

      <div className="recu-pied">
        <div style={{ flex: 1 }}>
          <span className="recu-encadre-titre">Observation</span>
          <div className="recu-encadre">{recu.observation || ''}</div>
        </div>
        <CodeBarres valeur={recu.code} />
      </div>

      <div className="recu-signatures">
        <span>Signature et cachet caisse</span>
        <span>{recu.signatureTiers}</span>
      </div>

      <p className="recu-decoupe">Opérateur : {recu.operateur} · Pièce {recu.code} · {filiale.nom}</p>
    </DocumentImprimable>
  );
}
