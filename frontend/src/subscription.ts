import type { Account } from './types'

// Match CPR's OpenAI plan names when an older host/fixture lacks planTypeDisplay.
const planNames: Record<string, string> = {
  free: 'Free', go: 'Go', plus: 'Plus', pro: 'Pro', prolite: 'ProLite', promax: 'ProMax',
  team: 'Business', business: 'Enterprise', ent26: 'Enterprise', enterprise: 'Enterprise', hc: 'Enterprise',
  self_serve_business_prolite: 'Business Premium',
  self_serve_business_usage_based: 'Business',
  enterprise_cbp_automation: 'Enterprise (Automation)', enterprise_cbp_usage_based: 'Enterprise',
  edu: 'Edu', education: 'Edu', edu_plus: 'Edu Plus', edu_pro: 'Edu Pro',
  sci: 'Academic Researchers', sci_plus: 'Academic Researchers Plus',
}

export const isGptAccount = (account: Account) => account.provider.trim().toLowerCase() === 'openai'
export const planValue = (account: Account) => account.planType?.trim().toLowerCase() || 'unknown'
const fallbackLabel = (value: string) => planNames[value] || (value === 'unknown' ? '未知套餐' : value)
export const planLabel = (account: Account) => account.planTypeDisplay?.trim() || fallbackLabel(planValue(account))
export const subscriptionLabel = (account: Account) => account.upstreamPeer ? 'CPR' : account.authenticationKind === 'api_key' ? 'API' : planLabel(account)

// Values stay the host's raw plan IDs, including in saved schedule filters.
export function planOptions(accounts: Account[], saved: string[] = []) {
  const labels = new Map<string, string>()
  for (const account of accounts) {
    const key = planValue(account)
    if (!labels.has(key) || account.planTypeDisplay?.trim()) labels.set(key, planLabel(account))
  }
  for (const key of saved) if (!labels.has(key)) labels.set(key, fallbackLabel(key))
  return [...labels].sort(([a], [b]) => a.localeCompare(b)).map(([value, label]) => ({ value, label }))
}

// Palette and stable fallback follow CPR's AccountPlanBadge (v3.52.1).
export function subscriptionPalette(account: Account) {
  const key = account.upstreamPeer || account.authenticationKind === 'api_key' ? 'api' : account.planType?.trim().toLowerCase() || ''
  const known: Record<string, [string, boolean]> = {
    api: ['cyan', true], free: ['cyan', false], plus: ['blue', true], pro: ['purple', true], prolite: ['purple', false],
  }
  const hash = [...key].reduce((sum, char) => sum + char.codePointAt(0)!, 0)
  const [color, strong] = known[key] || [['blue', 'green', 'cyan', 'orange'][hash % 4]!, false]
  return { backgroundColor: `var(--z-color-${color}-container${strong ? '-strong' : ''})`, color: `var(--z-color-${color}-on-container)` }
}
