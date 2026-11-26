import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export const iconButtonClass =
  'grid h-10 w-10 place-items-center rounded-full hover:bg-dock-ink/15'

/**
 * An icon button in the header that opens a small panel below it. Any button
 * inside the panel closes it, since each one finishes what the panel is for.
 */
export function HeaderMenu({
  label,
  icon,
  children,
}: {
  label: string
  icon: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const container = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const closeAndRefocus = () => {
    setOpen(false)
    button.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndRefocus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div
      ref={container}
      className="sm:relative"
      onBlur={(event) => {
        if (!container.current?.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={iconButtonClass}
        onClick={() => setOpen(!open)}
      >
        {icon}
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          tabIndex={-1}
          aria-label={label}
          className="absolute right-3 top-full z-20 mt-2 w-56 sm:right-0 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-4 text-sm text-ink shadow-lg"
          onClick={(event) => {
            if ((event.target as Element).closest('button')) closeAndRefocus()
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
