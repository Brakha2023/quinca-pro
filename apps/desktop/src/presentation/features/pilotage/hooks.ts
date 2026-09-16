import { useMemo } from 'react';
import { useQuery } from '@powersync/react';

const jourIso = (d: Date) => d.toISOString().slice(0, 10);
const debutJour = (jour: string) => new Date(`${jour}T00:00:00`).toISOString();
const finJour = (jour: string) => new Date(`${jour}T23:59:59.999`).toISOString();

export interface IndicateursFiliale {
  filiale_id: string;
  filiale_code: string;
  filiale_nom: string;
  ca_jour: number;
  ventes_jour: number;
  encaisse_jour: number;
  ca_mois: number;
  ventes_mois: number;
  creances: number;
  dettes: number;
  valeur_stock: number;
  alertes_stock: number;
  tresorerie: number;
}

/**
 * Indicateurs par filiale (toutes celles visibles localement : une pour un
 * gérant, toutes pour un directeur). Ventes annulées exclues.
 */
export function useIndicateursFiliales(jour: string = jourIso(new Date())) {
  const debutMois = `${jour.slice(0, 7)}-01`;
  const params = [debutJour(jour), finJour(jour), debutJour(jour), finJour(jour), debutJour(jour), finJour(jour), debutJour(debutMois), finJour(jour), debutJour(debutMois), finJour(jour)];
  const { data, isLoading } = useQuery<IndicateursFiliale>(
    `SELECT f.id AS filiale_id, f.code AS filiale_code, f.nom AS filiale_nom,
       (SELECT COALESCE(SUM(total_ttc), 0) FROM ventes v WHERE v.filiale_id = f.id AND v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ?) AS ca_jour,
       (SELECT COUNT(*) FROM ventes v WHERE v.filiale_id = f.id AND v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ?) AS ventes_jour,
       (SELECT COALESCE(SUM(montant_percu - monnaie), 0) FROM ventes v WHERE v.filiale_id = f.id AND v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ?) AS encaisse_jour,
       (SELECT COALESCE(SUM(total_ttc), 0) FROM ventes v WHERE v.filiale_id = f.id AND v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ?) AS ca_mois,
       (SELECT COUNT(*) FROM ventes v WHERE v.filiale_id = f.id AND v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ?) AS ventes_mois,
       (SELECT COALESCE(SUM(CASE WHEN solde_actuel > 0 THEN solde_actuel ELSE 0 END), 0) FROM clients c WHERE c.filiale_id = f.id AND c.est_actif = 1) AS creances,
       (SELECT COALESCE(SUM(CASE WHEN solde_actuel > 0 THEN solde_actuel ELSE 0 END), 0) FROM fournisseurs fo WHERE fo.filiale_id = f.id AND fo.est_actif = 1) AS dettes,
       (SELECT COALESCE(SUM(s.quantite * s.cout_moyen), 0) FROM stocks s WHERE s.filiale_id = f.id) AS valeur_stock,
       (SELECT COUNT(*) FROM stocks s JOIN articles a ON a.id = s.article_id WHERE s.filiale_id = f.id AND a.est_actif = 1 AND s.quantite <= a.stock_min) AS alertes_stock,
       (SELECT COALESCE(SUM(solde_actuel), 0) FROM caisses ca WHERE ca.filiale_id = f.id AND ca.est_active = 1) AS tresorerie
     FROM filiales f WHERE f.est_active = 1 ORDER BY f.type DESC, f.nom`,
    params,
  );
  return { indicateurs: data, isLoading };
}

export interface PointCa { jour: string; ca: number; ventes: number }

/** CA TTC par jour sur les N derniers jours (jours sans vente inclus, à 0). */
export function useCaParJour(filialeId: string | null, nbJours = 7) {
  const jours = useMemo(() => Array.from({ length: nbJours }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (nbJours - 1 - i)); return jourIso(d); }), [nbJours]);
  const { data } = useQuery<{ jour: string; ca: number; ventes: number }>(
    `SELECT substr(date_vente, 1, 10) AS jour, COALESCE(SUM(total_ttc), 0) AS ca, COUNT(*) AS ventes
     FROM ventes WHERE statut != 'ANNULEE' AND date_vente >= ? AND (? = '' OR filiale_id = ?) GROUP BY substr(date_vente, 1, 10)`,
    [debutJour(jours[0]), filialeId ?? '', filialeId ?? ''],
  );
  return useMemo<PointCa[]>(() => jours.map((jour) => { const p = data.find((d) => d.jour === jour); return { jour, ca: p?.ca ?? 0, ventes: p?.ventes ?? 0 }; }), [jours, data]);
}

export interface TopArticle { code: string; designation: string; quantite: number; ca: number }

export function useTopArticles(filialeId: string | null, jour: string = jourIso(new Date()), limite = 5) {
  const debutMois = `${jour.slice(0, 7)}-01`;
  const { data } = useQuery<TopArticle>(
    `SELECT l.code_article AS code, l.designation, SUM(l.quantite) AS quantite, SUM(l.total_ttc) AS ca
     FROM lignes_vente l JOIN ventes v ON v.id = l.vente_id
     WHERE v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ? AND (? = '' OR v.filiale_id = ?)
     GROUP BY l.code_article, l.designation ORDER BY ca DESC LIMIT ?`,
    [debutJour(debutMois), finJour(jour), filialeId ?? '', filialeId ?? '', limite],
  );
  return data;
}
