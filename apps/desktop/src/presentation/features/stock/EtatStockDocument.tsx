import { LIBELLES_ETAT_STOCK, perimetreEtatStock, recapEtatStock, statutStock } from '../../../core/stock';
import type { StockVueRow } from '../../../infrastructure/powersync/repositories/StockRepository';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';

interface Props {
  stocks: StockVueRow[];
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filtres: { depotNom: string | null; recherche: string; alertesSeulement: boolean };
  onClose: () => void;
}

const quantite = (valeur: number | null) => (valeur ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** État du stock A4 : ce qui est en magasin, ce qu'il vaut, ce qui demande une décision. */
export default function EtatStockDocument({ stocks, filiale, filtres, onClose }: Props) {
  const recap = recapEtatStock(stocks);
  const edite = formaterDate(new Date().toISOString());

  return (
    <DocumentImprimable titre="État du stock" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Périmètre</strong>
          <br />{perimetreEtatStock(filtres)}
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ width: '72mm' }}>
          <strong>{recap.lignes} ligne(s) · {formaterFcfa(recap.valeur)}</strong>
          <br />Ruptures : {recap.ruptures} · Stock faible : {recap.faibles}
          <br />Surstock : {recap.surstocks}
          {recap.negatifs > 0 && <><br />{recap.negatifs} quantité(s) négative(s) à régulariser</>}
        </div>
      </div>

      <table className="document-liste">
        <thead>
          <tr>
            <th>Code</th>
            <th>Désignation</th>
            <th>Famille</th>
            <th>Dépôt</th>
            <th className="num">Quantité</th>
            <th className="num">Réservée</th>
            <th className="num">Disponible</th>
            <th className="num">Coût moyen</th>
            <th className="num">Valeur</th>
            <th>État</th>
            <th>Dernier mvt</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => (
            <tr key={s.id} data-testid="ligne-etat-stock">
              <td className="document-code">{s.article_code}</td>
              <td>{s.article_designation}</td>
              <td>{s.famille_nom ?? '—'}</td>
              <td>{s.depot_nom}</td>
              <td className="num">{quantite(s.quantite)} {s.article_unite ?? ''}</td>
              <td className="num">{quantite(s.quantite_reservee)}</td>
              <td className="num">{quantite(s.quantite_disponible)}</td>
              <td className="num">{formaterFcfa(s.cout_moyen)}</td>
              <td className="num">{formaterFcfa((s.quantite ?? 0) * (s.cout_moyen ?? 0))}</td>
              <td>{LIBELLES_ETAT_STOCK[statutStock(s.quantite ?? 0, s.article_stock_min ?? 0, s.article_stock_max ?? 0)]}</td>
              <td>{formaterDate(s.date_dernier_mouvement)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={11} className="document-liste-pied">
              État du stock · {filiale.nom} · {perimetreEtatStock(filtres)} · édité le {edite} · {formaterFcfa(recap.valeur)}
            </td>
          </tr>
        </tfoot>
      </table>

      {stocks.length === 0 && <p>Aucune ligne de stock dans ce périmètre.</p>}
    </DocumentImprimable>
  );
}
