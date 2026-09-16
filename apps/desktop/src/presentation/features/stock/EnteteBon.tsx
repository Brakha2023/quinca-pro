import type { ReactNode } from 'react';
import FormField, { inputClass } from '../../components/ui/FormField';
import type { Depot } from '../../../core/articles';

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

export function CarteBon({ titre, description, children, actions }: { titre: string; description: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{titre}</h2>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      {children}
      <div className="flex justify-end gap-3 pt-2 border-t border-neutral-200">{actions}</div>
    </div>
  );
}

export const boutonPrimaire = 'px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg';
export const boutonSecondaire = 'px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg';
