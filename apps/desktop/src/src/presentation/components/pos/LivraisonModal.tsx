import { useState } from 'react';
import { XMarkIcon, MapPinIcon, CalendarIcon, ClockIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface LivraisonModalProps {
  onClose: () => void;
  onNext: (livraison: LivraisonData) => void;
  total: number;
}

export interface LivraisonData {
  necessaire: boolean;
  date_livraison: string;
  heure_livraison: string;
  lieu: string;
  informations: string;
  chauffeur?: string;
}

export default function LivraisonModal({ onClose, onNext, total }: LivraisonModalProps) {
  const [livraison, setLivraison] = useState<LivraisonData>({
    necessaire: false,
    date_livraison: new Date().toISOString().split('T')[0],
    heure_livraison: '09:00',
    lieu: '',
    informations: '',
  });

  const handleNext = () => {
    onNext(livraison);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Informations de livraison</h3>
            <p className="text-sm text-neutral-500 mt-1">Étape 1 sur 3</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-4">
          {/* Checkbox Livraison nécessaire */}
          <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-lg border border-primary-200">
            <input
              type="checkbox"
              id="livraison-necessaire"
              checked={livraison.necessaire}
              onChange={(e) => setLivraison({ ...livraison, necessaire: e.target.checked })}
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="livraison-necessaire" className="flex-1 cursor-pointer">
              <p className="font-medium text-neutral-900">Livraison requise</p>
              <p className="text-sm text-neutral-600">Cochez si le client doit être livré</p>
            </label>
          </div>

          {livraison.necessaire && (
            <>
              {/* Date et Heure */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
                    <CalendarIcon className="w-4 h-4" />
                    Date de livraison
                  </label>
                  <input
                    type="date"
                    value={livraison.date_livraison}
                    onChange={(e) => setLivraison({ ...livraison, date_livraison: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
                    <ClockIcon className="w-4 h-4" />
                    Heure de livraison
                  </label>
                  <input
                    type="time"
                    value={livraison.heure_livraison}
                    onChange={(e) => setLivraison({ ...livraison, heure_livraison: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Lieu de livraison */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
                  <MapPinIcon className="w-4 h-4" />
                  Lieu de livraison *
                </label>
                <input
                  type="text"
                  value={livraison.lieu}
                  onChange={(e) => setLivraison({ ...livraison, lieu: e.target.value })}
                  placeholder="Adresse complète de livraison"
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Informations supplémentaires */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
                  <InformationCircleIcon className="w-4 h-4" />
                  Informations supplémentaires
                </label>
                <textarea
                  value={livraison.informations}
                  onChange={(e) => setLivraison({ ...livraison, informations: e.target.value })}
                  placeholder="Instructions spéciales, point de repère, étage, etc."
                  rows={3}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              {/* Chauffeur */}
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-2 block">Chauffeur assigné</label>
                <select
                  value={livraison.chauffeur || ''}
                  onChange={(e) => setLivraison({ ...livraison, chauffeur: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Sélectionner un chauffeur --</option>
                  <option value="M. Koné">M. Koné</option>
                  <option value="M. Traoré">M. Traoré</option>
                  <option value="M. Diabaté">M. Diabaté</option>
                </select>
              </div>
            </>
          )}

          {/* Résumé */}
          <div className="bg-neutral-50 p-4 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Total à payer :</span>
              <span className="font-bold text-primary-700 font-mono text-lg">
                {total.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Continuer vers le paiement →
          </button>
        </div>
      </div>
    </div>
  );
}
