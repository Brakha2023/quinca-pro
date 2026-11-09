import { LIBELLES_STATUT_TRANSFERT_STOCK, type BonTransfertFiliale } from '../../../core/stock';
import CodeBarres from '../../components/print/CodeBarres';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterFcfa } from '../../hooks/useFormatage';
import type { InfosFiliale } from './EnteteBon';

interface Props {
  bon: BonTransfertFiliale;
  filiale: InfosFiliale;
  onClose: () => void;
}

const dateHeure = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const quantite = (valeur: number, unite: string) => `${valeur.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${unite ? ` ${unite}` : ''}`;

/**
 * Bon de transfert de stock entre filiales : la pièce qui voyage avec la
 * marchandise. Elle est signée deux fois — au départ et à l'arrivée —, d'où
 * les deux cachets ; c'est elle qui répond de la marchandise tant qu'elle
 * n'est dans aucun dépôt.
 */
export default function BonTransfertFilialeDocument({ bon, filiale, onClose }: Props) {
  return (
    <DocumentImprimable titre="Bon de transfert de stock inter-filiales" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Bon n° {bon.numero}</strong>
          <br />Envoi : {dateHeure(bon.date_envoi)}
          <br />État : {LIBELLES_STATUT_TRANSFERT_STOCK[bon.statut]}
          {bon.date_reception && <><br />Reçu le {dateHeure(bon.date_reception)}</>}
          <div style={{ marginTop: 4 }}><CodeBarres valeur={bon.numero} /></div>
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Expéditeur</strong>
          {bon.filiale_source}
          <br />Dépôt : {bon.depot_source}
          <br />
          <strong className="document-bloc-titre">Destinataire</strong>
          {bon.filiale_destination}
          <br />Dépôt : {bon.depot_destination ?? 'désigné à la réception'}
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Transport</strong>
          {bon.transporteur || '—'}
          <br />
          <strong className="document-bloc-titre">Motif</strong>
          {bon.motif || '—'}
        </div>
      </div>

      <table className="document-liste">
        <thead>
          <tr>
            <th>Code / Réf.</th>
            <th>Désignation</th>
            <th className="num">Qté</th>
            <th className="num">Prix U.</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {bon.lignes.map((l) => (
            <tr key={l.id} data-testid="ligne-transfert">
              <td className="document-code">{l.code}</td>
              <td>{l.designation}</td>
              <td className="num">{quantite(l.quantite, l.unite)}</td>
              <td className="num">{formaterFcfa(l.cout_unitaire)}</td>
              <td className="num">{formaterFcfa(l.quantite * l.cout_unitaire)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={2}>Total — {bon.lignes.length} article(s)</th>
            <th className="num">{bon.quantite_totale.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</th>
            <th />
            <th className="num" data-testid="transfert-total">{formaterFcfa(bon.valeur_totale)}</th>
          </tr>
        </tfoot>
      </table>

      <div className="document-cachets">
        <div className="document-cachet">
          <div className="document-cachet-titre">Cachet / signature — {bon.filiale_source}</div>
        </div>
        <div className="document-cachet">
          <div className="document-cachet-titre">Cachet / signature — {bon.filiale_destination}</div>
        </div>
      </div>

      <div className="document-operateur">
        <strong>Op. saisie</strong>
        <span>{bon.operateur}</span>
      </div>
      {bon.receptionnaire && (
        <div className="document-operateur" style={{ marginLeft: 8 }}>
          <strong>Reçu par</strong>
          <span>{bon.receptionnaire}</span>
        </div>
      )}
      <p style={{ fontSize: 10, marginTop: 8 }}>
        Valeur au coût moyen du dépôt de départ · édité le {dateHeure(new Date().toISOString())}
      </p>
    </DocumentImprimable>
  );
}
