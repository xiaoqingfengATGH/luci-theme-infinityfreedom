/* Real ordinary-button focus: Tab and press/move-out/release; never synthetic .active. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require(process.env.HOMESTATUS_PLAYWRIGHT);
const root=path.resolve(__dirname,'..'),baseline=process.argv.includes('--baseline');
const revision=baseline?'59651e6':process.env.AUDIT_REVISION;
const read=f=>revision?cp.execFileSync('git',['show',revision+':luci-theme-infinityfreedom-ng/'+f],{cwd:root,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(root,f),'utf8');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),rows=[];
try{for(const name of ['blackgold','canyon','luminousblue','luminousblue-light']){
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const css=['bootstrap-dark.min.css','app-dark.min.css','ng.css','palette-'+name+'.min.css'].map(x=>read('htdocs/luci-static/infinityfreedom-ng/assets/css/'+x)).join('\n')+'\n*{transition:none!important;animation:none!important}';
for(const surface of ['card','card2'])for(const role of ['success','warning','danger','info','primary'])for(const kind of ['solid','outline'])for(const state of ['button-tab-focus','button-press-moveout','button-release-moveout']){
const background=read('scripts/palettes/'+name+'.yaml').match(new RegExp('^bg-'+surface+':\\s*"(#[a-fA-F0-9]+)"','m'))[1];
await page.setContent(`<!doctype html><style>${css}</style><body data-if-palette="${name}"><section style="padding:30px;background:${background}"><button id="target" class="btn btn-${kind==='outline'?'outline-':''}${role}">Button ${role}</button></section></body>`);
await page.mouse.move(1590,990);
const rest=await page.locator('#target').evaluate(e=>{const s=getComputedStyle(e);return {color:s.color,background:s.backgroundColor};});
if(state==='button-tab-focus')await page.keyboard.press('Tab');
else {await page.locator('#target').hover();await page.mouse.down();await page.mouse.move(1590,990);if(state==='button-release-moveout')await page.mouse.up();}
const row=await page.locator('#target').evaluate((e,meta)=>{
const rgba=s=>{let a=s.match(/[\d.]+/g).map(Number);if(s.startsWith('color(srgb'))a=a.map((v,i)=>i<3?v*255:v);return [a[0],a[1],a[2],a.length>3?a[3]:1]};
const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])),bg=e=>e?over(rgba(getComputedStyle(e).backgroundColor),bg(e.parentElement)):[255,255,255];
const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
const s=getComputedStyle(e),b=bg(e),t=over(rgba(s.color),b),textContrast=(Math.max(lum(t),lum(b))+.05)/(Math.min(lum(t),lum(b))+.05);
const matching=[];for(const sheet of document.styleSheets)for(const r of sheet.cssRules){if(r.selectorText&&r.style&&(r.style.color||r.style.backgroundColor))for(const selector of r.selectorText.split(',')){try{if(e.matches(selector))matching.push({selector,color:r.style.color,background:r.style.backgroundColor});}catch{}}}
return {...meta,color:s.color,background:s.backgroundColor,effectiveBackground:b,textContrast,hover:e.matches(':hover'),active:e.matches(':active'),focus:e.matches(':focus'),focusVisible:e.matches(':focus-visible'),boxShadow:s.boxShadow,applicable:true,required:4.5,pass:textContrast>=4.5&&s.boxShadow!=='none',...(textContrast<4.5?{matching}: {})};
},{name,surface,role,kind,state});
row.rest=rest;
row.restoredRest=state==='button-press-moveout'||(row.color===rest.color&&row.background===rest.background);
row.pass=row.pass&&row.restoredRest;
if(!row.focus||row.hover||(state==='button-release-moveout'&&row.active)||(state==='button-tab-focus'&&!row.focusVisible))throw Error('real interaction mismatch '+JSON.stringify(row));
rows.push(row);await page.mouse.up();
}await page.close();}}
finally{await browser.close();}
const out=process.env.AUDIT_OUTPUT||path.join(root,'docs','palette-focus-'+(baseline?'before':'after')+'.json');
fs.writeFileSync(out,JSON.stringify({engine:'real headless Microsoft Edge',baseline,revision:revision||'working tree',count:rows.length,failures:rows.filter(r=>!r.pass).length,rows},null,2)+'\n');
console.log(JSON.stringify({out,count:rows.length,failures:rows.filter(r=>!r.pass).length,firstFailure:rows.find(r=>!r.pass)}));
if(process.argv.includes('--assert')&&rows.some(r=>!r.pass))process.exitCode=1;
})();
