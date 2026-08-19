import { useEffect, useState } from 'react'

import { MODE_LOCAL } from './config.ts'
import { creerEtEnregistrerPersonnage, reclamerPersonnage } from './data/repo.ts'
import { useAmorcage, useDeviceId, useRole, useTable } from './hooks/useTable.ts'
import { Connexion } from './screens/Connexion.tsx'
import { Creation } from './screens/joueuse/Creation.tsx'
import { Fiche } from './screens/joueuse/Fiche.tsx'
import { Roster } from './screens/joueuse/Roster.tsx'
import { EcranMJ } from './screens/mj/EcranMJ.tsx'
import { auth } from './store/index.ts'

const CLE_PERSONNAGE = 'maraudeur:personnage'

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

  if (!role) return <div className="app"><Connexion /></div>

  if (role === 'mj') {
    return (
      <div className="app">
        <EcranMJ
          etat={etat}
          personnages={personnages}
          catalog={catalog}
          onDeconnexion={() => void auth.deconnecter()}
        />
      </div>
    )
  }

  // --- Écran joueuse ---

  const selection = charId ? (personnages.find((c) => c.id === charId) ?? null) : null

  if (selection) {
    return (
      <div className="app">
        <Fiche char={selection} catalog={catalog} onQuitter={() => setCharId(null)} />
      </div>
    )
  }

  if (creation) {
    return (
      <div className="app">
        <Creation
          catalog={catalog}
          onAnnuler={() => setCreation(false)}
          onCreer={async (demande) => {
            const char = await creerEtEnregistrerPersonnage({ ...demande, claimedBy: deviceId }, catalog)
            setCreation(false)
            setCharId(char.id)
          }}
        />
      </div>
    )
  }

  if (!pret) {
    return (
      <div className="app">
        <p className="vide">Connexion à la table…</p>
      </div>
    )
  }

  if (catalog.classes().length === 0) {
    return (
      <div className="app">
        <div className="contenu pile">
          <p className="alerte alerte--info">
            La table n'est pas encore initialisée. Demandez à la MJ de se connecter une première
            fois : le contenu s'installera tout seul.
          </p>

          {MODE_LOCAL && (
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
      </div>
    )
  }

  return (
    <div className="app">
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
    </div>
  )
}
