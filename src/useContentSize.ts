import { useState, useEffect } from 'preact/hooks'
import type { RefObject } from 'preact'

export function useContentSize(contentRef: RefObject<HTMLDivElement>) {
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const updateSize = () => {
      if (contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect()
        setContentSize({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    // Periodic recalc for standalone PWA mode where initial size can be wrong
    const interval = setInterval(updateSize, 500)
    window.addEventListener('resize', updateSize)
    window.visualViewport?.addEventListener('resize', updateSize)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', updateSize)
      window.visualViewport?.removeEventListener('resize', updateSize)
    }
  }, [contentRef])

  return contentSize
}
