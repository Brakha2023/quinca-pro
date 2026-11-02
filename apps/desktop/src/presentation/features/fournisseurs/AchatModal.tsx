import { useState } from 'react';
import { achatSchema, totauxAchat, type Fournisseur } from '../../../core/fournisseurs';
import { FournisseursRepository } from '../../../infrastructure/powersync/repositories/FournisseursRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from '../articles/hooks';
import LignesBonEditor, { type LigneBonUI } from '../stock/LignesBonEditor';
import { FactureAchatImprimable } from './FactureAchatDocument';

/**
 * Saisie d'un achat réceptionné : les lignes entrent en stock, le total devient
 * une dette fournisseur, et la **facture d'achat** s'imprime dans la foulée —
 * c'est la pièce qu'on classe avec le bon de livraison du fournisseur.
 */
export default function AchatModal({ filialeId, filiale, fournisseur, onClose }: { filialeId: string; filiale: { nom: string; adresse?: string | null; telephone?: string | null }; fournisseur: Fournisseur; onClose: () => void }) {
  const repository = useRepository(FournisseursRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const { depots } = useDepots(filialeId, { actifs: true });
  const [depotId, setDepotId] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [tva, setTva] = useState(0);
  const [lignes, setLignes] = useState<LigneBonUI[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [facture, setFacture] = useState<string | null>(null);
  const depotEffectif = depotId || depots[0]?.id || '';
  const totaux = totauxAchat({ tva_percent: tva, lignes: lignes.map((l) => ({ article_id: l.article.id, quantite: l.quantite, cout_unitaire: l.cout_unitaire === '' ? 0 : l.cout_unitaire })) });

  const valider = async () => {
    const parsed = achatSchema.safeParse({
      fournisseur_id: fournisseur.id, depot_id: depotEffectif, reference, notes, tva_percent: tva,
      lignes: lignes.map((l) => ({ article_id: l.article.id, quantite: l.quantite, cout_unitaire: l.cout_unitaire })),
    });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    setEnCours(true);
    try {
      const { id, numero } = await repository.enregistrerAchat({ filialeId, utilisateurId: utilisateur?.id ?? null }, parsed.data);
      notifier('succes', `Achat ${numero} réceptionné : ${formaterFcfa(totaux.total_ttc)} portés en dette fournisseur.`);
      // La facture reste à l'écran pour être imprimée ; la fermer ferme la saisie.
      setFacture(id);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal titre={`Achat — ${fournisseur.raison_sociale}`} sousTitre="Réception de marchandises (BL ou facture fournisseur)" largeur="max-w-4xl" onClose={onClose} pied={
      <>
        <span className="mr-auto text-sm text-neutral-600">Total TTC : <strong className="font-mono">{formaterFcfa(totaux.total_ttc)}</strong></span>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <button type="button" onClick={valider} disabled={enCours || lignes.length === 0} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">Réceptionner</button>
      </>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FormField label="Dépôt de réception" obligatoire>
            <select value={depotEffectif} onChange={(e) => setDepotId(e.target.value)} className={inputClass}>{depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}</select>
          </FormField>
          <FormField label="N° BL / facture"><input value={reference} onChange={(e) => setReference(e.target.value)} className={`${inputClass} font-mono`} placeholder="Auto si vide" /></FormField>
          <FormField label="TVA %"><input type="number" min="0" max="100" value={tva} onChange={(e) => setTva(Number(e.target.value))} className={`${inputClass} text-right font-mono`} /></FormField>
          <FormField label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></FormField>
        </div>
        <LignesBonEditor filialeId={filialeId} depotId={depotEffectif} lignes={lignes} onChange={setLignes} avecCout />
      </div>
      {facture && <FactureAchatImprimable commandeId={facture} filiale={filiale} onClose={onClose} />}
    </Modal>
  );
}
