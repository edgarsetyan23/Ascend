// Capture the real JobRelay UI against deterministic sample responses.
// The screenshot is labelled as sample data, not a running public service.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.JOBRELAY_PUBLIC_DIR || '../jobrelay/public');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1040,height:520},deviceScaleFactor:1});
  const jobs = ['queued','running','succeeded','failed'].map((status,i)=>({
   id:`sample0${i+1}-dashboard`,status,isDemo:true,attempts:i===3?3:1,
   createdAt:'2026-10-23T12:00:00Z',payload:{originalFilename:['landscape.jpg','portrait.png','sample.jpg','upload.webp'][i]},
  }));
  await page.route('http://jobrelay.preview/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/')) {
    const data=url.pathname==='/api/jobs'?{jobs}:url.pathname==='/api/workers'?{workers:[{id:'worker-01',kind:'main',status:'busy',currentJobId:jobs[1].id},{id:'worker-02',kind:'demo',status:'idle'}]}:{demoEnabled:true};
    return route.fulfill({json:data});
   }
   const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!['index.html','styles.css','app.js','sample.jpg'].includes(name)) return route.abort();
   await route.fulfill({body:fs.readFileSync(path.join(root,name)),contentType:({'index.html':'text/html','styles.css':'text/css','app.js':'text/javascript','sample.jpg':'image/jpeg'})[name]});
  });
  await page.goto('http://jobrelay.preview/');
  await page.locator('#column-succeeded .ticket').waitFor();
  await page.evaluate(()=>{
   document.querySelector('.site-header .sub').textContent='Dashboard preview · Sample data';
   document.querySelector('#upload-heading').closest('section').remove();
   document.querySelector('#detail-heading').closest('section').remove();
   document.querySelector('#stations-heading').closest('section').remove();
   document.querySelector('#demo-section').remove();
   document.querySelector('.hint').remove();
  });
  await page.addStyleTag({content:'header.site-header{padding:18px 20px 12px}main{padding:16px 20px}main section{margin-bottom:12px}h2{font-size:18px}.board{gap:12px}.ticket{padding:12px;color:var(--ink)}.column{padding:12px}'});
  await page.screenshot({path:'public/previews/jobrelay-dashboard.png',clip:{x:0,y:0,width:1040,height:420}});
  console.log('Saved labelled sample dashboard preview.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
