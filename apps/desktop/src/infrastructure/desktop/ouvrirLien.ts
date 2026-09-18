/**
 * Ouvre un lien externe (mailto:, https:) avec l'application par défaut du
 * poste : via le plugin `opener` sous Tauri, via le navigateur sinon.
 */
export async function ouvrirLien(url: string): Promise<void> {
  if ('__TAURI_INTERNALS__' in window) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

export function lienMailto(destinataire: string, objet: string, corps: string): string {
  return `mailto:${encodeURIComponent(destinataire)}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
}
