import assert from 'node:assert/strict'
import { resolve } from 'node:path'

export async function checkSubscriptions(page, shots) {
  const choose = async (field, label) => {
    await page.getByLabel(field, {exact:true}).click()
    await page.getByRole('option', {name:label,exact:true}).click()
    await page.getByRole('listbox').waitFor({state:'hidden'})
  }
  const refresh = () => page.getByRole('button', {name:'刷新账户',exact:true}).click()
  const row = email => page.locator('tbody tr').filter({hasText:email})
  await page.evaluate(() => {
    const f=window.__fixture, base=f.accounts[1]
    f.subscriptionBackup=structuredClone(f.accounts)
    f.accounts=[
      ...['free','plus','pro','prolite'].map((planType,i)=>({...base,id:`plan-${i}`,name:planType,email:`${planType}@plan.test`,planType,authenticationKind:'oauth'})),
      {...base,id:'plan-host',name:'host',email:'host@plan.test',planType:'future',planTypeDisplay:'Host Custom Plan'},
      {...base,id:'plan-api',name:'api',email:'api@plan.test',planType:'plus',authenticationKind:'api_key'},
      {...base,id:'plan-peer',name:'peer',email:'peer@plan.test',upstreamPeer:true},
      {...base,id:'plan-null',name:'unknown',email:'unknown@plan.test',planType:null},
      {...base,id:'plan-business',name:'business',email:'business@plan.test',planType:'self_serve_business_prolite'},
      {...base,id:'plan-science',name:'science',email:'science@plan.test',planType:'sci_plus'},
      {...base,id:'plan-xai',name:'xai',email:'xai@plan.test',provider:'xai',supported:false,planType:'supergrok',planTypeDisplay:'SuperGrok'},
    ]
  })
  await refresh()
  assert.match(await page.getByLabel('提供方筛选',{exact:true}).innerText(),/GPT 系列/)
  await page.getByText('匹配 10 个',{exact:false}).waitFor()
  assert.equal(await row('xai@plan.test').count(),0)
  for(const [email,label] of [['free','Free'],['plus','Plus'],['pro','Pro'],['prolite','ProLite'],['host','Host Custom Plan'],['api','API'],['peer','CPR'],['unknown','未知套餐']]) {
    assert.equal(await row(`${email}@plan.test`).locator('.plan-badge').innerText(),label)
  }
  for(const [email,label] of [['business','Business Premium'],['science','Academic Researchers Plus']]) {
    const badge=row(`${email}@plan.test`).locator('.plan-badge')
    assert.equal(await badge.innerText(),label)
    assert(await badge.evaluate(el=>el.getBoundingClientRect().height>22 && el.getBoundingClientRect().width<=el.closest('td').getBoundingClientRect().width))
  }
  const paletteCheck = async () => {
    for(const [plan,color] of [['free','cyan'],['plus','blue'],['pro','purple'],['prolite','purple']]) {
      assert.equal(await row(`${plan}@plan.test`).locator('.plan-badge').evaluate((badge,color) => {
        const expected=document.createElement('span')
        expected.style.color=`var(--z-color-${color}-on-container)`;document.body.append(expected)
        const matches=getComputedStyle(expected).color===getComputedStyle(badge).color
        expected.remove();return matches
      },color),true)
    }
    assert.notEqual(await row('pro@plan.test').locator('.plan-badge').evaluate(el=>getComputedStyle(el).backgroundColor),await row('prolite@plan.test').locator('.plan-badge').evaluate(el=>getComputedStyle(el).backgroundColor))
  }
  await paletteCheck()
  await page.getByLabel('订阅类型筛选',{exact:true}).click()
  assert.equal(await page.getByRole('option',{name:'SuperGrok',exact:true}).count(),0)
  await page.keyboard.press('Escape')
  await page.screenshot({path:resolve(shots,'subscriptions.png'),fullPage:true,animations:'disabled'})
  await page.evaluate(()=>{for(const [k,v] of Object.entries(window.__fixture.themes.dark))document.documentElement.style.setProperty(k,v);window.codexProxyPlugin.theme='dark';window.dispatchEvent(new Event('codex-proxy-themechange'))})
  await paletteCheck()
  await page.screenshot({path:resolve(shots,'subscriptions-dark.png'),fullPage:true,animations:'disabled'})
  await page.evaluate(()=>{for(const [k,v] of Object.entries(window.__fixture.themes.light))document.documentElement.style.setProperty(k,v);window.codexProxyPlugin.theme='light';window.dispatchEvent(new Event('codex-proxy-themechange'))})
  await choose('提供方筛选','全部提供方')
  await row('xai@plan.test').waitFor()
  await choose('订阅类型筛选','SuperGrok')
  await page.getByText('匹配 1 个',{exact:false}).waitFor()
  await choose('提供方筛选','GPT 系列')
  await page.getByText('匹配 10 个',{exact:false}).waitFor()
  assert.match(await page.getByLabel('订阅类型筛选',{exact:true}).innerText(),/全部订阅/)
  await page.getByRole('button',{name:'参数配置',exact:true}).click()
  await page.getByLabel('定时订阅筛选',{exact:true}).click()
  assert.equal(await page.getByRole('option',{name:'SuperGrok',exact:true}).count(),0)
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'账户检测',exact:true}).click()
  await page.evaluate(()=>{const f=window.__fixture;f.accounts=f.subscriptionBackup;delete f.subscriptionBackup})
  await refresh()
  await row('user@example.com').waitFor()
  console.log('Subscription UI: host labels, palettes, API/CPR badges, default GPT scope and combined filters passed.')
}
