import { code39 } from '../../../core/commun/codeBarres';

interface Props {
  valeur: string;
  /** Le code en clair sous les barres (toujours lisible si la douchette échoue). */
  avecTexte?: boolean;
}

/** Code-barres Code 39 dessiné en SVG : aucune police ni bibliothèque à installer. */
export default function CodeBarres({ valeur, avecTexte = true }: Props) {
  const { barres, largeur, texte } = code39(valeur);
  return (
    <div>
      <svg className="code-barres" viewBox={`0 0 ${largeur} 30`} preserveAspectRatio="none" role="img" aria-label={`Code-barres ${texte}`}>
        {barres.map((b) => <rect key={b.x} x={b.x} y={0} width={b.largeur} height={30} fill="#000" />)}
      </svg>
      {avecTexte && <p className="code-barres-texte">{texte}</p>}
    </div>
  );
}
