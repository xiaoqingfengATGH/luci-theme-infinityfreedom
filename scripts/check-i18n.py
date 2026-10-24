#!/usr/bin/env python3
"""Check theme literal translations against its PO and LuCI base catalog.

Usage: python scripts/check-i18n.py --luci-base-po PATH
Requires polib (e.g. uv run --with polib python scripts/check-i18n.py ...).
This is a source/catalog check, not a substitute for router rendering tests.
"""
import argparse
from pathlib import Path
import re
import polib

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'luci-theme-infinityfreedom-ng'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--luci-base-po', type=Path, required=True)
args = parser.parse_args()
errors = []
po_path = PACKAGE / 'po/zh_Hans/infinityfreedom-ng.po'
pot_path = PACKAGE / 'po/templates/infinityfreedom-ng.pot'
if not po_path.exists() or not pot_path.exists():
    raise SystemExit('FAIL: theme PO/POT catalogs are missing')
po = polib.pofile(str(po_path), check_for_duplicates=True)
pot = polib.pofile(str(pot_path), check_for_duplicates=True)
base = polib.pofile(str(args.luci_base_po))
translations = {e.msgid: e.msgstr for e in base if e.msgstr and not e.obsolete}
translations.update({e.msgid: e.msgstr for e in po if e.msgstr and not e.obsolete})
keys = set()
for path in sorted((PACKAGE / 'ucode/template').rglob('*.ut')):
    text = path.read_text(encoding='utf-8')
    text = re.sub(r'\{#.*?#\}|<!--.*?-->|/\*.*?\*/', '', text, flags=re.S)
    for key in re.findall(r"_\('([^'\\]*)'\)", text):
        keys.add(key)
        if re.search(r'[\u4e00-\u9fff]', key):
            errors.append(f'{path.name}: Chinese source key: {key}')
        if not translations.get(key):
            errors.append(f'{path.name}: missing Chinese translation: {key}')
    for line in text.splitlines():
        if re.search(r'[\u4e00-\u9fff]', line):
            errors.append(f'{path.name}: hard-coded Chinese: {line.strip()}')
    for value in re.findall(r'(?:placeholder|aria-label)="([^"]*)"', text):
        if value and '{{' not in value:
            errors.append(f'{path.name}: untranslated attribute: {value}')
custom = {e.msgid for e in po if not e.obsolete}
if custom != {e.msgid for e in pot if not e.obsolete}:
    errors.append('PO and POT keys differ')
for entry in po:
    if entry.msgid and (not entry.msgstr or 'fuzzy' in entry.flags):
        errors.append(f'Incomplete translation: {entry.msgid}')
if custom - keys:
    errors.append(f'Unused theme keys: {sorted(custom - keys)}')
js = PACKAGE / 'htdocs/luci-static/infinityfreedom-ng/assets/js/ngRender.js'
if re.search(r'[\u4e00-\u9fff]', js.read_text(encoding='utf-8')):
    errors.append('ngRender.js: hard-coded Chinese')
if translations.get('Log in') != '登录':
    errors.append('Standard Log in translation is not 登录')
if errors:
    raise SystemExit('FAIL:\n' + '\n'.join(errors))
print(f'PASS: {len(keys)} literal template keys covered; {len(custom)} theme translations; PO/POT consistent; no hard-coded Chinese UI strings')
