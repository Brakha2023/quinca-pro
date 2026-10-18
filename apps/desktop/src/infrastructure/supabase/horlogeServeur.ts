import { heureServeurDuJeton, mesurerEcart, type MesureHorloge } from '../../core/sync';
import { supabase } from './client';

/**
 * Écart entre l'horloge du poste et celle du serveur.
 *
 * Mesuré sur le jeton signé par Supabase, à chaque connexion et à chaque
 * renouvellement : aucun appel supplémentaire, c'est un échange qui a lieu de
 * toute façon. Le résultat est conservé sur la machine, parce qu'une horloge
 * fausse le reste après extinction — et qu'un poste hors ligne doit continuer
 * d'être averti.
 */
const CLE = 'quinca.horloge';

let mesure: MesureHorloge | null = relire();
/** Dernier jeton mesuré : les événements d'authentification se répètent. */
let dernierJeton: string | null = null;
const abonnes = new Set<() => void>();

function relire(): MesureHorloge | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const v = JSON.parse(brut) as Partial<MesureHorloge>;
    return typeof v.ecart_ms === 'number' && typeof v.mesuree_a === 'string' ? { ecart_ms: v.ecart_ms, mesuree_a: v.mesuree_a } : null;
  } catch {
    return null;
  }
}

function retenir(valeur: MesureHorloge | null): void {
  mesure = valeur;
  try {
    if (valeur) localStorage.setItem(CLE, JSON.stringify(valeur));
    else localStorage.removeItem(CLE);
  } catch {
    // Stockage indisponible : la mesure vaut pour cette session seulement.
  }
  for (const abonne of [...abonnes]) abonne();
}

/** Dernière mesure connue, ou `null` si le poste n'a jamais parlé au serveur. */
export function derniereMesureHorloge(): MesureHorloge | null {
  return mesure;
}

export function surChangementHorloge(abonne: () => void): () => void {
  abonnes.add(abonne);
  return () => abonnes.delete(abonne);
}

/**
 * Oublie la mesure : après un réglage de l'horloge, le poste repart sans
 * avertissement. La prochaine connexion au serveur tranchera — en quelques
 * secondes si l'heure est toujours fausse.
 */
export function oublierMesureHorloge(): void {
  dernierJeton = null;
  retenir(null);
}

/**
 * Enregistre l'écart porté par un jeton **frais** (connexion, renouvellement).
 * Un jeton relu du disque au démarrage ne dit rien de l'heure qu'il est.
 *
 * Le serveur a signé son jeton un aller-retour réseau avant qu'on le reçoive :
 * le poste paraît donc en retard de cette latence, une seconde tout au plus,
 * loin des seuils qui déclenchent quoi que ce soit.
 */
export function mesurerAvecJeton(jeton: string | null | undefined, recu = Date.now()): MesureHorloge | null {
  if (!jeton || jeton === dernierJeton) return mesure;
  const ecart = mesurerEcart(heureServeurDuJeton(jeton), recu, recu);
  if (ecart === null) return mesure;
  dernierJeton = jeton;
  retenir({ ecart_ms: ecart, mesuree_a: new Date(recu).toISOString() });
  return mesure;
}

/**
 * Branche la mesure sur l'authentification. `INITIAL_SESSION` est écarté : ce
 * jeton-là vient du disque et peut dater de plusieurs heures.
 */
export function surveillerHorlogeServeur(): void {
  supabase.auth.onAuthStateChange((evenement, session) => {
    if (evenement === 'SIGNED_IN' || evenement === 'TOKEN_REFRESHED' || evenement === 'USER_UPDATED') {
      mesurerAvecJeton(session?.access_token);
    }
  });
}
