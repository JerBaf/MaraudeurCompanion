import { useEffect, useState, type ReactNode } from 'react'

import { BandeauErreur } from './components/BandeauErreur.tsx'
import { creerEtEnregistrerPersonnage, reclamerPersonnage } from './data/repo.ts'
import { useAmorcage, useDeviceId, useRole, useTable } from './hooks/useTable.ts'
import { Connexion } from './screens/Connexion.tsx'
import { Creation } from './screens/joueuse/Creation.tsx'
import { Fiche } from './screens/joueuse/Fiche.tsx'
import { Roster } from './screens/joueuse/Roster.tsx'
import { EcranMJ } from './screens/mj/EcranMJ.tsx'
import { auth, EN_MODE_LOCAL } from './store/index.ts'

const CLE_PERSONNAGE = 'maraudeur:personnage'

/**
 * Enveloppe commune à tous les écrans : le bandeau d'erreur de stockage doit
 * rester visible quoi qu'il arrive, y compris avant toute connexion.
 *
 * Définie hors du composant : la déclarer à l'intérieur en ferait un type neuf
 * à chaque rendu, et React démonterait puis remonterait tout le sous-arbre —
 * les champs de saisie perdraient le focus à chaque frappe.
 */
function Cadre({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <BandeauErreur />
      {children}
    </div>
  )
}

export function App() {
  const role = useRole()
  const { etat, personnages, catalog, pret } = useTable()
  const deviceId = useDeviceId()
  useAmorcage(role)

  // Le personnage choisi survit à un rechargement : à table, on recharge souvent.
  const [charId, setCharId] = useState<string | null>(() => localStorage.getItem(CLE_PERSONNAGE))
  const [creation, setCreation] = useState(false)

  useEffect(() => {
    if (charId) localStorage.setItem(CLE_PERSONNAGE, charId)
    else localStorage.removeItem(CLE_PERSONNAGE)
  }, [charId])

  if (!role) {
    return (
      <Cadre>
        <Connexion />
      </Cadre>
    )
  }

  if (role === 'mj') {
    return (
      <Cadre>
        <EcranMJ
          etat={etat}
          personnages={personnages}
          catalog={catalog}
          onDeconnexion={() => void auth.deconnecter()}
        />
      </Cadre>
    )
  }

  // --- Écran joueuse ---

  const selection = charId ? (personnages.find((c) => c.id === charId) ?? null) : null

  if (selection) {
    return (
      <Cadre>
        <Fiche char={selection} catalog={catalog} onQuitter={() => setCharId(null)} />
      </Cadre>
    )
  }

  if (creation) {
    return (
      <Cadre>
        <Creation
          catalog={catalog}
          onAnnuler={() => setCreation(false)}
          onCreer={async (demande) => {
            const char = await creerEtEnregistrerPersonnage({ ...demande, claimedBy: deviceId }, catalog)
            setCreation(false)
            setCharId(char.id)
          }}
        />
      </Cadre>
    )
  }

  if (!pret) {
    return (
      <Cadre>
        <p className="vide">Connexion à la table…</p>
      </Cadre>
    )
  }

  if (catalog.classes().length === 0) {
    return (
      <Cadre>
        <div className="contenu pile">
          <p className="alerte alerte--info">
            La table n'est pas encore initialisée. Demandez à la MJ de se connecter une première
            fois : le contenu s'installera tout seul.
          </p>

          {EN_MODE_LOCAL && (
            <div className="alerte alerte--erreur">
              <strong>Vous êtes en mode local.</strong> Les données sont enregistrées dans{' '}
              <em>ce navigateur uniquement</em> : un onglet Firefox et un onglet Chrome ne voient
              pas la même table, même sur la même adresse.
              <br />
              <br />
              Pour tester à deux écrans, ouvrez <strong>deux onglets du même navigateur</strong> —
              l'un en MJ, l'autre en joueuse. Pour faire dialoguer deux vrais appareils, il faut
              configurer Firebase (étape 1 du README).
            </div>
          )}
        </div>
      </Cadre>
    )
  }

  return (
    <Cadre>
      <Roster
        personnages={personnages}
        catalog={catalog}
        deviceId={deviceId}
        onCreer={() => setCreation(true)}
        onChoisir={(char) => {
          setCharId(char.id)
          // L'appareil « adopte » le personnage : au prochain soir, il le retrouve seul.
          if (char.claimedBy !== deviceId) void reclamerPersonnage(char, deviceId)
        }}
      />
    </Cadre>
  )
}
