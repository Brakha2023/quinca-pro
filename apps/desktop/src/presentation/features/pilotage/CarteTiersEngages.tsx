import { useState } from 'react';
import type { ComponentType } from 'react';
import { formaterFcfa, formaterPourcentage } from '../../../core/commun/prix';
import Carte from '../../components/ui/Carte';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { SERIE_UNIQUE } from './graphismes';
import HistogrammeActiviteTiers from './HistogrammeActiviteTiers';
import LienVoirPlus from './LienVoirPlus';
import { useActiviteTiers, type ClassementTiers, type TypeTiers } from './hooks';

/**
 * Les comptes les plus engagés d'un côté du grand livre : ceux qui nous
 * doivent le plus, ou ceux à qui nous devons le plus.
 *
 * Le même composant sert les deux : c'est le même geste de lecture, seule la
 * phrase change de bouche. Deux listes jumelles écrites deux fois finiraient
 * par ne plus dire la même chose du même chiffre.
 *
 * ### Pourquoi une ligne se clique
 *
 * Un gros solde pose toujours la même question : « depuis quand, et est-ce
 * qu'il paie ? ». Le total n'y répond pas — un client qui doit deux millions
 * parce qu'il achète deux millions par mois et règle chaque mois n'est pas le
 * dossier de celui qui doit autant sans avoir rien versé depuis six mois.
 * Cliquer une ligne déplie ses douze derniers mois, facturé contre réglé.
 *
 * ### En vue groupe
 *
 * Les comptes de toutes les filiales se mêlent dans le classement, ce qui est
 * exactement ce qu'un directeur veut voir. Mais une fiche client s'ouvre dans
 * une filiale : le lien « Ouvrir son compte » **bascule d'abord le périmètre**
 * sur celle du compte. Sans cela il mènerait à « Sélectionnez une filiale ».
 */

interface Props {
  type: TypeTiers;
  titre: string;
  sous: string;
  icone: ComponentType<{ className?: string }>;
  classement: ClassementTiers;
  /** L'écran qui détaille cette liste : la relance de l'un ou l'autre module. */
  lienListe: string | null;
  /** Le compte d'un tiers, dans son module. */
  cheminCompte: (id: string) => string;
  testId: string;
}

export default function CarteTiersEngages({ type, titre, sous, icone, classement, lienListe, cheminCompte, testId }: Props) {
  const { setFilialeId } = useFilialeCourante();
  const [selection, setSelection] = useState<string | null>(null);
  const choisi = classement.tiers.find((t) => t.id === selection) ?? null;
  const { serie } = useActiviteTiers(type, choisi?.id ?? null);

  const estClient = type === 'CLIENT';

  return (
    <Carte
      titre={titre}
      icone={icone}
      sous={<>{sous} · {formaterFcfa(classement.total)} au total</>}
      action={<LienVoirPlus to={lienListe} surFonce data-testid={`voir-${testId}`}>Tout voir</LienVoirPlus>}
      data-testid={`carte-${testId}`}
    >
      {classement.tiers.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">
          {estClient ? 'Aucun client ne doit quoi que ce soit.' : 'Aucune dette fournisseur ouverte.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {classement.lignes.map((l) => {
            const actif = l.cle === selection;
            return (
              <li key={l.cle}>
                <button
                  type="button"
                  // Rouvrir la ligne déjà ouverte la referme : c'est le geste
                  // attendu d'un dépliant, et il évite de rester coincé.
                  onClick={() => setSelection(actif ? null : l.cle)}
                  aria-expanded={actif}
                  className={`w-full rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-500 ${actif ? 'bg-primary-50' : ''}`}
                  data-testid={`tiers-${l.cle}`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-neutral-800" title={l.libelle}>
                      {l.libelle}
                      {l.detail && <span className="ml-2 font-mono text-xs text-neutral-400">{l.detail}</span>}
                    </span>
                    <span className="flex-shrink-0 font-mono text-sm font-semibold text-neutral-900">{formaterFcfa(l.valeur)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-sm bg-neutral-100">
                      <div
                        className="h-2 rounded-sm transition-[width]"
                        style={{ width: `${Math.max((l.valeur / classement.maximum) * 100, l.valeur > 0 ? 2 : 0)}%`, background: SERIE_UNIQUE }}
                      />
                    </div>
                    <span className="w-12 flex-shrink-0 text-right font-mono text-[10px] text-neutral-400">
                      {formaterPourcentage(l.part)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {choisi && (
        <div className="mt-4 border-t border-neutral-200 pt-3" data-testid={`activite-${testId}`}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">{choisi.nom}</p>
              <p className="text-xs text-neutral-500">
                {estClient ? 'doit' : 'à payer'} {formaterFcfa(choisi.solde)}
                {choisi.dateEffet ? ` · solde repris au ${choisi.dateEffet}` : ''} · 12 derniers mois
              </p>
            </div>
            {/* Le compte vit dans sa filiale : on l'ouvre en même temps que la
                fiche, sinon le lien tombe sur un écran qui réclame une filiale. */}
            <LienVoirPlus
              to={cheminCompte(choisi.id)}
              onClick={() => choisi.filialeId && setFilialeId(choisi.filialeId)}
              data-testid={`ouvrir-compte-${choisi.id}`}
            >
              Ouvrir son compte
            </LienVoirPlus>
          </div>
          <HistogrammeActiviteTiers
            serie={serie}
            libelleFacture={estClient ? 'Facturé' : 'Reçu'}
            libelleRegle={estClient ? 'Encaissé' : 'Payé'}
          />
        </div>
      )}
    </Carte>
  );
}
