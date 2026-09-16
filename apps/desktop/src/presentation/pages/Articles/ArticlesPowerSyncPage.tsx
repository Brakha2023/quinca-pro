import ArticlesSyncList from '../../components/articles/ArticlesSyncList';

export default function ArticlesPowerSyncPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Articles</h1>
        <p className="text-sm text-neutral-500 mt-1">Catalogue de la filiale, disponible hors ligne et synchronisé automatiquement.</p>
      </div>
      <ArticlesSyncList />
    </div>
  );
}
