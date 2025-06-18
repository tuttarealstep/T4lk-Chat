import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const MIN_WIDTH = 256 // 16rem default
const MAX_WIDTH_PERCENTAGE = 0.8 // 80% of screen

export function useSidebarWidth() {
  // Costanti
  const minWidth = MIN_WIDTH

  // Stati reattivi
  const windowWidth = ref(0)
  const isResizing = ref(false)

  // Cookie per persistenza
  const sidebarWidthCookie = useCookie<number>('sidebar_width', {
    default: () => MIN_WIDTH
  })

  // Calcola il limite massimo dinamicamente
  const maxWidth = computed(() =>
    windowWidth.value > 0 ? windowWidth.value * MAX_WIDTH_PERCENTAGE : MIN_WIDTH * 2
  )

  // Funzione per validare e clampare la larghezza
  const clampWidth = (width: number): number => {
    return Math.max(minWidth, Math.min(width, maxWidth.value))
  }

  // Stato della larghezza con validazione iniziale
  const sidebarWidth = ref(clampWidth(sidebarWidthCookie.value))

  // Stile CSS
  const sidebarWidthStyle = computed(() => ({
    '--sidebar-width': `${sidebarWidth.value}px`,
  }))

  // Aggiorna larghezza della finestra e rivalidata sidebar
  const updateWindowWidth = () => {
    if (typeof window === 'undefined') return

    windowWidth.value = window.innerWidth
    const newWidth = clampWidth(sidebarWidth.value)

    if (newWidth !== sidebarWidth.value) {
      sidebarWidth.value = newWidth
      sidebarWidthCookie.value = newWidth
    }
  }

  // Gestione eventi resize solo quando necessario
  let resizeEvents: (() => void) | null = null

  const startResize = (event: MouseEvent | TouchEvent) => {
    isResizing.value = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX || 0 : e.clientX
      sidebarWidth.value = clampWidth(clientX)
    }

    const handleEnd = () => {
      isResizing.value = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''

      // Salva nel cookie
      sidebarWidthCookie.value = sidebarWidth.value

      // Rimuovi eventi
      if (resizeEvents) {
        resizeEvents()
        resizeEvents = null
      }
    }

    // Aggiungi eventi
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)

    // Funzione cleanup
    resizeEvents = () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }

    event.preventDefault()
  }

  // Setup iniziale e cleanup
  onMounted(() => {
    updateWindowWidth()
    window.addEventListener('resize', updateWindowWidth)
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updateWindowWidth)
    }
    if (resizeEvents) {
      resizeEvents()
    }
  })

  return {
    sidebarWidth: readonly(sidebarWidth),
    sidebarWidthStyle,
    isResizing: readonly(isResizing),
    minWidth,
    maxWidth: readonly(maxWidth),
    startResize
  }
}
