/**
 * Dérive de l'horloge du poste.
 *
 * Toutes les dates de l'application — ticket, mouvement de stock, journée de
 * caisse — viennent de `new Date()` sur le poste, parce qu'il doit pouvoir
 * travailler sans réseau. Une machine à l'heure fausse produit donc des pièces
 * horodatées faux, et personne ne s'en aperçoit : elles ne sont refusées par
 * rien, elles s'intercalent simplement au mauvais endroit dans l'histoire.
 *
 * L'heure du serveur se lit gratuitement sur le **jeton** qu'il signe : chaque
 * connexion et chaque renouvellement en rapportent un, dont le champ `iat`
 * (issued at) porte l'heure de Supabase. On compare, et on le dit.
 *
 * L'en-tête `Date` des réponses REST, lui, n'est pas lisible : il n'est pas
 * dans la liste blanche CORS et Supabase ne l'expose pas
 * (`access-control-expose-headers` ne le contient pas, vérifié sur le projet).
 * Le jeton, lui, est dans le corps de la réponse — rien ne le cache.
 */

/** Au-delà : avertissement. En dessous, l'écart ne change rien à ce qui est lisible sur une pièce. */
export const SEUIL_AVERTISSEMENT_MS = 2 * 60_000;
/** Au-delà : la caisse ne s'ouvre pas. Un ticket serait horodaté dans le mauvais quart d'heure, une journée de caisse pourrait enjamber une autre. */
export const SEUIL_BLOCAGE_MS = 15 * 60_000;

/**
 * Au-delà de cet aller-retour, la mesure ne vaut rien : la latence est du même
 * ordre que ce qu'on veut mesurer.
 */
export const ALLER_RETOUR_MAX_MS = 5_000;

export type NiveauDerive = 'OK' | 'AVERTISSEMENT' | 'BLOCAGE';

export interface MesureHorloge {
  /** Écart signé en millisecondes : positif = le poste est en avance sur le serveur. */
  ecart_ms: number;
  /** Heure locale du poste au moment de la mesure (ISO). */
  mesuree_a: string;
}

/**
 * Heure du serveur portée par un jeton d'accès Supabase, en millisecondes.
 * Le `iat` est signé par le serveur ; on ne lit que lui, sans rien vérifier
 * d'autre — un jeton reçu par TLS suffit pour régler une pendule.
 * `null` si le jeton est absent ou illisible.
 */
export function heureServeurDuJeton(jeton: string | null | undefined): number | null {
  const charge = typeof jeton === 'string' ? jeton.split('.')[1] : undefined;
  if (!charge) return null;
  try {
    const json = atob(charge.replace(/-/g, '+').replace(/_/g, '/'));
    const iat: unknown = (JSON.parse(json) as { iat?: unknown }).iat;
    return typeof iat === 'number' && Number.isFinite(iat) ? iat * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Écart entre le poste et le serveur.
 *
 * `envoi` et `reception` sont les heures locales qui encadrent l'échange : le
 * serveur a daté sa réponse entre les deux, donc on compare à leur milieu.
 * `null` quand la mesure ne vaut rien (heure serveur absente, aller-retour trop
 * long pour que la comparaison ait un sens).
 */
export function mesurerEcart(instantServeur: number | null, envoi: number, reception: number): number | null {
  if (instantServeur === null || !Number.isFinite(instantServeur)) return null;
  if (reception < envoi || reception - envoi > ALLER_RETOUR_MAX_MS) return null;
  return Math.round((envoi + reception) / 2 - instantServeur);
}

export function niveauDerive(ecartMs: number): NiveauDerive {
  const ecart = Math.abs(ecartMs);
  if (ecart >= SEUIL_BLOCAGE_MS) return 'BLOCAGE';
  if (ecart >= SEUIL_AVERTISSEMENT_MS) return 'AVERTISSEMENT';
  return 'OK';
}

/** Durée en toutes lettres courtes : « 3 min », « 2 h 10 », « 3 j ». */
export function formaterEcart(ecartMs: number): string {
  const total = Math.round(Math.abs(ecartMs) / 1000);
  const jours = Math.floor(total / 86_400);
  const heures = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  if (jours > 0) return heures > 0 ? `${jours} j ${heures} h` : `${jours} j`;
  if (heures > 0) return minutes > 0 ? `${heures} h ${String(minutes).padStart(2, '0')}` : `${heures} h`;
  if (minutes > 0) return `${minutes} min`;
  return `${total} s`;
}

/** « en avance de 3 min » / « en retard de 2 h 10 ». */
export function sensDerive(ecartMs: number): string {
  return `${ecartMs > 0 ? 'en avance' : 'en retard'} de ${formaterEcart(ecartMs)}`;
}

export interface AvertissementHorloge {
  niveau: NiveauDerive;
  titre: string;
  message: string;
}

/**
 * Ce qu'on affiche au poste. Le message dit le sens de l'écart, ce que ça
 * abîme, et le geste à faire — l'utilisateur n'a pas à deviner.
 */
export function avertissementHorloge(mesure: MesureHorloge | null): AvertissementHorloge | null {
  if (!mesure) return null;
  const niveau = niveauDerive(mesure.ecart_ms);
  if (niveau === 'OK') return null;

  const ecart = sensDerive(mesure.ecart_ms);
  const reglage = "Réglez l'heure de Windows (Paramètres → Heure et langue → « Régler l'heure automatiquement »), puis rouvrez l'application.";

  if (niveau === 'BLOCAGE') {
    return {
      niveau,
      titre: `Horloge du poste ${ecart} sur le serveur`,
      message: `La caisse reste fermée tant que l'heure n'est pas corrigée : les tickets, les mouvements de stock et la journée de caisse seraient enregistrés à la mauvaise heure, et rien ne les redresserait ensuite. ${reglage}`,
    };
  }
  return {
    niveau,
    titre: `Horloge du poste ${ecart} sur le serveur`,
    message: `Les pièces créées ici porteront cette heure. ${reglage}`,
  };
}
