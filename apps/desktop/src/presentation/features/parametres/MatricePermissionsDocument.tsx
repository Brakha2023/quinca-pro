import { Fragment } from 'react';
import { libellePortee, matricePermissions, type Role } from '../../../core/parametres';
import DocumentImprimable from '../../components/print/DocumentImprimable';

interface Props {
  roles: Array<Role & { porteurs: number }>;
  accordees: Map<string, Set<string>>;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  onClose: () => void;
}

/**
 * Tableau des rôles et permissions, en A4.
 *
 * C'est la pièce qu'on fait valider et qu'on classe : qui a le droit de quoi,
 * à une date donnée, signé. Une ligne par permission, une colonne par rôle,
 * les modules en intertitres — un gérant lit « Valider une vente : le gérant,
 * oui ; le caissier, non », pas une liste de codes.
 */
export default function MatricePermissionsDocument({ roles, accordees, filiale, onClose }: Props) {
  const lignes = matricePermissions(roles, accordees);
  const edite = new Date().toLocaleString('fr-FR');
  const porteurs = roles.reduce((n, r) => n + r.porteurs, 0);
  // Les lignes arrivent dans l'ordre du catalogue : les regrouper par module
  // donne les intertitres sans suivre un curseur pendant le rendu.
  const parModule = lignes.reduce<Array<{ module: string; lignes: typeof lignes }>>((groupes, ligne) => {
    const dernier = groupes.at(-1);
    if (dernier && dernier.module === ligne.module) dernier.lignes.push(ligne);
    else groupes.push({ module: ligne.module, lignes: [ligne] });
    return groupes;
  }, []);

  return (
    <DocumentImprimable titre="Rôles et permissions" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>État des droits</strong>
          <br />Édité le {edite}
          <br />{roles.length} rôle(s) · {lignes.length} permission(s) · {porteurs} compte(s) rattaché(s)
        </div>
        <div className="document-bloc" style={{ width: '82mm' }}>
          <strong>Lecture</strong>
          <br />Une croix vaut droit accordé. Sous chaque rôle : la portée de
          ses données, et le nombre de comptes qui le portent.
        </div>
      </div>

      <table className="document-liste" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', width: '52mm' }}>Permission</th>
            {roles.map((r) => (
              <th key={r.id} style={{ textAlign: 'center', overflowWrap: 'anywhere' }}>
                {r.nom}
                <br /><span style={{ fontWeight: 'normal', textTransform: 'none', fontSize: 8 }}>
                  {libellePortee(r.profil)} · {r.porteurs} compte(s)
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parModule.map((groupe) => (
            <Fragment key={groupe.module}>
              <tr>
                <td colSpan={roles.length + 1} style={{ background: '#eee', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {groupe.module}
                </td>
              </tr>
              {groupe.lignes.map((ligne) => (
                <tr key={ligne.permission.code} data-testid="ligne-permission">
                  <td>
                    {ligne.permission.libelle}
                    <br /><span className="document-code" style={{ fontSize: 8 }}>{ligne.permission.code}</span>
                  </td>
                  {ligne.detenue.map((detenue, i) => (
                    <td key={roles[i]!.id} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {detenue ? '×' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="document-liste-pied" colSpan={roles.length + 1}>
              Le superadministrateur détient toutes les permissions par nature : rien ne lui est retiré.
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="document-cachets">
        <div className="document-cachet">
          <p className="document-cachet-titre">Visa du directeur</p>
        </div>
        <div className="document-cachet">
          <p className="document-cachet-titre">Visa du contrôle</p>
        </div>
      </div>
    </DocumentImprimable>
  );
}
