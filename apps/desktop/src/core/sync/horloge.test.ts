import { describe, expect, it } from 'vitest';
import {
  ALLER_RETOUR_MAX_MS,
  SEUIL_AVERTISSEMENT_MS,
  SEUIL_BLOCAGE_MS,
  avertissementHorloge,
  formaterEcart,
  heureServeurDuJeton,
  mesurerEcart,
  niveauDerive,
  sensDerive,
} from './horloge';

const tServeur = Date.parse('2026-10-17T09:00:00.000Z');
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jeton = (iat: number) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', iat })}.signature`;

describe('heureServeurDuJeton', () => {
  it('lit l’heure que le serveur a signée', () => {
    expect(heureServeurDuJeton(jeton(tServeur / 1000))).toBe(tServeur);
  });

  it('ne devine rien d’un jeton absent ou abîmé', () => {
    for (const mauvais of [null, undefined, '', 'pas.un.jwt', 'a.b', `${b64({})}.${b64({ sub: 'u1' })}.s`]) {
      expect(heureServeurDuJeton(mauvais)).toBeNull();
    }
  });
});

describe('mesurerEcart', () => {
  it('compare l’heure du serveur au milieu de l’aller-retour', () => {
    // Poste en avance de 10 min, échange de 400 ms.
    const envoi = tServeur + 600_000;
    expect(mesurerEcart(tServeur, envoi, envoi + 400)).toBe(600_200);
  });

  it('donne un écart négatif quand le poste est en retard', () => {
    const envoi = tServeur - 300_000;
    expect(mesurerEcart(tServeur, envoi, envoi + 200)).toBe(-299_900);
  });

  it('refuse une mesure sans valeur plutôt que d’en inventer une', () => {
    const envoi = tServeur;
    expect(mesurerEcart(null, envoi, envoi + 100)).toBeNull();
    expect(mesurerEcart(heureServeurDuJeton('pas.un.jwt'), envoi, envoi + 100)).toBeNull();
    // Aller-retour plus long que ce qu'on cherche à mesurer.
    expect(mesurerEcart(tServeur, envoi, envoi + ALLER_RETOUR_MAX_MS + 1)).toBeNull();
    // Horloge qui recule pendant l'échange : mesure incohérente.
    expect(mesurerEcart(tServeur, envoi, envoi - 1)).toBeNull();
  });
});

describe('niveauDerive', () => {
  it('laisse passer les petits écarts, qui ne changent rien de lisible', () => {
    expect(niveauDerive(0)).toBe('OK');
    expect(niveauDerive(SEUIL_AVERTISSEMENT_MS - 1)).toBe('OK');
    expect(niveauDerive(-(SEUIL_AVERTISSEMENT_MS - 1))).toBe('OK');
  });

  it('avertit à partir de deux minutes, dans les deux sens', () => {
    expect(niveauDerive(SEUIL_AVERTISSEMENT_MS)).toBe('AVERTISSEMENT');
    expect(niveauDerive(-SEUIL_AVERTISSEMENT_MS)).toBe('AVERTISSEMENT');
    expect(niveauDerive(SEUIL_BLOCAGE_MS - 1)).toBe('AVERTISSEMENT');
  });

  it('bloque à partir d’un quart d’heure', () => {
    expect(niveauDerive(SEUIL_BLOCAGE_MS)).toBe('BLOCAGE');
    expect(niveauDerive(-86_400_000)).toBe('BLOCAGE');
  });
});

describe('formaterEcart', () => {
  it('dit la durée comme on la dirait à voix haute', () => {
    expect(formaterEcart(42_000)).toBe('42 s');
    expect(formaterEcart(180_000)).toBe('3 min');
    expect(formaterEcart(7_800_000)).toBe('2 h 10');
    expect(formaterEcart(7_200_000)).toBe('2 h');
    expect(formaterEcart(2 * 86_400_000 + 3 * 3_600_000)).toBe('2 j 3 h');
    expect(formaterEcart(-180_000)).toBe('3 min');
  });

  it('nomme le sens de la dérive', () => {
    expect(sensDerive(180_000)).toBe('en avance de 3 min');
    expect(sensDerive(-180_000)).toBe('en retard de 3 min');
  });
});

describe('avertissementHorloge', () => {
  const mesure = (ecart_ms: number) => ({ ecart_ms, mesuree_a: '2026-10-17T09:00:00.000Z' });

  it('ne dit rien quand il n’y a rien à dire', () => {
    expect(avertissementHorloge(null)).toBeNull();
    expect(avertissementHorloge(mesure(30_000))).toBeNull();
  });

  it('avertit sans bloquer, et dit quoi faire', () => {
    const a = avertissementHorloge(mesure(5 * 60_000));
    expect(a?.niveau).toBe('AVERTISSEMENT');
    expect(a?.titre).toBe('Horloge du poste en avance de 5 min sur le serveur');
    expect(a?.message).toContain('Heure et langue');
  });

  it('annonce la caisse fermée et pourquoi', () => {
    const a = avertissementHorloge(mesure(-3 * 3_600_000));
    expect(a?.niveau).toBe('BLOCAGE');
    expect(a?.titre).toContain('en retard de 3 h');
    expect(a?.message).toContain('caisse reste fermée');
  });
});
