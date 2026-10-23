// Isolated local preview with sample data. No production sign-in or API writes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const output='.portfolio-review/tracker';
const base='http://127.0.0.1:5185';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(()=>{
   const token=btoa(JSON.stringify({alg:'none'}))+'.'+btoa(JSON.stringify({sub:'local-preview',email:'preview@example.test',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}))+'.preview';
   const key='CognitoIdentityServiceProvider.preview';
   localStorage.setItem(`${key}.LastAuthUser`,'preview');
   for(const name of ['idToken','accessToken'])localStorage.setItem(`${key}.preview.${name}`,token);
   localStorage.setItem(`${key}.preview.refreshToken`,'local-preview-only');
   localStorage.setItem(`${key}.preview.clockDrift`,'0');
   localStorage.setItem('ascend_login_ts',String(Date.now()));
   localStorage.setItem('theme','light');
  });
  const sample={
   leetcode:[{id:'lc-1',problem:'Two Sum',difficulty:'Easy',category:'Hash Map',status:'Solved',timeComplexity:'O(n)',spaceComplexity:'O(n)',attempts:1,date:'2026-10-23',url:'https://leetcode.com/problems/two-sum/'},{id:'lc-2',problem:'Longest Substring Without Repeating Characters',difficulty:'Medium',category:'Sliding Window',status:'Revisit',attempts:2,date:'2026-10-22'}],
   jobs:[{id:'job-1',company:'Nimbus Cloud Systems',role:'Backend Engineer',status:'Phone Screen',appliedDate:'2026-10-20',followUpDate:'2026-10-25',source:'Company Website',salary:'$100k–$120k'},{id:'job-2',company:'Riverbed Data Co.',role:'Software Engineer',status:'Applied',appliedDate:'2026-10-21',source:'Referral'}],
   activity:[{id:'act-1',title:'Backend project work',category:'Coding',duration:90,date:'2026-10-23',notes:'Added retry and recovery tests.'}],gaming:[],resume:[],
  };
  await context.route('**/trackers/*/entries**',async route=>{
   const id=new URL(route.request().url()).pathname.split('/trackers/')[1].split('/')[0];
   if(route.request().method()==='GET')return route.fulfill({json:sample[id]||[]});
   throw Error('Unexpected write during visual review');
  });
  await context.route('**/api/leetcode-stats?*',route=>route.fulfill({json:{username:'preview',solved:{total:42,easy:20,medium:20,hard:2},languages:[],rank:10000}}));
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:900});
   for(const id of ['leetcode','jobs','activity','gaming','resume']) {
    await page.goto(`${base}/#${id}`,{waitUntil:'domcontentloaded'});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.topbar').waitFor();
    await page.waitForTimeout(200);
    await page.screenshot({path:`${output}/${id}-${width}.png`,fullPage:true});
    console.log(width,id,await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(id==='jobs') {
     const search=page.getByRole('searchbox',{name:'Search Job Applications entries'});
     await search.fill('Nimbus');
     assert.equal(await page.locator('tbody tr').count(),1);
     await search.fill('');
     await page.getByRole('button',{name:/^Company/}).click();
     assert.match(await page.locator('tbody tr').first().textContent(),/Nimbus/);
     await page.getByRole('button',{name:'+ Add Entry',exact:true}).click();
     await page.locator('.modal').waitFor();
     assert.equal(await page.locator(':focus').getAttribute('id'),'company');
     await page.screenshot({path:`${output}/form-${width}.png`,fullPage:true});
     const submit=page.getByRole('dialog').getByRole('button',{name:'Add Entry',exact:true});
     await submit.focus();await page.keyboard.press('Tab');
     assert.equal(await page.locator(':focus').getAttribute('aria-label'),'Close');
     await page.keyboard.press('Escape');
     assert.equal(await page.getByRole('dialog').count(),0);
     assert.match(await page.locator(':focus').textContent(),/Add Entry/);
     await page.getByRole('button',{name:'Toggle theme'}).click();
     await page.waitForTimeout(200);
     console.log('Dark colors',await page.evaluate(()=>Object.fromEntries(['.app','.search-input','.table-th','.table-sort-button'].map(selector=>{const s=getComputedStyle(document.querySelector(selector));return [selector,{bg:s.backgroundColor,color:s.color,text:s.getPropertyValue('--text'),muted:s.getPropertyValue('--text-muted')}]}))));
     await page.screenshot({path:`${output}/jobs-dark-${width}.png`,fullPage:true});
    }
   }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: sample tracker views, search, keyboard sorting, dialog focus/Escape, and both themes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
