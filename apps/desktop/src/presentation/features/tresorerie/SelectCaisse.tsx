import type { Caisse } from '../../../core/tresorerie';
import FormField, { inputClass } from '../../components/ui/FormField';
import { formaterFcfa } from '../../hooks/useFormatage';

interface Props {
  caisses: Caisse[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  obligatoire?: boolean;
  /** Entrée « toutes les caisses » en tête (filtres) ; absente dans les formulaires. */
  vide?: string;
  avecSolde?: boolean;
  erreur?: string;
  testId?: string;
}

/** Choix d'une caisse de la filiale, avec son solde pour éviter une saisie à l'aveugle. */
export default function SelectCaisse({ caisses, value, onChange, label = 'Caisse', obligatoire = true, vide, avecSolde = true, erreur, testId = 'select-caisse' }: Props) {
  return (
    <FormField label={label} obligatoire={obligatoire} erreur={erreur}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} data-testid={testId}>
        {vide !== undefined && <option value="">{vide}</option>}
        {caisses.map((c) => (
          <option key={c.id} value={c.id}>{c.nom}{avecSolde ? ` (${formaterFcfa(c.solde_actuel)})` : ''}</option>
        ))}
      </select>
    </FormField>
  );
}
