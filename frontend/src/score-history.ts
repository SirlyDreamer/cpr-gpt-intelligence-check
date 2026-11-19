import type { Job } from './types'

export const HISTORY_STRIP_LIMIT = 20
export const SCORE_HELP = '质量分数 = 最后一轮的目标模型概率 × 100。目标模型取当次请求模型及别名映射；90 分及以上为绿色，10 至不足 90 分为黄色，低于 10 分为红色。目标模型不在候选库中或检测未完成时无分数。'

export function scoreValue(job?: { status: string; qualityScore?: number | null }): number | null {
  const value = job?.qualityScore
  return job?.status === 'completed' && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
}
export function scoreNumber(value: number): string {
  const rounded = value.toFixed(1)
  // Don't display a rounded boundary value with the preceding band's colour.
  if (value < 10 && Number(rounded) >= 10) return '<10'
  if (value < 90 && Number(rounded) >= 90) return '<90'
  return rounded
}
export const scoreText = (job?: { status: string; qualityScore?: number | null }) => {
  const value = scoreValue(job)
  return value == null ? '无分数' : `${scoreNumber(value)} 分`
}
export const historyState = (job: Job) => job.status === 'completed' ? job.verdict : job.status
export function historyTone(job: Job): string {
  if (['queued', 'running'].includes(job.status)) return 'pending'
  const score = scoreValue(job)
  if (score == null) return 'unknown'
  return score >= 90 ? 'high' : score >= 10 ? 'medium' : 'low'
}
/** Creation order is stable while overlapping runs finish out of order. */
export function groupHistory(jobs: Job[]): Map<string, Job[]> {
  const grouped = new Map<string, Job[]>()
  for (const job of jobs) {
    const records = grouped.get(job.accountId) ?? []
    records.push(job)
    grouped.set(job.accountId, records)
  }
  for (const records of grouped.values()) records.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  return grouped
}
