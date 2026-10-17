import { describe, expect, it } from 'vitest';
import { CODE39_START_STOP, MOTIFS_CODE39, code39, normaliserCode39 } from './codeBarres';

const motifs = Object.entries(MOTIFS_CODE39);

describe('table Code 39', () => {
  it.each(motifs)('%s tient en neuf éléments', (_caractere, motif) => {
    expect(motif).toHaveLength(9);
  });

  // Invariant du symbole : deux barres larges (positions paires) et un espace
  // large (positions impaires). Une coquille dans la table le casse.
  it.each(motifs)('%s a deux barres larges et un espace large', (_caractere, motif) => {
    const elements = [...motif];
    expect(elements.filter((e, i) => i % 2 === 0 && e === 'w')).toHaveLength(2);
    expect(elements.filter((e, i) => i % 2 === 1 && e === 'w')).toHaveLength(1);
  });

  it('ne contient aucun doublon : chaque motif désigne un seul caractère', () => {
    const vus = new Set(motifs.map(([, motif]) => motif));
    expect(vus.size).toBe(motifs.length);
  });

  it('couvre les chiffres, les lettres et le tiret de nos numéros de pièce', () => {
    for (const c of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-') expect(MOTIFS_CODE39[c]).toBeDefined();
  });
});

describe('normaliserCode39', () => {
  it('met en capitales et remplace ce qui n’est pas codable', () => {
    expect(normaliserCode39('reg_cl#2026')).toBe('REG-CL-2026');
  });

  it('tronque au-delà de 30 caractères (lisibilité de la douchette)', () => {
    expect(normaliserCode39('A'.repeat(40))).toHaveLength(30);
    expect(normaliserCode39('C01-K7Q-20260922-M3Q2PT')).toBe('C01-K7Q-20260922-M3Q2PT');
  });
});

describe('code39', () => {
  it('encadre le message par le caractère start/stop', () => {
    const { barres } = code39('A');
    // 3 caractères (start, A, stop) × 5 barres.
    expect(barres).toHaveLength(15);
    expect(MOTIFS_CODE39[CODE39_START_STOP]).toBeDefined();
  });

  it('sépare les caractères d’un espace étroit', () => {
    // Un caractère vaut 6 éléments étroits + 3 larges = 12 unités.
    // Un caractère seul : start + sép + A + sép + stop = 3×12 + 2 = 38 unités.
    const { largeur } = code39('A');
    expect(largeur).toBe(38);
  });

  it('ne laisse aucune barre se chevaucher', () => {
    const { barres } = code39('REG-CL-202610081');
    for (const [i, barre] of barres.entries()) {
      if (i === 0) continue;
      const precedente = barres[i - 1]!;
      expect(barre.x).toBeGreaterThanOrEqual(precedente.x + precedente.largeur);
    }
  });

  it('code le texte normalisé, pas le texte brut', () => {
    expect(code39('reg cl#1').texte).toBe('REG CL-1');
  });
});
