import { describe, expect, it } from 'vitest';
import { debutDesMois, moisGlissants, moisSansReglement, serieActiviteTiers } from './activiteTiers';

describe('moisGlissants', () => {
  it('rend les douze derniers mois, du plus ancien au plus récent', () => {
    const mois = moisGlissants('2026-11-22', 12);
    expect(mois).toHaveLength(12);
    expect(mois[0]).toBe('2025-12');
    expect(mois.at(-1)).toBe('2026-11');
  });

  // Le passage d'année se fait par UTC, pas à la main sur le numéro de mois.
  it('franchit le changement d’année', () => {
    expect(moisGlissants('2026-02-03', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('borne la requête au premier jour du plus ancien mois', () => {
    expect(debutDesMois(moisGlissants('2026-11-22', 3))).toBe('2026-09-01');
  });
});

describe('serieActiviteTiers', () => {
  const mois = ['2026-09', '2026-10', '2026-11'];

  it('pose le facturé et le réglé de chaque mois, et leur écart', () => {
    const s = serieActiviteTiers([
      { cle: '2026-09', facture: 500000, regle: 500000 },
      { cle: '2026-11', facture: 300000, regle: 0 },
    ], mois);
    expect(s.points.map((p) => [p.cle, p.facture, p.regle, p.ecart])).toEqual([
      ['2026-09', 500000, 500000, 0],
      ['2026-10', 0, 0, 0],
      ['2026-11', 300000, 0, 300000],
    ]);
  });

  /*
   * Les mois muets comptent : un trou de six mois dans les règlements est
   * exactement ce qu'on vient chercher. La série part donc des mois attendus,
   * pas des lignes que la base a rendues.
   */
  it('garde les mois sans mouvement', () => {
    expect(serieActiviteTiers([], mois).points).toHaveLength(3);
    expect(serieActiviteTiers([], mois).vide).toBe(true);
  });

  it('totalise, et dit ce que la période a ajouté au solde', () => {
    const s = serieActiviteTiers([
      { cle: '2026-09', facture: 800000, regle: 200000 },
      { cle: '2026-10', facture: 0, regle: 100000 },
    ], mois);
    expect(s.total_facture).toBe(800000);
    expect(s.total_regle).toBe(300000);
    expect(s.variation).toBe(500000);
  });

  // L'axe se règle sur la plus haute des deux séries, jamais sur leur somme :
  // les barres sont côte à côte, elles ne s'empilent pas.
  it('prend pour échelle la plus haute des deux séries', () => {
    expect(serieActiviteTiers([{ cle: '2026-09', facture: 100, regle: 900 }], mois).maximum).toBe(900);
    expect(serieActiviteTiers([], mois).maximum).toBe(1);
  });
});

describe('moisSansReglement', () => {
  const mois = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];

  it('compte les mois depuis le dernier versement', () => {
    const s = serieActiviteTiers([{ cle: '2026-08', facture: 0, regle: 50000 }], mois);
    expect(moisSansReglement(s)).toBe(3);
  });

  it('se tait quand il a réglé ce mois-ci', () => {
    const s = serieActiviteTiers([{ cle: '2026-11', facture: 0, regle: 50000 }], mois);
    expect(moisSansReglement(s)).toBeNull();
  });

  /*
   * Période entièrement muette : on ne sait pas depuis quand il n'a rien
   * réglé — peut-être depuis deux ans, peut-être qu'il n'a jamais rien dû.
   * On ne l'invente pas.
   */
  it('se tait aussi quand la période ne dit rien', () => {
    expect(moisSansReglement(serieActiviteTiers([], mois))).toBeNull();
  });
});
