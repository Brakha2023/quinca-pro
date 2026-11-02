import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { TypeMouvementTresorerie } from '@quinca/shared-types';
import {
  LIBELLES_CATEGORIE, caisseFormSchema, categoriesIntegrees, motifCategorieRefusee, normaliserCodeCategorie, transfertCaisseSchema,
  type Caisse, type CaisseForm, type CaisseFormInput, type CategorieTresorerie, type ChoixCategorie,
  type TransfertCaisseForm, type TransfertCaisseFormInput,
} from '../../../core/tresorerie';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';

const pied = (onClose: () => void, form: string, libelle: string, disabled: boolean) => (
  <>
    <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
    <button type="submit" form={form} disabled={disabled} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">{libelle}</button>
  </>
);

export function CaisseFormModal({ filialeId, caisse, onClose }: { filialeId: string; caisse?: Caisse; onClose: () => void }) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<CaisseFormInput, unknown, CaisseForm>({
    resolver: zodResolver(caisseFormSchema),
    defaultValues: caisse ? { code: caisse.code, nom: caisse.nom, responsable: caisse.responsable ?? '' } : { code: '', nom: '', responsable: '' },
  });
  const onSubmit = async (form: CaisseForm) => {
    if (await repository.codeExiste(filialeId, form.code, caisse?.id)) { setError('code', { message: 'Ce code existe déjà' }); return; }
    try {
      if (caisse) await repository.updateCaisse(caisse.id, form); else await repository.createCaisse(filialeId, form);
      notifier('succes', `Caisse ${form.nom} ${caisse ? 'modifiée' : 'créée'}.`); onClose();
    } catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.'); }
  };
  return (
    <Modal titre={caisse ? `Modifier ${caisse.nom}` : 'Nouvelle caisse'} largeur="max-w-lg" onClose={onClose} pied={pied(onClose, 'caisse-form', caisse ? 'Enregistrer' : 'Créer', isSubmitting)}>
      <form id="caisse-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Code" obligatoire erreur={errors.code?.message}><input {...register('code')} className={`${inputClass} ${errors.code ? inputErrorClass : ''} font-mono uppercase`} maxLength={10} autoFocus /></FormField>
          <FormField label="Nom" obligatoire erreur={errors.nom?.message} className="col-span-2"><input {...register('nom')} className={`${inputClass} ${errors.nom ? inputErrorClass : ''}`} /></FormField>
        </div>
        <FormField label="Responsable"><input {...register('responsable')} className={inputClass} /></FormField>
      </form>
    </Modal>
  );
}

export function TransfertCaisseModal({ filialeId, caisses, onClose }: { filialeId: string; caisses: Caisse[]; onClose: () => void }) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TransfertCaisseFormInput, unknown, TransfertCaisseForm>({
    resolver: zodResolver(transfertCaisseSchema),
    defaultValues: { caisse_source_id: caisses[0]?.id ?? '', caisse_destination_id: caisses[1]?.id ?? '', montant: 0, motif: '' },
  });
  const cls = (c: keyof TransfertCaisseFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;
  const onSubmit = async (form: TransfertCaisseForm) => {
    try {
      const numero = await repository.transferer({ filialeId, utilisateurId: utilisateur?.id ?? null }, form);
      notifier('succes', `Transfert ${numero} de ${formaterFcfa(form.montant)} effectué.`); onClose();
    } catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Transfert impossible.'); }
  };
  return (
    <Modal titre="Transfert entre caisses" largeur="max-w-lg" onClose={onClose} pied={pied(onClose, 'trc-form', 'Transférer', isSubmitting)}>
      <form id="trc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Depuis" obligatoire erreur={errors.caisse_source_id?.message}><select {...register('caisse_source_id')} className={cls('caisse_source_id')}>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom} ({formaterFcfa(c.solde_actuel)})</option>)}</select></FormField>
          <FormField label="Vers" obligatoire erreur={errors.caisse_destination_id?.message}><select {...register('caisse_destination_id')} className={cls('caisse_destination_id')}>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></FormField>
        </div>
        <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${cls('montant')} text-right font-mono text-lg`} autoFocus /></FormField>
        <FormField label="Motif" erreur={errors.motif?.message}><input {...register('motif')} className={cls('motif')} /></FormField>
      </form>
    </Modal>
  );
}

/**
 * Les catégories de la maison, pour un sens donné : en ajouter une, renommer
 * la sienne, la retirer de la liste de saisie.
 *
 * Elle s'ouvre depuis le formulaire de saisie, et non depuis un écran de
 * paramètres : la catégorie qui manque se découvre la pièce en main. La
 * nouvelle est sélectionnée aussitôt, pour que la dépense qu'on était en train
 * d'écrire aille bien dedans.
 *
 * Ce qui ne s'y fait pas : toucher aux catégories intégrées (rappelées en
 * haut, grisées — des mouvements les portent déjà), renommer un code (voir la
 * migration `categories_tresorerie`), ou supprimer. On retire de la liste ; le
 * passé garde son libellé.
 */
export function CategoriesModal({ filialeId, type, categories, onClose, onCreee }: {
  filialeId: string;
  type: TypeMouvementTresorerie;
  categories: CategorieTresorerie[];
  onClose: () => void;
  /** Le choix complet, pour que le formulaire puisse le désigner sans attendre la synchronisation locale. */
  onCreee?: (creee: ChoixCategorie) => void;
}) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const [libelle, setLibelle] = useState('');
  const [refus, setRefus] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [occupe, setOccupe] = useState(false);
  const siennes = categories.filter((c) => c.type === type);
  const quoi = type === 'RECETTE' ? 'recette' : 'dépense';

  const ajouter = async () => {
    // Les deux sens sont regardés ensemble : un code ne peut pas désigner une
    // recette ici et une dépense là.
    const motif = motifCategorieRefusee(libelle, categories);
    if (motif) { setRefus(motif); return; }
    setOccupe(true);
    try {
      const propre = libelle.trim();
      const code = await repository.creerCategorie(filialeId, { libelle: propre, type });
      notifier('succes', `Catégorie « ${propre} » ajoutée.`);
      setLibelle(''); setRefus(null);
      onCreee?.({ code, libelle: propre, integree: false });
    } catch (error) {
      setRefus(error instanceof Error ? error.message : 'Ajout impossible.');
    } finally {
      setOccupe(false);
    }
  };

  const renommer = async (c: CategorieTresorerie) => {
    const propre = (edits[c.id] ?? '').trim();
    if (propre.length < 2) { notifier('erreur', 'Le libellé doit faire au moins deux caractères.'); return; }
    try {
      await repository.renommerCategorie(c.id, propre);
      setEdits((prec) => Object.fromEntries(Object.entries(prec).filter(([cle]) => cle !== c.id)));
      notifier('succes', `Catégorie renommée « ${propre} ».`);
    } catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Renommage impossible.'); }
  };

  const basculer = async (c: CategorieTresorerie) => {
    try {
      await repository.activerCategorie(c.id, !c.est_active);
      notifier('succes', `« ${c.libelle} » ${c.est_active ? 'retirée de la liste' : 'remise dans la liste'}.`);
    } catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.'); }
  };

  return (
    <Modal
      titre={`Catégories de ${quoi}`}
      sousTitre="Les catégories intégrées ne se modifient pas ; celles de la maison, si."
      largeur="max-w-2xl"
      onClose={onClose}
      pied={<button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Fermer</button>}
    >
      <div className="space-y-5">
        <div>
          <FormField label={`Nouvelle catégorie de ${quoi}`} erreur={refus ?? undefined}>
            <div className="flex gap-2">
              <input
                value={libelle}
                onChange={(e) => { setLibelle(e.target.value); setRefus(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void ajouter(); } }}
                placeholder="Gardiennage, patente, dédouanement…"
                maxLength={40}
                autoFocus
                className={`${inputClass} ${refus ? inputErrorClass : ''}`}
                data-testid="categorie-libelle"
              />
              <button type="button" onClick={() => void ajouter()} disabled={occupe || libelle.trim().length < 2} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg whitespace-nowrap" data-testid="ajouter-categorie">
                <PlusIcon className="w-5 h-5" /> Ajouter
              </button>
            </div>
          </FormField>
          {libelle.trim().length >= 2 && !refus && (
            <p className="text-xs text-neutral-500 mt-1">Code du journal : <span className="font-mono">{normaliserCodeCategorie(libelle)}</span> — il ne changera plus, même si vous renommez la catégorie.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Catégories de la maison</p>
          {siennes.length === 0 ? (
            <p className="text-sm text-neutral-500">Aucune pour l'instant : les catégories intégrées ci-dessous suffisent tant qu'elles vous vont.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg">
              {siennes.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2" data-testid={`categorie-${c.code}`}>
                  <input
                    value={edits[c.id] ?? c.libelle}
                    onChange={(e) => setEdits((prec) => ({ ...prec, [c.id]: e.target.value }))}
                    maxLength={40}
                    className={`${inputClass} flex-1 ${c.est_active ? '' : 'text-neutral-400'}`}
                  />
                  <span className="text-xs font-mono text-neutral-400 w-40 truncate" title={c.code}>{c.code}</span>
                  <button type="button" onClick={() => void renommer(c)} disabled={(edits[c.id] ?? c.libelle).trim() === c.libelle} className="px-2 py-1 text-sm text-primary-700 hover:bg-primary-50 disabled:text-neutral-300 rounded">Renommer</button>
                  <button type="button" onClick={() => void basculer(c)} className="px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 rounded whitespace-nowrap">{c.est_active ? 'Retirer' : 'Remettre'}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Catégories intégrées</p>
          <p className="text-sm text-neutral-500">{categoriesIntegrees(type).map((code) => LIBELLES_CATEGORIE[code] ?? code).join(' · ')}</p>
        </div>
      </div>
    </Modal>
  );
}
