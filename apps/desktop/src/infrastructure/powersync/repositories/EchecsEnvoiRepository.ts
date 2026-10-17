import { echecFromRow, motifEchec, type EchecEnvoi, type EchecEnvoiRow } from '../../../core/sync';
import { lireUtilisateurCourantId } from '../../auth/utilisateurCourant';
import { appliquerOperation, type OperationAEnvoyer } from '../envoiSupabase';
import { TABLE_ECHECS_ENVOI } from '../schema';
import { BaseRepository } from './BaseRepository';

/** Écritures mises de côté, de la plus récente à la plus ancienne. */
export const ECHECS_ENVOI_QUERY = `
  SELECT e.*, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom
    FROM ${TABLE_ECHECS_ENVOI} e LEFT JOIN utilisateurs u ON u.id = e.utilisateur_id
   ORDER BY e.date_echec DESC`;

export const COMPTER_ECHECS_ENVOI_QUERY = `SELECT COUNT(*) AS n FROM ${TABLE_ECHECS_ENVOI}`;

/*
 * PowerSync ne notifie pas les changements d'une table **locale** : ses hooks
 * SQLite ne suivent que les tables synchronisées (vérifié sur @powersync/web
 * 2.3.1 — `onChange` ne reçoit rien pour `echecs_envoi`). Un `useQuery` ne se
 * rafraîchirait donc jamais, et le bandeau raterait l'incident qu'il doit
 * annoncer. On prévient les écrans nous-mêmes : la mise de côté est faite par
 * le connecteur, dans le même contexte JavaScript que l'interface.
 */
type Abonne = () => void;
const abonnes = new Set<Abonne>();

/** S'abonne aux mises de côté, reprises et abandons. Rend la fonction de désabonnement. */
export function surChangementEchecs(abonne: Abonne): () => void {
  abonnes.add(abonne);
  return () => abonnes.delete(abonne);
}

function signalerChangement(): void {
  for (const abonne of [...abonnes]) abonne();
}

export interface EchecEnvoiVue extends EchecEnvoi {
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
}

export function echecVueFromRow(row: EchecEnvoiRow & { utilisateur_nom: string | null; utilisateur_prenom: string | null }): EchecEnvoiVue {
  return { ...echecFromRow(row), utilisateur_nom: row.utilisateur_nom, utilisateur_prenom: row.utilisateur_prenom };
}

/**
 * Les écritures que le serveur a refusées définitivement : conservées ici avec
 * leur motif, au lieu d'être abandonnées en silence. La file d'envoi repart,
 * et un responsable décide ensuite de réessayer ou d'abandonner.
 */
export class EchecsEnvoiRepository extends BaseRepository {
  /**
   * Met de côté les opérations non appliquées d'une transaction refusée.
   * Appelé depuis le connecteur, donc jamais dans une transaction locale : on
   * écrit directement, et un échec d'écriture ici ne doit pas masquer l'échec
   * d'envoi (il remonte au connecteur, qui laissera PowerSync réessayer).
   */
  async mettreDeCote(operations: OperationAEnvoyer[], erreur: unknown, lot?: number): Promise<void> {
    const { code, message, explication } = motifEchec(erreur);
    const maintenant = this.maintenant();
    const utilisateurId = lireUtilisateurCourantId();

    for (const op of operations) {
      await this.db.execute(
        `INSERT INTO ${TABLE_ECHECS_ENVOI} (id, lot, table_cible, ligne_id, operation, donnees, code, motif, explication, tentatives, date_echec, utilisateur_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          this.nouvelId(),
          lot != null ? String(lot) : null,
          op.table,
          op.id,
          op.operation,
          op.donnees ? JSON.stringify(op.donnees) : null,
          code,
          message,
          explication,
          maintenant,
          utilisateurId,
        ],
      );
    }
    signalerChangement();
  }

  /** Les écritures mises de côté, de la plus récente à la plus ancienne. */
  async lister(): Promise<EchecEnvoiVue[]> {
    const rows = await this.db.getAll<EchecEnvoiRow & { utilisateur_nom: string | null; utilisateur_prenom: string | null }>(ECHECS_ENVOI_QUERY);
    return rows.map(echecVueFromRow);
  }

  /**
   * Rejoue une écriture mise de côté. Si le serveur l'accepte enfin (la cause a
   * été corrigée), la ligne disparaît ; sinon elle reste, avec le nouveau motif
   * et une tentative de plus — on ne la perd jamais sur un échec.
   */
  async reessayer(id: string): Promise<{ envoye: boolean; motif?: string }> {
    const row = await this.db.getOptional<EchecEnvoiRow>(`SELECT * FROM ${TABLE_ECHECS_ENVOI} WHERE id = ?`, [id]);
    if (!row) return { envoye: true }; // déjà traitée depuis un autre écran
    const echec = echecFromRow(row);
    try {
      await appliquerOperation({ table: echec.table_cible, id: echec.ligne_id, operation: echec.operation, donnees: echec.donnees });
    } catch (erreur) {
      const { code, message, explication } = motifEchec(erreur);
      await this.db.execute(
        `UPDATE ${TABLE_ECHECS_ENVOI} SET code = ?, motif = ?, explication = ?, tentatives = ?, date_echec = ? WHERE id = ?`,
        [code, message, explication, echec.tentatives + 1, this.maintenant(), id],
      );
      signalerChangement();
      return { envoye: false, motif: explication };
    }
    await this.retirer(id);
    return { envoye: true };
  }

  /**
   * Renonce à l'écriture, sur décision d'un responsable : la ligne reste dans la
   * base locale du poste, mais le serveur ne la connaîtra jamais.
   */
  async abandonner(id: string): Promise<void> {
    await this.retirer(id);
  }

  private async retirer(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM ${TABLE_ECHECS_ENVOI} WHERE id = ?`, [id]);
    signalerChangement();
  }
}
