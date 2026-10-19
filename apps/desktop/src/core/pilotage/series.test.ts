import { describe, expect, it } from 'vitest';
import { fenetrePilotage } from './periodes';
import { classement, serieCaMarge } from './series';

const JOUR = new Date('2026-10-15T10:00:00Z');
const SEMAINE = fenetrePilotage('SEMAINE', JOUR);

describe('serieCaMarge', () => {
  it('comble les jours sans vente : une barre à zéro, pas un trou', () => {
    const s = serieCaMarge([{ cle: '2026-10-15', ca_ht: 500_000, cout: 300_000, ventes: 4 }], SEMAINE);
    expect(s.points).toHaveLength(7);
    expect(s.points[0]).toMatchObject({ cle: '2026-10-09', ca_ht: 0, marge: 0, ventes: 0 });
    expect(s.points.at(-1)).toMatchObject({ ca_ht: 500_000, marge: 200_000 });
  });

  it('donne la marge barre par barre', () => {
    const s = serieCaMarge([
      { cle: '2026-10-14', ca_ht: 200_000, cout: 150_000, ventes: 2 },
      { cle: '2026-10-15', ca_ht: 500_000, cout: 300_000, ventes: 4 },
    ], SEMAINE);
    expect(s.total_ca).toBe(700_000);
    expect(s.total_marge).toBe(250_000);
    expect(s.total_ventes).toBe(6);
  });

  it('tient une journée vendue à perte', () => {
    const s = serieCaMarge([{ cle: '2026-10-15', ca_ht: 100_000, cout: 180_000, ventes: 1 }], SEMAINE);
    expect(s.points.at(-1)!.marge).toBe(-80_000);
  });

  it('ne fait la moyenne que sur les jours où il s’est passé quelque chose', () => {
    // 700 000 sur deux jours d'activité, et non sur les sept jours de la fenêtre.
    const s = serieCaMarge([
      { cle: '2026-10-14', ca_ht: 200_000, cout: 0, ventes: 1 },
      { cle: '2026-10-15', ca_ht: 500_000, cout: 0, ventes: 1 },
    ], SEMAINE);
    expect(s.moyenne).toBe(350_000);
  });

  it('ne rend jamais une échelle nulle : tout déborderait', () => {
    expect(serieCaMarge([], SEMAINE).maximum).toBe(1);
    expect(serieCaMarge([], SEMAINE).moyenne).toBe(0);
  });

  it('ignore une clé hors de la fenêtre', () => {
    const s = serieCaMarge([{ cle: '2020-01-01', ca_ht: 999, cout: 0, ventes: 1 }], SEMAINE);
    expect(s.total_ca).toBe(0);
  });

  it('agrège par mois sur douze mois', () => {
    const annee = fenetrePilotage('ANNEE', JOUR);
    const s = serieCaMarge([{ cle: '2026-10', ca_ht: 800_000, cout: 500_000, ventes: 12 }], annee);
    expect(s.points).toHaveLength(12);
    expect(s.points.at(-1)).toMatchObject({ cle: '2026-10', marge: 300_000 });
  });
});

describe('classement', () => {
  const lignes = Array.from({ length: 9 }, (_, i) => ({ cle: `c${i}`, libelle: `Poste ${i}`, valeur: (9 - i) * 1000 }));

  it('range du plus grand au plus petit', () => {
    const c = classement(lignes, 6);
    expect(c.lignes[0]!.libelle).toBe('Poste 0');
    expect(c.maximum).toBe(9000);
  });

  it('replie la queue dans « Autres » plutôt que d’inventer des couleurs', () => {
    const c = classement(lignes, 6);
    expect(c.lignes).toHaveLength(7);
    const autres = c.lignes.at(-1)!;
    expect(autres.libelle).toBe('Autres');
    // Postes 6, 7 et 8 : 3000 + 2000 + 1000.
    expect(autres.valeur).toBe(6000);
    expect(autres.detail).toBe('3 poste(s)');
  });

  it('ne replie rien quand tout tient', () => {
    const c = classement(lignes.slice(0, 4), 6);
    expect(c.lignes).toHaveLength(4);
    expect(c.lignes.some((l) => l.libelle === 'Autres')).toBe(false);
  });

  it('calcule des parts qui font cent, « Autres » compris', () => {
    const c = classement(lignes, 6);
    expect(Math.round(c.lignes.reduce((t, l) => t + l.part, 0))).toBe(100);
  });

  it('ne divise pas par zéro sur un classement vide', () => {
    const c = classement([], 6);
    expect(c.lignes).toHaveLength(0);
    expect(c.total).toBe(0);
    expect(c.maximum).toBe(1);
  });
});
