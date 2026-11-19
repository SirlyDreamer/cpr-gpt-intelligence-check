import assert from 'node:assert/strict'
import { resolve } from 'node:path'

export async function checkScoreHistory(page, shots) {
  const row = page.locator('tbody tr').filter({hasText:'user@example.com'})
  const blocks = row.locator('.score-history-block')
  await page.evaluate(() => {
    const f = window.__fixture, base = f.bootstrap.jobs[0]
    f.scoreHistoryBackup = structuredClone(f.bootstrap.jobs)
    const points = Array.from({length:25}, (_,i) => ({...base,
      id:`score-${i}`, createdAt:Date.now()-(25-i)*60000,
      status:i===20?'failed':i===21?'running':'completed',
      verdict:i===22?'inconclusive':i===24?'degraded':'no_match',
      qualityScore:i===20||i===21?null:i===23?90:i===24?0:i===22?10:95,
      requestModel:'gpt-6.1-sol', targetModel:'gpt-6.1-sol', source:i%2?'schedule':'manual',
      disableState:'none',groupState:'none',
    }))
    f.reports = Object.fromEntries(points.map(j => {
      const targetProbability=(j.qualityScore??0)/100
      j.prediction=targetProbability>=0.5?j.targetModel:'gpt-5.6-luna'
      j.probability=Math.max(targetProbability,1-targetProbability)
      const score={prediction:j.prediction,probability:j.probability,results:[{model:j.targetModel,label:j.targetModel,family:'gpt',probability:targetProbability},{model:'gpt-5.6-luna',label:'gpt-5.6-luna',family:'gpt',probability:1-targetProbability}],families:[]}
      return [j.id,{...f.report,...j,config:{...f.report.config,requestModel:j.requestModel,aliases:{}},rounds:j.qualityScore==null?[]:[{number:1,verdict:j.verdict,finishedAt:j.finishedAt,score}]}]
    }))
    // Deliberately shuffled: ordering must not depend on API array order.
    f.bootstrap.jobs = [...points.slice().reverse()]
    f.revision++;document.dispatchEvent(new Event('visibilitychange'))
  })
  await blocks.filter({has:page.locator('span')}).nth(19).waitFor()
  assert.equal(await blocks.count(),20)
  assert.equal(await blocks.first().getAttribute('data-job-id'),'score-5')
  assert.equal(await blocks.last().getAttribute('data-job-id'),'score-24')
  assert.match(await row.locator('.score-history-caption').innerText(),/最新 0.0 分/)
  assert.match(await row.locator('[data-job-id="score-20"]').getAttribute('class'),/history-unknown/)
  assert.match(await row.locator('[data-job-id="score-21"]').getAttribute('class'),/history-pending/)
  assert.match(await row.locator('[data-job-id="score-22"]').getAttribute('class'),/history-medium/)
  assert.match(await row.locator('[data-job-id="score-23"]').getAttribute('class'),/history-high/)
  assert.match(await row.locator('[data-job-id="score-24"]').getAttribute('class'),/history-low/)
  await row.locator('[data-job-id="score-23"]').hover()
  const tip = page.getByRole('tooltip')
  await tip.waitFor()
  assert.match(await tip.innerText(),/90.0/)
  assert.match(await tip.innerText(),/质量分数/)
  assert.match(await tip.innerText(),/未降智/)
  await page.waitForFunction(()=>{const el=document.querySelector('[role="tooltip"]');if(!el)return false;const r=el.getBoundingClientRect();return getComputedStyle(el).opacity==='1' && el.contains(document.elementFromPoint(r.x+20,r.y+20))})
  await page.screenshot({path:resolve(shots,'score-history.png'),animations:'disabled'})
  await row.locator('[data-job-id="score-20"]').hover()
  await tip.getByText('未获得目标模型的最终概率，不计为 0 分。',{exact:true}).waitFor()
  await blocks.last().focus()
  await page.keyboard.press('ArrowLeft')
  assert.equal(await page.locator(':focus').getAttribute('data-job-id'),'score-23')
  await page.keyboard.press('Home')
  assert.equal(await page.locator(':focus').getAttribute('data-job-id'),'score-5')
  await page.keyboard.press('End')
  assert.equal(await page.locator(':focus').getAttribute('data-job-id'),'score-24')
  await page.keyboard.press('Escape')
  await tip.waitFor({state:'hidden'})
  await page.keyboard.press('Enter')
  const dialog=page.getByRole('dialog',{name:'检测报告',exact:true})
  await dialog.waitFor()
  assert.match(await dialog.innerText(),/0.0 分/)
  assert.equal(await page.evaluate(()=>new URLSearchParams(window.__calls.filter(c=>c.path==='api/report').at(-1).query).get('id')),'score-24')
  await dialog.getByRole('button',{name:'关闭',exact:true}).click()
  await dialog.waitFor({state:'hidden'})
  await page.getByRole('button',{name:'检测历史',exact:true}).click()
  assert.match(await page.locator('tbody .history-score-value').first().innerText(),/0.0 分/)
  await page.getByRole('button',{name:'账户检测',exact:true}).click()
  await page.evaluate(()=>{
    const f=window.__fixture
    window.codexProxyPlugin.theme='dark'
    for(const [k,v] of Object.entries(f.themes.dark))document.documentElement.style.setProperty(k,v)
    window.dispatchEvent(new Event('codex-proxy-themechange'))
  })
  await row.locator('[data-job-id="score-23"]').hover()
  await tip.waitFor()
  await page.waitForFunction(()=>{const el=document.querySelector('[role="tooltip"]');return el && getComputedStyle(el).opacity==='1'})
  await page.screenshot({path:resolve(shots,'score-history-dark.png'),animations:'disabled'})
  await page.keyboard.press('Escape')
  await page.setViewportSize({width:390,height:844})
  await blocks.last().click()
  await dialog.waitFor()
  assert.match(await dialog.innerText(),/0.0 分/)
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1))
  await page.screenshot({path:resolve(shots,'score-history-mobile.png'),animations:'disabled'})
  await dialog.getByRole('button',{name:'关闭',exact:true}).click()
  await dialog.waitFor({state:'hidden'})
  await page.setViewportSize({width:1440,height:1050})
  await page.evaluate(()=>{
    const f=window.__fixture
    window.codexProxyPlugin.theme='light'
    for(const [k,v] of Object.entries(f.themes.light))document.documentElement.style.setProperty(k,v)
    window.dispatchEvent(new Event('codex-proxy-themechange'))
    f.bootstrap.jobs=f.scoreHistoryBackup
    delete f.reports;delete f.scoreHistoryBackup
    f.revision++;document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForFunction(()=>document.querySelectorAll('.score-history-block').length===1)
  assert.equal(await row.locator('.score-history-empty').count(),19)
  console.log('Score history UI: 20-run limit, chronology, zero/failed/pending results, hover, keyboard, exact report, dark and mobile passed.')
}
