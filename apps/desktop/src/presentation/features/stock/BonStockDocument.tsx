import type { BonStock } from '../../../core/stock';
import CodeBarres from '../../components/print/CodeBarres';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterFcfa } from '../../hooks/useFormatage';

interface Props {
  bon: BonStock;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  onClose: () => void;
}

const quantite = (valeur: number, unite: string) =>
  `${valeur.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${unite ? ` ${unite}` : ''}`;

/**
 * Bon de mouvement de stock (entrée, sortie, casse, transfert, inventaire) :
 * la pièce que le magasinier signe et classe. Les quantités sont signées, et
 * l'état du stock avant / après chaque ligne figure sur le bon : c'est ce qui
 * permet de recontrôler un écart sans rouvrir le logiciel.
 */
export default function BonStockDocument({ bon, filiale, onClose }: Props) {
  /** Colonnes que le libellé d'un total enjambe, avant les deux colonnes de chiffres. */
  const colonnesLibelle = bon.avec_remise ? 6 : 5;
  return (
    <DocumentImprimable titre={bon.titre} filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Pièce</strong>
          <br />N° {bon.reference}
          <br />Date : {new Date(bon.date).toLocaleString('fr-FR')}
          {bon.date_livraison ? <><br />Livré le : {new Date(bon.date_livraison).toLocaleString('fr-FR')}</> : null}
          <br />Établi par : {bon.utilisateur || '—'}
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>{bon.depot_destination ? 'Dépôts' : 'Dépôt'}</strong>
          <br />{bon.depot_destination ? `Origine : ${bon.depot}` : bon.depot}
          {bon.depot_destination ? <><br />Destination : {bon.depot_destination}</> : null}
          {bon.fournisseur ? <><br />Fournisseur : {bon.fournisseur}</> : null}
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Motif</strong>
          <br />{bon.motif || '—'}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Code</th><th>Désignation</th><th>Quantité</th><th>Avant</th><th>Après</th>
            {bon.avec_remise && <th>Remise</th>}
            {bon.valorise && <><th>Coût unit. net</th><th>Valeur</th></>}
          </tr>
        </thead>
        <tbody>
          {bon.lignes.map((l) => (
            <tr key={l.code}>
              <td>{l.code}</td>
              <td>{l.designation}</td>
              <td className="num">{l.quantite > 0 ? '+' : ''}{quantite(l.quantite, l.unite)}</td>
              <td className="num">{l.quantite_avant}</td>
              <td className="num">{l.quantite_apres}</td>
              {bon.avec_remise && <td className="num">{l.remise_montant > 0 ? formaterFcfa(l.remise_montant) : l.remise_percent > 0 ? `${l.remise_percent} %` : '—'}</td>}
              {bon.valorise && (
                <>
                  <td className="num">{l.cout_unitaire != null ? formaterFcfa(l.cout_unitaire) : '—'}</td>
                  <td className="num">{l.valeur != null ? formaterFcfa(l.valeur) : '—'}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {bon.valorise && (
          <tfoot>
            {/* Le brut et la remise ne s'affichent que si une remise a été
                accordée : ailleurs, trois lignes de total pour un seul chiffre
                ne feraient que brouiller la lecture du bon. */}
            {bon.remise_globale > 0 && (
              <>
                <tr>
                  <th colSpan={colonnesLibelle}>Total brut</th>
                  <th />
                  <th className="num">{formaterFcfa(bon.total_valeur + bon.remise_globale)}</th>
                </tr>
                <tr>
                  <th colSpan={colonnesLibelle}>Remise globale</th>
                  <th />
                  <th className="num" data-testid="bon-remise">− {formaterFcfa(bon.remise_globale)}</th>
                </tr>
              </>
            )}
            <tr>
              <th colSpan={colonnesLibelle}>{bon.remise_globale > 0 ? 'Net du bon' : 'Total du bon'}</th>
              <th />
              <th className="num" data-testid="bon-total">{formaterFcfa(bon.total_valeur)}</th>
            </tr>
          </tfoot>
        )}
      </table>

      <div className="recu-pied">
        <CodeBarres valeur={bon.reference} />
        <p style={{ margin: 0, fontSize: 10 }}>{bon.lignes.length} ligne(s) · édité le {new Date().toLocaleString('fr-FR')}</p>
      </div>
      <div className="recu-signatures">
        <span>Le magasinier</span>
        <span>{bon.depot_destination ? 'Le dépôt destinataire' : 'Le responsable'}</span>
      </div>
    </DocumentImprimable>
  );
}
