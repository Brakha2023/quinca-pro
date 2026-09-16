import { useState } from 'react';
import { entreeStockSchema } from '../../../core/stock';
import { StockRepository } from '../../../infrastructure/powersync/repositories/StockRepository';
import FormField, { inputClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from '../articles/hooks';
import { CarteBon, ChampsReferenceMotif, SelectDepot, boutonPrimaire, boutonSecondaire } from './EnteteBon';
import LignesBonEditor, { type LigneBonUI } from './LignesBonEditor';
import { useContexteMouvement } from './useContexteMouvement';

export default function EntreeStockPanel({ filialeId }: { filialeId: string }) {
  const repository = useRepository(StockRepository);
  const notifier = useNotifier();
  const ctx = useContexteMouvement(filialeId);
  const { depots } = useDepots(filialeId, { actifs: true });

  const [depotId, setDepotId] = useState('');
  const [type, setType] = useState<'ENTREE_ACHAT' | 'RETOUR_CLIENT'>('ENTREE_ACHAT');
  const [reference, setReference] = useState('');
  const [motif, setMotif] = useState('');
  const [lignes, setLignes] = useState<LigneBonUI[]>([]);
  const [enCours, setEnCours] = useState(false);
  const depotEffectif = depotId || depots[0]?.id || '';

  const reinitialiser = () => { setLignes([]); setReference(''); setMotif(''); };

  const valider = async () => {
    const parsed = entreeStockSchema.safeParse({
      depot_id: depotEffectif, type, reference, motif,
      lignes: lignes.map((l) => ({ article_id: l.article.id, quantite: l.quantite, cout_unitaire: l.cout_unitaire })),
    });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    setEnCours(true);
    try {
      const ref = await repository.enregistrerEntree(ctx, parsed.data);
      notifier('succes', `Entrée ${ref} enregistrée (${parsed.data.lignes.length} ligne(s)).`);
      reinitialiser();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <CarteBon
      titre="Entrée en stock"
      description="Réception d'achat ou retour client. Le coût moyen des articles est recalculé à partir du coût unitaire saisi."
      actions={
        <>
          <button type="button" onClick={reinitialiser} className={boutonSecondaire} disabled={lignes.length === 0}>Vider</button>
          <button type="button" onClick={valider} className={boutonPrimaire} disabled={enCours || lignes.length === 0}>Valider l'entrée</button>
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SelectDepot label="Dépôt" depots={depots} value={depotEffectif} onChange={setDepotId} />
        <FormField label="Type" obligatoire>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputClass}>
            <option value="ENTREE_ACHAT">Achat fournisseur</option>
            <option value="RETOUR_CLIENT">Retour client</option>
          </select>
        </FormField>
        <ChampsReferenceMotif reference={reference} motif={motif} onReference={setReference} onMotif={setMotif} placeholderMotif="Fournisseur, n° BL…" />
      </div>
      <LignesBonEditor filialeId={filialeId} depotId={depotEffectif} lignes={lignes} onChange={setLignes} avecCout />
    </CarteBon>
  );
}
