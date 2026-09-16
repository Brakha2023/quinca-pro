import { Fragment } from 'react';
import { createPortal } from 'react-dom';
import { calculerLigne, LIBELLES_MODE_PAIEMENT, type LignePanier, type VentePreparee } from '../../../core/ventes';
import type { Client } from '../../../core/clients';
import { formaterFcfa } from '../../hooks/useFormatage';

interface Props {
  preparee: VentePreparee;
  lignes: LignePanier[];
  client: Client | null;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  caisse: string;
  vendeur: string;
  date: Date;
}

/**
 * Ticket de caisse, rendu dans une zone dédiée qui seule est imprimée
 * (voir `@media print` dans index.css). Format 80 mm.
 */
export default function TicketImprimable({ preparee, lignes, client, filiale, caisse, vendeur, date }: Props) {
  const t = preparee.totaux;
  return createPortal(
    <div id="zone-impression" className="ticket">
      <div className="ticket-entete">
        <p className="ticket-titre">{filiale.nom}</p>
        {filiale.adresse && <p>{filiale.adresse}</p>}
        {filiale.telephone && <p>Tél. {filiale.telephone}</p>}
      </div>
      <p className="ticket-ligne-sep" />
      <p>Ticket : <strong>{preparee.numero}</strong></p>
      <p>{date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      <p>Caisse : {caisse} · {vendeur}</p>
      <p>Client : {client ? client.raison_sociale : 'Comptoir'}</p>
      <p className="ticket-ligne-sep" />
      <table className="ticket-table">
        <tbody>
          {lignes.map((l) => {
            const c = calculerLigne(l);
            return (
              <Fragment key={l.article_id}>
                <tr><td colSpan={2}>{l.designation}{l.remise_percent ? ` (−${l.remise_percent}%)` : ''}</td></tr>
                <tr><td>{l.quantite} × {formaterFcfa(l.prix_unitaire_ttc)}</td><td className="ticket-droite">{formaterFcfa(c.total_ttc)}</td></tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="ticket-ligne-sep" />
      <table className="ticket-table">
        <tbody>
          <tr><td>Total HT</td><td className="ticket-droite">{formaterFcfa(t.total_net_ht)}</td></tr>
          {t.total_remise > 0 && <tr><td>Remise</td><td className="ticket-droite">−{formaterFcfa(t.total_remise)}</td></tr>}
          <tr><td>TVA</td><td className="ticket-droite">{formaterFcfa(t.total_tva)}</td></tr>
          <tr className="ticket-total"><td>TOTAL TTC</td><td className="ticket-droite">{formaterFcfa(t.total_ttc)}</td></tr>
          <tr><td>{LIBELLES_MODE_PAIEMENT[preparee.mode_paiement]}</td><td className="ticket-droite">{formaterFcfa(preparee.montant_percu)}</td></tr>
          {preparee.monnaie > 0 && <tr><td>Rendu</td><td className="ticket-droite">{formaterFcfa(preparee.monnaie)}</td></tr>}
          {preparee.reste_a_payer > 0 && <tr><td>Reste dû (crédit)</td><td className="ticket-droite">{formaterFcfa(preparee.reste_a_payer)}</td></tr>}
        </tbody>
      </table>
      <p className="ticket-ligne-sep" />
      <p className="ticket-pied">Merci de votre visite</p>
    </div>,
    document.body,
  );
}
