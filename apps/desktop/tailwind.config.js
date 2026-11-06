/** @type {import('tailwindcss').Config} */

/*
 * Les couleurs de la maison.
 *
 * Deux familles, et rien d'autre : un **bleu** qui va du ciel à la nuit, et un
 * **orange** qui ne sert qu'à montrer du doigt. Le bleu porte les surfaces —
 * barre latérale, entêtes de cartes, titres, chiffres —, l'orange ne porte que
 * ce sur quoi on agit : l'écran où l'on se trouve, le bouton qui fait la
 * chose, la part de marge d'un graphique. Un orange qui servirait à décorer ne
 * montrerait plus rien.
 *
 * L'échelle `primary` ne bouge que par le bas. Les niveaux 50 à 700 habillent
 * déjà trois cents endroits — boutons, liens, codes d'articles — et restent
 * tels quels ; seuls 800, 900 et 950 descendent vers la nuit des maquettes,
 * là où vivent la barre latérale et les entêtes de cartes.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe',
          300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6',
          600: '#2563eb', 700: '#1d4ed8',
          /* La nuit : barre latérale, entêtes de cartes, titres de page. */
          800: '#1d3a52', 900: '#16293b', 950: '#0d1b28',
        },
        /* L'orange : l'action, et elle seule. */
        accent: {
          50: '#fff4ec', 100: '#ffe3d1', 200: '#ffc29a',
          300: '#ff9a5c', 400: '#fb7a2a', 500: '#f26307',
          600: '#d85204', 700: '#b14106', 800: '#8c340b', 900: '#722d0c',
        },
        /* Le bleu d'acier des maquettes : bandeaux secondaires, icônes. */
        acier: '#22577d',
        /* Le bleu de ciel : fonds de tableaux, pastilles douces. */
        ciel: '#8cbdfa',
        /* Le bleu d'encre : un chiffre qu'on veut voir avant les autres. */
        encre: '#031a6b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
