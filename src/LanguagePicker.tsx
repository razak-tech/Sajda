import { useId, useRef, useState } from 'react'
import type { Language } from './cities'

export function LanguagePicker({ language, select }: { language: Language; select: (language: Language) => void }) {
  const ar = language === 'ar'
  const id = useId()
  const opener = useRef<HTMLButtonElement>(null)
  const choices = useRef<(HTMLButtonElement | null)[]>([])
  const [expanded, setExpanded] = useState(false)

  function open() {
    setExpanded(true)
    requestAnimationFrame(() => choices.current[ar ? 1 : 0]?.focus())
  }

  return <>
    <div className="language-row">
      <label className="caption" htmlFor={id}>{ar ? 'اللغة' : 'Language'}</label>
      <button ref={opener} id={id} className="action secondary" aria-expanded={expanded}
        onClick={() => expanded ? setExpanded(false) : open()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            open()
          }
        }}>{ar ? 'العربية ▾' : 'English ▾'}</button>
    </div>
    {expanded && (['en', 'ar'] as const).map((option, index) =>
      <button key={option} lang={option} className="action secondary" aria-pressed={language === option}
        ref={(button) => { choices.current[index] = button }}
        onClick={() => {
          select(option)
          setExpanded(false)
          opener.current?.focus()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            setExpanded(false)
            opener.current?.focus()
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            choices.current[1 - index]?.focus()
          }
        }}>{option === 'ar' ? 'العربية' : 'English'}</button>,
    )}
  </>
}
