import * as XLSX from 'xlsx';

/** Valeur d'une cellule exportée : les nombres restent des nombres dans Excel. */
export type CelluleExport = string | number | null;

export interface FeuilleExport {
  /** Nom de l'onglet (Excel le tronque à 31 caractères et interdit : \ / ? * [ ]). */
  nom: string;
  lignes: Array<Record<string, CelluleExport>>;
}

/** Nom d'onglet accepté par Excel. */
export function nomFeuilleValide(nom: string): string {
  const propre = nom.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (propre || 'Feuille').slice(0, 31);
}

/** Nom de fichier sans caractère interdit, horodaté pour ne pas écraser le précédent. */
export function nomFichierExport(base: string, date = new Date()): string {
  const jour = date.toISOString().slice(0, 10);
  const propre = base.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
  return `${propre}-${jour}.xlsx`;
}

function construireClasseur(feuilles: FeuilleExport[]): Uint8Array {
  const classeur = XLSX.utils.book_new();
  for (const feuille of feuilles) {
    XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(feuille.lignes), nomFeuilleValide(feuille.nom));
  }
  return new Uint8Array(XLSX.write(classeur, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/**
 * Enregistre un classeur Excel sur le poste. Sous Tauri, la boîte
 * d'enregistrement du système choisit l'emplacement (les téléchargements du
 * navigateur n'y fonctionnent pas) ; dans un navigateur, on retombe sur un
 * téléchargement classique.
 *
 * Rend le chemin (ou le nom) du fichier écrit, ou `null` si l'utilisateur a annulé.
 */
export async function exporterExcel(nomBase: string, feuilles: FeuilleExport[]): Promise<string | null> {
  if (feuilles.every((f) => f.lignes.length === 0)) throw new Error('Rien à exporter.');
  const nomFichier = nomFichierExport(nomBase);
  const octets = construireClasseur(feuilles);

  if ('__TAURI_INTERNALS__' in window) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const chemin = await save({ defaultPath: nomFichier, filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }] });
    if (!chemin) return null;
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(chemin, octets);
    return chemin;
  }

  const url = URL.createObjectURL(new Blob([octets as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
  return nomFichier;
}
