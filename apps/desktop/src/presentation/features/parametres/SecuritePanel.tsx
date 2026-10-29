import { useState } from 'react';
import { CheckCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import {
  LONGUEUR_CODE_ANNULATION, codeAnnulationDefini, motifCodeInvalide, normaliserCodeAnnulation,
  type Entreprise,
} from '../../../core/parametres';
import { EntrepriseRepository } from '../../../infrastructure/powersync/repositories/EntrepriseRepository';
import { inputClass } from '../../components/ui/FormField';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

interface Props {
  entreprise: Entreprise;
  peutModifier: boolean;
}

/**
 * Le code que le gérant donne pour autoriser l'annulation d'une vente.
 *
 * Il appartient à la filiale, pas à une personne : le gérant le dicte à qui se
 * trouve devant la caisse, et le change quand il veut, sans toucher aux
 * comptes. Seule son empreinte est enregistrée — le code ne se relit nulle
 * part, pas même ici : s'il est oublié, on en pose un nouveau.
 */
export default function SecuritePanel({ entreprise, peutModifier }: Props) {
  const repository = useRepository(EntrepriseRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  // `maxLength` n'est pas posé sur les champs : il couperait « A1B-2C3 » avant
  // que la normalisation n'ait retiré le tiret. C'est elle qui borne à six.
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);

  const defini = codeAnnulationDefini(entreprise.code_annulation);
  const motif = code ? motifCodeInvalide(code) : null;
  const discordance = confirmation.length > 0 && normaliserCodeAnnulation(confirmation) !== normaliserCodeAnnulation(code);
  const pret = peutModifier && !motif && !discordance && normaliserCodeAnnulation(code).length === LONGUEUR_CODE_ANNULATION
    && normaliserCodeAnnulation(confirmation) === normaliserCodeAnnulation(code);

  const enregistrer = async () => {
    setEnCours(true);
    try {
      await repository.enregistrerCodeAnnulation(entreprise.id, code);
      setCode('');
      setConfirmation('');
      notifier('succes', 'Code d’annulation enregistré. Il faut le donner pour annuler une vente.');
    } catch (erreur) {
      notifier('erreur', erreur instanceof Error ? erreur.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  const retirer = async () => {
    const ok = await confirmer({
      titre: 'Retirer le code d’annulation',
      message: 'Sans code, plus aucune vente ne pourra être annulée dans cette filiale — y compris une vente saisie par erreur. Vous pourrez en poser un nouveau à tout moment.',
      libelleConfirmer: 'Retirer le code',
      danger: true,
    });
    if (!ok) return;
    try {
      await repository.enregistrerCodeAnnulation(entreprise.id, null);
      notifier('succes', 'Code retiré. Aucune vente ne peut plus être annulée dans cette filiale.');
    } catch (erreur) {
      notifier('erreur', erreur instanceof Error ? erreur.message : 'Opération impossible.');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Annuler une vente</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">
          Annuler une vente remet la marchandise en stock, défait la créance du client et sort l'argent de la
          caisse. Le caissier doit donc taper un <strong>code de {LONGUEUR_CODE_ANNULATION} caractères</strong> que
          le gérant dicte au comptoir. Le code est vérifié sur le poste, même sans réseau.
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm" data-testid="etat-code-annulation">
          {defini ? (
            <><CheckCircleIcon className="h-5 w-5 text-green-600" /><span className="text-green-800">Un code est en place pour {entreprise.nom_commercial}.</span></>
          ) : (
            <><LockClosedIcon className="h-5 w-5 text-orange-500" /><span className="text-orange-800">Aucun code : <strong>aucune vente ne peut être annulée</strong> dans cette filiale.</span></>
          )}
        </p>
      </section>

      <section className="max-w-md space-y-4">
        <h3 className="text-sm font-semibold text-neutral-800">{defini ? 'Changer le code' : 'Choisir le code'}</h3>
        <label className="block text-xs font-medium text-neutral-700">
          Nouveau code
          <input
            value={code}
            onChange={(e) => setCode(normaliserCodeAnnulation(e.target.value))}
            disabled={!peutModifier}
            autoComplete="off"
            spellCheck={false}
            placeholder="A1B2C3"
            className={`${inputClass} mt-1 text-center font-mono text-xl tracking-[0.4em]`}
            data-testid="nouveau-code-annulation"
          />
        </label>
        <label className="block text-xs font-medium text-neutral-700">
          Répétez-le
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(normaliserCodeAnnulation(e.target.value))}
            disabled={!peutModifier}
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} mt-1 text-center font-mono text-xl tracking-[0.4em]`}
            data-testid="confirmer-code-annulation"
          />
        </label>
        {motif && <p className="text-sm text-red-600" data-testid="motif-code">{motif}</p>}
        {discordance && <p className="text-sm text-red-600">Les deux saisies diffèrent.</p>}
        <p className="text-xs text-neutral-500">
          Le code n'est pas enregistré en clair : il ne se relit nulle part. Oublié, il se remplace.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={enregistrer}
            disabled={!pret || enCours}
            className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 disabled:bg-neutral-300"
            data-testid="enregistrer-code-annulation"
          >
            Enregistrer le code
          </button>
          {defini && peutModifier && (
            <button type="button" onClick={retirer} className="rounded-lg px-4 py-2 font-medium text-red-600 hover:bg-red-50">
              Retirer le code
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
