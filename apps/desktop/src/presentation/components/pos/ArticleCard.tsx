import { Article } from '../../../core/entities/article.entity';
import { usePOSStore } from '../../stores/pos.store';

interface ArticleCardProps {
  article: Article;
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const ajouterArticle = usePOSStore((s) => s.ajouterArticle);

  const stockStatus = () => {
    if (article.stock <= 0) return 'bg-red-100 text-red-700';
    if (article.stock <= article.stock_min) return 'bg-orange-100 text-orange-700';
    return 'bg-green-100 text-green-700';
  };

  const stockLabel = () => {
    if (article.stock <= 0) return 'Rupture';
    if (article.stock <= article.stock_min) return 'Faible';
    return `${article.stock} en stock`;
  };

  return (
    <button
      onClick={() => ajouterArticle(article)}
      disabled={article.stock <= 0}
      className="bg-white border border-neutral-200 rounded-xl p-4 text-left hover:shadow-lg hover:border-primary-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <div className="aspect-square bg-neutral-50 rounded-lg mb-3 flex items-center justify-center text-4xl">
        📦
      </div>
      <h3 className="font-semibold text-sm text-neutral-900 line-clamp-2 min-h-[2.5rem]">
        {article.designation}
      </h3>
      <p className="text-xs text-neutral-500 mt-1">{article.code_auto}</p>
      <div className="flex items-center justify-between mt-3">
        <p className="text-primary-700 font-bold font-mono">
          {article.prix_vente_ttc.toLocaleString('fr-FR')} F
        </p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stockStatus()}`}>
          {stockLabel()}
        </span>
      </div>
    </button>
  );
}
