"""Real upstream macros with buildroot scaffolding; NOT an SDK/IPK build."""
from pathlib import Path
import subprocess
import tempfile
import unittest

PACKAGE = Path(__file__).resolve().parents[1]
FIXTURES = PACKAGE / 'tests/fixtures/openwrt-24.10'

class DependencyControl(unittest.TestCase):
    def test_control_requires_migrated_application_release(self):
        with tempfile.TemporaryDirectory(prefix='homestatus-control-') as directory:
            root = Path(directory)
            (root / 'feeds/luci').mkdir(parents=True)
            (root / 'include').mkdir()
            (root / 'rules.mk').write_text('')
            (root / 'include/package.mk').write_text('')
            (root / 'feeds/luci/luci.mk').write_bytes((FIXTURES / 'luci.mk').read_bytes())
            source = (FIXTURES / 'package-pack.mk').read_text()
            helpers = source[source.index('_addsep='):source.index('ifeq ($(DUMP),)')]
            control = source[source.index('    Package/$(1)/DEPENDS :='):source.index('    $$(PACK_$(1)) : export CONTROL=')]
            harness = root / 'fixture.mk'
            harness.write_text('empty:=\nspace:=$(empty) $(empty)\ncomma:=,\n' + helpers +
                f'include {PACKAGE / "Makefile"}\n$(eval $(Package/$(PKG_NAME)))\n' +
                'IDEPEND_$(PKG_NAME):=luci-base luci-app-homestatus\n' +
                'define EmitControl\n' + control + 'endef\n' +
                '$(eval $(call EmitControl,$(PKG_NAME)))\n' +
                '$(file >' + str(root / 'CONTROL') + ',$(Package/$(PKG_NAME)/CONTROL))\nall:;@true\n')
            result = subprocess.run(['make', '-f', str(harness), f'TOPDIR={root}',
                f'INCLUDE_DIR={root}/include', 'DUMP=1'], cwd=PACKAGE, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            value = (root / 'CONTROL').read_text()
            print(value)
            self.assertIn('Depends: luci-app-homestatus (>=1.0.0-r2), luci-base, luci-app-homestatus\n', value)

if __name__ == '__main__':
    unittest.main()
