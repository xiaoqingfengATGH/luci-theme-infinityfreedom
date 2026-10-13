/* Real Edge component-family regression, including body-level modal portal. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HOMESTATUS_PLAYWRIGHT);
const root=path.resolve(__dirname,'..');
const cp=require('node:child_process');
const read=f=>process.env.AUDIT_REVISION?cp.execFileSync('git',['show',process.env.AUDIT_REVISION+':luci-theme-infinityfreedom-ng/'+f],{cwd:root,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(root,f),'utf8');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),rows=[];
try{for(const name of ['blackgold','canyon','luminousblue','luminousblue-light']){
const page=await browser.newPage();
const css=['bootstrap-dark.min.css','app-dark.min.css','ng.css'].map(f=>read('htdocs/luci-static/infinityfreedom-ng/assets/css/'+f)).join('\n')+'\n'+fs.readFileSync(process.env.HOMESTATUS_OVERVIEW_CSS,'utf8')+'\n'+read('htdocs/luci-static/infinityfreedom-ng/assets/css/palette-'+name+'.min.css');
const pills=['b','g','w','r',''].map(c=>`<span class="ngov-pill ${c}"><i></i>${c||'neutral'}</span>`).join('');
const extended=process.env.AUDIT_EXTENDED==='1';
const extra=extended?'<div class="ngov-device-tools"><input placeholder="Search"></div><input class="form-control" placeholder="Search"><input class="form-control" type="search" placeholder="Search"><input class="form-control" type="text" placeholder="Search"><textarea class="form-control" placeholder="Search"></textarea>':'';
await page.setContent(`<!doctype html><style>${css}</style><body data-if-palette="${name}"><main class="ngov"><section class="ngov-card">${pills}${extra}</section></main><div class="ngov ngov-device-shade"><section class="ngov-device-panel"><header class="ngov-device-head"><h2>全部接入设备</h2></header><div class="ngov-device-tools"><input placeholder="搜索设备名称、IP 或 MAC"></div><div class="ngov-device-list"><table><tbody><tr class="ngov-device-row"><td><span class="ngov-avatar">GW</span></td><td>${pills}</td><td><button class="ngov-link">网络详情</button></td></tr></tbody></table></div></section></div></body>`);
// Copy the same resolved variables as the real application portal.
await page.evaluate(()=>{let s=getComputedStyle(document.querySelector('main.ngov')),p=document.querySelector('.ngov-device-shade');for(let n of ['card','card2','line','fg','fg2','fg3','ok','warn','crit','info','primary','mono'])p.style.setProperty('--ngov-'+n,s.getPropertyValue('--ngov-'+n));});
for(const selector of ['main .ngov-pill','.ngov-device-panel .ngov-pill','.ngov-avatar','.ngov-link','.ngov-device-panel h2','.ngov-device-panel .ngov-device-tools input',...(extended?['main input','main textarea']:[])])for(const e of await page.locator(selector).all()){
rows.push(await e.evaluate((e,name)=>{const rgba=s=>{let a=s.match(/[\d.]+/g).map(Number);if(s.startsWith('color(srgb'))a=a.map((v,i)=>i<3?v*255:v);return [a[0],a[1],a[2],a.length>3?a[3]:1]};const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])),bg=e=>e?over(rgba(getComputedStyle(e).backgroundColor),bg(e.parentElement)):[255,255,255];const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);let s=getComputedStyle(e,['INPUT','TEXTAREA'].includes(e.tagName)?'::placeholder':null),b=bg(e),t=over(rgba(s.color),b),ratio=(Math.max(lum(t),lum(b))+.05)/(Math.min(lum(t),lum(b))+.05);return {name,component:e.className,portal:!!e.closest('.ngov-device-shade'),color:s.color,background:getComputedStyle(e).backgroundColor,effectiveBackground:b,ratio,pass:ratio>=4.5};},name));}
await page.close();}}
finally{await browser.close();}
const failures=rows.filter(r=>!r.pass);
if(process.env.AUDIT_COMPARE){const before=JSON.parse(fs.readFileSync(process.env.AUDIT_COMPARE,'utf8')).rows;assert.equal(rows.length,before.length);rows.forEach((r,i)=>{const old=before[i];assert.deepEqual([r.name,r.component,r.portal],[old.name,old.component,old.portal]);assert.equal(r.background,old.background,'component fill must stay unchanged');assert.deepEqual(r.effectiveBackground,old.effectiveBackground,'actual composited surface must stay unchanged');if(r.component==='ngov-pill b')assert.equal(r.color,old.color,'approved blue ink must stay unchanged');});}
fs.writeFileSync(process.env.AUDIT_OUTPUT||path.join(root,'docs/modal-audit.json'),JSON.stringify({engine:'real headless Microsoft Edge',count:rows.length,failures:failures.length,rows},null,2)+'\n');console.log(JSON.stringify({count:rows.length,failures}));
// Every enabled text role must pass; neutral pills are enabled, not disabled.
assert.equal(rows.length,process.env.AUDIT_EXTENDED==='1'?76:56,'four palettes with both pill scopes and real modal roles');
assert.equal(failures.length,0,'all enabled modal text roles must meet AA');
})();
