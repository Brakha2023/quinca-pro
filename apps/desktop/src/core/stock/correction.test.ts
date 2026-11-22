import { describe, expect, it } from 'vitest';
import {
  coutBrutDepuisLigne, coutMoyenReste, motifNonCorrigeable, passeEnNegatif, type ImpactCorrection,
} from './correction';
import { repartirRemiseGlobale } from './remiseGlobale';

const impact = (over: Partial<ImpactCorrection> = {}): ImpactCorrection => ({
  article_id: 'a1', depot_id: 'd1', code: 'CIM-50', designation: 'Ciment 50 kg',
  quantite_retiree: 10, quantite_avant: 30, quantite_apres: 20, ...over,
});

describe('coutBrutDepuisLigne', () => {
  /*
   * L'aller-retour qui compte : une ligne saisie à 5 000, remisée, est
   * enregistrée à son coût **net**. En rouvrant le bon, le formulaire doit
   * retrouver 5 000 — sinon la remise globale, toujours là, serait retranchée
   * une seconde fois.
   */
  it('retrouve le coût saisi après la répartition de la remise', () => {
    const lignes = [
      { quantite: 10, cout_unitaire: 5000 as number | '' },
      { quantite: 4, cout_unitaire: 2500 as number | '' },
    ];
    for (const part of repartirRemiseGlobale(lignes, 6000)) {
      const brut = coutBrutDepuisLigne({
        quantite: part.ligne.quantite,
        cout_unitaire: part.cout_unitaire_net,
        remise_montant: part.remise,
      });
      expect(brut).toBe(part.ligne.cout_unitaire);
    }
  });

  it('rend le coût tel quel sans remise', () => {
    expect(coutBrutDepuisLigne({ quantite: 10, cout_unitaire: 4500, remise_montant: 0 })).toBe(4500);
  });

  // Une ligne sans coût ne doit rien : le formulaire la rouvre vide, et non à zéro.
  it('ne fabrique pas un coût là où il n’y en avait pas', () => {
    expect(coutBrutDepuisLigne({ quantite: 10, cout_unitaire: null, remise_montant: 0 })).toBe('');
  });

  it('tient debout sur une quantité nulle', () => {
    expect(coutBrutDepuisLigne({ quantite: 0, cout_unitaire: 4500, remise_montant: 0 })).toBe(4500);
  });
});

describe('ce que la correction annonce', () => {
  it('repère le stock qui passe sous zéro', () => {
    expect(passeEnNegatif([impact()])).toBe(false);
    expect(passeEnNegatif([impact(), impact({ quantite_avant: 4, quantite_apres: -6 })])).toBe(true);
  });

  /*
   * Le coût moyen ne remonte pas en arrière : seules les entrées valorisées le
   * déplacent. C'est sans effet quand l'article revient à zéro dans le dépôt —
   * la prochaine entrée repart de son propre coût. Il faut donc le dire dans
   * l'autre cas, et seulement dans celui-là.
   */
  it('n’annonce le coût moyen faussé que s’il reste du stock', () => {
    expect(coutMoyenReste([impact({ quantite_avant: 10, quantite_retiree: 10, quantite_apres: 0 })])).toBe(false);
    expect(coutMoyenReste([impact({ quantite_apres: 20 })])).toBe(true);
    // Sous zéro, il n'y a plus de coût moyen qui vaille : rien à annoncer.
    expect(coutMoyenReste([impact({ quantite_apres: -6 })])).toBe(false);
  });
});

describe('motifNonCorrigeable', () => {
  it('laisse passer un bon en vigueur et non réglé', () => {
    expect(motifNonCorrigeable({ netEnStock: 10, montantPaye: 0, numeroPiece: 'ENT-1' })).toBeNull();
  });

  // Deux fois annulé serait deux fois sorti du stock : le net dit que le bon
  // ne porte plus rien.
  it('refuse un bon déjà annulé', () => {
    expect(motifNonCorrigeable({ netEnStock: 0, montantPaye: 0, numeroPiece: null })).toMatch(/déjà été annulé/);
  });

  /*
   * Un règlement déjà passé resterait sans facture : la dette du fournisseur
   * deviendrait créditrice sans raison. Le message dit où aller le défaire.
   */
  it('refuse quand la pièce du fournisseur a été réglée, et dit où aller', () => {
    const motif = motifNonCorrigeable({ netEnStock: 10, montantPaye: 50000, numeroPiece: 'BL-42' });
    expect(motif).toMatch(/BL-42/);
    expect(motif).toMatch(/Règlements/);
  });

  // L'ordre compte : un bon déjà annulé l'est, qu'il ait été réglé ou non.
  it('annonce l’annulation avant le règlement', () => {
    expect(motifNonCorrigeable({ netEnStock: 0, montantPaye: 50000, numeroPiece: 'BL-42' })).toMatch(/déjà été annulé/);
  });
});
