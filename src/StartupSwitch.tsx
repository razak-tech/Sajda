import startupOn from './assets/StateOn.svg'
import startupOff from './assets/StateOff.svg'

export function StartupSwitch({ ar, enabled, disabled, change }: {
  ar: boolean
  enabled: boolean
  disabled?: boolean
  change: (enabled: boolean) => void
}) {
  const label = ar ? 'البدء مع ويندوز' : 'Start with Windows'
  return <div className="startup-row">
    <span>{label}</span>
    <button className="startup-switch" role="switch" aria-label={label} aria-checked={enabled}
      disabled={disabled} onClick={() => change(!enabled)}>
      <img src={enabled ? startupOn : startupOff} alt="" />
    </button>
  </div>
}
