"""Brand assets must follow their actual surface, not layout mode names."""
from pathlib import Path
import re
import struct
import unittest

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / 'ucode/template/themes/infinityfreedom-ng'
CSS = ROOT / 'htdocs/luci-static/infinityfreedom-ng/assets/css/ng.css'

class BrandSurfaceTests(unittest.TestCase):
    def test_four_original_rgba_png_assets_are_packaged(self):
        images = ROOT / 'htdocs/luci-static/infinityfreedom-ng/assets/images'
        for kind, size in (('lockup-since2020', (960, 240)), ('symbol', (120, 120))):
            for surface in ('dark', 'light'):
                asset = images / f'homelede-{kind}-on-{surface}.png'
                with self.subTest(asset=asset.name):
                    data = asset.read_bytes()
                    self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
                    self.assertEqual(data[12:16], b'IHDR')
                    self.assertEqual(struct.unpack('>II', data[16:24]), size)
                    self.assertEqual(data[25], 6, 'Original RGBA transparency must be retained')

    def test_light_asset_switch_is_limited_to_light_content_surfaces(self):
        css = re.sub(r'/\*.*?\*/', '', CSS.read_text(encoding='utf-8'), flags=re.S)
        rules = dict((selector.strip(), body.strip())
                     for selectors, body in re.findall(r'([^{}]+)\{([^{}]*)\}', css)
                     for selector in selectors.split(','))
        self.assertIn('display:none!important', rules['.ng-brand-on-light'])
        for scope in ('.auth-logo', '.toast-header'):
            prefix = 'body[data-if-palette="luminousblue-light"] ' + scope
            self.assertIn('display:none!important', rules[prefix + ' .ng-brand-on-dark'])
            self.assertIn('display:inline-block!important', rules[prefix + ' .ng-brand-on-light'])
        for selector in rules:
            if 'ng-brand-on-' in selector and 'luminousblue-light' in selector:
                self.assertTrue('.auth-logo' in selector or '.toast-header' in selector)
                self.assertNotIn('.logo-box', selector)
        header = (TEMPLATES / 'header.ut').read_text(encoding='utf-8')
        shell = header.split('<div class="logo-box">', 1)[1].split('<ul ', 1)[0]
        sources = re.findall(r'<img[^>]+src="([^"]+)"', shell)
        self.assertEqual(len(sources), 4)
        self.assertTrue(all('on-dark.png' in source for source in sources))
        self.assertNotIn('on-light.png', shell)

    def test_login_suppresses_only_native_edge_reveal(self):
        css = CSS.read_text(encoding='utf-8')
        self.assertRegex(css, r'#password::-ms-reveal\s*\{\s*display:\s*none')
        login = (TEMPLATES / 'sysauth.ut').read_text(encoding='utf-8')
        self.assertEqual(login.count('id="login-password-toggle"'), 1)
        self.assertNotIn('autocomplete="off"', login)

    def test_new_lockup_and_symbol_replace_legacy_assets(self):
        header = (TEMPLATES / 'header.ut').read_text(encoding='utf-8')
        login = (TEMPLATES / 'sysauth.ut').read_text(encoding='utf-8')
        self.assertNotIn('Homelede2023-logo', header + login)
        self.assertIn('homelede-symbol-on-dark.png', header)
        for surface in ('dark', 'light'):
            self.assertIn('homelede-lockup-since2020-on-' + surface + '.png', login)
        self.assertIn('ng-brand-on-light', CSS.read_text(encoding='utf-8'))
        versions = []
        for name in ('header.ut', 'header_login.ut'):
            match = re.search(r'ng\.css\?v=(\d+)', (TEMPLATES / name).read_text(encoding='utf-8'))
            self.assertIsNotNone(match, name)
            versions.append(match.group(1))
        self.assertEqual(versions[0], versions[1])

if __name__ == '__main__':
    unittest.main()
