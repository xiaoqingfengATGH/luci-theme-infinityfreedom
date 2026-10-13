"""GNU make recipe/path smoke tests; NOT an OpenWrt SDK/IPK build."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

PACKAGE = Path(__file__).resolve().parents[1]
SUFFIX = 'htdocs/luci-static/resources/view/homestatus/overview.css'

class PreparePaths(unittest.TestCase):
    def run_prepare(self, override=False, missing=False):
        with tempfile.TemporaryDirectory(prefix='homestatus-prepare-') as directory:
            root = Path(directory)
            package = root / PACKAGE.name
            for relative in ['Makefile', 'htdocs/luci-static/infinityfreedom-ng/assets/css/palette-blackgold.min.css',
                    'ucode/template/themes/infinityfreedom-ng/footer.ut', 'root/etc/config/infinityfreedom-ng']:
                target = package / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(PACKAGE / relative, target)
            fixtures = PACKAGE / 'tests/fixtures/openwrt-24.10'
            (root / 'feeds/luci').mkdir(parents=True)
            (root / 'include').mkdir()
            (root / 'rules.mk').write_text('')
            (root / 'include/package.mk').write_text('')
            (root / 'feeds/luci/luci.mk').write_bytes((fixtures / 'luci.mk').read_bytes())
            source = root / 'separate-source/luci-app-homestatus'
            css = source / SUFFIX
            css.parent.mkdir(parents=True)
            css.write_text('/* fixture */')
            if not missing and not override:
                links = root / 'package/feeds/not-a-guessed-feed'
                links.mkdir(parents=True)
                (links / 'luci-app-homestatus').symlink_to(source, target_is_directory=True)
            fake = root / 'python-fixture.sh'
            palette = 'htdocs/luci-static/infinityfreedom-ng/assets/css/palette-blackgold.min.css'
            fake.write_text('#!/bin/sh\nprintf "%s" "$HOMESTATUS_OVERVIEW_CSS" > "' + str(root / 'resolved') + '"\n' +
                '[ "$2" != "--check" ] || exit 1\n' +
                'printf "/* generated before LuCI copy */" > "' + palette + '"\n')
            fake.chmod(0o755)
            upstream = (fixtures / 'package.mk').read_text()
            start = upstream.index('\t$(foreach hook,$(Hooks/Prepare/Pre)')
            ordering = upstream[start:upstream.index('\ttouch $$@\n', start)]
            harness = root / 'fixture.mk'
            harness.write_text(f'include {package / "Makefile"}\ndefine Run\nprepare:\n' + ordering + 'endef\n$(eval $(Run))\n')
            args = ['make', '-f', str(harness), f'TOPDIR={root}', f'INCLUDE_DIR={root}/include',
                f'BUILD_DIR={root}/build', 'DUMP=1', 'CP=cp -fpR', f'PYTHON={fake}', 'prepare']
            if override:
                args.append(f'HOMESTATUS_OVERVIEW_CSS={css}')
            result = subprocess.run(args, cwd=package, text=True, capture_output=True)
            if missing:
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Set HOMESTATUS_OVERVIEW_CSS', result.stdout + result.stderr)
            else:
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertTrue((root / 'resolved').is_file(), 'palette generator was bypassed by LuCI Prepare')
                self.assertEqual(Path((root / 'resolved').read_text()).resolve(), css.resolve())
                built = root / 'build' / PACKAGE.name
                self.assertEqual((built / palette).read_text(), '/* generated before LuCI copy */')
                self.assertTrue((built / 'ucode/template/themes/infinityfreedom-ng/footer.ut').is_file())
                self.assertTrue((built / 'root/etc/config/infinityfreedom-ng').is_file())
                self.assertFalse((built / 'scripts').exists())

    def test_arbitrary_feed_symlink(self):
        self.run_prepare()

    def test_explicit_override_without_feed_link(self):
        # Override must work even when feed autodiscovery is unavailable.
        self.run_prepare(override=True, missing=False)

    def test_missing_feed_is_actionable(self):
        self.run_prepare(missing=True)

if __name__ == '__main__':
    unittest.main()
