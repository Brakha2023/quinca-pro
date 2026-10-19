import { useState } from 'react';
import { documentsCommande } from '../../../core/fournisseurs';
import type { FiltresHistorique, PieceHistorique, SectionHistorique } from '../../../core/historiques';
import { BonCommandeImprimable } from '../fournisseurs/BonCommandeDocument';
import { FactureAchatImprimable } from '../fournisseurs/FactureAchatDocument';
import { BonImprimable } from '../stock/EnteteBon';
import { DetailProduction, type ProductionVueRow } from '../stock/ProductionPanel';
import VenteDetailsModal from '../ventes/VenteDetailsModal';
import type { VenteVueRow } from '../../../infrastructure/powersync/repositories/VentesRepository';
import type { CommandeVueRow } from '../fournisseurs/hooks';
import ListeHistorique from './ListeHistorique';
import { usePiecesCommandes, usePiecesProductions, usePiecesStock, usePiecesVentes, type FiltresSection } from './hooks';

export interface PropsSection {
  section: SectionHistorique;
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filtres: FiltresSection;
  affichage: FiltresHistorique;
}

/**
 * Une section d'historique : la liste est la même partout, seule la pièce
 * qu'on rouvre change — un ticket de vente, un bon de commande, un bon de
 * stock, une fiche de production.
 */
export default function SectionHistoriqueVue(props: PropsSection) {
  switch (props.section) {
    case 'ventes': return <HistoriqueVentes {...props} />;
    case 'commandes-fournisseurs': return <HistoriqueCommandes {...props} />;
    case 'productions': return <HistoriqueProductions {...props} />;
    default: return <HistoriqueStock {...props} />;
  }
}

function HistoriqueVentes({ section, filialeId, filiale, filtres, affichage }: PropsSection) {
  const { pieces, isLoading, brut } = usePiecesVentes(filialeId, filtres);
  const [ouverte, setOuverte] = useState<VenteVueRow | null>(null);
  return (
    <ListeHistorique
      section={section} pieces={pieces} isLoading={isLoading} filiale={filiale} filtres={affichage}
      onOuvrir={(p) => setOuverte(brut.find((v) => v.id === p.id) ?? null)}
    >
      {/* L'historique relit les ventes ; l'annulation reste au module Ventes. */}
      {ouverte && <VenteDetailsModal vente={ouverte} filialeId={filialeId} peutAnnuler={false} onClose={() => setOuverte(null)} />}
    </ListeHistorique>
  );
}

function HistoriqueCommandes({ section, filialeId, filiale, filtres, affichage }: PropsSection) {
  const { pieces, isLoading, brut } = usePiecesCommandes(filialeId, filtres);
  const [ouverte, setOuverte] = useState<CommandeVueRow | null>(null);
  // Tant que rien n'est reçu, la pièce n'a que son bon ; après, c'est la
  // facture qui fait foi (voir `documentsCommande`).
  const documents = ouverte
    ? documentsCommande({ type: ouverte.type === 'BON_COMMANDE' ? 'BON_COMMANDE' : 'COMMANDE', total_recu_ttc: ouverte.total_recu_ttc ?? 0, statut: (ouverte.statut ?? 'ENVOYEE') as 'ENVOYEE' })
    : [];
  return (
    <ListeHistorique
      section={section} pieces={pieces} isLoading={isLoading} filiale={filiale} filtres={affichage}
      onOuvrir={(p) => setOuverte(brut.find((c) => c.id === p.id) ?? null)}
    >
      {ouverte && documents.includes('FACTURE') && <FactureAchatImprimable commandeId={ouverte.id} filiale={filiale} onClose={() => setOuverte(null)} />}
      {ouverte && !documents.includes('FACTURE') && <BonCommandeImprimable commandeId={ouverte.id} filiale={filiale} onClose={() => setOuverte(null)} />}
    </ListeHistorique>
  );
}

function HistoriqueProductions({ section, filialeId, filiale, filtres, affichage }: PropsSection) {
  const { pieces, isLoading, brut } = usePiecesProductions(filialeId, filtres);
  const [ouverte, setOuverte] = useState<ProductionVueRow | null>(null);
  return (
    <ListeHistorique
      section={section} pieces={pieces} isLoading={isLoading} filiale={filiale} filtres={affichage}
      onOuvrir={(p) => setOuverte(brut.find((x) => x.id === p.id) ?? null)}
    >
      {ouverte && <DetailProduction production={ouverte} onClose={() => setOuverte(null)} />}
    </ListeHistorique>
  );
}

function HistoriqueStock({ section, filialeId, filiale, filtres, affichage }: PropsSection) {
  const { pieces, isLoading } = usePiecesStock(filialeId, section, filtres);
  const [reference, setReference] = useState<string | null>(null);
  return (
    <ListeHistorique
      section={section} pieces={pieces} isLoading={isLoading} filiale={filiale} filtres={affichage}
      onOuvrir={(p: PieceHistorique) => setReference(p.reference)}
    >
      {/* Le bon se reconstruit de ses mouvements : c'est la pièce d'origine, rééditée. */}
      {reference && <BonImprimable filialeId={filialeId} filiale={filiale} reference={reference} onClose={() => setReference(null)} />}
    </ListeHistorique>
  );
}
