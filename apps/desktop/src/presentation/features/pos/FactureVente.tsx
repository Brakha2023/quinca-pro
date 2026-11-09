import { createPortal } from 'react-dom';
import {
  CalendarDaysIcon, ClockIcon, CreditCardIcon, InformationCircleIcon, MapPinIcon, UserIcon,
} from '@heroicons/react/24/solid';
import { montantEnLettresFcfa } from '../../../core/commun/montantEnLettres';
import { enteteDocument } from '../../../core/parametres';
import { LIBELLES_MODE_PAIEMENT, type LigneFacture, type RecapFacture } from '../../../core/ventes';
import type { ModePaiement } from '@quinca/shared-types';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import CodeBarres from '../../components/print/CodeBarres';
import { useEntrepriseDocument } from '../parametres/hooks';

/** Identité du client telle qu'elle s'imprime dans le cartouche. */
export interface ClientFacture {
  raison_sociale: string;
  numero_rc?: string | null;
  numero_cc?: string | null;
  adresse?: string | null;
  contact?: string | null;
  mobile?: string | null;
}

interface Props {
  numero: string;
  /**
   * Numéro court de la vente (`VNT-AN8-000075`) : c'est lui qui s'imprime en
   * tête. Absent sur les ventes d'avant la série courte, qui s'impriment avec
   * leur numéro long, comme elles l'ont toujours fait.
   */
  numeroCourt?: string | null;
  date: Date;
  vendeur: string;
  client: ClientFacture | null;
  lignes: LigneFacture[];
  recap: RecapFacture;
  modePaiement: ModePaiement;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  /** Bandeau en tête du document, ex. « FACTURE ANNULÉE » : une facture annulée
   *  ne doit pas pouvoir ressortir muette de l'imprimante. */
  mention?: string;
  /** À qui revient cet exemplaire, quand la facture sort en plusieurs copies. */
  exemplaire?: string | null;
}

/** Montant à deux décimales, sans devise (la facture annonce « en FCFA » une fois). */
const montant = (valeur: number) => valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Les totaux s'arrêtent au franc : le FCFA n'a pas de centimes. */
const entier = (valeur: number) => Math.round(valeur).toLocaleString('fr-FR');

/** Modes de paiement proposés en pied de facture, hors crédit (porté par COMPTANT / CRÉDIT). */
const MODES_COCHES: ModePaiement[] = ['ESPECES', 'CHEQUE', 'MOBILE_MONEY'];

/** Une case à cocher imprimée, déjà cochée quand la vente le dit. */
function Case({ coche, libelle }: { coche: boolean; libelle: string }) {
  return (
    <span className="facture-case-groupe">
      <span className="facture-case-libelle">{libelle}</span>
      <span className="facture-case">{coche ? '✓' : ''}</span>
    </span>
  );
}

/**
 * Un repère en tête de facture : une icône, ce que c'est, et sa valeur.
 *
 * Date, heure et opérateur ne se lisent pas en colonnes — on y jette un œil
 * pour situer la pièce. Les poser en tuiles plutôt qu'en tableau les rend
 * lisibles d'un coup, et laisse la grille aux lignes de vente.
 */
function Repere({ icone: Icone, nom, valeur }: { icone: typeof ClockIcon; nom: string; valeur: string }) {
  return (
    <div className="facture-repere">
      <Icone className="document-icone" aria-hidden />
      <div>
        <p className="facture-repere-nom">{nom}</p>
        <p className="facture-repere-valeur">{valeur}</p>
      </div>
    </div>
  );
}

/**
 * Facture A4 d'une vente, sans portail : la feuille seule, pour qui décide où
 * la rendre — seule à l'impression, ou répétée dans une liasse.
 *
 * Les montants arrivent déjà calculés : la même mise en page sert à la vente
 * qui vient d'être encaissée et à la réédition d'une facture plus ancienne.
 *
 * C'est la seule pièce de l'application qui parte chez le client, et la seule
 * à porter des bandeaux noirs : ce qui est noir ici est ce que le client lit
 * en premier — qui il est, ce qu'il emporte, ce qu'il doit. Le reste de
 * l'application imprime en gris (voir `.facture` dans `index.css`).
 *
 * L'en-tête et le pied viennent de **Paramètres → Entreprise**, comme pour
 * toutes les autres pièces : logo, adresse, mentions. La facture les ignorait
 * et portait un « Q.C.F » écrit en dur — une maison qui changeait de nom
 * l'imprimait quand même.
 */
export function CorpsFacture({ numero, numeroCourt, date, vendeur, client, lignes, recap, modePaiement, filiale, mention, exemplaire }: Props) {
  const { filialeId } = useFilialeCourante();
  const entreprise = useEntrepriseDocument(filialeId);
  const entete = enteteDocument(entreprise, filiale, entreprise?.documents.facture);
  const adresse = [entete.adresse, entete.ville].filter(Boolean).join(' — ');

  return (
    <div className="document facture">
      {entete.filigrane && <img src={entete.filigrane} alt="" aria-hidden className="document-filigrane" />}
      <header className="facture-entete">
        {entete.logo
          ? <img src={entete.logo} alt="" className="document-logo-image" data-testid="document-logo" />
          : <div className="document-logo">{entete.initiales}</div>}
        <p className="facture-filiale"><MapPinIcon className="document-icone" aria-hidden />{filiale.nom}</p>
        <div className="facture-intitule">
          <p className="facture-nom-piece">Facture</p>
          {/* Le court en tête, le long dans le code-barres : l'un se dicte au
              téléphone, l'autre se douchette et identifie la pièce. */}
          <p className="facture-numero-piece">N° <span data-testid="facture-numero">{numeroCourt || numero}</span></p>
          <p className="facture-moment">
            <CalendarDaysIcon className="document-icone" aria-hidden />
            {date.toLocaleDateString('fr-FR')} · {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </header>

      {mention && <p className="facture-mention" data-testid="facture-mention">{mention}</p>}
      {exemplaire && <p className="facture-exemplaire" data-testid="facture-exemplaire">{exemplaire}</p>}

      <div className="facture-haut">
        <div className="facture-haut-gauche">
          <div className="facture-reperes">
            <Repere icone={CalendarDaysIcon} nom="Date" valeur={date.toLocaleDateString('fr-FR')} />
            <Repere icone={ClockIcon} nom="Heure" valeur={date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} />
          </div>
          <div className="facture-reperes">
            <Repere icone={UserIcon} nom="Op. saisie" valeur={vendeur || '—'} />
          </div>
        </div>
        <CodeBarres valeur={numero} />
        <table className="facture-client">
          <thead>
            <tr className="facture-client-titre">
              <th>Client</th>
              <th>{client ? client.raison_sociale : 'CLIENT DIVERS'}</th>
            </tr>
          </thead>
          <tbody>
            <tr><th>N° RC</th><td>{client?.numero_rc || '—'}</td></tr>
            <tr><th>N° CC</th><td>{client?.numero_cc || '—'}</td></tr>
            <tr><th>Adresse</th><td>{client?.adresse || '—'}</td></tr>
            <tr><th>Contact</th><td>{client?.contact || client?.mobile || '—'}</td></tr>
          </tbody>
        </table>
      </div>

      <table className="facture-lignes">
        <thead>
          <tr><th>CODE/RÉF</th><th>DÉSIGNATION</th><th>QTE</th><th>PRIX U. HT</th><th>REMISE</th><th>TOTAL HT</th><th>TVA</th><th>DÉPÔT</th></tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.code}>
              <td>{l.code}</td>
              <td>{l.designation}</td>
              <td className="num">{montant(l.quantite)}</td>
              <td className="num">{montant(l.prix_unitaire_ht)}</td>
              <td className="num">{montant(l.remise)}</td>
              <td className="num">{montant(l.total_ht)}</td>
              <td className="num">{montant(l.tva)}</td>
              <td>{l.depot}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="facture-bas">
        <div className="facture-signature">
          <p className="facture-signature-titre">Cachet / Signature</p>
          <div className="facture-signature-cadre" />
        </div>
        <table className="facture-paiement">
          <tbody>
            <tr><th>MONTANT PAYÉ</th><td className="num" data-testid="facture-paye">{entier(recap.montant_paye)}</td></tr>
            <tr><th>RESTE À PAYER</th><td className="num">{entier(recap.reste_a_payer)}</td></tr>
            <tr><th>AVOIR</th><td className="num">{entier(recap.avoir)}</td></tr>
          </tbody>
        </table>
        <div className="facture-totaux-bloc">
          <p className="facture-totaux-titre">Détails des montants <em>(en FCFA)</em></p>
          <table className="facture-totaux">
            <tbody>
              <tr><th>MONTANT BRUT HT</th><td className="num">{entier(recap.brut_ht)}</td></tr>
              <tr><th>REMISE</th><td className="num">{entier(recap.remise)}</td></tr>
              <tr><th>MONTANT NET HT</th><td className="num">{entier(recap.net_ht)}</td></tr>
              <tr><th>TOTAL TVA</th><td className="num">{entier(recap.tva)}</td></tr>
              <tr className="facture-net"><th>NET À PAYER</th><td className="num" data-testid="facture-net">{entier(recap.net_a_payer)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="document-arrete facture-arrete">
        <span>Arrêté la présente facture à la somme de :</span>
        <strong data-testid="facture-lettres">{montantEnLettresFcfa(recap.net_a_payer)}</strong>
      </p>

      <div className="facture-reglement">
        <span className="facture-reglement-intitule">
          <CreditCardIcon className="document-icone" aria-hidden />
          <span>Conditions<br />de règlement :</span>
        </span>
        <span className="facture-reglement-cases">
          {MODES_COCHES.map((m) => <Case key={m} coche={modePaiement === m} libelle={LIBELLES_MODE_PAIEMENT[m]} />)}
          <span className="facture-reglement-nature">
            <Case coche={recap.comptant} libelle="COMPTANT" />
            <Case coche={!recap.comptant} libelle="CRÉDIT" />
          </span>
        </span>
      </div>

      {(adresse || entete.mentions_legales) && (
        <div className="document-pied">
          {adresse && (
            <span className="document-pied-mention">
              <MapPinIcon className="document-icone" aria-hidden />
              <p>{adresse}</p>
            </span>
          )}
          {entete.mentions_legales && (
            <span className="document-pied-mention" data-testid="document-mentions">
              <InformationCircleIcon className="document-icone" aria-hidden />
              <p>{entete.mentions_legales}</p>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** La facture seule dans la zone d'impression : réédition, vente du comptoir. */
export default function FactureVente(props: Props) {
  return createPortal(
    <div id="zone-impression"><CorpsFacture {...props} /></div>,
    document.body,
  );
}
