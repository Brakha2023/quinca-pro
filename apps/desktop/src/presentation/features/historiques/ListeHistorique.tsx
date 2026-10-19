import { useState, type ReactNode } from 'react';
import { ArrowDownTrayIcon, EyeIcon, PrinterIcon } from '@heroicons/react/24/outline';
import {
  descriptionSection,
  filtresEnClair,
  recapHistorique,
  type FiltresHistorique,
  type PieceHistorique,
  type SectionHistorique,
} from '../../../core/historiques';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import HistoriqueDocument from './HistoriqueDocument';

interface Props {
  section: SectionHistorique;
  pieces: PieceHistorique[];
  isLoading: boolean;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filtres: FiltresHistorique;
  /** Rouvre la pièce (réédition du bon, détail de la vente…). */
  onOuvrir?: (piece: PieceHistorique) => void;
  /** Pièce ouverte, rendue par la section elle-même. */
  children?: ReactNode;
}

const dateHeure = (iso: string) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * Liste d'un historique : même tableau, même barre d'outils et même document
 * pour les sept sections. Seules les colonnes « tiers » et « montant »
 * changent de nom — une vente n'a pas de dépôt, un bon de transfert n'a pas de
 * client — et la section fournit de quoi rouvrir la pièce.
 */
export default function ListeHistorique({ section, pieces, isLoading, filiale, filtres, onOuvrir, children }: Props) {
  const notifier = useNotifier();
  const [apercu, setApercu] = useState(false);
  const description = descriptionSection(section);
  const recap = recapHistorique(pieces);

  const exporter = async () => {
    try {
      const chemin = await exporterExcel(`historique-${section}`, [{
        nom: description.label.slice(0, 31),
        lignes: pieces.map((p) => ({
          Date: dateHeure(p.date),
          'N° de pièce': p.reference,
          [description.tiers]: p.tiers ?? '',
          'Dépôt / caisse': p.depot ?? '',
          Lignes: p.lignes,
          Quantité: p.quantite,
          [description.montant]: p.montant,
          Statut: p.statut ?? '',
          'Op. saisie': p.utilisateur ?? '',
        })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <span className="text-sm text-neutral-600" data-testid="compteur-historique">
          <strong>{recap.pieces}</strong> {description.piece}(s) · {recap.lignes} ligne(s) · {description.montant.toLowerCase()} <strong className="font-mono">{formaterFcfa(recap.montant)}</strong>
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setApercu(true)} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid="imprimer-historique">
            <PrinterIcon className="w-4 h-4" /> Imprimer / PDF
          </button>
          <button type="button" onClick={exporter} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid="exporter-historique">
            <ArrowDownTrayIcon className="w-4 h-4" /> Exporter Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <p className="px-4 py-3 text-sm font-semibold text-neutral-700 border-b border-neutral-200 bg-neutral-50">
          {description.label} <span className="font-normal text-neutral-500">· {filtresEnClair(filtres)}</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">N° de pièce</th>
                <th className="px-3 py-2 text-left">{description.tiers}</th>
                <th className="px-3 py-2 text-left">Dépôt / caisse</th>
                <th className="px-3 py-2 text-right">Lignes</th>
                <th className="px-3 py-2 text-right">{description.montant}</th>
                <th className="px-3 py-2 text-left">Op. saisie</th>
                <th className="px-3 py-2 text-center">Pièce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pieces.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50" data-testid={`piece-${p.reference}`}>
                  <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{dateHeure(p.date)}</td>
                  <td className="px-3 py-2 text-sm font-mono text-neutral-700">{p.reference}</td>
                  <td className="px-3 py-2 text-sm max-w-xs truncate" title={p.tiers ?? ''}>{p.tiers ?? '—'}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{p.depot ?? '—'}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{p.lignes}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono whitespace-nowrap">{formaterFcfa(p.montant)}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{p.utilisateur ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {onOuvrir && (
                      <button type="button" onClick={() => onOuvrir(p)} className="p-1.5 rounded hover:bg-primary-50 text-primary-700" title="Rouvrir la pièce" data-testid={`ouvrir-${p.reference}`}>
                        <EyeIcon className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {pieces.length > 0 && (
              <tfoot className="bg-neutral-50 border-t-2 border-neutral-300 text-sm font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={4}>Total — {recap.pieces} {description.piece}(s)</td>
                  <td className="px-3 py-2 text-right font-mono">{recap.lignes}</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap" data-testid="total-historique-ecran">{formaterFcfa(recap.montant)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {isLoading && <div className="text-center py-10 text-neutral-400 text-sm">Chargement…</div>}
        {!isLoading && pieces.length === 0 && <div className="text-center py-10 text-neutral-400 text-sm">Aucune pièce dans ce périmètre.</div>}
      </div>

      {apercu && <HistoriqueDocument section={section} pieces={pieces} filiale={filiale} filtres={filtres} onClose={() => setApercu(false)} />}
      {children}
    </div>
  );
}
