/**
 * Catalogue des permissions : la liste de tout ce qu'on peut accorder.
 *
 * C'est **ici** que vit la vérité, pas dans un CHECK Postgres : ajouter une
 * permission ne doit pas demander une migration. Le serveur ne vérifie que la
 * forme (`module.action`) et ignore ce qu'il ne connaît pas — un poste resté en
 * version ancienne ignore de la même façon une permission plus récente que lui.
 *
 * Une permission répond à une question qu'un gérant se pose vraiment
 * (« qui valide une vente ? », « qui touche aux prix ? »), jamais à une
 * question d'écran. D'où leur nombre modeste : un droit qu'on n'aurait aucune
 * raison de retirer n'a pas à être une permission.
 */

export interface DescriptionPermission {
  code: string;
  libelle: string;
  /** Ce que la permission ouvre — et, quand il le faut, ce qu'elle n'ouvre pas. */
  detail?: string;
}

export interface ModulePermissions {
  id: string;
  libelle: string;
  permissions: DescriptionPermission[];
}

export const CATALOGUE_PERMISSIONS: ModulePermissions[] = [
  {
    id: 'pilotage',
    libelle: 'Pilotage',
    permissions: [
      { code: 'consolidation.lire', libelle: 'Consulter la consolidation et les rapports', detail: 'Chiffres de gestion — marges et prix d\'achat compris — de la filiale, et de toutes les filiales pour un compte de direction.' },
    ],
  },
  {
    id: 'vente',
    libelle: 'Ventes et caisse',
    permissions: [
      { code: 'pos.encaisser', libelle: 'Encaisser au point de vente' },
      { code: 'ventes.lire', libelle: 'Consulter les ventes' },
      { code: 'ventes.valider', libelle: 'Valider une vente en attente' },
      { code: 'ventes.annuler', libelle: 'Annuler une vente validée', detail: 'Remet la marchandise en stock et solde la créance.' },
      { code: 'ventes.remise', libelle: 'Accorder une remise' },
      { code: 'ventes.forcer_stock', libelle: 'Vendre malgré un stock insuffisant', detail: 'La vente passe et le stock devient négatif : c\'est un engagement.' },
    ],
  },
  {
    id: 'catalogue',
    libelle: 'Catalogue',
    permissions: [
      { code: 'articles.lire', libelle: 'Consulter le catalogue' },
      { code: 'articles.ecrire', libelle: 'Créer et modifier les articles' },
      { code: 'articles.prix', libelle: 'Modifier les prix de vente', detail: 'Sans cette permission, les prix s\'affichent mais ne se changent pas.' },
    ],
  },
  {
    id: 'stock',
    libelle: 'Stock',
    permissions: [
      { code: 'stock.lire', libelle: 'Consulter les stocks' },
      { code: 'stock.entree', libelle: 'Enregistrer une entrée (achat, retour)' },
      { code: 'stock.sortie', libelle: 'Enregistrer une sortie (déstockage, casse)' },
      { code: 'stock.inventaire', libelle: 'Saisir un inventaire' },
      { code: 'stock.transferer', libelle: 'Transférer entre dépôts' },
      { code: 'stock.transferer_filiale', libelle: 'Transférer entre filiales' },
      { code: 'stock.production', libelle: 'Enregistrer une production' },
      { code: 'stock.depots', libelle: 'Gérer les dépôts' },
    ],
  },
  {
    id: 'clients',
    libelle: 'Clients',
    permissions: [
      { code: 'clients.lire', libelle: 'Consulter les clients' },
      { code: 'clients.ecrire', libelle: 'Créer et modifier les clients' },
      { code: 'clients.reglement', libelle: 'Encaisser un règlement client' },
      { code: 'clients.proforma', libelle: 'Établir une facture proforma' },
    ],
  },
  {
    id: 'fournisseurs',
    libelle: 'Fournisseurs',
    permissions: [
      { code: 'fournisseurs.lire', libelle: 'Consulter les fournisseurs' },
      { code: 'fournisseurs.ecrire', libelle: 'Créer et modifier les fournisseurs' },
      { code: 'fournisseurs.commande', libelle: 'Passer et réceptionner une commande' },
      { code: 'fournisseurs.reglement', libelle: 'Payer un fournisseur' },
    ],
  },
  {
    id: 'tresorerie',
    libelle: 'Trésorerie',
    permissions: [
      { code: 'tresorerie.lire', libelle: 'Consulter les caisses et les journaux' },
      { code: 'tresorerie.mouvement', libelle: 'Saisir une recette ou une dépense' },
      { code: 'tresorerie.caisses', libelle: 'Gérer les caisses', detail: 'Ouvrir, renommer, fermer une caisse.' },
      { code: 'tresorerie.transfert', libelle: 'Transférer des fonds entre filiales' },
    ],
  },
  {
    id: 'livraisons',
    libelle: 'Livraisons',
    permissions: [
      { code: 'livraisons.lire', libelle: 'Consulter les livraisons' },
      { code: 'livraisons.ecrire', libelle: 'Préparer et suivre les livraisons' },
    ],
  },
  {
    id: 'personnel',
    libelle: 'Personnel',
    permissions: [
      { code: 'employes.lire', libelle: 'Consulter le personnel' },
      { code: 'employes.ecrire', libelle: 'Créer et modifier les fiches' },
      { code: 'employes.pointage', libelle: 'Pointer les présences' },
      { code: 'employes.paie', libelle: 'Établir et payer les salaires', detail: 'Donne à voir toutes les rémunérations.' },
    ],
  },
  {
    id: 'surveillance',
    libelle: 'Rapports et surveillance',
    permissions: [
      { code: 'historiques.lire', libelle: 'Consulter les historiques' },
      { code: 'audit.lire', libelle: 'Consulter le journal d\'audit' },
      { code: 'sync.decider', libelle: 'Décider du sort d\'une écriture refusée', detail: 'Rejouer ou abandonner une opération que le serveur a refusée.' },
    ],
  },
  {
    id: 'parametres',
    libelle: 'Paramètres',
    permissions: [
      { code: 'parametres.lire', libelle: 'Ouvrir les paramètres' },
      { code: 'parametres.entreprise', libelle: "Modifier l'identité et les papiers de l'entreprise", detail: 'Raison sociale, identifiants fiscaux, TVA, logos, formats des pièces imprimées.' },
      { code: 'parametres.utilisateurs', libelle: 'Affecter les rôles et activer les comptes' },
      { code: 'parametres.roles', libelle: 'Définir les rôles et leurs permissions', detail: 'Décider qui a le droit de quoi : la permission la plus lourde de toutes.' },
    ],
  },
];

export const PERMISSIONS: readonly string[] = CATALOGUE_PERMISSIONS.flatMap((m) => m.permissions.map((p) => p.code));

/** Un code de permission connu de cette version de l'application. */
export type Permission = string;

export const estPermission = (code: string): boolean => PERMISSIONS.includes(code);

const DESCRIPTIONS: Map<string, DescriptionPermission> = new Map(
  CATALOGUE_PERMISSIONS.flatMap((m) => m.permissions.map((p) => [p.code, p] as const)),
);

/** Libellé lisible d'une permission ; le code lui-même si cette version l'ignore. */
export const libellePermission = (code: string): string => DESCRIPTIONS.get(code)?.libelle ?? code;

export const descriptionPermission = (code: string): DescriptionPermission | undefined => DESCRIPTIONS.get(code);

/** Module auquel appartient une permission (pour grouper un affichage). */
export const modulePermission = (code: string): ModulePermissions | undefined =>
  CATALOGUE_PERMISSIONS.find((m) => m.permissions.some((p) => p.code === code));

/**
 * Permission détenue ? Le superadministrateur a tout, par nature : il n'a pas
 * de lignes de permissions, et c'est exprès — on ne peut rien lui retirer.
 */
export function peut(accordees: Iterable<string>, permission: Permission, estSuperadmin = false): boolean {
  if (estSuperadmin) return true;
  for (const p of accordees) if (p === permission) return true;
  return false;
}

/** Au moins une des permissions (un écran qui s'ouvre pour plusieurs raisons). */
export function peutUneDe(accordees: Iterable<string>, permissions: Permission[], estSuperadmin = false): boolean {
  if (estSuperadmin) return true;
  const detenues = new Set(accordees);
  return permissions.some((p) => detenues.has(p));
}

/**
 * Les permissions d'un rôle, rangées par module, pour affichage ou impression.
 * Les codes que cette version ne connaît pas sont écartés : ils viennent d'une
 * version plus récente et ne veulent rien dire ici.
 */
export function permissionsParModule(accordees: Iterable<string>): Array<{ module: ModulePermissions; permissions: DescriptionPermission[] }> {
  const detenues = new Set(accordees);
  return CATALOGUE_PERMISSIONS.map((module) => ({
    module,
    permissions: module.permissions.filter((p) => detenues.has(p.code)),
  })).filter((groupe) => groupe.permissions.length > 0);
}
