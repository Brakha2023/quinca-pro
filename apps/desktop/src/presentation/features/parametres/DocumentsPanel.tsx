import { useState } from 'react';
import {
  FORMATS_PAPIER, NATURES_DOCUMENTS, enteteDocument, reglagesDocumentsParDefaut,
  type Entreprise, type FormatPapier, type ReglageDocument, type ReglagesDocuments,
} from '../../../core/parametres';
import { EntrepriseRepository } from '../../../infrastructure/powersync/repositories/EntrepriseRepository';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

const LIBELLE_FORMAT: Record<FormatPapier, string> = { A4: 'A4', A5: 'A5', TICKET: 'Ticket 80 mm' };

interface Props {
  entreprise: Entreprise;
  peutModifier: boolean;
}

/**
 * Réglage des pièces imprimées, nature par nature.
 *
 * Chaque case change l'aperçu tout de suite : un réglage d'impression ne se
 * juge pas sur son libellé, il se regarde.
 */
export default function DocumentsPanel({ entreprise, peutModifier }: Props) {
  const repository = useRepository(EntrepriseRepository);
  const notifier = useNotifier();
  const [reglages, setReglages] = useState<ReglagesDocuments>(entreprise.documents);
  const [nature, setNature] = useState<string>(NATURES_DOCUMENTS[0]!.id);
  const [enCours, setEnCours] = useState(false);

  const modifie = JSON.stringify(reglages) !== JSON.stringify(entreprise.documents);
  const courant = reglages[nature] ?? reglagesDocumentsParDefaut()[nature]!;

  const changer = (id: string, patch: Partial<ReglageDocument>) =>
    setReglages((r) => ({ ...r, [id]: { ...r[id]!, ...patch } }));

  const enregistrer = async () => {
    setEnCours(true);
    try {
      await repository.enregistrerDocuments(entreprise.id, reglages);
      notifier('succes', 'Réglages d’impression enregistrés.');
    } catch (erreur) {
      notifier('erreur', erreur instanceof Error ? erreur.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr,320px]">
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {NATURES_DOCUMENTS.map((n) => {
            const r = reglages[n.id] ?? reglagesDocumentsParDefaut()[n.id]!;
            const actif = n.id === nature;
            return (
              <section
                key={n.id}
                onFocus={() => setNature(n.id)}
                onClick={() => setNature(n.id)}
                className={`cursor-pointer rounded-xl border p-4 transition-colors ${actif ? 'border-primary-400 bg-primary-50/40' : 'border-neutral-200 hover:border-neutral-300'}`}
                data-testid={`document-${n.id}`}
              >
                <p className="text-sm font-semibold text-neutral-800">{n.libelle}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{n.detail}</p>

                <fieldset className="mt-3" disabled={!peutModifier}>
                  <legend className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Format</legend>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {FORMATS_PAPIER.filter((f) => n.formats.includes(f)).map((f) => (
                      <label key={f} className="flex items-center gap-1.5 text-xs text-neutral-700">
                        <input type="radio" name={`format-${n.id}`} checked={r.format === f}
                               onChange={() => changer(n.id, { format: f })}
                               className="h-3.5 w-3.5 border-neutral-300 text-primary-600 focus:ring-primary-500"
                               data-testid={`format-${n.id}-${f}`} />
                        {LIBELLE_FORMAT[f]}
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <Case libelle="Noir & blanc" coche={r.noir_blanc} testid={`nb-${n.id}`}
                          onChange={(v) => changer(n.id, { noir_blanc: v })} />
                    <Case libelle="Logo en en-tête" coche={r.logo_entete} testid={`entete-${n.id}`}
                          onChange={(v) => changer(n.id, { logo_entete: v })} />
                    <Case libelle="Logo en filigrane" coche={r.logo_filigrane} testid={`filigrane-${n.id}`}
                          onChange={(v) => changer(n.id, { logo_filigrane: v })} />
                  </div>
                </fieldset>
              </section>
            );
          })}
        </div>

        <Apercu entreprise={entreprise} reglage={courant}
                nature={NATURES_DOCUMENTS.find((n) => n.id === nature)!.libelle} />
      </div>

      {peutModifier && (
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
          {modifie && <span className="text-xs text-amber-700">Modifications non enregistrées.</span>}
          <button type="button" onClick={() => setReglages(reglagesDocumentsParDefaut())}
                  className="rounded-lg px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-100">
            Revenir aux réglages livrés
          </button>
          <button type="button" onClick={() => void enregistrer()} disabled={enCours || !modifie}
                  data-testid="enregistrer-documents"
                  className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-neutral-300">
            {enCours ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      )}
    </div>
  );
}

function Case({ libelle, coche, onChange, testid }: { libelle: string; coche: boolean; onChange: (v: boolean) => void; testid: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-neutral-700">
      <input type="checkbox" checked={coche} onChange={(e) => onChange(e.target.checked)}
             className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
             data-testid={testid} />
      {libelle}
    </label>
  );
}

/** Aperçu de l'en-tête tel qu'il sortira : logo, identité, identifiants fiscaux. */
function Apercu({ entreprise, reglage, nature }: { entreprise: Entreprise; reglage: ReglageDocument; nature: string }) {
  const entete = enteteDocument(entreprise, null, reglage);
  const etroit = reglage.format === 'TICKET';
  return (
    <aside className="rounded-xl border border-neutral-200 bg-neutral-50 p-4" data-testid="apercu-document">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Aperçu — {nature}</p>
      <div className={`relative mx-auto overflow-hidden bg-white p-4 shadow-sm ring-1 ring-neutral-200 ${etroit ? 'max-w-[220px]' : ''} ${reglage.noir_blanc ? 'grayscale' : ''}`}>
        {entete.filigrane && (
          <img src={entete.filigrane} alt="" aria-hidden
               className="pointer-events-none absolute inset-0 m-auto max-h-24 max-w-[70%] object-contain opacity-10" />
        )}
        <div className={`relative flex items-start gap-3 ${etroit ? 'flex-col items-center text-center' : ''}`}>
          {entete.logo
            ? <img src={entete.logo} alt="" className="max-h-10 max-w-[90px] object-contain" />
            : <span className="rounded bg-neutral-800 px-2 py-1 text-[11px] font-bold text-white">{entete.initiales}</span>}
          <div className={`min-w-0 text-[10px] leading-tight text-neutral-600 ${etroit ? '' : 'text-right ml-auto'}`}>
            <p className="text-[11px] font-bold text-neutral-900">{entete.nom || '—'}</p>
            {entete.adresse && <p className="truncate">{entete.adresse}</p>}
            {entete.telephone && <p>Tél. {entete.telephone}</p>}
            {entete.identifiants && <p className="truncate">{entete.identifiants}</p>}
          </div>
        </div>
        <div className="relative mt-3 border-y border-neutral-200 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-neutral-800">
          {nature}
        </div>
        <div className="relative mt-3 space-y-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-2">
              <span className="h-1.5 flex-1 rounded bg-neutral-100" />
              <span className="h-1.5 w-8 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
        {entete.mentions_legales && (
          <p className="relative mt-3 border-t border-neutral-100 pt-2 text-[8px] leading-snug text-neutral-400">
            {entete.mentions_legales}
          </p>
        )}
      </div>
      <p className="mt-3 text-[11px] text-neutral-500">
        {LIBELLE_FORMAT[reglage.format]}
        {reglage.noir_blanc && ' · sans couleur'}
        {!reglage.logo_entete && ' · sans logo'}
        {reglage.logo_filigrane && ' · filigrane'}
      </p>
    </aside>
  );
}
