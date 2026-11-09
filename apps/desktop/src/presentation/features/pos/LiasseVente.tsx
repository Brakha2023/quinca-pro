import { Fragment } from 'react';
import { createPortal } from 'react-dom';
import {
  feuillesAImprimer, lignesBonLivraison, lignesFacture, recapFacture,
  type LignePanier, type LivraisonDemande, type SortiePapier, type VentePreparee,
} from '../../../core/ventes';
import type { ModePaiement } from '@quinca/shared-types';
import BonLivraisonVente from './BonLivraisonVente';
import { CorpsFacture, type ClientFacture } from './FactureVente';

interface Props {
  sortie: Exclude<SortiePapier, 'TICKET'>;
  preparee: VentePreparee;
  lignes: LignePanier[];
  client: ClientFacture | null;
  /** Avance disponible du client au moment de la vente. */
  avoir: number;
  date: Date;
  vendeur: string;
  /** Nom du dépôt d'où sort la marchandise. */
  depot: string;
  livraison: LivraisonDemande | null;
  numeroLivraison: string | null;
  /** Numéro court de la vente (`VNT-AN8-000075`), imprimé en tête de la facture. */
  numeroCourt: string | null;
  /** Numéro court du bon de livraison, quand une livraison a été créée. */
  numeroCourtLivraison: string | null;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/**
 * La liasse d'une vente, dans la zone d'impression : les feuilles à la file,
 * une page chacune (voir `.liasse` dans `index.css`).
 *
 * Le navigateur ne sait pas demander deux copies à l'imprimante — la boîte du
 * système le permet, mais le caissier ne doit pas avoir à y penser. La facture
 * est donc **rendue deux fois**, chaque exemplaire nommé pour qu'on sache
 * lequel reste à la maison. Ce qui sort est décidé par `feuillesAImprimer`.
 */
export default function LiasseVente({
  sortie, preparee, lignes, client, avoir, date, vendeur, depot, livraison, numeroLivraison, numeroCourt, numeroCourtLivraison, filiale,
}: Props) {
  const facture = {
    numero: preparee.numero,
    numeroCourt,
    date,
    vendeur,
    client,
    lignes: lignesFacture(lignes, depot),
    recap: recapFacture(preparee, avoir),
    modePaiement: preparee.mode_paiement as ModePaiement,
    filiale,
  };

  return createPortal(
    <div id="zone-impression" className="liasse">
      {feuillesAImprimer(sortie).map((feuille, index) => (
        <Fragment key={`${feuille.piece}-${index}`}>
          {feuille.piece === 'FACTURE' ? (
            <CorpsFacture {...facture} exemplaire={feuille.exemplaire} />
          ) : (
            <BonLivraisonVente
              numeroVente={preparee.numero}
              numero={numeroLivraison}
              numeroCourt={numeroCourtLivraison ?? numeroCourt}
              date={date}
              vendeur={vendeur}
              client={client}
              lignes={lignesBonLivraison(lignes, depot)}
              livraison={livraison}
              filiale={filiale}
            />
          )}
        </Fragment>
      ))}
    </div>,
    document.body,
  );
}
