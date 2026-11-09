import type { ModePaiement, StatutVente } from '@quinca/shared-types';
import {
  LIBELLES_MODE_PAIEMENT,
  LIBELLES_STATUT_VENTE,
  perimetreJournalVentes,
  recapJournalVentes,
} from '../../../core/ventes';
import type { VenteVueRow } from '../../../infrastructure/powersync/repositories/VentesRepository';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { formaterDateHeure } from './VenteDetailsModal';

interface Props {
  ventes: VenteVueRow[];
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filtres: { dateDebut: string; dateFin: string; caisseNom: string | null; statutLabel: string | null; recherche: string; montantTtc?: number | null };
  onClose: () => void;
}

/** Journal des ventes A4 : la journée de caisse telle qu'on la classe et qu'on la signe. */
export default function JournalVentesDocument({ ventes, filiale, filtres, onClose }: Props) {
  const recap = recapJournalVentes(ventes);
  const edite = formaterDate(new Date().toISOString());

  return (
    <DocumentImprimable titre="Journal des ventes" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Périmètre</strong>
          {perimetreJournalVentes(filtres)}
          <br />Édité le {edite}
        </div>
        <div className="document-bloc" style={{ width: '72mm' }}>
          <strong>{recap.nombre} vente(s) · {formaterFcfa(recap.chiffre_affaires)} TTC</strong>
          <br />Encaissé : {formaterFcfa(recap.encaisse)}
          {recap.par_mode.length > 0 && (
            <><br />{recap.par_mode.map((m) => `${LIBELLES_MODE_PAIEMENT[m.mode as ModePaiement] ?? m.mode} ${formaterFcfa(m.montant)}`).join(' · ')}</>
          )}
          <br />Vendu à crédit : {formaterFcfa(recap.credit)}
          <br />En attente de validation : {recap.en_attente}
          {recap.annulees > 0 && <><br />{recap.annulees} vente(s) annulée(s), hors totaux</>}
        </div>
      </div>

      <table className="document-liste">
        <thead>
          <tr>
            <th>Date</th>
            <th>Ticket</th>
            <th>Client</th>
            <th>Caisse</th>
            <th>Vendeur</th>
            <th className="num">Total TTC</th>
            <th className="num">Perçu</th>
            <th className="num">Reste dû</th>
            <th>Mode</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {ventes.map((v) => (
            <tr key={v.id} data-testid="ligne-journal-vente">
              <td>{formaterDateHeure(v.date_vente)}</td>
              {/* Le numéro court est celui que porte l'exemplaire du client :
                  c'est sur lui qu'on rapproche un ticket présenté au comptoir. */}
              <td className="document-code">{v.numero_court ?? v.numero}</td>
              <td>{v.client_nom ?? 'Comptoir'}</td>
              <td>{v.caisse_nom ?? '—'}</td>
              <td>{[v.utilisateur_prenom, v.utilisateur_nom].filter(Boolean).join(' ') || '—'}</td>
              <td className="num">{formaterFcfa(v.total_ttc)}</td>
              <td className="num">{formaterFcfa((v.montant_percu ?? 0) - (v.monnaie ?? 0))}</td>
              <td className="num">{formaterFcfa(v.reste_a_payer)}</td>
              <td>{LIBELLES_MODE_PAIEMENT[(v.mode_paiement ?? 'ESPECES') as ModePaiement]}</td>
              <td>{LIBELLES_STATUT_VENTE[(v.statut ?? 'EN_ATTENTE') as StatutVente]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={10} className="document-liste-pied">
              Journal des ventes · {filiale.nom} · {perimetreJournalVentes(filtres)} · édité le {edite}
            </td>
          </tr>
        </tfoot>
      </table>

      {ventes.length === 0 && <p>Aucune vente sur la période.</p>}

      <p className="document-visa">Visa du gérant<span /></p>
    </DocumentImprimable>
  );
}
