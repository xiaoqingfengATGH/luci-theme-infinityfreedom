#!/usr/bin/env python3
"""SSH exec helper for the HomeLede build VM (192.168.1.250).

Usage:
  VM_PW=... python .vmexec.py "command"
  VM_PW=... VM_TIMEOUT=1800 python .vmexec.py "long build command"

Password comes from the VM_PW env var (never hardcoded). Mirrors
.sshexec.py (router) - see references/package-enablement-and-ipk-deploy.md.
"""
import sys, os
import paramiko

HOST = "192.168.1.250"
USER = "homelede"
PORT = 22
TREE = "/home/homelede/sources/xiaoqingfeng/Homelede5"

def main():
    if len(sys.argv) < 2:
        print("usage: VM_PW=... python .vmexec.py 'command'", file=sys.stderr)
        sys.exit(2)

    cmd = sys.argv[1]
    timeout = int(os.environ.get("VM_TIMEOUT", "300"))

    pw = os.environ.get("VM_PW")
    if not pw:
        print("VM_PW env var not set", file=sys.stderr)
        sys.exit(3)

    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cli.connect(HOST, port=PORT, username=USER, password=pw, timeout=15,
                allow_agent=False, look_for_keys=False,
                key_filename=os.path.expanduser("~/.ssh/id_ed25519"))

    stdin, stdout, stderr = cli.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    rc = stdout.channel.recv_exit_status()
    sys.stdout.write(out)
    if err.strip():
        sys.stdout.write("\n--- stderr ---\n" + err)
    sys.stdout.write(f"\n[exit {rc}]\n")
    cli.close()
    sys.exit(rc)

if __name__ == "__main__":
    main()
