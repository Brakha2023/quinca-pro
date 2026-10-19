import {
  descriptionSection,
  filtresEnClair,
  perimetreHistorique,
  recapHistorique,
  type FiltresHistorique,
  type PieceHistorique,
  type SectionHistorique,
} from '../../../core/historiques';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterFcfa } from '../../hooks/useFormatage';

interface Props {
  section: SectionHistorique;
  pieces: PieceHistorique[];
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filtres: FiltresHistorique;
  onClose: () => void;
}

const dateHeure = (iso: string) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * Historique A4 : une ligne par pièce, le total en bas, le périmètre écrit en
 * clair. C'est la liste qu'on classe ou qu'on remet au contrôle — elle doit
 * dire d'elle-même ce qu'elle contient et ce qu'elle laisse de côté.
 */
export default function HistoriqueDocument({ section, pieces, filiale, filtres, onClose }: Props) {
  const description = descriptionSection(section);
  const recap = recapHistorique(pieces);
  const perimetre = perimetreHistorique(section, filtres);
  const edite = new Date().toLocaleString('fr-FR');

  return (
    <DocumentImprimable titre={`Historique — ${description.label}`} filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Période</strong>
          <br />Du {filtres.debut} au {filtres.fin}
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Périmètre</strong>
          <br />{perimetre}
        </div>
        <div className="document-bloc" style={{ width: '62mm' }}>
          <strong>{recap.pieces} {description.piece}(s)</strong>
          <br />{recap.lignes} ligne(s)
          <br />{description.montant} : {formaterFcfa(recap.montant)}
        </div>
      </div>

      <table className="document-liste">
        <thead>
          <tr>
            <th>Date</th>
            <th>N° de pièce</th>
            <th>{description.tiers}</th>
            <th>Dépôt / caisse</th>
            <th className="num">Lignes</th>
            <th className="num">{description.montant}</th>
            <th>Op. saisie</th>
          </tr>
        </thead>
        <tbody>
          {pieces.map((p) => (
            <tr key={p.id} data-testid="ligne-historique">
              <td>{dateHeure(p.date)}</td>
              <td className="document-code">{p.reference}</td>
              <td>{p.tiers ?? '—'}</td>
              <td>{p.depot ?? '—'}</td>
              <td className="num">{p.lignes}</td>
              <td className="num">{formaterFcfa(p.montant)}</td>
              <td>{p.utilisateur ?? '—'}</td>
            </tr>
          ))}
          <tr>
            <th colSpan={4}>Total — {recap.pieces} {description.piece}(s)</th>
            <th className="num">{recap.lignes}</th>
            <th className="num" data-testid="total-historique">{formaterFcfa(recap.montant)}</th>
            <th />
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} className="document-liste-pied">
              {description.label} · {filiale.nom} · {filtresEnClair(filtres)} · édité le {edite}
            </td>
          </tr>
        </tfoot>
      </table>

      {pieces.length === 0 && <p>Aucune pièce dans ce périmètre.</p>}

      <div className="recu-signatures" style={{ marginTop: '10mm' }}>
        <span>Le gérant</span>
        <span>Le contrôle</span>
      </div>
    </DocumentImprimable>
  );
}
