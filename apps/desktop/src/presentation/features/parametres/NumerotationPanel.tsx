import { useState } from 'react';
import { NATURES_DOCUMENTS, normaliserPrefixe, prefixesParDefaut, type Entreprise } from '../../../core/parametres';
import { LONGUEUR_SEQUENCE, LONGUEUR_SUFFIXE, genererNumeroPiece } from '../../../core/commun/numerotation';
import { codePoste } from '../../../infrastructure/desktop/identitePoste';
import { EntrepriseRepository } from '../../../infrastructure/powersync/repositories/EntrepriseRepository';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

interface Props {
  entreprise: Entreprise;
  peutModifier: boolean;
}

/**
 * Préfixes de numérotation, nature par nature.
 *
 * Un numéro se dicte au téléphone : le préfixe est donc borné, sans accent ni
 * tiret (voir `normaliserPrefixe`). Le reste du numéro — le code du poste, la
 * date, le tirage — ne se règle pas : c'est lui qui garantit qu'aucune pièce
 * n'en double une autre, même hors ligne.
 */
export default function NumerotationPanel({ entreprise, peutModifier }: Props) {
  const repository = useRepository(EntrepriseRepository);
  const notifier = useNotifier();
  const poste = codePoste();
  const [prefixes, setPrefixes] = useState<Record<string, string>>(entreprise.prefixes);
  const [enCours, setEnCours] = useState(false);

  const modifie = JSON.stringify(prefixes) !== JSON.stringify(entreprise.prefixes);

  const enregistrer = async () => {
    setEnCours(true);
    try {
      await repository.enregistrerPrefixes(entreprise.id, prefixes);
      notifier('succes', 'Préfixes enregistrés. Les pièces créées ensuite les porteront.');
    } catch (erreur) {
      notifier('erreur', erreur instanceof Error ? erreur.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Comment un numéro est composé</h3>
        <p className="mt-2 font-mono text-sm text-neutral-800">
          <span className="rounded bg-primary-100 px-1.5 py-0.5 text-primary-800">PRÉFIXE</span>
          {' - '}<span className="rounded bg-neutral-200 px-1.5 py-0.5">{poste}</span>
          {' - '}<span className="rounded bg-neutral-200 px-1.5 py-0.5">AAAAMMJJ</span>
          {' - '}<span className="rounded bg-neutral-200 px-1.5 py-0.5">{'X'.repeat(LONGUEUR_SUFFIXE)}</span>
        </p>
        <p className="mt-2 font-mono text-sm text-neutral-800">
          <span className="rounded bg-primary-100 px-1.5 py-0.5 text-primary-800">PRÉFIXE</span>
          {' - '}<span className="rounded bg-neutral-200 px-1.5 py-0.5">{poste}</span>
          {' - '}<span className="rounded bg-neutral-200 px-1.5 py-0.5">{'0'.repeat(LONGUEUR_SEQUENCE)}</span>
          <span className="ml-3 font-sans text-xs text-neutral-500">numéro court, imprimé en tête des pièces</span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-600">
          Chaque pièce porte <strong>deux numéros</strong>. Le long identifie la pièce et part dans le
          code-barres ; le <strong>court</strong> est celui qui s'imprime en tête, se dicte au téléphone et se
          recopie sur un cahier. Son compteur est propre à <strong>cette machine</strong> : un compteur commun à
          la filiale ne pourrait pas être attribué hors ligne, deux caisses qui vendent en même temps
          tireraient le même numéro.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-600">
          Seul le préfixe se règle. Le <strong>code de ce poste</strong> ({poste}) est
          tiré une fois par machine et cloisonne les numéros : deux caisses ne peuvent pas tirer le même.
          La date et le tirage final font le reste — un doublon reste possible en théorie, et le serveur
          le refuserait.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {NATURES_DOCUMENTS.map((n) => {
          const valeur = prefixes[n.id] ?? n.prefixe_defaut;
          const exemple = genererNumeroPiece({ prefixe: valeur || n.prefixe_defaut, poste });
          return (
            <div key={n.id} className="rounded-xl border border-neutral-200 p-4" data-testid={`numerotation-${n.id}`}>
              <label className="block text-sm font-medium text-neutral-800" htmlFor={`prefixe-${n.id}`}>{n.libelle}</label>
              <input
                id={`prefixe-${n.id}`}
                value={valeur}
                disabled={!peutModifier}
                maxLength={5}
                onChange={(e) => setPrefixes((p) => ({ ...p, [n.id]: normaliserPrefixe(e.target.value) }))}
                className="mt-2 w-28 rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-50"
                data-testid={`prefixe-${n.id}`}
              />
              <p className="mt-2 truncate font-mono text-[11px] text-neutral-400" title={exemple}>{exemple}</p>
            </div>
          );
        })}
      </div>

      {peutModifier && (
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
          {modifie && <span className="text-xs text-amber-700">Modifications non enregistrées.</span>}
          <button type="button" onClick={() => setPrefixes(prefixesParDefaut())}
                  className="rounded-lg px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-100">
            Revenir aux préfixes livrés
          </button>
          <button type="button" onClick={() => void enregistrer()} disabled={enCours || !modifie}
                  data-testid="enregistrer-numerotation"
                  className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-neutral-300">
            {enCours ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      )}
    </div>
  );
}
