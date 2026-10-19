import type { ReactNode } from 'react';

/**
 * Bandeau de drapeaux du pied de la page de connexion.
 *
 * Décoratif, mais pas arbitraire : la zone franc CFA où l'enseigne travaille,
 * et l'Europe francophone d'où vient une partie des fournisseurs. Chaque
 * drapeau porte le nom de son pays, au survol comme au lecteur d'écran.
 *
 * Les drapeaux sont **dessinés en SVG, jamais en émoji** : Windows ne possède
 * pas les glyphes de drapeau et affiche « CI » là où macOS montre 🇨🇮. Or le
 * poste visé est précisément Windows (WebView2).
 */

/**
 * Étoile à cinq branches, pointe en haut, de rayon 1 centrée sur l'origine.
 * Rayon intérieur = sin(18°)/sin(54°) ≈ 0,382 du rayon extérieur.
 */
const ETOILE =
  'M0,-1 0.225,-0.309 0.951,-0.309 0.363,0.118 0.588,0.809 0,0.382 -0.588,0.809 -0.363,0.118 -0.951,-0.309 -0.225,-0.309Z';

function Etoile({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  return <path d={ETOILE} fill={fill} transform={`translate(${cx} ${cy}) scale(${r})`} />;
}

/** Trois bandes verticales d'égale largeur, de gauche à droite. */
function BandesV({ couleurs }: { couleurs: readonly [string, string, string] }) {
  return (
    <>
      {couleurs.map((couleur, i) => (
        <rect key={i} x={i * 10} y={0} width={10} height={20} fill={couleur} />
      ))}
    </>
  );
}

interface Pays {
  /** Code ISO, sert de clé. */
  code: string;
  nom: string;
  /** Le dessin, dans un repère 30 × 20 (les drapeaux retenus sont tous en 3:2). */
  dessin: ReactNode;
}

const PAYS: readonly Pays[] = [
  // Afrique francophone — zone franc CFA.
  { code: 'CI', nom: "Côte d'Ivoire", dessin: <BandesV couleurs={['#F77F00', '#FFFFFF', '#009E60']} /> },
  {
    code: 'SN',
    nom: 'Sénégal',
    dessin: (
      <>
        <BandesV couleurs={['#00853F', '#FDEF42', '#E31B23']} />
        <Etoile cx={15} cy={10} r={4} fill="#00853F" />
      </>
    ),
  },
  { code: 'ML', nom: 'Mali', dessin: <BandesV couleurs={['#14B53A', '#FCD116', '#CE1126']} /> },
  {
    code: 'BF',
    nom: 'Burkina Faso',
    dessin: (
      <>
        <rect x={0} y={0} width={30} height={20} fill="#009E49" />
        <rect x={0} y={0} width={30} height={10} fill="#EF2B2D" />
        <Etoile cx={15} cy={10} r={4} fill="#FCD116" />
      </>
    ),
  },
  {
    code: 'BJ',
    nom: 'Bénin',
    dessin: (
      <>
        <rect x={0} y={0} width={30} height={20} fill="#FCD116" />
        <rect x={0} y={10} width={30} height={10} fill="#E8112D" />
        <rect x={0} y={0} width={12} height={20} fill="#008751" />
      </>
    ),
  },
  {
    code: 'CM',
    nom: 'Cameroun',
    dessin: (
      <>
        <BandesV couleurs={['#007A5E', '#CE1126', '#FCD116']} />
        <Etoile cx={15} cy={10} r={4} fill="#FCD116" />
      </>
    ),
  },
  // Europe francophone.
  { code: 'FR', nom: 'France', dessin: <BandesV couleurs={['#002654', '#FFFFFF', '#CE1126']} /> },
  { code: 'BE', nom: 'Belgique', dessin: <BandesV couleurs={['#000000', '#FAE042', '#ED2939']} /> },
  {
    code: 'CH',
    nom: 'Suisse',
    dessin: (
      <>
        <rect x={0} y={0} width={30} height={20} fill="#DA291C" />
        <rect x={8.5} y={8} width={13} height={4} fill="#FFFFFF" />
        <rect x={13} y={3.5} width={4} height={13} fill="#FFFFFF" />
      </>
    ),
  },
  {
    code: 'LU',
    nom: 'Luxembourg',
    dessin: (
      <>
        <rect x={0} y={0} width={30} height={20} fill="#FFFFFF" />
        <rect x={0} y={0} width={30} height={6.67} fill="#ED2939" />
        <rect x={0} y={13.33} width={30} height={6.67} fill="#00A1DE" />
      </>
    ),
  },
];

export default function Drapeaux() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pays desservis">
      {PAYS.map((pays) => (
        <li key={pays.code} className="leading-none">
          <svg
            viewBox="0 0 30 20"
            role="img"
            aria-label={pays.nom}
            className="h-4 w-6 rounded-sm ring-1 ring-black/10"
          >
            <title>{pays.nom}</title>
            {pays.dessin}
          </svg>
        </li>
      ))}
    </ul>
  );
}
