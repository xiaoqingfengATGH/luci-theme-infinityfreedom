# Homestatus connectivity load key

App branch `fix/homestatus-connectivity-emerald` owns the approved Internet-only emerald CSS/class. This independent theme branch changes only footer `overview.js?v=1` to `?v=2`, ensuring the new JS upgrades the app CSS preload to `?v=5`. No palette/header/login/generator or configuration changes; palette cache remains v21.

Staged footer compiled with real router ucode loadfile raw_mode=false before hotpatching. Backup: `/root/homestatus-hotpatch-connectivity-20261014-003409/footer.ut`. Installed target `/usr/share/ucode/luci/template/themes/infinityfreedom-ng/footer.ut`, chmod 644, SHA256 `445a8bab7a5a0f20f81da8003840215309f87171572ee2f97746a871ec89a0f3` matches source. Live reloaded HTML loads JS v2/CSS v5 with no theme fallback. Both luminous palettes verified via nonpersistent DOM-only switch; user palette restored to luminousblue and UCI config hashes unchanged.

Full 26 application tests (original 24 plus connectivity DOM/real Edge cascade tests) pass against this theme worktree; updated app stylesheet palette generator --check passes without generated-file changes. Complete selectors, resource hashes and recovery instructions: paired app `docs/homestatus-connectivity-emerald.md`.

No SDK/IPK, merge, push or PR.
