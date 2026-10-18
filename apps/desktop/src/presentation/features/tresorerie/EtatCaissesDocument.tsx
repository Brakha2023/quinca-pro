import { perimetreCaisses, recapEtatCaisses, type FiltresCaisses, type LigneEtatCaisse } from '../../../core/tresorerie';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterFcfa } from '../../hooks/useFormatage';

interface Props {
  lignes: LigneEtatCaisse[];
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filtres: FiltresCaisses & { debut: string; fin: string };
  onClose: () => void;
}

/**
 * État des caisses A4 : une ligne par caisse, le total en bas.
 *
 * C'est la feuille que le gérant signe le soir, et sur laquelle il rapproche
 * l'espèce comptée. D'où les quatre colonnes de la journée (ouverture, entrées,
 * sorties, clôture) et le solde d'aujourd'hui à côté : sur une période passée,
 * les deux ne disent pas la même chose, et l'écart est l'information.
 */
export default function EtatCaissesDocument({ lignes, filiale, filtres, onClose }: Props) {
  const recap = recapEtatCaisses(lignes);
  const perimetre = perimetreCaisses(filtres);
  const edite = new Date().toLocaleString('fr-FR');
  // Le solde du jour n'a d'intérêt que sur une période close : sur une période
  // qui va jusqu'à aujourd'hui, il répète la clôture et vole une colonne.
  const avecSoldeActuel = lignes.some((l) => l.solde_actuel !== l.cloture);

  return (
    <DocumentImprimable titre="État des caisses" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Période</strong>
          <br />Du {filtres.debut} au {filtres.fin}
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Périmètre</strong>
          <br />{perimetre}
          <br />{recap.nombre} caisse(s) · {recap.mouvements} mouvement(s)
        </div>
        <div className="document-bloc" style={{ width: '62mm' }}>
          <strong>Total en caisses</strong>
          <br />Clôture : {formaterFcfa(recap.cloture)}
          <br />Aujourd'hui : {formaterFcfa(recap.solde_actuel)}
          {recap.negatives > 0 && <><br />{recap.negatives} caisse(s) à découvert</>}
        </div>
      </div>

      <table className="document-liste">
        <thead>
          <tr>
            <th>Code</th>
            <th>Libellé</th>
            <th className="num">Solde d'ouverture</th>
            <th className="num">Total entrées</th>
            <th className="num">Total sorties</th>
            <th className="num">Solde de clôture</th>
            {avecSoldeActuel && <th className="num">Solde actuel</th>}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.id} data-testid="ligne-etat-caisse">
              <td className="document-code">{l.code}</td>
              <td>
                {l.nom}{l.est_active ? '' : ' (fermée)'}
                {l.responsable && <><br /><span style={{ fontSize: 9 }}>{l.responsable}</span></>}
              </td>
              <td className="num">{formaterFcfa(l.ouverture)}</td>
              <td className="num">{l.recettes ? formaterFcfa(l.recettes) : '—'}</td>
              <td className="num">{l.depenses ? formaterFcfa(l.depenses) : '—'}</td>
              <td className="num">{formaterFcfa(l.cloture)}</td>
              {avecSoldeActuel && <td className="num">{formaterFcfa(l.solde_actuel)}</td>}
            </tr>
          ))}
          <tr>
            <th colSpan={2}>Total — {recap.nombre} caisse(s)</th>
            <th className="num">{formaterFcfa(recap.ouverture)}</th>
            <th className="num">{formaterFcfa(recap.recettes)}</th>
            <th className="num">{formaterFcfa(recap.depenses)}</th>
            <th className="num" data-testid="total-cloture">{formaterFcfa(recap.cloture)}</th>
            {avecSoldeActuel && <th className="num">{formaterFcfa(recap.solde_actuel)}</th>}
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={avecSoldeActuel ? 7 : 6} className="document-liste-pied">
              État des caisses · {filiale.nom} · {perimetre} · édité le {edite} · total {formaterFcfa(recap.cloture)}
            </td>
          </tr>
        </tfoot>
      </table>

      {lignes.length === 0 && <p>Aucune caisse dans ce périmètre.</p>}

      <div className="recu-signatures" style={{ marginTop: '10mm' }}>
        <span>Le caissier</span>
        <span>Le gérant</span>
      </div>
    </DocumentImprimable>
  );
}
