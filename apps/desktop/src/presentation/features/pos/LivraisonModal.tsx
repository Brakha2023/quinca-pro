import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { livraisonDemandeSchema, type LivraisonDemande } from '../../../core/ventes';

type LivraisonInput = z.input<typeof livraisonDemandeSchema>;
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';

interface Props {
  initiale: LivraisonDemande | null;
  onClose: () => void;
  onValider: (livraison: LivraisonDemande | null) => void;
}

/** Demande de livraison rattachée au ticket (créée avec la vente, suivie dans Livraisons). */
export default function LivraisonModal({ initiale, onClose, onValider }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<LivraisonInput, unknown, LivraisonDemande>({
    resolver: zodResolver(livraisonDemandeSchema),
    defaultValues: initiale ?? { adresse_livraison: '', date_livraison_prevue: new Date().toISOString().slice(0, 10), chauffeur: '', vehicule: '' },
  });
  const cls = (c: keyof LivraisonInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;

  return (
    <Modal
      titre="Livraison"
      sousTitre="Le bon de livraison sera créé avec la vente."
      largeur="max-w-lg"
      onClose={onClose}
      pied={
        <>
          {initiale && <button type="button" onClick={() => onValider(null)} className="mr-auto px-4 py-2 text-red-600 hover:bg-red-50 font-medium rounded-lg">Retirer la livraison</button>}
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <button type="submit" form="livraison-form" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">Valider</button>
        </>
      }
    >
      <form id="livraison-form" onSubmit={handleSubmit((l) => onValider(l))} className="space-y-4">
        <FormField label="Adresse de livraison" obligatoire erreur={errors.adresse_livraison?.message}>
          <input {...register('adresse_livraison')} className={cls('adresse_livraison')} autoFocus placeholder="Quartier, repère, contact sur place…" />
        </FormField>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Date prévue" obligatoire erreur={errors.date_livraison_prevue?.message}>
            <input type="date" {...register('date_livraison_prevue')} className={cls('date_livraison_prevue')} />
          </FormField>
          <FormField label="Chauffeur" erreur={errors.chauffeur?.message}><input {...register('chauffeur')} className={cls('chauffeur')} /></FormField>
          <FormField label="Véhicule" erreur={errors.vehicule?.message}><input {...register('vehicule')} className={cls('vehicule')} /></FormField>
        </div>
      </form>
    </Modal>
  );
}
