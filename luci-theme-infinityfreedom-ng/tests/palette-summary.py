"""Summarize final same-scope audit, source census and artifact hashes."""
import collections
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = '59651e6'
NAMES = ('blackgold', 'canyon', 'luminousblue', 'luminousblue-light')
CSS = 'htdocs/luci-static/infinityfreedom-ng/assets/css/'

def before(rel):
    return subprocess.check_output(['git', 'show', BASE + ':luci-theme-infinityfreedom-ng/' + rel], cwd=ROOT).decode()

def census(text):
    literals = re.findall(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)', text)
    return {'literalOccurrences': len(literals), 'distinctLiterals': len(set(literals)),
            'rules': len(re.findall(r'[^{}]+\{[^{}]*\}', text)),
            'selectors': sum(len(x.split(',')) for x in re.findall(r'([^{}]+)\{[^{}]*\}', text))}

spec = importlib.util.spec_from_file_location('palette_generator', ROOT / 'scripts/gen-palettes.py')
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)
summary = {'baseline': BASE, 'sourceCensus': {}, 'roles': {}, 'audits': {}, 'sha256': {}}
for name in ('bootstrap-dark.min.css', 'app-dark.min.css', 'ng.css') + tuple('palette-' + n + '.min.css' for n in NAMES):
    rel = CSS + name
    summary['sourceCensus'][name] = {'before': census(before(rel)), 'after': census((ROOT / rel).read_text())}
for name in NAMES:
    tokens = gen.parse_tokens(ROOT / ('scripts/palettes/' + name + '.yaml'))
    snapshot = tokens.copy()
    summary['roles'][name] = {role: {'fill': tokens[tok], 'textInk': gen.readable_state(tokens, tok),
                                   'alertLinkInk': gen.readable_state(tokens, tok, .14)}
                              for role, tok in (('success','success'),('warning','warning'),('danger','danger'),('info','info'),('primary','accent'))}
    assert tokens == snapshot, 'derived ink must never mutate tokens'
    assert summary['roles'][name] == {role: {'fill': tokens[tok], 'textInk': gen.readable_state(tokens, tok),
                                           'alertLinkInk': gen.readable_state(tokens, tok, .14)}
                                     for role, tok in (('success','success'),('warning','warning'),('danger','danger'),('info','info'),('primary','accent'))}
    old = dict(re.findall(r'^([\w-]+):\s*"(#[a-fA-F0-9]+)"', before('scripts/palettes/' + name + '.yaml'), re.M))
    expected = {'success','success-deep'} if name.startswith('luminousblue') else set()
    changed = {key for key, value in old.items() if tokens[key] != value}
    assert changed == expected, (name, changed)
for family, keys, count in (('palette-audit', ('name','surface','role','kind','state'), 792),
                            ('palette-interactions', ('name','surface','role','kind','state'), 840),
                            ('palette-focus', ('name','surface','role','kind','state'), 240),
                            ('palette-owners', ('name','id','state'), 104)):
    datasets = [json.loads((ROOT / 'docs' / (family + '-' + state + '.json')).read_text()) for state in ('before','after')]
    identifiers = [[tuple(r[k] for k in keys) for r in data['rows']] for data in datasets]
    assert identifiers[0] == identifiers[1] and len(set(identifiers[0])) == count
    for state, data in zip(('before','after'), datasets):
        rows = data['rows']
        assert len(rows) == data['count'] == count
        assert sum(not r['pass'] for r in rows) == data['failures']
        summary['audits'][family + '-' + state] = {'count': count, 'failures': data['failures'],
            'applicable': sum(r['applicable'] for r in rows),
            'disabledBehaviorOnly': sum(r['state'] == 'disabled' for r in rows),
            'failureKinds': dict(collections.Counter(r['kind'] for r in rows if not r['pass'])),
            'minimumTextContrastByPalette': {name: min(r['textContrast'] for r in rows if r['name'] == name and r['applicable'] and r.get('kind') != 'valid') for name in NAMES}}
    if family == 'palette-owners':
        for a, b in zip(datasets[0]['rows'], datasets[1]['rows']):
            for key in ('color','background','fontFamily','fontWeight','iconColor'):
                assert a[key] == b[key], (a['name'], a['id'], a['state'], key)
semantic = ('palette-audit', 'palette-interactions', 'palette-focus')
# Ordinary-button focus keys are distinct from btn-check/pressed/class-active keys.
for state in ('before', 'after'):
    all_keys = [tuple(r[k] for k in ('name','surface','role','kind','state'))
                for family in semantic
                for r in json.loads((ROOT / 'docs' / (family + '-' + state + '.json')).read_text())['rows']]
    assert len(all_keys) == len(set(all_keys)) == 1872
summary['extendedSemanticTotals'] = {state: {
    key: sum(summary['audits'][family + '-' + state][key] for family in semantic)
    for key in ('count', 'failures', 'applicable', 'disabledBehaviorOnly')
} for state in ('before', 'after')}
probe = json.loads((ROOT / 'docs/independent-targeted-after.json').read_text())
final_probe = [r for r in probe['rows'] if not r['baseline']]
assert len(probe['rows']) == 24 and len(final_probe) == 12
assert len({(r['name'], r['state']) for r in final_probe}) == 12
assert not probe['finalFailures'] and all(r['contrast'] >= 4.5 for r in final_probe)
summary['independentTargetedProbe'] = {'count': 24, 'finalCount': 12, 'finalFailures': 0,
    'scope': 'Unmodified independent targeted.cjs; final source only, no remote deployment'}
for file in sorted((ROOT / 'docs').glob('*.json')):
    if file.name != 'palette-summary.json':
        summary['sha256'][file.name] = hashlib.sha256(file.read_bytes()).hexdigest()
for name in NAMES:
    rel = CSS + 'palette-' + name + '.min.css'
    summary['sha256'][rel] = hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()
out = ROOT / 'docs/palette-summary.json'
out.write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
