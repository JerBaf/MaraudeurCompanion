import questions from './questions-recueil.json'

/**
 * Thématiques de Recueillement.
 *
 * Le PDF renvoie à une liste de 365 questions de personnage ; celle-ci en est la
 * traduction, fournie par la MJ. L'app en tire une au hasard, la joueuse écrit
 * ses deux ou trois phrases dans son carnet — rien de ce qu'elle rédige ne
 * transite par l'application.
 *
 * Ce contenu ne passe pas par le catalogue : il n'a pas vocation à être édité
 * partie par partie, et le ranger dans Firestore aurait ajouté 353 documents
 * pour aucun gain.
 */
export const THEMATIQUES_RECUEIL: readonly string[] = questions
