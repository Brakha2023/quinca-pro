import { useQuery } from '@powersync/react';
import type { CaisseRow, DepotRow } from '@quinca/shared-types';
import { codePoste } from '../../../infrastructure/desktop/identitePoste';
import { usePosteStore } from '../../stores/poste.store';
import type { FormatImpression } from '../../../core/ventes';

const FORMATS: Array<{ code: FormatImpression; libelle: string; detail: string }> = [
  { code: 'TICKET', libelle: 'Ticket 80 mm', detail: 'Sur l’imprimante thermique du comptoir.' },
  { code: 'A4', libelle: 'Facture A4', detail: 'Sur l’imprimante bureautique.' },
];

interface Props {
  filialeId: string | null;
  filialeNom: string;
}

/**
 * Ce qui appartient à **cette machine-ci**, et ne se synchronise pas.
 *
 * La caisse, le dépôt de vente et l'imprimante sont des propriétés du poste,
 * pas de la filiale : deux caisses côte à côte n'ont ni le même tiroir ni la
 * même imprimante. Ces réglages restent donc en local, et c'est pour la même
 * raison qu'ils ne figurent pas dans la fiche de l'entreprise.
 */
export default function PreferencesPanel({ filialeId, filialeNom }: Props) {
  const { parFiliale, format, definir, definirFormat } = usePosteStore();
  const reglages = filialeId ? parFiliale[filialeId] : undefined;

  const { data: caisses } = useQuery<CaisseRow>(
    'SELECT * FROM caisses WHERE filiale_id = ? AND est_active != 0 ORDER BY nom', [filialeId ?? ''],
  );
  const { data: depots } = useQuery<DepotRow>(
    'SELECT * FROM depots WHERE filiale_id = ? AND est_actif != 0 ORDER BY nom', [filialeId ?? ''],
  );

  const choisir = (champ: 'caisseId' | 'depotId', valeur: string) => {
    if (!filialeId) return;
    definir(filialeId, {
      caisseId: champ === 'caisseId' ? valeur : reglages?.caisseId ?? '',
      depotId: champ === 'depotId' ? valeur : reglages?.depotId ?? '',
    });
  };

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Ces réglages ne quittent pas cette machine. Ils ne sont ni synchronisés, ni visibles des autres
        postes : ils décrivent le matériel posé sur ce comptoir.
      </p>

      <section className="rounded-xl border border-neutral-200 p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Identité du poste</h3>
        <p className="text-sm text-neutral-700">
          Code de ce poste : <strong className="font-mono" data-testid="preferences-code-poste">{codePoste()}</strong>
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Il préfixe les numéros de pièces créées ici. Collez-le sur l'unité centrale : il sert au dépannage.
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200 p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Poste de vente</h3>
        <p className="mb-4 text-xs text-neutral-500">La caisse et le dépôt dans lesquels ce poste travaille — {filialeNom}.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-700">Caisse</span>
            <select value={reglages?.caisseId ?? ''} onChange={(e) => choisir('caisseId', e.target.value)}
                    disabled={!filialeId}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50"
                    data-testid="preferences-caisse">
              <option value="">— à choisir —</option>
              {caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-700">Dépôt de vente</span>
            <select value={reglages?.depotId ?? ''} onChange={(e) => choisir('depotId', e.target.value)}
                    disabled={!filialeId}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50"
                    data-testid="preferences-depot">
              <option value="">— à choisir —</option>
              {depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Sortie papier par défaut</h3>
        <p className="mb-4 text-xs text-neutral-500">
          Après un encaissement, c'est le bouton principal. L'autre format reste accessible d'un clic.
        </p>
        <div className="space-y-2">
          {FORMATS.map((f) => (
            <label key={f.code} className="flex items-start gap-2.5">
              <input type="radio" name="format-poste" checked={format === f.code}
                     onChange={() => definirFormat(f.code)}
                     className="mt-0.5 h-4 w-4 border-neutral-300 text-primary-600 focus:ring-primary-500"
                     data-testid={`preferences-format-${f.code}`} />
              <span>
                <span className="text-sm font-medium text-neutral-800">{f.libelle}</span>
                <span className="block text-xs text-neutral-500">{f.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
