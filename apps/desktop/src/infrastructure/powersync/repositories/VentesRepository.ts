import type { Transaction } from '@powersync/web';
import type { CaisseRow, ClientRow, LigneVenteRow, StatutVente, VenteRow } from '@quinca/shared-types';
import { calculerSolde } from '../../../core/clients';
import { codeAnnulationDefini, normaliserCodeAnnulation } from '../../../core/parametres';
import { CATEGORIE_REOUVERTURE_VENTE } from '../../../core/tresorerie';
import { arrondirFcfa } from '../../../core/commun/prix';
import { verifierEmpreinte } from '../../auth/empreinteLocale';
import { codePoste, numeroCourt, numeroPiece } from '../../desktop/identitePoste';
import {
  calculerLigne, preparerVente, venteModifiable,
  type VenteAEnregistrer, type VentePreparee,
} from '../../../core/ventes';
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

/**
 * Ce qu'il faut pour corriger une vente : la filiale et qui corrige. La caisse
 * et le dépôt ne s'y trouvent pas — ils sont ceux de la vente d'origine, et
 * l'écran qui corrige n'est pas forcément un poste de caisse.
 */
export interface ContexteModification {
  filialeId: string;
  utilisateurId: string | null;
  autoriserStockNegatif?: boolean;
}

export interface FiltresVentes {
  /** Jour au format AAAA-MM-JJ (heure locale). */
  jour?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  caisseId?: string | null;
  statut?: StatutVente | null;
  recherche?: string;
  /**
   * Montant TTC exact, en francs. Un client ne retient pas un numéro de
   * ticket, mais il retient ce qu'il a payé : c'est par là qu'on retrouve sa
   * vente. `0` (ou absent) ne filtre rien.
   */
  montantTtc?: number | null;
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
  // Une pièce se retrouve par l'un ou l'autre de ses numéros : le client
  // présente le court, le code-barres rend le long.
  if (q) { conditions.push('(v.numero LIKE ? OR v.numero_court LIKE ? OR c.raison_sociale LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  // Les totaux sont arrondis au franc à l'enregistrement ; `ROUND` met à l'abri
  // d'un centime hérité d'un calcul flottant, qui ferait rater la ligne.
  if (filtres.montantTtc) { conditions.push('ROUND(v.total_ttc) = ?'); params.push(Math.round(filtres.montantTtc)); }
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
   *
   * Les **numéros courts** sont tirés ici et pas dans `preparerVente` : cette
   * fonction est aussi appelée à chaque frappe pour l'aperçu de l'encaissement,
   * et un compteur qui avancerait à chaque aperçu laisserait des trous de
   * plusieurs dizaines de numéros entre deux ventes. Le numéro long, lui, est
   * tiré au hasard : le jeter ne coûte rien.
   */
  enregistrer(ctx: ContexteVente, vente: VenteAEnregistrer): Promise<{ id: string; preparee: VentePreparee; numeroCourt: string; numeroLivraison: string | null; numeroCourtLivraison: string | null }> {
    const preparee = preparerVente(vente, { caisse: ctx.caisseCode, code: codePoste() });
    const numeroCourtVente = numeroCourt('VNT');
    return this.db.writeTransaction(async (tx) => {
      const id = this.nouvelId();
      const now = this.maintenant();
      const t = preparee.totaux;

      await tx.execute(
        `INSERT INTO ventes (id, numero, numero_court, date_vente, client_id, utilisateur_id, caisse_id, filiale_id, total_brut_ht, total_remise, total_net_ht,
                             total_tva, total_ttc, montant_percu, reste_a_payer, monnaie, mode_paiement, statut, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?, ?, ?)`,
        [
          id, preparee.numero, numeroCourtVente, now, vente.client?.id ?? null, ctx.utilisateurId, ctx.caisseId, ctx.filialeId,
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

      /*
       * Rien n'entre en caisse ici. L'argent reste au comptoir, entre les
       * mains du caissier, et il est **versé à la validation** de la vente
       * (voir `valider`). Le règlement du client, lui, est bien enregistré
       * tout de suite : il a payé, sa créance baisse le jour où il paie.
       */

      if (ctx.proformaId) {
        const p = await tx.getOptional<{ statut: string }>('SELECT statut FROM proformas WHERE id = ?', [ctx.proformaId]);
        if (p?.statut !== 'EN_COURS') throw new Error('Cette proforma a déjà été facturée ou annulée');
        await this.patch(tx, 'proformas', ctx.proformaId, { statut: 'FACTUREE', vente_id: id });
      }

      let numeroLivraison: string | null = null;
      let numeroCourtLivraison: string | null = null;
      if (vente.livraison) {
        numeroLivraison = numeroPiece('LIV');
        numeroCourtLivraison = numeroCourt('LIV');
        await tx.execute(
          `INSERT INTO livraisons (id, numero, numero_court, vente_id, client_id, adresse_livraison, chauffeur, vehicule, statut, date_livraison_prevue, filiale_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'A_PREPARER', ?, ?, ?, ?)`,
          [this.nouvelId(), numeroLivraison, numeroCourtLivraison, id, vente.client?.id ?? null, vente.livraison.adresse_livraison,
           vente.livraison.chauffeur || null, vente.livraison.vehicule || null, new Date(vente.livraison.date_livraison_prevue).toISOString(), ctx.filialeId, now, now],
        );
      }

      return { id, preparee, numeroCourt: numeroCourtVente, numeroLivraison, numeroCourtLivraison };
    });
  }

  /**
   * Correction d'une vente **en attente** : le ticket est refait à neuf, sans
   * changer de numéro ni de date.
   *
   * Tout est contre-passé puis ré-appliqué, dans une seule transaction : la
   * marchandise revient en stock et ressort, l'encaissement est repris puis
   * refait, le compte du client est défait puis refait. C'est plus long qu'une
   * mise à jour en place, mais c'est le seul chemin **juste** : les cumuls du
   * serveur (stock, caisse) ne se calculent qu'à partir des **insertions** dans
   * les journaux (voir `cumuls_serveur.sql`). Effacer un mouvement laisserait
   * le serveur sur l'ancien solde pour toujours ; un mouvement inverse, lui,
   * est compris des deux côtés. Le règlement du client fait exception : son
   * déclencheur sait défaire une suppression, et c'est ce qu'on lui demande.
   *
   * La trace reste : le journal de caisse montre l'encaissement, sa reprise et
   * le nouveau ; le journal du stock, la sortie, le retour et la nouvelle
   * sortie. Une correction se voit, elle ne s'efface pas.
   */
  modifier(ctx: ContexteModification, venteId: string, vente: VenteAEnregistrer): Promise<VentePreparee> {
    return this.db.writeTransaction(async (tx) => {
      const v = await tx.get<VenteRow>('SELECT * FROM ventes WHERE id = ?', [venteId]);
      if (!venteModifiable(v.statut as StatutVente)) {
        throw new Error('Seule une vente en attente se modifie. Une vente validée s’annule.');
      }
      const numero = v.numero ?? '';
      const now = this.maintenant();
      const ancienEncaisse = (v.montant_percu ?? 0) - (v.monnaie ?? 0);
      const motif = `Correction du ticket ${numero}`;

      /*
       * Le plafond de crédit se juge sur un client **débarrassé de cette
       * vente-là** : sans cela, l'ancienne créance se compterait en plus de la
       * nouvelle, et corriger un ticket à crédit deviendrait impossible dès
       * qu'il approche du plafond.
       */
      const memeClient = vente.client != null && vente.client.id === v.client_id;
      const client = memeClient
        ? { ...vente.client!, solde_actuel: (vente.client!.solde_actuel ?? 0) - (v.reste_a_payer ?? 0) }
        : vente.client;
      // Le ticket garde son numéro : celui que `preparerVente` tire au passage
      // est jeté. On lui rend tout de même le préfixe de la caisse d'origine,
      // pour qu'il ne fabrique rien d'incohérent en chemin.
      const preparee = {
        ...preparerVente({ ...vente, client }, { caisse: numero.split('-')[0] ?? '', code: codePoste() }),
        numero,
      };

      // 1. Contre-passation de l'ancien ticket.
      const anciennes = await tx.getAll<LigneVenteRow>(LIGNES_VENTE_QUERY, [venteId]);
      // Caisse et dépôt sont ceux de la vente, pas ceux du poste qui corrige :
      // on rend la marchandise là d'où elle est sortie, et l'argent à la caisse
      // qui l'a encaissé.
      const depotId = anciennes.find((l) => l.depot_id)?.depot_id ?? '';
      const caisseId = v.caisse_id ?? '';
      const interne: ContexteVente = { ...ctx, caisseId, caisseCode: '', depotId };
      for (const l of anciennes) {
        if (!l.article_id || !l.depot_id) continue;
        await this.stock.appliquerDansTransaction(
          tx, interne, l.depot_id, 'RETOUR_CLIENT',
          { article_id: l.article_id, quantite: l.quantite ?? 0, cout_unitaire: null },
          numero, motif,
        );
      }
      await tx.execute('DELETE FROM lignes_vente WHERE vente_id = ?', [venteId]);

      if (v.client_id) {
        // Le règlement s'efface : son déclencheur serveur reprend le cumul.
        await tx.execute('DELETE FROM reglements_clients WHERE vente_id = ?', [venteId]);
        await this.debiterClient(tx, v.client_id, -(v.total_ttc ?? 0), -ancienEncaisse);
      }
      /*
       * Aucune reprise en caisse : un ticket en attente n'y a rien versé, le
       * versement attend la validation. Avant ce changement il fallait sortir
       * l'ancien encaissement puis remettre le nouveau, et le journal portait
       * deux lignes pour une seule vente corrigée.
       */

      // 2. Le ticket corrigé, écrit comme s'il venait d'être encaissé.
      const t = preparee.totaux;
      for (const ligne of vente.lignes) {
        const l = calculerLigne(ligne);
        await tx.execute(
          `INSERT INTO lignes_vente (id, vente_id, filiale_id, article_id, code_article, designation, quantite, prix_unitaire_ht, prix_unitaire_ttc,
                                     remise_percent, tva_percent, total_ht, total_ttc, depot_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [this.nouvelId(), venteId, ctx.filialeId, l.article_id, l.code, l.designation, l.quantite, l.prix_unitaire_ht, l.prix_unitaire_ttc,
           l.remise_percent, l.tva_percent, l.total_ht, l.total_ttc, depotId, now],
        );
        await this.stock.appliquerDansTransaction(
          tx, interne, depotId, 'SORTIE_VENTE',
          { article_id: l.article_id, quantite: l.quantite, cout_unitaire: null },
          numero, motif, { autoriserNegatif: ctx.autoriserStockNegatif },
        );
      }

      if (vente.client) {
        await this.debiterClient(tx, vente.client.id, t.total_ttc, preparee.montant_encaisse);
        if (preparee.montant_encaisse > 0) {
          await tx.execute(
            `INSERT INTO reglements_clients (id, numero, client_id, vente_id, date_reglement, montant, type_reglement, reference, caisse_id, utilisateur_id, filiale_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [this.nouvelId(), numeroPiece('REG'), vente.client.id, venteId, now, preparee.montant_encaisse,
             preparee.mode_paiement === 'CREDIT' ? 'ESPECES' : preparee.mode_paiement, numero, caisseId || null, ctx.utilisateurId, ctx.filialeId, now],
          );
        }
      }
      await this.patch(tx, 'ventes', venteId, {
        client_id: vente.client?.id ?? null,
        total_brut_ht: t.total_brut_ht, total_remise: t.total_remise, total_net_ht: t.total_net_ht,
        total_tva: t.total_tva, total_ttc: t.total_ttc,
        montant_percu: preparee.montant_percu, reste_a_payer: preparee.reste_a_payer, monnaie: preparee.monnaie,
        mode_paiement: preparee.mode_paiement,
        notes: vente.notes || v.notes || null,
      });

      return preparee;
    });
  }

  /**
   * Validation de fin de journée : les ventes en attente passent en VALIDEE,
   * **et leur encaissement entre en caisse**.
   *
   * C'est ici que l'argent est versé, pas au comptoir : le caissier le garde
   * sous la main pendant la journée, et la caisse ne reçoit que ce qui a été
   * arrêté. Une ligne par ticket, portant son numéro — le journal reste
   * lisible ticket par ticket, et un ticket seul peut être rouvert.
   *
   * La ligne est datée du **jour de la validation**, pas de celui de la vente :
   * c'est le jour où l'argent entre. Un journal de caisse déjà imprimé ne se
   * voit donc pas complété après coup.
   */
  async valider(ctx: { utilisateurId: string | null }, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.db.writeTransaction(async (tx) => {
      let n = 0;
      for (const id of ids) {
        // rowsAffected n'est pas fiable avec les vues PowerSync : on vérifie l'état avant.
        const v = await tx.getOptional<VenteRow>('SELECT * FROM ventes WHERE id = ?', [id]);
        if (v?.statut !== 'EN_ATTENTE') continue;

        const aVerser = (v.montant_percu ?? 0) - (v.monnaie ?? 0);
        /*
         * Déjà en caisse ? On ne verse pas deux fois. Le cas existe pour les
         * ventes enregistrées **avant** ce changement : elles ont été versées
         * au comptoir et attendent encore leur validation. Le garde-fou reste
         * utile ensuite — il rend la validation rejouable sans dommage.
         */
        if (aVerser > 0 && (await this.versementNet(tx, v.numero)) <= 0) {
          await this.mouvementCaisse(tx, ctx, v, 'RECETTE', 'VENTE', aVerser, `Vente ${v.numero}`);
        }
        await tx.execute(`UPDATE ventes SET statut = 'VALIDEE', updated_at = ? WHERE id = ?`, [this.maintenant(), id]);
        n++;
      }
      return n;
    });
  }

  /**
   * Ce que la caisse détient aujourd'hui au titre d'une vente.
   *
   * Le journal est en ajout seul : un versement repris laisse ses deux lignes.
   * C'est donc leur **somme signée** qui dit si l'argent y est encore, et non
   * la présence d'une ligne. Les catégories d'avant ce changement sont
   * comptées aussi : une vente corrigée ou annulée à l'époque porte les
   * contre-passations de son temps.
   */
  private async versementNet(tx: Transaction, numero: string | null): Promise<number> {
    if (!numero) return 0;
    const r = await tx.getOptional<{ net: number | null }>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'RECETTE' THEN montant ELSE -montant END), 0) AS net
         FROM mouvements_tresorerie
        WHERE reference = ? AND categorie IN ('VENTE', 'CORRECTION_VENTE', 'ANNULATION_VENTE', ?)`,
      [numero, CATEGORIE_REOUVERTURE_VENTE],
    );
    return arrondirFcfa(r?.net ?? 0);
  }

  /**
   * Une ligne de journal de caisse au titre d'une vente, et la projection du
   * solde qui va avec.
   *
   * Le solde n'est écrit ici **qu'en projection**, pour que l'écran réagisse
   * tout de suite : c'est Postgres qui le tient, par delta sur chaque ligne du
   * journal portant une caisse (`cumuler_mouvement_tresorerie`, migration
   * `cumuls_serveur`). Tout mode de paiement verse donc, carte comprise — le
   * poste ne pourrait pas en décider autrement, le serveur renverrait son
   * calcul et effacerait la nuance.
   */
  private async mouvementCaisse(
    tx: Transaction,
    ctx: { utilisateurId: string | null },
    vente: Pick<VenteRow, 'numero' | 'caisse_id' | 'filiale_id'>,
    sens: 'RECETTE' | 'DEPENSE',
    categorie: string,
    montant: number,
    description: string,
  ): Promise<void> {
    const now = this.maintenant();
    await tx.execute(
      `INSERT INTO mouvements_tresorerie (id, type, categorie, montant, description, reference, caisse_id, utilisateur_id, filiale_id, date_operation, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.nouvelId(), sens, categorie, montant, description, vente.numero, vente.caisse_id, ctx.utilisateurId, vente.filiale_id, now, now],
    );
    if (!vente.caisse_id) return;
    const caisse = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [vente.caisse_id]);
    const delta = sens === 'RECETTE' ? montant : -montant;
    await this.patch(tx, 'caisses', vente.caisse_id, { solde_actuel: (caisse.solde_actuel ?? 0) + delta });
  }

  /**
   * Remet une vente validée « en attente », pour la rattraper après coup.
   *
   * Le versement **ressort de la caisse** : l'argent y était entré à la
   * validation, et un ticket en attente n'a rien en caisse — c'est ce qui
   * permet de le corriger ou de l'annuler sans rien contre-passer. La reprise
   * se lit au journal (catégorie « Réouverture de vente ») : une recette ne
   * doit pas quitter la caisse en silence.
   *
   * Ce qui ressort est le **net détenu** au titre de la vente, pas son
   * encaissement théorique : une vente validée avant que le versement passe à
   * la validation, ou corrigée du temps où la correction contre-passait la
   * caisse, n'y a pas forcément le montant qu'on croit.
   *
   * Le statut est vérifié **ici**, dans le dépôt, et pas seulement à l'écran :
   * une vente annulée ne doit revenir par aucun chemin.
   */
  async remettreEnAttente(ctx: { utilisateurId: string | null }, venteId: string): Promise<void> {
    return this.db.writeTransaction(async (tx) => {
      const v = await tx.get<VenteRow>('SELECT * FROM ventes WHERE id = ?', [venteId]);
      if (v.statut !== 'VALIDEE') {
        throw new Error(
          v.statut === 'ANNULEE'
            ? "Une vente annulée ne revient pas en attente : sa marchandise est rentrée et son encaissement contre-passé. Refaites le ticket."
            : 'Seule une vente validée se remet en attente.',
        );
      }
      const enCaisse = await this.versementNet(tx, v.numero);
      if (enCaisse > 0) {
        await this.mouvementCaisse(
          tx, ctx, v, 'DEPENSE', CATEGORIE_REOUVERTURE_VENTE, enCaisse,
          `Réouverture du ticket ${v.numero} : reprise du versement`,
        );
      }
      await this.patch(tx, 'ventes', venteId, { statut: 'EN_ATTENTE' });
    });
  }

  /**
   * Le code que le gérant donne pour autoriser une annulation.
   *
   * Vérifié sur le poste, contre l'empreinte descendue avec la fiche de la
   * filiale : une annulation reste possible un jour de coupure. Le calcul
   * prend quelques dixièmes de seconde — trois cent mille itérations, c'est
   * voulu —, d'où la vérification **avant** d'ouvrir la transaction.
   */
  private async verifierCodeAnnulation(filialeId: string, code: string): Promise<void> {
    const fiche = await this.db.getOptional<{ code_annulation: string | null }>(
      'SELECT code_annulation FROM parametres_filiale WHERE filiale_id = ?',
      [filialeId],
    );
    if (!codeAnnulationDefini(fiche?.code_annulation)) {
      throw new Error(
        "Aucun code d'annulation n'est défini pour cette filiale. Le gérant doit en choisir un dans Paramètres → Sécurité avant qu'une vente puisse être annulée.",
      );
    }
    if (!(await verifierEmpreinte(fiche!.code_annulation, normaliserCodeAnnulation(code)))) {
      throw new Error("Code d'annulation incorrect. Demandez-le au gérant de la filiale.");
    }
  }

  /**
   * Annulation d'une vente en attente : retour des articles en stock,
   * contre-passation de la créance et de l'encaissement, livraison annulée.
   *
   * Le geste le plus lourd du comptoir : il ne se fait pas seul. Le code du
   * gérant est exigé ici, dans le dépôt, et non seulement à l'écran — aucun
   * appelant ne doit pouvoir s'en passer.
   */
  async annuler(
    ctx: { filialeId: string; utilisateurId: string | null },
    venteId: string,
    motif: string,
    code: string,
  ): Promise<void> {
    await this.verifierCodeAnnulation(ctx.filialeId, code);
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

      /*
       * La caisse ne bouge pas : une vente en attente n'y a rien versé, le
       * versement attend la validation. Si la vente avait tout de même de
       * l'argent en caisse — validée puis rouverte, ou enregistrée avant ce
       * changement —, la reprise a déjà eu lieu à la réouverture.
       */
      const enCaisse = await this.versementNet(tx, v.numero);
      if (enCaisse > 0) {
        await this.mouvementCaisse(
          tx, ctx, v, 'DEPENSE', 'ANNULATION_VENTE', enCaisse,
          `Annulation vente ${v.numero} : ${motif}`,
        );
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
}
