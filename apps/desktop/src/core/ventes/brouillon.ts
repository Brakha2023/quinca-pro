import type { VenteBrouillonRow } from '@quinca/shared-types';
import { arrondirFcfa, arrondirMontant } from '../commun/prix';
import type { LignePanier } from './panier';

/**
 * Vente mise de côté au comptoir.
 *
 * Elle se partage entre les postes d'une filiale : le ticket commencé à la
 * caisse 1 se reprend à la caisse 2. Ce n'est pas une pièce — rien n'est
 * vendu, rien ne sort du stock, aucun numéro n'est tiré — d'où sa table à
 * elle, hors de `ventes` et donc hors de tous les chiffres.
 *
 * Le panier voyage en JSON. Il est donc relu avec méfiance : un brouillon
 * écrit par une version plus récente, ou abîmé, ne doit pas faire tomber
 * l'écran de caisse. Une ligne qu'on ne sait pas lire est ignorée ; un
 * brouillon dont il ne reste rien se jette.
 */
export interface Brouillon {
  id: string;
  libelle: string;
  filiale_id: string;
  client_id: string | null;
  lignes: LignePanier[];
  remise: number;
  remise_auto: boolean;
  total_ttc: number;
  articles: number;
  /** Nom de qui l'a mis de côté : on sait à qui l'on prend le ticket. */
  utilisateur: string | null;
  /** Code de la machine d'origine, pour dire « commencé sur une autre caisse ». */
  poste: string | null;
  cree_le: string;
}

const nombre = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const texte = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Une ligne n'est retenue que si elle désigne un article et une quantité. */
function ligneLisible(brute: unknown): LignePanier | null {
  if (typeof brute !== 'object' || brute === null) return null;
  const l = brute as Record<string, unknown>;
  const article_id = texte(l.article_id);
  const quantite = nombre(l.quantite);
  if (!article_id || quantite <= 0) return null;
  return {
    article_id,
    code: texte(l.code),
    designation: texte(l.designation) || texte(l.code) || 'Article',
    unite: texte(l.unite),
    prix_unitaire_ttc: nombre(l.prix_unitaire_ttc),
    tva_percent: nombre(l.tva_percent),
    quantite,
    remise_percent: nombre(l.remise_percent),
  };
}

export function lireLignesBrouillon(json: string | null): LignePanier[] {
  if (!json) return [];
  try {
    const brut: unknown = JSON.parse(json);
    if (!Array.isArray(brut)) return [];
    return brut.map(ligneLisible).filter((l): l is LignePanier => l !== null);
  } catch {
    // Un brouillon illisible n'est pas une panne : c'est un panier perdu.
    return [];
  }
}

export const ecrireLignesBrouillon = (lignes: readonly LignePanier[]): string => JSON.stringify(lignes);

type LigneBrouillon = VenteBrouillonRow & { utilisateur_nom: string | null; utilisateur_prenom: string | null };

export function brouillonFromRow(row: LigneBrouillon): Brouillon {
  const nom = [row.utilisateur_prenom, row.utilisateur_nom].filter(Boolean).join(' ');
  return {
    id: row.id,
    libelle: row.libelle ?? 'Ticket',
    filiale_id: row.filiale_id ?? '',
    client_id: row.client_id,
    lignes: lireLignesBrouillon(row.lignes),
    remise: arrondirFcfa(nombre(row.remise)),
    // SQLite n'a pas de booléen : la colonne arrive en 0 / 1.
    remise_auto: (row.remise_auto ?? 1) !== 0,
    total_ttc: arrondirFcfa(nombre(row.total_ttc)),
    articles: arrondirMontant(nombre(row.articles)),
    utilisateur: nom || null,
    poste: row.poste,
    cree_le: row.created_at ?? '',
  };
}

/**
 * De quoi reconnaître un ticket d'un coup d'œil : le client s'il y en a un,
 * sinon ce qu'il y a dedans. Deux tickets mis de côté dans la même minute
 * porteraient sinon le même nom.
 */
export function libelleBrouillon(lignes: readonly LignePanier[], client: { raison_sociale: string } | null): string {
  if (client) return client.raison_sociale;
  if (lignes.length === 0) return 'Ticket';
  return `${lignes[0]!.designation}${lignes.length > 1 ? ` +${lignes.length - 1}` : ''}`;
}
