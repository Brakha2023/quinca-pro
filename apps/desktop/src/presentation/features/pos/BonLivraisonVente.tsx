import { recapBonLivraison, type LigneBonLivraison, type LivraisonDemande } from '../../../core/ventes';
import CorpsDocument from '../../components/print/CorpsDocument';
import { formaterDate } from '../../hooks/useFormatage';
import type { ClientFacture } from './FactureVente';

interface Props {
  /** Numéro de la vente : c'est sur lui que le magasin rapproche le bon. */
  numeroVente: string;
  /** Numéro du bon lui-même, quand une livraison a été créée avec la vente. */
  numero?: string | null;
  date: Date;
  vendeur: string;
  client: ClientFacture | null;
  lignes: LigneBonLivraison[];
  /** Livraison demandée au comptoir : adresse, date prévue, chauffeur. */
  livraison?: LivraisonDemande | null;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/**
 * Bon de livraison d'une vente : la pièce qui accompagne la marchandise.
 *
 * Elle ne porte **aucun prix**. L'argent est l'affaire de la facture ; ce bon
 * dit ce qui sort, de quel dépôt, et qui l'a reçu — c'est lui qu'on signe à la
 * remise et qui revient au magasin. Un bon chiffré se lirait comme une
 * seconde demande de paiement.
 */
export default function BonLivraisonVente({ numeroVente, numero, date, vendeur, client, lignes, livraison, filiale }: Props) {
  const recap = recapBonLivraison(lignes);
  return (
    <CorpsDocument titre="Bon de livraison" nature="bon_livraison" filiale={filiale}>
      <div className="document-cartouches">
        <table style={{ width: '45%', margin: 0 }}>
          <thead><tr><th>{numero ? 'Bon n°' : 'Facture n°'}</th><th>Date</th><th>Heure</th></tr></thead>
          <tbody>
            <tr>
              <td className="num" data-testid="bl-numero">{numero ?? numeroVente}</td>
              <td>{date.toLocaleDateString('fr-FR')}</td>
              <td>{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
            <tr><td colSpan={3}>Facture n° {numeroVente} · Op. saisie : {vendeur || '—'}</td></tr>
          </tbody>
        </table>
        <table style={{ width: '45%', margin: 0 }}>
          <thead><tr><th colSpan={2}>Client</th></tr></thead>
          <tbody>
            <tr><td colSpan={2}><strong>{client ? client.raison_sociale : 'CLIENT DIVERS'}</strong></td></tr>
            <tr><td>Adresse</td><td>{livraison?.adresse_livraison || client?.adresse || ''}</td></tr>
            <tr><td>Contact</td><td>{client?.contact || client?.mobile || ''}</td></tr>
          </tbody>
        </table>
      </div>

      {livraison && (
        <p className="document-bloc" data-testid="bl-livraison">
          <strong>Livraison prévue le {formaterDate(livraison.date_livraison_prevue)}</strong>
          {livraison.chauffeur ? ` · Chauffeur : ${livraison.chauffeur}` : ''}
          {livraison.vehicule ? ` · Véhicule : ${livraison.vehicule}` : ''}
        </p>
      )}

      <table>
        <thead><tr><th>Code / Réf.</th><th>Désignation</th><th>Qté</th><th>Unité</th><th>Dépôt</th></tr></thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.code}>
              <td>{l.code}</td>
              <td>{l.designation}</td>
              <td className="num">{l.quantite.toLocaleString('fr-FR')}</td>
              <td>{l.unite}</td>
              <td>{l.depot}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 11 }} data-testid="bl-recap">
        {recap.lignes} ligne(s) · {recap.articles.toLocaleString('fr-FR')} article(s) à charger.
      </p>

      <div className="document-cartouches">
        <table style={{ width: '45%', margin: 0 }}>
          <thead><tr><th>Le magasinier</th></tr></thead>
          <tbody><tr><td className="document-signature" /></tr></tbody>
        </table>
        <table style={{ width: '45%', margin: 0 }}>
          <thead><tr><th>Le client — reçu en bon état</th></tr></thead>
          <tbody><tr><td className="document-signature" /></tr></tbody>
        </table>
      </div>
    </CorpsDocument>
  );
}
