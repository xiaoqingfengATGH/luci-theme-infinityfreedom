"""Execute defaults using real POSIX sh; prevent CRLF release regressions."""
import io
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
DEFAULTS = ROOT / 'luci-theme-infinityfreedom-ng/root/etc/uci-defaults'

class DefaultsTests(unittest.TestCase):
    def test_shell_upgrade_and_image_build_are_noops(self):
        for script in sorted(DEFAULTS.iterdir()):
            for guard in ({'PKG_UPGRADE': '1'}, {'IPKG_INSTROOT': '/image'}):
                with self.subTest(script=script.name, guard=guard), tempfile.TemporaryDirectory() as tmp:
                    # A trap command makes any UCI invocation observable, even -q get.
                    uci = Path(tmp) / 'uci'
                    uci.write_text('#!/bin/sh\nprintf "unexpected uci call\\n" >&2\nexit 99\n')
                    uci.chmod(0o755)
                    env = dict(os.environ, PATH=tmp + os.pathsep + os.environ['PATH'], IPKG_INSTROOT='', PKG_UPGRADE='', **{})
                    env.update(guard)
                    proc = subprocess.run(['sh', str(script)], env=env, capture_output=True)
                    self.assertEqual(proc.returncode, 0, proc.stderr.decode())
                    self.assertEqual(proc.stderr, b'')
                    self.assertEqual(proc.stdout, b'')

    def test_git_archive_defaults_are_lf(self):
        # Index snapshot allows running before committing the repair.
        tree = subprocess.check_output(['git', 'write-tree'], cwd=ROOT).strip().decode()
        archive = subprocess.check_output(['git', 'archive', tree], cwd=ROOT)
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            for script in sorted(DEFAULTS.iterdir()):
                data = tar.extractfile(script.relative_to(ROOT).as_posix()).read()
                self.assertNotIn(b'\r', data, script.name)
                self.assertTrue(data.endswith(b'\n'))

if __name__ == '__main__':
    unittest.main()
