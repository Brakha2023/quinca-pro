import { margeArticle, perimetreCatalogue, recapCatalogue, type Article } from '../../../core/articles';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';

interface Props {
  articles: Article[];
  nomFamille: (id: string | null) => string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filtres: { recherche: string; familleNom: string | null; inclureInactifs: boolean };
  onClose: () => void;
}

/**
 * Catalogue A4.
 *
 * L'écran imprimait jusqu'ici la page entière — menu compris — et la liste
 * s'arrêtait à ce qui tenait dans la fenêtre. C'est un document à part :
 * en-tête de la maison, périmètre de la liste, et un tableau qui se poursuit
 * de page en page avec ses entêtes.
 */
export default function CatalogueDocument({ articles, nomFamille, filiale, filtres, onClose }: Props) {
  const recap = recapCatalogue(articles);
  const edite = formaterDate(new Date().toISOString());

  return (
    <DocumentImprimable titre="Catalogue des articles" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Périmètre</strong>
          <br />{perimetreCatalogue(filtres)}
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ width: '60mm' }}>
          <strong>{recap.nombre} article(s)</strong>
          <br />{recap.actifs} actif(s){recap.inactifs > 0 ? ` · ${recap.inactifs} inactif(s)` : ''}
          <br />Marge moyenne : {recap.marge_moyenne} %
          {recap.a_perte > 0 && <><br />{recap.a_perte} vendu(s) à perte</>}
          {recap.sans_prix > 0 && <><br />{recap.sans_prix} sans prix de vente</>}
        </div>
      </div>

      <table className="document-liste">
        <thead>
          <tr>
            <th>Code</th>
            <th>Désignation</th>
            <th>Famille</th>
            <th>Unité</th>
            <th className="num">P. achat</th>
            <th className="num">P. vente</th>
            <th className="num">P. VIP</th>
            <th className="num">Marge</th>
            <th className="num">Stock min</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((a) => (
            <tr key={a.id} data-testid="ligne-catalogue">
              <td className="document-code">{a.code}</td>
              <td>{a.designation}{!a.est_actif && ' (inactif)'}</td>
              <td>{nomFamille(a.famille_id)}</td>
              <td>{a.unite}</td>
              <td className="num">{formaterFcfa(a.prix_achat)}</td>
              <td className="num">{formaterFcfa(a.prix_vente)}</td>
              <td className="num">{a.prix_vip != null ? formaterFcfa(a.prix_vip) : '—'}</td>
              <td className="num">{a.prix_achat > 0 ? `${margeArticle(a)} %` : '—'}</td>
              <td className="num">{a.stock_min > 0 ? a.stock_min.toLocaleString('fr-FR') : '—'}</td>
            </tr>
          ))}
        </tbody>
        {/*
          Chromium répète un `tfoot` au bas de **chaque** page : c'est la seule
          façon, sans bibliothèque, d'identifier les pages 2 et suivantes, qui
          ne portent sinon que des chiffres.
        */}
        <tfoot>
          <tr>
            <td colSpan={9} className="document-liste-pied">
              Catalogue des articles · {filiale.nom} · édité le {edite} · {recap.nombre} article(s)
            </td>
          </tr>
        </tfoot>
      </table>

      {articles.length === 0 && <p>Aucun article dans ce périmètre.</p>}
    </DocumentImprimable>
  );
}
