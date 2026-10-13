/* Real Edge: production input+label and self-show dropdowns, no artificial input visibility. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require(process.env.HOMESTATUS_PLAYWRIGHT);
const root=path.resolve(__dirname,'..'), baseline=process.argv.includes('--baseline');
const names=['blackgold','canyon','luminousblue','luminousblue-light'],roles=['success','warning','danger','info','primary'];
const revision=baseline?'59651e6':process.env.AUDIT_REVISION;
const read=f=>revision?cp.execFileSync('git',['show',revision+':luci-theme-infinityfreedom-ng/'+f],{cwd:root,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(root,f),'utf8');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const rows=[];
try {for(const name of names){const page=await browser.newPage({viewport:{width:1600,height:1000}});
const css=['bootstrap-dark.min.css','app-dark.min.css','ng.css','palette-'+name+'.min.css'].map(x=>read('htdocs/luci-static/infinityfreedom-ng/assets/css/'+x)).join('\n')+'\n*{transition:none!important;animation:none!important}';
for(const surface of ['card','card2','deep']){const yaml=read('scripts/palettes/'+name+'.yaml'),background=yaml.match(new RegExp('^bg-'+surface+':\\s*"(#[a-fA-F0-9]+)"','m'))[1];
for(const role of roles){for(const kind of ['solid','outline']){for(const state of ['dropdown-show','focus-unchecked','focus-checked','focus-unchecked-hover','focus-checked-hover','focus-unchecked-active','focus-checked-active']){
const focus=state.startsWith('focus-'),checked=state.startsWith('focus-checked'),hover=state.endsWith('-hover'),active=state.endsWith('-active');
const cls=`btn btn-${kind==='outline'?'outline-':''}${role}`;
const fixture=focus?`<input type="checkbox" id="check" class="btn-check" autocomplete="off" ${checked?'checked':''}><label for="check" id="target" class="${cls}">状态 ${role}</label>`:`<button id="target" class="${cls} dropdown-toggle show">状态 ${role}</button>`;
await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body data-if-palette="${name}"><section style="padding:30px;background:${background}">${fixture}</section></body></html>`);
await page.mouse.move(1590,990);
if(focus){await page.keyboard.press('Tab');if(!await page.locator('#check').evaluate(e=>e.matches(':focus')))throw new Error('Tab did not focus production btn-check');}
if(hover){await page.locator('#target').hover();await page.waitForFunction(()=>document.querySelector('#target').matches(':hover'));}
if(active)await page.locator('#target').evaluate(e=>e.classList.add('active'));
const row=await page.locator('#target').evaluate((e,meta)=>{
const rgba=s=>{let a=s.match(/[\d.]+/g).map(Number);if(s.startsWith('color(srgb'))a=a.map((v,i)=>i<3?v*255:v);return [a[0],a[1],a[2],a.length>3?a[3]:1]};
const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));const bg=e=>e?over(rgba(getComputedStyle(e).backgroundColor),bg(e.parentElement)):[255,255,255];
const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const s=getComputedStyle(e),b=bg(e),textContrast=contrast(over(rgba(s.color),b),b);
const input=document.querySelector('#check');
return {...meta,color:s.color,background:s.backgroundColor,effectiveBackground:b,textContrast,hover:e.matches(':hover'),inputFocused:input?input.matches(':focus'):null,inputChecked:input?input.checked:null,labelActive:e.classList.contains('active'),inputActive:input?input.matches(':active'):null,applicable:true,required:4.5,pass:textContrast>=4.5};
},{name,surface,role,kind,state});
if(row.hover!==hover || (focus&&(row.inputFocused!==true||row.inputChecked!==checked||row.labelActive!==active)))throw new Error('interaction fixture state mismatch: '+JSON.stringify(row));
rows.push(row);
}}}}await page.close();}}
finally{await browser.close();}
const out=process.env.AUDIT_OUTPUT||path.join(root,'docs','palette-interactions-'+(baseline?'before':'after')+'.json');
fs.writeFileSync(out,JSON.stringify({engine:'real headless Microsoft Edge',baseline,count:rows.length,failures:rows.filter(r=>!r.pass).length,rows},null,2)+'\n');
console.log(JSON.stringify({out,count:rows.length,failures:rows.filter(r=>!r.pass).length,firstFailure:rows.find(r=>!r.pass)}));
if(process.argv.includes('--assert')&&rows.some(r=>!r.pass))process.exitCode=1;
})();
