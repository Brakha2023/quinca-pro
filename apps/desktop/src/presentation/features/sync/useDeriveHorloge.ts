import { useCallback, useEffect, useState } from 'react';
import { avertissementHorloge, type AvertissementHorloge, type MesureHorloge } from '../../../core/sync';
import {
  derniereMesureHorloge,
  oublierMesureHorloge,
  surChangementHorloge,
} from '../../../infrastructure/supabase/horlogeServeur';

/** Dérive de l'horloge du poste, et ce qu'il faut en dire. */
export function useDeriveHorloge(): {
  mesure: MesureHorloge | null;
  avertissement: AvertissementHorloge | null;
  horlogeReglee: () => void;
} {
  const [mesure, setMesure] = useState<MesureHorloge | null>(derniereMesureHorloge);

  useEffect(() => surChangementHorloge(() => setMesure(derniereMesureHorloge())), []);

  const horlogeReglee = useCallback(() => oublierMesureHorloge(), []);

  return { mesure, avertissement: avertissementHorloge(mesure), horlogeReglee };
}
