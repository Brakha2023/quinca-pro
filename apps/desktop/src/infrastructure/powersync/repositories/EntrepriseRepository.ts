import type { EntrepriseForm, ReglagesDocuments } from '../../../core/parametres';
import { normaliserPrefixe } from '../../../core/parametres';
import { BaseRepository } from './BaseRepository';

/**
 * Configuration d'une filiale : identité, fiscalité, papiers.
 *
 * Une ligne par filiale, créée côté serveur par `trg_filiales_creer_parametres`
 * (migration 20261025000000). Le poste ne la crée donc jamais : il la met à
 * jour. Si elle n'est pas encore arrivée, l'écran le dit au lieu d'en fabriquer
 * une seconde qui ferait doublon à la synchronisation.
 */

export const ENTREPRISE_QUERY = 'SELECT * FROM parametres_filiale WHERE filiale_id = ?';

/**
 * Fiche dont un document doit tirer son en-tête.
 *
 * La filiale regardée quand il y en a une. Sinon — un directeur en vue groupe —
 * celle de la **maison mère**, à défaut la première filiale : une pièce éditée
 * à l'échelle du groupe porte le papier de la société, pas une page blanche.
 */
export const ENTREPRISE_DOCUMENT_QUERY = `
  SELECT p.*
  FROM parametres_filiale p
  JOIN filiales f ON f.id = p.filiale_id
  WHERE f.est_active != 0 AND (? = '' OR p.filiale_id = ?)
  ORDER BY (p.filiale_id = ?) DESC, f.type DESC, f.nom
  LIMIT 1`;

/** Toutes les fiches reçues : le directeur passe de l'une à l'autre. */
export const ENTREPRISES_QUERY = `
  SELECT p.*, f.nom AS filiale_nom, f.code AS filiale_code
  FROM parametres_filiale p
  JOIN filiales f ON f.id = p.filiale_id
  WHERE f.est_active != 0
  ORDER BY f.type DESC, f.nom`;

export class EntrepriseRepository extends BaseRepository {
  /** Identité, coordonnées et fiscalité : ce que porte le formulaire. */
  async enregistrer(id: string, form: EntrepriseForm): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      await this.patch(tx, 'parametres_filiale', id, {
        nom_commercial: form.nom_commercial.trim(),
        raison_sociale: vide(form.raison_sociale),
        forme_juridique: vide(form.forme_juridique),
        rccm: vide(form.rccm),
        numero_cc: vide(form.numero_cc),
        compte_contribuable: vide(form.compte_contribuable),
        telephone_principal: form.telephone_principal.trim(),
        telephone_secondaire: vide(form.telephone_secondaire),
        email: vide(form.email),
        adresse: form.adresse.trim(),
        ville: form.ville.trim(),
        pays: form.pays.trim(),
        localisation: vide(form.localisation),
        assujetti_tva: form.assujetti_tva ? 1 : 0,
        taux_tva: form.taux_tva,
        prix_saisis: form.prix_saisis,
        devise: form.devise.trim().toUpperCase(),
        mentions_legales: vide(form.mentions_legales),
      });
    });
  }

  /**
   * Un logo, ou son retrait (`null`). Écriture à part : une image pèse, et on
   * ne la renvoie pas à chaque enregistrement du formulaire.
   */
  async enregistrerLogo(
    id: string,
    champ: 'logo_couleur' | 'logo_noir_blanc' | 'logo_entete' | 'logo_filigrane',
    dataUrl: string | null,
  ): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      await this.patch(tx, 'parametres_filiale', id, { [champ]: dataUrl });
    });
  }

  /** Réglages d'impression, enregistrés d'un bloc en JSON. */
  async enregistrerDocuments(id: string, reglages: ReglagesDocuments): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      await this.patch(tx, 'parametres_filiale', id, { formats_documents: JSON.stringify(reglages) });
    });
  }

  /** Préfixes de numérotation. Normalisés ici aussi : ce qui part est propre. */
  async enregistrerPrefixes(id: string, prefixes: Record<string, string>): Promise<void> {
    const propres = Object.fromEntries(
      Object.entries(prefixes).map(([nature, valeur]) => [nature, normaliserPrefixe(valeur)]),
    );
    await this.db.writeTransaction(async (tx) => {
      await this.patch(tx, 'parametres_filiale', id, { prefixes_numerotation: JSON.stringify(propres) });
    });
  }
}

/** Un champ facultatif laissé vide vaut `null` en base, pas la chaîne vide. */
function vide(valeur: string | undefined): string | null {
  const propre = (valeur ?? '').trim();
  return propre.length > 0 ? propre : null;
}
