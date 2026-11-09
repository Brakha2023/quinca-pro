import { perimetreRotation, recapRotation, type LigneRotation } from '../../../core/stock';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import type { InfosFiliale } from './EnteteBon';

interface Props {
  dormants: LigneRotation[];
  actifs: LigneRotation[];
  filiale: InfosFiliale;
  filtres: { seuilJours: number; depotNom: string | null; familleNom: string | null; recherche: string };
  onClose: () => void;
}

const quantite = (valeur: number, unite: string) => `${valeur.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${unite}`;

const depuisQuand = (l: LigneRotation) =>
  l.derniere_sortie ? `${formaterDate(l.derniere_sortie)} (${l.jours} j)` : 'aucune sortie connue';

/**
 * Stock dormant et stock actif, sur une feuille A4.
 *
 * C'est le document qu'on emporte dans les rayons : on relit la liste article
 * par article pour décider quoi brader, quoi rendre au fournisseur, et quoi
 * cesser de commander. D'où la valeur en face de chaque ligne — c'est elle qui
 * décide — et un visa du gérant au bas de la feuille.
 */
export default function RotationStockDocument({ dormants, actifs, filiale, filtres, onClose }: Props) {
  const recap = recapRotation(dormants, actifs);
  const edite = formaterDate(new Date().toISOString());

  return (
    <DocumentImprimable titre="Stock dormant et stock actif" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Périmètre</strong>
          {perimetreRotation(filtres)}
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ width: '72mm' }}>
          <strong>{recap.articles_dormants} article(s) dormant(s)</strong>
          <br />Valeur qui dort : {formaterFcfa(recap.valeur_dormante)} ({recap.part_dormante} % du stock)
          <br />En mouvement : {recap.articles_actifs} article(s) · {formaterFcfa(recap.valeur_active)}
        </div>
      </div>

      <h3 className="document-section">Stock dormant — sans sortie depuis {filtres.seuilJours} jours</h3>
      <table className="document-liste">
        <thead>
          <tr>
            <th>Code</th><th>Désignation</th><th>Famille</th>
            <th className="num">Stock</th><th className="num">Valeur</th><th>Dernière sortie</th>
          </tr>
        </thead>
        <tbody>
          {dormants.map((l) => (
            <tr key={l.article_id} data-testid="ligne-dormant">
              <td className="document-code">{l.code}</td>
              <td>{l.designation}</td>
              <td>{l.famille_nom ?? '—'}</td>
              <td className="num">{quantite(l.quantite, l.unite)}</td>
              <td className="num">{formaterFcfa(l.valeur)}</td>
              <td>{depuisQuand(l)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="document-liste-pied" data-testid="total-dormant">
              {recap.articles_dormants} article(s) · {formaterFcfa(recap.valeur_dormante)} immobilisés, soit {recap.part_dormante} % de la valeur du stock
            </td>
          </tr>
        </tfoot>
      </table>
      {dormants.length === 0 && <p>Aucun article dormant dans ce périmètre : tout le stock a bougé.</p>}

      <h3 className="document-section">Stock actif — sorti sur la période</h3>
      <table className="document-liste">
        <thead>
          <tr>
            <th>Code</th><th>Désignation</th><th>Famille</th>
            <th className="num">Stock</th><th className="num">Valeur</th><th className="num">Sorti</th><th>Dernière sortie</th>
          </tr>
        </thead>
        <tbody>
          {actifs.map((l) => (
            <tr key={l.article_id} data-testid="ligne-actif">
              <td className="document-code">{l.code}</td>
              <td>{l.designation}</td>
              <td>{l.famille_nom ?? '—'}</td>
              <td className="num">{quantite(l.quantite, l.unite)}</td>
              <td className="num">{formaterFcfa(l.valeur)}</td>
              <td className="num">{quantite(l.quantite_sortie, l.unite)}</td>
              <td>{depuisQuand(l)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} className="document-liste-pied">
              {recap.articles_actifs} article(s) en mouvement · {formaterFcfa(recap.valeur_active)}
            </td>
          </tr>
        </tfoot>
      </table>
      {actifs.length === 0 && <p>Aucune sortie sur la période dans ce périmètre.</p>}

      <p className="document-note">
        Une sortie, ici, est une vente, un déstockage ou une consommation en production : ce qui est
        vraiment parti. Ni la casse, ni un transfert entre dépôts — la marchandise est alors toujours
        à la maison. Le poste garde douze mois de mouvements : « aucune sortie connue » veut dire
        qu'il n'y en a pas eu depuis au moins ce temps-là.
      </p>

      <div className="document-signature" style={{ marginTop: '10mm' }}>
        <strong>Visa du gérant</strong>
      </div>
    </DocumentImprimable>
  );
}
