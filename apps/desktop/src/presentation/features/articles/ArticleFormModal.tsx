import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  UNITES,
  articleFormSchema,
  articleToFormInput,
  type Article,
  type ArticleForm,
  type ArticleFormInput,
  type FamilleArticle,
} from '../../../core/articles';
import { ArticlesRepository } from '../../../infrastructure/powersync/repositories/ArticlesRepository';
import { margePourcent } from '../../../core/commun/prix';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

interface Props {
  filialeId: string;
  familles: FamilleArticle[];
  /** Absent = création. */
  article?: Article;
  onClose: () => void;
}

const FORM_VIDE: ArticleFormInput = {
  code: '',
  designation: '',
  famille_id: null,
  sous_famille: '',
  prix_achat: 0,
  prix_vente: 0,
  prix_vip: '',
  tva: 18,
  stock_min: 0,
  stock_max: 0,
  unite: 'PIECE',
};

export default function ArticleFormModal({ filialeId, familles, article, onClose }: Props) {
  const repository = useRepository(ArticlesRepository);
  const notifier = useNotifier();
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ArticleFormInput, unknown, ArticleForm>({
    resolver: zodResolver(articleFormSchema),
    defaultValues: article ? articleToFormInput(article) : FORM_VIDE,
  });

  const prixAchat = Number(watch('prix_achat')) || 0;
  const prixVente = Number(watch('prix_vente')) || 0;
  const marge = margePourcent(prixAchat, prixVente);

  const onSubmit = async (form: ArticleForm) => {
    if (await repository.codeExiste(filialeId, form.code, article?.id)) {
      setError('code', { message: 'Ce code existe déjà dans la filiale' });
      return;
    }
    try {
      if (article) {
        await repository.update(article.id, form);
        notifier('succes', `Article ${form.code} modifié.`);
      } else {
        await repository.create(filialeId, form);
        notifier('succes', `Article ${form.code} créé.`);
      }
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : "Enregistrement impossible.");
    }
  };

  const cls = (champ: keyof ArticleFormInput) => `${inputClass} ${errors[champ] ? inputErrorClass : ''}`;

  return (
    <Modal
      titre={article ? `Modifier ${article.code}` : 'Nouvel article'}
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
            Annuler
          </button>
          <button
            type="submit"
            form="article-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"
          >
            {article ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <form id="article-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Code" obligatoire erreur={errors.code?.message}>
            <input {...register('code')} className={`${cls('code')} font-mono uppercase`} autoFocus />
          </FormField>
          <FormField label="Famille" erreur={errors.famille_id?.message}>
            <select {...register('famille_id', { setValueAs: (v) => v || null })} className={cls('famille_id')}>
              <option value="">— Aucune —</option>
              {familles.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Désignation" obligatoire erreur={errors.designation?.message}>
          <input {...register('designation')} className={cls('designation')} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Sous-famille" erreur={errors.sous_famille?.message}>
            <input {...register('sous_famille')} className={cls('sous_famille')} />
          </FormField>
          <FormField label="Unité" erreur={errors.unite?.message}>
            <select {...register('unite')} className={cls('unite')}>
              {UNITES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <FormField label="Prix d'achat" obligatoire erreur={errors.prix_achat?.message}>
            <input type="number" step="1" min="0" {...register('prix_achat')} className={`${cls('prix_achat')} text-right font-mono`} />
          </FormField>
          <FormField label="Prix de vente" obligatoire erreur={errors.prix_vente?.message}>
            <input type="number" step="1" min="0" {...register('prix_vente')} className={`${cls('prix_vente')} text-right font-mono`} />
          </FormField>
          <FormField label="Prix VIP" erreur={errors.prix_vip?.message}>
            <input type="number" step="1" min="0" {...register('prix_vip')} className={`${cls('prix_vip')} text-right font-mono`} placeholder="—" />
          </FormField>
          <FormField label="TVA %" erreur={errors.tva?.message}>
            <input type="number" step="0.01" min="0" max="100" {...register('tva')} className={`${cls('tva')} text-right font-mono`} />
          </FormField>
        </div>

        <p className="text-sm text-neutral-600">
          Marge :{' '}
          <span className={`font-semibold ${marge < 0 ? 'text-red-600' : marge < 20 ? 'text-orange-600' : 'text-green-700'}`}>{marge}%</span>
        </p>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Stock minimum (alerte)" erreur={errors.stock_min?.message}>
            <input type="number" step="1" min="0" {...register('stock_min')} className={`${cls('stock_min')} text-right font-mono`} />
          </FormField>
          <FormField label="Stock maximum" erreur={errors.stock_max?.message}>
            <input type="number" step="1" min="0" {...register('stock_max')} className={`${cls('stock_max')} text-right font-mono`} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
