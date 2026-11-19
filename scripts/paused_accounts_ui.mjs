import assert from 'node:assert/strict'
import { resolve } from 'node:path'

export async function checkPausedAccounts(page, shots) {
  const row=page.locator('tbody tr').filter({hasText:'user@example.com'})
  await page.evaluate(()=>{
    const f=window.__fixture
    f.pausedBackup={accounts:structuredClone(f.accounts),jobs:structuredClone(f.bootstrap.jobs)}
    f.bootstrap.jobs[0]={...f.bootstrap.jobs[0],status:'failed',verdict:'inconclusive',message:'模型请求失败或未完整结束，请检查宿主请求记录',qualityScore:null}
    f.revision++;document.dispatchEvent(new Event('visibilitychange'))
  })
  await row.getByText('检测失败',{exact:true}).waitFor()
  const submitted=await page.evaluate(()=>window.__calls.filter(c=>c.path==='api/submit').length)
  for (const [enabled,status,reason] of [[false,'normal','手动暂停'],[true,'disabled','手动暂停'],[true,'quota_paused','额度暂停']]) {
    await page.evaluate(({enabled,status})=>{
      Object.assign(window.__fixture.accounts.find(a=>a.id==='acct-test'),{enabled,status})
    },{enabled,status})
    await page.getByRole('button',{name:'刷新账户',exact:true}).click()
    await row.getByText('已暂停调度',{exact:true}).waitFor()
    assert.equal(await row.getByRole('button',{name:'检测',exact:true}).isDisabled(),true)
    assert.equal(await row.getByRole('checkbox').isDisabled(),true)
    assert.equal(await row.getByText('检测失败',{exact:true}).count(),0)
    assert.match(await row.getByText('已暂停调度',{exact:true}).locator('..').innerText(),new RegExp(reason))
    assert.equal(await row.locator('.score-history-block').count(),1)
  }
  await page.screenshot({path:resolve(shots,'paused-accounts.png'),animations:'disabled'})
  await page.getByRole('button',{name:'检测历史',exact:true}).click()
  await page.locator('tbody').getByText('检测失败',{exact:true}).waitFor()
  await page.getByRole('button',{name:'账户检测',exact:true}).click()
  // A task transition also refreshes host status without pressing Refresh.
  await page.evaluate(()=>{
    const f=window.__fixture
    Object.assign(f.accounts.find(a=>a.id==='acct-test'),{enabled:true,status:'normal'})
    Object.assign(f.bootstrap.jobs[0],{status:'paused',message:'已暂停调度，未发送新的检测请求'})
    f.revision++;document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForFunction(()=>[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('user@example.com'))?.querySelector('.account-status')?.textContent==='正常')
  assert.equal(await row.getByRole('button',{name:'检测',exact:true}).isDisabled(),false)
  assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.path==='api/submit').length),submitted)
  await page.evaluate(()=>{
    const f=window.__fixture
    f.accounts=f.pausedBackup.accounts;f.bootstrap.jobs=f.pausedBackup.jobs;delete f.pausedBackup
    f.revision++;document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.getByRole('button',{name:'刷新账户',exact:true}).click()
  await row.getByText('未降智',{exact:true}).waitFor()
  console.log('Paused accounts UI: manual/quota suspension, no submit, history preservation and resumed availability passed.')
}
