import type { ReactNode } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import Bouton from '../../components/ui/Bouton';
import FormField, { inputClass } from '../../components/ui/FormField';
import type { Depot } from '../../../core/articles';
import BonStockDocument from './BonStockDocument';
import { useBonStock } from './hooks';

export interface InfosFiliale {
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
}

/** Aperçu imprimable d'un bon déjà enregistré, retrouvé par sa référence. */
export function BonImprimable({ filialeId, filiale, reference, onClose }: { filialeId: string; filiale: InfosFiliale; reference: string; onClose: () => void }) {
  const bon = useBonStock(filialeId, reference);
  if (!bon) return null;
  return <BonStockDocument bon={bon} filiale={filiale} onClose={onClose} />;
}

/** Proposé après l'enregistrement : la pièce que le magasinier signe et classe. */
export function BoutonImprimerBon({ reference, onClick }: { reference: string; onClick: () => void }) {
  return (
    <Bouton onClick={onClick} icone={PrinterIcon} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white font-medium rounded-lg" data-testid="imprimer-bon">Imprimer le bon {reference}</Bouton>
  );
}

export function SelectDepot({ label, depots, value, onChange, erreur }: { label: string; depots: Depot[]; value: string; onChange: (id: string) => void; erreur?: string }) {
  return (
    <FormField label={label} obligatoire erreur={erreur}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">— Choisir —</option>
        {depots.map((d) => (
          <option key={d.id} value={d.id}>{d.code} · {d.nom}</option>
        ))}
      </select>
    </FormField>
  );
}

export function ChampsReferenceMotif({ reference, motif, onReference, onMotif, placeholderMotif = 'Motif / commentaire' }: { reference: string; motif: string; onReference: (v: string) => void; onMotif: (v: string) => void; placeholderMotif?: string }) {
  return (
    <>
      <FormField label="Référence (bon, BL…)">
        <input value={reference} onChange={(e) => onReference(e.target.value)} placeholder="Générée automatiquement si vide" className={`${inputClass} font-mono`} maxLength={40} />
      </FormField>
      <FormField label="Motif">
        <input value={motif} onChange={(e) => onMotif(e.target.value)} placeholder={placeholderMotif} className={inputClass} maxLength={200} />
      </FormField>
    </>
  );
}

/** Les deux faces d'un onglet de stock : ce qu'on saisit, et ce qui a déjà été saisi. */
export type VueOnglet = 'saisie' | 'historique';

/**
 * Bascule entre la saisie et l'historique.
 *
 * Tous les onglets du menu Stock portent la même, au même endroit : un
 * magasinier qui apprend le geste sur un onglet le retrouve sur les autres.
 */
export function BasculeVue({ vue, onChange }: { vue: VueOnglet; onChange: (v: VueOnglet) => void }) {
  const bouton = (v: VueOnglet, label: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      aria-pressed={vue === v}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg ${vue === v ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
      data-testid={`vue-${v}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-1 bg-neutral-50 border border-neutral-200 rounded-lg p-1 shrink-0 print:hidden">
      {bouton('saisie', 'Saisie')}
      {bouton('historique', 'Historique')}
    </div>
  );
}

export function CarteBon({ titre, description, children, actions, bascule }: {
  titre: string;
  description: string;
  children: ReactNode;
  /** Barre de validation en pied ; absente, le pied ne s'affiche pas (historique). */
  actions?: ReactNode;
  bascule?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{titre}</h2>
          <p className="text-sm text-neutral-500">{description}</p>
        </div>
        {bascule}
      </div>
      {children}
      {actions && <div className="flex justify-end gap-3 pt-2 border-t border-neutral-200">{actions}</div>}
    </div>
  );
}

export const boutonPrimaire = 'px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg';
export const boutonSecondaire = 'px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg';
