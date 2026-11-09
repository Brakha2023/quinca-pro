import { montantEnLettresFcfa } from '../../../core/commun/montantEnLettres';
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

const dateHeure = (valeur: string) => new Date(valeur).toLocaleString('fr-FR');

/**
 * Bon de mouvement de stock (entrée, sortie, casse, transfert, inventaire) :
 * la pièce que le magasinier signe et classe. Les quantités sont signées, et
 * l'état du stock avant / après chaque ligne figure sur le bon : c'est ce qui
 * permet de recontrôler un écart sans rouvrir le logiciel.
 *
 * Les lignes sont numérotées : devant un écart, on se dit « ligne 3 », pas
 * « la ligne du ciment » — et un bon à vingt lignes ne se pointe pas autrement.
 *
 * Le total s'écrit aussi **en toutes lettres** quand le bon est valorisé :
 * c'est la mention qui fait foi si un chiffre est raturé à la main, et un bon
 * d'entrée se présente au fournisseur comme une facture d'achat.
 */
export default function BonStockDocument({ bon, filiale, onClose }: Props) {
  /** Colonnes que le libellé d'un total enjambe, avant les deux colonnes de chiffres. */
  const colonnesLibelle = (bon.avec_remise ? 6 : 5) + 1;
  return (
    <DocumentImprimable titre={bon.titre} filiale={filiale} onClose={onClose}>
      {/* Le numéro court en tête, le long dans le code-barres : l'un se dicte
          et se recopie, l'autre se douchette et identifie la pièce. */}
      <p className="document-reference" data-testid="bon-numero">N° {bon.reference_courte ?? bon.reference}</p>

      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Pièce</strong>
          <dl className="document-champs">
            <dt>Date</dt><dd>{dateHeure(bon.date)}</dd>
            {bon.date_livraison ? <><dt>Livré le</dt><dd>{dateHeure(bon.date_livraison)}</dd></> : null}
            <dt>Établi par</dt><dd>{bon.utilisateur || '—'}</dd>
          </dl>
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">{bon.depot_destination ? 'Dépôts' : 'Dépôt'}</strong>
          <dl className="document-champs">
            <dt>{bon.depot_destination ? 'Origine' : 'Dépôt'}</dt><dd>{bon.depot}</dd>
            {bon.depot_destination ? <><dt>Destination</dt><dd>{bon.depot_destination}</dd></> : null}
            {bon.fournisseur ? <><dt>Fournisseur</dt><dd>{bon.fournisseur}</dd></> : null}
          </dl>
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Motif</strong>
          <p style={{ margin: 0 }}>{bon.motif || '—'}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>N°</th><th>Code</th><th>Désignation</th><th>Quantité</th><th>Avant</th><th>Après</th>
            {bon.avec_remise && <th>Remise</th>}
            {bon.valorise && <><th>Coût unit. net</th><th>Valeur</th></>}
          </tr>
        </thead>
        <tbody>
          {bon.lignes.map((l, index) => (
            <tr key={l.code}>
              <td className="num">{index + 1}</td>
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

      {/* Le montant en lettres n'a de sens que sur un bon chiffré : un bon de
          casse ou une fiche d'inventaire ne porte aucune somme à arrêter. */}
      {bon.valorise && (
        <p className="document-arrete">
          <span>Arrêté le présent bon à la somme de :</span>
          <strong data-testid="bon-lettres">{montantEnLettresFcfa(bon.total_valeur)}</strong>
        </p>
      )}

      <div className="document-cachets">
        <div className="document-cachet"><p className="document-cachet-titre">Le magasinier</p></div>
        <div className="document-cachet"><p className="document-cachet-titre">{bon.depot_destination ? 'Le dépôt destinataire' : 'Le responsable'}</p></div>
      </div>
    </DocumentImprimable>
  );
}
