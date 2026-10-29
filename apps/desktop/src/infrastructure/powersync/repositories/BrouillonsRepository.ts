import { ecrireLignesBrouillon, type LignePanier } from '../../../core/ventes';
import { codePoste } from '../../desktop/identitePoste';
import { BaseRepository } from './BaseRepository';

/**
 * Ventes mises de côté, partagées entre les postes d'une filiale.
 *
 * Écrites comme tout le reste : dans la base locale, puis remontées par la
 * synchronisation. Un brouillon pris hors ligne existe donc tout de suite sur
 * sa machine, et apparaît sur les autres caisses au retour du réseau.
 */

/** Le plus récent en tête : c'est celui qu'on reprend le plus souvent. */
export const BROUILLONS_QUERY = `
  SELECT b.*, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom
  FROM ventes_brouillons b
  LEFT JOIN utilisateurs u ON u.id = b.utilisateur_id
  WHERE b.filiale_id = ?
  ORDER BY b.created_at DESC
  LIMIT 50`;

export interface BrouillonAEnregistrer {
  libelle: string;
  lignes: LignePanier[];
  clientId: string | null;
  remise: number;
  remiseAuto: boolean;
  totalTtc: number;
  articles: number;
}

export class BrouillonsRepository extends BaseRepository {
  async enregistrer(
    ctx: { filialeId: string; utilisateurId: string | null },
    brouillon: BrouillonAEnregistrer,
  ): Promise<string> {
    const id = this.nouvelId();
    const now = this.maintenant();
    await this.db.execute(
      `INSERT INTO ventes_brouillons (id, libelle, filiale_id, client_id, lignes, remise, remise_auto,
                                      total_ttc, articles, utilisateur_id, poste, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, brouillon.libelle, ctx.filialeId, brouillon.clientId,
        ecrireLignesBrouillon(brouillon.lignes), brouillon.remise, brouillon.remiseAuto ? 1 : 0,
        brouillon.totalTtc, brouillon.articles, ctx.utilisateurId, codePoste(), now, now,
      ],
    );
    return id;
  }

  /**
   * Un brouillon repris ou jeté disparaît pour tout le monde.
   *
   * Deux caisses peuvent le reprendre en même temps : la seconde verra la
   * ligne s'effacer sous ses yeux. La fenêtre se compte en secondes et rien
   * n'est perdu — le ticket est déjà à l'écran de la première.
   */
  async supprimer(id: string): Promise<void> {
    await this.db.execute('DELETE FROM ventes_brouillons WHERE id = ?', [id]);
  }
}
