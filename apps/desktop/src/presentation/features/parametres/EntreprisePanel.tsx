import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpTrayIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  FORMES_JURIDIQUES, PAYS, TAILLE_MAX_LOGO, champsManquants, entrepriseFormSchema,
  initiales, type Entreprise, type EntrepriseForm, type EntrepriseFormInput,
} from '../../../core/parametres';
import Bouton from '../../components/ui/Bouton';
import { redimensionnerLogo, tailleDataUrl } from '../../../infrastructure/fichiers/piecesJointes';
import { EntrepriseRepository } from '../../../infrastructure/powersync/repositories/EntrepriseRepository';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

type ChampLogo = 'logo_couleur' | 'logo_noir_blanc' | 'logo_entete' | 'logo_filigrane';

const LOGOS: Array<{ champ: ChampLogo; libelle: string; detail: string }> = [
  { champ: 'logo_couleur', libelle: 'Logo principal (couleur)', detail: "L'enseigne telle qu'elle est." },
  { champ: 'logo_noir_blanc', libelle: 'Logo noir et blanc', detail: 'Pour les pièces imprimées sans couleur.' },
  { champ: 'logo_entete', libelle: "Logo d'en-tête (documents)", detail: 'En haut de chaque pièce. À défaut, le logo couleur.' },
  { champ: 'logo_filigrane', libelle: 'Logo en filigrane (facultatif)', detail: 'En fond de page, très pâle.' },
];

interface Props {
  entreprise: Entreprise;
  peutModifier: boolean;
}

/**
 * Identité de la filiale : ce qui figure en haut et en bas de chaque pièce.
 *
 * La fiche existe toujours (le serveur en pose une par filiale) : cet écran la
 * modifie, il ne la crée pas.
 */
export default function EntreprisePanel({ entreprise, peutModifier }: Props) {
  const repository = useRepository(EntrepriseRepository);
  const notifier = useNotifier();
  const [enCours, setEnCours] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isDirty } } =
    useForm<EntrepriseFormInput, unknown, EntrepriseForm>({
      resolver: zodResolver(entrepriseFormSchema),
      // `keepDirtyValues` : la fiche vient d'une requête **vivante**. Sans ce
      // réglage, chaque mise à jour reçue — l'écho de son propre
      // enregistrement, ou la modification d'un collègue — réécrirait les
      // champs en cours de saisie. Ici, ce que l'utilisateur a touché lui
      // reste ; le reste suit le serveur.
      resetOptions: { keepDirtyValues: true },
      values: valeursDe(entreprise),
    });

  const enregistrer = handleSubmit(async (form) => {
    setEnCours(true);
    try {
      await repository.enregistrer(entreprise.id, form);
      notifier('succes', 'Identité enregistrée. Les prochaines pièces imprimées la reprennent.');
      reset(valeursDe({ ...entreprise, ...form }));
    } catch (erreur) {
      notifier('erreur', erreur instanceof Error ? erreur.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  });

  const cls = (champ: keyof EntrepriseFormInput) => `${inputClass} ${errors[champ] ? inputErrorClass : ''}`;
  const manquants = champsManquants(entreprise);

  return (
    <form onSubmit={enregistrer} className="space-y-6">
      {manquants.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="entreprise-incomplete">
          Il manque encore {manquants.join(', ')} — ces mentions figurent sur les factures que vous remettez.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">Identité de l'entreprise</h3>
          <div className="space-y-4">
            <FormField label="Nom commercial" obligatoire erreur={errors.nom_commercial?.message}>
              <input {...register('nom_commercial')} className={cls('nom_commercial')} disabled={!peutModifier} data-testid="champ-nom-commercial" />
            </FormField>
            <FormField label="Raison sociale" aide="Le nom déposé, s'il diffère de l'enseigne.">
              <input {...register('raison_sociale')} className={cls('raison_sociale')} disabled={!peutModifier} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Forme juridique">
                <select {...register('forme_juridique')} className={cls('forme_juridique')} disabled={!peutModifier}>
                  <option value="">—</option>
                  {FORMES_JURIDIQUES.map((f) => <option key={f.code} value={f.code}>{f.libelle}</option>)}
                </select>
              </FormField>
              <FormField label="N° RCCM">
                <input {...register('rccm')} className={cls('rccm')} disabled={!peutModifier} placeholder="CI-ABJ-03-2023-B-12345" />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="N° CC">
                <input {...register('numero_cc')} className={cls('numero_cc')} disabled={!peutModifier} />
              </FormField>
              <FormField label="N° compte contribuable">
                <input {...register('compte_contribuable')} className={cls('compte_contribuable')} disabled={!peutModifier} />
              </FormField>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">Coordonnées</h3>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Téléphone principal" obligatoire erreur={errors.telephone_principal?.message}>
                <input {...register('telephone_principal')} className={cls('telephone_principal')} disabled={!peutModifier} data-testid="champ-telephone" />
              </FormField>
              <FormField label="Téléphone secondaire">
                <input {...register('telephone_secondaire')} className={cls('telephone_secondaire')} disabled={!peutModifier} />
              </FormField>
            </div>
            <FormField label="E-mail" erreur={errors.email?.message}>
              <input {...register('email')} className={cls('email')} disabled={!peutModifier} placeholder="contact@exemple.ci" />
            </FormField>
            <FormField label="Adresse" obligatoire erreur={errors.adresse?.message}>
              <input {...register('adresse')} className={cls('adresse')} disabled={!peutModifier} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Ville" obligatoire erreur={errors.ville?.message}>
                <input {...register('ville')} className={cls('ville')} disabled={!peutModifier} />
              </FormField>
              <FormField label="Pays">
                <select {...register('pays')} className={cls('pays')} disabled={!peutModifier}>
                  {PAYS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Localisation / indication" aide="Le repère qu'on donne au téléphone pour trouver le magasin.">
              <input {...register('localisation')} className={cls('localisation')} disabled={!peutModifier} />
            </FormField>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-neutral-200 p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">Logo &amp; identité visuelle</h3>
        <p className="mb-4 text-xs text-neutral-500">
          PNG ou JPG, 2 Mo au plus. Les images sont réduites avant d'être enregistrées : elles descendent sur
          chaque poste avec la fiche, pour qu'un document s'imprime hors ligne avec son logo.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {LOGOS.map((l) => (
            <ChoixLogo
              key={l.champ}
              {...l}
              valeur={entreprise[l.champ]}
              nom={entreprise.nom_commercial}
              peutModifier={peutModifier}
              onChange={(dataUrl) => repository.enregistrerLogo(entreprise.id, l.champ, dataUrl)}
            />
          ))}
        </div>
      </section>

      {peutModifier && (
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
          {isDirty && <span className="text-xs text-amber-700">Modifications non enregistrées.</span>}
          <button
            type="submit"
            disabled={enCours || !isDirty}
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-neutral-300"
            data-testid="enregistrer-entreprise"
          >
            {enCours ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      )}
    </form>
  );
}

function valeursDe(e: Entreprise): EntrepriseFormInput {
  return {
    nom_commercial: e.nom_commercial, raison_sociale: e.raison_sociale, forme_juridique: e.forme_juridique,
    rccm: e.rccm, numero_cc: e.numero_cc, compte_contribuable: e.compte_contribuable,
    telephone_principal: e.telephone_principal, telephone_secondaire: e.telephone_secondaire,
    email: e.email, adresse: e.adresse, ville: e.ville, pays: e.pays, localisation: e.localisation,
    assujetti_tva: e.assujetti_tva, taux_tva: e.taux_tva, prix_saisis: e.prix_saisis,
    devise: e.devise, mentions_legales: e.mentions_legales,
  };
}

interface ChoixLogoProps {
  champ: ChampLogo;
  libelle: string;
  detail: string;
  valeur: string | null;
  nom: string;
  peutModifier: boolean;
  onChange: (dataUrl: string | null) => Promise<void>;
}

/** Une vignette de logo : on la remplace, ou on la retire. */
function ChoixLogo({ champ, libelle, detail, valeur, nom, peutModifier, onChange }: ChoixLogoProps) {
  const entree = useRef<HTMLInputElement>(null);
  const notifier = useNotifier();
  const [enCours, setEnCours] = useState(false);

  const choisir = async (fichier: File | undefined) => {
    if (!fichier) return;
    if (fichier.size > TAILLE_MAX_LOGO) {
      notifier('erreur', `« ${fichier.name} » dépasse 2 Mo.`);
      return;
    }
    setEnCours(true);
    try {
      const reduit = await redimensionnerLogo(fichier);
      await onChange(reduit);
      notifier('succes', `${libelle} enregistré (${Math.round(tailleDataUrl(reduit) / 1024)} Ko).`);
    } catch (erreur) {
      notifier('erreur', erreur instanceof Error ? erreur.message : 'Image illisible.');
    } finally {
      setEnCours(false);
      if (entree.current) entree.current.value = '';
    }
  };

  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <p className="text-xs font-medium text-neutral-700">{libelle}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{detail}</p>
      <div className={`mt-2 flex h-20 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 ${champ === 'logo_filigrane' ? 'opacity-50' : ''}`}>
        {valeur
          ? <img src={valeur} alt={libelle} className="max-h-16 max-w-full object-contain" data-testid={`apercu-${champ}`} />
          : <span className="text-lg font-bold tracking-tight text-neutral-400">{initiales(nom)}</span>}
      </div>
      {peutModifier && (
        <div className="mt-2 flex items-center gap-2">
          <input ref={entree} type="file" accept="image/png,image/jpeg" className="hidden"
                 onChange={(e) => void choisir(e.target.files?.[0])} data-testid={`fichier-${champ}`} />
          <Bouton onClick={() => entree.current?.click()} icone={ArrowUpTrayIcon} tailleIcone="h-3.5 w-3.5" className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" disabled={enCours}>{enCours ? '…' : valeur ? 'Changer' : 'Charger'}</Bouton>
          {valeur && (
            <button type="button" onClick={() => void onChange(null)} title="Retirer ce logo"
                    className="rounded-md p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    data-testid={`retirer-${champ}`}>
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
