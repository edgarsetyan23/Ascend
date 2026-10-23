// Anonymous read-only checks: no logged-in cookies and no scoring requests.
const { request, chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const output=process.env.PORTFOLIO_REVIEW_DIR||'.portfolio-review';
(async()=>{
 const api=await request.newContext({timeout:20000});
 const links=JSON.parse(fs.readFileSync(`${output}/external-links.json`,'utf8'));
 const results=[];
 try {
  for(let i=0;i<links.length;i+=3) {
   const batch=await Promise.allSettled(links.slice(i,i+3).map(async url=>{
    // Raw URLs verify that the linked branch/file exists, without GitHub's
    // HTML-page throttling. Repository landing pages are checked directly.
    const checkUrl=url.replace('https://github.com/','https://raw.githubusercontent.com/').replace('/blob/','/');
    const response=await api.get(url.includes('/blob/')?checkUrl:url);
    return {url,status:response.status()};
   }));
   batch.forEach((result,index)=>results.push(result.status==='fulfilled'?result.value:{url:links[i+index],error:result.reason.message}));
  }
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
   const page=await browser.newPage({viewport:{width:1100,height:800},serviceWorkers:'block'});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   const response=await page.goto('https://www.edgarsetyan.com/portfolio',{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('.exh-title').waitFor();
   const pdf=await api.get('https://www.edgarsetyan.com/Edgar_Resume.pdf');
   results.push({url:page.url(),status:response.status(),heading:await page.locator('.exh-title').textContent(),errors});
   results.push({url:pdf.url(),status:pdf.status(),validPdf:(await pdf.body()).subarray(0,5).toString()==='%PDF-'});
   for(const route of ['/live/activity','/live/leetcode']) {
    await page.goto(`https://www.edgarsetyan.com/portfolio${route}`,{waitUntil:'domcontentloaded'});
    await page.locator('.exh-title').waitFor();
    await page.waitForFunction(()=>!document.querySelector('.exh-loading'),{},{timeout:20000});
    if(route.endsWith('leetcode'))await page.waitForFunction(()=>!document.querySelector('.lc-profile--loading'),{},{timeout:20000});
    const errorText=await page.locator('.exh-error').allTextContents();
    results.push({url:page.url(),status:200,liveDataError:errorText.join(' '),errors:[...errors]});
   }
  } finally {await browser.close()}
 } finally {await api.dispose()}
 fs.writeFileSync(`${output}/public-link-results.json`,JSON.stringify(results,null,2));
 results.forEach(result=>console.log(JSON.stringify(result)));
 if(results.some(result=>result.error||result.liveDataError||result.status!==200||result.validPdf===false||result.errors?.length))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
