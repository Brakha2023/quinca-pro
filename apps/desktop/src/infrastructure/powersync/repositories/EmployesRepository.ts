import type { Transaction } from '@powersync/web';
import type { CaisseRow, EmployeRow, PaieRow, PointageRow, StatutPointage } from '@quinca/shared-types';
import { TYPES_EN_CAISSE } from '../../../core/clients';
import { genererCodeTiers, genererNumeroPiece } from '../../../core/commun/numerotation';
import { calculerPaie, employeFromRow, nomComplet, type AvanceSalaireForm, type EmployeForm, type PaiementPaieForm, type PointageForm } from '../../../core/employes';
import { BaseRepository } from './BaseRepository';

export interface FiltresEmployes {
  recherche?: string;
  inclureInactifs?: boolean;
}

export function employesQuery(filialeId: string | null, filtres: FiltresEmployes = {}) {
  const conditions = ['filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (!filtres.inclureInactifs) conditions.push('est_actif = 1');
  const q = filtres.recherche?.trim();
  if (q) { conditions.push('(matricule LIKE ? OR nom LIKE ? OR prenom LIKE ? OR fonction LIKE ? OR telephone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  // Les pièces jointes ne sont pas chargées dans les listes (colonnes lourdes).
  return {
    sql: `SELECT id, matricule, nom, prenom, sexe, telephone, fonction, date_debut, date_fin, type_contrat, salaire_base, est_actif, notes, filiale_id, created_at, updated_at,
                 CASE WHEN photo IS NULL THEN NULL ELSE photo END AS photo, contrat_nom, NULL AS contrat_fichier
          FROM employes WHERE ${conditions.join(' AND ')} ORDER BY nom, prenom`,
    params,
  };
}

export const EMPLOYE_QUERY = 'SELECT * FROM employes WHERE id = ?';
export const POINTAGES_JOUR_QUERY = 'SELECT * FROM pointages WHERE filiale_id = ? AND date_pointage = ?';
/** Pointages d'un mois (AAAA-MM). */
export const POINTAGES_MOIS_QUERY = "SELECT * FROM pointages WHERE filiale_id = ? AND substr(date_pointage, 1, 7) = ? ORDER BY date_pointage";
export const PAIES_PERIODE_QUERY = `
  SELECT p.*, e.matricule, e.nom, e.prenom, e.fonction, e.type_contrat, c.nom AS caisse_nom
  FROM paies p JOIN employes e ON e.id = p.employe_id LEFT JOIN caisses c ON c.id = p.caisse_id
  WHERE p.filiale_id = ? AND p.periode = ? ORDER BY e.nom, e.prenom`;
export const AVANCES_PERIODE_QUERY = `
  SELECT a.*, e.matricule, e.nom, e.prenom, c.nom AS caisse_nom
  FROM avances_salaire a JOIN employes e ON e.id = a.employe_id LEFT JOIN caisses c ON c.id = a.caisse_id
  WHERE a.filiale_id = ? AND a.periode = ? ORDER BY a.date_avance DESC`;
export const PERIODES_PAIE_QUERY = 'SELECT DISTINCT periode FROM paies WHERE filiale_id = ? ORDER BY periode DESC';

export interface ContexteEmploye {
  filialeId: string;
  utilisateurId: string | null;
}

export class EmployesRepository extends BaseRepository {
  async create(filialeId: string, form: EmployeForm): Promise<string> {
    const id = this.nouvelId();
    const now = this.maintenant();
    await this.db.execute(
      `INSERT INTO employes (id, matricule, nom, prenom, sexe, telephone, fonction, date_debut, date_fin, type_contrat, salaire_base, est_actif, photo, contrat_nom, contrat_fichier, notes, filiale_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, form.matricule || genererCodeTiers('EMP'), form.nom, form.prenom || null, form.sexe || null, form.telephone || null, form.fonction || null, form.date_debut || null, form.date_fin || null,
       form.type_contrat, form.salaire_base, form.est_actif ? 1 : 0, form.photo, form.contrat_nom, form.contrat_fichier, form.notes || null, filialeId, now, now],
    );
    return id;
  }

  async update(id: string, form: EmployeForm): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const row = await tx.get<EmployeRow>(EMPLOYE_QUERY, [id]);
      await this.patch(tx, 'employes', id, {
        matricule: form.matricule || row.matricule, nom: form.nom, prenom: form.prenom || null, sexe: form.sexe || null, telephone: form.telephone || null, fonction: form.fonction || null,
        date_debut: form.date_debut || null, date_fin: form.date_fin || null, type_contrat: form.type_contrat, salaire_base: form.salaire_base, est_actif: form.est_actif ? 1 : 0,
        photo: form.photo, contrat_nom: form.contrat_nom, contrat_fichier: form.contrat_fichier, notes: form.notes || null,
      });
    });
  }

  async setActif(id: string, actif: boolean): Promise<void> {
    await this.patch(this.db, 'employes', id, { est_actif: actif ? 1 : 0, date_fin: actif ? null : new Date().toISOString().slice(0, 10) });
  }

  async matriculeExiste(filialeId: string, matricule: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db.getAll<{ id: string }>('SELECT id FROM employes WHERE filiale_id = ? AND matricule = ? AND id != ? LIMIT 1', [filialeId, matricule, excludeId ?? '']);
    return rows.length > 0;
  }

  /** Pointage d'un employé pour un jour : créé ou remplacé (un seul pointage par jour). */
  async pointer(ctx: ContexteEmploye, form: PointageForm): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const existant = await tx.getOptional<PointageRow>('SELECT id FROM pointages WHERE employe_id = ? AND date_pointage = ?', [form.employe_id, form.date_pointage]);
      const now = this.maintenant();
      if (existant) {
        await this.patch(tx, 'pointages', existant.id, { statut: form.statut, commentaire: form.commentaire || null, utilisateur_id: ctx.utilisateurId });
      } else {
        await tx.execute(
          `INSERT INTO pointages (id, employe_id, filiale_id, date_pointage, statut, commentaire, utilisateur_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [this.nouvelId(), form.employe_id, ctx.filialeId, form.date_pointage, form.statut, form.commentaire || null, ctx.utilisateurId, now, now],
        );
      }
    });
  }

  /** Pointe tous les employés donnés au même statut pour un jour (ex. « tous présents »). */
  async pointerTous(ctx: ContexteEmploye, employeIds: string[], date: string, statut: StatutPointage): Promise<void> {
    for (const employe_id of employeIds) await this.pointer(ctx, { employe_id, date_pointage: date, statut, commentaire: '' });
  }

  /** Avance sur salaire : pièce + dépense en caisse ; retenue sur la paie de la période. */
  enregistrerAvance(ctx: ContexteEmploye, form: AvanceSalaireForm): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const numero = genererNumeroPiece('AVS');
      const now = this.maintenant();
      const e = await tx.get<EmployeRow>(EMPLOYE_QUERY, [form.employe_id]);
      await tx.execute(
        `INSERT INTO avances_salaire (id, numero, employe_id, filiale_id, periode, date_avance, montant, caisse_id, utilisateur_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.nouvelId(), numero, form.employe_id, ctx.filialeId, form.periode, now, form.montant, form.caisse_id, ctx.utilisateurId, form.notes || null, now],
      );
      await this.depenserEnCaisse(tx, ctx, form.caisse_id, 'AVANCE_SALAIRE', form.montant, `Avance sur salaire ${nomComplet(employeFromRow(e))} (${form.periode})`, numero, true);
      // Une paie déjà calculée pour la période est recalculée avec la nouvelle avance.
      const paie = await tx.getOptional<PaieRow>("SELECT * FROM paies WHERE employe_id = ? AND periode = ? AND statut = 'CALCULEE'", [form.employe_id, form.periode]);
      if (paie) await this.recalculer(tx, paie, { avances: (paie.avances ?? 0) + form.montant });
      return numero;
    });
  }

  /**
   * Génère (ou met à jour si non payée) la paie de chaque employé actif pour
   * une période, à partir des pointages du mois et des avances versées.
   */
  genererPaies(ctx: ContexteEmploye, periode: string): Promise<{ creees: number; misesAJour: number }> {
    return this.db.writeTransaction(async (tx) => {
      const employes = (await tx.getAll<EmployeRow>('SELECT * FROM employes WHERE filiale_id = ? AND est_actif = 1', [ctx.filialeId])).map(employeFromRow);
      const pointages = await tx.getAll<PointageRow>(POINTAGES_MOIS_QUERY, [ctx.filialeId, periode]);
      const avances = await tx.getAll<{ employe_id: string; total: number }>('SELECT employe_id, SUM(montant) AS total FROM avances_salaire WHERE filiale_id = ? AND periode = ? GROUP BY employe_id', [ctx.filialeId, periode]);
      const now = this.maintenant();
      let creees = 0;
      let misesAJour = 0;
      for (const e of employes) {
        const mes = pointages.filter((p) => p.employe_id === e.id);
        const compte = (s: StatutPointage) => mes.filter((p) => p.statut === s).length;
        const existante = await tx.getOptional<PaieRow>('SELECT * FROM paies WHERE employe_id = ? AND periode = ?', [e.id, periode]);
        if (existante?.statut === 'PAYEE') continue;
        const base = {
          type_contrat: e.type_contrat, salaire_base: e.salaire_base, jours_presents: compte('PRESENT'), jours_absents: compte('ABSENT'), jours_justifies: compte('JUSTIFIE'),
          primes: existante?.primes ?? 0, retenues: existante?.retenues ?? 0, avances: avances.find((a) => a.employe_id === e.id)?.total ?? 0,
        };
        const calc = calculerPaie(base);
        if (existante) {
          await this.patch(tx, 'paies', existante.id, { salaire_base: base.salaire_base, jours_presents: base.jours_presents, jours_absents: base.jours_absents, jours_justifies: base.jours_justifies, avances: base.avances, ...calc });
          misesAJour++;
        } else {
          await tx.execute(
            `INSERT INTO paies (id, employe_id, filiale_id, periode, salaire_base, jours_presents, jours_absents, jours_justifies, retenue_absences, primes, retenues, avances, brut, net_a_payer, statut, utilisateur_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CALCULEE', ?, ?, ?)`,
            [this.nouvelId(), e.id, ctx.filialeId, periode, base.salaire_base, base.jours_presents, base.jours_absents, base.jours_justifies, calc.retenue_absences, base.primes, base.retenues, base.avances, calc.brut, calc.net_a_payer, ctx.utilisateurId, now, now],
          );
          creees++;
        }
      }
      return { creees, misesAJour };
    });
  }

  /** Primes / retenues saisies à la main sur une paie non payée : le net est recalculé. */
  async ajusterPaie(id: string, valeurs: { primes: number; retenues: number; notes: string }): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const paie = await tx.get<PaieRow>('SELECT * FROM paies WHERE id = ?', [id]);
      if (paie.statut === 'PAYEE') throw new Error('Cette paie est déjà payée');
      await this.recalculer(tx, paie, { primes: valeurs.primes, retenues: valeurs.retenues, notes: valeurs.notes || null });
    });
  }

  /** Paiement d'une paie : dépense en caisse (catégorie SALAIRE), statut PAYEE. */
  payer(ctx: ContexteEmploye, paieId: string, form: PaiementPaieForm): Promise<void> {
    return this.db.writeTransaction(async (tx) => {
      const paie = await tx.get<PaieRow>('SELECT * FROM paies WHERE id = ?', [paieId]);
      if (paie.statut === 'PAYEE') throw new Error('Cette paie est déjà payée');
      const e = await tx.get<EmployeRow>(EMPLOYE_QUERY, [paie.employe_id ?? '']);
      const now = this.maintenant();
      if ((paie.net_a_payer ?? 0) > 0) {
        await this.depenserEnCaisse(tx, ctx, form.caisse_id, 'SALAIRE', paie.net_a_payer ?? 0, `Salaire ${nomComplet(employeFromRow(e))} — ${paie.periode}`, form.reference || `PAIE-${paie.periode}`, TYPES_EN_CAISSE.has(form.mode_paiement));
      }
      await this.patch(tx, 'paies', paieId, { statut: 'PAYEE', date_paiement: now, caisse_id: form.caisse_id, mode_paiement: form.mode_paiement, reference: form.reference || null });
    });
  }

  /** Paiement groupé de toutes les paies à payer d'une période (une transaction par paie). */
  async payerTout(ctx: ContexteEmploye, periode: string, form: PaiementPaieForm): Promise<number> {
    const paies = await this.db.getAll<{ id: string }>("SELECT id FROM paies WHERE filiale_id = ? AND periode = ? AND statut = 'CALCULEE'", [ctx.filialeId, periode]);
    for (const p of paies) await this.payer(ctx, p.id, form);
    return paies.length;
  }

  private async recalculer(tx: Transaction, paie: PaieRow, patch: Partial<{ primes: number; retenues: number; avances: number; notes: string | null }>): Promise<void> {
    const e = employeFromRow(await tx.get<EmployeRow>(EMPLOYE_QUERY, [paie.employe_id ?? '']));
    const base = {
      type_contrat: e.type_contrat, salaire_base: paie.salaire_base ?? 0, jours_presents: paie.jours_presents ?? 0, jours_absents: paie.jours_absents ?? 0, jours_justifies: paie.jours_justifies ?? 0,
      primes: patch.primes ?? paie.primes ?? 0, retenues: patch.retenues ?? paie.retenues ?? 0, avances: patch.avances ?? paie.avances ?? 0,
    };
    const calc = calculerPaie(base);
    await this.patch(tx, 'paies', paie.id, { primes: base.primes, retenues: base.retenues, avances: base.avances, ...calc, ...(patch.notes !== undefined ? { notes: patch.notes } : {}) });
  }

  private async depenserEnCaisse(tx: Transaction, ctx: ContexteEmploye, caisseId: string, categorie: string, montant: number, description: string, reference: string, enCaisse: boolean): Promise<void> {
    const now = this.maintenant();
    await tx.execute(
      `INSERT INTO mouvements_tresorerie (id, type, categorie, montant, description, reference, caisse_id, utilisateur_id, filiale_id, date_operation, created_at)
       VALUES (?, 'DEPENSE', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.nouvelId(), categorie, montant, description, reference, caisseId, ctx.utilisateurId, ctx.filialeId, now, now],
    );
    if (enCaisse) {
      const caisse = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [caisseId]);
      await this.patch(tx, 'caisses', caisseId, { solde_actuel: (caisse.solde_actuel ?? 0) - montant });
    }
  }
}
