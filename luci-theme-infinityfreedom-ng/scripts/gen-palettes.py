#!/usr/bin/env python3
"""
Palette generator for luci-theme-infinityfreedom-ng.

Reads token files from scripts/palettes/*.yaml and emits, for every
non-default palette, a self-contained override stylesheet:

    htdocs/luci-static/infinityfreedom-ng/assets/css/palette-<name>.min.css

The override sheet has three sections:

  1. VARIABLE OVERRIDES
     A `body[data-if-palette="<name>"]{...}` rule that redefines every
     --bs-* variable (and derived rgb triplets) the theme's bootstrap-dark
     defines in :root. ngOverview.css (and any future var() consumer)
     follows automatically.

  2. HARDCODED-COLOR OVERRIDES
     The baseline CSS (bootstrap-dark.min.css, app-dark.min.css, ng.css,
     ngOverview.css) hardcodes ~600 colors outside of variables. For every
     rule in those files whose body contains a mapped color, an override
     rule is emitted with the SAME selector(s), prefixed with
     `body[data-if-palette="<name>"] ` to win the cascade, and the mapped
     colors replaced by the palette tokens.

  3. PALETTE-SPECIFIC FIXUPS
     Hand-written rules that cannot be expressed as a color swap (e.g.
     the login rainbow line becomes a gold gradient, the loading cover,
     shadows re-tinted). Kept in FIXUPS below as a python dict.

Color -> role mapping lives in COLOR_MAP (per file). It was built from a
full census of the four files (every hex + rgba occurrence); colors not in
the map are intentionally left alone (pure white/black, images, the rare
unclassifiable tint - see gen report).

Usage:  python3 scripts/gen-palettes.py          # regenerate all
        python3 scripts/gen-palettes.py --check  # verify committed files
                                               # are up to date (CI guard)
"""

import re
import sys
import glob
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
CSS_DIR = os.path.join(PKG, 'htdocs', 'luci-static', 'infinityfreedom-ng', 'assets', 'css')

# baseline sheets that hardcoded colors are read from, in cascade order
BASE_FILES = [
    'bootstrap-dark.min.css',
    'app-dark.min.css',
    'ng.css',
    'ngOverview.css',
]

# ---------------------------------------------------------------- helpers --

def parse_tokens(path):
    """Minimal YAML subset parser: `key: "value"` / `key: value` lines.
    Inline comments (# after the value) are stripped; values containing #
    (hex colors) must be quoted."""
    tokens = {}
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        m = re.match(r'^([a-z0-9-]+)\s*:\s*("[^"]*")\s*(?:#.*)?$', line) \
            or re.match(r'^([a-z0-9_-]+)\s*:\s*([^#]*?)\s*(?:#.*)?$', line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        tokens[key] = val
    return tokens

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

# ------------------------------------------------------------ color maps --
# old color -> token name. Per file where the same hex is used with
# different meanings, but overwhelmingly one global map suffices; the
# file key just documents where each entry came from.
#
# Built from the census (see commit message): every occurrence was
# inspected. Colors present but intentionally NOT mapped:
#   #ffffff / #000000 / #eee  - pure anchors
#   image urls, rgba() of white/black - keep as-is
#   #0099cc, #0066cc, #1d63ed, #28a745, #e91c62, #ec3372, #732f46,
#   #6658dd, #0ebeff..#47cf73 (rainbow line - handled in FIXUPS),
#   #07223e, #444444, #565e64, #5c636a, #2c333b, #333333, #666666,
#   #dddddd, #f8fafc  - legacy single-site leftovers, near-invisible or
#   neutral enough to not clash (kept neutral under any palette)

COLOR_MAP = {
    # accents (the old blue family)
    '348cd4': 'accent',
    '2c77b4': 'accent',
    '246294': 'accent-strong',
    '21649b': 'accent-strong',
    '1f547f': 'accent-strong',
    '194366': 'accent-strong',
    '2571b0': 'accent-strong',
    '27699f': 'accent-strong',
    '2a70aa': 'accent-strong',
    '2f7ebf': 'accent-strong',
    '287abc': 'accent-strong',
    '4b6eaf': 'accent',
    '4a81d4': 'accent-glow',
    '529dd6': 'accent-glow',
    '5c9fd6': 'accent-glow',
    '82add6': 'accent-glow',
    '6cb3e8': 'accent-glow',
    '94b7dc': 'accent-soft',
    'a8c4e2': 'accent-soft',
    'acbfd2': 'accent-soft',
    'c0d5e0': 'accent-soft',
    'c2ddf2': 'accent-soft',
    'c6d7e5': 'accent-soft',
    'd3e1f1': 'accent-soft',
    'd5e3f1': 'accent-soft',
    'd6e8f6': 'accent-soft',
    'd8e5f2': 'accent-soft',
    'dde8f4': 'accent-soft',
    'cadbe9': 'accent-soft',
    'c1d1dd': 'accent-soft',
    'd1e0e8': 'accent-soft',
    '7ab2e8': 'accent-glow',
    # success
    '78c350': 'success',
    '609c40': 'success-deep',
    '66a644': 'success',
    '5a923c': 'success-deep',
    '549433': 'success-deep',
    '5fa739': 'success-deep',
    '3a5e26': 'success-deep',
    '487530': 'success-deep',
    '8fd166': 'success',
    '9fe8cf': 'success',
    'e4f3dc': 'success',
    'd3e1cd': 'success',
    'd7edcb': 'success',
    'd7e6d1': 'success',
    'e7eaef': 'success',
    # warning (old amber)
    'ff9800': 'warning',
    'cc7a00': 'warning-deep',
    'd98100': 'warning-deep',
    'b36a00': 'warning-deep',
    'bf7200': 'warning-deep',
    '7a4900': 'warning-deep',
    'ffeacc': 'warning',
    'ebd9bf': 'warning',
    'f0ddc2': 'warning',
    'e6d3b8': 'warning',
    'ffe0b3': 'warning',
    'fcf8e3': 'warning',
    'ff8c00': 'warning',
    'ffb74d': 'warning',
    # danger (old red-orange)
    'f7531f': 'danger',
    'c64219': 'danger-deep',
    'd2471a': 'danger-deep',
    'c33407': 'danger-deep',
    'db3b08': 'danger-deep',
    '943213': 'danger-deep',
    '76280f': 'danger-deep',
    'b93e17': 'danger-deep',
    'ad3a16': 'danger-deep',
    'fdddd2': 'danger',
    'e9cdc4': 'danger',
    'eed1c8': 'danger',
    'e4c7bd': 'danger',
    'fdcbbc': 'danger',
    'ff7a4d': 'danger',
    # info (old cyan)
    '45bbe0': 'info',
    '3796b3': 'info-deep',
    '297086': 'info-deep',
    '3b9fbe': 'info',
    '348ca8': 'info-deep',
    '215a6b': 'info-deep',
    '1f95ba': 'info',
    '23a6cf': 'info',
    'daf1f9': 'info',
    'cee4ec': 'info',
    'c7ebf6': 'info',
    'c4d9e0': 'info',
    # pink / purple / indigo (used by charts, tags)
    'f06292': 'pink',
    'c04e75': 'pink',
    'cc537c': 'pink',
    'b44a6e': 'pink',
    'a84566': 'pink',
    '903b58': 'pink',
    'fce0e9': 'pink',
    'fbd0de': 'pink',
    'e3cad2': 'pink',
    '8892d6': 'purple',
    '6d75ab': 'purple',
    '747cb6': 'purple',
    '636a72': 'purple',
    '5f6696': 'purple',
    '666ea1': 'purple',
    '525880': 'purple',
    '626fc9': 'purple',
    '4f5ec2': 'purple',
    'dbdef3': 'purple',
    'e7e9f7': 'purple',
    'd0d2de': 'purple',
    'c6cace': 'purple',
    '675aa9': 'purple',
    '424666': 'purple',
    '683ba9': 'purple',
    '9aa3e0': 'purple',
    '6b74a8': 'purple',
    '747cb6': 'purple',
    # backgrounds
    '303841': 'bg-deep',
    '2e373f': 'bg-deep',
    '282f36': 'bg-deep',
    '28303a': 'bg-deep',
    '22282e': 'bg-deep',
    '20262b': 'bg-deep',
    '2b323a': 'bg-deep',
    '2c353d': 'bg-deep',
    '2b343d': 'bg-deep',
    '2c333b': 'bg-deep',
    '323a46': 'bg-base',
    '333d46': 'bg-base',
    '323b44': 'bg-base',
    '353e48': 'bg-base',
    '333d47': 'bg-base',
    '3a444f': 'bg-base',
    '38424d': 'bg-base',
    '3b4550': 'bg-base',
    '3e4954': 'bg-base',
    '36404a': 'bg-card',
    '37424c': 'bg-card',
    '383f49': 'bg-card',
    '3c4752': 'bg-card',
    '3c4853': 'bg-card',
    '3b4651': 'bg-card',
    '414d59': 'bg-card2',
    '3d4a56': 'bg-card2',
    '46535f': 'bg-card2',
    '4a5866': 'bg-card2',
    '4d5b69': 'bg-card2',
    '526170': 'bg-card2',
    '424e5a': 'line-muted',  # ng.css table row divider (JS-built tables)
    '4a515f': 'bg-card2',
    '4c5761': 'bg-card2',
    '505b66': 'bg-card2',
    '515b65': 'bg-card2',
    '55606b': 'bg-card2',
    '586877': 'bg-card2',
    '5a6673': 'bg-card2',
    '5f6e7c': 'bg-card2',
    '5c636a': 'bg-card2',
    '607184': 'bg-card2',
    '3d4854': 'bg-card2',
    '4b5865': 'bg-card2',
    '526070': 'bg-card2',
    '5d7186': 'line',
    '76838f': 'line-muted',
    '7c858f': 'line-muted',
    '85909c': 'line-muted',
    '87949b': 'line-muted',
    '9097a7': 'line-muted',
    '919eab': 'line-muted',
    '929495': 'line-muted',
    'a2adb7': 'line-muted',
    '757677': 'line-muted',
    # text
    '94a0ad': 'text-body',
    '8c98a5': 'text-dim',
    '98a6ad': 'text-body',
    'a8b5c1': 'text-body',
    'adb8c3': 'text-body',
    'a9b7c6': 'text-body',
    '8b98a5': 'text-dim',
    '9097a7': 'text-dim',
    'cedeef': 'text-bright',
    'd6dde5': 'text-bright',
    'c0cbd4': 'text-bright',
    'c6d7e5': 'text-bright',
    'd1e0e8': 'text-bright',
    'd6e8f6': 'text-bright',
    'e2ecf1': 'text-bright',
    'e6edf4': 'text-bright',
    'f3f7f9': 'text-bright',
    'f7f7f7': 'text-bright',
    'f5f8fc': 'text-bright',
    'f4f8fa': 'text-bright',
    'f5f9fa': 'text-bright',
    'f7f9fb': 'text-bright',
    'fbfdfd': 'text-bright',
    'fdfdfe': 'text-bright',
    'd3e1f1': 'text-bright',
    'd5e3f1': 'text-bright',
    'c2ddf2': 'text-bright',
    'd8e5f2': 'text-bright',
    'dde8f4': 'text-bright',
    'dee2e6': 'text-bright',
    'e2e6ea': 'text-bright',
    'e4e4e5': 'text-bright',
    'c3c6c8': 'text-bright',
    'afb1b3': 'text-dim',
    'c8cddc': 'text-bright',
    'acbfd2': 'text-dim',
    '3c3f41': 'bg-deep',
    '6e768e': 'line-muted',
}

# rgba(52,140,212,x) and friends: accent-tinted translucent overlays.
# map rgb triplet -> token (alpha preserved as-is)
RGBA_MAP = {
    '52,140,212': 'accent',
    '82,157,218': 'accent-glow',
    '82,168,236': 'accent-glow',
    '120,195,80': 'success',
    '140,204,106': 'success',
    '247,83,31': 'danger',
    '248,109,65': 'danger',
    '255,152,0': 'warning',
    '255,167,38': 'warning',
    '69,187,224': 'info',
    '97,197,229': 'info',
    '66,78,90': 'line-muted',
    '54,64,74': 'bg-card',
    '44,50,57': 'bg-card',
    '50,50,50': 'bg-deep',
    '34,40,46': 'bg-deep',
    '56,65,74': 'bg-card',
    '66,72,80': 'bg-card2',
    '240,98,146': 'pink',
    '242,122,162': 'pink',
    '154,162,220': 'purple',
    '136,146,214': 'purple',
    '183,198,214': 'text-bright',
    '215,220,223': 'text-bright',
    '206,222,239': 'text-bright',
    '64,149,216': 'accent-glow',
    '94,105,115': 'line-muted',
    '139,152,165': 'text-dim',
}

def map_rgba(css_text, tokens):
    """Replace mapped rgb triplets inside rgba()/rgb(), keep alpha."""
    def repl(m):
        inner = m.group(1)
        mm = re.match(r'^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?$', inner)
        if not mm:
            return m.group(0)
        triplet = f'{mm.group(1)},{mm.group(2)},{mm.group(3)}'
        if triplet not in RGBA_MAP:
            return m.group(0)
        r, g, b = hex2rgb(tokens[RGBA_MAP[triplet]])
        alpha = mm.group(4) or ''
        return f'rgba({r},{g},{b}{alpha})'
    return re.sub(r'rgba?\(([^()]*)\)', repl, css_text)

def map_hex(css_text, tokens):
    """Replace mapped hex colors with palette tokens."""
    def repl(m):
        h = m.group(0).lower()
        key = h.lstrip('#')
        if key in COLOR_MAP:
            return tokens[COLOR_MAP[key]]
        return m.group(0)
    return re.sub(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b', repl, css_text)

# ------------------------------------------------------------- generator --

def generate_for_file(base_name, tokens):
    """Yield override rules for one baseline css file."""
    css = open(os.path.join(CSS_DIR, base_name), encoding='utf-8').read()
    out = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', css):
        sel, body = m.group(1), m.group(2)
        # skip keyframes/charset/font-face blocks (selectors contain '{' logic)
        if '@' in sel or sel.strip().startswith('['):
            continue
        mapped_hex = map_hex(body, tokens)
        mapped_rgba = map_rgba(mapped_hex, tokens)
        if mapped_rgba != body:
            selectors = [s.strip() for s in sel.split(',') if s.strip()]
            # `body[data-if-palette] <sel>` must never produce a `body ... body`
            # descendant chain (a <body> inside <body> never matches, so e.g.
            # `body[data-sidebar-color=dark] .left-side-menu` would silently
            # lose its override). Merge the anchor INTO a leading body
            # selector instead.
            prefixed = ', '.join(prefix_selector(s) for s in selectors)
            # Only re-emit the declarations the mapping actually changed.
            # Re-declaring untouched layout props (e.g. bootstrap's
            # `.dropdown-menu{display:none}`) later at equal specificity
            # defeats state flips like `.dropdown-menu.show{display:block}`
            # -- the root cause of "dropdown dead under palette".
            slim = changed_decls(body, mapped_rgba)
            if slim:
                out.append(f'{prefixed}{{{slim}}}')
    return out

def changed_decls(orig, mapped):
    """Keep only declarations whose value differs after color mapping."""
    o = [d.strip() for d in orig.split(';')]
    n = [d.strip() for d in mapped.split(';')]
    if len(o) != len(n) or not n:
        return mapped  # unexpected structure; keep the whole body
    kept = [nd for od, nd in zip(o, n) if od != nd]
    return ';'.join(kept)

def prefix_selector(sel):
    """Prefix a selector with the palette anchor, merging into a leading
    `body[...]` part so the result still matches the single <body> element."""
    m = re.match(r'^(body((?:\[[^\]]+\])*)((?:\.[\w-]+)*))(.*)$', sel)
    if m:
        return f'body[data-if-palette]{m.group(2)}{m.group(3)}{m.group(4)}'
    return f'body[data-if-palette] {sel}'

def gen_palette(name, tokens, all_base_rules):
    """Build the full override stylesheet for one palette."""
    rules = []

    # --- section 1: variable overrides -------------------------------
    varlist = []
    for var, val in VAR_OVERRIDE.items():
        varlist.append(f'--{var}:{tokens[val]}')
    for var, val in VAR_RGB_OVERRIDE.items():
        r, g, b = hex2rgb(tokens[val])
        varlist.append(f'--{var}:{r},{g},{b}')
    rules.append(f'body[data-if-palette]{{{";".join(varlist)}}}')

    # --- section 2: hardcoded overrides -------------------------------
    rules.extend(all_base_rules)

    # --- section 3: fixups --------------------------------------------
    rules.extend(format_fixups(name, tokens))

    # --- section 4: semantic state system ----------------------------
    rules.extend(format_state_fixups(tokens))

    header = (
        f'/* palette:{name} - AUTO-GENERATED by scripts/gen-palettes.py.\n'
        f' * Do not edit by hand; edit scripts/palettes/{name}.yaml and rerun.\n'
        f' * Applied by header.ut via <body data-if-palette="{name}">. */\n'
    )
    return header + ''.join(rules)

# --bs-* variables defined by bootstrap-dark.min.css :root, with the token
# each maps to. rgb triplets are derived automatically.
VAR_OVERRIDE = {
    'bs-blue': 'accent',
    'bs-indigo': 'purple',
    'bs-purple': 'purple',
    'bs-pink': 'pink',
    'bs-red': 'danger',
    'bs-orange': 'warning',
    'bs-yellow': 'warning',
    'bs-green': 'success',
    'bs-teal': 'info',
    'bs-cyan': 'info',
    'bs-gray': 'text-body',
    'bs-gray-dark': 'text-bright',
    'bs-gray-100': 'bg-base',
    'bs-gray-200': 'bg-card',
    'bs-gray-300': 'bg-card2',
    'bs-gray-400': 'line',
    'bs-gray-500': 'line-muted',
    'bs-gray-600': 'text-body',
    'bs-gray-700': 'text-bright',
    'bs-gray-800': 'text-bright',
    'bs-gray-900': 'text-bright',
    'bs-primary': 'accent',
    'bs-secondary': 'text-body',
    'bs-success': 'success',
    'bs-info': 'info',
    'bs-warning': 'warning',
    'bs-danger': 'danger',
    'bs-light': 'bg-card2',
    'bs-dark': 'text-bright',
    'bs-body-color': 'text-body',
    'bs-body-bg': 'bg-deep',
}

VAR_RGB_OVERRIDE = {
    'bs-primary-rgb': 'accent',
    'bs-secondary-rgb': 'text-body',
    'bs-success-rgb': 'success',
    'bs-info-rgb': 'info',
    'bs-warning-rgb': 'warning',
    'bs-danger-rgb': 'danger',
    'bs-light-rgb': 'bg-card2',
    'bs-dark-rgb': 'text-bright',
    'bs-pink-rgb': 'pink',
    'bs-purple-rgb': 'purple',
    'bs-body-color-rgb': 'text-body',
    'bs-body-bg-rgb': 'bg-deep',
}

def format_state_fixups(tokens):
    """Semantic state system: anchor every state color to the palette family.

    The base theme paints state components three inconsistent ways:
    pastel fills with dark pastel text (bootstrap light-era rules),
    bright fills with light text (remapped sheet rules, e.g. #d9d5dd on
    amber = 1.2:1) and violet neutrals (ng.css action buttons). Unify
    everything under two rails:

    RAIL A - soft surfaces (table highlight rows, alerts, list-group
    items): a 14% state tint painted by --bs-table-bg / background-color
    directly (cells composite it over the card), body text on top.
    Semantic weight comes from the tint plus a 38% state border, never
    from low-contrast text.

    RAIL B - solid fills (buttons, badges, pagination): dark on-accent
    text on the bright state fills (>= 4.5:1). Hover lightens toward
    text-bright via color-mix, active darkens toward text-onaccent,
    with the plain fill as pre-fallback line.

    Neutral actions (btn-secondary / cbi-button-neutral / btn-purple)
    become the raised gray surface (bg-card2) with bright text - the
    violet family never belonged to this palette.
    """
    ON = tokens['text-onaccent']
    BR = tokens['text-bright']
    BODY = tokens['text-body']
    C2 = tokens['bg-card2']
    ACC = tokens['accent']
    LB = tokens['line-bright']
    fix = []

    def rgba(tok, alpha):
        r, g, b = hex2rgb(tokens[tok])
        return f'rgba({r},{g},{b},{alpha})'

    states = {
        'success': 'success',
        'warning': 'warning',
        'danger': 'danger',
        'info': 'info',
        'primary': 'accent',
    }

    # ---- RAIL A: soft state surfaces ----
    for st, tok in states.items():
        color = tokens[tok]
        soft = rgba(tok, .14)
        hover = rgba(tok, .22)
        active = rgba(tok, .24)
        edge = rgba(tok, .38)
        # table state rows: cells paint --bs-table-bg, so the tint itself
        # must live there (not transparent) to composite over the card
        fix.append(
            f'body[data-if-palette] .table-{st}{{'
            f'--bs-table-bg:{soft};'
            f'--bs-table-striped-bg:{soft};'
            f'--bs-table-active-bg:{active};'
            f'--bs-table-hover-bg:{hover};'
            f'--bs-table-color:{BODY};'
            f'--bs-table-hover-color:{BODY};'
            f'--bs-table-active-color:{BODY};'
            f'color:{BODY};'
            f'border-color:{edge}}}')
        # alerts share the soft rail
        fix.append(
            f'body[data-if-palette] .alert-{st}{{'
            f'color:{BODY};background-color:{soft};border-color:{edge}}}')
        fix.append(
            f'body[data-if-palette] .alert-{st} .alert-link{{color:{color}}}')
        # list-group state items
        fix.append(
            f'body[data-if-palette] .list-group-item-{st}{{'
            f'color:{BODY};background-color:{soft};border-color:{edge}}}')
        fix.append(
            f'body[data-if-palette] .list-group-item-{st}.list-group-item-action:hover,'
            f'body[data-if-palette] .list-group-item-{st}.list-group-item-action:focus'
            f'{{background-color:{hover}}}')

    # base table zebra/hover lift: a few % of bright over the surface
    # instead of matching the card color exactly (invisible stripes)
    brR, brG, brB = hex2rgb(BR)
    fix.append(
        f'body[data-if-palette] .table{{'
        f'--bs-table-striped-bg:rgba({brR},{brG},{brB},.035);'
        f'--bs-table-hover-bg:rgba({brR},{brG},{brB},.07);'
        f'--bs-table-active-bg:rgba({brR},{brG},{brB},.10)}}')

    # ---- RAIL B: solid state fills ----
    for st, tok in states.items():
        color = tokens[tok]
        base_sel = (
            f'body[data-if-palette] .btn-{st},'
            f'body[data-if-palette] .btn-check:checked+.btn-{st},'
            f'body[data-if-palette] .btn-{st}.active,'
            f'body[data-if-palette] .show>.btn-{st}.dropdown-toggle,'
            f'body[data-if-palette] .table > tr > td > .btn-{st}')
        fix.append(f'{base_sel}{{color:{ON};background-color:{color};border-color:{color}}}')
        # hover: lighten toward text-bright (keeps dark text >= 4.5:1)
        hsel = f'body[data-if-palette] .btn-{st}:hover'
        fix.append(f'{hsel}{{background-color:{color}}}')
        fix.append(f'{hsel}{{background-color:color-mix(in srgb,{color} 86%,{BR})}}')
        # active/checked: darken slightly toward text-onaccent
        asel = (
            f'body[data-if-palette] .btn-{st}:active,'
            f'body[data-if-palette] .btn-{st}.active,'
            f'body[data-if-palette] .btn-check:checked+.btn-{st}')
        fix.append(f'{asel}{{background-color:{color}}}')
        fix.append(f'{asel}{{background-color:color-mix(in srgb,{color} 94%,{ON})}}')
        # focus ring in the state color
        fix.append(
            f'body[data-if-palette] .btn-{st}:focus,'
            f'body[data-if-palette] .btn-check:focus+.btn-{st}'
            f'{{box-shadow:0 0 0 .15rem {rgba(tok,.5)}}}')
        # disabled: same fill, dimmed
        fix.append(
            f'body[data-if-palette] .btn-{st}.disabled,'
            f'body[data-if-palette] .btn-{st}:disabled'
            f'{{color:{ON};background-color:{color};border-color:{color};opacity:.55}}')
        # outline variants flip solid on hover/active: dark text there too
        osel = (
            f'body[data-if-palette] .btn-outline-{st}:hover,'
            f'body[data-if-palette] .btn-outline-{st}.active,'
            f'body[data-if-palette] .btn-check:checked+.btn-outline-{st},'
            f'body[data-if-palette] .show>.btn-outline-{st}.dropdown-toggle')
        fix.append(f'{osel}{{color:{ON}}}')
        # badges / text-bg utilities ride the same bright fill
        fix.append(f'body[data-if-palette] .badge.bg-{st}{{color:{ON}}}')
        fix.append(f'body[data-if-palette] .text-bg-{st}{{color:{ON}}}')

    # ---- neutral actions: raised gray, not violet ----
    # visible outline: the fill sits only 1.2:1 above the card, so the
    # border carries the button affordance (rest: lifted line; hover:
    # accent-soft flip, mirroring the base theme's border feedback)
    nsel = (
        f'body[data-if-palette] .btn-secondary,'
        f'body[data-if-palette] .cbi-button-neutral,'
        f'body[data-if-palette] .btn-purple,'
        f'body[data-if-palette] .table > tr > td > .btn-secondary,'
        f'body[data-if-palette] .table > tr > td > .btn-purple')
    fix.append(f'{nsel}{{color:{BR};background-color:{C2};border-color:{LB}}}')
    nhover = (
        f'body[data-if-palette] .btn-secondary:hover,'
        f'body[data-if-palette] .btn-secondary:focus,'
        f'body[data-if-palette] .btn-secondary:active,'
        f'body[data-if-palette] .btn-secondary.active,'
        f'body[data-if-palette] .show>.btn-secondary.dropdown-toggle,'
        f'body[data-if-palette] .cbi-button-neutral:hover,'
        f'body[data-if-palette] .cbi-button-neutral:focus,'
        f'body[data-if-palette] .btn-purple:hover,'
        f'body[data-if-palette] .btn-purple:focus')
    fix.append(f'{nhover}{{background-color:{C2};border-color:{LB}}}')
    fix.append(f'{nhover}{{background-color:color-mix(in srgb,{C2} 85%,{BR})}}')
    fix.append(f"{nhover}{{border-color:{tokens['accent-soft']}}}")
    nactive = (
        f'body[data-if-palette] .btn-secondary:active,'
        f'body[data-if-palette] .btn-purple:active')
    fix.append(f'{nactive}{{border-color:{tokens["accent"]}}}')
    fix.append(
        f'body[data-if-palette] .btn-secondary:focus,'
        f'body[data-if-palette] .btn-check:focus+.btn-secondary,'
        f'body[data-if-palette] .btn-purple:focus'
        f'{{box-shadow:0 0 0 .15rem {rgba("line",.5)}}}')
    fix.append(
        f'body[data-if-palette] .btn-secondary:disabled,'
        f'body[data-if-palette] .btn-secondary.disabled,'
        f'body[data-if-palette] .cbi-button-neutral:disabled,'
        f'body[data-if-palette] .btn-purple:disabled'
        f'{{color:{BR};background-color:{C2};border-color:{C2};opacity:.55}}')

    # password reveal toggle (ng.css styles it by ID, which beats any
    # class-scoped fixup; restyle it as the raised-gray neutral)
    fix.append(
        f'body[data-if-palette] #view button.ng-password-toggle{{'
        f'color:{tokens["text-dim"]};background:{C2};border-color:{LB}}}')
    fix.append(
        f'body[data-if-palette] #view button.ng-password-toggle:hover{{'
        f'color:{BR};background:{C2};border-color:{tokens["accent-soft"]}}}')
    fix.append(
        f'body[data-if-palette] #view button.ng-password-toggle:active{{'
        f'color:{BR};background:{C2}}}')
    fix.append(
        f'body[data-if-palette] #view button.ng-password-toggle:focus-visible{{'
        f'box-shadow:0 0 0 .18rem {rgba("line",.28)}}}')

    # log nav buttons (ng.css violet/blue pair) join the family
    fix.append(f'body[data-if-palette] #scrollDownButton{{color:{ON};background-color:{ACC}}}')
    fix.append(
        f'body[data-if-palette] #scrollDownButton:hover,'
        f'body[data-if-palette] #scrollDownButton:focus'
        f'{{color:{ON};background-color:{ACC}}}')
    fix.append(f'body[data-if-palette] #scrollUpButton{{color:{BR};background-color:{C2}}}')
    fix.append(
        f'body[data-if-palette] #scrollUpButton:hover,'
        f'body[data-if-palette] #scrollUpButton:focus'
        f'{{color:{BR};background-color:{C2}}}')

    # pagination active page rides the accent with dark text
    fix.append(
        f'body[data-if-palette] .page-item.active .page-link'
        f'{{color:{ON};background-color:{ACC};border-color:{ACC}}}')

    return fix

def format_fixups(name, tokens):
    """Palette-aware rules that a pure color swap cannot express."""
    fix = []
    A, S = tokens['accent'], tokens['accent-soft']
    # input placeholders: the baseline paints them #586877, which the color
    # census maps to bg-card2 (a SURFACE color - 1.2:1 on the input fill,
    # effectively invisible). Placeholders are hint TEXT: use the dim line
    # gray instead (~2:1, matching the default theme's 1.8:1 subtlety).
    fix.append(
        f'body[data-if-palette] .form-control::placeholder'
        f'{{color:{tokens["line-muted"]};opacity:1}}')
    fix.append(
        f'body[data-if-palette] .select2-container input::placeholder,'
        f'body[data-if-palette] .selectize-input>input::placeholder'
        f'{{color:{tokens["line-muted"]}}}')
    # overview drawer separators: ngOverview.css draws them with
    # --ngov-line: var(--bs-gray-300, ...), and the census maps that var to
    # bg-card2 (a SURFACE) - so the divider lands ~1.2:1 on the card it
    # separates, invisible in every palette. Lines are the line family's
    # job: re-point the var at the real line token (~3:1+ on cards).
    fix.append(
        f'body[data-if-palette] .ngov{{--ngov-line:{tokens["line"]}!important}}')
    # login page rainbow strip -> gold gradient in this palette family
    fix.append(
        f'body[data-if-palette]:not(.logged-out) .Line:after'
        f'{{background:linear-gradient(70deg,{S},{A},{S})!important}}')
    # loading cover + spinner tint
    fix.append(
        f'body[data-if-palette] .loadingCover{{background:{tokens["loading-cover"]}!important}}')
    fix.append(
        f'body[data-if-palette] .loadingCover>div{{color:{S}!important}}')
    # page background photo follows the palette (ng.css pins body to
    # ../images/backgrounds/12.jpg for every theme; override per palette)
    fix.append(
        f'body[data-if-palette]{{background-image:'
        f'url(../images/backgrounds/{tokens["bg-image"]})!important}}')
    # page-title texts sit directly on the photo; bright highlights
    # behind the right-hand breadcrumb can crush light text to ~1:1.
    # Give each title group a frosted scrim chip and recolor the
    # breadcrumb into the palette accent family.
    bgR, bgG, bgB = hex2rgb(tokens['bg-deep'])
    sbR, sbG, sbB = hex2rgb(tokens['accent-soft'])
    fix.append(
        f'body[data-if-palette] .page-title-box>div{{'
        f'background:rgba({bgR},{bgG},{bgB},.78);'
        f'border:1px solid rgba({sbR},{sbG},{sbB},.16);'
        f'border-radius:.5rem;padding:.3rem .75rem}}')
    fix.append(
        f'body[data-if-palette] .breadcrumb{{background:transparent;margin:0}}')
    fix.append(
        f'body[data-if-palette] .breadcrumb-item a{{color:{S}}}')
    fix.append(
        f'body[data-if-palette] .breadcrumb-item+.breadcrumb-item::before'
        f'{{color:{tokens["text-dim"]}}}')
    fix.append(
        f'body[data-if-palette] .breadcrumb-item.active{{'
        f'color:{tokens["text-body"]}}}')
    # ---- light palettes (is_light: true): the chrome flip -----------------
    # A light palette flips surfaces to the board's light family; the
    # workhorse token map handles cards/inputs/tables automatically, but
    # the chrome needs explicit rules a color swap cannot express:
    #   (a) sidebar + logo box keep a DEEP navy wall (this family's night
    #       blood) so light chrome still reads as one theme with its dark
    #       sibling - the navy is a light-palette constant, not a token;
    #   (b) app-dark paints sidebar/topbar text via body[data-sidebar-color
    #       =dark] ... selectors that the census maps to LIGHT text tokens
    #       (would sit dark-on-navy): re-anchor the wall text to the ice
    #       family with matching specificity + !important;
    #   (c) white-text / white-alpha rules that inherit a (now light)
    #       topbar must be rescued to the navy text family;
    #   (d) breadcrumbs sit on the photo: anchor hops to the dark family
    #       (the generic fixup paints the first hop accent-soft, a light
    #       sky tint, unreadable on the light scrim chip);
    #   (e) dawn veil: frost the nebula photo toward the ice family so
    #       the light chrome reads 'morning over the nebula'.
    # This whole block ships LAST in the fixup list so these rules also
    # override earlier generic fixups that paint chrome surfaces.
    if tokens.get('is_light') == 'true':
        NAVY = '#101d40'      # sidebar/topbar wall (luminousblue bg-card)
        NAVY2 = '#18294f'     # wall raised surface (hover/active chips)
        ICE = '#edf1fe'       # wall text family
        DIM = '#acbec3'       # wall dim text (luminousblue text-body)
        nR, nG, nB = 0x10, 0x1d, 0x40
        # (a) the wall: sidebar, logo box, user dropdown
        fix.append(
            f'body[data-if-palette] .left-side-menu{{background-color:{NAVY}!important}}')
        fix.append(
            f'body[data-if-palette] .logo-box{{background-color:{NAVY}!important}}')
        fix.append(
            f'body[data-if-palette] .user-pro-dropdown{{background-color:{NAVY2}!important}}')
        # (b) sidebar link family, same specificity as app-dark's
        #     body[data-sidebar-color=dark] chains + !important to win
        SBL = 'body[data-if-palette] .left-side-menu #sidebar-menu>ul>li>a'
        fix.append(f'{SBL}{{color:{DIM}!important}}')
        fix.append(
            f'{SBL}:active,'
            f'body[data-if-palette] .left-side-menu #sidebar-menu>ul>li>a:focus,'
            f'{SBL}:hover{{color:{ICE}!important}}')
        fix.append(
            f'body[data-if-palette] .left-side-menu #sidebar-menu .menu-title'
            f'{{color:{DIM}!important}}')
        fix.append(
            f'body[data-if-palette] .left-side-menu .nav-second-level li a,'
            f'body[data-if-palette] .left-side-menu .nav-thrid-level li a'
            f'{{color:{DIM}!important}}')
        fix.append(
            f'body[data-if-palette] .left-side-menu .nav-second-level li a:focus,'
            f'body[data-if-palette] .left-side-menu .nav-second-level li a:hover,'
            f'body[data-if-palette] .left-side-menu .nav-thrid-level li a:focus,'
            f'body[data-if-palette] .left-side-menu .nav-thrid-level li a:hover'
            f'{{color:{ICE}!important}}')
        fix.append(
            f'{SBL}.mm-active,'
            f'body[data-if-palette] .left-side-menu #sidebar-menu .menuitem-active>a,'
            f'body[data-if-palette] .left-side-menu #sidebar-menu .menuitem-active .active,'
            f'body[data-if-palette] .left-side-menu .nav-second-level li.active>a,'
            f'body[data-if-palette] .left-side-menu .nav-thrid-level li.active>a,'
            f'body[data-if-palette] .left-side-menu .user-box .dropdown>a'
            f'{{color:{ICE}!important}}')
        # active chip: raised navy + a royal left edge (the wall's own
        # lightness step alone reads too weak; the accent edge anchors it)
        asR, asG, asB = hex2rgb(tokens['accent'])
        fix.append(
            f'{SBL}.mm-active,'
            f'body[data-if-palette] .left-side-menu #sidebar-menu .menuitem-active>a'
            f'{{background-color:{NAVY2}!important;'
            f'box-shadow:inset 3px 0 0 rgb({asR},{asG},{asB})}}')
        # condensed-mode hover chips (app-dark paints them #323a46 family)
        fix.append(
            f'body[data-if-palette] body[data-sidebar-size=condensed] #sidebar-menu>ul>li:hover>a,'
            f'body[data-if-palette] .left-side-menu #sidebar-menu>ul>li:hover>a{{'
            f'background-color:rgba({nR},{nG},{nB},.9)}}')
        # (c) topbar (now light ice) text family: app-dark paints its
        # links and the hamburger with white / white-alpha - unreadable
        # on ice. Anchor them to the navy text family, hover to royal.
        fix.append(
            f'body[data-if-palette] .navbar-custom{{'
            f'background-color:{tokens["bg-card"]}!important;'
            f'box-shadow:0 1px 0 rgba({nR},{nG},{nB},.08),'
            f'0 .75rem 6rem rgba({nR},{nG},{nB},.05)}}')
        fix.append(
            f'body[data-if-palette] .navbar-custom .nav-link,'
            f'body[data-if-palette] .navbar-custom .button-menu-mobile,'
            f'body[data-if-palette] .navbar-custom .pro-user-name'
            f'{{color:{tokens["text-body"]}}}')
        fix.append(
            f'body[data-if-palette] .navbar-custom .nav-link:focus,'
            f'body[data-if-palette] .navbar-custom .nav-link:hover,'
            f'body[data-if-palette] .navbar-custom .button-menu-mobile:hover'
            f'{{color:{tokens["accent"]}}}')
        fix.append(
            f'body[data-if-palette] .navbar-custom .dropdown .nav-link.show{{'
            f'background-color:rgba({nR},{nG},{nB},.06)}}')
        # (d) breadcrumb hops on the photo -> dark family
        fix.append(
            f'body[data-if-palette] .breadcrumb-item>a{{color:{tokens["accent"]}}}')
        fix.append(
            f'body[data-if-palette] .breadcrumb-item+.breadcrumb-item::before'
            f'{{color:{tokens["text-dim"]}}}')
        # (e) dawn veil over the nebula photo
        vR, vG, vB = hex2rgb(tokens['bg-card'])
        fix.append(
            f'body[data-if-palette]{{background-image:'
            f'linear-gradient(rgba({vR},{vG},{vB},.34),rgba({vR},{vG},{vB},.34)),'
            f'url(../images/backgrounds/{tokens["bg-image"]})!important}}')
        # global link family rides the dark-on-ice rail
        fix.append(
            f'body[data-if-palette] a{{color:{tokens["accent"]}}}')
        fix.append(
            f'body[data-if-palette] a:hover{{color:{tokens["accent-strong"]}}}')

    # meta theme-color for mobile chrome is set in the template via JS
    return fix

def main():
    check_only = '--check' in sys.argv
    palette_files = sorted(glob.glob(os.path.join(HERE, 'palettes', '*.yaml')))
    default_tokens = parse_tokens(os.path.join(HERE, 'palettes', 'default.yaml'))

    # preload baseline rules once (they are palette-independent in form;
    # the color substitution happens per palette below)
    generated = {}
    for pf in palette_files:
        name = os.path.basename(pf).rsplit('.', 1)[0]
        if name == 'default':
            continue
        tokens = parse_tokens(pf)
        # every token must be a valid hex or filename
        for k, v in tokens.items():
            if k in ('name', 'label', 'bg-image', 'meta-theme-color', 'is_light'):
                continue
            if not re.match(r'^#[0-9a-fA-F]{6}$', v):
                sys.exit(f'{pf}: token {k}={v} is not a 6-digit hex')

        all_rules = []
        for base in BASE_FILES:
            all_rules.extend(generate_for_file(base, tokens))
        generated[name] = gen_palette(name, tokens, all_rules)

    if check_only:
        ok = True
        for name, content in generated.items():
            path = os.path.join(CSS_DIR, f'palette-{name}.min.css')
            if not os.path.exists(path):
                print(f'MISSING {path}')
                ok = False
            elif open(path, encoding='utf-8').read() != content:
                print(f'STALE {path}')
                ok = False
        sys.exit(0 if ok else 1)

    for name, content in generated.items():
        path = os.path.join(CSS_DIR, f'palette-{name}.min.css')
        open(path, 'w', encoding='utf-8', newline='\n').write(content)
        print(f'wrote {path} ({len(content)} bytes, '
              f'{content.count("body[data-if-palette]")} override anchors)')

if __name__ == '__main__':
    main()
