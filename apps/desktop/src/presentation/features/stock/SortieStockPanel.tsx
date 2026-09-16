import { useState } from 'react';
import { sortieStockSchema } from '../../../core/stock';
import { StockRepository } from '../../../infrastructure/powersync/repositories/StockRepository';
import FormField, { inputClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from '../articles/hooks';
import { CarteBon, ChampsReferenceMotif, SelectDepot, boutonPrimaire, boutonSecondaire } from './EnteteBon';
import LignesBonEditor, { type LigneBonUI } from './LignesBonEditor';
import { useContexteMouvement } from './useContexteMouvement';

export default function SortieStockPanel({ filialeId }: { filialeId: string }) {
  const repository = useRepository(StockRepository);
  const notifier = useNotifier();
  const ctx = useContexteMouvement(filialeId);
  const { depots } = useDepots(filialeId, { actifs: true });

  const [depotId, setDepotId] = useState('');
  const [type, setType] = useState<'SORTIE_DESTOCKAGE' | 'CASSE'>('SORTIE_DESTOCKAGE');
  const [reference, setReference] = useState('');
  const [motif, setMotif] = useState('');
  const [lignes, setLignes] = useState<LigneBonUI[]>([]);
  const [enCours, setEnCours] = useState(false);
  const depotEffectif = depotId || depots[0]?.id || '';

  const reinitialiser = () => { setLignes([]); setReference(''); setMotif(''); };

  const valider = async () => {
    const parsed = sortieStockSchema.safeParse({
      depot_id: depotEffectif, type, reference, motif,
      lignes: lignes.map((l) => ({ article_id: l.article.id, quantite: l.quantite })),
    });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    setEnCours(true);
    try {
      const ref = await repository.enregistrerSortie(ctx, parsed.data);
      notifier('succes', `Sortie ${ref} enregistrée (${parsed.data.lignes.length} ligne(s)).`);
      reinitialiser();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <CarteBon
      titre="Sortie de stock"
      description="Déstockage (usage interne, don, échantillon) ou casse. Le disponible du dépôt est contrôlé : aucun bon n'est enregistré partiellement."
      actions={
        <>
          <button type="button" onClick={reinitialiser} className={boutonSecondaire} disabled={lignes.length === 0}>Vider</button>
          <button type="button" onClick={valider} className={boutonPrimaire} disabled={enCours || lignes.length === 0}>Valider la sortie</button>
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SelectDepot label="Dépôt" depots={depots} value={depotEffectif} onChange={setDepotId} />
        <FormField label="Type" obligatoire>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputClass}>
            <option value="SORTIE_DESTOCKAGE">Déstockage</option>
            <option value="CASSE">Casse / perte</option>
          </select>
        </FormField>
        <ChampsReferenceMotif reference={reference} motif={motif} onReference={setReference} onMotif={setMotif} placeholderMotif="Service, raison…" />
      </div>
      <LignesBonEditor filialeId={filialeId} depotId={depotEffectif} lignes={lignes} onChange={setLignes} controlerDisponible />
    </CarteBon>
  );
}
