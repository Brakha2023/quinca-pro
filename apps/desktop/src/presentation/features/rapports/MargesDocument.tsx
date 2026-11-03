import { formaterPourcentage } from '../../../core/commun/prix';
import {
  alertesMarges, perimetreMarges, recapMarges,
  type LigneMarge, type PerimetreMarges,
} from '../../../core/rapports';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterFcfa } from '../../hooks/useFormatage';

interface Props {
  /** Catégories, parts déjà posées et classement déjà fait : la feuille n'y touche pas. */
  categories: LigneMarge[];
  /** Les articles de la sélection, dans le même ordre qu'à l'écran. */
  articles: LigneMarge[];
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filtres: PerimetreMarges;
  /** Articles détaillés sur la feuille ; au-delà, la liste est tronquée et le dit. */
  limiteArticles?: number;
  onClose: () => void;
}

/**
 * Le rapport des marges en A4 couché : la feuille qu'on emporte en réunion,
 * qu'on signe et qu'on classe.
 *
 * Les **catégories d'abord**, puis le détail par article. C'est l'ordre dans
 * lequel la question se pose : où se fait la marge, et ensuite quel article
 * la fait dans cette famille. Le détail est la preuve qu'on relit après avoir
 * décidé, pas ce par quoi on commence.
 *
 * Ce qui s'imprime est exactement ce que les filtres de l'écran ont retenu —
 * la feuille dit son périmètre en tête, sans quoi deux tirages du même mois
 * ne se distingueraient pas.
 */
export default function MargesDocument({ categories, articles, filiale, filtres, limiteArticles = 120, onClose }: Props) {
  const recap = recapMarges(articles);
  const { aPerte, perte } = alertesMarges(articles);
  const perimetre = perimetreMarges(filtres);
  const edite = new Date().toLocaleString('fr-FR');
  const detaillees = articles.slice(0, limiteArticles);

  return (
    <DocumentImprimable titre="Rapport des marges" filiale={filiale} paysage onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Périmètre</strong>
          <br />{perimetre}
          <br />{recap.categories} catégorie(s) · {recap.articles} article(s) · {recap.lignes} ligne(s) de vente
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ width: '70mm' }}>
          <strong>Marge commerciale</strong>
          <br />Chiffre d'affaires HT : {formaterFcfa(recap.ca_ht)}
          <br />Coût d'achat : {formaterFcfa(recap.cout)}
          <br /><strong>Marge : {formaterFcfa(recap.marge)}</strong>
          <br />Taux de marge : {formaterPourcentage(recap.taux_marge)}
        </div>
      </div>

      {/* `document-section` est un intertitre, pas un cadre : il met en
          capitales tout ce qu'il contient. Les tableaux viennent après lui. */}
      <p className="document-section">Marge par catégorie</p>
      <table className="document-liste">
        <thead>
          <tr>
            <th>Catégorie</th>
            <th className="num">Articles</th>
            <th className="num">Quantité</th>
            <th className="num">CA HT</th>
            <th className="num">Coût d'achat</th>
            <th className="num">Marge</th>
            <th className="num">Taux</th>
            <th className="num">Part marge</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.cle} data-testid="categorie-imprimee">
              <td>{c.libelle}</td>
              <td className="num">{c.articles}</td>
              <td className="num">{c.quantite.toLocaleString('fr-FR')}</td>
              <td className="num">{formaterFcfa(c.ca_ht)}</td>
              <td className="num">{formaterFcfa(c.cout)}</td>
              <td className="num">{formaterFcfa(c.marge)}</td>
              <td className="num">{formaterPourcentage(c.taux_marge)}</td>
              <td className="num">{formaterPourcentage(c.part_marge)}</td>
            </tr>
          ))}
          <tr>
            <th>Total</th>
            <th className="num">{recap.articles}</th>
            <th className="num">{recap.quantite.toLocaleString('fr-FR')}</th>
            <th className="num">{formaterFcfa(recap.ca_ht)}</th>
            <th className="num">{formaterFcfa(recap.cout)}</th>
            <th className="num" data-testid="marge-totale-imprimee">{formaterFcfa(recap.marge)}</th>
            <th className="num">{formaterPourcentage(recap.taux_marge)}</th>
            <th className="num">100 %</th>
          </tr>
        </tbody>
      </table>

      {aPerte.length > 0 && (
        <p>
          <strong>Vendu à perte :</strong> {aPerte.length} article(s), {formaterFcfa(perte)} de marge négative —{' '}
          {aPerte.slice(0, 5).map((l) => l.libelle).join(', ')}
          {aPerte.length > 5 ? '…' : ''}. À vérifier : prix de vente du catalogue, remise accordée, ou prix d'achat qui a monté.
        </p>
      )}

      <p className="document-section">Détail par article</p>
      <table className="document-liste">
        <thead>
          <tr>
            <th>Code</th>
            <th>Article</th>
            <th>Catégorie</th>
            <th className="num">Quantité</th>
            <th className="num">CA HT</th>
            <th className="num">Coût d'achat</th>
            <th className="num">Marge</th>
            <th className="num">Taux</th>
          </tr>
        </thead>
        <tbody>
          {detaillees.map((l) => (
            <tr key={l.cle} data-testid="article-imprime">
              <td className="document-code">{l.code}</td>
              <td>{l.libelle}</td>
              <td>{l.famille}</td>
              <td className="num">{l.quantite.toLocaleString('fr-FR')} {l.unite}</td>
              <td className="num">{formaterFcfa(l.ca_ht)}</td>
              <td className="num">{formaterFcfa(l.cout)}</td>
              <td className="num">{formaterFcfa(l.marge)}</td>
              <td className="num">{formaterPourcentage(l.taux_marge)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={8} className="document-liste-pied">
              Rapport des marges · {filiale.nom} · {perimetre} · marge {formaterFcfa(recap.marge)} ({formaterPourcentage(recap.taux_marge)}) · édité le {edite}
            </td>
          </tr>
        </tfoot>
      </table>

      {articles.length > detaillees.length && (
        <p>
          Détail limité aux {detaillees.length} premiers articles du classement ; {articles.length - detaillees.length} autres
          figurent dans les totaux par catégorie. Resserrez les filtres, ou passez par l'export Excel, pour les voir tous.
        </p>
      )}
      {articles.length === 0 && <p>Rien de vendu dans ce périmètre.</p>}

      {recap.sorties_sans_cout > 0 && (
        <p style={{ marginTop: '4mm' }}>
          {recap.sorties_sans_cout} sortie(s) de stock sans coût au journal : valorisée(s) au coût moyen actuel du dépôt,
          faute de mieux. La marge de ces lignes est une estimation.
        </p>
      )}

      <div className="recu-signatures" style={{ marginTop: '10mm' }}>
        <span>Le gérant</span>
        <span>La direction</span>
      </div>
    </DocumentImprimable>
  );
}
