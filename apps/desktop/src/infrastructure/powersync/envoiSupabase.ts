import { UpdateType, type CrudEntry } from '@powersync/web';
import type { OperationEnvoi } from '../../core/sync';
import { supabase } from '../supabase/client';
import { sansCumulsServeur } from './cumulsServeur';

/**
 * Une opération de la file d'envoi, réduite à ce qu'il faut pour la rejouer.
 * Mise de côté, elle survit au redémarrage du poste : on la reconstruit depuis
 * la table locale, d'où cette forme indépendante de `CrudEntry`.
 */
export interface OperationAEnvoyer {
  table: string;
  id: string;
  operation: OperationEnvoi;
  donnees: Record<string, unknown> | null;
}

export function operationDepuisCrud(op: CrudEntry): OperationAEnvoyer {
  return { table: op.table, id: op.id, operation: op.op as OperationEnvoi, donnees: op.opData ?? null };
}

/** Envoie une opération à Supabase. Lève l'erreur PostgREST telle quelle. */
export async function appliquerOperation(op: OperationAEnvoyer): Promise<void> {
  const table = supabase.from(op.table);

  switch (op.operation) {
    case UpdateType.PUT: {
      const donnees = sansCumulsServeur(op.table, op.donnees ?? {});
      // La ligne doit exister côté serveur pour garder l'identifiant du poste,
      // même si elle ne porte plus que sa clé : le déclencheur fera le reste.
      const { error } = await table.upsert({ ...(donnees ?? {}), id: op.id });
      if (error) throw error;
      return;
    }
    case UpdateType.PATCH: {
      const donnees = sansCumulsServeur(op.table, op.donnees ?? {});
      if (!donnees) return; // n'envoyait qu'un cumul : le journal suffit au serveur
      const { error } = await table.update(donnees).eq('id', op.id);
      if (error) throw error;
      return;
    }
    case UpdateType.DELETE: {
      const { error } = await table.delete().eq('id', op.id);
      if (error) throw error;
      return;
    }
  }
}
