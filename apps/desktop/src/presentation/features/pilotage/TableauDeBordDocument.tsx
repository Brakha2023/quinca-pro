import { formaterFcfa, formaterPourcentage } from '../../../core/commun/prix';
import {
  CONSEILS_ETAT_STOCK, type Fenetre, type Indicateurs,
} from '../../../core/pilotage';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import type { LecturePilotage } from './hooks';

interface Props {
  fenetre: Fenetre;
  filialeId: string | null;
  /** La même lecture que l'écran : la feuille ne relit pas la base. */
  lecture: LecturePilotage;
  /** Vue groupe : toutes les filiales ; sinon, la seule regardée. */
  filiales: Indicateurs[];
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  onClose: () => void;
}

/**
 * Le tableau de bord sur une feuille.
 *
 * Pas de graphiques : sur du papier noir et blanc, une barre orange et une
 * barre bleue se ressemblent. Ce qui part en réunion, ce sont les chiffres —
 * les mêmes que l'écran, calculés par le même code — et le détail par filiale.
 */
export default function TableauDeBordDocument({ fenetre, filialeId, lecture, filiales, filiale, onClose }: Props) {
  const { total, repartition, anciennete } = lecture;
  const edite = new Date().toLocaleString('fr-FR');

  const ligne = (label: string, valeur: string, precision?: string) => (
    <tr>
      <td>{label}{precision && <><br /><span style={{ fontSize: 9 }}>{precision}</span></>}</td>
      <td className="num" style={{ fontWeight: 'bold' }}>{valeur}</td>
    </tr>
  );

  return (
    <DocumentImprimable titre="Tableau de bord" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Période</strong>
          <br />{fenetre.libelle}
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Périmètre</strong>
          <br />{filialeId ? filiale.nom : `Groupe · ${filiales.length} filiale(s)`}
          <br />{total.ventes} vente(s) · {total.clients_servis} client(s) servi(s)
        </div>
        <div className="document-bloc" style={{ width: '62mm' }}>
          <strong>Résultat estimé</strong>
          <br />{formaterFcfa(total.resultat)}
          <br /><span style={{ fontSize: 9 }}>marge {formaterFcfa(total.marge)} − dépenses {formaterFcfa(total.charges)}</span>
        </div>
      </div>

      <table className="document-liste" style={{ width: '48%', float: 'left' }}>
        <thead><tr><th style={{ textAlign: 'left' }}>Exploitation</th><th className="num">Montant</th></tr></thead>
        <tbody>
          {ligne("Chiffre d'affaires TTC", formaterFcfa(total.ca_ttc), `${total.ventes} vente(s) · panier ${formaterFcfa(total.panier_moyen)}`)}
          {ligne("Chiffre d'affaires HT", formaterFcfa(total.ca_ht))}
          {ligne("Coût d'achat des ventes", formaterFcfa(total.cout_ventes))}
          {ligne('Marge commerciale', formaterFcfa(total.marge), `${formaterPourcentage(total.taux_marge)} du CA HT`)}
          {ligne("Dépenses d'exploitation", formaterFcfa(total.charges))}
          {ligne('Encaissé sur la période', formaterFcfa(total.encaisse), total.reste_a_encaisser > 0 ? `reste à encaisser ${formaterFcfa(total.reste_a_encaisser)}` : undefined)}
        </tbody>
      </table>

      <table className="document-liste" style={{ width: '48%', float: 'right' }}>
        <thead><tr><th style={{ textAlign: 'left' }}>Situation</th><th className="num">Montant</th></tr></thead>
        <tbody>
          {ligne('Trésorerie (caisses)', formaterFcfa(total.tresorerie))}
          {/* L'argent parti et pas encore arrivé : il s'ajoute aux caisses, il n'y est pas. */}
          {total.fonds_en_transit > 0
            && ligne(`En transit, hors caisses (${total.transferts_en_transit} bon(s))`, formaterFcfa(total.fonds_en_transit))}
          {/* Le même argent vu de l'arrivée : masqué sur la feuille du groupe, où
              ce serait un bon annoncé deux fois — et cette feuille part en réunion. */}
          {filialeId !== null && total.fonds_a_recevoir > 0
            && ligne(`À recevoir, hors caisses (${total.transferts_a_recevoir} bon(s))`, formaterFcfa(total.fonds_a_recevoir))}
          {ligne('Créances clients', formaterFcfa(total.creances), anciennete.au_dela_de_90 > 0 ? `dont ${formaterFcfa(anciennete.au_dela_de_90)} à plus de 90 j` : undefined)}
          {ligne('Dettes fournisseurs', formaterFcfa(total.dettes), `${total.commandes_ouvertes} commande(s) ouverte(s)`)}
          {ligne('Valeur du stock', formaterFcfa(repartition.valeur), `${repartition.articles} article(s)`)}
          {ligne('Stock dormant', formaterFcfa(repartition.valeur_dormante))}
          {ligne('Bons de livraison en attente', `${total.livraisons_attente}`, total.livraisons_retard > 0 ? `${total.livraisons_retard} en retard` : undefined)}
        </tbody>
      </table>

      <div style={{ clear: 'both' }} />

      <table className="document-liste">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>État du stock</th>
            <th className="num">Articles</th>
            <th className="num">Valeur</th>
            <th className="num">Part</th>
            <th style={{ textAlign: 'left' }}>Impayés par ancienneté</th>
            <th className="num">Factures</th>
            <th className="num">Montant</th>
          </tr>
        </thead>
        <tbody>
          {repartition.parts.map((p, i) => {
            const a = anciennete.parts[i];
            return (
              <tr key={p.etat} data-testid="ligne-pilotage">
                <td>{p.libelle}<br /><span style={{ fontSize: 9 }}>{CONSEILS_ETAT_STOCK[p.etat]}</span></td>
                <td className="num">{p.articles}</td>
                <td className="num">{formaterFcfa(p.valeur)}</td>
                <td className="num">{formaterPourcentage(p.part)}</td>
                <td>{a?.label ?? ''}</td>
                <td className="num">{a ? a.factures : ''}</td>
                <td className="num">{a ? formaterFcfa(a.montant) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filiales.length > 1 && (
        <table className="document-liste">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Filiale</th>
              <th className="num">CA TTC</th>
              <th className="num">Marge</th>
              <th className="num">Taux</th>
              <th className="num">Créances</th>
              <th className="num">Dettes</th>
              <th className="num">Stock</th>
              <th className="num">Caisses</th>
            </tr>
          </thead>
          <tbody>
            {filiales.map((f) => (
              <tr key={f.filiale_id} data-testid="ligne-filiale">
                <td>{f.filiale_nom}<br /><span className="document-code" style={{ fontSize: 9 }}>{f.filiale_code}</span></td>
                <td className="num">{formaterFcfa(f.ca_ttc)}</td>
                <td className="num">{formaterFcfa(f.marge)}</td>
                <td className="num">{formaterPourcentage(f.taux_marge)}</td>
                <td className="num">{formaterFcfa(f.creances)}</td>
                <td className="num">{formaterFcfa(f.dettes)}</td>
                <td className="num">{formaterFcfa(f.valeur_stock)}</td>
                <td className="num">{formaterFcfa(f.tresorerie)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Groupe</td>
              <td className="num" style={{ fontWeight: 'bold' }}>{formaterFcfa(total.ca_ttc)}</td>
              <td className="num" style={{ fontWeight: 'bold' }}>{formaterFcfa(total.marge)}</td>
              <td className="num" style={{ fontWeight: 'bold' }}>{formaterPourcentage(total.taux_marge)}</td>
              <td className="num" style={{ fontWeight: 'bold' }}>{formaterFcfa(total.creances)}</td>
              <td className="num" style={{ fontWeight: 'bold' }}>{formaterFcfa(total.dettes)}</td>
              <td className="num" style={{ fontWeight: 'bold' }}>{formaterFcfa(total.valeur_stock)}</td>
              <td className="num" style={{ fontWeight: 'bold' }}>{formaterFcfa(total.tresorerie)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      <p className="document-arrete">
        Marge commerciale : chiffre d'affaires hors taxes moins le coût d'achat de la marchandise sortie, au coût
        moyen que portait le dépôt au moment de la vente. Résultat estimé : cette marge moins les dépenses passées
        en caisse sur la période — il ne voit donc pas une charge réglée autrement.
      </p>

      <div className="document-cachets">
        <div className="document-cachet"><p className="document-cachet-titre">Visa du gérant</p></div>
        <div className="document-cachet"><p className="document-cachet-titre">Visa de la direction</p></div>
      </div>
    </DocumentImprimable>
  );
}
