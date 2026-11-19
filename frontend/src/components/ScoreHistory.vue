<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { ZPopover } from '@codex-proxy/ui/popover'
import { date, percent, verdict } from '../api'
import { HISTORY_STRIP_LIMIT, historyState, historyTone, scoreNumber, scoreText, scoreValue } from '../score-history'
import type { Job } from '../types'

const props = defineProps<{ jobs: Job[]; disabled?: boolean }>()
const emit = defineEmits<{ report: [id: string] }>()
const points = computed(() => props.jobs.slice(-HISTORY_STRIP_LIMIT))
const selectedId = ref<string>()
const selected = computed(() => points.value.find(j => j.id === selectedId.value) ?? points.value.at(-1))
const anchor = shallowRef<HTMLElement | null>(null)
const source = (j: Job) => j.source === 'schedule' ? '定时检测' : j.source === 'error_code' ? `日志触发${j.triggerCode ? ` · HTTP ${j.triggerCode}` : ''}` : '手动检测'
function inspect(event: Event, job: Job) {
  selectedId.value = job.id
  anchor.value = event.currentTarget as HTMLElement
}
function navigate(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const target = event.currentTarget as HTMLElement
  const buttons = Array.from(target.parentElement!.querySelectorAll<HTMLButtonElement>('button'))
  const index = buttons.indexOf(target as HTMLButtonElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index + (event.key === 'ArrowLeft' ? -1 : 1)
  event.preventDefault()
  buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus()
}
</script>

<template>
  <div v-if="points.length" class="score-history">
    <div class="score-history-caption"><span :title="`已保留 ${jobs.length} 次记录，显示最近 ${points.length} 次；更多记录可在检测历史查看`">最近 {{ points.length }} 次</span><span class="tabular">最新 {{ scoreText(points.at(-1)) }}</span></div>
    <ZPopover trigger="hover" placement="top" :reference-element="anchor" :hover-delay="100" role="tooltip">
      <template #reference="{ id, open, close }">
        <div class="score-history-track" role="group" aria-label="质量分数历史，按检测开始时间从旧到新；左右方向键切换，回车打开报告">
          <span v-for="n in HISTORY_STRIP_LIMIT - points.length" :key="`empty-${n}`" class="score-history-empty" aria-hidden="true" />
          <button v-for="job in points" :key="job.id" type="button" class="score-history-block" :class="`history-${historyTone(job)}`"
            :data-job-id="job.id" :disabled="disabled" :tabindex="selected?.id === job.id ? 0 : -1"
            :aria-label="`${date(job.createdAt)} · ${verdict(historyState(job))} · 质量分数 ${scoreText(job)} · 打开报告`"
            :aria-describedby="open && selected?.id === job.id ? id : undefined"
            @mouseenter="inspect($event, job)" @focus="inspect($event, job)" @keydown="navigate"
            @click="close(); emit('report', job.id)">
            <span aria-hidden="true">{{ historyTone(job) === 'unknown' ? '·' : '' }}</span>
          </button>
        </div>
      </template>
      <div v-if="selected" class="score-history-tip">
        <time class="tabular">{{ date(selected.createdAt) }}</time>
        <div class="score-history-tip-main"><div><span>质量分数</span><strong class="tabular">{{ scoreValue(selected) == null ? '—' : scoreNumber(scoreValue(selected)!) }}<small v-if="scoreValue(selected) != null"> / 100</small></strong></div><span class="score-history-verdict">{{ verdict(historyState(selected)) }}</span></div>
        <dl>
          <div><dt>来源</dt><dd>{{ source(selected) }}</dd></div>
          <div v-if="selected.requestModel"><dt>请求模型</dt><dd class="mono">{{ selected.requestModel }}</dd></div>
          <div v-if="selected.targetModel && selected.targetModel !== selected.requestModel"><dt>目标模型</dt><dd class="mono">{{ selected.targetModel }}</dd></div>
          <div v-if="selected.prediction"><dt>最高候选</dt><dd class="mono">{{ selected.prediction }} · {{ percent(selected.probability) }}</dd></div>
        </dl>
        <p>{{ scoreValue(selected) == null ? '未获得目标模型的最终概率，不计为 0 分。' : '质量分数 = 目标模型概率 × 100，越高越好。' }}</p>
        <span class="score-history-tip-action">点击色块打开当次报告</span>
      </div>
    </ZPopover>
    <div class="score-history-axis" aria-hidden="true"><span>较早</span><span>最新</span></div>
  </div>
</template>

<style scoped>
.score-history{width:260px;max-width:100%}
.score-history-caption,.score-history-axis{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;line-height:1.4;color:var(--z-color-text-tertiary,#535b67)}
.score-history-caption{margin-bottom:4px}
.score-history :deep(.z-popover){width:100%}
.score-history-track{display:grid;grid-template-columns:repeat(20,minmax(0,1fr));gap:3px;width:100%}
.score-history-empty,.score-history-block{display:flex;align-items:center;justify-content:center;height:22px;min-width:0;border:0;border-radius:3px;padding:0}
.score-history-empty{background:var(--z-color-fill-tertiary,#f1f5f9);border:1px solid var(--z-color-border-secondary,#e2e8f0)}
.score-history-block{background:var(--history-color);color:var(--z-color-bg-container,#fff);font-size:11px;font-weight:700;cursor:pointer;transition:transform .12s}
.history-high{--history-color:var(--z-color-success,#12b981)}
.history-low{--history-color:var(--z-color-error,#ef4444)}
.history-medium{--history-color:var(--z-color-warning,#f59e0b)}
.history-unknown{--history-color:var(--z-color-text-quaternary,#7d8795)}
.history-pending{--history-color:var(--z-color-primary,#5983f4)}
.score-history-block:hover{transform:scaleY(1.16)}
.score-history-block:focus-visible{outline:2px solid var(--z-color-text,#0e1726);outline-offset:2px}
.score-history-block:disabled{cursor:wait;opacity:.65}
.score-history-axis{font-size:10px;margin-top:3px;color:var(--z-color-text-quaternary,#5f6876)}
.score-history-tip{width:300px;max-width:calc(100vw - 32px);padding:14px;font-size:12px}
.score-history-tip>time{color:var(--z-color-text-tertiary,#535b67)}
.score-history-tip-main{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0}
.score-history-tip-main>div{display:flex;flex-direction:column;gap:3px}
.score-history-tip-main strong{font-size:25px;font-weight:650;line-height:1.15}
.score-history-tip-main small{font-size:12px;font-weight:400;color:var(--z-color-text-tertiary,#535b67)}
.score-history-verdict{display:flex;align-items:center;gap:6px;font-weight:600}
.score-history-tip dl{display:grid;gap:5px;padding-top:10px;border-top:1px solid var(--z-color-border-secondary,#e2e8f0)}
.score-history-tip dl>div{display:flex;gap:12px;justify-content:space-between}
.score-history-tip dt{flex:none;color:var(--z-color-text-tertiary,#535b67)}
.score-history-tip dd{overflow-wrap:anywhere;text-align:right}
.score-history-tip p{font-size:11px;line-height:1.6;margin-top:10px}
.score-history-tip-action{display:block;margin-top:6px;font-size:11px;color:var(--z-color-primary-text,#4d71d2)}
@media(prefers-reduced-motion:reduce){.score-history-block{transition:none}}
</style>
