import { totauxCommande, type Fournisseur } from '../../../core/fournisseurs';
import { bonPorteUnPoids, formaterTonnage, poidsLigne, tonnageBon, tonnagePartiel } from '../../../core/articles';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { useCommande, useFournisseur, useLignesCommande, type CommandeVueRow, type LigneCommandeVue } from './hooks';

interface Props {
  commande: CommandeVueRow;
  /** Les lignes du bon, chacune avec le poids de son article : voir `useLignesCommande`. */
  lignes: LigneCommandeVue[];
  fournisseur: Fournisseur | null;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  onClose: () => void;
}

/**
 * Bon de commande fournisseur : la pièce envoyée au fournisseur, avant toute
 * réception. Dès que la marchandise arrive, c'est la facture d'achat qui prend
 * le relais (voir `FactureAchatDocument`).
 */
export default function BonCommandeDocument({ commande, lignes, fournisseur, filiale, onClose }: Props) {
  // Les deux modèles de remise se lisent : les francs du bon d'aujourd'hui, le
  // pourcentage des bons d'avant (voir `totauxCommande`).
  const totaux = totauxCommande({
    remise_montant: commande.remise_montant ?? 0,
    remise_percent: commande.remise_percent ?? 0,
    tva_percent: commande.tva_percent ?? 0,
    lignes,
  });
  const pese = bonPorteUnPoids(lignes);
  const date = commande.date_commande ? new Date(commande.date_commande) : new Date();
  return (
    <DocumentImprimable titre="Bon de commande fournisseur" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <table style={{ width: '45%', margin: 0 }}>
          <thead><tr><th>Commande n°</th><th>Date</th><th>Heure</th></tr></thead>
          <tbody>
            <tr><td className="num">{commande.numero}</td><td>{date.toLocaleDateString('fr-FR')}</td><td>{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td></tr>
            <tr><td colSpan={3}>Op. saisie : {[commande.utilisateur_prenom, commande.utilisateur_nom].filter(Boolean).join(' ')}{commande.date_livraison_prevue ? ` · Livraison prévue le ${formaterDate(commande.date_livraison_prevue)}` : ''}</td></tr>
          </tbody>
        </table>
        <table style={{ width: '45%', margin: 0 }}>
          <thead><tr><th colSpan={2}>Fournisseur</th></tr></thead>
          <tbody>
            <tr><td colSpan={2}><strong>{commande.fournisseur_nom}</strong></td></tr>
            <tr><td>N° RC</td><td>{fournisseur?.numero_rc ?? ''}</td></tr>
            <tr><td>N° CC</td><td>{fournisseur?.numero_cc ?? ''}</td></tr>
            <tr><td>Adresse</td><td>{fournisseur?.adresse ?? ''}</td></tr>
            <tr><td>Contact</td><td>{[fournisseur?.interlocuteur, fournisseur?.mobile_interlocuteur ?? fournisseur?.telephone].filter(Boolean).join(' · ')}</td></tr>
          </tbody>
        </table>
      </div>
      <table>
        {/* Le poids ne s'imprime que si la marchandise est pesée : c'est le
            chiffre que le transporteur réclame, inutile ailleurs. */}
        <thead><tr><th>Code / Réf.</th><th>Désignation</th><th>Qté</th>{pese && <th>Poids</th>}<th>Prix U. HT</th><th>Remise</th><th>Total HT</th></tr></thead>
        <tbody>{lignes.map((l) => <tr key={l.id}><td>{l.code_article}</td><td>{l.designation}</td><td className="num">{l.quantite} {l.unite}</td>{pese && <td className="num">{formaterTonnage(poidsLigne(l))}</td>}<td className="num">{formaterFcfa(l.prix_unitaire_ht)}</td><td className="num">{l.remise_montant ? formaterFcfa(l.remise_montant) : l.remise_percent ? `${l.remise_percent} %` : '—'}</td><td className="num">{formaterFcfa(l.total_ht)}</td></tr>)}</tbody>
      </table>
      <div className="document-cartouches">
        <div>
          <table style={{ width: '70mm', margin: 0 }}><thead><tr><th>Cachet / Signature</th></tr></thead><tbody><tr><td className="document-signature" /></tr></tbody></table>
        </div>
        <table className="document-totaux" style={{ margin: 0 }}>
          <tbody>
            {pese && (
              <tr>
                <td>Poids total{tonnagePartiel(lignes) ? ' (articles pesés)' : ''}</td>
                <td className="num" data-testid="commande-tonnage">{formaterTonnage(tonnageBon(lignes))}</td>
              </tr>
            )}
            <tr><td>Montant brut HT</td><td className="num">{formaterFcfa(totaux.brut_ht)}</td></tr>
            <tr><td>Remise{commande.remise_montant ? ' globale' : commande.remise_percent ? ` (${commande.remise_percent} %)` : ''}</td><td className="num">{formaterFcfa(totaux.remise)}</td></tr>
            <tr><td>Montant net HT</td><td className="num">{formaterFcfa(totaux.net_ht)}</td></tr>
            <tr><td>Total TVA{commande.tva_percent ? ` (${commande.tva_percent} %)` : ''}</td><td className="num">{formaterFcfa(totaux.tva)}</td></tr>
            <tr><td><strong>Net à payer</strong></td><td className="num">{formaterFcfa(totaux.net_a_payer)}</td></tr>
          </tbody>
        </table>
      </div>
      {commande.notes && <p><em>{commande.notes}</em></p>}
      <p style={{ textAlign: 'right', fontSize: 10 }}>en FCFA</p>
    </DocumentImprimable>
  );
}

/** Bon d'une commande déjà enregistrée, relu depuis la base locale. */
export function BonCommandeImprimable({ commandeId, filiale, onClose }: { commandeId: string; filiale: Props['filiale']; onClose: () => void }) {
  const commande = useCommande(commandeId);
  const lignes = useLignesCommande(commandeId);
  const fournisseur = useFournisseur(commande?.fournisseur_id ?? null);
  if (!commande) return null;
  return <BonCommandeDocument commande={commande} lignes={lignes} fournisseur={fournisseur} filiale={filiale} onClose={onClose} />;
}
