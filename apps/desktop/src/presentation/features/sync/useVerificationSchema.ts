import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStatus } from '@powersync/react';
import {
  FLUX_ATTENDUS,
  desaccordSchema,
  fluxManquants,
  type DesaccordSchema,
  type VerdictTable,
} from '../../../core/sync';
import { verifierSchemaServeur } from '../../../infrastructure/supabase/schemaServeur';

/**
 * Une seule vérification par session : le schéma ne change pas pendant qu'on
 * travaille, et trente sondes à chaque écran n'apprendraient rien de plus.
 */
let enCours: Promise<VerdictTable[]> | null = null;

function verifierUneFois(): Promise<VerdictTable[]> {
  enCours ??= verifierSchemaServeur().catch((e) => {
    enCours = null; // réseau coupé en plein contrôle : on retentera
    throw e;
  });
  return enCours;
}

/**
 * Contrôle d'accord entre le poste et le serveur, au démarrage.
 *
 * Volet colonnes : sondé sur Supabase. Volet flux : lu dans l'état de
 * synchronisation, qui le porte déjà — mais seulement une fois la première
 * synchronisation faite, sinon la liste est vide et tout paraîtrait manquant.
 */
export function useVerificationSchema(): { desaccord: DesaccordSchema | null; verifie: boolean; reverifier: () => void } {
  const statut = useStatus();
  const [verdicts, setVerdicts] = useState<VerdictTable[] | null>(null);
  const [tour, setTour] = useState(0);
  const horsLigne = typeof navigator !== 'undefined' && navigator.onLine === false;

  useEffect(() => {
    if (horsLigne) return;
    let vivant = true;
    void verifierUneFois()
      .then((r) => { if (vivant) setVerdicts(r); })
      .catch(() => { if (vivant) setVerdicts(null); });
    return () => { vivant = false; };
  }, [horsLigne, tour]);

  const flux = useMemo(() => {
    // Avant la première synchronisation, le service n'a pas encore dit quels
    // flux il sert : ne rien conclure plutôt que crier au loup.
    if (!statut.connected || !statut.hasSynced || !statut.syncStreams) return [];
    return fluxManquants(FLUX_ATTENDUS, statut.syncStreams.map((s) => s.subscription.name));
  }, [statut.connected, statut.hasSynced, statut.syncStreams]);

  /*
   * On garde le verdict précédent : un désaccord de schéma ne disparaît pas
   * parce que le réseau a disparu. Il sera remplacé quand le serveur répondra.
   */
  const reverifier = useCallback(() => {
    enCours = null;
    setTour((t) => t + 1);
  }, []);

  return {
    desaccord: verdicts ? desaccordSchema(verdicts, flux) : null,
    verifie: verdicts !== null,
    reverifier,
  };
}
