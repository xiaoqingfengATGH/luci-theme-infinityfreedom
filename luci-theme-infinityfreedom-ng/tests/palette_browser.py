"""Real Edge picker regression; HTTP fixture prevents any router UCI writes."""
import json, re, sys, threading, subprocess
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parents[1]
assets=P/'htdocs/luci-static/infinityfreedom-ng/assets'
header=(P/'ucode/template/themes/infinityfreedom-ng/header.ut').read_text()
version=re.search(r'const ng_palette_version = \'([^\']+)\'',header)
version=version.group(1) if version else re.search(r'palette-.*?css\?v=(\d+)',header).group(1)
names=['default','luminousblue','canyon','blackgold','luminousblue-light']
requests=[]
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*a): pass
 def do_GET(self):
  requests.append(self.path)
  if self.path.startswith('/page'):
   initial=self.path.split('=')[-1] if '=' in self.path else 'luminousblue-light'
   link='' if initial=='default' else f'<link id="if-palette-stylesheet" rel="stylesheet" href="/assets/css/palette-{initial}.min.css?v={version}">'
   body=f'''<html><head><link rel="stylesheet" href="/assets/css/bootstrap-dark.min.css"><link id="app-dark-stylesheet" rel="stylesheet" href="/assets/css/app-dark.min.css">{link}<meta name="if-palette-assets" content="/assets/css/" data-version="{version}"><script src="/assets/js/ng-palette.js"></script></head><body data-if-palette="{initial}"><div id="if-palette-picker" data-current="{initial}">'''+''.join(f'<a href="#" class="if-palette-option" data-palette="{n}">{n}<i></i></a>' for n in names)+'''</div><button id="cache-color-probe" class="btn btn-success">success</button><style>*,*::before,*::after{transition:none!important;animation:none!important}</style></body></html>'''
   data=body.encode(); typ='text/html'
  else:
   path=self.path.split('?')[0]; f=assets/path.removeprefix('/assets/')
   if not f.is_file(): self.send_error(404); return
   data=f.read_bytes(); typ='text/css' if f.suffix=='.css' else 'text/javascript'
   if '--baseline' in sys.argv and f.name=='ng-palette.js':
    data=subprocess.check_output(['git','-C',str(P.parent),'show','d60ffbb:luci-theme-infinityfreedom-ng/htdocs/luci-static/infinityfreedom-ng/assets/js/ng-palette.js'])
   # Deterministic stale historical URL, not a replacement for current CSS.
   if f.suffix=='.css' and '?v=13' in self.path:
    data+=b'\nhtml body[data-if-palette] #cache-color-probe.btn-success {background-color:rgb(111,112,1)!important;}'
  self.send_response(200); self.send_header('Content-Type',typ); self.send_header('Cache-Control','public,max-age=3600'); self.end_headers(); self.wfile.write(data)
srv=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=srv.serve_forever,daemon=True).start()
results=[]; failures=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel='msedge',headless=True)
 page=browser.new_page()
 page.on("response",lambda response: failures.append({"http_error":response.url,"status":response.status}) if response.status>=400 and not response.url.endswith("favicon.ico") else None)
 origin=f'http://127.0.0.1:{srv.server_port}'
 for initial in ['luminousblue-light','default']:
  page.goto(origin+'/page?initial='+initial);page.wait_for_load_state('networkidle')
  baseline=page.locator('.btn-success').evaluate('(e)=>getComputedStyle(e).backgroundColor') if initial=='luminousblue-light' else None
  for n in ['canyon','luminousblue-light','default','blackgold','luminousblue','default','luminousblue-light','canyon','luminousblue-light']:
   page.locator(f'[data-palette="{n}"]').click(); page.wait_for_load_state('networkidle')
   href=page.locator('#if-palette-stylesheet').get_attribute('href') if page.locator('#if-palette-stylesheet').count() else None
   color=page.locator('.btn-success').evaluate('(e)=>getComputedStyle(e).backgroundColor')
   item={'initial':initial,'palette':n,'href':href,'success':color}; results.append(item)
   if n=='default':
    if href is not None: failures.append(item)
   elif href.removeprefix(origin)!=f'/assets/css/palette-{n}.min.css?v={version}': failures.append(item)
   if initial=='luminousblue-light' and n=='luminousblue-light' and color!=baseline: failures.append(item)
  page.reload(); page.wait_for_load_state('networkidle')
  refreshed=page.locator('#if-palette-stylesheet').get_attribute('href') if page.locator('#if-palette-stylesheet').count() else None
  assert (refreshed is None) if initial=='default' else refreshed.endswith('?v='+version)
 browser.close()
srv.shutdown()
report={'version':version,'results':results,'requests':requests,'failures':failures,'isolated':True}
print(json.dumps(report,indent=2));sys.exit(bool(failures))
