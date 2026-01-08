import { useState, useEffect } from 'preact/hooks'

export type ViewMode = 'fill' | 'weekly'

const VIEW_MODE_KEY = 'pregnancy-visualizer-view-mode'

function getStoredViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY)
    if (stored === 'fill' || stored === 'weekly') {
      return stored
    }
  } catch {
    // localStorage not available
  }
  return 'weekly'
}

export function useViewMode() {
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode)
    } catch {
      // localStorage not available
    }
  }, [viewMode])

  return [viewMode, setViewMode] as const
}
