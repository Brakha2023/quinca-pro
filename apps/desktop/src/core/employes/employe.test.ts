import { describe, expect, it } from 'vitest';
import { calculerPaie, employeFormSchema } from './employe';

describe('calculerPaie', () => {
  it('retient 1/26 du salaire par jour d’absence non justifiée, les justifiées ne comptent pas', () => {
    const p = calculerPaie({ type_contrat: 'CDI', salaire_base: 260000, jours_presents: 22, jours_absents: 2, jours_justifies: 2, primes: 10000, retenues: 5000, avances: 50000 });
    expect(p.retenue_absences).toBe(20000);
    expect(p.brut).toBe(240000);
    expect(p.net_a_payer).toBe(195000); // 240 000 + 10 000 − 5 000 − 50 000
  });

  it('paie un journalier au nombre de jours présents', () => {
    const p = calculerPaie({ type_contrat: 'JOURNALIER', salaire_base: 5000, jours_presents: 18, jours_absents: 4, jours_justifies: 0, primes: 0, retenues: 0, avances: 20000 });
    expect(p.retenue_absences).toBe(0);
    expect(p.brut).toBe(90000);
    expect(p.net_a_payer).toBe(70000);
  });

  it('ne produit jamais un net négatif', () => {
    expect(calculerPaie({ type_contrat: 'CDD', salaire_base: 100000, jours_presents: 26, jours_absents: 0, jours_justifies: 0, primes: 0, retenues: 0, avances: 150000 }).net_a_payer).toBe(0);
  });
});

describe('employeFormSchema', () => {
  it('exige un nom, met le matricule en majuscules et plafonne les pièces jointes', () => {
    expect(employeFormSchema.safeParse({ nom: '' }).success).toBe(false);
    const e = employeFormSchema.parse({ nom: 'Koné', matricule: 'emp-001', type_contrat: 'CDD', salaire_base: '150000' });
    expect(e.matricule).toBe('EMP-001');
    expect(e.salaire_base).toBe(150000);
    expect(employeFormSchema.safeParse({ nom: 'X', contrat_fichier: 'x'.repeat(1024 * 1024 * 2) }).success).toBe(false);
  });
});
