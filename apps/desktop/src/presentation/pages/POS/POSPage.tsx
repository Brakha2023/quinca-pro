import { usePOSStore } from '../../stores/pos.store';
import { useState } from 'react';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import CataloguePanel from '../../features/pos/CataloguePanel';
import PosteModal from '../../features/pos/PosteModal';
import TicketPanel from '../../features/pos/TicketPanel';
import { usePoste } from '../../features/pos/hooks';

/** Point de vente : catalogue à gauche, ticket à droite. Nécessite une caisse et un dépôt configurés sur le poste. */
export default function POSPage() {
  const { filialeId, estVueConsolidee } = useFilialeCourante();
  const { utilisateur } = useCurrentUtilisateur();
  const proforma = usePOSStore((s) => s.proforma);
  const poste = usePoste(filialeId);
  const [reglages, setReglages] = useState(false);

  if (!filialeId) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
        {estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale pour vendre.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}
      </div>
    );
  }

  if (!poste.estConfigure || reglages) {
    return (
      <>
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">Configuration du poste…</div>
        <PosteModal
          caisses={poste.caisses}
          depots={poste.depots}
          caisseId={poste.caisse?.id}
          depotId={poste.depot?.id}
          format={poste.format}
          onValider={(c, d, f) => { poste.definir(c, d); poste.definirFormat(f); setReglages(false); }}
          onClose={poste.estConfigure ? () => setReglages(false) : undefined}
        />
      </>
    );
  }

  const ctx = {
    filialeId,
    utilisateurId: utilisateur?.id ?? null,
    caisseId: poste.caisse!.id,
    caisseCode: poste.caisse!.code ?? 'CAISSE',
    depotId: poste.depot!.id,
  };
  const peutForcerStock = utilisateur?.profil === 'GERANT' || utilisateur?.profil === 'DIRECTEUR';

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between text-xs text-neutral-500 print:hidden">
        <span>Caisse <strong className="text-neutral-700">{poste.caisse!.nom}</strong> · Dépôt <strong className="text-neutral-700">{poste.depot!.nom}</strong>
          {proforma && <span className="ml-3 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium" data-testid="bandeau-proforma">Facturation de la proforma {proforma.numero}</span>}
        </span>
        <button onClick={() => setReglages(true)} className="flex items-center gap-1 hover:text-neutral-800"><Cog6ToothIcon className="w-4 h-4" /> Changer</button>
      </div>
      <div className="flex-1 flex gap-6 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <CataloguePanel filialeId={filialeId} depotId={ctx.depotId} />
        </div>
        <div className="w-96 flex-shrink-0 min-h-0">
          <TicketPanel ctx={ctx} peutForcerStock={peutForcerStock} depot={poste.depot!.nom ?? ''} format={poste.format} />
        </div>
      </div>
    </div>
  );
}
