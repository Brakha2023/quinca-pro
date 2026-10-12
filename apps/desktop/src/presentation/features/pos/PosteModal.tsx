import { useState } from 'react';
import type { CaisseRow, DepotRow } from '@quinca/shared-types';
import { FORMATS_IMPRESSION, type FormatImpression } from '../../../core/ventes';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass } from '../../components/ui/FormField';

interface Props {
  caisses: CaisseRow[];
  depots: DepotRow[];
  caisseId?: string;
  depotId?: string;
  format: FormatImpression;
  onValider: (caisseId: string, depotId: string, format: FormatImpression) => void;
  onClose?: () => void;
}

/** Choix de la caisse et du dépôt de vente de ce poste (mémorisé sur la machine). */
export default function PosteModal({ caisses, depots, caisseId, depotId, format, onValider, onClose }: Props) {
  const [caisseChoisie, setCaisse] = useState(caisseId ?? '');
  const [depotChoisi, setDepot] = useState(depotId ?? '');
  const [formatChoisi, setFormat] = useState<FormatImpression>(format);
  // Les listes arrivent de façon asynchrone : on retombe sur le premier élément tant que rien n'est choisi.
  const caisse = caisses.some((c) => c.id === caisseChoisie) ? caisseChoisie : (caisses[0]?.id ?? '');
  const depot = depots.some((d) => d.id === depotChoisi) ? depotChoisi : (depots[0]?.id ?? '');
  const pret = Boolean(caisse && depot);

  return (
    <Modal
      titre="Réglages du poste de vente"
      sousTitre="Chaque vente sera enregistrée sur cette caisse et sortira du stock de ce dépôt."
      largeur="max-w-lg"
      onClose={onClose ?? (() => undefined)}
      pied={
        <button type="button" disabled={!pret} onClick={() => onValider(caisse, depot, formatChoisi)} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">
          Enregistrer
        </button>
      }
    >
      <div className="space-y-4">
        <FormField label="Caisse" obligatoire>
          <select value={caisse} onChange={(e) => setCaisse(e.target.value)} className={inputClass}>
            <option value="">— Choisir —</option>
            {caisses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.nom}</option>)}
          </select>
        </FormField>
        <FormField label="Dépôt de vente" obligatoire>
          <select value={depot} onChange={(e) => setDepot(e.target.value)} className={inputClass}>
            <option value="">— Choisir —</option>
            {depots.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.nom}</option>)}
          </select>
        </FormField>
        <FormField label="Impression par défaut des ventes">
          <select value={formatChoisi} onChange={(e) => setFormat(e.target.value as FormatImpression)} className={inputClass} data-testid="format-impression">
            {FORMATS_IMPRESSION.map((f) => <option key={f.id} value={f.id}>{f.label} — {f.aide}</option>)}
          </select>
          <p className="text-xs text-neutral-500 mt-1">Les deux formats restent proposés après chaque vente ; celui-ci est le bouton principal.</p>
        </FormField>
        {(caisses.length === 0 || depots.length === 0) && (
          <p className="text-sm text-red-600">Aucune caisse ou aucun dépôt actif dans cette filiale : créez-les d'abord (Catalogue → Dépôts).</p>
        )}
      </div>
    </Modal>
  );
}
