import { describe, expect, it } from 'vitest';
import {
  NATURES_DOCUMENTS, champsManquants, enteteDocument, entrepriseFormSchema, entrepriseFromRow,
  initiales, lirePrefixes, lireReglagesDocuments, normaliserPrefixe, prefixesParDefaut,
  reglagesDocumentsParDefaut,
} from './entreprise';

const ligne = (over: Record<string, unknown> = {}) => ({
  id: 'p1', filiale_id: 'f1', nom_commercial: 'Quincaillerie Cissé et Frère',
  raison_sociale: 'QCF SASU', forme_juridique: 'SASU', rccm: 'CI-ABJ-03-2023-B-12345',
  numero_cc: '2301234 F', compte_contribuable: '0123456K',
  telephone_principal: '27 32 79 50 90', telephone_secondaire: null, email: 'contact@qcf.ci',
  adresse: 'Sis à Adjamé Liberté', ville: 'Abidjan', pays: "Côte d'Ivoire", localisation: null,
  logo_couleur: null, logo_noir_blanc: null, logo_entete: null, logo_filigrane: null,
  assujetti_tva: 1, taux_tva: 18, prix_saisis: 'TTC', devise: 'XOF',
  mentions_legales: 'Merci pour votre confiance.', formats_documents: null,
  prefixes_numerotation: null, created_at: null, updated_at: '2026-10-25T10:00:00Z',
  ...over,
}) as never;

describe('lecture de la fiche', () => {
  it('relit une ligne et donne des valeurs utilisables', () => {
    const e = entrepriseFromRow(ligne());
    expect(e.nom_commercial).toBe('Quincaillerie Cissé et Frère');
    expect(e.assujetti_tva).toBe(true);
    expect(e.taux_tva).toBe(18);
    expect(e.prix_saisis).toBe('TTC');
  });

  it('retombe sur des défauts tenables quand la ligne est vide', () => {
    const e = entrepriseFromRow(ligne({ pays: null, devise: null, taux_tva: null, assujetti_tva: null, prix_saisis: null }));
    expect(e.pays).toBe("Côte d'Ivoire");
    expect(e.devise).toBe('XOF');
    expect(e.taux_tva).toBe(18);
    expect(e.assujetti_tva).toBe(true);
    expect(e.prix_saisis).toBe('TTC');
  });

  it('un mode de prix inconnu ne devient jamais autre chose que TTC ou HT', () => {
    expect(entrepriseFromRow(ligne({ prix_saisis: 'NET' })).prix_saisis).toBe('TTC');
    expect(entrepriseFromRow(ligne({ prix_saisis: 'HT' })).prix_saisis).toBe('HT');
  });
});

describe('réglages des pièces imprimées', () => {
  it('livre une entrée par nature de pièce', () => {
    const r = reglagesDocumentsParDefaut();
    expect(Object.keys(r)).toHaveLength(NATURES_DOCUMENTS.length);
    expect(r.recu_vente?.format).toBe('TICKET');
    expect(r.facture?.format).toBe('A4');
  });

  it('un ticket part en noir et blanc : la thermique ne connaît pas la couleur', () => {
    expect(reglagesDocumentsParDefaut().recu_vente?.noir_blanc).toBe(true);
    expect(reglagesDocumentsParDefaut().facture?.noir_blanc).toBe(false);
  });

  it('un JSON illisible ne doit pas empêcher d’imprimer', () => {
    expect(lireReglagesDocuments('{ ceci n’est pas du JSON')).toEqual(reglagesDocumentsParDefaut());
    expect(lireReglagesDocuments(null)).toEqual(reglagesDocumentsParDefaut());
    expect(lireReglagesDocuments('[1,2,3]')).toEqual(reglagesDocumentsParDefaut());
  });

  it('un format que la pièce n’accepte pas est corrigé, pas recopié', () => {
    // Le journal ne sort qu'en A4 : un ticket enregistré par erreur est ignoré.
    const r = lireReglagesDocuments(JSON.stringify({ journal: { format: 'TICKET' } }));
    expect(r.journal?.format).toBe('A4');
  });

  it('une nature inconnue est ignorée, une nature absente retombe sur son défaut', () => {
    const r = lireReglagesDocuments(JSON.stringify({ facture: { format: 'A5' }, bordereau_de_lune: { format: 'A4' } }));
    expect(r.facture?.format).toBe('A5');
    expect(r.bordereau_de_lune).toBeUndefined();
    expect(r.bon_commande?.format).toBe('A4');
  });
});

describe('préfixes de numérotation', () => {
  it('un préfixe entre dans un numéro : ni tiret, ni espace, ni accent', () => {
    expect(normaliserPrefixe('fa-ct')).toBe('FACT');
    expect(normaliserPrefixe('Bon C')).toBe('BONC');
    expect(normaliserPrefixe('Reçu')).toBe('RECU');
  });

  it('se borne à cinq caractères : le numéro doit rester dictable', () => {
    expect(normaliserPrefixe('FACTURATION')).toBe('FACTU');
  });

  it('un préfixe vide retombe sur celui qui est livré', () => {
    const p = lirePrefixes(JSON.stringify({ facture: '   ', bon_commande: 'CMD' }));
    expect(p.facture).toBe('FAC');
    expect(p.bon_commande).toBe('CMD');
    expect(p).toEqual({ ...prefixesParDefaut(), bon_commande: 'CMD' });
  });
});

describe('en-tête des documents', () => {
  const e = entrepriseFromRow(ligne({ logo_entete: 'data:image/png;base64,AAA', logo_noir_blanc: 'data:image/png;base64,NB', logo_filigrane: 'data:image/png;base64,FG' }));

  it('compose la ligne des identifiants fiscaux', () => {
    expect(enteteDocument(e, null).identifiants)
      .toBe('RCCM CI-ABJ-03-2023-B-12345 · CC 2301234 F · CPTE 0123456K');
  });

  it('n’invente pas de séparateurs quand il n’y a qu’un identifiant', () => {
    const seul = entrepriseFromRow(ligne({ numero_cc: null, compte_contribuable: null }));
    expect(enteteDocument(seul, null).identifiants).toBe('RCCM CI-ABJ-03-2023-B-12345');
  });

  it('en noir et blanc, prend le logo noir et blanc', () => {
    const r = { format: 'A4' as const, noir_blanc: true, logo_entete: true, logo_filigrane: false };
    expect(enteteDocument(e, null, r).logo).toBe('data:image/png;base64,NB');
  });

  it('sans logo en en-tête, n’en met aucun', () => {
    const r = { format: 'A4' as const, noir_blanc: false, logo_entete: false, logo_filigrane: false };
    expect(enteteDocument(e, null, r).logo).toBeNull();
  });

  it('le filigrane ne sort que s’il est demandé', () => {
    const sans = { format: 'A4' as const, noir_blanc: false, logo_entete: true, logo_filigrane: false };
    const avec = { ...sans, logo_filigrane: true };
    expect(enteteDocument(e, null, sans).filigrane).toBeNull();
    expect(enteteDocument(e, null, avec).filigrane).toBe('data:image/png;base64,FG');
  });

  it('sans fiche, le document s’imprime quand même avec ce que porte la filiale', () => {
    const entete = enteteDocument(null, { nom: 'Filiale Abidjan', adresse: 'Adjamé', telephone: '27 32' });
    expect(entete.nom).toBe('Filiale Abidjan');
    expect(entete.adresse).toBe('Adjamé');
    expect(entete.identifiants).toBe('');
    expect(entete.initiales).toBe('FA');
  });
});

describe('initiales, faute de logo', () => {
  it('prend la première lettre des mots qui comptent', () => {
    expect(initiales('Quincaillerie Cissé et Frère')).toBe('QCF');
    expect(initiales('QUINCAILLERIE CISSE ET FRERE')).toBe('QCF');
    expect(initiales('Filiale Abidjan')).toBe('FA');
  });
  it('ne compte pas les mots de liaison', () => {
    // Sans cette règle, « ET » fournissait la troisième initiale : QCE.
    expect(initiales('Maison du Fer')).toBe('MF');
    expect(initiales('Comptoir de la Côte')).toBe('CC');
  });

  it('ne rend jamais une chaîne vide', () => {
    expect(initiales('')).toBe('?');
  });
});

describe('validation de la saisie', () => {
  const valide = {
    nom_commercial: 'QCF', telephone_principal: '27 32 79 50 90', adresse: 'Adjamé',
    ville: 'Abidjan', pays: "Côte d'Ivoire", assujetti_tva: true, taux_tva: 18,
    prix_saisis: 'TTC' as const, devise: 'XOF',
  };

  it('accepte une fiche minimale', () => {
    expect(entrepriseFormSchema.parse(valide).nom_commercial).toBe('QCF');
  });

  it('refuse un taux de TVA hors bornes', () => {
    expect(entrepriseFormSchema.safeParse({ ...valide, taux_tva: 150 }).success).toBe(false);
    expect(entrepriseFormSchema.safeParse({ ...valide, taux_tva: -1 }).success).toBe(false);
  });

  it('refuse une adresse e-mail mal formée, mais accepte l’absence', () => {
    expect(entrepriseFormSchema.safeParse({ ...valide, email: 'pas-une-adresse' }).success).toBe(false);
    expect(entrepriseFormSchema.safeParse({ ...valide, email: '' }).success).toBe(true);
  });

  it('exige ce qui figure sur chaque facture', () => {
    expect(entrepriseFormSchema.safeParse({ ...valide, adresse: '' }).success).toBe(false);
    expect(entrepriseFormSchema.safeParse({ ...valide, telephone_principal: '' }).success).toBe(false);
  });
});

describe('ce qui manque encore à la fiche', () => {
  it('nomme les champs vides, sans se plaindre de ceux qui sont remplis', () => {
    const manquants = champsManquants(entrepriseFromRow(ligne({ rccm: null, logo_entete: null })));
    expect(manquants).toContain('le RCCM');
    expect(manquants).toContain('un logo');
    expect(manquants).not.toContain("l'adresse");
  });

  it('ne dit rien quand la fiche est complète', () => {
    const pleine = entrepriseFromRow(ligne({ logo_entete: 'data:image/png;base64,AAA' }));
    expect(champsManquants(pleine)).toEqual([]);
  });
});
