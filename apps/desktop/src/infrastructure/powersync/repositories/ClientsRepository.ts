import type { Transaction } from '@powersync/web';
import type { CaisseRow, ClientRow } from '@quinca/shared-types';
import {
  calculerSolde, motifNonSupprimableClient, TYPES_EN_CAISSE, usagesClient,
  type Client, type ClientForm, type ReglementForm, type UsagesClient,
} from '../../../core/clients';
import { genererCodeTiers } from '../../../core/commun/numerotation';
import { numeroPiece } from '../../desktop/identitePoste';
import { usagesClientServeur } from '../../supabase/usagesTiers';
import { BaseRepository } from './BaseRepository';

export interface FiltresClients {
  recherche?: string;
  inclureInactifs?: boolean;
  /** Ne garder que les clients avec une créance > 0. */
  avecCreance?: boolean;
  groupe?: string | null;
  /** Ne garder que les clients avec une adresse e-mail (relances). */
  avecEmail?: boolean;
}

export function clientsQuery(filialeId: string | null, filtres: FiltresClients = {}) {
  const conditions = ['filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (!filtres.inclureInactifs) conditions.push('est_actif = 1');
  if (filtres.avecCreance) conditions.push('solde_actuel > 0');
  if (filtres.avecEmail) conditions.push("email IS NOT NULL AND email != ''");
  if (filtres.groupe) { conditions.push('groupe = ?'); params.push(filtres.groupe); }
  const q = filtres.recherche?.trim();
  if (q) {
    conditions.push('(code LIKE ? OR numero_compte LIKE ? OR raison_sociale LIKE ? OR mobile LIKE ? OR telephone LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  return { sql: `SELECT * FROM clients WHERE ${conditions.join(' AND ')} ORDER BY raison_sociale`, params };
}

export const GROUPES_CLIENTS_QUERY = "SELECT DISTINCT groupe FROM clients WHERE filiale_id = ? AND groupe IS NOT NULL AND groupe != '' ORDER BY groupe";

/** Factures (ventes) d'un client, les plus récentes d'abord. */
export const FACTURES_CLIENT_QUERY = 'SELECT id, numero, date_vente, total_ttc, reste_a_payer, statut, mode_paiement FROM ventes WHERE client_id = ? ORDER BY date_vente DESC';

export interface FiltresVersements {
  clientId?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  limite?: number;
}

/** Versements (règlements) de la filiale, tous clients, avec la vente réglée le cas échéant. */
export function versementsQuery(filialeId: string | null, filtres: FiltresVersements = {}) {
  const conditions = ['r.filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (filtres.clientId) { conditions.push('r.client_id = ?'); params.push(filtres.clientId); }
  if (filtres.dateDebut) { conditions.push('r.date_reglement >= ?'); params.push(new Date(`${filtres.dateDebut}T00:00:00`).toISOString()); }
  if (filtres.dateFin) { conditions.push('r.date_reglement <= ?'); params.push(new Date(`${filtres.dateFin}T23:59:59.999`).toISOString()); }
  params.push(filtres.limite ?? 500);
  return {
    sql: `SELECT r.*, c.raison_sociale AS client_nom, c.code AS client_code, v.numero AS vente_numero, ca.nom AS caisse_nom,
                 u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom
          FROM reglements_clients r
          JOIN clients c ON c.id = r.client_id
          LEFT JOIN ventes v ON v.id = r.vente_id
          LEFT JOIN caisses ca ON ca.id = r.caisse_id
          LEFT JOIN utilisateurs u ON u.id = r.utilisateur_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY r.date_reglement DESC LIMIT ?`,
    params,
  };
}

export const REGLEMENTS_CLIENT_QUERY = `
  SELECT r.*, c.nom AS caisse_nom, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom
  FROM reglements_clients r
  LEFT JOIN caisses c ON c.id = r.caisse_id
  LEFT JOIN utilisateurs u ON u.id = r.utilisateur_id
  WHERE r.client_id = ?
  ORDER BY r.date_reglement DESC`;

export const CAISSES_ACTIVES_QUERY = 'SELECT * FROM caisses WHERE filiale_id = ? AND est_active = 1 ORDER BY nom';

export interface ContexteReglement {
  filialeId: string;
  utilisateurId: string | null;
}

/**
 * Tout ce qui nomme le client, compté d'un coup dans la base du poste. Les
 * brouillons portent le client en colonne, comme les autres pièces.
 */
export const USAGES_CLIENT_QUERY = `
  SELECT (SELECT COUNT(*) FROM ventes             WHERE client_id = ?) AS ventes,
         (SELECT COUNT(*) FROM reglements_clients WHERE client_id = ?) AS reglements,
         (SELECT COUNT(*) FROM proformas          WHERE client_id = ?) AS devis,
         (SELECT COUNT(*) FROM livraisons         WHERE client_id = ?) AS livraisons,
         (SELECT COUNT(*) FROM ventes_brouillons  WHERE client_id = ?) AS brouillons`;

/** Ce qu'il faut connaître d'un client pour décider de son effacement. */
export type ClientASupprimer = Pick<Client, 'id' | 'code' | 'raison_sociale' | 'solde_initial' | 'cumul_factures' | 'cumul_reglements'>;

export class ClientsRepository extends BaseRepository {
  async create(filialeId: string, form: ClientForm): Promise<string> {
    const id = this.nouvelId();
    const now = this.maintenant();
    const code = form.code || genererCodeTiers('CLI');
    await this.db.execute(
      `INSERT INTO clients (id, code, raison_sociale, mobile, email, adresse, contact, solde_initial, cumul_factures, cumul_reglements,
                            solde_actuel, plafond_credit, filiale_id, est_actif, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 1, ?, ?)`,
      [
        id, code, form.raison_sociale, form.mobile || null, form.email || null, form.adresse || null, form.contact || null,
        form.solde_initial, form.solde_initial, form.plafond_credit, filialeId, now, now,
      ],
    );
    await this.patch(this.db, 'clients', id, this.colonnesComplementaires(form));
    return id;
  }

  /** Modifie la fiche ; le solde est recalculé si le solde d'ouverture change. */
  async update(id: string, form: ClientForm): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const row = await tx.get<ClientRow>('SELECT * FROM clients WHERE id = ?', [id]);
      const solde = calculerSolde({
        solde_initial: form.solde_initial,
        cumul_factures: row.cumul_factures ?? 0,
        cumul_reglements: row.cumul_reglements ?? 0,
      });
      await this.patch(tx, 'clients', id, {
        code: form.code || row.code,
        raison_sociale: form.raison_sociale,
        mobile: form.mobile || null,
        email: form.email || null,
        adresse: form.adresse || null,
        contact: form.contact || null,
        solde_initial: form.solde_initial,
        solde_actuel: solde,
        plafond_credit: form.plafond_credit,
        ...this.colonnesComplementaires(form),
      });
    });
  }

  private colonnesComplementaires(form: ClientForm) {
    return {
      groupe: form.groupe || null, civilite: form.civilite || null, numero_compte: form.numero_compte || null, telephone: form.telephone || null,
      pays: form.pays || null, ville: form.ville || null, numero_rc: form.numero_rc || null, numero_cc: form.numero_cc || null,
      date_effet_solde: form.date_effet_solde || null, remise_percent: form.remise_percent, prise_min_jour: form.prise_min_jour, prise_max_jour: form.prise_max_jour,
      periode_reglement: form.periode_reglement || null, notes: form.notes || null,
    };
  }

  /**
   * Un client qui a servi ne se supprime pas : il se désactive. Il quitte les
   * écrans de saisie, son compte et son histoire restent lisibles.
   */
  async setActif(id: string, actif: boolean): Promise<void> {
    await this.patch(this.db, 'clients', id, { est_actif: actif ? 1 : 0 });
  }

  /** Ce qui rattache le client à l'activité, vu depuis la base du poste. */
  async usages(id: string): Promise<UsagesClient> {
    const row = await this.db.get<Partial<UsagesClient>>(USAGES_CLIENT_QUERY, Array<string>(5).fill(id));
    return usagesClient(row);
  }

  /**
   * Pourquoi ce client ne peut pas être supprimé — ou `null` s'il peut l'être.
   *
   * Deux regards, dans cet ordre, comme pour un article : le poste répond sans
   * réseau et sans attendre, mais il ne garde que douze mois d'activité ; son
   * silence ne prouve rien. Le serveur, lui, a tout l'historique, et c'est lui
   * qui refuserait l'effacement. Hors ligne, on ne supprime pas : on le dit, et
   * « Désactiver » reste là.
   */
  async motifDeRefus(client: ClientASupprimer): Promise<string | null> {
    const surLePoste = motifNonSupprimableClient(client, await this.usages(client.id));
    if (surLePoste) return surLePoste;

    const auServeur = await usagesClientServeur(client.id);
    if (!auServeur) {
      return `Sans réseau, le poste ne peut pas garantir que « ${client.code} » n'a jamais servi : il n'en garde que douze mois. Reconnectez-vous pour le supprimer, ou désactivez la fiche dès maintenant.`;
    }
    return motifNonSupprimableClient(client, auServeur);
  }

  /**
   * Efface définitivement une fiche client jamais utilisée (doublon, faute de
   * frappe, client de passage saisi pour rien). La garde est refaite ici :
   * aucun appelant ne doit pouvoir effacer un compte qui a une histoire.
   */
  async supprimer(client: ClientASupprimer): Promise<void> {
    const motif = motifNonSupprimableClient(client, await this.usages(client.id));
    if (motif) throw new Error(motif);
    await this.db.execute('DELETE FROM clients WHERE id = ?', [client.id]);
  }

  async codeExiste(filialeId: string, code: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db.getAll<{ id: string }>(
      'SELECT id FROM clients WHERE filiale_id = ? AND code = ? AND id != ? LIMIT 1',
      [filialeId, code, excludeId ?? ''],
    );
    return rows.length > 0;
  }

  /**
   * Encaisse un règlement (créance ou acompte) : pièce de règlement, cumuls du
   * client, et recette en caisse si le mode de paiement passe par la caisse.
   * Tout ou rien.
   */
  enregistrerReglement(ctx: ContexteReglement, clientId: string, form: ReglementForm, venteId: string | null = null): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const client = await tx.get<ClientRow>('SELECT * FROM clients WHERE id = ?', [clientId]);
      const numero = numeroPiece('REG');
      const now = this.maintenant();
      const date = form.date_reglement ? new Date(form.date_reglement).toISOString() : now;

      await tx.execute(
        `INSERT INTO reglements_clients (id, numero, client_id, vente_id, date_reglement, montant, type_reglement, reference, caisse_id, utilisateur_id, filiale_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.nouvelId(), numero, clientId, venteId, date, form.montant, form.type_reglement, form.reference || null, form.caisse_id, ctx.utilisateurId, ctx.filialeId, now],
      );

      const cumulReglements = (client.cumul_reglements ?? 0) + form.montant;
      await this.patch(tx, 'clients', clientId, {
        cumul_reglements: cumulReglements,
        solde_actuel: calculerSolde({
          solde_initial: client.solde_initial ?? 0,
          cumul_factures: client.cumul_factures ?? 0,
          cumul_reglements: cumulReglements,
        }),
      });

      await this.encaisser(tx, ctx, form, numero, `Règlement client ${client.raison_sociale ?? ''}`.trim());
      return numero;
    });
  }

  private async encaisser(tx: Transaction, ctx: ContexteReglement, form: ReglementForm, numero: string, description: string): Promise<void> {
    const now = this.maintenant();
    await tx.execute(
      `INSERT INTO mouvements_tresorerie (id, type, categorie, montant, description, reference, caisse_id, utilisateur_id, filiale_id, date_operation, created_at)
       VALUES (?, 'RECETTE', 'REGLEMENT_CLIENT', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.nouvelId(), form.montant, description, numero, form.caisse_id, ctx.utilisateurId, ctx.filialeId, now, now],
    );
    if (TYPES_EN_CAISSE.has(form.type_reglement)) {
      const caisse = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [form.caisse_id]);
      await this.patch(tx, 'caisses', form.caisse_id, { solde_actuel: (caisse.solde_actuel ?? 0) + form.montant });
    }
  }
}
