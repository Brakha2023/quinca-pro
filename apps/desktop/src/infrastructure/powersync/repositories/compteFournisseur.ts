import type { Transaction } from '@powersync/web';
import { v4 as uuidv4 } from 'uuid';
import type { ArticleRow, FournisseurRow } from '@quinca/shared-types';
import { calculerDette } from '../../../core/fournisseurs';
import { arrondirMontant } from '../../../core/commun/prix';
import { numeroPiece } from '../../desktop/identitePoste';

/**
 * Écritures qui touchent au **compte d'un fournisseur**, en dehors du module
 * Fournisseurs : une entrée en stock a besoin de porter au compte ce qu'elle
 * fait entrer, et elle le fait dans la même transaction que le mouvement de
 * stock — l'un sans l'autre n'aurait pas de sens.
 *
 * Ces fonctions prennent une transaction déjà ouverte et ne dépendent d'aucun
 * repository : `FournisseursRepository` se sert lui-même de `StockRepository`,
 * et deux repositories qui s'importent l'un l'autre ne se compileraient pas.
 */

/**
 * Déplace la dette d'un fournisseur sur le poste.
 *
 * Côté serveur ces cumuls sont recalculés par déclencheur à partir des pièces
 * (voir la migration `cumuls_tiers`), et les colonnes écrites ici sont même
 * retirées de ce que le poste envoie. L'écriture locale n'est donc qu'un
 * acompte d'affichage : sans elle, le compte du fournisseur resterait faux à
 * l'écran jusqu'au prochain passage du serveur — c'est-à-dire tout le temps
 * qu'on travaille hors ligne.
 */
export async function mouvementerDetteFournisseur(
  tx: Transaction,
  fournisseurId: string,
  facture: number,
  reglement: number,
  now: string,
): Promise<void> {
  const f = await tx.get<FournisseurRow>('SELECT * FROM fournisseurs WHERE id = ?', [fournisseurId]);
  const cumul_factures = (f.cumul_factures ?? 0) + facture;
  const cumul_reglements = (f.cumul_reglements ?? 0) + reglement;
  const solde_actuel = calculerDette({ solde_initial: f.solde_initial ?? 0, cumul_factures, cumul_reglements });
  await tx.execute(
    'UPDATE fournisseurs SET cumul_factures = ?, cumul_reglements = ?, solde_actuel = ?, updated_at = ? WHERE id = ?',
    [cumul_factures, cumul_reglements, solde_actuel, now, fournisseurId],
  );
}

export interface LigneLivree {
  article_id: string;
  quantite: number;
  /** Coût unitaire **net** de la remise du bon : c'est ce qui est dû. */
  cout_unitaire: number;
}

export interface Livraison {
  filialeId: string;
  utilisateurId: string | null;
  fournisseurId: string;
  /** Référence du bon de stock : la pièce fournisseur la reprend si elle est libre. */
  reference: string;
  depotId: string;
  /** Arrivée réelle de la marchandise ; à défaut, l'heure de la saisie. */
  dateLivraison: string | null;
  /** Remise accordée sur le bon entier, en francs : rappelée sur la pièce. */
  remise: number;
  motif: string | null;
  lignes: readonly LigneLivree[];
  now: string;
}

/**
 * Porte au compte du fournisseur la marchandise qu'il vient de livrer.
 *
 * La pièce créée est un **achat réceptionné** (`COMMANDE` / `LIVREE`), la même
 * que celle du module Fournisseurs : elle apparaît au relevé du fournisseur,
 * sa facture s'imprime, et elle se règle par le même écran. C'est
 * `total_recu_ttc` qui fait foi — côté serveur, c'est de cette colonne que le
 * déclencheur tire la dette.
 *
 * Les lignes sont enregistrées au coût **net** de la remise du bon, et la
 * remise est rappelée en note. La porter en `remise_percent` ferait recalculer
 * la facture sur des prix déjà nets : la remise serait déduite deux fois, et
 * le net à payer ne tomberait plus sur la dette.
 *
 * Aucune TVA n'est ventilée : l'entrée en stock saisit ce que la marchandise
 * coûte, pas une facture détaillée. Un achat à ventiler se saisit dans
 * Fournisseurs → Achat.
 *
 * @returns le net porté au compte, 0 si rien n'était dû.
 */
export async function porterLivraisonAuCompte(tx: Transaction, livraison: Livraison): Promise<number> {
  const net = arrondirMontant(livraison.lignes.reduce((s, l) => s + l.quantite * l.cout_unitaire, 0));
  // Rien de dû, rien à porter : une pièce à 0 F encombrerait les achats du
  // fournisseur et son relevé sans rien dire (marchandise offerte, ou coûts
  // non renseignés).
  if (net <= 0) return 0;
  const id = uuidv4();
  const numero = await numeroLibre(tx, livraison.filialeId, livraison.reference);
  const date = livraison.dateLivraison ?? livraison.now;
  const notes = [livraison.motif, livraison.remise > 0 ? `Remise globale ${Math.round(livraison.remise)} F` : null, `Entrée en stock ${livraison.reference}`]
    .filter(Boolean)
    .join(' · ');

  await tx.execute(
    `INSERT INTO commandes_fournisseurs (id, numero, fournisseur_id, date_commande, type, statut, total_ht, total_tva, total_ttc, total_recu_ttc,
                                         montant_paye, reste_a_payer, remise_percent, tva_percent, depot_id, date_reception, notes, utilisateur_id, filiale_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'COMMANDE', 'LIVREE', ?, 0, ?, ?, 0, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)`,
    [id, numero, livraison.fournisseurId, date, net, net, net, net, livraison.depotId, date, notes, livraison.utilisateurId, livraison.filialeId, livraison.now, livraison.now],
  );

  for (const ligne of livraison.lignes) {
    const a = await tx.get<ArticleRow>('SELECT code, designation, unite FROM articles WHERE id = ?', [ligne.article_id]);
    await tx.execute(
      `INSERT INTO lignes_commande_fournisseur (id, commande_id, filiale_id, article_id, code_article, designation, unite, quantite, quantite_recue,
                                                prix_unitaire_ht, remise_percent, total_ht, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [uuidv4(), id, livraison.filialeId, ligne.article_id, a.code ?? '', a.designation ?? '', a.unite ?? null,
       ligne.quantite, ligne.quantite, ligne.cout_unitaire, arrondirMontant(ligne.quantite * ligne.cout_unitaire), livraison.now],
    );
  }

  await mouvementerDetteFournisseur(tx, livraison.fournisseurId, net, 0, livraison.now);
  return net;
}

/**
 * Numéro de pièce fournisseur : celui du bon de stock, pour que le magasin et
 * la comptabilité parlent du même papier.
 *
 * La référence d'une entrée est libre (« BL 42 ») là où le serveur impose un
 * numéro unique par filiale : si elle est déjà prise, la pièce reçoit son
 * propre numéro plutôt que de faire échouer l'envoi — le bon d'entrée reste
 * cité en note dans tous les cas.
 */
async function numeroLibre(tx: Transaction, filialeId: string, souhaite: string): Promise<string> {
  if (souhaite) {
    const pris = await tx.getOptional<{ id: string }>('SELECT id FROM commandes_fournisseurs WHERE filiale_id = ? AND numero = ? LIMIT 1', [filialeId, souhaite]);
    if (!pris) return souhaite;
  }
  return numeroPiece('ACH');
}
