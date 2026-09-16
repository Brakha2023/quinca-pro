import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  erreur?: string;
  obligatoire?: boolean;
  children: ReactNode;
  className?: string;
}

/** Libellé + contrôle + message d'erreur, mise en forme homogène des formulaires. */
export default function FormField({ label, erreur, obligatoire, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-neutral-700 mb-1">
        {label}
        {obligatoire && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {erreur && <p className="text-xs text-red-600 mt-1">{erreur}</p>}
    </div>
  );
}

const controleBase =
  'px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50';
/** Contrôle de formulaire pleine largeur (dans un FormField). */
export const inputClass = `w-full ${controleBase}`;
/** Contrôle en ligne dans une barre d'outils (largeur naturelle). */
export const controleInlineClass = controleBase;
export const inputErrorClass = 'border-red-400 focus:ring-red-400';
