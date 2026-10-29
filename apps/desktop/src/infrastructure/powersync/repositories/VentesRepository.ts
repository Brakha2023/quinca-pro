import type { Transaction } from '@powersync/web';
import type { CaisseRow, ClientRow, LigneVenteRow, StatutVente, VenteRow } from '@quinca/shared-types';
import { calculerSolde } from '../../../core/clients';
import { codePoste, numeroPiece } from '../../desktop/identitePoste';
import { MODES_EN_CAISSE, calculerLigne, preparerVente, type VenteAEnregistrer, type VentePreparee } from '../../../core/ventes';
import { BaseRepository } from './BaseRepository';
import { StockRepository } from './StockRepository';

export interface ContexteVente {
  filialeId: string;
  utilisateurId: string | null;
  caisseId: string;
  caisseCode: string;
  depotId: string;
  /** Vente forcée malgré un stock insuffisant (réservé aux profils autorisés). */
  autoriserStockNegatif?: boolean;
  /** Proforma facturée par cette vente : passe FACTUREE dans la même transaction. */
  proformaId?: string | null;
}

export interface FiltresVentes {
  /** Jour au format AAAA-MM-JJ (heure locale). */
  jour?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  caisseId?: string | null;
  statut?: StatutVente | null;
  recherche?: string;
  limite?: number;
}

export interface VenteVueRow extends VenteRow {
  client_nom: string | null;
  caisse_nom: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
  nombre_lignes: number;
}

function debutJourIso(jour: string): string {
  return new Date(`${jour}T00:00:00`).toISOString();
}
function finJourIso(jour: string): string {
  return new Date(`${jour}T23:59:59.999`).toISOString();
}

export function ventesQuery(filialeId: string | null, filtres: FiltresVentes = {}) {
  const conditions = ['v.filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (filtres.jour) { conditions.push('v.date_vente BETWEEN ? AND ?'); params.push(debutJourIso(filtres.jour), finJourIso(filtres.jour)); }
  if (filtres.dateDebut) { conditions.push('v.date_vente >= ?'); params.push(debutJourIso(filtres.dateDebut)); }
  if (filtres.dateFin) { conditions.push('v.date_vente <= ?'); params.push(finJourIso(filtres.dateFin)); }
  if (filtres.caisseId) { conditions.push('v.caisse_id = ?'); params.push(filtres.caisseId); }
  if (filtres.statut) { conditions.push('v.statut = ?'); params.push(filtres.statut); }
  const q = filtres.recherche?.trim();
  if (q) { conditions.push('(v.numero LIKE ? OR c.raison_sociale LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  params.push(filtres.limite ?? 500);
  return {
    sql: `SELECT v.*, c.raison_sociale AS client_nom, ca.nom AS caisse_nom, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom,
                 (SELECT COUNT(*) FROM lignes_vente l WHERE l.vente_id = v.id) AS nombre_lignes
          FROM ventes v
          LEFT JOIN clients c ON c.id = v.client_id
          LEFT JOIN caisses ca ON ca.id = v.caisse_id
          LEFT JOIN utilisateurs u ON u.id = v.utilisateur_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY v.date_vente DESC
          LIMIT ?`,
    params,
  };
}

export const LIGNES_VENTE_QUERY = 'SELECT * FROM lignes_vente WHERE vente_id = ? ORDER BY code_article';

/**
 * Enregistrement d'une vente : une seule transaction locale pour la vente,
 * ses lignes, les sorties de stock, la créance client, l'encaissement en
 * caisse et la demande de livraison. Tout ou rien.
 */
export class VentesRepository extends BaseRepository {
  private get stock() {
    return new StockRepository(this.db);
  }

  /**
   * Le numéro du bon de livraison est rendu avec la vente : il s'imprime dans
   * la foulée, sur la pièce qui part avec la marchandise.
   */
  enregistrer(ctx: ContexteVente, vente: VenteAEnregistrer): Promise<{ id: string; preparee: VentePreparee; numeroLivraison: string | null }> {
    const preparee = preparerVente(vente, { caisse: ctx.caisseCode, code: codePoste() });
    return this.db.writeTransaction(async (tx) => {
      const id = this.nouvelId();
      const now = this.maintenant();
      const t = preparee.totaux;

      await tx.execute(
        `INSERT INTO ventes (id, numero, date_vente, client_id, utilisateur_id, caisse_id, filiale_id, total_brut_ht, total_remise, total_net_ht,
                             total_tva, total_ttc, montant_percu, reste_a_payer, monnaie, mode_paiement, statut, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?, ?, ?)`,
        [
          id, preparee.numero, now, vente.client?.id ?? null, ctx.utilisateurId, ctx.caisseId, ctx.filialeId,
          t.total_brut_ht, t.total_remise, t.total_net_ht, t.total_tva, t.total_ttc,
          preparee.montant_percu, preparee.reste_a_payer, preparee.monnaie, preparee.mode_paiement, vente.notes || null, now, now,
        ],
      );

      for (const ligne of vente.lignes) {
        const l = calculerLigne(ligne);
        await tx.execute(
          `INSERT INTO lignes_vente (id, vente_id, filiale_id, article_id, code_article, designation, quantite, prix_unitaire_ht, prix_unitaire_ttc,
                                     remise_percent, tva_percent, total_ht, total_ttc, depot_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [this.nouvelId(), id, ctx.filialeId, l.article_id, l.code, l.designation, l.quantite, l.prix_unitaire_ht, l.prix_unitaire_ttc,
           l.remise_percent, l.tva_percent, l.total_ht, l.total_ttc, ctx.depotId, now],
        );
        await this.stock.appliquerDansTransaction(
          tx, ctx, ctx.depotId, 'SORTIE_VENTE',
          { article_id: l.article_id, quantite: l.quantite, cout_unitaire: null },
          preparee.numero, null, { autoriserNegatif: ctx.autoriserStockNegatif },
        );
      }

      if (vente.client) {
        await this.debiterClient(tx, vente.client.id, t.total_ttc, preparee.montant_encaisse);
        if (preparee.montant_encaisse > 0) {
          await tx.execute(
            `INSERT INTO reglements_clients (id, numero, client_id, vente_id, date_reglement, montant, type_reglement, reference, caisse_id, utilisateur_id, filiale_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [this.nouvelId(), numeroPiece('REG'), vente.client.id, id, now, preparee.montant_encaisse,
             preparee.mode_paiement === 'CREDIT' ? 'ESPECES' : preparee.mode_paiement, preparee.numero, ctx.caisseId, ctx.utilisateurId, ctx.filialeId, now],
          );
        }
      }

      if (preparee.montant_encaisse > 0) {
        await this.encaisser(tx, ctx, preparee.montant_encaisse, preparee.numero, MODES_EN_CAISSE.has(preparee.mode_paiement), `Vente ${preparee.numero}`);
      }

      if (ctx.proformaId) {
        const p = await tx.getOptional<{ statut: string }>('SELECT statut FROM proformas WHERE id = ?', [ctx.proformaId]);
        if (p?.statut !== 'EN_COURS') throw new Error('Cette proforma a déjà été facturée ou annulée');
        await this.patch(tx, 'proformas', ctx.proformaId, { statut: 'FACTUREE', vente_id: id });
      }

      let numeroLivraison: string | null = null;
      if (vente.livraison) {
        numeroLivraison = numeroPiece('LIV');
        await tx.execute(
          `INSERT INTO livraisons (id, numero, vente_id, client_id, adresse_livraison, chauffeur, vehicule, statut, date_livraison_prevue, filiale_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'A_PREPARER', ?, ?, ?, ?)`,
          [this.nouvelId(), numeroLivraison, id, vente.client?.id ?? null, vente.livraison.adresse_livraison,
           vente.livraison.chauffeur || null, vente.livraison.vehicule || null, new Date(vente.livraison.date_livraison_prevue).toISOString(), ctx.filialeId, now, now],
        );
      }

      return { id, preparee, numeroLivraison };
    });
  }

  /** Validation de fin de journée : les ventes en attente passent en VALIDEE. */
  async valider(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.db.writeTransaction(async (tx) => {
      let n = 0;
      for (const id of ids) {
        // rowsAffected n'est pas fiable avec les vues PowerSync : on vérifie l'état avant.
        const v = await tx.getOptional<{ statut: string }>('SELECT statut FROM ventes WHERE id = ?', [id]);
        if (v?.statut !== 'EN_ATTENTE') continue;
        await tx.execute(`UPDATE ventes SET statut = 'VALIDEE', updated_at = ? WHERE id = ?`, [this.maintenant(), id]);
        n++;
      }
      return n;
    });
  }

  /**
   * Annulation d'une vente en attente : retour des articles en stock,
   * contre-passation de la créance et de l'encaissement, livraison annulée.
   */
  annuler(ctx: { filialeId: string; utilisateurId: string | null }, venteId: string, motif: string): Promise<void> {
    return this.db.writeTransaction(async (tx) => {
      const v = await tx.get<VenteRow>('SELECT * FROM ventes WHERE id = ?', [venteId]);
      if (v.statut !== 'EN_ATTENTE') throw new Error('Seule une vente en attente peut être annulée');
      const lignes = await tx.getAll<LigneVenteRow>(LIGNES_VENTE_QUERY, [venteId]);
      const now = this.maintenant();
      const encaisse = (v.montant_percu ?? 0) - (v.monnaie ?? 0);

      for (const l of lignes) {
        if (!l.article_id || !l.depot_id) continue;
        await this.stock.appliquerDansTransaction(
          tx, ctx, l.depot_id, 'RETOUR_CLIENT',
          { article_id: l.article_id, quantite: l.quantite ?? 0, cout_unitaire: null },
          v.numero ?? '', `Annulation vente : ${motif}`,
        );
      }

      if (v.client_id) {
        await this.debiterClient(tx, v.client_id, -(v.total_ttc ?? 0), -encaisse);
      }

      if (encaisse > 0) {
        const mode = v.mode_paiement ?? 'ESPECES';
        await tx.execute(
          `INSERT INTO mouvements_tresorerie (id, type, categorie, montant, description, reference, caisse_id, utilisateur_id, filiale_id, date_operation, created_at)
           VALUES (?, 'DEPENSE', 'ANNULATION_VENTE', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [this.nouvelId(), encaisse, `Annulation vente ${v.numero} : ${motif}`, v.numero, v.caisse_id, ctx.utilisateurId, ctx.filialeId, now, now],
        );
        if (v.caisse_id && MODES_EN_CAISSE.has(mode as 'ESPECES')) {
          const caisse = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [v.caisse_id]);
          await this.patch(tx, 'caisses', v.caisse_id, { solde_actuel: (caisse.solde_actuel ?? 0) - encaisse });
        }
      }

      await tx.execute(`UPDATE livraisons SET statut = 'ANNULEE', updated_at = ? WHERE vente_id = ? AND statut != 'LIVREE'`, [now, venteId]);
      await this.patch(tx, 'ventes', venteId, { statut: 'ANNULEE', notes: [v.notes, `Annulée : ${motif}`].filter(Boolean).join(' · ') });
    });
  }

  private async debiterClient(tx: Transaction, clientId: string, montantFacture: number, montantRegle: number): Promise<void> {
    const c = await tx.get<ClientRow>('SELECT * FROM clients WHERE id = ?', [clientId]);
    const cumul_factures = (c.cumul_factures ?? 0) + montantFacture;
    const cumul_reglements = (c.cumul_reglements ?? 0) + montantRegle;
    await this.patch(tx, 'clients', clientId, {
      cumul_factures,
      cumul_reglements,
      solde_actuel: calculerSolde({ solde_initial: c.solde_initial ?? 0, cumul_factures, cumul_reglements }),
    });
  }

  private async encaisser(tx: Transaction, ctx: ContexteVente, montant: number, reference: string, enCaisse: boolean, description: string): Promise<void> {
    const now = this.maintenant();
    await tx.execute(
      `INSERT INTO mouvements_tresorerie (id, type, categorie, montant, description, reference, caisse_id, utilisateur_id, filiale_id, date_operation, created_at)
       VALUES (?, 'RECETTE', 'VENTE', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.nouvelId(), montant, description, reference, ctx.caisseId, ctx.utilisateurId, ctx.filialeId, now, now],
    );
    if (enCaisse) {
      const caisse = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [ctx.caisseId]);
      await this.patch(tx, 'caisses', ctx.caisseId, { solde_actuel: (caisse.solde_actuel ?? 0) + montant });
    }
  }
}
