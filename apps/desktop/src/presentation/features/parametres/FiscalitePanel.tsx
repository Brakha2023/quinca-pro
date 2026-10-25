import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEVISES, MODES_PRIX, entrepriseFormSchema,
  type Entreprise, type EntrepriseForm, type EntrepriseFormInput,
} from '../../../core/parametres';
import { EntrepriseRepository } from '../../../infrastructure/powersync/repositories/EntrepriseRepository';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

interface Props {
  entreprise: Entreprise;
  peutModifier: boolean;
}

/**
 * Fiscalité et facturation.
 *
 * Le taux de TVA réglé ici est un **défaut** : il s'applique aux articles
 * créés ensuite, pas à ceux déjà au catalogue — un article porte son propre
 * taux, et changer le réglage ne doit pas refaire les prix du magasin.
 */
export default function FiscalitePanel({ entreprise, peutModifier }: Props) {
  const repository = useRepository(EntrepriseRepository);
  const notifier = useNotifier();
  const [enCours, setEnCours] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } =
    useForm<EntrepriseFormInput, unknown, EntrepriseForm>({
      resolver: zodResolver(entrepriseFormSchema),
      // `keepDirtyValues` : la fiche vient d'une requête **vivante**. Sans ce
      // réglage, chaque mise à jour reçue — l'écho de son propre
      // enregistrement, ou la modification d'un collègue — réécrirait les
      // champs en cours de saisie. Ici, ce que l'utilisateur a touché lui
      // reste ; le reste suit le serveur.
      resetOptions: { keepDirtyValues: true },
      values: {
        nom_commercial: entreprise.nom_commercial, raison_sociale: entreprise.raison_sociale,
        forme_juridique: entreprise.forme_juridique, rccm: entreprise.rccm, numero_cc: entreprise.numero_cc,
        compte_contribuable: entreprise.compte_contribuable, telephone_principal: entreprise.telephone_principal,
        telephone_secondaire: entreprise.telephone_secondaire, email: entreprise.email,
        adresse: entreprise.adresse, ville: entreprise.ville, pays: entreprise.pays,
        localisation: entreprise.localisation, assujetti_tva: entreprise.assujetti_tva,
        taux_tva: entreprise.taux_tva, prix_saisis: entreprise.prix_saisis,
        devise: entreprise.devise, mentions_legales: entreprise.mentions_legales,
      },
    });

  const assujetti = watch('assujetti_tva');
  const mode = watch('prix_saisis');

  const enregistrer = handleSubmit(async (form) => {
    setEnCours(true);
    try {
      await repository.enregistrer(entreprise.id, form);
      notifier('succes', 'Réglages fiscaux enregistrés.');
      // Ce qui vient d'être enregistré n'est plus « modifié ».
      reset(undefined, { keepValues: true });
    } catch (erreur) {
      notifier('erreur', erreur instanceof Error ? erreur.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  });

  return (
    <form onSubmit={enregistrer} className="space-y-6">
      <section className="rounded-xl border border-neutral-200 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">Taxe sur la valeur ajoutée</h3>

        <label className="flex items-start gap-3">
          <input type="checkbox" {...register('assujetti_tva')} disabled={!peutModifier}
                 className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                 data-testid="assujetti-tva" />
          <span>
            <span className="text-sm font-medium text-neutral-800">Entreprise assujettie à la TVA</span>
            <span className="block text-xs text-neutral-500">
              {assujetti
                ? 'La TVA est calculée et détaillée sur les pièces.'
                : 'Aucune TVA ne figure sur les pièces ; les totaux sont nets.'}
            </span>
          </span>
        </label>

        {assujetti && (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <FormField label="Taux par défaut (%)" erreur={errors.taux_tva?.message}
                       aide="S'applique aux articles créés ensuite, pas au catalogue existant.">
              <input type="number" step="0.01" min="0" max="100" {...register('taux_tva')} disabled={!peutModifier}
                     className={`${inputClass} ${errors.taux_tva ? inputErrorClass : ''}`} data-testid="taux-tva" />
            </FormField>
            <FormField label="Prix saisis" aide={MODES_PRIX.find((m) => m.code === mode)?.detail}>
              <select {...register('prix_saisis')} disabled={!peutModifier} className={inputClass} data-testid="mode-prix">
                {MODES_PRIX.map((m) => <option key={m.code} value={m.code}>{m.libelle}</option>)}
              </select>
            </FormField>
            <FormField label="Devise">
              <select {...register('devise')} disabled={!peutModifier} className={inputClass}>
                {DEVISES.map((d) => <option key={d.code} value={d.code}>{d.libelle}</option>)}
              </select>
            </FormField>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Mentions légales</h3>
        <p className="mb-3 text-xs text-neutral-500">
          Ce texte figure au bas de chaque facture et de chaque reçu. Conditions de règlement, pénalités de
          retard, remerciements : ce que la maison veut voir écrit sur ses papiers.
        </p>
        <textarea rows={4} {...register('mentions_legales')} disabled={!peutModifier}
                  className={inputClass} data-testid="mentions-legales"
                  placeholder="Merci pour votre confiance. Conservez cette facture pour toute réclamation." />
      </section>

      {peutModifier && (
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
          {isDirty && <span className="text-xs text-amber-700">Modifications non enregistrées.</span>}
          <button type="submit" disabled={enCours || !isDirty} data-testid="enregistrer-fiscalite"
                  className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-neutral-300">
            {enCours ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      )}
    </form>
  );
}
