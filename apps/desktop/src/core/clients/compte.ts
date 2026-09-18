import { arrondirMontant } from '../commun/prix';
import { JOURS_PERIODE_REGLEMENT, type Client } from './client';
import { LIBELLES_TYPE_REGLEMENT, type ReglementClient } from './reglement';

/** Facture (vente) telle que vue par le compte client. */
export interface FactureClient {
  id: string;
  numero: string;
  date_vente: string;
  total_ttc: number;
  reste_a_payer: number;
  statut: string;
}

/** Ligne du relevé de compte client : facture = débit (le client doit), règlement = crédit. */
export interface LigneReleveClient {
  date: string;
  piece: string;
  designation: string;
  facture: number;
  reglement: number;
  /** Avoir (acompte) disponible après l'opération : partie négative du solde. */
  disponibilite: number;
  solde: number;
}

/**
 * Relevé chronologique : solde d'ouverture, puis chaque facture (non annulée)
 * et chaque règlement, avec solde cumulé. Le solde final est la créance du
 * compte (négatif = avoir).
 */
export function construireReleveClient(
  client: Pick<Client, 'solde_initial' | 'date_effet_solde'>,
  factures: Array<Pick<FactureClient, 'numero' | 'date_vente' | 'total_ttc' | 'statut'>>,
  reglements: Array<Pick<ReglementClient, 'numero' | 'date_reglement' | 'montant' | 'type_reglement' | 'vente_id'>>,
): LigneReleveClient[] {
  const evenements = [
    ...factures.filter((f) => f.statut !== 'ANNULEE').map((f) => ({ date: f.date_vente, piece: f.numero, designation: 'Facture', facture: f.total_ttc, reglement: 0 })),
    ...reglements.map((r) => ({ date: r.date_reglement, piece: r.numero, designation: `${r.vente_id ? 'Bon payé' : 'Avance payée'} (${LIBELLES_TYPE_REGLEMENT[r.type_reglement]})`, facture: 0, reglement: r.montant })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let solde = client.solde_initial;
  const releve: LigneReleveClient[] = [{ date: client.date_effet_solde ?? '', piece: '', designation: 'Solde initial', facture: 0, reglement: 0, disponibilite: Math.max(-solde, 0), solde }];
  for (const e of evenements) {
    solde = arrondirMontant(solde + e.facture - e.reglement);
    releve.push({ ...e, disponibilite: Math.max(-solde, 0), solde });
  }
  return releve;
}

export interface VersementLettre {
  reglement_id: string;
  /** Bon payé = règlement affecté à une vente ; avance payée = acompte libre. */
  nature: 'BON_PAYE' | 'AVANCE_PAYEE';
  apport: number;
  utilise: number;
  disponibilite: number;
}

/**
 * Lettrage des versements d'un client : un « bon payé » est entièrement
 * utilisé par sa vente ; une « avance payée » est consommée, dans l'ordre
 * chronologique (FIFO), par la part à crédit des ventes postérieures qui n'a
 * pas été réglée directement. Ce qui reste est la disponibilité de l'avance.
 */
export function lettrerVersements(
  reglements: Array<Pick<ReglementClient, 'id' | 'date_reglement' | 'montant' | 'vente_id'>>,
  factures: Array<Pick<FactureClient, 'id' | 'date_vente' | 'total_ttc' | 'statut'>>,
): VersementLettre[] {
  const regleDirectement = new Map<string, number>();
  for (const r of reglements) if (r.vente_id) regleDirectement.set(r.vente_id, (regleDirectement.get(r.vente_id) ?? 0) + r.montant);

  type Evt = { date: string; type: 'AVANCE'; r: (typeof reglements)[number] } | { date: string; type: 'FACTURE'; aCouvrir: number };
  const evenements: Evt[] = [
    ...reglements.filter((r) => !r.vente_id).map((r) => ({ date: r.date_reglement, type: 'AVANCE' as const, r })),
    ...factures.filter((f) => f.statut !== 'ANNULEE').map((f) => ({ date: f.date_vente, type: 'FACTURE' as const, aCouvrir: Math.max(f.total_ttc - (regleDirectement.get(f.id) ?? 0), 0) })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const avances: VersementLettre[] = [];
  for (const e of evenements) {
    if (e.type === 'AVANCE') { avances.push({ reglement_id: e.r.id, nature: 'AVANCE_PAYEE', apport: e.r.montant, utilise: 0, disponibilite: e.r.montant }); continue; }
    let reste = e.aCouvrir;
    for (const a of avances) {
      if (reste <= 0) break;
      const pris = Math.min(a.disponibilite, reste);
      a.utilise = arrondirMontant(a.utilise + pris);
      a.disponibilite = arrondirMontant(a.disponibilite - pris);
      reste -= pris;
    }
  }
  const bons: VersementLettre[] = reglements.filter((r) => r.vente_id).map((r) => ({ reglement_id: r.id, nature: 'BON_PAYE', apport: r.montant, utilise: r.montant, disponibilite: 0 }));
  return [...avances, ...bons];
}

export const LIBELLES_NATURE_VERSEMENT: Record<VersementLettre['nature'], string> = { BON_PAYE: 'Bon payé', AVANCE_PAYEE: 'Avance payée' };

/** Date limite de paiement d'une facture selon la période de règlement du client. */
export function echeanceFacture(dateVente: string, periode: Client['periode_reglement']): Date {
  const d = new Date(dateVente);
  d.setDate(d.getDate() + (periode ? JOURS_PERIODE_REGLEMENT[periode] : 0));
  return d;
}

export interface ContexteRelanceClient {
  filiale: { nom: string; telephone?: string | null };
  client: Pick<Client, 'raison_sociale' | 'civilite' | 'contact' | 'solde_actuel' | 'periode_reglement'>;
  facturesImpayees: Array<Pick<FactureClient, 'numero' | 'date_vente' | 'reste_a_payer'>>;
  signataire: string;
  aujourdhui?: Date;
}

/** Objet et corps d'un e-mail de relance client : factures impayées (avec retard) et solde dû. */
export function composerRelanceClient(ctx: ContexteRelanceClient, formaterMontant: (n: number) => string, formaterDate: (iso: string | null) => string): { objet: string; corps: string } {
  const auj = ctx.aujourdhui ?? new Date();
  const civ = [ctx.client.civilite, ctx.client.contact ?? ctx.client.raison_sociale].filter(Boolean).join(' ');
  const lignes: string[] = [`Bonjour ${civ},`, ''];
  if (ctx.facturesImpayees.length > 0) {
    lignes.push('Sauf erreur de notre part, les factures suivantes restent impayées :');
    for (const f of ctx.facturesImpayees) {
      const retard = Math.floor((auj.getTime() - echeanceFacture(f.date_vente, ctx.client.periode_reglement).getTime()) / 86_400_000);
      lignes.push(`  - ${f.numero} du ${formaterDate(f.date_vente)} — reste dû ${formaterMontant(f.reste_a_payer)}${retard > 0 ? ` (échue depuis ${retard} jour${retard > 1 ? 's' : ''})` : ''}`);
    }
    lignes.push('');
  }
  lignes.push(`Le solde de votre compte s'élève à ${formaterMontant(Math.max(ctx.client.solde_actuel, 0))}. Nous vous remercions de bien vouloir le régulariser dans les meilleurs délais.`);
  lignes.push('', 'Restant à votre disposition,', ctx.signataire, ctx.filiale.nom + (ctx.filiale.telephone ? ` · ${ctx.filiale.telephone}` : ''));
  return { objet: `Relance — solde de votre compte chez ${ctx.filiale.nom} : ${formaterMontant(Math.max(ctx.client.solde_actuel, 0))}`, corps: lignes.join('\n') };
}
