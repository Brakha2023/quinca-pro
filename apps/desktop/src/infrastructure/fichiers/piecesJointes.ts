/**
 * Pièces jointes stockées en base sous forme de data URL (disponibles hors
 * ligne, synchronisées avec la fiche). Les images sont réduites côté client
 * pour rester légères.
 */
export function lireFichierDataUrl(fichier: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(lecteur.result as string);
    lecteur.onerror = () => rejeter(new Error('Lecture du fichier impossible'));
    lecteur.readAsDataURL(fichier);
  });
}

/** Réduit une image (photo d'identité) à `cote` px max, JPEG. */
export async function redimensionnerImage(fichier: File, cote = 320, qualite = 0.82): Promise<string> {
  const source = await lireFichierDataUrl(fichier);
  const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
    const img = new Image();
    img.onload = () => resoudre(img);
    img.onerror = () => rejeter(new Error('Image illisible'));
    img.src = source;
  });
  const ratio = Math.min(1, cote / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', qualite);
}

/** Taille approximative (octets) du fichier encodé dans une data URL. */
export function tailleDataUrl(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4);
}
