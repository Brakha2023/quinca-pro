import FormField, { inputClass } from '../../components/ui/FormField';
import { useClients } from './hooks';

/** Choix d'un client en compte de la filiale (sections Compte, Versements, Relance, Proforma). */
export default function SelectClient({ filialeId, value, onChange, label = 'Client', obligatoire = true, avecCreanceSeulement = false, avecEmailSeulement = false, vide = '— Choisir un client —' }: { filialeId: string; value: string; onChange: (id: string) => void; label?: string; obligatoire?: boolean; avecCreanceSeulement?: boolean; avecEmailSeulement?: boolean; vide?: string }) {
  const { clients } = useClients(filialeId, { avecCreance: avecCreanceSeulement, avecEmail: avecEmailSeulement });
  return (
    <FormField label={label} obligatoire={obligatoire}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} data-testid="select-client">
        <option value="">{vide}</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.raison_sociale}{c.solde_actuel !== 0 ? ` (${c.solde_actuel > 0 ? 'doit' : 'avoir'} ${Math.abs(c.solde_actuel).toLocaleString('fr-FR')} F)` : ''}</option>)}
      </select>
    </FormField>
  );
}
