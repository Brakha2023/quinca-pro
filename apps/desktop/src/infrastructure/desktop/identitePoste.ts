import {
  codePosteValide, formaterNumeroCourt, genererCodePoste, genererNumeroPiece,
} from '../../core/commun/numerotation';

/**
 * Identité de la machine, et non de la filiale ni de l'utilisateur : deux
 * caisses côte à côte doivent avoir deux codes, même sous le même compte.
 * D'où le stockage local plutôt que la base synchronisée.
 */
const CLE = 'quinca-poste';
/** Ancienne clé, quand le poste ne portait que son code. Relue une fois, puis reprise. */
const CLE_HERITEE = 'quinca-code-poste';

/**
 * Ce que la machine retient d'elle-même.
 *
 * Le code et les compteurs tiennent dans **une seule entrée**, et c'est
 * délibéré : s'ils étaient rangés séparément, un effacement partiel laisserait
 * le poste repartir à 1 sous le même code et rééditer des numéros courts déjà
 * donnés. Ensemble, ils se perdent ensemble — et un poste sans code en tire un
 * neuf, donc un espace de numéros neuf.
 */
interface IdentitePoste {
  code: string;
  /** Rang atteint par préfixe (`VNT`, `ENT`…) sur cette machine. */
  sequences: Record<string, number>;
}

/** Identité retenue pour la session quand le stockage local est indisponible (fenêtre privée, WebView verrouillée). */
let secours: IdentitePoste | null = null;

function stockage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function lire(magasin: Storage | null): IdentitePoste | null {
  try {
    const brut = magasin?.getItem(CLE);
    if (brut) {
      const valeur = JSON.parse(brut) as Partial<IdentitePoste>;
      const code = codePosteValide(valeur?.code);
      if (code) {
        const sequences = valeur.sequences;
        return {
          code,
          // Un compteur illisible ne doit pas emporter le code avec lui : on
          // repart des compteurs vides, le code — qui porte l'unicité — reste.
          sequences: sequences && typeof sequences === 'object' ? { ...sequences } : {},
        };
      }
    }
  } catch {
    // Entrée illisible (JSON tronqué) : traitée comme absente.
  }
  // Poste d'avant les numéros courts : il garde son code, et commence à compter.
  const herite = codePosteValide(magasin?.getItem(CLE_HERITEE));
  return herite ? { code: herite, sequences: {} } : null;
}

function ecrire(magasin: Storage | null, identite: IdentitePoste): void {
  try {
    magasin?.setItem(CLE, JSON.stringify(identite));
  } catch {
    // Stockage en lecture seule : l'identité vaut pour cette session seulement.
  }
}

/** Identité de ce poste, tirée au premier appel puis mémorisée. */
function identite(): { valeur: IdentitePoste; magasin: Storage | null } {
  const magasin = stockage();
  const connue = lire(magasin);
  if (connue) {
    secours = connue;
    return { valeur: connue, magasin };
  }
  const neuve = secours ?? { code: genererCodePoste(), sequences: {} };
  secours = neuve;
  ecrire(magasin, neuve);
  return { valeur: neuve, magasin };
}

/**
 * Code de ce poste, stable d'un démarrage à l'autre : il préfixe toutes les
 * pièces créées ici, de sorte que deux postes hors ligne ne tirent jamais
 * dans le même espace de numéros.
 */
export function codePoste(): string {
  return identite().valeur.code;
}

/** Numéro d'une pièce créée sur ce poste (voir {@link genererNumeroPiece}). */
export function numeroPiece(prefixe: string, date?: Date): string {
  return genererNumeroPiece({ prefixe, poste: codePoste(), date });
}

/**
 * Numéro **court** de la prochaine pièce de cette nature sur ce poste :
 * `VNT-AN8-000075`. Le compteur avance d'un cran et est aussitôt mémorisé —
 * un numéro rendu est un numéro consommé, même si l'écriture qui le portait
 * échoue ensuite. Un trou dans la série vaut mieux qu'un doublon.
 */
export function numeroCourt(prefixe: string): string {
  const { valeur, magasin } = identite();
  const sequence = (valeur.sequences[prefixe] ?? 0) + 1;
  valeur.sequences[prefixe] = sequence;
  ecrire(magasin, valeur);
  return formaterNumeroCourt({ prefixe, poste: valeur.code, sequence });
}
