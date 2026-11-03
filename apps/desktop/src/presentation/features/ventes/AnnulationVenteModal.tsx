import { useState } from 'react';
import { ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import Bouton from '../../components/ui/Bouton';
import { LONGUEUR_CODE_ANNULATION, codeAnnulationDefini, normaliserCodeAnnulation } from '../../../core/parametres';
import { VentesRepository, type VenteVueRow } from '../../../infrastructure/powersync/repositories/VentesRepository';
import Modal from '../../components/ui/Modal';
import { inputClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useEntreprise } from '../parametres/hooks';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';

interface Props {
  vente: VenteVueRow;
  filialeId: string;
  onClose: () => void;
  /** L'annulation est passée : l'écran appelant se referme. */
  onAnnulee: () => void;
}

/**
 * Annuler une vente : le motif, et le code du gérant.
 *
 * C'est le geste le plus lourd du comptoir — la marchandise revient en stock,
 * la créance du client se défait, l'argent ressort de la caisse. Il ne se fait
 * donc pas seul : le gérant dicte un code de six caractères, qu'on tape devant
 * lui. Le code est vérifié sur le poste, sans réseau (voir
 * `VentesRepository.verifierCodeAnnulation`).
 */
export default function AnnulationVenteModal({ vente, filialeId, onClose, onAnnulee }: Props) {
  const repository = useRepository(VentesRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const { entreprise } = useEntreprise(filialeId);
  const [motif, setMotif] = useState('');
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);

  const sansCode = entreprise != null && !codeAnnulationDefini(entreprise.code_annulation);
  const pret = motif.trim().length >= 3 && normaliserCodeAnnulation(code).length === LONGUEUR_CODE_ANNULATION;

  const annuler = async () => {
    setEnCours(true);
    try {
      await repository.annuler({ filialeId, utilisateurId: utilisateur?.id ?? null }, vente.id, motif.trim(), code);
      notifier('succes', `Vente ${vente.numero} annulée.`);
      onAnnulee();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Annulation impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal
      titre={`Annuler la vente ${vente.numero}`}
      sousTitre={`${formaterFcfa(vente.total_ttc)} · ${vente.client_nom ?? 'Client comptoir'}`}
      largeur="max-w-md"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Retour</button>
          <Bouton type="button" onClick={annuler} enCours={enCours} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" disabled={!pret || enCours} data-testid="confirmer-annulation">Confirmer l'annulation</Bouton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <span>La marchandise retourne en stock, la créance du client est défaite et l'encaissement ressort de la caisse. Cette opération ne se défait pas.</span>
        </p>

        <label className="block text-xs font-medium text-neutral-700">
          Motif de l'annulation
          <input value={motif} onChange={(e) => setMotif(e.target.value)} className={`${inputClass} mt-1`} autoFocus placeholder="Erreur de saisie, retour d'articles…" data-testid="motif-annulation" />
        </label>

        <label className="block text-xs font-medium text-neutral-700">
          Code du gérant ({LONGUEUR_CODE_ANNULATION} caractères)
          <div className="relative mt-1">
            <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              value={code}
              onChange={(e) => setCode(normaliserCodeAnnulation(e.target.value))}
              className={`${inputClass} pl-10 text-center font-mono text-xl tracking-[0.4em]`}
              autoComplete="off"
              spellCheck={false}
              placeholder="······"
              data-testid="code-annulation"
            />
          </div>
          <span className="mt-1 block text-xs font-normal text-neutral-500">
            Ce code est celui de la filiale : demandez-le au gérant, il le dicte au comptoir.
          </span>
        </label>

        {sansCode && (
          <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800" data-testid="sans-code-annulation">
            Aucun code n'est encore défini pour cette filiale : tant qu'il n'y en a pas, aucune vente ne peut être
            annulée. Le gérant le choisit dans <strong>Paramètres → Sécurité</strong>.
          </p>
        )}
      </div>
    </Modal>
  );
}
