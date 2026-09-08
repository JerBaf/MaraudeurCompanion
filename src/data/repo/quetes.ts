import type { Catalog } from '../../domain/catalog.ts'
import { appliquerRecompense, decrireRecompense, porteusesDe } from '../../domain/quetes.ts'
import type { Character, Quete } from '../../domain/types.ts'
import { enregistrerEntreeCatalogue } from './catalogue.ts'
import { journaliser, modifierPersonnage } from './table.ts'

// ---------------------------------------------------------------------------
// Quêtes
// ---------------------------------------------------------------------------

/**
 * Valide une quête : verse la récompense à toutes ses porteuses, puis la clôt.
 *
 * **Définitif.** L'écran ne propose plus le bouton une fois la quête validée, et
 * cette garde est la seconde ceinture : sans elle, un double appui verserait la
 * récompense deux fois.
 *
 * ⚠️ **Récompenses d'abord, bascule d'état ensuite.** Les écritures ne sont pas
 * transactionnelles (faiblesse connue, `PASSATION.md` § 6.4) : une coupure au
 * milieu laisse la quête revalidable, alors que l'ordre inverse la bloquerait
 * pour toujours, avec des joueuses non payées.
 *
 * Le versement passe par `modifierPersonnage` — et non `enregistrerPersonnage` —
 * pour que les passifs réactifs s'arment comme sur n'importe quel autre gain.
 */
export async function validerQuete(
  quete: Quete,
  personnages: Character[],
  catalog: Catalog,
): Promise<void> {
  if (quete.etat === 'validee') return

  const porteuses = porteusesDe(quete, personnages)
  for (const char of porteuses) {
    await modifierPersonnage(char, (c) => appliquerRecompense(c, quete.recompense, catalog))
  }

  await enregistrerEntreeCatalogue({ ...quete, etat: 'validee' })

  const noms = porteuses.map((c) => c.nom).join(', ') || 'personne'
  await journaliser(
    'MJ',
    'quete',
    `Quête validée — ${quete.nom} : ${decrireRecompense(quete.recompense, catalog)} → ${noms}`,
  )
}
