// Run against a production preview. API responses and resume scoring are
// intercepted: this check never writes tracker data or calls the paid scorer.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:5185';
const output = process.env.PORTFOLIO_REVIEW_DIR || '.portfolio-review';
const log = [];
const externalLinks = new Set();
const profile = { username:'sample', solved:{total:12,easy:5,medium:6,hard:1},languages:[],rank:10000 };
const score = { overall:80,categories:[],recommendations:[],highlights:{awsServices:[],techStack:[]},wordCount:100 };
const paths=['','/experience/aws','/experience/tangerine/2021','/experience/tangerine/2020','/projects/jobrelay','/projects/ascend','/projects/oncall-assistant','/education/york','/skills','/live/leetcode','/live/activity','/analyzer/score'];
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
  let failActivity=false,failProfile=false,empty=false,delay=0;
  await context.route('**/public/trackers/*/entries',async route=>{
   if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
   const activity=route.request().url().includes('/activity/');
   if(activity&&failActivity)return route.fulfill({status:503,json:{error:'Unavailable'}});
   await route.fulfill({json:activity&&!empty?[{id:'sample',title:'Sample practice',date:'2026-10-23',category:'Coding',duration:30}]:[]});
  });
  await context.route('**/api/leetcode-stats?*',route=>route.fulfill(failProfile?{status:503,json:{error:'Unavailable'}}:{json:profile}));
  await context.route('**/api/analyze-resume',route=>route.fulfill({json:score}));
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const collectLinks=async()=>{
   for(const href of await page.locator('a[href^="https://github.com/edgarsetyan23/"]').evaluateAll(links=>links.map(a=>a.href)))externalLinks.add(href);
  };
  // Every public route, including deep links at phone, laptop and desktop sizes.
  for(const width of [390,1100,1440]) {
   await page.setViewportSize({width,height:900});
   for(const route of paths) {
    await page.goto(`${base}/portfolio${route}`,{waitUntil:'domcontentloaded'});
    await page.locator('.exh-title').waitFor();
    await page.waitForTimeout(100);
    assert.match(await page.title(),/Edgar Setyan/);
    assert.equal(await page.locator('h1').count(),1);
    const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
    if(!fits) {
     console.log(await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,90),right:e.getBoundingClientRect().right})).slice(0,12)));
     await page.screenshot({path:`${output}/overflow.png`,fullPage:true});
    }
    assert.ok(fits,`Horizontal overflow: ${width} ${route}`);
    await collectLinks();
    if(!route) {
     assert.equal(await page.locator('.exh-featured-card').count(),3);
     await page.locator('.exh-featured-image').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
     assert.equal(await page.locator('.exh-card').evaluateAll(cards=>cards.filter(card=>getComputedStyle(card).opacity==='1').length),5,'Navigation must remain visible with reduced motion');
     await page.screenshot({path:`${output}/home-${width}.png`,fullPage:true});
    }
   }
   log.push(`12 public routes rendered without overflow at ${width}px`);
  }
  await page.goto(`${base}/portfolio`);
  await page.locator('.exh-title').waitFor();
  // Keyboard skip link and mobile menu reach the actual selected heading.
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').textContent(),'Skip to content');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'),'portfolio-content');
  await page.setViewportSize({width:390,height:844});
  const menu=page.locator('.exh-mobile-nav-toggle');
  await menu.focus();
  await page.keyboard.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'),'true');
  const jobrelay=page.locator('.exh-nav-item[href="/portfolio/projects/jobrelay"]');
  await jobrelay.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/portfolio/projects/jobrelay');
  await page.waitForFunction(()=>document.activeElement?.classList.contains('exh-title'));
  assert.equal(await page.locator('.exh-mobile-nav-toggle').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator(':focus').getAttribute('class'),'exh-title');
  assert.ok(await page.evaluate(()=>scrollY<10));
  // PDF download must contain actual PDF bytes, not a fallback HTML page.
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download résumé'}).click()]);
  assert.equal(download.suggestedFilename(),'Edgar_Setyan_Resume.pdf');
  const pdf=fs.readFileSync(await download.path());
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  log.push('Keyboard navigation, heading focus, and real PDF download passed');
  // Exercise the sample workflow through keyboard controls.
  await page.goto(`${base}/portfolio/projects/ascend`);
  await page.getByRole('button',{name:/Try the sample workflow/}).click();
  await page.locator('#ascend-demo-heading').waitFor();
  assert.equal(await page.locator(':focus').getAttribute('id'),'ascend-demo-heading');
  const firstCheckbox=page.locator('.exh-demo input[type="checkbox"]').first();
  await firstCheckbox.focus();await page.keyboard.press('Space');
  await page.getByRole('button',{name:/Simulate import \(3 selected\)/}).click();
  assert.match(await page.locator('.exh-demo-result-heading').textContent(),/3 entries/);
  await page.getByRole('button',{name:/Reset demo/}).click();
  assert.equal(await page.locator('.exh-demo input:checked').count(),4);
  await collectLinks();
  log.push('Ascend sample selection, import and reset passed');
  // Busy, one-feed failure, retry and truly empty states.
  failActivity=true;delay=900;
  await page.goto(`${base}/portfolio/live/activity`);
  await page.getByRole('status').filter({hasText:'Loading live data'}).waitFor();
  await page.getByRole('alert').filter({hasText:'temporarily unavailable'}).waitFor();
  failActivity=false;delay=0;
  await page.getByRole('button',{name:'Try again'}).click();
  await page.getByText('Sample practice',{exact:true}).waitFor();
  empty=true;
  await page.reload();
  await page.getByText('No public activity entries yet.').waitFor();
  failProfile=true;
  await page.goto(`${base}/portfolio/live/leetcode`);
  await page.getByText(/stats are temporarily unavailable/).waitFor();
  assert.equal(await page.locator('.lc-donut').count(),0);
  log.push('Live loading, independent feed failure, retry, empty and profile-error states passed');
  // PDF file selection works with Enter; malformed files produce a clear error.
  await page.goto(`${base}/portfolio/analyzer/score`);
  const upload=page.getByRole('button',{name:'Choose a resume PDF'});
  await upload.focus();
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.keyboard.press('Enter')]);
  await chooser.setFiles({name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});
  await page.getByRole('alert').filter({hasText:'Could not read this PDF'}).waitFor();
  await page.locator('input[type="file"]').setInputFiles('public/Edgar_Resume.pdf');
  await page.getByText('Scored by Claude AI',{exact:false}).waitFor();
  log.push('Keyboard PDF upload, invalid-file feedback and scoring UI passed (scorer mocked)');
  // Theme and email controls remain usable.
  await page.getByRole('button',{name:'Toggle theme'}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  assert.match(await page.getByRole('link',{name:'Email edgar.setyan23@gmail.com'}).getAttribute('href'),/^mailto:/);
  await page.screenshot({path:`${output}/resume-dark-mobile.png`,fullPage:true});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${output}/external-links.json`,JSON.stringify([...externalLinks],null,2));
  fs.writeFileSync(`${output}/journey-results.json`,JSON.stringify({checks:log,errors},null,2));
  log.forEach(item=>console.log('PASS',item));
 }finally{
  fs.writeFileSync(`${output}/external-links.json`,JSON.stringify([...externalLinks],null,2));
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
