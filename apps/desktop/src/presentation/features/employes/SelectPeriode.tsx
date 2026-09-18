import FormField, { inputClass } from '../../components/ui/FormField';

/** Sélecteur de mois de paie (AAAA-MM). */
export default function SelectPeriode({ value, onChange }: { value: string; onChange: (p: string) => void }) {
  return <FormField label="Mois de paie"><input type="month" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} data-testid="periode-paie" /></FormField>;
}

