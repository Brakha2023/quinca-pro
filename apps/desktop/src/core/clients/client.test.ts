import { describe, expect, it } from 'vitest';
import { calculerSolde, clientFormSchema, disponibiliteCredit, peutVendreACredit, statutCredit } from './client';

describe('client', () => {
  it('calcule le solde depuis les cumuls', () => {
    expect(calculerSolde({ solde_initial: 1000, cumul_factures: 5000, cumul_reglements: 4500 })).toBe(1500);
    expect(calculerSolde({ solde_initial: 0, cumul_factures: 0, cumul_reglements: 300 })).toBe(-300);
  });

  it('classe le statut de crédit', () => {
    expect(statutCredit({ plafond_credit: 1000, solde_actuel: 0 })).toBe('A_JOUR');
    expect(statutCredit({ plafond_credit: 1000, solde_actuel: -50 })).toBe('AVOIR');
    expect(statutCredit({ plafond_credit: 1000, solde_actuel: 800 })).toBe('EN_COURS');
    expect(statutCredit({ plafond_credit: 1000, solde_actuel: 1200 })).toBe('DEPASSE');
  });

  it('calcule la disponibilité et autorise le crédit dans le plafond', () => {
    expect(disponibiliteCredit({ plafond_credit: 1000, solde_actuel: 600 })).toBe(400);
    expect(disponibiliteCredit({ plafond_credit: 1000, solde_actuel: 1500 })).toBe(0);
    expect(peutVendreACredit({ plafond_credit: 1000, solde_actuel: 600 }, 400)).toBe(true);
    expect(peutVendreACredit({ plafond_credit: 1000, solde_actuel: 600 }, 401)).toBe(false);
    expect(peutVendreACredit({ plafond_credit: 0, solde_actuel: 0 }, 1)).toBe(false);
  });

  it('valide le formulaire', () => {
    expect(clientFormSchema.safeParse({ raison_sociale: '' }).success).toBe(false);
    expect(clientFormSchema.safeParse({ raison_sociale: 'X', email: 'pas-un-email' }).success).toBe(false);
    const ok = clientFormSchema.parse({ raison_sociale: ' Sarl Koné ', code: 'ab1', plafond_credit: '5000' });
    expect(ok).toMatchObject({ raison_sociale: 'Sarl Koné', code: 'AB1', plafond_credit: 5000, email: '' });
  });
});
