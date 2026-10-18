import type { Transaction } from '@powersync/web';
import type { ArticleRow, LigneTransfertStockRow, TransfertStockRow } from '@quinca/shared-types';
import { arrondirFcfa } from '../../../core/commun/prix';
import {
  fusionnerLignes,
  totauxTransfert,
  transfertAnnulable,
  transfertReceptionnable,
  type TransfertFilialeStock,
} from '../../../core/stock';
import { numeroPiece } from '../../desktop/identitePoste';
import { BaseRepository } from './BaseRepository';
import { StockRepository, type ContexteMouvement } from './StockRepository';

export interface FiltresTransfertsStock {
  debut?: string;
  fin?: string;
  sens?: 'TOUS' | 'ENVOIS' | 'RECEPTIONS';
  /** Filiale d'en face : destinataire d'un envoi, expéditrice d'une réception. */
  filialeId?: string | null;
  statut?: string;
  limite?: number;
}

/**
 * Transferts où la filiale est partie prenante, dans un sens ou dans l'autre.
 * Les noms sont joints ici : la liste, le bon et l'export les affichent tous.
 */
export function transfertsStockQuery(filialeId: string | null, filtres: FiltresTransfertsStock = {}) {
  const moi = filialeId ?? '';
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filtres.sens === 'ENVOIS') { conditions.push('t.filiale_source_id = ?'); params.push(moi); }
  else if (filtres.sens === 'RECEPTIONS') { conditions.push('t.filiale_destination_id = ?'); params.push(moi); }
  else { conditions.push('(t.filiale_source_id = ? OR t.filiale_destination_id = ?)'); params.push(moi, moi); }

  if (filtres.filialeId) {
    // « L'autre bout » du transfert, quel que soit le sens.
    conditions.push('((t.filiale_source_id = ? AND t.filiale_destination_id = ?) OR (t.filiale_destination_id = ? AND t.filiale_source_id = ?))');
    params.push(moi, filtres.filialeId, moi, filtres.filialeId);
  }
  if (filtres.statut) { conditions.push('t.statut = ?'); params.push(filtres.statut); }
  // Les bornes sont des jours : la fin est inclusive jusqu'à 23 h 59.
  if (filtres.debut) { conditions.push('t.date_envoi >= ?'); params.push(filtres.debut); }
  if (filtres.fin) { conditions.push('t.date_envoi <= ?'); params.push(`${filtres.fin}T23:59:59.999Z`); }
  params.push(filtres.limite ?? 300);

  return {
    sql: `SELECT t.*,
                 fs.nom AS filiale_source_nom, fd.nom AS filiale_destination_nom,
                 ds.nom AS depot_source_nom, dd.nom AS depot_destination_nom,
                 ue.nom AS envoi_nom, ue.prenom AS envoi_prenom,
                 ur.nom AS reception_nom, ur.prenom AS reception_prenom
          FROM transferts_stock t
          LEFT JOIN filiales fs ON fs.id = t.filiale_source_id
          LEFT JOIN filiales fd ON fd.id = t.filiale_destination_id
          LEFT JOIN depots ds ON ds.id = t.depot_source_id
          LEFT JOIN depots dd ON dd.id = t.depot_destination_id
          LEFT JOIN utilisateurs ue ON ue.id = t.utilisateur_envoi_id
          LEFT JOIN utilisateurs ur ON ur.id = t.utilisateur_reception_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY t.date_envoi DESC
          LIMIT ?`,
    params,
  };
}

export const LIGNES_TRANSFERT_QUERY =
  'SELECT * FROM lignes_transfert_stock WHERE transfert_id = ? ORDER BY designation';

/** Article du catalogue de la filiale, retrouvé par son code (clé unique côté serveur). */
const ARTICLE_PAR_CODE = 'SELECT * FROM articles WHERE filiale_id = ? AND code = ?';

export interface ResultatReception {
  numero: string;
  /** Codes que la filiale ne connaissait pas : créés à la volée, à vérifier. */
  articlesCrees: string[];
}

/**
 * Envoi, réception et annulation d'un transfert de marchandise entre filiales.
 *
 * Le stock bouge en deux temps, parce que la marchandise voyage : l'expéditeur
 * sort tout de suite (la quantité quitte son dépôt), le destinataire fait
 * entrer à l'arrivée. Tant que personne n'a réceptionné, la marchandise n'est
 * dans aucun dépôt — elle est sur le bon, qui reste « en transit ».
 */
export class TransfertsStockRepository extends BaseRepository {
  private readonly stock = new StockRepository(this.db);

  /** Départ : la marchandise quitte le dépôt source, le bon part « en transit ». */
  envoyer(ctx: ContexteMouvement, transfert: TransfertFilialeStock): Promise<string> {
    const numero = transfert.numero || numeroPiece('TSF');
    return this.db.writeTransaction(async (tx) => {
      // Tout est lu avant d'écrire : les totaux doivent être connus pour que
      // l'en-tête parte complet, et le serveur refuserait une ligne dont le
      // bon n'existe pas encore (clé étrangère).
      const lignes = [];
      for (const ligne of fusionnerLignes(transfert.lignes)) {
        const article = await tx.get<ArticleRow>('SELECT * FROM articles WHERE id = ?', [ligne.article_id]);
        const stock = await tx.getOptional<{ cout_moyen: number | null }>(
          'SELECT cout_moyen FROM stocks WHERE article_id = ? AND depot_id = ?',
          [ligne.article_id, transfert.depot_source_id],
        );
        lignes.push({
          article_id: ligne.article_id,
          code: article.code ?? '',
          designation: article.designation ?? '',
          unite: article.unite ?? 'PIECE',
          quantite: ligne.quantite,
          // Le coût moyen du dépôt de départ suit la marchandise : sans lui,
          // la filiale d'arrivée valoriserait son stock à zéro.
          cout_unitaire: stock?.cout_moyen ?? article.prix_achat ?? 0,
          prix_vente: article.prix_vente ?? 0,
        });
      }

      const totaux = totauxTransfert(lignes);
      const now = this.maintenant();
      const transfertId = this.nouvelId();

      await tx.execute(
        `INSERT INTO transferts_stock (id, numero, filiale_source_id, filiale_destination_id, depot_source_id, depot_destination_id,
           statut, motif, transporteur, nombre_lignes, quantite_totale, valeur_totale, date_envoi, date_reception,
           utilisateur_envoi_id, utilisateur_reception_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, 'EN_TRANSIT', ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)`,
        [
          transfertId, numero, ctx.filialeId, transfert.filiale_destination_id, transfert.depot_source_id,
          transfert.motif || null, transfert.transporteur || null,
          totaux.nombre_lignes, totaux.quantite_totale, totaux.valeur_totale, now, ctx.utilisateurId, now, now,
        ],
      );

      for (const ligne of lignes) {
        await tx.execute(
          `INSERT INTO lignes_transfert_stock (id, transfert_id, filiale_source_id, filiale_destination_id, article_id,
             code, designation, unite, quantite, cout_unitaire, prix_vente, montant, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            this.nouvelId(), transfertId, ctx.filialeId, transfert.filiale_destination_id, ligne.article_id,
            ligne.code, ligne.designation, ligne.unite, ligne.quantite, ligne.cout_unitaire, ligne.prix_vente,
            arrondirFcfa(ligne.quantite * ligne.cout_unitaire), now,
          ],
        );
        // La sortie est refusée si le disponible ne suit pas : tout le bon tombe.
        await this.stock.appliquerDansTransaction(tx, ctx, transfert.depot_source_id, 'TRANSFERT_SORTIE', {
          article_id: ligne.article_id, quantite: ligne.quantite, cout_unitaire: null,
        }, numero, transfert.motif || null);
      }

      return numero;
    });
  }

  /**
   * Arrivée : la filiale destinataire fait entrer la marchandise dans le dépôt
   * de son choix, au coût qui a voyagé avec elle. Un article que son catalogue
   * ne connaît pas est créé plutôt que refusé — la marchandise, elle, est déjà
   * dans la cour ; le panneau annonce les créations à vérifier.
   */
  recevoir(ctx: ContexteMouvement, transfertId: string, depotDestinationId: string): Promise<ResultatReception> {
    return this.db.writeTransaction(async (tx) => {
      const t = await tx.get<TransfertStockRow>('SELECT * FROM transferts_stock WHERE id = ?', [transfertId]);
      this.verifierReceptionnable(t, ctx.filialeId);

      const lignes = await tx.getAll<LigneTransfertStockRow>(LIGNES_TRANSFERT_QUERY, [transfertId]);
      if (lignes.length === 0) throw new Error("Ce bon n'a aucune ligne : la réception est impossible.");
      const articlesCrees: string[] = [];

      for (const ligne of lignes) {
        const articleId = await this.articleDeLaFiliale(tx, ctx.filialeId, ligne, articlesCrees);
        await this.stock.appliquerDansTransaction(tx, ctx, depotDestinationId, 'TRANSFERT_ENTREE', {
          article_id: articleId, quantite: ligne.quantite ?? 0, cout_unitaire: ligne.cout_unitaire ?? 0,
        }, t.numero ?? '', t.motif || null);
      }

      await this.patch(tx, 'transferts_stock', transfertId, {
        statut: 'RECU',
        depot_destination_id: depotDestinationId,
        date_reception: this.maintenant(),
        utilisateur_reception_id: ctx.utilisateurId,
      });

      return { numero: t.numero ?? '', articlesCrees };
    });
  }

  /** Annulation par l'expéditeur tant que rien n'est arrivé : la marchandise rentre au dépôt de départ. */
  annuler(ctx: ContexteMouvement, transfertId: string, motif: string): Promise<void> {
    return this.db.writeTransaction(async (tx) => {
      const t = await tx.get<TransfertStockRow>('SELECT * FROM transferts_stock WHERE id = ?', [transfertId]);
      if (!transfertAnnulable(
        { statut: (t.statut ?? 'EN_TRANSIT') as 'EN_TRANSIT', filiale_source_id: t.filiale_source_id ?? '', filiale_destination_id: t.filiale_destination_id ?? '' },
        ctx.filialeId,
      )) {
        throw new Error(t.statut === 'EN_TRANSIT'
          ? 'Seule la filiale expéditrice peut annuler ce transfert.'
          : 'Ce transfert a déjà été traité.');
      }

      const lignes = await tx.getAll<LigneTransfertStockRow>(LIGNES_TRANSFERT_QUERY, [transfertId]);
      for (const ligne of lignes) {
        if (!ligne.article_id) continue;
        await this.stock.appliquerDansTransaction(tx, ctx, t.depot_source_id ?? '', 'TRANSFERT_ENTREE', {
          article_id: ligne.article_id, quantite: ligne.quantite ?? 0, cout_unitaire: ligne.cout_unitaire ?? 0,
        }, t.numero ?? '', `Annulation du transfert ${t.numero ?? ''}`);
      }

      // Le motif d'origine reste lisible : la raison de l'annulation s'y ajoute.
      await this.patch(tx, 'transferts_stock', transfertId, {
        statut: 'ANNULE',
        motif: [t.motif, motif && `Annulé : ${motif}`].filter(Boolean).join(' — ') || null,
      });
    });
  }

  private verifierReceptionnable(t: TransfertStockRow, filialeId: string): void {
    const vue = {
      statut: (t.statut ?? 'EN_TRANSIT') as 'EN_TRANSIT',
      filiale_source_id: t.filiale_source_id ?? '',
      filiale_destination_id: t.filiale_destination_id ?? '',
    };
    if (transfertReceptionnable(vue, filialeId)) return;
    throw new Error(t.statut === 'EN_TRANSIT'
      ? 'Seule la filiale destinataire peut réceptionner ce transfert.'
      : 'Ce transfert a déjà été traité.');
  }

  /**
   * L'article du catalogue local qui porte ce code, créé au besoin. Les
   * catalogues sont propres à chaque filiale : c'est le code qui fait le lien,
   * et le prix de vente de l'expéditeur sert d'amorce pour qu'un article
   * n'entre jamais au catalogue à 0 F.
   */
  private async articleDeLaFiliale(tx: Transaction, filialeId: string, ligne: LigneTransfertStockRow, crees: string[]): Promise<string> {
    const code = ligne.code ?? '';
    const existant = await tx.getOptional<ArticleRow>(ARTICLE_PAR_CODE, [filialeId, code]);
    if (existant) return existant.id;

    const id = this.nouvelId();
    const now = this.maintenant();
    await tx.execute(
      `INSERT INTO articles (id, code, designation, famille_id, prix_achat, prix_vente, tva, stock_min, stock_max,
                             unite, filiale_id, est_actif, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, 18, 0, 0, ?, ?, 1, ?, ?)`,
      [id, code, ligne.designation ?? code, ligne.cout_unitaire ?? 0, ligne.prix_vente ?? 0, ligne.unite ?? 'PIECE', filialeId, now, now],
    );
    crees.push(code);
    return id;
  }
}
