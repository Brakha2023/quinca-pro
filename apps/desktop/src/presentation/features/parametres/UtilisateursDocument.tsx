import {
  libellePortee, nomComplet, perimetreUtilisateurs, recapUtilisateurs,
  type FiltresUtilisateurs, type UtilisateurAdministre,
} from '../../../core/parametres';
import DocumentImprimable from '../../components/print/DocumentImprimable';

interface Props {
  utilisateurs: UtilisateurAdministre[];
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filtres: FiltresUtilisateurs;
  nomRole: string | null;
  onClose: () => void;
}

/**
 * Liste des comptes en A4 : qui travaille, avec quel rôle, dans quelle filiale.
 *
 * Elle se classe à côté du tableau des permissions : l'un dit ce que chaque
 * rôle permet, l'autre qui le porte. Les deux ensemble répondent à la seule
 * question qui compte en cas de contrôle — qui pouvait faire ça, ce jour-là.
 */
export default function UtilisateursDocument({ utilisateurs, filiale, filtres, nomRole, onClose }: Props) {
  const recap = recapUtilisateurs(utilisateurs);
  const edite = new Date().toLocaleString('fr-FR');

  return (
    <DocumentImprimable titre="Comptes et rôles" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong>Périmètre</strong>
          <br />{perimetreUtilisateurs(filtres, nomRole)}
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ width: '62mm' }}>
          <strong>Comptes retenus</strong>
          <br />{recap.nombre} compte(s) · {recap.actifs} actif(s)
          {recap.sans_role > 0 && <><br />{recap.sans_role} sans rôle</>}
          {recap.mot_de_passe_par_defaut > 0 && <><br />{recap.mot_de_passe_par_defaut} mot(s) de passe à changer</>}
        </div>
      </div>

      <table className="document-liste">
        <thead>
          <tr>
            <th>Nom</th>
            <th>E-mail</th>
            <th>Rôle</th>
            <th>Portée des données</th>
            <th>Filiale</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          {utilisateurs.map((u) => (
            <tr key={u.id} data-testid="ligne-compte">
              <td>{nomComplet(u) || '—'}</td>
              <td className="document-code">{u.email}</td>
              <td>{u.role_nom ?? 'Aucun'}{u.role_est_superadmin ? ' ★' : ''}</td>
              <td>{libellePortee(u.profil)}</td>
              <td>{u.filiale_nom ?? (u.profil === 'DIRECTEUR' ? 'Toutes' : '—')}</td>
              <td>{u.est_actif ? 'Actif' : 'Désactivé'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="document-liste-pied" colSpan={6}>
              ★ superadministrateur : toutes les permissions. La portée des données dit ce que le poste reçoit, le rôle ce qu'on peut y faire.
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
