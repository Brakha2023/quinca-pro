import { describe, expect, it } from 'vitest';
import {
  depenseFromRow, depenseModifiable, depenseRefusable, depenseRouvrable, depenseSchema, refusSchema,
} from './depense';
import { recapJournalDepenses, type LigneJournalDepense } from './journal';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'd1', numero: 'DEP-20261115-AB12CD', filiale_id: 'f1', caisse_id: 'c1', categorie: 'LOYER',
  montant: 120000, beneficiaire: 'Bailleur', description: 'Loyer de novembre', reference: 'FACT-88',
  date_depense: '2026-11-15T09:00:00.000Z', statut: 'EN_ATTENTE', motif_refus: null,
  utilisateur_id: 'u1', valide_par: null, date_validation: null, notes: null,
  created_at: '2026-11-15T09:00:00.000Z', updated_at: '2026-11-15T09:00:00.000Z', ...over,
} as never);

describe('statuts d’une dépense', () => {
  it('ne laisse corriger et refuser que ce qui attend', () => {
    expect(depenseModifiable('EN_ATTENTE')).toBe(true);
    expect(depenseModifiable('VALIDEE')).toBe(false);
    expect(depenseModifiable('REFUSEE')).toBe(false);
    expect(depenseRefusable('EN_ATTENTE')).toBe(true);
    expect(depenseRefusable('VALIDEE')).toBe(false);
  });

  it('ne rouvre que ce qui est payé', () => {
    expect(depenseRouvrable('VALIDEE')).toBe(true);
    expect(depenseRouvrable('EN_ATTENTE')).toBe(false);
    expect(depenseRouvrable(null)).toBe(false);
  });

  /*
   * Une dépense refusée n'a rien sorti de la caisse : il n'y a rien à
   * reprendre. Qui change d'avis engage la dépense de nouveau.
   */
  it('ne rouvre jamais une dépense refusée', () => {
    expect(depenseRouvrable('REFUSEE')).toBe(false);
  });

  // Les portes ne s'ouvrent jamais ensemble : corriger ou rouvrir, selon l'état.
  it('s’excluent deux à deux', () => {
    for (const statut of ['EN_ATTENTE', 'VALIDEE', 'REFUSEE'] as const) {
      expect(depenseModifiable(statut) && depenseRouvrable(statut)).toBe(false);
    }
  });
});

describe('depenseFromRow', () => {
  it('relit la ligne telle que la base la rend', () => {
    expect(depenseFromRow(row())).toMatchObject({
      numero: 'DEP-20261115-AB12CD', montant: 120000, beneficiaire: 'Bailleur',
      categorie: 'LOYER', statut: 'EN_ATTENTE', reference: 'FACT-88',
    });
  });

  // Un champ vide vaut « rien à dire » : l'écran ne doit pas montrer une chaîne
  // vide là où il attend un nom.
  it('ramène le vide à rien', () => {
    const d = depenseFromRow(row({ beneficiaire: '  ', description: '', reference: null, montant: null }));
    expect(d).toMatchObject({ beneficiaire: null, description: null, reference: null, montant: 0 });
  });

  it('tient un statut absent pour une attente', () => {
    expect(depenseFromRow(row({ statut: null })).statut).toBe('EN_ATTENTE');
  });
});

describe('saisie d’une dépense', () => {
  const valide = {
    caisse_id: 'c1', categorie: 'LOYER', montant: 1000, beneficiaire: 'Bailleur',
    description: '', reference: '', date_depense: '2026-11-15',
  };

  it('accepte une saisie complète', () => {
    expect(depenseSchema.safeParse(valide).success).toBe(true);
  });

  // Une sortie d'argent sans destinataire nommé n'est pas justifiable : c'est
  // la première question de celui qui doit l'approuver.
  it('exige un bénéficiaire', () => {
    expect(depenseSchema.safeParse({ ...valide, beneficiaire: '   ' }).success).toBe(false);
  });

  it('refuse un montant nul ou négatif', () => {
    expect(depenseSchema.safeParse({ ...valide, montant: 0 }).success).toBe(false);
    expect(depenseSchema.safeParse({ ...valide, montant: -500 }).success).toBe(false);
  });

  it('exige un motif de refus qui dise quelque chose', () => {
    expect(refusSchema.safeParse({ motif: 'ok' }).success).toBe(false);
    expect(refusSchema.safeParse({ motif: 'Hors budget du mois' }).success).toBe(true);
  });
});

describe('recapJournalDepenses', () => {
  const d = (over: Partial<LigneJournalDepense> = {}): LigneJournalDepense => ({
    montant: 10000, statut: 'VALIDEE', categorie: 'TRANSPORT', ...over,
  });

  /*
   * Les deux chiffres qu'il ne faut pas confondre : ce qui est **sorti** de la
   * caisse, et ce qui est engagé sans être payé — encore en caisse, mais déjà
   * promis.
   */
  it('sépare ce qui est sorti de ce qui attend', () => {
    const r = recapJournalDepenses([
      d({ montant: 10000, statut: 'VALIDEE' }),
      d({ montant: 5000, statut: 'EN_ATTENTE' }),
      d({ montant: 3000, statut: 'EN_ATTENTE' }),
      d({ montant: 90000, statut: 'REFUSEE' }),
    ]);
    expect(r.sorti).toBe(10000);
    expect(r.a_approuver).toBe(8000);
    expect(r.en_attente).toBe(2);
    expect(r.refusees).toBe(1);
    // La refusée ne compte pas dans le nombre : elle n'a rien coûté.
    expect(r.nombre).toBe(3);
  });

  it('ventile les dépenses payées par catégorie, la plus grosse en tête', () => {
    const r = recapJournalDepenses([
      d({ categorie: 'TRANSPORT', montant: 2000 }),
      d({ categorie: 'LOYER', montant: 120000 }),
      d({ categorie: 'TRANSPORT', montant: 3000 }),
      // Celle-ci attend : elle n'est pas encore une dépense de la maison.
      d({ categorie: 'REPAS', montant: 50000, statut: 'EN_ATTENTE' }),
    ]);
    expect(r.par_categorie).toEqual([
      { categorie: 'LOYER', montant: 120000 },
      { categorie: 'TRANSPORT', montant: 5000 },
    ]);
  });

  it('tient debout sur un journal vide', () => {
    expect(recapJournalDepenses([])).toMatchObject({ nombre: 0, sorti: 0, a_approuver: 0, par_categorie: [] });
  });
});
