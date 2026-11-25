/*
 * From Uiverse.io by njesenberger - https://uiverse.io/njesenberger/friendly-otter-40
 * MIT License, Copyright (c) njesenberger (Nicolas Jesenberger)
 */
import { useId } from 'react'
import './switch.css'

export function Switch({ label, checked, disabled, change }: {
  label: string
  checked: boolean
  disabled?: boolean
  change: (checked: boolean) => void
}) {
  const filterId = useId()
  return <span className="sajda-switch">
    <input className="sajda-switch-input" type="checkbox" role="switch" aria-label={label}
      checked={checked} disabled={disabled} onChange={(event) => change(event.currentTarget.checked)} />
    <svg viewBox="0 0 292 142" className="sajda-switch-art" aria-hidden="true">
      <path className="sajda-switch-track"
        d="M71 142C31.7878 142 0 110.212 0 71C0 31.7878 31.7878 0 71 0C110.212 0 119 30 146 30C173 30 182 0 221 0C260 0 292 31.7878 292 71C292 110.212 260.212 142 221 142C181.788 142 173 112 146 112C119 112 110.212 142 71 142Z" />
      <rect className="sajda-switch-on" rx="6" height="64" width="12" y="39" x="64" />
      <path className="sajda-switch-off" fillRule="evenodd"
        d="M221 91C232.046 91 241 82.0457 241 71C241 59.9543 232.046 51 221 51C209.954 51 201 59.9543 201 71C201 82.0457 209.954 91 221 91ZM221 103C238.673 103 253 88.6731 253 71C253 53.3269 238.673 39 221 39C203.327 39 189 53.3269 189 71C189 88.6731 203.327 103 221 103Z" />
      <g fill="#fff" filter={`url(#${filterId})`}>
        <rect className="sajda-switch-center" rx="29" height="58" width="116" y="42" x="13" />
        <rect className="sajda-switch-knob sajda-switch-knob-left" rx="58" height="114" width="114" y="14" x="14" />
        <rect className="sajda-switch-knob sajda-switch-knob-right" rx="58" height="114" width="114" y="14" x="164" />
      </g>
      <filter id={filterId}>
        <feGaussianBlur stdDeviation="10" result="blur" in="SourceGraphic" />
        <feColorMatrix type="matrix" in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
      </filter>
    </svg>
  </span>
}
