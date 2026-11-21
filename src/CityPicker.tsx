import { invoke } from '@tauri-apps/api/core'
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import searchIcon from './assets/Search.svg'
import { cityLabel, type City, type Language } from './cities'

type Lookup =
  | { phase: 'idle' | 'loading' | 'error' }
  | { phase: 'done'; cities: City[] }

export function CityPicker({ language, select, autofocus = true }: {
  language: Language
  select: (city: City) => void
  autofocus?: boolean
}) {
  const ar = language === 'ar'
  const listId = useId()
  const [value, setValue] = useState('')
  const [lookup, setLookup] = useState<Lookup>({ phase: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const [active, setActive] = useState(0)
  const [expanded, setExpanded] = useState(true)
  const cities = lookup.phase === 'done' ? lookup.cities : []
  const showResults = expanded && cities.length > 0

  useEffect(() => {
    if (value.trim().length < 2) return
    let stale = false
    const timeout = window.setTimeout(async () => {
      try {
        const cities = await invoke<City[]>('search_cities', { query: value, language })
        if (!stale) {
          setLookup({ phase: 'done', cities })
          setActive(0)
        }
      } catch {
        if (!stale) setLookup({ phase: 'error' })
      }
    }, 300)
    return () => {
      stale = true
      clearTimeout(timeout)
    }
  }, [value, attempt, language])

  useEffect(() => {
    if (showResults) {
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [active, listId, showResults])

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && showResults) {
      event.stopPropagation()
      setExpanded(false)
    } else if (cities.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setExpanded(true)
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive((old) => expanded ? (old + cities.length + delta) % cities.length : 0)
    } else if (event.key === 'Enter' && showResults) {
      event.preventDefault()
      select(cities[active])
    }
  }

  return <>
    <label className="city-field">
      <img src={searchIcon} alt="" />
      <input role="combobox" autoFocus={autofocus} aria-label={ar ? 'ابحث عن مدينة' : 'Search for a city'}
        aria-expanded={showResults} aria-controls={showResults ? listId : undefined}
        aria-activedescendant={showResults ? `${listId}-${active}` : undefined}
        aria-autocomplete="list" autoComplete="off" maxLength={100} dir="auto"
        placeholder={ar ? 'ابحث عن مدينة' : 'Search for a city'} value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setExpanded(true)
          setLookup({ phase: event.target.value.trim().length >= 2 ? 'loading' : 'idle' })
        }} onKeyDown={onKey} />
    </label>
    {showResults && <div className="results" role="listbox" id={listId} aria-label={ar ? 'المدن' : 'Cities'}>
      {cities.map((city, index) => <button type="button" role="option" aria-selected={index === active}
        key={city.id} id={`${listId}-${index}`} className="city-result" tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()} onClick={() => select(city)}>
        <strong><bdi>{city.name}</bdi></strong>
        <span>{[city.admin1, cityLabel(city, language).split(ar ? '، ' : ', ').at(-1)].filter(Boolean).join(ar ? '، ' : ', ')}</span>
      </button>)}
    </div>}
    <p className="description" role="status">
      {value.trim().length < 2 ? (ar ? 'ابدأ بكتابة اسم مدينة.' : 'Start typing a city name.')
        : lookup.phase === 'loading' ? (ar ? 'جارٍ البحث عن المدن…' : 'Searching cities…')
          : lookup.phase === 'error' ? (ar ? 'تعذّر البحث. تحقّق من اتصالك.' : 'Couldn’t search for cities. Check your connection.')
            : !cities.length ? (ar ? 'لا توجد نتائج. جرّب اسمًا آخر.' : 'No cities found. Try another name.')
              : showResults ? (ar ? '↑ ↓ للتنقّل · Enter للاختيار' : '↑ ↓ to navigate · Enter to select') : ''}
    </p>
    {lookup.phase === 'error' && <button className="action error" onClick={() => {
      setLookup({ phase: 'loading' })
      setAttempt((old) => old + 1)
    }}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>}
  </>
}
