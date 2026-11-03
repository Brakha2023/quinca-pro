import { useState } from 'react';
import Bouton from '../../components/ui/Bouton';
import { TYPES_BON_ENTREE, entreeStockSchema, repartirRemiseGlobale, totalBrutBon, totalNetBon } from '../../../core/stock';
import { StockRepository } from '../../../infrastructure/powersync/repositories/StockRepository';
import ChampMontant from '../../components/ui/ChampMontant';
import FormField, { inputClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from '../articles/hooks';
import { useFournisseurs } from '../fournisseurs/hooks';
import SelectFournisseur from '../fournisseurs/SelectFournisseur';
import { BasculeVue, BonImprimable, BoutonImprimerBon, CarteBon, ChampsReferenceMotif, SelectDepot, boutonPrimaire, boutonSecondaire, type InfosFiliale, type VueOnglet } from './EnteteBon';
import HistoriqueBons from './HistoriqueBons';
import LignesBonEditor, { type LigneBonUI } from './LignesBonEditor';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { useContexteMouvement } from './useContexteMouvement';

export default function EntreeStockPanel({ filialeId, filiale }: { filialeId: string; filiale: InfosFiliale }) {
  const repository = useRepository(StockRepository);
  const notifier = useNotifier();
  const ctx = useContexteMouvement(filialeId);
  const { depots } = useDepots(filialeId, { actifs: true });
  const { fournisseurs } = useFournisseurs(filialeId);

  const [vue, setVue] = useState<VueOnglet>('saisie');
  const [depotId, setDepotId] = useState('');
  const [type, setType] = useState<'ENTREE_ACHAT' | 'RETOUR_CLIENT'>('ENTREE_ACHAT');
  const [fournisseurId, setFournisseurId] = useState('');
  const [reference, setReference] = useState('');
  const [motif, setMotif] = useState('');
  const [remise, setRemise] = useState(0);
  const [dateLivraison, setDateLivraison] = useState('');
  const [lignes, setLignes] = useState<LigneBonUI[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [dernierBon, setDernierBon] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const depotEffectif = depotId || depots[0]?.id || '';

  const reinitialiser = () => { setLignes([]); setReference(''); setMotif(''); setFournisseurId(''); setRemise(0); setDateLivraison(''); };

  const exporter = async () => {
    try {
      const chemin = await exporterExcel(reference || 'entree-stock', [{
        nom: 'Entrée en stock',
        // La part de remise portée par chaque ligne est celle qui sera
        // enregistrée : le classeur doit tomber sur les mêmes francs.
        lignes: repartirRemiseGlobale(lignes, remise).map(({ ligne, brut, remise: part }) => ({
          Code: ligne.article.code,
          Désignation: ligne.article.designation,
          Unité: ligne.article.unite,
          Quantité: ligne.quantite,
          'Coût unitaire': ligne.cout_unitaire === '' ? null : ligne.cout_unitaire,
          Montant: brut,
          'Part de remise': part,
          'Total net': brut - part,
        })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  const valider = async () => {
    const parsed = entreeStockSchema.safeParse({
      depot_id: depotEffectif, type, fournisseur_id: fournisseurId, reference, motif, remise, date_livraison: dateLivraison,
      lignes: lignes.map((l) => ({ article_id: l.article.id, quantite: l.quantite, cout_unitaire: l.cout_unitaire })),
    });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    const net = totalNetBon(lignes, remise);
    const nomFournisseur = fournisseurs.find((f) => f.id === parsed.data.fournisseur_id)?.raison_sociale;
    setEnCours(true);
    try {
      const ref = await repository.enregistrerEntree(ctx, parsed.data);
      setDernierBon(ref);
      // Le compte n'est touché que s'il y avait quelque chose à devoir : le
      // message ne promet donc rien quand le bon ne porte aucun coût.
      notifier('succes', nomFournisseur && net > 0
        ? `Entrée ${ref} enregistrée (${parsed.data.lignes.length} ligne(s)) · ${formaterFcfa(net)} portés au compte de ${nomFournisseur}.`
        : `Entrée ${ref} enregistrée (${parsed.data.lignes.length} ligne(s)).`);
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
        titre="Entrée en stock"
        description="Les bons d'entrée déjà enregistrés : achats réceptionnés et retours clients. Chaque bon se réimprime tel qu'il a été signé."
        bascule={<BasculeVue vue={vue} onChange={setVue} />}
      >
        <HistoriqueBons
          filialeId={filialeId}
          filiale={filiale}
          types={TYPES_BON_ENTREE}
          avecFournisseur
          avecLivraison
          videMessage="Aucune entrée enregistrée sur cette période."
        />
      </CarteBon>
    );
  }

  return (
    <CarteBon
      titre="Entrée en stock"
      description="Réception d'achat ou retour client. Le coût moyen des articles est recalculé sur le coût net de remise ; un achat chez un fournisseur est porté à son compte."
      bascule={<BasculeVue vue={vue} onChange={setVue} />}
      actions={
        <>
          {dernierBon && <BoutonImprimerBon reference={dernierBon} onClick={() => setApercu(dernierBon)} />}
          <button type="button" onClick={exporter} className={boutonSecondaire} disabled={lignes.length === 0} data-testid="exporter-excel">Exporter en Excel</button>
          <button type="button" onClick={reinitialiser} className={boutonSecondaire} disabled={lignes.length === 0}>Vider</button>
          <Bouton type="button" onClick={valider} enCours={enCours} className={boutonPrimaire} disabled={enCours || lignes.length === 0}>Valider l'entrée</Bouton>
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
            aide="Le net du bon est porté à son compte : la dette naît de la marchandise reçue. Laissez vide pour une entrée qui n'engage rien."
          />
        )}
        <FormField label="Livraison (date et heure)" aide="Quand la marchandise est arrivée. À laisser vide si c'est maintenant.">
          <input type="datetime-local" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} className={inputClass} data-testid="date-livraison" />
        </FormField>
        <FormField label="Remise globale (F)" aide="Le rabais accordé sur le bon entier, réparti au prorata des lignes.">
          <ChampMontant valeur={remise} onChange={setRemise} zeroVide className={`${inputClass} text-right font-mono`} data-testid="remise-globale" />
        </FormField>
        <ChampsReferenceMotif reference={reference} motif={motif} onReference={setReference} onMotif={setMotif} placeholderMotif="N° BL, commentaire…" />
      </div>
      <LignesBonEditor filialeId={filialeId} depotId={depotEffectif} lignes={lignes} onChange={setLignes} avecCout remiseGlobale={remise} />
      {remise > totalBrutBon(lignes) && lignes.length > 0 && (
        <p className="text-sm text-red-600" data-testid="remise-excessive">La remise ({formaterFcfa(remise)}) dépasse le total du bon ({formaterFcfa(totalBrutBon(lignes))}).</p>
      )}
      {apercu && <BonImprimable filialeId={filialeId} filiale={filiale} reference={apercu} onClose={() => setApercu(null)} />}
    </CarteBon>
  );
}
