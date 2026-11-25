import { Switch } from './Switch'

export function StartupSwitch({ ar, enabled, disabled, change }: {
  ar: boolean
  enabled: boolean
  disabled?: boolean
  change: (enabled: boolean) => void
}) {
  const label = ar ? 'البدء مع ويندوز' : 'Start with Windows'
  return <label className="startup-row">
    <span>{label}</span>
    <Switch label={label} checked={enabled} disabled={disabled} change={change} />
  </label>
}
