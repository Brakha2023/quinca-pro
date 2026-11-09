import { perimetreOperations, recapOperations, type LigneOperation, type PerimetreOperations } from '../../../core/tresorerie';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterFcfa } from '../../hooks/useFormatage';

interface Props {
  titre: string;
  lignes: LigneOperation[];
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filtres: PerimetreOperations;
  onClose: () => void;
}

const formaterDateHeure = (iso: string) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

/**
 * État des opérations d'une section A4 : les dépenses du mois, les entrées en
 * caisse, les versements, les retraits — tels que les filtres de l'écran les
 * ont retenus.
 *
 * La ventilation par catégorie vient **avant** la liste : c'est la raison pour
 * laquelle on imprime la feuille. Le gérant veut d'abord savoir ce qu'il a payé
 * de transport ce mois-ci ; la liste est la preuve, qu'on relit ensuite pièce
 * par pièce.
 */
export default function OperationsDocument({ titre, lignes, filiale, filtres, onClose }: Props) {
  const recap = recapOperations(lignes);
  const perimetre = perimetreOperations(filtres);
  const edite = new Date().toLocaleString('fr-FR');
  // Une section ne porte qu'un sens d'ordinaire ; la colonne n'apparaît que
  // lorsque le filtre a ramené les deux, sinon elle répète le titre.
  const deuxSens = recap.recettes > 0 && recap.depenses > 0;

  return (
    <DocumentImprimable titre={titre} filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Périmètre</strong>
          {perimetre}
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ width: '62mm' }}>
          <strong>{recap.nombre} opération(s)</strong>
          {deuxSens ? (
            <>
              <br />Entrées : {formaterFcfa(recap.recettes)}
              <br />Sorties : {formaterFcfa(recap.depenses)}
              <br />Écart : {formaterFcfa(recap.net)}
            </>
          ) : (
            <><br />Total : {formaterFcfa(recap.total)}</>
          )}
        </div>
      </div>

      {recap.ventilation.length > 1 && (
        <>
          {/* `document-section` est un intertitre, pas un cadre : il met en
              capitales tout ce qu'il contient. Le tableau vient après lui. */}
          <p className="document-section">Ventilation par catégorie</p>
          <table className="document-liste">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th className="num">Opérations</th>
                <th className="num">Montant</th>
                <th className="num">Part</th>
              </tr>
            </thead>
            <tbody>
              {recap.ventilation.map((v) => (
                <tr key={v.categorie} data-testid="ventilation-categorie">
                  <td>{v.libelle}</td>
                  <td className="num">{v.nombre}</td>
                  <td className="num">{formaterFcfa(v.montant)}</td>
                  <td className="num">{v.part} %</td>
                </tr>
              ))}
              <tr>
                <th>Total</th>
                <th className="num">{recap.nombre}</th>
                <th className="num">{formaterFcfa(recap.total)}</th>
                <th className="num">100 %</th>
              </tr>
            </tbody>
          </table>
        </>
      )}

      <table className="document-liste">
        <thead>
          <tr>
            <th>Date</th>
            <th>Caisse</th>
            <th>Catégorie</th>
            <th>Désignation</th>
            <th>Pièce</th>
            <th>Par</th>
            {deuxSens && <th>Sens</th>}
            <th className="num">Montant</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.id} data-testid="ligne-operation-imprimee">
              <td>{formaterDateHeure(l.date)}</td>
              <td>{l.caisse}</td>
              <td>{l.categorie_libelle}</td>
              <td>{l.description || '—'}</td>
              <td className="document-code">{l.piece}</td>
              <td>{l.operateur}</td>
              {deuxSens && <td>{l.type === 'RECETTE' ? 'Entrée' : 'Sortie'}</td>}
              <td className="num">{formaterFcfa(l.montant)}</td>
            </tr>
          ))}
          <tr>
            <th colSpan={deuxSens ? 7 : 6}>Total — {recap.nombre} opération(s)</th>
            <th className="num" data-testid="total-operations-imprime">{formaterFcfa(recap.total)}</th>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={deuxSens ? 8 : 7} className="document-liste-pied">
              {titre} · {filiale.nom} · {perimetre} · édité le {edite} · total {formaterFcfa(recap.total)}
            </td>
          </tr>
        </tfoot>
      </table>

      {lignes.length === 0 && <p>Aucune opération dans ce périmètre.</p>}

      <div className="recu-signatures" style={{ marginTop: '10mm' }}>
        <span>Le caissier</span>
        <span>Le gérant</span>
      </div>
    </DocumentImprimable>
  );
}
