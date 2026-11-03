import { arrondirFcfa } from '../commun/prix';

/**
 * La marge, catégorie par catégorie et article par article.
 *
 * Le tableau de bord dit **combien** la maison a gagné sur une période ; il ne
 * dit pas **où**. Or c'est la seule question qui mène à une décision : quelle
 * famille porte le magasin, laquelle se vend beaucoup pour ne rien rapporter,
 * quel article part sous son prix de revient sans que personne ne s'en
 * aperçoive. D'où ce rapport, qui éclate le même chiffre.
 *
 * ### Ce que « marge » veut dire ici
 *
 * Marge commerciale : chiffre d'affaires **hors taxes**, remise accordée
 * déduite, moins ce que la marchandise vendue a coûté à l'achat. C'est la
 * même définition qu'au tableau de bord, et c'est exprès — un gérant qui
 * ouvre les deux écrans doit y lire le même total. Ni les charges
 * d'exploitation ni les frais d'approche n'entrent ici : ce n'est pas un
 * résultat, c'est ce que la marchandise rapporte.
 *
 * Le coût vient du journal des mouvements, où chaque sortie garde le coût
 * moyen que le dépôt portait **au moment du départ** (voir
 * `RapportsRepository`). Les sorties antérieures à ce changement n'en portent
 * pas : elles retombent sur le coût moyen d'aujourd'hui, et le rapport
 * compte ces lignes pour pouvoir le dire.
 *
 * ### Le taux, et sur quoi il se calcule
 *
 * Marge rapportée au **chiffre d'affaires**, jamais au coût d'achat. Rapporté
 * au coût, le même article afficherait un taux plus flatteur et incomparable
 * d'une famille à l'autre. C'est aussi ce que fait `core/pilotage`.
 */

/** Une ligne telle que `margesQuery` la rend : un article vendu sur la période. */
export interface MargeArticleRow {
  cle: string | null;
  code: string | null;
  designation: string | null;
  unite: string | null;
  famille_cle: string | null;
  famille: string | null;
  /** Chiffre d'affaires hors taxes, remise de la vente déjà déduite. */
  ca_ht: number | null;
  /** Coût d'achat de la marchandise sortie, retours clients déduits. */
  cout: number | null;
  quantite: number | null;
  lignes: number | null;
  /** Sorties dont le journal ne porte aucun coût : valorisées au coût moyen actuel. */
  sorties_sans_cout: number | null;
}

/**
 * Une ligne du rapport. La même forme sert la catégorie et l'article : les
 * deux tableaux portent les mêmes colonnes, et un seul calcul les remplit.
 */
export interface LigneMarge {
  cle: string;
  libelle: string;
  /** Code de l'article ; vide sur une ligne de catégorie. */
  code: string;
  unite: string;
  /** Catégorie de l'article ; vide sur une ligne de catégorie, qui *est* la catégorie. */
  famille: string;
  famille_cle: string;
  ca_ht: number;
  cout: number;
  marge: number;
  /** Marge rapportée au chiffre d'affaires hors taxes, en %. */
  taux_marge: number;
  quantite: number;
  /** Nombre de lignes de vente derrière le chiffre. */
  lignes: number;
  /** Articles distincts vendus ; 1 sur une ligne d'article. */
  articles: number;
  /** Part du chiffre d'affaires de la sélection, en %. */
  part_ca: number;
  /** Part de la marge de la sélection, en %. Nulle quand la sélection ne dégage rien. */
  part_marge: number;
  sorties_sans_cout: number;
}

const nombre = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Marge en % du chiffre d'affaires, à la dixième. Nulle quand rien n'a été vendu. */
export function tauxMarge(ca_ht: number, marge: number): number {
  if (ca_ht <= 0) return 0;
  return Math.round((marge / ca_ht) * 1000) / 10;
}

/** Une ligne par article vendu. Les parts restent à zéro : elles dépendent de la sélection. */
export function margesArticles(rows: readonly MargeArticleRow[]): LigneMarge[] {
  return rows.map((r) => {
    const ca_ht = arrondirFcfa(nombre(r.ca_ht));
    const cout = arrondirFcfa(nombre(r.cout));
    const marge = arrondirFcfa(ca_ht - cout);
    return {
      cle: r.cle ?? '',
      libelle: r.designation ?? r.code ?? 'Article inconnu',
      code: r.code ?? '',
      unite: r.unite ?? '',
      famille: r.famille ?? 'Sans catégorie',
      famille_cle: r.famille_cle ?? 'sans-categorie',
      ca_ht,
      cout,
      marge,
      taux_marge: tauxMarge(ca_ht, marge),
      quantite: nombre(r.quantite),
      lignes: nombre(r.lignes),
      articles: 1,
      part_ca: 0,
      part_marge: 0,
      sorties_sans_cout: nombre(r.sorties_sans_cout),
    };
  });
}

/**
 * Les mêmes articles, regroupés par catégorie.
 *
 * Le regroupement se fait **sur les articles déjà retenus**, et non sur une
 * seconde requête : les deux tableaux de l'écran disent alors exactement la
 * même chose, et le total de l'un est le total de l'autre. Deux lectures
 * sépareraient tôt ou tard les deux chiffres.
 */
export function margesCategories(articles: readonly LigneMarge[]): LigneMarge[] {
  const par = new Map<string, LigneMarge>();
  for (const a of articles) {
    const deja = par.get(a.famille_cle);
    if (!deja) {
      par.set(a.famille_cle, {
        ...a,
        cle: a.famille_cle,
        libelle: a.famille,
        code: '',
        unite: '',
        famille: '',
      });
      continue;
    }
    deja.ca_ht += a.ca_ht;
    deja.cout += a.cout;
    deja.quantite += a.quantite;
    deja.lignes += a.lignes;
    deja.articles += 1;
    deja.sorties_sans_cout += a.sorties_sans_cout;
  }
  return [...par.values()].map((c) => {
    const marge = arrondirFcfa(c.ca_ht - c.cout);
    return { ...c, marge, taux_marge: tauxMarge(c.ca_ht, marge) };
  });
}

/**
 * Pose les parts, une fois la sélection arrêtée : elles se lisent les unes
 * contre les autres et doivent faire cent.
 *
 * La part de marge n'a de sens que si la sélection en dégage une : sur un
 * ensemble vendu à perte, « 40 % de la marge » ne voudrait rien dire, et la
 * colonne reste à zéro — la marge elle-même, négative, est sous les yeux.
 */
export function avecParts(lignes: readonly LigneMarge[]): LigneMarge[] {
  const totalCa = lignes.reduce((t, l) => t + l.ca_ht, 0);
  const totalMarge = lignes.reduce((t, l) => t + l.marge, 0);
  return lignes.map((l) => ({
    ...l,
    part_ca: totalCa > 0 ? Math.round((l.ca_ht / totalCa) * 1000) / 10 : 0,
    part_marge: totalMarge > 0 ? Math.round((l.marge / totalMarge) * 1000) / 10 : 0,
  }));
}

export interface FiltresMarges {
  /** Catégorie retenue, par sa clé ; vide = toutes. */
  familleCle?: string;
  /** Code ou désignation de l'article, ou nom de la catégorie. */
  recherche?: string;
}

export function filtrerMarges(lignes: readonly LigneMarge[], filtres: FiltresMarges): LigneMarge[] {
  const q = filtres.recherche?.trim().toLowerCase() ?? '';
  return lignes.filter((l) => {
    if (filtres.familleCle && l.famille_cle !== filtres.familleCle) return false;
    if (!q) return true;
    return `${l.code} ${l.libelle} ${l.famille}`.toLowerCase().includes(q);
  });
}

export type TriMarges = 'MARGE' | 'CA' | 'TAUX' | 'QUANTITE';

export const TRIS_MARGES: Array<{ id: TriMarges; label: string }> = [
  { id: 'MARGE', label: 'Marge' },
  { id: 'CA', label: "Chiffre d'affaires" },
  { id: 'TAUX', label: 'Taux de marge' },
  { id: 'QUANTITE', label: 'Quantité vendue' },
];

/**
 * Du plus fort au plus faible, et à égalité par ordre alphabétique : un
 * classement qui change d'ordre à chaque relecture ne se compare pas d'un
 * mois sur l'autre.
 */
export function trierMarges(lignes: readonly LigneMarge[], tri: TriMarges): LigneMarge[] {
  const cle = (l: LigneMarge): number => {
    if (tri === 'CA') return l.ca_ht;
    if (tri === 'TAUX') return l.taux_marge;
    if (tri === 'QUANTITE') return l.quantite;
    return l.marge;
  };
  return [...lignes].sort((a, b) => cle(b) - cle(a) || a.libelle.localeCompare(b.libelle, 'fr'));
}

export interface RecapMarges {
  categories: number;
  articles: number;
  lignes: number;
  quantite: number;
  ca_ht: number;
  cout: number;
  marge: number;
  taux_marge: number;
  /** Sorties valorisées au coût moyen d'aujourd'hui, faute de coût au journal. */
  sorties_sans_cout: number;
}

/** Les totaux de la sélection. Les articles en sont la source, jamais les catégories. */
export function recapMarges(articles: readonly LigneMarge[]): RecapMarges {
  const ca_ht = arrondirFcfa(articles.reduce((t, l) => t + l.ca_ht, 0));
  const cout = arrondirFcfa(articles.reduce((t, l) => t + l.cout, 0));
  const marge = arrondirFcfa(ca_ht - cout);
  return {
    categories: new Set(articles.map((l) => l.famille_cle)).size,
    articles: articles.length,
    lignes: articles.reduce((t, l) => t + l.lignes, 0),
    quantite: Math.round(articles.reduce((t, l) => t + l.quantite, 0) * 100) / 100,
    ca_ht,
    cout,
    marge,
    taux_marge: tauxMarge(ca_ht, marge),
    sorties_sans_cout: articles.reduce((t, l) => t + l.sorties_sans_cout, 0),
  };
}

export interface PerimetreMarges {
  /** Bornes déjà mises en forme française, telles qu'elles s'impriment. */
  debut: string;
  fin: string;
  categorieLibelle?: string | null;
  recherche?: string;
}

/** Les filtres en vigueur, en une phrase : la feuille imprimée dit son périmètre. */
export function perimetreMarges(filtres: PerimetreMarges): string {
  return [
    `du ${filtres.debut} au ${filtres.fin}`,
    filtres.categorieLibelle ? `catégorie « ${filtres.categorieLibelle} »` : 'toutes catégories',
    filtres.recherche?.trim() ? `recherche « ${filtres.recherche.trim()} »` : null,
  ].filter(Boolean).join(' · ');
}

/**
 * Ce que l'article le plus rentable et le moins rentable de la sélection
 * apprennent : un rapport qui ne donne que des totaux laisse le gérant
 * chercher lui-même les deux lignes qui comptent.
 *
 * « Le moins rentable » n'est pas le dernier du classement par marge — c'est
 * celui qui vend en perdant, s'il en existe un. Sans perte, rien à signaler.
 */
export function alertesMarges(articles: readonly LigneMarge[]): { aPerte: LigneMarge[]; perte: number } {
  const aPerte = articles.filter((l) => l.marge < 0).sort((a, b) => a.marge - b.marge);
  return { aPerte, perte: arrondirFcfa(aPerte.reduce((t, l) => t + l.marge, 0)) };
}
