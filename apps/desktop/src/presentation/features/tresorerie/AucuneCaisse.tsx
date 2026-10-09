/** Message commun aux sections qui ont besoin d'une caisse active pour fonctionner. */
export default function AucuneCaisse({ message = 'Aucune caisse active : créez-en une dans « Liste des caisses ».' }: { message?: string }) {
  return (
    <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-xl p-5 text-sm" data-testid="aucune-caisse">
      {message}
    </div>
  );
}
