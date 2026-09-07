import { useEffect, useRef, useState } from 'react'

/**
 * Une image qu'on regarde en grand, et dans laquelle on peut entrer.
 *
 * Trois gestes, un seul état : pincer à deux doigts, glisser à un doigt une
 * fois agrandie, et double-toucher pour faire l'aller-retour. La molette rend
 * le même service sur l'ordinateur de la MJ.
 *
 * L'image n'est **jamais déformée** ni recadrée : `object-fit: contain` la fait
 * tenir dans la place disponible, portrait comme paysage, et c'est la mise à
 * l'échelle qui va la chercher de plus près. Rien à savoir de son orientation.
 */

const ECHELLE_MIN = 1
const ECHELLE_MAX = 6
/** Ce que vaut un double-toucher — assez pour lire un détail, pas assez pour se perdre. */
const ECHELLE_DOUBLE = 2.5

interface Vue {
  echelle: number
  x: number
  y: number
}

const VUE_INITIALE: Vue = { echelle: 1, x: 0, y: 0 }

/**
 * Recentre la vue dans ses bornes.
 *
 * À l'échelle 1 l'image tient dans le cadre : aucun déplacement n'a de sens, on
 * revient à zéro. Au-delà, on l'empêche de glisser plus loin que son propre
 * débord, sans quoi on pousserait l'illustration hors de l'écran sans pouvoir
 * la ramener.
 */
function borner(vue: Vue, cadre: { width: number; height: number }): Vue {
  const echelle = Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, vue.echelle))
  const debordX = (cadre.width * (echelle - 1)) / 2
  const debordY = (cadre.height * (echelle - 1)) / 2
  return {
    echelle,
    x: Math.min(debordX, Math.max(-debordX, vue.x)),
    y: Math.min(debordY, Math.max(-debordY, vue.y)),
  }
}

export function ImageZoomable({ url, alt }: { url: string; alt: string }) {
  const cadreRef = useRef<HTMLDivElement>(null)
  const [vue, setVue] = useState<Vue>(VUE_INITIALE)
  const [etat, setEtat] = useState<'chargement' | 'prete' | 'erreur'>('chargement')

  // Les doigts posés, par identifiant de pointeur. Un `ref` et non un état :
  // ils changent à chaque `pointermove` et ne doivent rien re-rendre par
  // eux-mêmes — seule la vue qu'ils calculent le fait.
  const doigts = useRef(new Map<number, { x: number; y: number }>())
  // L'écartement des deux doigts au dernier calcul, pour en déduire le rapport.
  const ecart = useRef<number | null>(null)

  /**
   * Applique un facteur de zoom en gardant fixe le point visé.
   *
   * C'est ce qui fait qu'on zoome « sur » un détail plutôt que sur le centre :
   * la distance entre l'ancre et le contenu est mise à l'échelle comme le
   * reste.
   */
  function zoomer(facteur: number, ancreX: number, ancreY: number) {
    const cadre = cadreRef.current?.getBoundingClientRect()
    if (!cadre) return
    const cx = ancreX - cadre.left - cadre.width / 2
    const cy = ancreY - cadre.top - cadre.height / 2

    setVue((v) => {
      const echelle = Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, v.echelle * facteur))
      const rapport = echelle / v.echelle
      return borner(
        { echelle, x: cx - (cx - v.x) * rapport, y: cy - (cy - v.y) * rapport },
        cadre,
      )
    })
  }

  // La molette doit être écoutée en natif : React pose ses gestionnaires de
  // `wheel` en passif, et un gestionnaire passif ne peut pas empêcher le
  // défilement de la page derrière l'overlay.
  useEffect(() => {
    const cadre = cadreRef.current
    if (!cadre) return

    const surMolette = (e: WheelEvent) => {
      e.preventDefault()
      zoomer(Math.exp(-e.deltaY / 300), e.clientX, e.clientY)
    }

    cadre.addEventListener('wheel', surMolette, { passive: false })
    return () => cadre.removeEventListener('wheel', surMolette)
  }, [])

  function surPointeurBas(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ecart.current = null
  }

  function surPointeurBouge(e: React.PointerEvent) {
    const precedent = doigts.current.get(e.pointerId)
    if (!precedent) return
    doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const [a, b] = doigts.current.values()

    if (a && b) {
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      // Le premier `pointermove` du pincement ne sert qu'à mesurer l'écart de
      // départ : sans référence, tout rapport serait arbitraire.
      if (ecart.current !== null && ecart.current > 0) {
        zoomer(distance / ecart.current, (a.x + b.x) / 2, (a.y + b.y) / 2)
      }
      ecart.current = distance
      return
    }

    // Glisser n'a de sens qu'une fois agrandie : à l'échelle 1 il n'y a rien à
    // aller voir ailleurs, et le geste passerait pour un bug.
    setVue((v) => {
      if (v.echelle <= 1) return v
      const cadre = cadreRef.current?.getBoundingClientRect()
      if (!cadre) return v
      return borner(
        { ...v, x: v.x + (e.clientX - precedent.x), y: v.y + (e.clientY - precedent.y) },
        cadre,
      )
    })
  }

  function surPointeurHaut(e: React.PointerEvent) {
    doigts.current.delete(e.pointerId)
    ecart.current = null
  }

  function surDoubleToucher(e: React.MouseEvent) {
    if (vue.echelle > 1) {
      setVue(VUE_INITIALE)
      return
    }
    zoomer(ECHELLE_DOUBLE, e.clientX, e.clientY)
  }

  return (
    <div
      ref={cadreRef}
      className="illustration"
      onPointerDown={surPointeurBas}
      onPointerMove={surPointeurBouge}
      onPointerUp={surPointeurHaut}
      onPointerCancel={surPointeurHaut}
      onDoubleClick={surDoubleToucher}
    >
      {/*
        Hors du flux : l'image reste montée pendant le chargement — sinon son
        `onLoad` ne se déclencherait jamais — et le message se superpose au lieu
        de se poser à côté d'elle.
      */}
      {etat === 'chargement' && (
        <span className="illustration__message tres-discret">Chargement de l'illustration…</span>
      )}
      {etat === 'erreur' && (
        <p className="illustration__message alerte alerte--erreur">
          Illustration introuvable. L'adresse doit être celle de l'image elle-même.
        </p>
      )}

      <img
        src={url}
        alt={alt}
        // Certains hébergeurs refusent de servir une image quand le Referer
        // vient d'ailleurs ; sans en-tête, ils la servent.
        referrerPolicy="no-referrer"
        draggable={false}
        style={{
          transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.echelle})`,
          // Rien à cacher pendant le chargement — une image qui n'est pas
          // arrivée n'affiche rien. En revanche on retire l'icône d'image
          // brisée, qui ferait doublon avec le message d'erreur.
          display: etat === 'erreur' ? 'none' : 'block',
        }}
        onLoad={() => setEtat('prete')}
        onError={() => setEtat('erreur')}
      />
    </div>
  )
}
