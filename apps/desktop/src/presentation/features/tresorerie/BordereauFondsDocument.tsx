import { LIBELLES_STATUT_TRANSFERT, type BordereauFonds } from '../../../core/tresorerie';
import CodeBarres from '../../components/print/CodeBarres';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterFcfa } from '../../hooks/useFormatage';

interface Props {
  bordereau: BordereauFonds;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  onClose: () => void;
}

const dateHeure = (iso: string | null) => (iso
  ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

/**
 * Bordereau de transfert de fonds inter-filiales : la pièce qui accompagne
 * l'argent, et la seule trace de ce qu'il advient entre les deux caisses.
 *
 * Elle se signe au départ et à l'arrivée, par le gérant ou le directeur —
 * la raison est dans `construireBordereauFonds`. Le porteur, lui, se note à
 * la main : l'application ne connaît pas le chauffeur du jour, et une ligne
 * pointillée sur le papier vaut mieux qu'un champ vide dans la base.
 */
export default function BordereauFondsDocument({ bordereau, filiale, onClose }: Props) {
  return (
    <DocumentImprimable titre="Bordereau de transfert de fonds inter-filiales" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Bordereau n° {bordereau.numero}</strong>
          <br />Envoi : {dateHeure(bordereau.date_envoi)}
          <br />État : {LIBELLES_STATUT_TRANSFERT[bordereau.statut]}
          <div style={{ marginTop: 4 }}><CodeBarres valeur={bordereau.numero} /></div>
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Expéditeur</strong>
          <br />{bordereau.filiale_source}
          <br />Caisse de départ : {bordereau.caisse_source}
          <br />
          <strong>Destinataire</strong>
          <br />{bordereau.filiale_destination}
          <br />Caisse d'arrivée : {bordereau.caisse_destination ?? 'désignée à la réception'}
        </div>
      </div>

      <div className="recu-corps">
        <div className="recu-tiers">
          <p className="recu-tiers-titre">Objet du transfert</p>
          <dl>
            <div className="recu-ligne"><dt>Motif</dt><dd>{bordereau.motif || '—'}</dd></div>
            {/* L'application ne connaît pas le chauffeur du jour : il se nomme ici,
                à la main, et c'est cette ligne qui désigne un responsable pendant
                le trajet. */}
            <div className="recu-ligne"><dt>Porteur des fonds</dt><dd>&nbsp;</dd></div>
            <div className="recu-ligne"><dt>Pièce d'identité n°</dt><dd>&nbsp;</dd></div>
          </dl>
        </div>
        <div className="recu-chiffres">
          <p className="recu-devise">En FCFA</p>
          <p className="recu-montant" data-testid="bordereau-montant">{formaterFcfa(bordereau.montant)}</p>
          <p className="recu-devise">Espèces</p>
        </div>
      </div>

      {/* Les chiffres se raturent sur la route ; les lettres, non. */}
      <p className="recu-lettres">
        Arrêté le présent bordereau à la somme de : <strong>{bordereau.montant_en_lettres}</strong>.
      </p>

      {bordereau.sans_valeur
        ? <p className="document-annule" data-testid="bordereau-mention">{bordereau.mention}</p>
        : <p className="document-arrete" data-testid="bordereau-mention">{bordereau.mention}</p>}

      {/* Pas de case à signer sur une pièce annulée : une signature y ferait
          croire à une remise de fonds qui n'a pas eu lieu. */}
      {!bordereau.sans_valeur && (
        <div className="document-cachets">
          <div className="document-cachet">
            <div className="document-cachet-titre">Le gérant ou le directeur — {bordereau.filiale_source}</div>
            <p className="document-cachet-pied">Autorise la sortie des fonds · nom, date et signature</p>
          </div>
          <div className="document-cachet">
            <div className="document-cachet-titre">Le gérant ou le directeur — {bordereau.filiale_destination}</div>
            <p className="document-cachet-pied">Reconnaît avoir reçu la somme · nom, date et signature</p>
          </div>
        </div>
      )}

      <div className="document-operateur">
        <strong>Op. saisie</strong>
        <span>{bordereau.operateur}</span>
      </div>
      {bordereau.receptionnaire && (
        <div className="document-operateur" style={{ marginLeft: 8 }}>
          <strong>Encaissé par</strong>
          <span>{bordereau.receptionnaire}</span>
        </div>
      )}

      <p className="recu-decoupe">
        Pièce {bordereau.numero} · {bordereau.filiale_source} → {bordereau.filiale_destination} ·
        édité le {dateHeure(new Date().toISOString())}. Les fonds ne sortent et n'entrent que sous la
        signature du gérant ou du directeur.
      </p>
    </DocumentImprimable>
  );
}
