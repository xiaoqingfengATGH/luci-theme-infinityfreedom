"""The default slate palette must use the same generated pipeline as skins."""
from pathlib import Path
import importlib.util
import unittest
R=Path(__file__).resolve().parents[1]
T=R/'ucode/template/themes/infinityfreedom-ng'
class DefaultPaletteTests(unittest.TestCase):
    def test_default_has_generated_stylesheet_and_explicit_scope(self):
        for name in ('header.ut','header_login.ut'):
            text=(T/name).read_text(encoding='utf-8')
            self.assertNotIn("if (ng_palette != 'default')",text)
            self.assertIn('data-if-palette="{{ ng_palette }}"',text)
        js=(R/'htdocs/luci-static/infinityfreedom-ng/assets/js/ng-palette.js').read_text(encoding='utf-8')
        self.assertNotIn("removeAttribute('data-if-palette')",js)
        self.assertNotIn('link.remove()',js)
        self.assertTrue((R/'htdocs/luci-static/infinityfreedom-ng/assets/css/palette-default.min.css').exists())
    def test_default_backdrop_has_a_quiet_slate_scrim(self):
        css=(R/'htdocs/luci-static/infinityfreedom-ng/assets/css/palette-default.min.css').read_text(encoding='utf-8')
        self.assertIn('linear-gradient(rgba(28,38,48,.78),rgba(28,38,48,.78))',css)

    def test_soft_and_selected_components_pair_fill_with_ink(self):
        css=(R/'htdocs/luci-static/infinityfreedom-ng/assets/css/palette-default.min.css').read_text(encoding='utf-8')
        import re
        for selector in ('.btn-soft-primary:hover','.btn-soft-success:hover','.btn-soft-info:hover',
                         '.btn-soft-warning:hover','.btn-soft-danger:hover','.btn-soft-pink:hover',
                         '.btn-soft-purple:hover','.nav-pills>li>a.active',
                         '.nav-pills .nav-link.active','.list-group-item.active'):
            matches=[body for selectors,body in re.findall(r'([^{}]+)\{([^{}]*)\}',css)
                     if 'body[data-if-palette="default"] '+selector in selectors.split(',')]
            self.assertTrue(any('color:#152331;' in body and 'background-color:' in body for body in matches),selector)

    def test_browser_chrome_uses_server_palette_metadata(self):
        text=(T/'header.ut').read_text(encoding='utf-8')
        self.assertIn('data-theme-color="{{ pdef.meta }}"',text)
        js=(R/'htdocs/luci-static/infinityfreedom-ng/assets/js/ng-palette.js').read_text(encoding='utf-8')
        self.assertIn("getAttribute('data-theme-color')",js)
        self.assertNotIn('getComputedStyle(document.body).backgroundColor',js)

    def test_default_roles_have_readable_pairings(self):
        spec=importlib.util.spec_from_file_location('palettes',R/'scripts/gen-palettes.py')
        module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        t=module.parse_tokens(R/'scripts/palettes/default.yaml')
        def lum(h):
            return sum(w*(c/255/12.92 if c/255<=.04045 else ((c/255+.055)/1.055)**2.4) for w,c in zip((.2126,.7152,.0722),bytes.fromhex(h.lstrip('#'))))
        def contrast(a,b):return (max(lum(a),lum(b))+.05)/(min(lum(a),lum(b))+.05)
        for bg in ('bg-card','bg-card2','bg-deep'):
            for fg in ('text-body','text-dim','text-bright','accent'):
                with self.subTest(fg=fg,bg=bg):self.assertGreaterEqual(contrast(t[fg],t[bg]),4.5)
        for fill in ('accent','accent-strong','success','success-deep','warning','warning-deep','danger','danger-deep','info','info-deep'):
            with self.subTest(fill=fill):self.assertGreaterEqual(contrast(t['text-onaccent'],t[fill]),4.5)
if __name__=='__main__':unittest.main()
