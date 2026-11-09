import {
  LIBELLES_ETAT_STOCK,
  etatAlerte,
  montantACommander,
  perimetreAlertes,
  quantiteACommander,
  recapAlertes,
  type LigneAlerteStock,
  type NatureAlerte,
} from '../../../core/stock';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import type { InfosFiliale } from './EnteteBon';

interface Props {
  lignes: LigneAlerteStock[];
  /** Tout le périmètre, alertes comprises : sert à compter les articles sans seuil. */
  suivies: LigneAlerteStock[];
  filiale: InfosFiliale;
  filtres: { nature: NatureAlerte; depotNom: string | null; familleNom: string | null; recherche: string };
  onClose: () => void;
}

const quantite = (valeur: number, unite: string) => `${valeur.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${unite}`;

/**
 * Liste des alertes A4 : ce qui manque, et ce qu'il faut commander.
 *
 * Document de travail pour le gérant : il part chez le fournisseur avec, d'où
 * la quantité à commander et son coût estimé, et le périmètre écrit en clair.
 */
export default function AlertesStockDocument({ lignes, suivies, filiale, filtres, onClose }: Props) {
  const recap = recapAlertes(lignes, suivies);
  const edite = formaterDate(new Date().toISOString());

  return (
    <DocumentImprimable titre="Alertes de stock" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Périmètre</strong>
          {perimetreAlertes(filtres)}
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ width: '72mm' }}>
          <strong>{lignes.length} article(s) en alerte</strong>
          <br />Ruptures : {recap.ruptures} · Stock faible : {recap.faibles}
          <br />À commander : {formaterFcfa(recap.montant_a_commander)}
          {recap.sans_seuil > 0 && <><br />{recap.sans_seuil} article(s) sans seuil : jamais d'alerte</>}
        </div>
      </div>

      <table className="document-liste">
        <thead>
          <tr>
            <th>Code</th>
            <th>Désignation</th>
            <th>Famille</th>
            <th>État</th>
            <th className="num">Stock</th>
            <th className="num">Mini</th>
            <th className="num">Maxi</th>
            <th className="num">À commander</th>
            <th className="num">Coût estimé</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.article_id} data-testid="ligne-alerte">
              <td className="document-code">{l.code}</td>
              <td>{l.designation}</td>
              <td>{l.famille_nom ?? '—'}</td>
              <td>{LIBELLES_ETAT_STOCK[etatAlerte(l)]}</td>
              <td className="num">{quantite(l.quantite, l.unite)}</td>
              <td className="num">{l.stock_min > 0 ? l.stock_min.toLocaleString('fr-FR') : '—'}</td>
              <td className="num">{l.stock_max > 0 ? l.stock_max.toLocaleString('fr-FR') : '—'}</td>
              <td className="num">{quantiteACommander(l) > 0 ? quantite(quantiteACommander(l), l.unite) : '—'}</td>
              <td className="num">{formaterFcfa(montantACommander(l))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={9} className="document-liste-pied">
              Alertes de stock · {filiale.nom} · {perimetreAlertes(filtres)} · édité le {edite} · à commander {formaterFcfa(recap.montant_a_commander)}
            </td>
          </tr>
        </tfoot>
      </table>

      {lignes.length === 0 && <p>Aucune alerte dans ce périmètre.</p>}

      <div className="document-signature" style={{ marginTop: '10mm' }}>
        <strong>Visa du gérant</strong>
      </div>
    </DocumentImprimable>
  );
}
