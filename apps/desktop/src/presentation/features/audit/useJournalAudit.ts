import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LigneAudit } from '../../../core/sync';
import { supabase } from '../../../infrastructure/supabase/client';

export interface FiltresAudit {
  table: string;
  action: string;
  dateDebut: string;
  dateFin: string;
  utilisateurId: string;
}

export type EtatJournal = 'CHARGEMENT' | 'PRET' | 'HORS_LIGNE' | 'ERREUR';

interface Resultat {
  /** Filtres auxquels ce résultat répond : tant qu'ils diffèrent, on charge encore. */
  clef: string;
  etat: Exclude<EtatJournal, 'CHARGEMENT'>;
  lignes: LigneAudit[];
  erreur: string | null;
}

async function interroger(filialeId: string | null, f: FiltresAudit): Promise<Omit<Resultat, 'clef'>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { etat: 'HORS_LIGNE', lignes: [], erreur: null };
  }
  let requete = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500);
  // Vue consolidée (directeur, aucune filiale choisie) : la politique de
  // sécurité du serveur décide seule de ce qui est visible.
  if (filialeId) requete = requete.or(`filiale_id.eq.${filialeId},filiale_id.is.null`);
  if (f.table) requete = requete.eq('table_cible', f.table);
  if (f.action) requete = requete.eq('action', f.action);
  if (f.utilisateurId) requete = requete.eq('utilisateur_id', f.utilisateurId);
  if (f.dateDebut) requete = requete.gte('created_at', new Date(`${f.dateDebut}T00:00:00`).toISOString());
  if (f.dateFin) requete = requete.lte('created_at', new Date(`${f.dateFin}T23:59:59.999`).toISOString());

  const { data, error } = await requete;
  if (error) return { etat: 'ERREUR', lignes: [], erreur: error.message };
  return { etat: 'PRET', lignes: (data ?? []) as LigneAudit[], erreur: null };
}

/**
 * Journal d'audit, lu **sur le serveur**.
 *
 * La table n'est plus synchronisée sur les postes (voir sync-streams.yaml) :
 * c'est le seul écran de l'application qui exige le réseau, et c'est assumé —
 * un journal de surveillance n'a pas à vivre sur la machine qu'il surveille.
 */
export function useJournalAudit(filialeId: string | null, filtres: FiltresAudit) {
  const [tour, setTour] = useState(0);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const clef = useMemo(() => JSON.stringify([filialeId, filtres, tour]), [filialeId, filtres, tour]);

  useEffect(() => {
    let vivant = true;
    void interroger(filialeId, filtres).then((r) => {
      if (vivant) setResultat({ ...r, clef });
    });
    return () => {
      vivant = false;
    };
    // `clef` résume les filtres : la requête ne repart que s'ils changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clef]);

  const recharger = useCallback(() => setTour((t) => t + 1), []);
  const aJour = resultat?.clef === clef;

  return {
    lignes: aJour ? resultat.lignes : [],
    etat: (aJour ? resultat.etat : 'CHARGEMENT') as EtatJournal,
    erreur: aJour ? resultat.erreur : null,
    recharger,
  };
}
