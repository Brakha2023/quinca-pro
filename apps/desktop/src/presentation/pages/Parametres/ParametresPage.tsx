import { useState } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { BuildingOffice2Icon } from '@heroicons/react/24/outline';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { usePermissions } from '../../auth/usePermissions';
import DocumentsPanel from '../../features/parametres/DocumentsPanel';
import EntreprisePanel from '../../features/parametres/EntreprisePanel';
import FiscalitePanel from '../../features/parametres/FiscalitePanel';
import NumerotationPanel from '../../features/parametres/NumerotationPanel';
import SecuritePanel from '../../features/parametres/SecuritePanel';
import PreferencesPanel from '../../features/parametres/PreferencesPanel';
import RolesPanel from '../../features/parametres/RolesPanel';
import UtilisateursPanel from '../../features/parametres/UtilisateursPanel';
import { useEntreprise } from '../../features/parametres/hooks';
import {
  SECTIONS_PARAMETRES, SECTION_PARAMETRES_DEFAUT, cheminParametres, estSectionParametres, ongletParametres,
} from './onglets';

/**
 * Paramètres de la maison.
 *
 * Sept sections, et le partage est net : les quatre premières décrivent la
 * **filiale** — qui elle est, ce qu'elle doit au fisc, à quoi ressemblent ses
 * papiers, comment elle numérote. Les deux suivantes disent **qui fait quoi**.
 * La dernière ne parle que de **cette machine-ci** et ne se synchronise pas.
 *
 * L'écran ne crée pas de compte de connexion : c'est Supabase qui les porte,
 * et c'est voulu — un mot de passe ne se fabrique pas depuis un poste de caisse.
 */
export default function ParametresPage() {
  const { section } = useParams();
  const { utilisateur, filiale, filiales, filialeId, estDirecteur } = useFilialeCourante();
  const { peut, isLoading } = usePermissions();

  // Un directeur en vue consolidée n'a pas de filiale : les paramètres
  // décrivent un établissement, il faut donc en désigner un.
  const [choisie, setChoisie] = useState<string | null>(null);
  const filialeReglee = filialeId ?? choisie ?? filiales[0]?.id ?? null;
  const nomFilialeReglee = filiales.find((f) => f.id === filialeReglee)?.nom ?? filiale?.nom ?? '—';

  const { entreprise, isLoading: ficheEnCours, absente } = useEntreprise(filialeReglee);

  if (!estSectionParametres(section)) return <Navigate to={cheminParametres(SECTION_PARAMETRES_DEFAUT)} replace />;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center text-neutral-400 shadow-sm">
        Lecture de votre rôle…
      </div>
    );
  }

  // Le menu ne mène pas ici sans la permission, mais l'URL se tape à la main.
  if (!peut('parametres.lire')) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center shadow-sm">
        <p className="text-lg text-neutral-700">Les paramètres ne vous sont pas ouverts.</p>
        <p className="mt-2 text-sm text-neutral-500">Demandez la permission « Ouvrir les paramètres » au superadministrateur.</p>
      </div>
    );
  }

  const onglet = ongletParametres(section);
  const infosFiliale = { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };
  const peutModifierEntreprise = peut('parametres.entreprise');
  /** Les quatre premières sections décrivent une filiale : elles ont besoin de sa fiche. */
  const surLaFiliale = ['entreprise', 'fiscalite', 'documents', 'numerotation', 'securite'].includes(section);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Paramètres · {onglet.label}</h1>
          <p className="mt-1 text-sm text-neutral-500">{onglet.accroche}</p>
        </div>
        {surLaFiliale && estDirecteur && filiales.length > 1 && (
          <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
            <BuildingOffice2Icon className="h-4 w-4 text-neutral-400" />
            <span className="sr-only">Filiale réglée</span>
            <select
              value={filialeReglee ?? ''}
              onChange={(e) => setChoisie(e.target.value)}
              className="border-0 bg-transparent text-sm font-medium text-neutral-800 focus:outline-none focus:ring-0"
              data-testid="filiale-reglee"
            >
              {filiales.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex overflow-x-auto border-b border-neutral-200 bg-neutral-50 print:hidden">
          {SECTIONS_PARAMETRES.map((s) => (
            <NavLink
              key={s.id}
              to={cheminParametres(s.id)}
              className={({ isActive }) =>
                `flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive ? 'border-primary-600 bg-white text-primary-700' : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`
              }
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </NavLink>
          ))}
        </div>

        <div className="p-6">
          {surLaFiliale && ficheEnCours && (
            <p className="py-16 text-center text-neutral-400">Lecture de la fiche de la filiale…</p>
          )}

          {surLaFiliale && !ficheEnCours && !entreprise && (
            <div className="py-16 text-center" data-testid="fiche-absente">
              <p className="text-lg text-neutral-700">
                {absente
                  ? `Aucune fiche de configuration pour ${nomFilialeReglee}.`
                  : 'Aucune filiale à régler sur ce poste.'}
              </p>
              <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-500">
                {absente
                  ? 'Le serveur en pose une par filiale (migration 20261025000000). Si elle n’arrive pas, les règles de synchronisation n’ont pas été redéployées — PowerSync → Sync Streams → Deploy.'
                  : 'Les filiales se synchronisent comme le reste ; elles arriveront.'}
              </p>
            </div>
          )}

          {surLaFiliale && entreprise && (
            <>
              {!peutModifierEntreprise && (
                <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Vous consultez ces réglages sans pouvoir les modifier : cela demande la permission
                  « Modifier l'identité et les papiers de l'entreprise ».
                </p>
              )}
              {section === 'entreprise' && <EntreprisePanel entreprise={entreprise} peutModifier={peutModifierEntreprise} />}
              {section === 'fiscalite' && <FiscalitePanel entreprise={entreprise} peutModifier={peutModifierEntreprise} />}
              {section === 'documents' && <DocumentsPanel entreprise={entreprise} peutModifier={peutModifierEntreprise} />}
              {section === 'numerotation' && <NumerotationPanel entreprise={entreprise} peutModifier={peutModifierEntreprise} />}
              {section === 'securite' && <SecuritePanel entreprise={entreprise} peutModifier={peutModifierEntreprise} />}
            </>
          )}

          {section === 'roles' && <RolesPanel filiale={infosFiliale} peutModifier={peut('parametres.roles')} />}
          {section === 'utilisateurs' && (
            <UtilisateursPanel
              filiale={infosFiliale}
              filiales={filiales.map((f) => ({ id: f.id, nom: f.nom ?? '' }))}
              utilisateurCourantId={utilisateur?.id ?? null}
              peutModifier={peut('parametres.utilisateurs')}
            />
          )}
          {section === 'preferences' && <PreferencesPanel filialeId={filialeReglee} filialeNom={nomFilialeReglee} />}
        </div>
      </div>

      {surLaFiliale && entreprise?.updated_at && (
        <p className="text-xs text-neutral-400">
          Dernière modification de cette fiche : {new Date(entreprise.updated_at).toLocaleString('fr-FR')}
        </p>
      )}
    </div>
  );
}
