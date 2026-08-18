import { useEffect, useMemo, useState } from 'react'

import {
  amorcerSiNecessaire,
  surAdversaires,
  surCatalogue,
  surEtat,
  surPersonnages,
} from '../data/repo.ts'
import { createCatalog, type Catalog } from '../domain/catalog.ts'
import type { Adversaire, Character, EtatTable } from '../domain/types.ts'
import { auth, type Role } from '../store/index.ts'

/** Abonnement unique à tout l'état partagé de la table. */
export function useTable() {
  const [etat, setEtat] = useState<EtatTable | null>(null)
  const [personnages, setPersonnages] = useState<Character[]>([])
  const [adversaires, setAdversaires] = useState<Adversaire[]>([])
  const [catalog, setCatalog] = useState<Catalog>(() => createCatalog([]))
  const [pret, setPret] = useState(false)

  useEffect(() => {
    const desabonnements = [
      surEtat(setEtat),
      surPersonnages(setPersonnages),
      surAdversaires(setAdversaires),
      surCatalogue((c) => {
        setCatalog(c)
        setPret(true)
      }),
    ]
    return () => desabonnements.forEach((d) => d())
  }, [])

  const personnagesTries = useMemo(
    () => [...personnages].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [personnages],
  )

  const adversairesTries = useMemo(
    () => [...adversaires].sort((a, b) => a.ordre - b.ordre),
    [adversaires],
  )

  return { etat, personnages: personnagesTries, adversaires: adversairesTries, catalog, pret }
}

export function useRole(): Role | null {
  const [role, setRole] = useState<Role | null>(auth.role)
  useEffect(() => auth.onChange(setRole), [])
  return role
}

/**
 * Identifiant stable de l'appareil.
 *
 * Sert à « réclamer » un personnage : au retour d'une joueuse, son téléphone
 * retrouve tout seul sa fiche, sans compte ni mot de passe supplémentaire.
 */
export function useDeviceId(): string {
  return useMemo(() => {
    const cle = 'maraudeur:device'
    let id = localStorage.getItem(cle)
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(cle, id)
    }
    return id
  }, [])
}

/**
 * Amorce le catalogue et l'état si la table est vierge.
 * Seule la MJ y est autorisée par les règles Firestore, d'où le garde-fou.
 */
export function useAmorcage(role: Role | null): void {
  useEffect(() => {
    if (role !== 'mj') return
    amorcerSiNecessaire().catch((e) => console.error('Amorçage impossible', e))
  }, [role])
}
