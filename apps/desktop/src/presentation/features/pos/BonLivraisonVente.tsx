import { recapBonLivraison, type LigneBonLivraison, type LivraisonDemande } from '../../../core/ventes';
import CodeBarres from '../../components/print/CodeBarres';
import CorpsDocument from '../../components/print/CorpsDocument';
import { formaterDate } from '../../hooks/useFormatage';
import type { ClientFacture } from './FactureVente';

interface Props {
  /** Numéro de la vente : c'est sur lui que le magasin rapproche le bon. */
  numeroVente: string;
  /** Numéro du bon lui-même, quand une livraison a été créée avec la vente. */
  numero?: string | null;
  /**
   * Numéro court du bon (`LIV-AN8-000012`), ou celui de la vente quand la
   * livraison n'a pas de bon à elle : c'est lui qui s'imprime en tête.
   */
  numeroCourt?: string | null;
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
 *
 * Trois cachets, et non deux : le magasinier qui charge, le gestionnaire de
 * stock qui vise la sortie, le client qui reçoit. C'est le visa du milieu qui
 * permet de savoir, devant une contestation, si la marchandise est partie
 * du dépôt ou si elle n'y est jamais passée.
 */
export default function BonLivraisonVente({ numeroVente, numero, numeroCourt, date, vendeur, client, lignes, livraison, filiale }: Props) {
  const recap = recapBonLivraison(lignes);
  // Le bon se douchette à la sortie : s'il porte son propre numéro, c'est lui
  // que la barre encode ; sinon c'est la vente, seul repère qui existe alors.
  const reference = numero ?? numeroVente;
  return (
    <CorpsDocument titre="Bon de livraison" nature="bon_livraison" filiale={filiale}>
      <p className="document-reference">
        {numero ? 'Bon n° ' : 'Facture n° '}
        <span data-testid="bl-numero">{numeroCourt || reference}</span>
        {numero ? ` · Facture n° ${numeroVente}` : ''}
      </p>

      <div className="document-cartouches">
        <table style={{ width: '42%', margin: 0 }}>
          <thead><tr><th>Date</th><th>Heure</th><th>Op. saisie</th></tr></thead>
          <tbody>
            <tr>
              <td>{date.toLocaleDateString('fr-FR')}</td>
              <td>{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>{vendeur || '—'}</td>
            </tr>
          </tbody>
        </table>
        <CodeBarres valeur={reference} />
        <table style={{ width: '42%', margin: 0 }}>
          <thead><tr><th colSpan={2}>Client</th></tr></thead>
          <tbody>
            <tr><td colSpan={2}><strong>{client ? client.raison_sociale : 'CLIENT DIVERS'}</strong></td></tr>
            <tr><th>Adresse</th><td>{livraison?.adresse_livraison || client?.adresse || '—'}</td></tr>
            <tr><th>Contact</th><td>{client?.contact || client?.mobile || '—'}</td></tr>
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

      <div className="document-cachets">
        {/* Le modèle de la maison intitule ses trois cadres « cachet /
            signature », « visa gestionnaire de stock » et « cachet client ».
            On garde les trois cadres et on nomme qui signe : devant un litige,
            « Le magasinier » dit ce qu'un cachet anonyme laisse deviner. */}
        <div className="document-cachet"><p className="document-cachet-titre">Le magasinier</p></div>
        <div className="document-cachet"><p className="document-cachet-titre">Visa gestionnaire de stock</p></div>
        <div className="document-cachet"><p className="document-cachet-titre">Le client — reçu en bon état</p></div>
      </div>
      <p className="document-note" style={{ textAlign: 'right' }}>le {formaterDate(date.toISOString())}</p>
    </CorpsDocument>
  );
}
