<script setup lang="ts">
import type { Account } from '../types'
import { subscriptionLabel, subscriptionPalette } from '../subscription'

defineProps<{ account: Account }>()
</script>

<template>
  <span class="plan-badge" :class="{ 'plan-peer': account.upstreamPeer }" :style="subscriptionPalette(account)" :title="account.upstreamPeer ? 'CPR 上游互联' : subscriptionLabel(account)">
    <svg v-if="account.upstreamPeer" viewBox="48 48 416 416" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="36"><path d="M156 307A112 112 0 0 1 307 156" /><path d="M356 205A112 112 0 0 1 205 356" /></g>
      <path d="m407 105-119 153-183 149 124-157Z" fill="currentColor" />
    </svg>
    <span>{{ subscriptionLabel(account) }}</span>
  </span>
</template>

<style scoped>
.plan-badge{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:0;max-width:100%;min-height:22px;padding:3px 4px;border-radius:8px;font-size:12px;font-weight:750;line-height:14px;text-align:center;box-shadow:var(--z-box-shadow-tertiary)}
.plan-badge>span{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;overflow-wrap:anywhere;white-space:normal;text-wrap:balance}
.plan-peer{height:20px;gap:2px;padding:2px 6px 2px 2px;border-radius:6px;font-family:var(--z-font-family-code,monospace);font-size:10px;letter-spacing:.05em}
.plan-peer>svg{width:16px;height:16px;flex:none}
</style>
