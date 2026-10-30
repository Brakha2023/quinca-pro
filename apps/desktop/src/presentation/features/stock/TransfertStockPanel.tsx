import { useState } from 'react';
import { TYPES_BON_TRANSFERT, transfertStockSchema } from '../../../core/stock';
import { StockRepository } from '../../../infrastructure/powersync/repositories/StockRepository';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from '../articles/hooks';
import { BasculeVue, BonImprimable, BoutonImprimerBon, CarteBon, ChampsReferenceMotif, SelectDepot, boutonPrimaire, boutonSecondaire, type InfosFiliale, type VueOnglet } from './EnteteBon';
import HistoriqueBons from './HistoriqueBons';
import LignesBonEditor, { type LigneBonUI } from './LignesBonEditor';
import { useContexteMouvement } from './useContexteMouvement';

export default function TransfertStockPanel({ filialeId, filiale }: { filialeId: string; filiale: InfosFiliale }) {
  const repository = useRepository(StockRepository);
  const notifier = useNotifier();
  const ctx = useContexteMouvement(filialeId);
  const { depots } = useDepots(filialeId, { actifs: true });

  const [vue, setVue] = useState<VueOnglet>('saisie');
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [reference, setReference] = useState('');
  const [motif, setMotif] = useState('');
  const [lignes, setLignes] = useState<LigneBonUI[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [dernierBon, setDernierBon] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const sourceEffectif = sourceId || depots[0]?.id || '';
  const destinationEffective = destinationId || depots.find((d) => d.id !== sourceEffectif)?.id || '';

  const reinitialiser = () => { setLignes([]); setReference(''); setMotif(''); };

  const valider = async () => {
    const parsed = transfertStockSchema.safeParse({
      depot_source_id: sourceEffectif, depot_destination_id: destinationEffective, reference, motif,
      lignes: lignes.map((l) => ({ article_id: l.article.id, quantite: l.quantite })),
    });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    setEnCours(true);
    try {
      const ref = await repository.transferer(ctx, parsed.data);
      setDernierBon(ref);
      notifier('succes', `Transfert ${ref} enregistré (${parsed.data.lignes.length} ligne(s)).`);
      reinitialiser();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  if (vue === 'historique') {
    return (
      <CarteBon
        titre="Transfert entre dépôts de la filiale"
        description="Les transferts déjà effectués entre les dépôts de la filiale. Un transfert est compté une fois, du dépôt de départ vers celui d'arrivée."
        bascule={<BasculeVue vue={vue} onChange={setVue} />}
      >
        <HistoriqueBons
          filialeId={filialeId}
          filiale={filiale}
          types={TYPES_BON_TRANSFERT}
          avecDestination
          videMessage="Aucun transfert entre dépôts sur cette période."
        />
      </CarteBon>
    );
  }

  // Le garde-fou ne vaut que pour la saisie : l'historique se consulte même si un dépôt a depuis été fermé.
  if (depots.length < 2) {
    return (
      <CarteBon
        titre="Transfert entre dépôts de la filiale"
        description="Il faut au moins deux dépôts actifs dans la filiale pour effectuer un transfert."
        bascule={<BasculeVue vue={vue} onChange={setVue} />}
      >
        <p className="text-sm text-neutral-500">Créez un second dépôt dans « Catalogue → Dépôts », ou consultez l'historique des transferts déjà faits.</p>
      </CarteBon>
    );
  }

  return (
    <CarteBon
      titre="Transfert entre dépôts de la filiale"
      description="Sortie du dépôt source et entrée au dépôt destination, au coût moyen du dépôt source, dans la même écriture. Pour expédier vers une autre filiale, voir « Transfert entre filiales » : la marchandise y voyage, et le bon attend la réception."
      bascule={<BasculeVue vue={vue} onChange={setVue} />}
      actions={
        <>
          {dernierBon && <BoutonImprimerBon reference={dernierBon} onClick={() => setApercu(dernierBon)} />}
          <button type="button" onClick={reinitialiser} className={boutonSecondaire} disabled={lignes.length === 0}>Vider</button>
          <button type="button" onClick={valider} className={boutonPrimaire} disabled={enCours || lignes.length === 0}>Valider le transfert</button>
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SelectDepot label="Dépôt source" depots={depots} value={sourceEffectif} onChange={setSourceId} />
        <SelectDepot label="Dépôt destination" depots={depots.filter((d) => d.id !== sourceEffectif)} value={destinationEffective} onChange={setDestinationId} />
        <ChampsReferenceMotif reference={reference} motif={motif} onReference={setReference} onMotif={setMotif} />
      </div>
      <LignesBonEditor filialeId={filialeId} depotId={sourceEffectif} lignes={lignes} onChange={setLignes} controlerDisponible />
      {apercu && <BonImprimable filialeId={filialeId} filiale={filiale} reference={apercu} onClose={() => setApercu(null)} />}
    </CarteBon>
  );
}
