import { describe, expect, it } from 'vitest';
import { nomFeuilleValide, nomFichierExport } from './exporterExcel';

describe('nomFeuilleValide', () => {
  it('retire les caractères refusés par Excel', () => {
    expect(nomFeuilleValide('Bon 12/10 [brouillon]')).toBe('Bon 12 10  brouillon');
  });

  it('tronque à 31 caractères', () => {
    expect(nomFeuilleValide('x'.repeat(40))).toHaveLength(31);
  });

  it('retombe sur un nom par défaut si tout est retiré', () => {
    expect(nomFeuilleValide('///')).toBe('Feuille');
  });
});

describe('nomFichierExport', () => {
  it('horodate et nettoie le nom', () => {
    expect(nomFichierExport('Bon de commande BC-42', new Date('2026-10-15T09:00:00Z'))).toBe('Bon-de-commande-BC-42-2026-10-15.xlsx');
  });

  it('accepte un nom vide', () => {
    expect(nomFichierExport('', new Date('2026-10-15T09:00:00Z'))).toBe('export-2026-10-15.xlsx');
  });
});
