import { createPortal } from 'react-dom';
import { montantEnLettresFcfa } from '../../../core/commun/montantEnLettres';
import { LIBELLES_MODE_PAIEMENT, lignesFacture, recapFacture, type LignePanier, type VentePreparee } from '../../../core/ventes';
import type { Client } from '../../../core/clients';
import type { ModePaiement } from '@quinca/shared-types';
import CodeBarres from '../../components/print/CodeBarres';

interface Props {
  preparee: VentePreparee;
  lignes: LignePanier[];
  client: Client | null;
  avoir: number;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  depot: string;
  vendeur: string;
  date: Date;
}

/** Montant à deux décimales, sans devise (la facture annonce « en FCFA » une fois). */
const montant = (valeur: number) => valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Les totaux s'arrêtent au franc : le FCFA n'a pas de centimes. */
const entier = (valeur: number) => Math.round(valeur).toLocaleString('fr-FR');

/** Modes de paiement proposés en pied de facture, hors crédit (porté par COMPTANT / CRÉDIT). */
const MODES_COCHES: ModePaiement[] = ['ESPECES', 'CHEQUE', 'MOBILE_MONEY'];

function Case({ coche, libelle }: { coche: boolean; libelle: string }) {
  return (
    <span className="facture-case-groupe">
      <span className="facture-case-libelle">{libelle}</span>
      <span className="facture-case">{coche ? '✓' : ''}</span>
    </span>
  );
}

/**
 * Facture A4 d'une vente, rendue dans la zone d'impression (seule imprimée).
 * Reprend la mise en page attendue par la maison : cartouches facture / client,
 * lignes en HT, cachet, récapitulatif des montants, montant en toutes lettres
 * et conditions de règlement.
 */
export default function FactureVente({ preparee, lignes, client, avoir, filiale, depot, vendeur, date }: Props) {
  const detail = lignesFacture(lignes, depot);
  const recap = recapFacture(preparee, avoir);

  return createPortal(
    <div id="zone-impression" className="document facture">
      <header className="facture-entete">
        <div className="document-logo">Q.C.F</div>
        <div className="facture-cachet">
          <p className="facture-cachet-nom">{filiale.nom}</p>
          {filiale.telephone && <p>{filiale.telephone}</p>}
        </div>
        <div className="facture-entete-vide">{filiale.adresse}</div>
      </header>

      <div className="facture-haut">
        <div className="facture-haut-gauche">
          <table className="facture-identite">
            <thead>
              <tr><th>FACTURE N°</th><th>DATE</th><th>HEURE</th></tr>
            </thead>
            <tbody>
              <tr>
                <td data-testid="facture-numero">{preparee.numero}</td>
                <td>{date.toLocaleDateString('fr-FR')}</td>
                <td>{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            </tbody>
          </table>
          <table className="facture-operateur">
            <tbody><tr><th>OP. Saisie</th><td>{vendeur || '—'}</td></tr></tbody>
          </table>
        </div>
        <CodeBarres valeur={preparee.numero} avecTexte={false} />
        <table className="facture-client">
          <thead><tr><th colSpan={2}>CLIENT</th></tr></thead>
          <tbody>
            <tr><td colSpan={2} className="facture-client-nom">{client ? client.raison_sociale : 'CLIENT DIVERS'}</td></tr>
            <tr><th>N° RC</th><td>{client?.numero_rc ?? ''}</td></tr>
            <tr><th>N° CC</th><td>{client?.numero_cc ?? ''}</td></tr>
            <tr><th>Adresse</th><td>{client?.adresse ?? ''}</td></tr>
            <tr><th>Contact</th><td>{client?.contact || client?.mobile || ''}</td></tr>
          </tbody>
        </table>
      </div>

      <table className="facture-lignes">
        <thead>
          <tr><th>CODE/RÉF</th><th>DÉSIGNATION</th><th>QTE</th><th>PRIX U. HT</th><th>REMISE</th><th>TOTAL HT</th><th>TVA</th><th>DÉPÔT</th></tr>
        </thead>
        <tbody>
          {detail.map((l) => (
            <tr key={l.code}>
              <td>{l.code}</td>
              <td>{l.designation}</td>
              <td className="num">{montant(l.quantite)}</td>
              <td className="num">{montant(l.prix_unitaire_ht)}</td>
              <td className="num">{montant(l.remise)}</td>
              <td className="num">{montant(l.total_ht)}</td>
              <td className="num">{montant(l.tva)}</td>
              <td>{l.depot}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="facture-bas">
        <div className="facture-signature">
          <p className="facture-signature-titre">CACHET/SIGNATURE</p>
          <div className="facture-signature-cadre" />
        </div>
        <table className="facture-paiement">
          <tbody>
            <tr><th>MONTANT PAYÉ</th><td className="num" data-testid="facture-paye">{entier(recap.montant_paye)}</td></tr>
            <tr><th>RESTE À PAYER</th><td className="num">{entier(recap.reste_a_payer)}</td></tr>
            <tr><th>AVOIR</th><td className="num">{entier(recap.avoir)}</td></tr>
          </tbody>
        </table>
        <div className="facture-totaux-bloc">
          <p className="facture-devise">en FCFA</p>
          <table className="facture-totaux">
            <tbody>
              <tr><th>MONTANT BRUT HT</th><td className="num">{entier(recap.brut_ht)}</td></tr>
              <tr><th>REMISE</th><td className="num">{entier(recap.remise)}</td></tr>
              <tr><th>MONTANT NET HT</th><td className="num">{entier(recap.net_ht)}</td></tr>
              <tr><th>TOTAL TVA</th><td className="num">{entier(recap.tva)}</td></tr>
              <tr className="facture-net"><th>NET À PAYER</th><td className="num" data-testid="facture-net">{entier(recap.net_a_payer)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="facture-arrete">
        <strong>Arrêté la présente facture à la somme de :</strong>
        <br />
        <span data-testid="facture-lettres">{montantEnLettresFcfa(recap.net_a_payer)}</span>
      </p>

      <div className="facture-reglement">
        <em>Conditions de règlement :</em>
        {MODES_COCHES.map((m) => <Case key={m} coche={preparee.mode_paiement === m} libelle={LIBELLES_MODE_PAIEMENT[m]} />)}
        <span className="facture-reglement-nature">
          <Case coche={recap.comptant} libelle="COMPTANT" />
          <Case coche={!recap.comptant} libelle="CRÉDIT" />
        </span>
      </div>
    </div>,
    document.body,
  );
}
