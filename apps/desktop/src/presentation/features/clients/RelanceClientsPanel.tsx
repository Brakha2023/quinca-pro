import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardDocumentIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { composerRelanceClient, echeanceFacture, type Client } from '../../../core/clients';
import { lienMailto, ouvrirLien } from '../../../infrastructure/desktop/ouvrirLien';
import FormField, { inputClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useClient, useClients, useFacturesClient } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; telephone?: string | null };
}

/** Éditeur de relance d'un client (remonté à chaque changement de client via `key`). */
function RelanceEditeur({ filiale, client }: { filiale: Props['filiale']; client: Client }) {
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const { factures } = useFacturesClient(client.id);
  const impayees = useMemo(() => factures.filter((f) => f.statut !== 'ANNULEE' && f.reste_a_payer > 0), [factures]);
  const [exclues, setExclues] = useState<Set<string>>(new Set());
  const [edition, setEdition] = useState<{ objet: string; corps: string } | null>(null);
  const retenues = impayees.filter((f) => !exclues.has(f.id));
  // Date de référence figée à l'ouverture de l'éditeur (le rendu doit rester pur).
  const [aujourdhui] = useState(() => Date.now());
  const retards = useMemo(() => new Map(impayees.map((f) => [f.id, Math.floor((aujourdhui - echeanceFacture(f.date_vente, client.periode_reglement).getTime()) / 86_400_000)])), [impayees, client.periode_reglement, aujourdhui]);
  const compose = useMemo(
    () => composerRelanceClient({ filiale, client, facturesImpayees: retenues, signataire: utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom}`.trim() : '' }, formaterFcfa, formaterDate),
    [filiale, client, retenues, utilisateur],
  );
  const objet = edition?.objet ?? compose.objet;
  const corps = edition?.corps ?? compose.corps;

  const envoyer = async () => {
    if (!client.email) { notifier('erreur', 'Ce client n’a pas d’adresse e-mail : renseignez-la dans sa fiche.'); return; }
    try { await ouvrirLien(lienMailto(client.email, objet, corps)); notifier('info', 'Messagerie ouverte avec la relance pré-remplie.'); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Impossible d’ouvrir la messagerie.'); }
  };
  const copier = async () => {
    try { await navigator.clipboard.writeText(`Objet : ${objet}\n\n${corps}`); notifier('succes', 'Relance copiée dans le presse-papiers.'); }
    catch { notifier('erreur', 'Copie impossible.'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Factures impayées · solde {formaterFcfa(client.solde_actuel)}</h3>
        {impayees.length === 0 && <p className="text-sm text-neutral-400">Aucune facture avec reste à payer (le solde vient du solde d'ouverture).</p>}
        {impayees.map((f) => {
          const retard = retards.get(f.id) ?? 0;
          return (
            <label key={f.id} className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded mt-0.5" checked={!exclues.has(f.id)} onChange={(e) => { setExclues((s) => { const n = new Set(s); if (e.target.checked) n.delete(f.id); else n.add(f.id); return n; }); setEdition(null); }} />
              <span><span className="font-mono">{f.numero}</span> du {formaterDate(f.date_vente)} · reste <span className="font-mono text-red-600">{formaterFcfa(f.reste_a_payer)}</span>{retard > 0 && <span className="ml-1 text-xs text-orange-700">(échue depuis {retard} j)</span>}</span>
            </label>
          );
        })}
      </div>
      <div className="lg:col-span-3 bg-white rounded-xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <FormField label="Objet"><input value={objet} onChange={(e) => setEdition({ objet: e.target.value, corps })} className={inputClass} /></FormField>
        <FormField label="Message"><textarea rows={12} value={corps} onChange={(e) => setEdition({ objet, corps: e.target.value })} className={`${inputClass} font-mono text-xs`} /></FormField>
        <div className="flex justify-end gap-2">
          {edition && <button type="button" onClick={() => setEdition(null)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 font-medium rounded-lg">Recomposer</button>}
          <button type="button" onClick={copier} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><ClipboardDocumentIcon className="w-5 h-5" /> Copier</button>
          <button type="button" onClick={envoyer} disabled={!client.email} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><EnvelopeIcon className="w-5 h-5" /> Envoyer par e-mail</button>
        </div>
      </div>
    </div>
  );
}

/** Relance des clients en créance : liste des débiteurs, e-mail composé à partir des factures impayées, envoi via la messagerie du poste. */
export default function RelanceClientsPanel({ filialeId, filiale }: Props) {
  const [params, setParams] = useSearchParams();
  const clientId = params.get('id') ?? '';
  const client = useClient(clientId || null);
  const { clients: debiteurs } = useClients(filialeId, { avecCreance: true });
  const totalCreances = debiteurs.reduce((s, c) => s + c.solde_actuel, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200"><p className="text-sm font-semibold text-neutral-800">Clients en créance</p><p className="text-xs text-neutral-500">{debiteurs.length} client(s) · {formaterFcfa(totalCreances)}</p></div>
        <ul className="divide-y divide-neutral-100 max-h-[32rem] overflow-y-auto" data-testid="liste-debiteurs">
          {debiteurs.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setParams({ id: c.id })} className={`w-full text-left px-4 py-2.5 hover:bg-neutral-50 ${c.id === clientId ? 'bg-primary-50' : ''}`}>
                <p className="text-sm font-medium text-neutral-900 flex justify-between gap-2"><span className="truncate">{c.raison_sociale}</span><span className="font-mono text-red-600 shrink-0">{formaterFcfa(c.solde_actuel)}</span></p>
                <p className="text-xs text-neutral-500">{c.email ?? <span className="text-orange-600">sans e-mail</span>}</p>
              </button>
            </li>
          ))}
          {debiteurs.length === 0 && <li className="px-4 py-8 text-center text-sm text-neutral-400">Aucune créance en cours.</li>}
        </ul>
      </div>
      <div className="lg:col-span-3">
        {client
          ? <RelanceEditeur key={client.id} filiale={filiale} client={client} />
          : <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">Choisissez un client à relancer dans la liste.</div>}
      </div>
    </div>
  );
}
