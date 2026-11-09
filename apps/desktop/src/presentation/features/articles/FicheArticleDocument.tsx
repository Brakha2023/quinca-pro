import {
  LIBELLES_STATUT_STOCK,
  type Article,
  type IndicateursArticle,
  type StockDepot,
  type TotauxStock,
  type VentesArticle,
} from '../../../core/articles';
import { LIBELLES_MOUVEMENT, SENS_MOUVEMENT } from '../../../core/stock';
import type { TypeMouvementStock } from '@quinca/shared-types';
import CodeBarres from '../../components/print/CodeBarres';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import type { MouvementVue } from '../stock/hooks';

export interface VenteMois {
  mois: string;
  nombre_ventes: number;
  quantite: number;
  total_ht: number;
  total_ttc: number;
}

interface Props {
  article: Article;
  familleNom: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  stock: StockDepot[];
  totaux: TotauxStock;
  indicateurs: IndicateursArticle;
  ventes: VentesArticle;
  ventesMensuelles: VenteMois[];
  mouvements: MouvementVue[];
  periode: string;
  onClose: () => void;
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** `2026-10` → « octobre 2026 ». */
function libelleMois(mois: string): string {
  const [annee, numero] = mois.split('-');
  const index = Number(numero) - 1;
  return MOIS[index] ? `${MOIS[index]} ${annee}` : mois;
}

const quantite = (valeur: number, unite: string) => `${valeur.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${unite}`;

/** Rapport A4 d'un article : identification, tarifs, stock par dépôt, ventes et mouvements. */
export default function FicheArticleDocument({
  article, familleNom, filiale, stock, totaux, indicateurs, ventes, ventesMensuelles, mouvements, periode, onClose,
}: Props) {
  return (
    <DocumentImprimable titre={`Fiche article — ${article.code}`} filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Identification</strong>
          Code : {article.code}
          <br />Désignation : {article.designation}
          <br />Famille : {familleNom}
          {article.sous_famille ? <><br />Sous-famille : {article.sous_famille}</> : null}
          <br />Unité : {article.unite} · TVA : {article.tva} %
          <br />État : {article.est_actif ? 'Actif' : 'Inactif'}
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Tarifs</strong>
          Prix d'achat : {formaterFcfa(article.prix_achat)}
          <br />Prix de vente : {formaterFcfa(article.prix_vente)}
          <br />Prix VIP : {article.prix_vip != null ? formaterFcfa(article.prix_vip) : 'non défini'}
          <br />Marge : {formaterFcfa(indicateurs.marge_valeur)} ({indicateurs.marge_percent} %)
          {indicateurs.marge_vip_percent != null ? <><br />Marge VIP : {indicateurs.marge_vip_percent} %</> : null}
        </div>
        <div className="document-bloc" style={{ flex: 1 }}>
          <strong className="document-bloc-titre">Stock</strong>
          Quantité : {quantite(totaux.quantite, article.unite)}
          <br />Réservée : {quantite(totaux.reservee, article.unite)}
          <br />Disponible : {quantite(totaux.disponible, article.unite)}
          <br />Seuils : min {article.stock_min} · max {article.stock_max || '—'}
          <br />État : {LIBELLES_STATUT_STOCK[indicateurs.statut_stock]}
        </div>
      </div>

      <h2 style={{ fontSize: 12, textTransform: 'uppercase', margin: '10px 0 0' }}>Stock par dépôt</h2>
      <table>
        <thead>
          <tr><th>Dépôt</th><th>Quantité</th><th>Réservée</th><th>Disponible</th><th>Coût moyen</th><th>Valeur</th><th>Dernier mouvement</th></tr>
        </thead>
        <tbody>
          {stock.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: 'center' }}>Aucune ligne de stock pour cet article.</td></tr>
          ) : (
            stock.map((l) => (
              <tr key={l.depot_id}>
                <td>{l.depot_nom}</td>
                <td className="num">{l.quantite}</td>
                <td className="num">{l.quantite_reservee}</td>
                <td className="num">{l.quantite_disponible}</td>
                <td className="num">{formaterFcfa(l.cout_moyen)}</td>
                <td className="num">{formaterFcfa(l.quantite * l.cout_moyen)}</td>
                <td>{formaterDate(l.date_dernier_mouvement) || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <th className="num">{totaux.quantite}</th>
            <th className="num">{totaux.reservee}</th>
            <th className="num">{totaux.disponible}</th>
            <th />
            <th className="num">{formaterFcfa(totaux.valeur)}</th>
            <th />
          </tr>
        </tfoot>
      </table>

      <h2 style={{ fontSize: 12, textTransform: 'uppercase', margin: '10px 0 0' }}>Activité — {periode}</h2>
      <table>
        <tbody>
          <tr>
            <th>Quantité vendue</th><td className="num">{quantite(ventes.quantite, article.unite)}</td>
            <th>Nombre de ventes</th><td className="num">{ventes.nombre_ventes}</td>
          </tr>
          <tr>
            <th>Chiffre d'affaires HT</th><td className="num">{formaterFcfa(ventes.total_ht)}</td>
            <th>Chiffre d'affaires TTC</th><td className="num">{formaterFcfa(ventes.total_ttc)}</td>
          </tr>
          <tr>
            <th>Dernière vente</th><td className="num">{ventes.derniere_date ? formaterDate(ventes.derniere_date) : '—'}</td>
            <th>Dernier prix pratiqué</th><td className="num">{ventes.dernier_prix != null ? formaterFcfa(ventes.dernier_prix) : '—'}</td>
          </tr>
          <tr>
            <th>Écoulement moyen</th><td className="num">{ventes.quantite > 0 ? `${indicateurs.vente_par_jour} / jour` : '—'}</td>
            <th>Couverture du stock</th><td className="num">{indicateurs.couverture_jours != null ? `${indicateurs.couverture_jours} jours` : '—'}</td>
          </tr>
          <tr>
            <th>Valeur du stock (achat)</th><td className="num">{formaterFcfa(indicateurs.valeur_achat)}</td>
            <th>Marge potentielle</th><td className="num">{formaterFcfa(indicateurs.marge_potentielle)}</td>
          </tr>
        </tbody>
      </table>

      {ventesMensuelles.length > 0 && (
        <>
          <h2 style={{ fontSize: 12, textTransform: 'uppercase', margin: '10px 0 0' }}>Ventes mois par mois</h2>
          <table>
            <thead>
              <tr><th>Mois</th><th>Ventes</th><th>Quantité</th><th>CA HT</th><th>CA TTC</th></tr>
            </thead>
            <tbody>
              {ventesMensuelles.map((m) => (
                <tr key={m.mois}>
                  <td>{libelleMois(m.mois)}</td>
                  <td className="num">{m.nombre_ventes}</td>
                  <td className="num">{m.quantite}</td>
                  <td className="num">{formaterFcfa(m.total_ht)}</td>
                  <td className="num">{formaterFcfa(m.total_ttc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {mouvements.length > 0 && (
        <>
          <h2 style={{ fontSize: 12, textTransform: 'uppercase', margin: '10px 0 0' }}>Derniers mouvements de stock</h2>
          <table>
            <thead>
              <tr><th>Date</th><th>Nature</th><th>Dépôt</th><th>Qté</th><th>Avant</th><th>Après</th><th>Référence</th></tr>
            </thead>
            <tbody>
              {mouvements.map((m) => {
                const type = (m.type ?? 'AJUSTEMENT') as TypeMouvementStock;
                return (
                  <tr key={m.id}>
                    <td>{formaterDate(m.created_at)}</td>
                    <td>{LIBELLES_MOUVEMENT[type]}</td>
                    <td>{m.depot_nom ?? '—'}</td>
                    <td className="num">{SENS_MOUVEMENT[type] < 0 ? '−' : ''}{m.quantite}</td>
                    <td className="num">{m.quantite_avant}</td>
                    <td className="num">{m.quantite_apres}</td>
                    <td>{m.reference ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <div className="recu-pied">
        <CodeBarres valeur={article.code} />
        <p style={{ margin: 0, fontSize: 10 }}>Édité le {new Date().toLocaleString('fr-FR')}</p>
      </div>
      <div className="recu-signatures">
        <span>Le magasinier</span>
        <span>Le gérant</span>
      </div>
    </DocumentImprimable>
  );
}
