import FormField, { inputClass } from '../../components/ui/FormField';
import { useFournisseurs } from './hooks';

/** Choix d'un fournisseur actif de la filiale (sections Compte, Commandes, Relance). */
export default function SelectFournisseur({ filialeId, value, onChange, label = 'Fournisseur', avecEmailSeulement = false, obligatoire = true, aide }: { filialeId: string; value: string; onChange: (id: string) => void; label?: string; avecEmailSeulement?: boolean; obligatoire?: boolean; aide?: string }) {
  const { fournisseurs } = useFournisseurs(filialeId);
  const liste = avecEmailSeulement ? fournisseurs.filter((f) => f.email) : fournisseurs;
  return (
    <FormField label={label} obligatoire={obligatoire} aide={aide}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} data-testid="select-fournisseur">
        <option value="">{obligatoire ? '— Choisir un fournisseur —' : '— Aucun —'}</option>
        {liste.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.raison_sociale}{f.solde_actuel !== 0 ? ` (${f.solde_actuel > 0 ? 'dette' : 'avoir'} ${Math.abs(f.solde_actuel).toLocaleString('fr-FR')} F)` : ''}</option>)}
      </select>
    </FormField>
  );
}
