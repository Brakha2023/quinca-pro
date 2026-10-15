import { useState } from 'react';
import { entreeStockSchema } from '../../../core/stock';
import { StockRepository } from '../../../infrastructure/powersync/repositories/StockRepository';
import FormField, { inputClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from '../articles/hooks';
import SelectFournisseur from '../fournisseurs/SelectFournisseur';
import { BonImprimable, BoutonImprimerBon, CarteBon, ChampsReferenceMotif, SelectDepot, boutonPrimaire, boutonSecondaire, type InfosFiliale } from './EnteteBon';
import LignesBonEditor, { totalLigneBon, type LigneBonUI } from './LignesBonEditor';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { useContexteMouvement } from './useContexteMouvement';

export default function EntreeStockPanel({ filialeId, filiale }: { filialeId: string; filiale: InfosFiliale }) {
  const repository = useRepository(StockRepository);
  const notifier = useNotifier();
  const ctx = useContexteMouvement(filialeId);
  const { depots } = useDepots(filialeId, { actifs: true });

  const [depotId, setDepotId] = useState('');
  const [type, setType] = useState<'ENTREE_ACHAT' | 'RETOUR_CLIENT'>('ENTREE_ACHAT');
  const [fournisseurId, setFournisseurId] = useState('');
  const [reference, setReference] = useState('');
  const [motif, setMotif] = useState('');
  const [lignes, setLignes] = useState<LigneBonUI[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [dernierBon, setDernierBon] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const depotEffectif = depotId || depots[0]?.id || '';

  const reinitialiser = () => { setLignes([]); setReference(''); setMotif(''); setFournisseurId(''); };

  const exporter = async () => {
    try {
      const chemin = await exporterExcel(reference || 'entree-stock', [{
        nom: 'Entrée en stock',
        lignes: lignes.map((l) => ({
          Code: l.article.code,
          Désignation: l.article.designation,
          Unité: l.article.unite,
          Quantité: l.quantite,
          'Coût unitaire': l.cout_unitaire === '' ? null : l.cout_unitaire,
          'Remise %': l.remise_percent,
          'Total net': totalLigneBon(l),
        })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  const valider = async () => {
    const parsed = entreeStockSchema.safeParse({
      depot_id: depotEffectif, type, fournisseur_id: fournisseurId, reference, motif,
      lignes: lignes.map((l) => ({ article_id: l.article.id, quantite: l.quantite, cout_unitaire: l.cout_unitaire, remise_percent: l.remise_percent })),
    });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    setEnCours(true);
    try {
      const ref = await repository.enregistrerEntree(ctx, parsed.data);
      setDernierBon(ref);
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
          {dernierBon && <BoutonImprimerBon reference={dernierBon} onClick={() => setApercu(dernierBon)} />}
          <button type="button" onClick={exporter} className={boutonSecondaire} disabled={lignes.length === 0} data-testid="exporter-excel">Exporter en Excel</button>
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
        {type === 'ENTREE_ACHAT' && (
          <SelectFournisseur
            filialeId={filialeId}
            value={fournisseurId}
            onChange={setFournisseurId}
            obligatoire={false}
            aide="Provenance de la marchandise. N'engage aucune dette : une dette fournisseur naît d'un bon de commande réceptionné."
          />
        )}
        <ChampsReferenceMotif reference={reference} motif={motif} onReference={setReference} onMotif={setMotif} placeholderMotif="N° BL, commentaire…" />
      </div>
      <LignesBonEditor filialeId={filialeId} depotId={depotEffectif} lignes={lignes} onChange={setLignes} avecCout />
      {apercu && <BonImprimable filialeId={filialeId} filiale={filiale} reference={apercu} onClose={() => setApercu(null)} />}
    </CarteBon>
  );
}
