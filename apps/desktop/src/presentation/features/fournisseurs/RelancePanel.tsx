import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardDocumentIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { composerRelance, type Fournisseur } from '../../../core/fournisseurs';
import { lienMailto, ouvrirLien } from '../../../infrastructure/desktop/ouvrirLien';
import FormField, { inputClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import SelectFournisseur from './SelectFournisseur';
import { useCommandes, useFournisseur, type CommandeVueRow } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; telephone?: string | null };
}

/** Éditeur de relance pour un fournisseur donné (remonté à chaque changement de fournisseur via `key`). */
function RelanceEditeur({ filialeId, filiale, fournisseur }: Props & { fournisseur: Fournisseur }) {
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const { commandes } = useCommandes(filialeId, { fournisseurId: fournisseur.id, ouvertesSeulement: true });
  // Toutes les commandes ouvertes sont relancées, sauf celles décochées.
  const [exclues, setExclues] = useState<Set<string>>(new Set());
  // Texte retouché à la main ; null = recomposé automatiquement.
  const [edition, setEdition] = useState<{ objet: string; corps: string } | null>(null);

  const retenues = useMemo(() => commandes.filter((c: CommandeVueRow) => !exclues.has(c.id)), [commandes, exclues]);
  const compose = useMemo(
    () => composerRelance(
      { filiale, fournisseur, commandesEnAttente: retenues.map((c) => ({ numero: c.numero ?? '', date_commande: c.date_commande ?? '', date_livraison_prevue: c.date_livraison_prevue, total_ttc: c.total_ttc ?? 0 })), signataire: utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom}`.trim() : '' },
      formaterFcfa, formaterDate,
    ),
    [filiale, fournisseur, retenues, utilisateur],
  );
  const objet = edition?.objet ?? compose.objet;
  const corps = edition?.corps ?? compose.corps;

  const envoyer = async () => {
    if (!fournisseur.email) { notifier('erreur', 'Ce fournisseur n’a pas d’adresse e-mail : renseignez-la dans sa fiche.'); return; }
    try { await ouvrirLien(lienMailto(fournisseur.email, objet, corps)); notifier('info', 'Messagerie ouverte avec la relance pré-remplie.'); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Impossible d’ouvrir la messagerie.'); }
  };

  const copier = async () => {
    try { await navigator.clipboard.writeText(`Objet : ${objet}\n\n${corps}`); notifier('succes', 'Relance copiée dans le presse-papiers.'); }
    catch { notifier('erreur', 'Copie impossible.'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800">Commandes en attente de livraison</h3>
        {commandes.length === 0 && <p className="text-sm text-neutral-400">Aucune commande ouverte.</p>}
        {commandes.map((c) => (
          <label key={c.id} className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded mt-0.5" checked={!exclues.has(c.id)} onChange={(e) => { setExclues((s) => { const n = new Set(s); if (e.target.checked) n.delete(c.id); else n.add(c.id); return n; }); setEdition(null); }} />
            <span><span className="font-mono">{c.numero}</span> du {formaterDate(c.date_commande)}{c.date_livraison_prevue ? ` · prévue le ${formaterDate(c.date_livraison_prevue)}` : ''} · <span className="font-mono">{formaterFcfa(c.total_ttc)}</span></span>
          </label>
        ))}
        {fournisseur.solde_actuel < 0 && <p className="text-sm text-blue-700 bg-blue-50 rounded-lg p-2">Avoir de {formaterFcfa(-fournisseur.solde_actuel)} en notre faveur : mentionné dans la relance.</p>}
      </div>
      <div className="lg:col-span-3 bg-white rounded-xl border border-neutral-200 shadow-sm p-4 space-y-3">
        <FormField label="Objet"><input value={objet} onChange={(e) => setEdition({ objet: e.target.value, corps })} className={inputClass} /></FormField>
        <FormField label="Message"><textarea rows={12} value={corps} onChange={(e) => setEdition({ objet, corps: e.target.value })} className={`${inputClass} font-mono text-xs`} /></FormField>
        <div className="flex justify-end gap-2">
          {edition && <button type="button" onClick={() => setEdition(null)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 font-medium rounded-lg">Recomposer</button>}
          <button type="button" onClick={copier} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><ClipboardDocumentIcon className="w-5 h-5" /> Copier</button>
          <button type="button" onClick={envoyer} disabled={!fournisseur.email} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><EnvelopeIcon className="w-5 h-5" /> Envoyer par e-mail</button>
        </div>
      </div>
    </div>
  );
}

/** Relance d'un fournisseur par e-mail : commandes en attente de livraison et avoir éventuel, texte modifiable, envoi via la messagerie du poste. */
export default function RelancePanel({ filialeId, filiale }: Props) {
  const [params, setParams] = useSearchParams();
  const fournisseurId = params.get('id') ?? '';
  const fournisseur = useFournisseur(fournisseurId || null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <SelectFournisseur filialeId={filialeId} value={fournisseurId} onChange={(id) => setParams(id ? { id } : {})} />
        {fournisseur && (
          <div className="md:col-span-2 text-sm text-neutral-600">
            {fournisseur.email ? <>Destinataire : <strong>{fournisseur.email}</strong>{fournisseur.interlocuteur ? ` (${fournisseur.interlocuteur})` : ''}</> : <span className="text-red-600">Aucune adresse e-mail sur la fiche.</span>}
            {' · '}Solde : <strong className={fournisseur.solde_actuel < 0 ? 'text-blue-700' : fournisseur.solde_actuel > 0 ? 'text-red-600' : ''}>{formaterFcfa(fournisseur.solde_actuel)}</strong>
          </div>
        )}
      </div>
      {fournisseur
        ? <RelanceEditeur key={fournisseur.id} filialeId={filialeId} filiale={filiale} fournisseur={fournisseur} />
        : <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">Choisissez le fournisseur à relancer.</div>}
    </div>
  );
}
