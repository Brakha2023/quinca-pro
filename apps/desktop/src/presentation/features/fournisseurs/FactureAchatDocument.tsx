import { LIBELLES_NATURE_FACTURE, construireFactureAchat, type FactureAchat } from '../../../core/fournisseurs';
import CodeBarres from '../../components/print/CodeBarres';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useCommande, useFournisseur, useLignesCommande } from './hooks';

interface Props {
  facture: FactureAchat;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  onClose: () => void;
}

/** « trente-trois millions… » → « Trente-trois millions… » : une phrase, pas un titre. */
const premiereMajuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

const Case = ({ coche = false, libelle }: { coche?: boolean; libelle: string }) => (
  <span className="document-case">{libelle} <i>{coche ? '✕' : ''}</i></span>
);

/**
 * Facture d'achat fournisseur : la pièce qui constate la dette, classée avec
 * le BL du fournisseur. Elle ne porte que la marchandise **reçue** (voir
 * `construireFactureAchat`), le net à payer y figure aussi en toutes lettres —
 * c'est lui qui fait foi en cas de rature —, et les conditions de règlement se
 * cochent : le mode (espèce, chèque, virement) se décide au paiement, mais
 * comptant ou crédit se lit déjà sur le compte du fournisseur.
 */
export default function FactureAchatDocument({ facture, filiale, onClose }: Props) {
  const date = new Date(facture.date);

  return (
    <DocumentImprimable titre="Facture d'achat fournisseur" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <table style={{ width: '45%', margin: 0 }}>
          <thead>
            <tr><th>Facture d'achat n°</th><th>Date</th><th>Heure</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className="document-code" data-testid="facture-numero">{facture.numero}</td>
              <td>{date.toLocaleDateString('fr-FR')}</td>
              <td>{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
            <tr><th>Op. saisie</th><td colSpan={2}>{facture.operateur}</td></tr>
            <tr><th>Dépôt</th><td colSpan={2}>{facture.depot}</td></tr>
            <tr><th>Conditionnement</th><td colSpan={2}>{LIBELLES_NATURE_FACTURE[facture.nature]}</td></tr>
          </tbody>
        </table>

        <div style={{ alignSelf: 'center' }}><CodeBarres valeur={facture.numero} /></div>

        <table style={{ width: '40%', margin: 0 }}>
          <thead><tr><th colSpan={2}>Fournisseur</th></tr></thead>
          <tbody>
            <tr><td colSpan={2} style={{ textAlign: 'center' }}><strong>{facture.fournisseur.raison_sociale}</strong></td></tr>
            <tr><th>N° RC</th><td>{facture.fournisseur.numero_rc ?? ''}</td></tr>
            <tr><th>N° CC</th><td>{facture.fournisseur.numero_cc ?? ''}</td></tr>
            <tr><th>Adresse</th><td>{facture.fournisseur.adresse ?? ''}</td></tr>
            <tr><th>Contact</th><td>{facture.fournisseur.contact ?? ''}</td></tr>
          </tbody>
        </table>
      </div>

      <table className="document-liste">
        <thead>
          <tr>
            <th>Code / Réf.</th>
            <th>Désignation</th>
            <th className="num">Qté</th>
            <th className="num">Prix U. HT</th>
            <th className="num">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {facture.lignes.map((l) => (
            <tr key={l.id} data-testid="ligne-facture">
              <td className="document-code">{l.code}</td>
              <td>{l.designation}</td>
              <td className="num">{l.quantite.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
              <td className="num">{formaterFcfa(l.prix_unitaire_ht)}</td>
              <td className="num">{formaterFcfa(l.total_ht)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="document-liste-pied">
              Facture d'achat {facture.numero} · {facture.fournisseur.raison_sociale} · {filiale.nom}
            </td>
          </tr>
        </tfoot>
      </table>

      {facture.partielle && (
        <p style={{ fontSize: 10, margin: '4px 0' }}>
          <em>Réception partielle : cette facture ne porte que la marchandise reçue à ce jour.</em>
        </p>
      )}

      <div className="document-cartouches">
        <table style={{ width: '70mm', margin: 0 }}>
          <thead><tr><th>Cachet / Signature</th></tr></thead>
          <tbody><tr><td className="document-signature" /></tr></tbody>
        </table>
        <div style={{ width: '75mm' }}>
          <p className="recu-devise">en FCFA</p>
          <table className="document-totaux" style={{ margin: 0, width: '100%' }}>
            <tbody>
              <tr><td>Montant brut HT</td><td className="num">{formaterFcfa(facture.totaux.brut_ht)}</td></tr>
              <tr><td>Remise{facture.remise_percent ? ` (${facture.remise_percent} %)` : ''}</td><td className="num">{formaterFcfa(facture.totaux.remise)}</td></tr>
              <tr><td>Montant net HT</td><td className="num">{formaterFcfa(facture.totaux.net_ht)}</td></tr>
              <tr><td>Total TVA{facture.tva_percent ? ` (${facture.tva_percent} %)` : ''}</td><td className="num">{formaterFcfa(facture.totaux.tva)}</td></tr>
              <tr><td><strong>Net à payer</strong></td><td className="num" data-testid="facture-net"><strong>{formaterFcfa(facture.totaux.net_a_payer)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="document-arrete">
        <span>Arrêté la présente facture à la somme de :</span>
        <strong>{premiereMajuscule(facture.montant_en_lettres)}</strong>
      </p>

      <div className="document-cases">
        <span><em>Conditions de règlement :</em></span>
        <Case libelle="Espèce" />
        <Case libelle="Chèque" />
        <Case libelle="Virement" />
        <span style={{ marginLeft: 12 }} />
        <Case libelle="COMPTANT" coche={facture.reglement === 'COMPTANT'} />
        <Case libelle="CRÉDIT" coche={facture.reglement === 'CREDIT'} />
        {facture.reste_a_payer > 0 && <span>Reste à payer : <strong>{formaterFcfa(facture.reste_a_payer)}</strong></span>}
      </div>

      {facture.notes && <p style={{ fontSize: 10 }}><em>{facture.notes}</em></p>}
    </DocumentImprimable>
  );
}

/** Facture d'une pièce déjà enregistrée, reconstruite depuis la base locale. */
export function FactureAchatImprimable({ commandeId, filiale, onClose }: { commandeId: string; filiale: Props['filiale']; onClose: () => void }) {
  const commande = useCommande(commandeId);
  const lignes = useLignesCommande(commandeId);
  const fournisseur = useFournisseur(commande?.fournisseur_id ?? null);
  if (!commande) return null;

  const facture = construireFactureAchat(
    {
      commande: {
        numero: commande.numero ?? '',
        date_commande: commande.date_commande ?? '',
        date_reception: commande.date_reception,
        type: commande.type === 'BON_COMMANDE' ? 'BON_COMMANDE' : 'COMMANDE',
        remise_percent: commande.remise_percent ?? 0,
        tva_percent: commande.tva_percent ?? 0,
        montant_paye: commande.montant_paye ?? 0,
        reste_a_payer: commande.reste_a_payer ?? 0,
        notes: commande.notes,
      },
      depot: commande.depot_nom,
      fournisseur_nom: commande.fournisseur_nom,
      operateur: [commande.utilisateur_prenom, commande.utilisateur_nom].filter(Boolean).join(' ') || null,
    },
    lignes,
    fournisseur,
  );
  return <FactureAchatDocument facture={facture} filiale={filiale} onClose={onClose} />;
}
