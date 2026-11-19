// Node 24 直接运行 TypeScript，验证页面实际使用的请求和分页合并逻辑。
import assert from 'node:assert/strict'
import { request, schedulingPaused } from '../frontend/src/api.ts'
import { groupHistory, historyTone, scoreText, scoreValue } from '../frontend/src/score-history.ts'
import { isGptAccount, planOptions, subscriptionLabel } from '../frontend/src/subscription.ts'

const subscriptions = [
  {provider:'openai',planType:'prolite',planTypeDisplay:'ProLite'},
  {provider:'xai',planType:'supergrok',planTypeDisplay:'SuperGrok'},
]
assert.deepEqual(planOptions(subscriptions.filter(isGptAccount), ['legacy_plan']), [
  {value:'legacy_plan',label:'legacy_plan'}, {value:'prolite',label:'ProLite'},
])
assert.equal(subscriptionLabel({planType:'pro',planTypeDisplay:'Host Custom Plan'}),'Host Custom Plan')
assert.equal(subscriptionLabel({planType:'pro',authenticationKind:'api_key'}),'API')
assert.equal(subscriptionLabel({planType:'pro',authenticationKind:'api_key',upstreamPeer:true}),'CPR')
for (const [planType,label] of [['team','Business'],['business','Enterprise'],['self_serve_business_prolite','Business Premium'],['self_serve_business_usage_based','Business'],['enterprise_cbp_usage_based','Enterprise'],['sci','Academic Researchers'],['sci_plus','Academic Researchers Plus']]) assert.equal(subscriptionLabel({planType}),label)
for (const [enabled,status,paused] of [[false,'normal',true],[true,'disabled',true],[true,'quota_paused',true],[true,'quota_exhausted',false],[true,'rate_limited',false],[true,'normal',false]]) assert.equal(schedulingPaused({enabled,status}),paused)

const calls = []
const response = (value, status = 200) => ({ status, body: new TextEncoder().encode(JSON.stringify(value)).buffer })
const install = handler => {
  calls.length = 0
  globalThis.window = { codexProxyPlugin: { version: 2, request: async input => { calls.push(input); return handler(input) } } }
}

for (const field of ['jobs', 'accounts', 'models']) {
  install(input => {
    const params = new URLSearchParams(input.query)
    assert.equal(params.get('since'), 'epoch:2')
    const offset = Number(params.get('pageOffset') || 0)
    if (offset) assert.equal(params.get('pageSnapshot'), 'stable')
    return response({ [field]: offset ? ['第三条'] : ['第一条', '第二条'], revision: 'epoch:3', nextOffset: null,
      pagination: { field, snapshot: 'stable', nextOffset: offset ? null : 2 } })
  })
  assert.deepEqual(await request('GET', 'api/test?since=epoch%3A2'), {
    [field]: ['第一条', '第二条', '第三条'], revision: 'epoch:3', nextOffset: null,
  })
  assert.equal(calls.length, 2)
}

let changed = false
install(input => {
  const offset = new URLSearchParams(input.query).get('pageOffset')
  if (offset && !changed) {
    changed = true
    return response({ error: { code: 'pagination_changed' } }, 409)
  }
  return response({ jobs: [changed ? 'new' : 'old'], pagination: { field: 'jobs', snapshot: changed ? 'new' : 'old', nextOffset: offset ? null : 1 } })
})
assert.deepEqual(await request('GET', 'api/jobs'), { jobs: ['new', 'new'] })
assert.equal(calls.length, 4)

install(() => response({ error: { code: 'pagination_changed' } }, 409))
await assert.rejects(request('GET', 'api/jobs'), /数据正在更新/)
assert.equal(calls.length, 3)

install(() => response({ jobs: [], pagination: { field: 'jobs', snapshot: 'x', nextOffset: 0 } }))
await assert.rejects(request('GET', 'api/jobs'), /分页未前进/)

install(() => response({ error: { message: '配置冲突' } }, 409))
await assert.rejects(request('POST', 'api/config', { revision: 1 }), /配置冲突/)
assert.equal(calls.length, 1)
assert.deepEqual(JSON.parse(calls[0].body), { revision: 1 })
console.log('API pagination: all fields, Unicode, query retention, snapshot restart, retry bound, invalid cursor and POST errors passed.')

const point = { id:'a', accountId:'one', createdAt:100, status:'completed', verdict:'no_match', qualityScore:0 }
assert.equal(scoreText(point), '0.0 分')
assert.equal(historyTone(point), 'low')
assert.equal(scoreText({...point, qualityScore:100}), '100.0 分')
assert.equal(scoreText({...point, qualityScore:89.99}), '<90 分')
assert.equal(scoreText({...point, qualityScore:9.99}), '<10 分')
for (const value of [undefined, null, NaN, Infinity, -1, 101]) {
  assert.equal(scoreValue({...point, qualityScore:value}), null)
  assert.equal(historyTone({...point, qualityScore:value}), 'unknown')
}
for (const status of ['failed','cancelled','interrupted','queued','running']) {
  assert.equal(scoreText({...point,status}), '无分数')
  assert.notEqual(historyTone({...point,status}), 'high')
}
for (const [qualityScore,tone] of [[0,'low'],[9.99,'low'],[10,'medium'],[89.99,'medium'],[90,'high'],[100,'high']]) {
  for (const verdict of ['degraded','no_match','inconclusive']) assert.equal(historyTone({...point,qualityScore,verdict}),tone)
}
const records = [{...point,id:'c',createdAt:300}, {...point,id:'b',createdAt:100}, point, {...point,id:'other',accountId:'two'}]
const groups = groupHistory(records)
assert.deepEqual(groups.get('one').map(j=>j.id), ['a','b','c'])
assert.deepEqual(groups.get('two').map(j=>j.id), ['other'])
assert.deepEqual(records.map(j=>j.id), ['c','b','a','other'])
assert.equal(groupHistory([]).size, 0)
console.log('Score history: chronological grouping, stable ties, zero/full scores and missing/failed results passed.')
