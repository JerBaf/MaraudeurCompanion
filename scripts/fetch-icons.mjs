#!/usr/bin/env node
/**
 * Télécharge les icônes référencées par le catalogue depuis game-icons.net.
 *
 *   npm run icons
 *
 * Les fichiers atterrissent dans `public/icons/<nom>.svg` et le fichier
 * d'attribution CC-BY est régénéré à partir des auteurs réellement utilisés.
 *
 * Le script est idempotent : il ne retélécharge pas ce qui est déjà là.
 * Toute icône introuvable en amont est signalée explicitement plutôt que
 * silencieusement ignorée — sans son fichier, l'app affiche un jeton coloré,
 * ce qui reste lisible mais se voit.
 *
 * Pour remplacer une icône par un dessin à vous, déposez votre fichier sous le
 * même nom : le script n'écrase jamais un fichier existant.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dossierIcones = path.join(racine, 'public', 'icons')
const ARBRE = 'https://api.github.com/repos/game-icons/icons/git/trees/master?recursive=1'
const BRUT = 'https://raw.githubusercontent.com/game-icons/icons/master/'

/** Teinte appliquée au tracé, alignée sur --ambre dans src/styles.css. */
const AMBRE = '#e0a44c'

/**
 * Les SVG de game-icons.net sont livrés en tracé blanc sur un carré noir plein.
 * Tels quels, ils s'afficheraient en pavés opaques dans l'interface.
 *
 * On retire donc le rectangle de fond et on teinte le tracé. La couleur est
 * écrite dans le fichier plutôt que gérée en CSS, parce que les icônes sont
 * affichées via <img> — ce qui préserve l'événement `onError` sur lequel repose
 * le repli en jeton coloré quand un fichier manque.
 */
const SIGNATURE_FOND = 'M0 0h512v512H0z'

function aBesoinDeNormalisation(svg) {
  return svg.includes(SIGNATURE_FOND)
}

function normaliser(svg) {
  return svg
    .replace(new RegExp(`<path d="${SIGNATURE_FOND}"[^>]*/>`), '')
    .replaceAll('fill="#fff"', `fill="${AMBRE}"`)
}

/**
 * Repasse sur les fichiers déjà présents pour normaliser ceux qui ne l'auraient
 * pas été (téléchargement antérieur, interruption…).
 *
 * Ne touche qu'aux fichiers portant la signature de game-icons : un dessin
 * déposé par vos soins n'a aucune raison de contenir ce rectangle de fond, et
 * ressort donc intact.
 */
async function normaliserExistants() {
  if (!existsSync(dossierIcones)) return 0
  let reparees = 0
  for (const fichier of await readdir(dossierIcones)) {
    if (!fichier.endsWith('.svg')) continue
    const chemin = path.join(dossierIcones, fichier)
    const svg = await readFile(chemin, 'utf8')
    if (!aBesoinDeNormalisation(svg)) continue
    await writeFile(chemin, normaliser(svg), 'utf8')
    reparees += 1
  }
  return reparees
}

/**
 * Écrit la liste des icônes réellement présentes.
 *
 * L'app ne peut pas lister `public/` à l'exécution : sans ce fichier, l'écran
 * MJ n'aurait aucun moyen de proposer un choix d'icônes pour une créature du
 * bestiaire. Le manifeste est régénéré à chaque exécution, donc il inclut
 * automatiquement les dessins que vous auriez déposés vous-même.
 */
async function ecrireManifeste() {
  const fichiers = (await readdir(dossierIcones))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.slice(0, -4))
    .sort()

  const contenu = [
    '// Généré par `npm run icons` — ne pas modifier à la main.',
    '//',
    "// Liste des icônes présentes dans public/icons, pour que l'écran MJ",
    '// puisse en proposer le choix. Déposez un fichier et relancez le script.',
    '',
    'export const ICONES_DISPONIBLES = [',
    ...fichiers.map((f) => `  '${f}',`),
    '] as const',
    '',
  ].join('\n')

  await writeFile(path.join(racine, 'src', 'content', 'icones.ts'), contenu, 'utf8')
}

/**
 * Palette proposée à la MJ, au-delà de ce que le contenu livré référence.
 *
 * Le catalogue est saisi à la main : sans ces icônes, chaque nouvel objet
 * retomberait sur les quelques dessins des exemples. Une icône introuvable en
 * amont est signalée en fin de script, pas silencieusement ignorée.
 */
const PALETTE = [
  // Armes
  'battle-axe', 'crossbow', 'bowie-knife', 'thor-hammer', 'trident', 'katana',
  'spear-hook', 'wood-club', 'sword-wound', 'bone-knife',
  // Armures et protections
  'chain-mail', 'leather-vest', 'shield-echoes', 'crested-helmet', 'cape',
  'leather-boot', 'gauntlet',
  // Bibelots et consommables
  'round-potion', 'potion-ball', 'gem-pendant', 'ring', 'scroll-unfurled',
  'book-cover', 'candle-light', 'old-lantern', 'key', 'rope-coil', 'compass',
  'pocket-watch', 'mirror-mirror', 'dice-six-faces-three',
  // Magie et divers
  'magic-swirl', 'crystal-cluster', 'skull-crossed-bones', 'raven', 'wolf-head',
  'eclipse', 'sun', 'moon', 'thorn-helix', 'chalice-drops',
]

/** Extrait les noms d'icônes du contenu livré avec l'app, plus la palette. */
async function iconesReferencees() {
  const dossier = path.join(racine, 'src', 'content')
  const fichiers = await readdir(dossier)
  const noms = new Set(PALETTE)

  for (const fichier of fichiers.filter((f) => f.endsWith('.ts'))) {
    const source = await readFile(path.join(dossier, fichier), 'utf8')
    for (const m of source.matchAll(/icone:\s*'([a-z0-9-]+)'/g)) noms.add(m[1])
  }
  return [...noms].sort()
}

async function main() {
  const voulues = await iconesReferencees()
  if (voulues.length === 0) {
    console.error('Aucune icône référencée dans src/content — rien à faire.')
    process.exit(1)
  }

  await mkdir(dossierIcones, { recursive: true })

  const reparees = await normaliserExistants()
  if (reparees > 0) console.log(`${reparees} icône(s) existante(s) normalisée(s).`)

  const manquantes = voulues.filter((n) => !existsSync(path.join(dossierIcones, `${n}.svg`)))
  if (manquantes.length === 0) {
    await ecrireManifeste()
    console.log(`${voulues.length} icône(s) déjà présente(s). Rien à télécharger.`)
    return
  }

  console.log(`Recherche de ${manquantes.length} icône(s) sur game-icons.net…`)

  const reponse = await fetch(ARBRE, { headers: { 'User-Agent': 'maraudeur-companion' } })
  if (!reponse.ok) throw new Error(`Arborescence inaccessible : HTTP ${reponse.status}`)
  const arbre = await reponse.json()

  /** basename → chemin auteur/nom.svg */
  const parNom = new Map()
  for (const entree of arbre.tree) {
    if (!entree.path.endsWith('.svg')) continue
    const nom = entree.path.split('/').pop().slice(0, -4)
    if (!parNom.has(nom)) parNom.set(nom, entree.path)
  }

  const introuvables = []
  let telechargees = 0

  for (const nom of manquantes) {
    const chemin = parNom.get(nom)
    if (!chemin) {
      introuvables.push(nom)
      continue
    }
    const svg = await fetch(BRUT + chemin)
    if (!svg.ok) {
      introuvables.push(nom)
      continue
    }
    await writeFile(path.join(dossierIcones, `${nom}.svg`), normaliser(await svg.text()), 'utf8')
    telechargees += 1
  }

  // --- Attribution CC-BY 3.0, obligatoire ---
  const auteurs = [...new Set(voulues.map((n) => parNom.get(n)?.split('/')[0]).filter(Boolean))].sort()
  await writeFile(
    path.join(dossierIcones, 'CREDITS.md'),
    [
      '# Crédits des icônes',
      '',
      'Icônes issues de [game-icons.net](https://game-icons.net), distribuées sous',
      'licence [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).',
      '',
      'Auteurs des icônes utilisées dans cette application :',
      '',
      ...auteurs.map((a) => `- ${a}`),
      '',
      'Les icônes sont recolorées en CSS ; leur tracé est inchangé.',
      '',
      '> Ce fichier est régénéré par `npm run icons`.',
      '',
    ].join('\n'),
    'utf8',
  )

  await ecrireManifeste()

  console.log(`${telechargees} icône(s) téléchargée(s) dans public/icons/.`)
  if (introuvables.length > 0) {
    console.warn(
      `\n⚠️  ${introuvables.length} icône(s) introuvable(s) en amont :\n   ${introuvables.join(', ')}\n` +
        `   L'app affichera un jeton coloré à leur place. Cherchez un nom équivalent\n` +
        `   sur game-icons.net et corrigez le champ « icone » dans src/content/seed.ts,\n` +
        `   ou déposez votre propre fichier dans public/icons/.`,
    )
  }
}

main().catch((e) => {
  console.error('Échec :', e.message)
  process.exit(1)
})
