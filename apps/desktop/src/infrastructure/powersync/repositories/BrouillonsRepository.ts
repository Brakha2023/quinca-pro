import { ecrireLignesBrouillon, type LignePanier } from '../../../core/ventes';
import { codePoste } from '../../desktop/identitePoste';
import { TABLE_BROUILLONS_LOCAUX } from '../schema';
import { BaseRepository } from './BaseRepository';

/**
 * Ventes mises de côté, partagées entre les postes d'une filiale.
 *
 * Écrites comme tout le reste : dans la base locale, puis remontées par la
 * synchronisation. Un brouillon pris hors ligne existe donc tout de suite sur
 * sa machine, et apparaît sur les autres caisses au retour du réseau.
 *
 * ### Deux écritures pour un brouillon
 *
 * Chaque brouillon s'écrit **deux fois** : dans `ventes_brouillons`, qui part
 * au serveur et se partage, et dans `brouillons_locaux`, qui ne bouge pas de
 * la machine (voir le cartouche de cette table dans `schema.ts`). La seconde
 * est une copie de sûreté : PowerSync ne garde une ligne d'une table
 * synchronisée que si le serveur la renvoie, et un flux qui ne couvre pas la
 * table fait disparaître le ticket tout seul, quelques secondes après la mise
 * de côté. Le comptoir perdait alors le panier d'un client qui attend.
 *
 * La liste lit les deux et ne montre la copie que si la ligne partagée manque.
 */

/** Colonnes d'un brouillon, dans l'ordre où les deux tables les portent. */
const COLONNES = [
  'libelle', 'filiale_id', 'client_id', 'lignes', 'remise', 'remise_auto',
  'total_ttc', 'articles', 'utilisateur_id', 'poste', 'created_at', 'updated_at',
] as const;

/**
 * `partage` dit d'où vient la ligne : la table partagée, ou la copie du poste.
 *
 * Chaque colonne est nommée (`AS`) bien que le nom soit le même : dans une
 * union, SQLite ne reconnaît un terme d'`ORDER BY` que parmi les noms
 * explicites — sans eux, `ORDER BY created_at` est refusé (« 1st ORDER BY term
 * does not match any column in the result set »).
 */
const selection = (table: string, alias: string, partage: 0 | 1) => `
  SELECT ${['id', ...COLONNES].map((c) => `${alias}.${c} AS ${c}`).join(', ')},
         ${partage} AS partage, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom
  FROM ${table} ${alias}
  LEFT JOIN utilisateurs u ON u.id = ${alias}.utilisateur_id
  WHERE ${alias}.filiale_id = ?`;

/**
 * Le plus récent en tête : c'est celui qu'on reprend le plus souvent.
 *
 * Les deux tables se lisent ensemble, la copie locale en second et seulement
 * pour les brouillons que la table partagée n'a pas (ou plus) : tant que le
 * tour serveur n'est pas bouclé, c'est la ligne partagée qui s'affiche — même
 * contenu, et c'est elle que les autres caisses verront. La copie ne sort de
 * l'ombre que si cette ligne a été révoquée, c'est-à-dire précisément quand le
 * ticket se serait évaporé.
 *
 * La filiale se passe **deux fois** en paramètre, une par branche de l'union.
 */
export const BROUILLONS_QUERY = `
  ${selection('ventes_brouillons', 'b', 1)}
  UNION ALL
  ${selection(TABLE_BROUILLONS_LOCAUX, 'l', 0)} AND l.id NOT IN (SELECT id FROM ventes_brouillons)
  ORDER BY created_at DESC
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
    const valeurs = [
      id, brouillon.libelle, ctx.filialeId, brouillon.clientId,
      ecrireLignesBrouillon(brouillon.lignes), brouillon.remise, brouillon.remiseAuto ? 1 : 0,
      brouillon.totalTtc, brouillon.articles, ctx.utilisateurId, codePoste(), now, now,
    ];
    const insertion = (table: string) =>
      `INSERT INTO ${table} (id, ${COLONNES.join(', ')})
       VALUES (${valeurs.map(() => '?').join(', ')})`;

    await this.db.writeTransaction(async (tx) => {
      await tx.execute(insertion('ventes_brouillons'), valeurs);
      await tx.execute(insertion(TABLE_BROUILLONS_LOCAUX), valeurs);
    });
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
    await this.db.writeTransaction(async (tx) => {
      await tx.execute('DELETE FROM ventes_brouillons WHERE id = ?', [id]);
      await tx.execute(`DELETE FROM ${TABLE_BROUILLONS_LOCAUX} WHERE id = ?`, [id]);
    });
  }

  /**
   * Oublie les copies dont la ligne partagée est revenue du serveur.
   *
   * Sans cela, la copie survivrait au brouillon : une autre caisse reprend le
   * ticket, la ligne partagée s'efface partout, et la copie le ferait
   * réapparaître ici — où il serait encaissé une seconde fois. La copie ne
   * doit donc vivre qu'aussi longtemps que le tour serveur n'est pas conclu.
   *
   * On le sait au `dernierSync` : PowerSync n'applique un checkpoint qu'une
   * fois les écritures locales envoyées, acquittées **et** redescendues. Passé
   * cet instant, la table partagée dit l'état du serveur et plus la projection
   * du poste — donc un brouillon créé *avant* et qui y figure encore a bien
   * fait l'aller-retour, et sa copie n'a plus de raison d'être. Celui qui n'y
   * figure plus a été révoqué : sa copie reste, et c'est tout l'objet.
   */
  async oublierCopiesConfirmees(dernierSync: Date): Promise<void> {
    await this.db.execute(
      `DELETE FROM ${TABLE_BROUILLONS_LOCAUX}
       WHERE created_at < ? AND id IN (SELECT id FROM ventes_brouillons)`,
      [dernierSync.toISOString()],
    );
  }
}
