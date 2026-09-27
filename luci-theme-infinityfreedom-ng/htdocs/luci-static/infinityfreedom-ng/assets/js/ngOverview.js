/*
 * HomeLede overview (Admin / Status / Overview) - status-first relayout.
 *
 * Part of luci-theme-infinityfreedom-ng.
 *
 * Why a theme-side script instead of editing luci-mod-status:
 * the stock overview is a client-rendered LuCI view (view/status/include/*.js)
 * and the theme must not fork an upstream module. The theme already owns the
 * page chrome and runs ngFullRender() once the view DOM has settled, so it is
 * the natural place to rearrange what was rendered - which is exactly what the
 * approved design asks for ("use the existing structure, rework it with
 * jQuery").
 *
 * Design contract (approved as option A):
 *   - answer "is the router OK right now" above the fold, data second
 *   - a boolean status is a dot + wording; only genuine ratios (CPU, memory,
 *     writable storage) get a progress track
 *   - a read-only squashfs image is NOT drawn as a 100% bar
 *   - enabled=0 is a normal state, never painted as a fault
 *   - a router answers "is the internet up" via its WAN interfaces; a side
 *     router (旁路由, no WAN port) answers it via its default gateway's ARP
 *     presence, so the KPI/card becomes "上游网关" in that mode
 *   - multi-WAN: every wan* interface is a row; a wan6-type dhcpv6/6in4
 *     companion rides its IPv4 sibling's physical line and is folded into a
 *     single "IPv6" line, never counted as an independent uplink
 *   - LAN is the device card (peers, subnet, leases); wifi renders
 *     only when radio hardware exists (wired-only boxes stay clean)
 *   - the device list is capped so it cannot dwarf the WAN card beside it
 *   - the original LuCI sections are preserved verbatim, collapsed at the bottom
 *
 * Everything is fetched from ubus objects the stock overview already uses
 * (plus luci.homestatus), so no extra ACL grant is needed for an admin user.
 */

(function() {
	'use strict';

	/* ------------------------------------------------------------- guards --- */

	function pageIsOverview() {
		try {
			if (typeof(luciLocation) != 'undefined' && luciLocation && luciLocation.length >= 3)
				return (luciLocation[1] == 'status' && luciLocation[2] == 'overview');
		}
		catch (e) {}

		return /\/admin\/status\/overview\/?$/.test(window.location.pathname);
	}

	if (!pageIsOverview())
		return;

	var CSS_HREF = null;
	var REFRESH_MS = 5000;

	/* mount() runs once; refresh() re-renders block bodies on the poll. */
	var state = {
		mounted: false,
		root: null,
		slots: {},
		timer: null,
		busy: false,
		lastError: null,
		/* system-info popover open across the 5s repaint (re-anchored to
		 * the fresh button in renderHero) */
		sysOpen: false
	};

	/* ------------------------------------------------------------ helpers --- */

	function fmtBytes(b) {
		if (b == null || isNaN(b))
			return '—';

		var u = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB' ];
		var i = 0;
		var v = Number(b);

		while (v >= 1024 && i < u.length - 1) {
			v /= 1024;
			i++;
		}

		return (i == 0 ? v.toFixed(0) : v.toFixed(v < 10 ? 2 : 1)) + ' ' + u[i];
	}

	function fmtUptime(sec) {
		if (sec == null || isNaN(sec) || sec <= 0)
			return '—';

		var d = Math.floor(sec / 86400);
		var h = Math.floor((sec % 86400) / 3600);
		var m = Math.floor((sec % 3600) / 60);
		var out = [];

		if (d > 0) out.push(d + '天');
		if (d > 0 || h > 0) out.push(h + '小时');
		out.push(m + '分');

		return out.join(' ');
	}

	/* router epoch -> admin-readable wall clock. The epoch is absolute, so
	 * formatting in the browser shows the router's time as long as admin
	 * browser and router share a timezone (the normal single-LAN case). */
	function fmtLocalTime(epoch) {
		if (epoch == null || isNaN(epoch))
			return null;

		var dt = new Date(epoch * 1000);

		function p(n) { return (n < 10 ? '0' : '') + n; }

		return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate())
			+ ' ' + p(dt.getHours()) + ':' + p(dt.getMinutes()) + ':' + p(dt.getSeconds());
	}

	/* "HomeLede " + "24.10.5" -> "HomeLede 24.10.5" (revision rides along
	 * as the dim second line, e.g. "v2024.08.03 based on OpenWrt R26.05.20") */
	function fwLine(board) {
		var s = ((board && board.description) || '') + ' ' + ((board && board.version) || '');

		s = s.replace(/\s+/g, ' ').trim();

		return s || null;
	}

	function pct(used, total) {
		if (!total || total <= 0)
			return null;

		return Math.max(0, Math.min(100, Math.round(used * 100 / total)));
	}

	function intOf(v) {
		var n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10);
		return isNaN(n) ? null : n;
	}

	/* "1000F" -> "1 GbE 全双工" */
	function prettySpeed(s) {
		if (s == null || s === '')
			return null;

		var m = /^(\d+)([FH])?$/.exec(String(s));
		if (!m)
			return String(s);

		var mbps = parseInt(m[1], 10);
		var label = (mbps >= 1000) ? (mbps / 1000) + ' GbE' : mbps + ' Mbps';
		var duplex = (m[2] == 'F') ? '全双工' : (m[2] == 'H' ? '半双工' : null);

		return duplex ? (label + ' ' + duplex) : label;
	}

	/* "192.168.224.247" + 24 -> "192.168.224.0/24" */
	function netOf(addr, mask) {
		if (!addr || !mask)
			return null;

		var parts = String(addr).split('.');
		if (parts.length != 4)
			return null;

		var n = parseInt(mask, 10);
		var v = 0;

		for (var i = 0; i < 4; i++)
			v = (v << 8) | (parseInt(parts[i], 10) & 0xff);

		var bits = n === 0 ? 0 : (0xffffffff << (32 - n)) >>> 0;
		v = (v & bits) >>> 0;

		return [ (v >>> 24), (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff ].join('.') + '/' + n;
	}

	function inNet(ip, addr, mask) {
		if (!ip || !addr || !mask)
			return false;

		var a = String(ip).split('.');
		var b = String(addr).split('.');
		if (a.length != 4 || b.length != 4)
			return false;

		var n = parseInt(mask, 10);
		var va = 0, vb = 0;

		for (var i = 0; i < 4; i++) {
			va = (va << 8) | (parseInt(a[i], 10) & 0xff);
			vb = (vb << 8) | (parseInt(b[i], 10) & 0xff);
		}

		var bits = n === 0 ? 0 : (0xffffffff << (32 - n)) >>> 0;

		return ((va & bits) >>> 0) == ((vb & bits) >>> 0);
	}

	/* Avatar text: a hostname initial if we have one, otherwise the last two
	 * hex digits of the MAC - recognisable and stable, unlike digits scraped
	 * from an IP address. */
	function thumb(label, mac) {
		var s = String(label || '').replace(/[^A-Za-z0-9]/g, '');

		if (s.length >= 2)
			return s.substr(0, 2).toUpperCase();

		s = String(mac || '').replace(/[^A-Fa-f0-9]/g, '');
		if (s.length >= 2)
			return s.substr(s.length - 2).toUpperCase();

		return '?';
	}

	function dot(cls, small) {
		return E('span', { 'class': 'ngov-dot' + (small ? ' sm' : '') + (cls ? ' ' + cls : '') });
	}

	function pill(cls, text) {
		return E('span', { 'class': 'ngov-pill' + (cls ? ' ' + cls : '') }, [
			E('i'), text
		]);
	}

	function clear(node) {
		while (node && node.firstChild)
			node.removeChild(node.firstChild);
	}

	function card(title, countText, actions, body) {
		var head = E('div', { 'class': 'ngov-card-h' }, [ E('h3', {}, [ title ]) ]);

		if (countText != null)
			head.appendChild(E('span', { 'class': 'cnt' }, [ countText ]));

		if (actions && actions.length)
			head.appendChild(E('div', { 'class': 'act' }, actions));

		return E('div', { 'class': 'ngov-card' }, [ head, body ]);
	}

	function mini(label, value) {
		return E('div', { 'class': 'ngov-mini' }, [
			E('span', {}, [ label ]),
			E('b', {}, [ value == null ? '—' : value ])
		]);
	}

	/* --------------------------------------------------------------- rpc ---- */

	var api = null;

	function loadApi() {
		if (api != null)
			return Promise.resolve(api);

		return Promise.all([
			L.require('rpc'),
			L.resolveDefault(L.require('fs'), null)
		]).then(function(mods) {
			var rpc = mods[0];
			var fs = mods[1];

			function d(object, method, params, expect) {
				return rpc.declare({
					object: object,
					method: method,
					params: params || [],
					expect: expect || {}
				});
			}

			api = {
				fs: fs,
				/* NOTE: LuCI's rpc.js `expect` unwraps exactly one level - only
				 * the first key is used, and if its type does not match, the
				 * declared default is returned instead. So `expect: {}` yields
				 * the whole reply object (read fields off it) while
				 * `expect: { interface: [] }` would already yield the array.
				 * Mixing the two styles silently produces empty data. */
				board:      d('system', 'board', null, {}),
				info:       d('system', 'info', null, {}),
				cpuUsage:   d('luci', 'getCPUUsage', null, {}),
				cpuInfo:    d('luci', 'getCPUInfo', null, {}),
				mounts:     d('luci', 'getMountPoints', null, {}),
				ifDump:     d('network.interface', 'dump', null, {}),
				devAll:     d('network.device', 'status', null, {}),
				leases:     d('luci-rpc', 'getDHCPLeases', null, {}),
				hostHints:  d('luci-rpc', 'getHostHints', null, {}),
				netDevs:    d('luci-rpc', 'getNetworkDevices', null, {}),
				menuTree:   d('luci-rpc', 'getMenuTree', null, {}),
				sysTime:    d('luci', 'getUnixtime', null, {}),
				hsStatus:   d('luci.homestatus', 'status', null, {}),
				hsRestart:  d('luci.homestatus', 'restart_app', [ 'payload' ], {}),
				hsWol:      d('luci.homestatus', 'wol_targets', null, {}),
				hsWake:     d('luci.homestatus', 'wake', [ 'payload' ], {}),
				wifiDevs:   d('iwinfo', 'devices', null, {}),
				wifiAssoc:  d('iwinfo', 'assoclist', [ 'device' ], {})
			};

			return api;
		});
	}

	function soft(promise, fallback) {
		return L.resolveDefault(promise, fallback);
	}

	/* One gather path for both the initial render and every poll tick:
	 * resolve the WAN device name from the interface dump first, then ask that
	 * device for its link state (speed/duplex). */
	function gather() {
		var a = null;

		return loadApi().then(function(api_) {
			a = api_;

			return Promise.all([
				soft(a.board(), {}),
				soft(a.info(), {}),
				soft(a.cpuUsage(), {}),
				soft(a.cpuInfo(), {}),
				soft(a.mounts(), {}),
				soft(a.ifDump(), {}),
				soft(a.leases(), {}),
				soft(a.hostHints(), {}),
				soft(a.netDevs(), {}),
				soft(a.hsStatus(), null),
				wifiData(a),
				conntrackCount(),
				soft(a.sysTime(), null),
				soft(a.hsWol(), null)
			]);
		}).then(function(v) {
			var ifaces = (v[5] && Array.isArray(v[5].interface)) ? v[5].interface : [];
			var wanDev = state.wanDevice || 'eth1';

			for (var i = 0; i < ifaces.length; i++)
				if (ifaces[i].interface == 'wan')
					wanDev = ifaces[i].l3_device || ifaces[i].device || wanDev;

			state.wanDevice = wanDev;

			/* One shot for ALL devices: bridges expose bridge-members, ports
			 * expose carrier. The WAN device's own entry yields link speed. */
			return soft(a.devAll(), {}).then(function(devs) {
				var dev = (devs && wanDev && devs[wanDev]) ? devs[wanDev] : null;

				/* menu tree drives optional deep-links (e.g. luci-app-diskman
				 * on builds that ship it) - fetch best-effort */
				return soft(a.menuTree(), {}).then(function(mt) {
					state.menuTree = mt || {};

					return normalize({
						board: v[0], info: v[1], cpu: v[2], cpuinfo: v[3],
						mounts: (v[4] && Array.isArray(v[4].result)) ? v[4].result : [],
						ifaces: (v[5] && Array.isArray(v[5].interface)) ? v[5].interface : [],
						leases: v[6], hints: v[7], selfDevs: v[8], hs: v[9],
						wifi: v[10], ct: v[11], systime: v[12], wol: v[13],
						devs: devs || {}, dev: dev, wanDevice: wanDev
					});
				});
			});
		});
	}

	/* Radios exist only on wireless hardware. On a wired-only box (the x86_64
	 * build) iwinfo returns an empty device list and we must not emit wifi
	 * rows at all - an "off" wifi block on a machine without radios would be
	 * a permanent false alarm. */
	function hasWifiData(raw) {
		return !!(raw && raw.wifi && raw.wifi.radios && raw.wifi.radios.length);
	}

	function wifiData(a) {
		return soft(a.wifiDevs(), { devices: [] }).then(function(r) {
			var devs = (r && Array.isArray(r.devices)) ? r.devices : [];

			if (!devs.length)
				return { radios: [] };

			var calls = devs.map(function(x) {
				var name = (x && x.name) ? x.name : String(x || '');

				return name ? soft(a.wifiAssoc(name), {}) : Promise.resolve({});
			});

			return Promise.all(calls).then(function(lists) {
				var radios = [];

				for (var i = 0; i < devs.length; i++) {
					var name = (devs[i] && devs[i].name) ? devs[i].name : String(devs[i] || '');
					var raw = Array.isArray(lists[i]) ? lists[i]
						: ((lists[i] && Array.isArray(lists[i].results)) ? lists[i].results : []);

					radios.push({ name: name, clients: raw.length });
				}

				return { radios: radios };
			});
		});
	}

	function conntrackCount() {
		if (api == null || api.fs == null)
			return Promise.resolve(null);

		return Promise.all([
			soft(api.fs.trimmed('/proc/sys/net/netfilter/nf_conntrack_count'), null),
			soft(api.fs.trimmed('/proc/sys/net/netfilter/nf_conntrack_max'), null)
		]).then(function(v) {
			var cur = intOf(v[0]);
			if (cur == null)
				return null;

			return { count: cur, max: intOf(v[1]) };
		});
	}

	/* ------------------------------------------------------- normalization -- */

	/* Logical CPU count: getCPUInfo reads "... x 1C 2T (4200MHz, )". */
	function cpuCores(cpuinfo, info) {
		var s = (cpuinfo && cpuinfo.cpuinfo) ? String(cpuinfo.cpuinfo) : '';
		var m = /x\s*(\d+)\s*C\s*(\d+)\s*T/i.exec(s);

		if (m)
			return parseInt(m[1], 10) * parseInt(m[2], 10);

		m = /x\s*(\d+)\s*C/i.exec(s);
		if (m)
			return parseInt(m[1], 10);

		return null;
	}

	/* Flatten luci.homestatus disks[] into one row per mount point.
	 * Physical order is preserved: disk -> partition -> volume -> mount. */
	function diskRows(hs) {
		var rows = [];
		var seen = {};

		function pushMount(m, fstype, readonly, devName) {
			if (m == null || m.target == null)
				return;

			if (seen[m.target] && !m.alias)
				return;

			seen[m.target] = true;

			rows.push({
				target: m.target,
				fstype: fstype,
				readonly: readonly === true,
				alias: m.alias || null,
				dev: devName || null,
				bytes_total: m.bytes_total,
				bytes_used: m.bytes_used,
				bytes_avail: m.bytes_avail,
				use_pct: m.use_pct
			});
		}

		var disks = (hs && Array.isArray(hs.disks)) ? hs.disks : [];

		for (var i = 0; i < disks.length; i++) {
			var d = disks[i];
			if (d == null || d.error != null)
				continue;

			for (var j = 0; j < (d.partitions || []).length; j++) {
				var p = d.partitions[j];

				for (var k = 0; k < (p.mounts || []).length; k++)
					pushMount(p.mounts[k], p.fstype, p.readonly, p.name);

				for (var l = 0; l < (p.volumes || []).length; l++) {
					var vol = p.volumes[l];
					for (var n = 0; n < (vol.mounts || []).length; n++)
						pushMount(vol.mounts[n], vol.fstype, false, vol.name);
				}
			}
		}

		/* The writable overlay is the number a user acts on, so it leads. */
		rows.sort(function(a, b) {
			if (a.target == '/overlay') return -1;
			if (b.target == '/overlay') return 1;
			if (a.readonly != b.readonly) return a.readonly ? 1 : -1;
			return a.target < b.target ? -1 : (a.target > b.target ? 1 : 0);
		});

		return rows;
	}

	function overlayRow(hs, mounts) {
		var rows = diskRows(hs);

		for (var i = 0; i < rows.length; i++)
			if (rows[i].target == '/overlay' && rows[i].use_pct != null)
				return rows[i];

		/* fall back to the standard mount list if homestatus is unavailable */
		var list = Array.isArray(mounts) ? mounts
			: ((mounts && Array.isArray(mounts.result)) ? mounts.result : []);

		for (var j = 0; j < list.length; j++) {
			if (list[j].mount != '/overlay')
				continue;

			var size = list[j].size, free = list[j].free;

			return {
				target: '/overlay',
				fstype: null,
				readonly: false,
				bytes_total: size,
				bytes_avail: free,
				bytes_used: (size != null && free != null) ? (size - free) : null,
				use_pct: pct(size - free, size)
			};
		}

		return null;
	}

	function normalize(raw) {
		var board = raw.board || {};
		var info = raw.info || {};
		var mem = info.memory || {};
		var ifaces = Array.isArray(raw.ifaces) ? raw.ifaces
			: ((raw.ifaces && Array.isArray(raw.ifaces.interface)) ? raw.ifaces.interface : []);

		var wan = null, lan = null;
		/* Multi-WAN: OpenWrt names extra uplinks wan2/wan6/wan_guest... All of
		 * them are WANs; the one literally named 'wan' leads when present. */
		var wanList = [];

		for (var i = 0; i < ifaces.length; i++) {
			if (ifaces[i].interface == 'wan') wan = ifaces[i];
			if (ifaces[i].interface == 'lan') lan = ifaces[i];
			if (/^wan/i.test(String(ifaces[i].interface || '')))
				wanList.push(ifaces[i]);
		}

		if (wan == null && wanList.length)
			wan = wanList[0];

		var selfIps = {};

		function collectSelf(ifc) {
			if (!ifc)
				return;

			for (var j = 0; j < (ifc['ipv4-address'] || []).length; j++)
				selfIps[ifc['ipv4-address'][j].address] = true;
		}

		collectSelf(wan);
		collectSelf(lan);

		/* Every MAC the router itself owns (br-lan, eth0/1, docker0, dummy0,
		 * ...). getHostHints() is the kernel neighbour table, so it also lists
		 * our own interfaces - without this filter docker0/dummy0 show up as
		 * if they were devices on the LAN. */
		var selfMacs = {};
		var nd = raw.selfDevs || {};

		for (var ndName in nd) {
			var ndMac = nd[ndName] ? nd[ndName].mac : null;
			if (ndMac)
				selfMacs[String(ndMac).toUpperCase()] = true;
		}

		var wanIp = (wan && wan['ipv4-address'] && wan['ipv4-address'][0])
			? wan['ipv4-address'][0].address : null;
		var lanIp = (lan && lan['ipv4-address'] && lan['ipv4-address'][0])
			? lan['ipv4-address'][0].address : null;
		var lanMask = (lan && lan['ipv4-address'] && lan['ipv4-address'][0])
			? lan['ipv4-address'][0].mask : null;

		/* ---- LAN groups: one per routed client network (multi-LAN boxes
		 * have lan/guest/iot...). A bridge shows as ONE group annotated with
		 * its member ports; ports not in any L3 interface form a dormant
		 * "未划入网络" group so nothing silently disappears. ---- */
		var selfDevs = raw.devs || {};
		var usedPorts = {};
		var lanGroups = [];
		var memberCount = 0;

		for (var gi = 0; gi < ifaces.length; gi++) {
			var gif = ifaces[gi];

			if (!gif || gif.interface == 'loopback')
				continue;

			/* skip wan* - they are uplinks, not client networks */
			if (/^wan/i.test(String(gif.interface || '')))
				continue;

			var gL3 = gif.l3_device || gif.device;
			var gDev = gL3 ? (selfDevs[gL3] || null) : null;
			var ports = (gDev && Array.isArray(gDev['bridge-members']))
				? gDev['bridge-members'] : ((gDev && gL3 && gDev.present) ? [ gL3 ] : []);
			var wifiOnly = ports.length == 0;

			/* a L3 interface whose device no longer exists (e.g. docker0
			 * after docker stopped) renders as a dead group header - hide
			 * it; its residual IP still shows in 其他/未分类. Same for a
			 * device-less interface on a box without wifi hardware
			 * (stale wireless config on wired-only builds). */
			if (!wifiOnly) {
				if (!gDev)
					continue;
			}
			else if (hasWifiData(raw))
				continue;

			if (wifiOnly) {
				/* remaining wifi-only case: no bridge but wifi present is
				 * already skipped above; reaching here means stale config */
				continue;
			}

			for (var pj = 0; pj < ports.length; pj++)
				usedPorts[ports[pj]] = true;

			memberCount += ports.length;

			var gIp = (gif['ipv4-address'] && gif['ipv4-address'][0]) ? gif['ipv4-address'][0] : null;

			lanGroups.push({
				name: String(gif.interface || '?'),
				up: !!gif.up,
				ip: gIp ? gIp.address : null,
				mask: gIp ? gIp.mask : null,
				net: gIp ? netOf(gIp.address, gIp.mask) : null,
				device: gL3,
				isBridge: !!(gDev && gDev.type == 'bridge'),
				ports: ports,
				portUp: ports.filter(function(pn) {
					var pd = selfDevs[pn];
					return !!(pd && pd.carrier);
				}).length
			});
		}

		/* physical ports no L3 interface claimed: visible, marked unplugged
		 * or unassigned - never counted into peer totals. WAN-side ports are
		 * NOT spare: they belong to the uplink card below, and listing eth1
		 * as "未划入网络" read like a wiring mistake. */
		var wanDevs = {};

		for (var wdi = 0; wdi < ifaces.length; wdi++) {
			var wif = ifaces[wdi];

			if (wif && /^wan/i.test(String(wif.interface || ''))) {
				if (wif.l3_device) wanDevs[wif.l3_device] = true;
				if (wif.device) wanDevs[wif.device] = true;
			}
		}

		var sparePorts = [];

		for (var sn in selfDevs) {
			var sd = selfDevs[sn];

			if (!sd || sd.type == 'bridge' || !sd.present)
				continue;

			if (usedPorts[sn] || wanDevs[sn] || sn == 'lo' || /^docker|^dummy|^sit|^tun|^tap|^wg|^pppoe|^gre|^erspan|^gretap/.test(sn))
				continue;

			sparePorts.push({
				name: sn,
				carrier: !!sd.carrier,
				speed: sd.speed ? prettySpeed(sd.speed) : null
			});
		}

		/* Default route: on a normal router the WAN interfaces carry it; a
		 * side router (旁路由, no WAN port at all) receives it ON its LAN
		 * interface, pointing at the main router. Look for 0.0.0.0/0 in
		 * both places instead of trusting route[0]. */
		function defaultRoute(ifc) {
			if (!ifc || !Array.isArray(ifc.route))
				return null;

			for (var r = 0; r < ifc.route.length; r++)
				if (ifc.route[r] && ifc.route[r].target == '0.0.0.0' && (!ifc.route[r].mask || ifc.route[r].mask == 0))
					return ifc.route[r].nexthop || null;

			return null;
		}

		/* No wan-prefixed interface at all = side-router / dumb-AP mode. */
		var sideRouter = (wanList.length === 0);
		var gateway = defaultRoute(wan);

		if (gateway == null)
			gateway = defaultRoute(lan);

		/* Side-router reachability proxy: on an active LAN the main router
		 * answers ARP constantly, so its presence in the neighbour table
		 * means "upstream L2 alive". Never claim more than that. */
		var gwAlive = false;

		if (gateway != null) {
			for (var gk in raw.hints || {}) {
				var gh = raw.hints[gk] || {};
				var gips = Array.isArray(gh.ipaddrs) ? gh.ipaddrs : [];

				if (gips.indexOf(gateway) >= 0) {
					gwAlive = true;
					break;
				}
			}
		}

		/* ---- devices: DHCP leases first, ARP/neighbour table as backfill --- */

		var leases = [];
		var lraw = raw.leases || {};

		if (Array.isArray(lraw.dhcp_leases))
			leases = lraw.dhcp_leases;

		var byMac = {};

		for (var li = 0; li < leases.length; li++) {
			var L0 = leases[li];
			if (L0 == null || !L0.macaddr)
				continue;

			byMac[String(L0.macaddr).toUpperCase()] = {
				mac: L0.macaddr,
				ip: L0.ipaddr || null,
				hostname: L0.hostname || null,
				source: 'dhcp',
				online: true
			};
		}

		var hints = raw.hints || {};
		var arpOnly = [];

		for (var mac in hints) {
			var up = String(mac).toUpperCase();
			var h = hints[mac] || {};
			var ips = Array.isArray(h.ipaddrs) ? h.ipaddrs : [];

			/* never list the router's own interfaces */
			var isSelf = (selfMacs[up] === true);
			for (var si = 0; si < ips.length; si++)
				if (selfIps[ips[si]])
					isSelf = true;

			if (isSelf)
				continue;

			if (byMac[up])
				continue;

			var ip = ips.length ? ips[0] : null;

			arpOnly.push({
				mac: mac,
				ip: ip,
				hostname: null,
				/* an entry with only a link-local IPv6 is a live neighbour we
				 * cannot place in a subnet - say so rather than invent one */
				source: ip ? 'arp' : 'll',
				online: true
			});
		}

		var lanPeers = [];
		var llPeers = [];
		var otherPeers = [];
		var upstream = null;

		for (var ai = 0; ai < arpOnly.length; ai++) {
			var p0 = arpOnly[ai];

			if (gateway != null && p0.ip == gateway)
				upstream = p0;
			else if (p0.ip == null)
				llPeers.push(p0);          /* live neighbour, no IPv4 to place */
			else if (lanIp != null && inNet(p0.ip, lanIp, lanMask))
				lanPeers.push(p0);
			else
				otherPeers.push(p0);
		}

		/* A lease on the WAN side belongs to the upstream segment, not the LAN. */
		var dhcpPeers = [];

		for (var k2 in byMac) {
			var e0 = byMac[k2];

			if (gateway != null && e0.ip == gateway)
				upstream = e0;
			else if (e0.ip != null && lanIp != null && inNet(e0.ip, lanIp, lanMask))
				dhcpPeers.push(e0);
			else
				otherPeers.push(e0);
		}

		lanPeers = dhcpPeers.concat(lanPeers);

		/* ---- totals ---- */

		var memTotal = mem.total || 0;
		var memAvail = (mem.available != null) ? mem.available
			: ((mem.free != null && mem.buffered != null) ? (mem.free + mem.buffered) : null);
		var memPct = (memTotal && memAvail != null) ? pct(memTotal - memAvail, memTotal) : null;

		var load = Array.isArray(info.load) ? info.load : [];
		var loads = [];

		for (var ld = 0; ld < 3; ld++)
			if (load[ld] != null)
				loads.push((load[ld] / 65535).toFixed(2));

		var hsCfg = (raw.hs && raw.hs.config) ? raw.hs.config : {};
		var warn = (hsCfg.warn != null) ? hsCfg.warn : 80;
		var crit = (hsCfg.crit != null) ? hsCfg.crit : 90;

		var apps = (raw.hs && Array.isArray(raw.hs.apps)) ? raw.hs.apps : [];
		apps = apps.filter(function(x) { return x != null && x.error == null; });

		var running = 0, stopped = 0, disabled = 0;

		for (var ap = 0; ap < apps.length; ap++) {
			if (apps[ap].state == 'running') running++;
			else if (apps[ap].state == 'stopped') stopped++;
			else if (apps[ap].state == 'disabled') disabled++;
		}

		var ov = overlayRow(raw.hs, raw.mounts);
		var speed = (raw.dev && raw.dev.speed) ? prettySpeed(raw.dev.speed) : null;

		/* ---- LAN / WiFi ---- */
		var lanUp = !!(lan && lan.up);
		var wifi = raw.wifi || { radios: [] };
		var wifiClients = 0;
		var wifiUp = 0;

		for (var wj = 0; wj < wifi.radios.length; wj++) {
			var wr = wifi.radios[wj] || {};

			wifiClients += (wr.clients != null) ? wr.clients : 0;
			wifiUp += (wr.clients > 0) ? 1 : 0;
		}

		var hasWifi = wifi.radios.length > 0;
		var lanNetTxt = netOf(lanIp, lanMask);
		var wanUp = !!(wan && wan.up && wanIp);

		/* IPv6 companion connectivity: any dhcpv6/6in4 wan* that is up and
		 * actually carrying a v6 address counts as an alternate exit. */
		function dV6Up() {
			for (var vi = 0; vi < wanList.length; vi++) {
				var wv = wanList[vi];
				var vpr = String((wv && wv.proto) || '').toLowerCase();
				var isV6 = /^(dhcpv6|6in4|6to4|6rd|pppoe6|native6)$/.test(vpr) || /6$/.test(String((wv && wv.interface) || ''));

				if (isV6 && wv.up && ((wv['ipv6-address'] && wv['ipv6-address'].length) ||
				                      (wv['ipv6-prefix-assignment'] && wv['ipv6-prefix-assignment'].length)))
					return true;
			}

			return false;
		}

		/* Upstream lives outside the LAN: connected + addressed = fine, but it
		 * is NOT counted as a LAN peer. */

		return {
			board: board,
			info: info,
			cpuPct: intOf(raw.cpu && raw.cpu.cpuusage),
			cores: cpuCores(raw.cpuinfo, info),
			loads: loads,
			memTotal: memTotal,
			memAvail: memAvail,
			memPct: memPct,
			uptime: info.uptime || null,
			wan: wan,
			wanList: wanList,
			sideRouter: sideRouter,
			gwAlive: gwAlive,
			wanIp: wanIp,
			gateway: gateway,
			lan: lan,
			lanIp: lanIp,
			lanMask: lanMask,
			lanNet: netOf(lanIp, lanMask),
			lanGroups: lanGroups,
			sparePorts: sparePorts,
			memberCount: memberCount,
			/* "互联网接通" = the box has a working path out: a WAN line that
			 * is up AND addressed, or (side router) an answering gateway */
			inetUp: sideRouter ? (gateway != null && gwAlive) : !!(wanUp || dV6Up()),
			wanUp: !!(wan && wan.up && wanIp),
			lanPeers: lanPeers,
			llPeers: llPeers,
			otherPeers: otherPeers,
			upstream: upstream,
			/* one number for "how many devices are on my network", excluding
			 * the upstream router and our own interfaces */
			peerTotal: lanPeers.length + llPeers.length + otherPeers.length,
			leases: leases,
			lanUp: lanUp,
			lanNet: lanNetTxt,
			hasWifi: hasWifi,
			wifiClients: wifiClients,
			wifiUp: wifiUp,
			ct: raw.ct,
			hs: raw.hs,
			hsCfg: { warn: warn, crit: crit },
			/* Block visibility toggles, read from the same homestatus
			 * `config` payload the thresholds come from. Default true so
			 * an older backend (or an absent option) still shows
			 * everything. */
			showApps: (hsCfg.show_apps !== false),
			showWol: (hsCfg.show_wol !== false),
			apps: apps,
			/* Wake-on-LAN targets live in the stock luci-wol package; the
			 * backend merges in neighbour-table presence so the card can
			 * show online/offline without a second lookup. */
			wol: (raw.wol && Array.isArray(raw.wol.targets)) ? raw.wol.targets : [],
			wolErr: (raw.wol && raw.wol.read_error) ? raw.wol.read_error : null,
			wolOk: !!(raw.wol && raw.wol.ok === true && raw.wol.etherwake !== false),
			counts: { running: running, stopped: stopped, disabled: disabled, total: apps.length },
			diskRows: diskRows(raw.hs),
			overlay: ov,
			speed: speed,
			wanDevice: raw.wanDevice || (wan ? (wan.l3_device || wan.device) : null),
			/* router-side clock, used by the system info popover (a browser
			 * Date would show the ADMIN machine's time, not the router's).
			 * luci getUnixtime answers { result: <epoch> } via rpc.js. */
			unixtime: (raw.systime && raw.systime.result != null) ? raw.systime.result : null,
			hostname: board.hostname || null
		};
	}

	/* ------------------------------------------------------------ health ---- */

	function health(d) {
		var reasons = [];
		var level = 'ok';

		function bump(l) {
			if (l == 'critical') level = 'critical';
			else if (l == 'degraded' && level != 'critical') level = 'degraded';
		}

		/* Multi-WAN health: only INDEPENDENT uplinks count. A dhcpv6/6in4
		 * companion (wan6 et al) rides the same physical line as its IPv4
		 * sibling, so it neither breaks nor saves the system. */
		if (d.sideRouter) {
			/* Side router (旁路由): there is no WAN interface. The honest
			 * proxy for "can we still reach the internet" is whether the
			 * default gateway (the main router) is answering ARP. */
			if (d.gateway == null) {
				reasons.push('无默认网关，未配置上游');
				bump('critical');
			}
			else if (!d.gwAlive) {
				reasons.push('上游网关 ' + d.gateway + ' 无响应');
				bump('critical');
			}
		}
		else {
			var wanAlive = 0;
			var wanTotal = d.wanList.filter(function(w) {
				var pr = String(w.proto || '').toLowerCase();

				return !(/^(dhcpv6|6in4|6to4|6rd|pppoe6|native6)$/.test(pr) || /6$/.test(String(w.interface || '')));
			}).length;

			for (var wi = 0; wi < d.wanList.length; wi++) {
				var wl = d.wanList[wi];
				var wpr = String((wl && wl.proto) || '').toLowerCase();
				var isV6 = /^(dhcpv6|6in4|6to4|6rd|pppoe6|native6)$/.test(wpr) || /6$/.test(String((wl && wl.interface) || ''));

				if (isV6)
					continue;

				if (wl && wl.up && wl['ipv4-address'] && wl['ipv4-address'].length)
					wanAlive++;
			}

			if (wanTotal > 0 && wanAlive == 0) {
				reasons.push(wanTotal > 1 ? ('全部 ' + wanTotal + ' 条 WAN 线路均未连通') : 'WAN 出口未连通');
				bump('critical');
			}
			else if (wanTotal > 1 && wanAlive < wanTotal) {
				reasons.push((wanTotal - wanAlive) + '/' + wanTotal + ' 条 WAN 线路断开');
				bump('degraded');
			}
		}

		/* LAN down means locally unreachable - worse than any single service.
		 * WiFi down does NOT alarm: a wired client may still hold the LAN. */
		if (!d.lanUp) {
			reasons.push('LAN 接口未运行');
			bump('critical');
		}

		if (d.memPct != null) {
			if (d.memPct >= d.hsCfg.crit) { reasons.push('内存占用 ' + d.memPct + '%'); bump('critical'); }
			else if (d.memPct >= d.hsCfg.warn) { reasons.push('内存占用偏高 ' + d.memPct + '%'); bump('degraded'); }
		}

		for (var i = 0; i < d.diskRows.length; i++) {
			var r = d.diskRows[i];
			if (r.readonly || r.use_pct == null)
				continue;

			if (r.use_pct >= d.hsCfg.crit) { reasons.push(r.target + ' 空间告急 ' + r.use_pct + '%'); bump('critical'); }
			else if (r.use_pct >= d.hsCfg.warn) { reasons.push(r.target + ' 空间偏紧 ' + r.use_pct + '%'); bump('degraded'); }
		}

		/* A stopped service matters; a disabled one is a deliberate choice.
		 * Skipped when the user hid the app block: the banner would
		 * otherwise flag services the page no longer lists, leaving the
		 * reason unexplainable. */
		if (d.showApps && d.counts.stopped > 0) {
			reasons.push(d.counts.stopped + ' 个关键服务未运行');
			bump('degraded');
		}

		var title = (level == 'critical') ? '系统存在故障'
			: (level == 'degraded') ? '系统运行正常，有项目需关注'
			: '系统运行正常';

		return { level: level, title: title, reasons: reasons };
	}

	/* ----------------------------------------------------------- blocks ----- */

	function renderHero(d) {
		var h = health(d);
		var board = d.board.release || {};

		var sub = [
			(board.description || '') + (board.revision || ''),
			board.target,
			d.board.kernel ? ('内核 ' + d.board.kernel) : null,
			board.distribution
		].filter(function(x) { return x != null && x !== ''; }).join(' · ');

		if (h.reasons.length)
			sub = h.reasons.join(' · ');

		var right = [
			[ String(d.peerTotal), '接入设备' ],
			[ d.counts.running + ' / ' + d.counts.total, '应用运行' ],
			[ fmtUptime(d.uptime), '运行时间' ]
		];

		var heroRight = E('div', { 'class': 'ngov-hero-right' }, right.map(function(kv) {
			return E('div', { 'class': 'ngov-kv' }, [
				E('b', {}, [ kv[0] ]),
				E('span', {}, [ kv[1] ])
			]);
		}));

		heroRight.appendChild(E('button', {
			'class': 'ngov-sysbtn',
			'type': 'button',
			'aria-haspopup': 'true',
			'aria-expanded': state.sysOpen ? 'true' : 'false',
			'click': function(ev) { toggleSysPop(ev.currentTarget, d); }
		}, [ '系统信息' ]));

		var hero = E('div', { 'class': 'ngov-hero' + (h.level != 'ok' ? (h.level == 'critical' ? ' critical' : ' degraded') : '') }, [
			E('div', { 'class': 'ngov-hero-badge' }, [
				dot(h.level == 'critical' ? 'r' : (h.level == 'degraded' ? 'w' : 'g')),
				E('div', {}, [
					E('div', { 'class': 'ngov-hero-title' }, [ h.title ]),
					E('div', { 'class': 'ngov-hero-sub' }, [ sub ])
				])
			]),
			heroRight
		]);

		/* The popover must survive the 5s repaint: re-anchor it to the
		 * fresh button each render while it is open (the clock inside
		 * stays live, since it is rebuilt from this render's unixtime).
		 * It hangs off heroRight, NOT off the button: a popover inside
		 * the trigger would make every click in it a click on the
		 * trigger too (bubbling), so closing it would immediately
		 * reopen it. */
		if (state.sysOpen)
			buildSysPop(heroRight.lastChild, d);

		return hero;
	}

	/* --- system info popover: 型号/架构/目标平台/固件版本/内核版本/本地时间 ---
	 * Deliberately NOT always-visible: it is static identity data, worthless
	 * in the 5s refresh loop, but must be one click away when wanted. */
	function sysRows(d) {
		var b = d.board || {};
		var rel = b.release || {};

		return [
			[ '型号',     b.model || '—' ],
			[ '架构',     b.system || '—' ],
			[ '目标平台', rel.target || '—' ],
			[ '固件版本', fwLine(rel) || '—' ],
			[ '内核版本', b.kernel ? ('Linux ' + b.kernel) : '—' ],
			[ '本地时间', fmtLocalTime(d.unixtime) || '—' ]
		];
	}

	/* All open/close decisions funnel through here: flip the flag and repaint
	 * from the last snapshot, so the DOM always matches state. Relying on the
	 * next 5s poll to redraw made a closed popover linger, and toggling the
	 * flag alone could not close anything. */
	function setSysOpen(open) {
		if (state.sysOpen === open)
			return;

		state.sysOpen = open;

		if (state.mounted && state.lastNorm)
			render(state.lastNorm);
	}

	function toggleSysPop(btn, d) {
		setSysOpen(!state.sysOpen);
	}

	function buildSysPop(btn, d) {
		var pop = E('div', { 'class': 'ngov-syspop', 'id': 'ngov-syspop' }, [
			E('div', { 'class': 'ngov-syspop-h' }, [
				E('b', {}, [ '系统信息' ]),
				(d.hostname ? E('span', { 'class': 'txt' }, [ d.hostname ]) : null),
				E('button', {
					'class': 'ngov-syspop-x',
					'type': 'button',
					'aria-label': '关闭',
					'click': function(ev) {
						/* stop the click reaching the trigger beneath the
						 * popover, which would toggle it straight back */
						if (ev && ev.stopPropagation)
							ev.stopPropagation();

						setSysOpen(false);
					}
				}, [ '×' ])
			]),
			E('table', {}, E('tbody', {}, sysRows(d).map(function(r) {
				return E('tr', {}, [
					E('td', {}, [ r[0] ]),
					E('td', { 'class': 'ngov-mono' }, [ r[1] ])
				]);
			})))
		]);

		/* sibling of the trigger, not a child: inside the button every
		 * click here would also be a click on the trigger. The trigger
		 * is statically positioned, so an absolutely positioned child
		 * already resolved against this same .ngov-hero-right box - the
		 * geometry does not move. */
		btn.parentNode.appendChild(pop);
	}

	function sysPopOutside(ev) {
		if (!state.sysOpen)
			return;

		var pop = document.getElementById('ngov-syspop');
		var t = ev.target;

		if (pop && pop.contains(t))
			return;

		if (t.closest && t.closest('.ngov-sysbtn'))
			return;

		setSysOpen(false);
	}

	function kpiCard(title, valueNode, subText, footDot, footText, footRight, barPct, barCls) {
		var kids = [
			E('div', { 'class': 'ngov-kpi-h' }, [ title ]),
			valueNode,
			E('div', { 'class': 'ngov-kpi-f' }, [ subText == null ? '—' : subText ])
		];

		if (barPct != null)
			kids.push(E('div', { 'class': 'ngov-bar' }, [
				E('i', { 'class': barCls || '', 'style': 'width:' + Math.max(2, Math.min(100, barPct)) + '%' })
			]));

		var foot = E('div', { 'class': 'ngov-foot' }, [ footDot, E('span', {}, [ footText ]) ]);

		if (footRight != null)
			foot.appendChild(E('span', { 'class': 'txt' }, [ footRight ]));

		kids.push(foot);

		return E('div', { 'class': 'ngov-kpi' }, kids);
	}

	function numValue(v, unit) {
		return E('div', { 'class': 'ngov-kpi-v' }, [
			String(v == null ? '—' : v),
			unit ? E('small', {}, [ unit ]) : null
		]);
	}

	function stateValue(text, cls) {
		return E('div', { 'class': 'ngov-kpi-v state' + (cls ? ' ' + cls : '') }, [ text ]);
	}

	function toneFor(p, warn, crit) {
		if (p == null) return { cls: 'm', text: '未知', dot: 'm' };
		if (p >= crit) return { cls: 'r', text: '偏高', dot: 'r' };
		if (p >= warn) return { cls: 'w', text: '需关注', dot: 'w' };
		return { cls: 'g', text: '正常', dot: 'g' };
	}

	/* Browser-side reachability probe, TWO targets with distinct meaning:
	 * - www.baidu.com  domestic path (direct egress); on failure a probe of
	 *   the IP-literal https://223.5.5.5 tells DNS trouble (IP ok, name
	 *   fails) from a dead exit (both fail).
	 * - www.google.com overseas path - through the router this exercises
	 *   the proxy chain (PassWall2), so "国内可达 · 海外不可达" reads as
	 *   "proxy not working" rather than "offline".
	 * A no-cors fetch resolves whenever ANY HTTP response arrives (status
	 * unreadable, but network-level success is what we need) and rejects
	 * on DNS/TCP/TLS failure. Both targets run in parallel; the KPI flips
	 * when the round settles. Failure only degrades (one browser is a
	 * single sample - a local proxy extension must not claim the router
	 * is down); a down LINE stays the hard red. */
	var probe = { pending: true, cn: null, intl: null };

	function fetchProbe(url, ms) {
		return new Promise(function(resolve) {
			var done = false;
			var ctl = (typeof AbortController == 'function') ? new AbortController() : null;
			var opt = { mode: 'no-cors', cache: 'no-store' };

			if (ctl)
				opt.signal = ctl.signal;

			var t = setTimeout(function() {
				if (!done) {
					done = true;
					try { if (ctl) ctl.abort(); } catch (e) {}
					resolve(false);
				}
			}, ms || 4000);

			try {
				fetch(url, opt).then(function() {
					if (!done) { done = true; clearTimeout(t); resolve(true); }
				}, function() {
					if (!done) { done = true; clearTimeout(t); resolve(false); }
				});
			}
			catch (e) {
				if (!done) { done = true; clearTimeout(t); resolve(false); }
			}
		});
	}

	var probeBusy = false;

	function internetProbe() {
		if (probeBusy)
			return;

		probeBusy = true;

		/* repaint from the last gathered data as soon as the round settles
		 * so the KPI flips within one probe cycle, not the next poll */
		function settle() {
			probe.pending = false;
			probeBusy = false;

			if (state.mounted && state.lastNorm)
				render(state.lastNorm);
		}

		var cnP = fetchProbe('https://www.baidu.com', 4500).then(function(ok) {
			if (ok) {
				probe.cn = true;
				return;
			}

			/* domain failed: is it DNS or the exit? IP-literal answers. */
			return fetchProbe('https://223.5.5.5', 4000).then(function(ipOk) {
				probe.cn = ipOk ? 'dns' : false;
			});
		});
		var intlP = fetchProbe('https://www.google.com', 5000).then(function(ok) {
			probe.intl = !!ok;
		});

		Promise.all([ cnP, intlP ]).then(settle, settle);
	}

	/* "互联网" KPI answers the user-level question: can traffic actually
	 * reach the internet right now. Line state alone (wan up + addressed)
	 * only proves the exit is READY - an upstream outage or a captive
	 * portal would still look green. So line state is combined with the
	 * dual live probe (internetProbe): cn (baidu, 'dns' = IP ok/domain
	 * fail, false = both failed) + intl (google). The VALUE reflects the
	 * whole picture (user decision):
	 *   cn ok + intl ok        已接通   green - both paths work
	 *   exactly one path ok    部分接通 amber - foot names the broken side
	 *                          (国内-only hints at the proxy chain, 海外-only
	 *                          at the domestic direct exit/DNS)
	 *   all probes fail        未接通   amber when the line is ready (one
	 *                          browser is a single sample - a local proxy
	 *                          extension must not claim the router down);
	 *                          DNS 异常 when only the IP-literal answers;
	 *                          不通 red ONLY when the line itself is down
	 *                          (hard ubus evidence).
	 * It deliberately does NOT repeat the per-line WAN details shown in
	 * the card below (that was the overlap the user called out); the sub
	 * line only names the path. */
	function inetKpi(d) {
		var up = !!d.inetUp;

		if (d.sideRouter && d.gateway == null)
			return kpiCard('互联网', stateValue('未配置', 'r'), '未配置上游网关', dot('r', true), '未配置上游', d.lanNet || null);

		var path;

		if (d.sideRouter) {
			path = '经主路由 ' + d.gateway;
		}
		else {
			/* name the exit actually carrying traffic */
			var via = null;

			if (up) {
				var up4 = d.wanList.filter(function(w) {
					var pr = String(w.proto || '').toLowerCase();
					var v6 = /^(dhcpv6|6in4|6to4|6rd|pppoe6|native6)$/.test(pr) || /6$/.test(String(w.interface || ''));

					return !v6 && w.up && w['ipv4-address'] && w['ipv4-address'].length;
				});
				var up6 = d.wanList.filter(function(w) {
					var pr = String(w.proto || '').toLowerCase();
					var v6 = /^(dhcpv6|6in4|6to4|6rd|pppoe6|native6)$/.test(pr) || /6$/.test(String(w.interface || ''));

					return v6 && w.up;
				});

				if (up4.length)
					via = up4[0].interface;
				else if (up6.length)
					via = up6[0].interface + ' (IPv6)';
			}

			path = via ? ('经 ' + via) : '无可用出口';
		}

		/* No line count here: "2 条线路" invites "what counts as a line?"
		 * (wan + wan6 read as two). Per-line detail belongs to the WAN card
		 * below; the KPI only names the carrying path. */
		var footRight = d.sideRouter ? (d.lanNet || null) : null;
		var v, cls, footTxt, footCls;

		if (probe.pending) {
			/* first round not settled: line semantics + 探测中 marker */
			v = up ? '已接通' : '不通';
			cls = up ? 'g' : 'r';
			footTxt = (up ? '出口链路正常' : '所有出口均不可用') + ' · 探测中';
			footCls = up ? 'g' : 'r';
		}
		else if (probe.cn === true && probe.intl !== false) {
			/* both ok (intl null cannot happen after settle, defensive) */
			v = '已接通';
			cls = 'g';
			footTxt = '国内 · 海外均可达';
			footCls = 'g';
		}
		else if (probe.cn === true && probe.intl === false) {
			/* domestic works, overseas dead: proxy chain suspect */
			v = '部分接通';
			cls = 'w';
			footTxt = '仅国内可达 · 海外不可达（代理未生效？）';
			footCls = 'w';
		}
		else if (probe.intl === true) {
			/* overseas ok but domestic direct broken: odd but real */
			v = '部分接通';
			cls = 'w';
			footTxt = (probe.cn === 'dns') ? '仅海外可达 · 国内 DNS 异常' : '仅海外可达 · 国内直连异常';
			footCls = 'w';
		}
		else {
			/* everything failed */
			if (probe.cn === 'dns') {
				v = 'DNS 异常';
				cls = 'w';
				footTxt = '线路就绪 · 域名解析失败';
				footCls = 'w';
			}
			else if (up) {
				v = '未接通';
				cls = 'w';
				footTxt = '线路就绪 · 探测均未通过';
				footCls = 'w';
			}
			else {
				v = '不通';
				cls = 'r';
				footTxt = '所有出口均不可用';
				footCls = 'r';
			}
		}

		return kpiCard('互联网', stateValue(v, cls), path, dot(footCls, true), footTxt, footRight);
	}

	function renderKpis(d) {
		var cards = [];

		/* CPU */
		var cpuTone = (d.cpuPct == null) ? 'm' : (d.cpuPct >= 90 ? 'r' : (d.cpuPct >= 70 ? 'w' : 'g'));
		cards.push(kpiCard(
			'CPU 使用率',
			numValue(d.cpuPct, '%'),
			d.loads.length ? ('负载 ' + d.loads.join(' / ') + (d.cores ? ' · ' + d.cores + ' 核' : '')) : null,
			dot(cpuTone, true),
			cpuTone == 'g' ? '负载正常' : (cpuTone == 'w' ? '负载偏高' : (cpuTone == 'r' ? '负载过高' : '无数据')),
			d.cores ? (d.cores + ' 核') : null,
			d.cpuPct, d.cpuPct >= 90 ? 'r' : (d.cpuPct >= 70 ? 'w' : 'g')
		));

		/* Memory - used%, i.e. memory pressure. available is what the kernel
		 * can actually hand out, so cached pages do not count as "used". */
		var mt = toneFor(d.memPct, d.hsCfg.warn, d.hsCfg.crit);
		cards.push(kpiCard(
			'内存',
			numValue(d.memPct, '%'),
			'可用 ' + fmtBytes(d.memAvail) + ' / ' + fmtBytes(d.memTotal),
			dot(mt.dot, true),
			mt.text,
			fmtBytes(d.memAvail),
			d.memPct, mt.cls
		));

		/* Internet reachability (see inetKpi): per-line WAN detail lives in
		 * the card below - no duplication here. */
		cards.push(inetKpi(d));

		/* Devices */
		var devSub = [ d.peerTotal + ' 台在线' ];
		if (d.upstream) devSub.push('1 台上游');
		if (d.lanPeers.length) devSub.push(d.lanPeers.length + ' 台已定位 IP');

		cards.push(kpiCard(
			'接入设备',
			numValue(d.peerTotal, '台'),
			devSub.join(' · '),
			dot('b', true),
			d.peerTotal ? '全部在线' : '暂无接入',
			d.leases.length ? (d.leases.length + ' 条 DHCP 租约') : '0 条 DHCP 租约'
		));

		/* Writable overlay */
		var ovPct = d.overlay ? d.overlay.use_pct : null;
		var ot = toneFor(ovPct, d.hsCfg.warn, d.hsCfg.crit);
		cards.push(kpiCard(
			'系统盘 /overlay',
			numValue(ovPct, '%'),
			d.overlay ? ('可用 ' + fmtBytes(d.overlay.bytes_avail) + ' / ' + fmtBytes(d.overlay.bytes_total)) : '—',
			dot(ovPct == null ? 'm' : (ot.dot == 'g' ? 'b' : ot.dot), true),
			ovPct == null ? '无数据' : (ot.cls == 'g' ? '空间充足' : ot.text),
			d.overlay ? ('可用 ' + fmtBytes(d.overlay.bytes_avail)) : null,
			ovPct, ot.cls
		));

		return E('div', { 'class': 'ngov-kpis' }, cards);
	}

	function renderDevices(d) {
		var body = E('div', { 'class': 'ngov-card-b' });

		/* ---- per-network group headers: each routed client network gets a
		 * section line; a bridge shows as ONE group annotated with its
		 * member ports ("网桥 · eth0+eth1"). Unassigned ports follow. ---- */
		function groupLine(g) {
			var right = [];

			if (g.isBridge && g.ports.length)
				right.push('网桥 · ' + g.ports.join('+'));
			else if (g.ports.length == 1)
				right.push(g.ports[0]);
			else if (g.ports.length > 1)
				right.push(g.ports.join(' · '));

			if (g.ports.length)
				right.push(g.portUp + '/' + g.ports.length + ' 口在线');

			return E('div', { 'class': 'ngov-net-h' }, [
				E('span', { 'class': 'ngov-net-name' }, [
					dot(g.up ? 'g' : 'r', true),
					g.name.toUpperCase()
				]),
				E('span', { 'class': 'ngov-net-meta' }, [
					g.net || (g.up ? '无 IPv4' : '接口未运行'),
					right.length ? ' · ' + right.join(' · ') : ''
				])
			]);
		}

		body.appendChild(E('div', { 'class': 'ngov-nettop' }, [
			mini('网络数', String(d.lanGroups.length)),
			mini('活动连接数', d.ct ? (d.ct.count + (d.ct.max ? ' / ' + d.ct.max : '')) : '—'),
			mini('DHCP 租约', String(d.leases.length)),
			d.hasWifi ? mini('WiFi', d.wifiClients > 0 ? (d.wifiClients + ' 个客户端') : '空闲') : null
		].filter(function(x) { return x != null; })));

		if (d.sparePorts.length)
			body.appendChild(E('div', { 'class': 'ngov-net-h' }, [
				E('span', { 'class': 'ngov-net-name' }, [ '未划入网络' ]),
				E('span', { 'class': 'ngov-net-meta' }, [
					d.sparePorts.map(function(p) {
						return p.name + (p.carrier ? '（已插线）' : '');
					}).join(' · ')
				])
			]));
		/* ---- group headers live INSIDE the table (see tbody IIFE below);
		 * this space intentionally left between the nettop minis and it ---- */

		var all = [];
		var up = d.upstream;

		if (up)
			all.push({ kind: 'upstream', p: up });

		for (var i = 0; i < d.lanPeers.length; i++)
			all.push({ kind: 'lan', p: d.lanPeers[i] });

		for (var j = 0; j < d.otherPeers.length; j++)
			all.push({ kind: 'other', p: d.otherPeers[j] });

		for (var m = 0; m < d.llPeers.length; m++)
			all.push({ kind: 'll', p: d.llPeers[m] });

		/* Cap the visible rows: an ARP table with 20 entries made this card
		 * tower over the WAN card beside it. Hidden rows stay reachable via
		 * the toggle. */
		var LIMIT = 7;
		var hidden = Math.max(0, all.length - LIMIT);
		var shown = all.slice(0, LIMIT);

		function rowFor(entry) {
			var p = entry.p;

			if (entry.kind == 'upstream') {
				return E('tr', {}, [
					E('td', {}, [ E('div', { 'class': 'ngov-dev' }, [
						E('span', { 'class': 'ngov-avatar' }, [ 'GW' ]),
						E('div', {}, [
							E('b', {}, [ p.hostname || '上游网关' ]),
							E('em', {}, [ p.mac ])
						])
					]) ]),
					E('td', {}, [ E('span', { 'class': 'ngov-mono' }, [ d.gateway || p.ip || '—' ]) ]),
					E('td', {}, [ pill('b', 'WAN 上游') ]),
					E('td', {}, [ pill('g', '在线') ])
				]);
			}

			if (entry.kind == 'lan') {
				return E('tr', {}, [
					E('td', {}, [ E('div', { 'class': 'ngov-dev' }, [
						E('span', { 'class': 'ngov-avatar' }, [ thumb(p.hostname, p.mac) ]),
						E('div', {}, [
							E('b', {}, [ p.hostname || '未知设备' ]),
							E('em', {}, [ p.mac ])
						])
					]) ]),
					E('td', {}, [ E('span', { 'class': 'ngov-mono' }, [ p.ip || '—' ]) ]),
					E('td', {}, [ pill(p.source == 'dhcp' ? 'b' : '', p.source == 'dhcp' ? 'DHCP 租约' : '静态 / ARP') ]),
					E('td', {}, [ pill('g', '在线') ])
				]);
			}

			if (entry.kind == 'other') {
				return E('tr', {}, [
					E('td', {}, [ E('div', { 'class': 'ngov-dev' }, [
						E('span', { 'class': 'ngov-avatar' }, [ thumb(p.hostname, p.mac) ]),
						E('div', {}, [
							E('b', {}, [ p.hostname || '未知设备' ]),
							E('em', {}, [ p.mac ])
						])
					]) ]),
					E('td', {}, [ E('span', { 'class': 'ngov-mono' }, [ p.ip || '仅链路本地' ]) ]),
					E('td', {}, [ pill('', p.ip ? '邻居表' : '仅 IPv6') ]),
					E('td', {}, [ pill('g', '在线') ])
				]);
			}

			/* A neighbour with only a link-local IPv6 address is alive but
			 * cannot be placed in a subnet - say so rather than invent one. */
			return E('tr', {}, [
				E('td', {}, [ E('div', { 'class': 'ngov-dev' }, [
					E('span', { 'class': 'ngov-avatar' }, [ thumb(p.hostname, p.mac) ]),
					E('div', {}, [
						E('b', {}, [ '未知设备' ]),
						E('em', {}, [ p.mac ])
					])
				]) ]),
				E('td', {}, [ E('span', { 'class': 'ngov-mono' }, [ '仅链路本地' ]) ]),
				E('td', {}, [ pill('', 'IPv6 邻居') ]),
				E('td', {}, [ pill('g', '在线') ])
			]);
		}

		/* assemble: one grouped section per LAN network, then cross-subnet
		 * leftovers, then the table rows under their group headers */
		var table = E('table', {}, [
			E('thead', {}, E('tr', {}, [
				E('th', { 'style': 'width:38%' }, [ '设备' ]),
				E('th', {}, [ 'IP 地址' ]),
				E('th', {}, [ '接入方式' ]),
				E('th', {}, [ '状态' ])
			])),
			E('tbody', {}, (function() {
				var rows = [];
				var placed = {};
				var counts = {};

				function countIn(g) {
					var n = 0;

					for (var zi = 0; zi < all.length; zi++) {
						var pz = all[zi].p;

						if (all[zi].kind == 'upstream' || pz.ip == null)
							continue;

						if (g.net && inNet(pz.ip, g.ip, g.mask))
							n++;
					}

					return n;
				}

				/* header + rows for every routed group, in interface order */
				for (var gi2 = 0; gi2 < d.lanGroups.length; gi2++) {
					var g = d.lanGroups[gi2];
					var inG = [];

					for (var zi2 = 0; zi2 < all.length; zi2++) {
						var pz2 = all[zi2].p;

						if (all[zi2].kind == 'upstream')
							continue;

						if (pz2.ip != null && g.net && inNet(pz2.ip, g.ip, g.mask)) {
							inG.push(all[zi2]);
							placed[zi2] = true;
						}
					}

					rows.push(E('tr', {}, E('td', { 'colspan': 4, 'class': 'ngov-netrow' }, [ groupLine(g) ])));
					counts[g.name] = inG.length;

					for (var ri = 0; ri < inG.length; ri++)
						rows.push(rowFor(inG[ri]));
				}

				/* anything not matched to a routed group */
				var rest = [];

				for (var zi3 = 0; zi3 < all.length; zi3++)
					if (!placed[zi3])
						rest.push(all[zi3]);

				if (rest.length && d.lanGroups.length)
					rows.push(E('tr', {}, E('td', { 'colspan': 4, 'class': 'ngov-netrow' }, [
						E('div', { 'class': 'ngov-net-h' }, [
							E('span', { 'class': 'ngov-net-name' }, [ '其他 / 未分类' ]),
							E('span', { 'class': 'ngov-net-meta' }, [ rest.length + ' 台' ])
						])
					])));

				for (var ri2 = 0; ri2 < rest.length; ri2++)
					rows.push(rowFor(rest[ri2]));

				return rows;
			})())
		]);

		/* group headers carry no device rows when empty - still show the
		 * count so an empty guest net does not look broken */
		if (!all.length)
			body.appendChild(E('div', { 'class': 'ngov-empty' }, [ '未发现接入设备。' ]));

		body.appendChild(table);

		/* Expand toggle re-renders the FULL grouped list in place (and back).
		 * The initial render shows the first LIMIT device rows + their
		 * group headers; expand reveals everything. */
		if (hidden > 0) {
			var more = E('a', { 'class': 'ngov-link', 'href': '#' }, [ '展开其余 ' + hidden + ' 台 ▾' ]);

			more.addEventListener('click', function(ev) {
				ev.preventDefault();

				var tbody = table.querySelector('tbody');

				clear(tbody);

				var open = more.getAttribute('data-open') == '1';

				function fullRows() {
					var rows2 = [];
					var placed2 = {};

					for (var gi3 = 0; gi3 < d.lanGroups.length; gi3++) {
						var g2 = d.lanGroups[gi3];
						var inG2 = [];

						for (var zi4 = 0; zi4 < all.length; zi4++) {
							var pz3 = all[zi4].p;

							if (all[zi4].kind == 'upstream')
								continue;

							if (pz3.ip != null && g2.net && inNet(pz3.ip, g2.ip, g2.mask)) {
								inG2.push(all[zi4]);
								placed2[zi4] = true;
							}
						}

						rows2.push(E('tr', {}, E('td', { 'colspan': 4, 'class': 'ngov-netrow' }, [ groupLine(g2) ])));

						for (var ri3 = 0; ri3 < inG2.length; ri3++)
							rows2.push(rowFor(inG2[ri3]));
					}

					var rest2 = [];

					for (var zi5 = 0; zi5 < all.length; zi5++)
						if (!placed2[zi5])
							rest2.push(all[zi5]);

					if (rest2.length && d.lanGroups.length)
						rows2.push(E('tr', {}, E('td', { 'colspan': 4, 'class': 'ngov-netrow' }, [
							E('div', { 'class': 'ngov-net-h' }, [
								E('span', { 'class': 'ngov-net-name' }, [ '其他 / 未分类' ]),
								E('span', { 'class': 'ngov-net-meta' }, [ rest2.length + ' 台' ])
							])
						])));

					for (var ri4 = 0; ri4 < rest2.length; ri4++)
						rows2.push(rowFor(rest2[ri4]));

					return rows2;
				}

				if (open) {
					/* collapse back to the first LIMIT device rows, keeping
					 * group headers of whichever sections own them */
					var kept = [];
					var count = 0;
					var placed3 = {};

					for (var gi4 = 0; gi4 < d.lanGroups.length && count < LIMIT; gi4++) {
						var g3 = d.lanGroups[gi4];
						var inG3 = [];

						for (var zi6 = 0; zi6 < all.length; zi6++) {
							var pz4 = all[zi6].p;

							if (all[zi6].kind == 'upstream')
								continue;

							if (pz4.ip != null && g3.net && inNet(pz4.ip, g3.ip, g3.mask)) {
								inG3.push(all[zi6]);
								placed3[zi6] = true;
							}
						}

						if (inG3.length && count < LIMIT) {
							kept.push(E('tr', {}, E('td', { 'colspan': 4, 'class': 'ngov-netrow' }, [ groupLine(g3) ])));

							for (var ri5 = 0; ri5 < inG3.length && count < LIMIT; ri5++) {
								kept.push(rowFor(inG3[ri5]));
								count++;
							}
						}
					}

					var rest3 = [];

					for (var zi7 = 0; zi7 < all.length; zi7++)
						if (!placed3[zi7])
							rest3.push(all[zi7]);

					for (var ri6 = 0; count < LIMIT && ri6 < rest3.length; ri6++) {
						kept.push(rowFor(rest3[ri6]));
						count++;
					}

					for (var ki = 0; ki < kept.length; ki++)
						tbody.appendChild(kept[ki]);

					more.textContent = '展开其余 ' + hidden + ' 台 ▾';
					more.setAttribute('data-open', '0');
				}
				else {
					var rowsAll = fullRows();

					for (var fa = 0; fa < rowsAll.length; fa++)
						tbody.appendChild(rowsAll[fa]);

					more.textContent = '收起 ▴';
					more.setAttribute('data-open', '1');
				}
			});

			body.appendChild(E('div', { 'class': 'ngov-dfoot' }, [ more ]));
		}

		/* Never imply lease data we do not have. */
		if (!d.leases.length) {
			body.appendChild(E('div', { 'class': 'ngov-dfoot' }, [
				'暂无 DHCP 租约；上表来自邻居表（ARP）与接口地址。'
			]));
		}

		var actions = [
			E('a', { 'class': 'ngov-link', 'href': L.env.scriptname + '/admin/network/dhcp' }, [ 'DHCP 租约 →' ])
		];

		return card('LAN 接入设备', String(d.peerTotal) + ' 台', actions, body);
	}

	/* Side-router variant of the WAN card: no WAN interface exists, so the
	 * honest content is the default route through the main router. */
	function renderUpstream(d) {
		var body = E('div', { 'class': 'ngov-card-b', 'style': 'display:flex;flex-direction:column;gap:10px' });

		body.appendChild(E('div', { 'style': 'display:flex;align-items:center;gap:10px' }, [
			dot(d.gwAlive ? 'g' : 'r'),
			E('div', {}, [
				E('b', { 'style': 'font-weight:500' }, [
					d.gateway == null ? '未配置上游' : (d.gwAlive ? '上游网关可达' : '上游网关无响应')
				]),
				E('div', { 'style': 'color:var(--ngov-fg3);font-size:.72rem' }, [
					d.gateway == null
						? '旁路由模式：未找到默认路由，请在 LAN 口配置网关'
						: '旁路由模式：默认路由经主路由 ' + d.gateway
				])
			])
		]));

		var rows = [
			[ '模式', '旁路由（无 WAN 口）', false ],
			[ 'LAN 地址', d.lanIp ? (d.lanIp + (d.lanMask ? '/' + d.lanMask : '')) : '—', true ],
			[ '默认网关', d.gateway || '—', true ],
			[ '网关 ARP', d.gateway == null ? '—' : (d.gwAlive ? '有应答' : '无应答'), false ],
			[ 'LAN 设备', d.lan ? (d.lan.device || d.lan.l3_device || '—') : '—', true ],
			[ '本机 uptime', d.uptime != null ? fmtUptime(d.uptime) : '—', false ]
		];

		body.appendChild(E('table', {}, E('tbody', {}, rows.map(function(r) {
			return E('tr', {}, [
				E('td', { 'style': 'color:var(--ngov-fg3);width:42%' }, [ r[0] ]),
				E('td', { 'class': r[2] ? 'ngov-mono' : '' }, [ r[1] ])
			]);
		}))));

		return card('上游网关', null, [
			E('a', { 'class': 'ngov-link', 'href': L.env.scriptname + '/admin/network/network' }, [ '网络设置 →' ])
		], body);
	}

	function renderWan(d) {
		var body = E('div', { 'class': 'ngov-card-b', 'style': 'display:flex;flex-direction:column;gap:10px' });

		var dns = (d.wan && Array.isArray(d.wan['dns-server'])) ? d.wan['dns-server'].join(', ') : null;
		var lease = (d.wan && d.wan.data && d.wan.data.leasetime) ? intOf(d.wan.data.leasetime) : null;
		var expires = (d.wan && d.wan.uptime != null && lease != null) ? Math.max(0, lease - d.wan.uptime) : null;

		/* One line per uplink. Single-WAN boxes render exactly one row, so the
		 * default view is unchanged; with mwan3 each line gets its own state
		 * pill instead of one aggregate.
		 * wan6-style dhcpv6/6in4/6to4 companions ride on the SAME physical
		 * line as their IPv4 sibling (device + proto give it away) and carry
		 * no independent failover, so they are folded into a suffix instead
		 * of a "disconnected" red row that reads as a second dead line. */
		var v6Only = d.wanList.filter(function(w) {
			var pr = String(w.proto || '').toLowerCase();

			return /^(dhcpv6|6in4|6to4|6rd|pppoe6|native6)$/.test(pr) || /6$/.test(String(w.interface || ''));
		});
		var v4Rows = d.wanList.filter(function(w) { return v6Only.indexOf(w) < 0; });
		var anyV4Up = v4Rows.some(function(w) {
			return !!(w.up && w['ipv4-address'] && w['ipv4-address'].length);
		});

		var uplinks = v4Rows.map(function(w) {
			var wIp = (w['ipv4-address'] && w['ipv4-address'][0]) ? w['ipv4-address'][0].address : null;
			var up = !!(w.up && wIp);

			return E('div', { 'class': 'ngov-conn' }, [
				E('span', { 'class': 'ngov-conn-l' }, [ w.interface ]),
				E('span', { 'class': 'ngov-conn-s' }, [ dot(up ? 'g' : 'r', true), up ? '已连通' : '未连通' ]),
				E('span', { 'class': 'ngov-conn-d ngov-mono' }, [
					[ w.l3_device || w.device, wIp ].filter(function(x) { return x != null && x !== ''; }).join(' · ') || '—'
				])
			]);
		});

		if (v6Only.length) {
			var v6Up = v6Only.some(function(w) { return !!w.up; });

			uplinks.push(E('div', { 'class': 'ngov-conn' }, [
				E('span', { 'class': 'ngov-conn-l' }, [ 'IPv6' ]),
				E('span', { 'class': 'ngov-conn-s' }, [
					dot(v6Up ? 'g' : (anyV4Up ? 'm' : 'r'), true),
					v6Up ? '已连通' : (anyV4Up ? '未启用' : '未连通')
				]),
				E('span', { 'class': 'ngov-conn-d ngov-mono' }, [
					v6Only.map(function(w) { return w.l3_device || w.device; })
						.filter(function(x, i, a) { return x && a.indexOf(x) === i; }).join(' · ') || '—'
				])
			]));
		}

		body.appendChild(E('div', { 'class': 'ngov-conns' }, uplinks));

		var rows = [
			[ '接入方式', d.wan ? String(d.wan.proto || '').toUpperCase() + ' 客户端' : '—', false ],
			[ 'IPv4 地址', d.wanIp ? (d.wanIp + (d.wan['ipv4-address'][0].mask ? '/' + d.wan['ipv4-address'][0].mask : '')) : '—', true ],
			[ '网关', d.gateway || '—', true ],
			[ 'DNS', dns || '—', true ],
			[ '设备', d.wan ? (d.wan.l3_device || d.wan.device) : '—', true ],
			[ '链路速率', d.speed || '—', false ],
			[ '上游主机名', (d.wan && d.wan.data && d.wan.data.hostname) || '—', false ],
			[ '已连接', d.wan && d.wan.uptime != null ? fmtUptime(d.wan.uptime) : '—', false ],
			[ '租约剩余', expires != null ? fmtUptime(expires) : '—', false ]
		];

		body.appendChild(E('div', { 'style': 'display:flex;align-items:center;gap:10px' }, [
			dot(d.wanUp ? 'g' : 'r'),
			E('div', {}, [
				E('b', { 'style': 'font-weight:500' }, [ d.wanUp ? '链路已连通' : '链路未连通' ]),
				E('div', { 'style': 'color:var(--ngov-fg3);font-size:.72rem' }, [
					d.wanUp ? 'WAN 已获取地址，默认路由可用' : 'WAN 未获取到 IPv4 地址'
				])
			])
		]));

		body.appendChild(E('table', {}, E('tbody', {}, rows.map(function(r) {
			return E('tr', {}, [
				E('td', { 'style': 'color:var(--ngov-fg3);width:42%' }, [ r[0] ]),
				E('td', { 'class': r[2] ? 'ngov-mono' : '' }, [ r[1] ])
			]);
		}))));

		return card('WAN 出口', d.wanList.length > 1 ? (d.wanList.length + ' 条线路') : null, [
			E('a', { 'class': 'ngov-link', 'href': L.env.scriptname + '/admin/network/network' }, [ '详情 →' ])
		], body);
	}

	function renderApps(d) {
		var body = E('div', { 'class': 'ngov-card-b' });
		var grid = E('div', { 'class': 'ngov-apps' });

		if (!d.apps.length) {
			grid.appendChild(E('div', { 'class': 'ngov-empty' }, [ '未配置受监视的关键应用。' ]));
		}

		for (var i = 0; i < d.apps.length; i++) {
			(function(app) {
				var cls, dotCls, sub;

				if (app.state == 'running') {
					cls = 'on'; dotCls = 'g';
					sub = (app.detail || '运行中') + (app.autostart ? ' · 开机启动' : '');
				}
				else if (app.state == 'disabled') {
					/* enabled=0 is a deliberate configuration, not a failure. */
					cls = 'dis'; dotCls = 'm';
					sub = '主开关已关闭' + (app.autostart ? ' · 开机启动' : '');
				}
				else if (app.state == 'stopped') {
					cls = 'off'; dotCls = 'r';
					sub = '未运行' + (app.autostart ? ' · 开机启动' : '');
				}
				else {
					cls = 'maybe'; dotCls = 'w';
					sub = app.detail || '状态未知';
				}

				var btn = E('button', {
					'class': 'ngov-iconbtn',
					'title': app.restartable ? '重启 ' + app.label : '该服务无 init 脚本',
					'disabled': app.restartable ? null : 'disabled'
				}, [ '\u21bb' ]);

				if (app.restartable) {
					btn.addEventListener('click', function() {
						if (btn.disabled)
							return;

						btn.disabled = true;
						btn.textContent = '\u22ef';

						L.resolveDefault(api.hsRestart({ id: app.id }), null).then(function(r) {
							btn.disabled = false;
							btn.textContent = '\u21bb';

							if (r == null || r.ok !== true) {
								window.alert('重启 ' + app.label + ' 失败：' +
									((r && (r.message || r.error)) || '未知错误'));
								return;
							}

							refresh();
							window.setTimeout(refresh, 2000);
						});
					});
				}

				grid.appendChild(E('div', { 'class': 'ngov-app ' + cls }, [
					dot(dotCls, true),
					E('div', { 'class': 'ngov-app-info' }, [
						E('b', {}, [ app.label || app.id ]),
						E('em', {}, [ sub ])
					]),
					btn
				]));
			})(d.apps[i]);
		}

		body.appendChild(grid);

		if (d.counts.disabled)
			body.appendChild(E('div', { 'class': 'ngov-app-note' }, [
				'「已禁用」表示应用自身的主开关处于关闭状态，属于正常配置，不代表进程异常。'
			]));

		var cnt = d.counts.total
			? (d.counts.total + ' 项 · ' + d.counts.running + ' 运行'
				+ (d.counts.stopped ? ' / ' + d.counts.stopped + ' 停止' : '')
				+ (d.counts.disabled ? ' / ' + d.counts.disabled + ' 禁用' : ''))
			: '0 项';

		return card('关键应用', cnt, [
			/* homestatus registers its own page under admin/system/ (menu.d) */
			E('a', { 'class': 'ngov-link', 'href': L.env.scriptname + '/admin/system/homestatus' }, [ '定制驾驶舱 →' ])
		], body);
	}

	function renderWol(d) {
		var body = E('div', { 'class': 'ngov-card-b' });
		var grid = E('div', { 'class': 'ngov-wol' });

		if (d.wolErr != null) {
			/* Distinct from "no targets": the config exists but could not be
			 * read. Saying "未配置" here would be a lie. */
			grid.appendChild(E('div', { 'class': 'ngov-empty' }, [
				'唤醒目标读取失败：' + d.wolErr
			]));
		}
		else if (!d.wolOk) {
			grid.appendChild(E('div', { 'class': 'ngov-empty' }, [
				'后端不可用：请确认 luci-app-homestatus 已安装且 etherwake 存在。'
			]));
		}
		else if (!d.wol.length) {
			grid.appendChild(E('div', { 'class': 'ngov-empty' }, [
				'未配置唤醒目标。在「定制驾驶舱」中添加名称与 MAC 地址。'
			]));
		}

		for (var i = 0; i < d.wol.length; i++) {
			(function(t) {
				var online = (t.online === true);
				var bad = (t.mac == null);

				var btn = E('button', {
					'class': 'ngov-wolbtn',
					'title': bad ? '此条目的 MAC 无效' : ('唤醒 ' + t.name),
					'disabled': bad ? 'disabled' : null
				}, [ '\u23fb' ]);

				if (!bad) {
					btn.addEventListener('click', function() {
						if (btn.disabled)
							return;

						btn.disabled = true;
						btn.textContent = '\u22ef';

						L.resolveDefault(api.hsWake({ id: t.id }), null).then(function(r) {
							btn.textContent = (r != null && r.ok === true) ? '\u2713' : '\u2717';

							if (r == null || r.ok !== true) {
								window.alert('唤醒 ' + t.name + ' 失败：' +
									((r && (r.message || r.error)) || '未知错误'));
							}

							/* repaint so the presence dot reflects the machine
							 * coming up on the next neighbour-table refresh */
							window.setTimeout(function() {
								btn.textContent = '\u23fb';
								btn.disabled = false;
								refresh();
							}, 1500);
						});
					});
				}

				grid.appendChild(E('div', { 'class': 'ngov-wolrow' }, [
					dot(online ? 'g' : '', true),
					E('div', { 'class': 'ngov-wol-info' }, [
						E('b', {}, [ t.name || t.mac || '—' ]),
						E('em', {}, [
							(t.mac || '—') + (t.ip ? (' · ' + t.ip) : '')
						])
					]),
					btn
				]));
			})(d.wol[i]);
		}

		body.appendChild(grid);

		if (d.wol.length)
			body.appendChild(E('div', { 'class': 'ngov-app-note' }, [
				'圆点表示该 MAC 目前是否出现在邻居表中。唤醒包只能唤回已开启 WOL 且网卡已通电的主机。'
			]));

		var up = 0;

		for (var k = 0; k < d.wol.length; k++)
			if (d.wol[k].online === true)
				up++;

		var cnt = d.wol.length
			? (d.wol.length + ' 台' + (up ? ' · ' + up + ' 在线' : ''))
			: '0 台';

		return card('网络唤醒', cnt, [
			E('a', { 'class': 'ngov-link', 'href': L.env.scriptname + '/admin/system/homestatus' }, [ '定制驾驶舱 →' ])
		], body);
	}

	function renderStorage(d) {
		var body = E('div', { 'class': 'ngov-card-b' });
		var list = E('div', { 'class': 'ngov-disk' });

		var rows = d.diskRows;

		for (var i = 0; i < rows.length; i++) {
			var r = rows[i];

			var sub = r.alias || [ r.dev, r.fstype ].filter(function(x) { return x; }).join(' · ');

			var track, pctCell, availCell;

			if (r.readonly) {
				/* squashfs is 100% full by construction - a saturated bar here
				 * would raise a false alarm on every page load. */
				track = E('div', { 'class': 'ngov-track ro' });
				pctCell = E('div', { 'class': 'pct' }, [ pill('', '只读') ]);
				availCell = E('div', { 'class': 'av' }, [ '固件镜像' ]);
			}
			else {
				var p = r.use_pct;
				var cls = (p == null) ? '' : (p >= d.hsCfg.crit ? 'r' : (p >= d.hsCfg.warn ? 'w' : ''));

				track = E('div', { 'class': 'ngov-track' }, p == null ? [] : [
					E('i', { 'class': cls, 'style': 'width:' + Math.max(2, Math.min(100, p)) + '%' })
				]);
				pctCell = E('div', { 'class': 'pct' }, [ p == null ? '—' : (p + '%') ]);
				availCell = E('div', { 'class': 'av' }, [
					r.bytes_avail == null ? '—' : ('可用 ' + fmtBytes(r.bytes_avail))
				]);
			}

			list.appendChild(E('div', { 'class': 'ngov-drow', 'style': r.readonly ? 'opacity:.72' : null }, [
				E('div', { 'class': 'mp' }, [
					r.target,
					sub ? E('em', {}, [ sub ]) : null
				]),
				track,
				pctCell,
				availCell
			]));
		}

		if (!rows.length)
			list.appendChild(E('div', { 'class': 'ngov-empty' }, [ '未发现挂载点。' ]));

		body.appendChild(list);

		/* footer: what is not on the bar - unmounted partitions, disk totals */
		var disks = (d.hs && Array.isArray(d.hs.disks)) ? d.hs.disks : [];
		var bits = [];
		var unmounted = [];
		var totalBytes = 0;

		for (var di = 0; di < disks.length; di++) {
			var dk = disks[di];
			if (dk == null || dk.error != null)
				continue;

			if (dk.bytes)
				totalBytes += dk.bytes;

			for (var pi = 0; pi < (dk.partitions || []).length; pi++) {
				var pt = dk.partitions[pi];
				if (pt.unmounted && !(pt.volumes || []).length)
					unmounted.push(pt.name + '（' + fmtBytes(pt.bytes) + '）');
			}
		}

		if (unmounted.length)
			bits.push('未挂载分区 ' + unmounted.join('、'));

		if (totalBytes)
			bits.push('磁盘总容量 ' + fmtBytes(totalBytes));

		if (bits.length)
			body.appendChild(E('div', { 'class': 'ngov-dfoot' }, [ bits.join(' · ') ]));

		var nMounts = rows.length;
		var nVol = 0;

		for (var vi = 0; vi < disks.length; vi++)
			for (var pj = 0; pj < ((disks[vi] || {}).partitions || []).length; pj++)
				nVol += ((disks[vi].partitions[pj] || {}).volumes || []).length;

		/* luci-app-diskman is optional: link only when its page exists in
		 * the live menu tree (soft() failure => {} => link hidden) */
		var hasDiskman = !!(state.menuTree && state.menuTree['admin/system/diskman']);
		var acts = hasDiskman
			? [ E('a', { 'class': 'ngov-link', 'href': L.env.scriptname + '/admin/system/diskman' }, [ '完整视图 →' ]) ]
			: [];

		return card('存储', disks.length + ' 块磁盘 · ' + nMounts + ' 个挂载点' + (nVol ? ' · ' + nVol + ' 个数据卷' : ''),
			acts,
			body);
	}

	/* ------------------------------------------------- drawer + mount ------- */

	/* The original LuCI sections stay in the DOM untouched; they simply move
	 * into one collapsed drawer so the page still answers "everything else"
	 * without competing with the summary. */
	function makeDrawer() {
		var body = E('div', { 'class': 'ngov-rest-body' });
		var det = E('details', { 'class': 'ngov-rest' }, [
			E('summary', {}, [
				'经典信息视图',
				E('span', { 'class': 'hint' }, [ '型号 / 固件 / 网络 / 内存' ])
			]),
			body
		]);

		return { det: det, body: body };
	}

	function collectExisting(viewEl) {
		var nodes = [];
		var kids = Array.prototype.slice.call(viewEl.children);

		for (var i = 0; i < kids.length; i++) {
			var n = kids[i];

			/* leave any placeholder/heading behind; move real content */
			if (/^(H2|H3|SCRIPT)$/.test(n.tagName))
				continue;

			if (n.classList && n.classList.contains('spinning'))
				continue;

			/* A section switched off via the display toggles renders an
			 * empty placeholder in place of its content. The stock markup
			 * nests it as
			 *   .col-12 > .card > .cbi-section > .cbi-title + div > .hs-block-off
			 * so matching the placeholder alone is not enough - the
			 * wrapper must be dropped too, or the drawer keeps a card
			 * with a heading and nothing under it.
			 *
			 * Decide on a clone: strip the title (which carries the
			 * heading and its Hide toggle) and the placeholder itself,
			 * then look at what is left. Nothing but empty divs means
			 * there is no content and the wrapper goes. */
			if (n.querySelector && n.querySelector('.hs-block-off')) {
				var probe = n.cloneNode(true);
				var pt = probe.querySelector('.cbi-title');
				if (pt)
					pt.parentNode.removeChild(pt);
				var po = probe.querySelector('.hs-block-off');
				if (po)
					po.parentNode.removeChild(po);

				if (!probe.textContent.trim() && !probe.querySelector('table'))
					continue;
			}

			nodes.push(n);
		}

		var inc = document.querySelector('div.includes');
		if (inc && inc !== viewEl && !viewEl.contains(inc))
			nodes.push(inc);

		return nodes;
	}

	/* A section that was moved into the drawer before it finished rendering
	 * can still produce a titlted-but-empty card afterwards: the stock
	 * include renders asynchronously, so at mount time the container may be
	 * empty and only later receive the "switched off" placeholder. Sweep the
	 * drawer whenever its contents change and drop any child left with
	 * nothing but a heading. */
	function pruneDrawer(body) {
		var kids = Array.prototype.slice.call(body.children);

		for (var i = 0; i < kids.length; i++) {
			var n = kids[i];

			if (!n.querySelector || !n.querySelector('.hs-block-off'))
				continue;

			var probe = n.cloneNode(true);
			var pt = probe.querySelector('.cbi-title');
			if (pt)
				pt.parentNode.removeChild(pt);
			var po = probe.querySelector('.hs-block-off');
			if (po)
				po.parentNode.removeChild(po);

			if (!probe.textContent.trim() && !probe.querySelector('table'))
				n.parentNode.removeChild(n);
		}

		return body.children.length;
	}

	function watchDrawer(body) {
		if (typeof MutationObserver == 'undefined')
			return;

		var timer = null;

		new MutationObserver(function() {
			if (timer)
				window.clearTimeout(timer);

			/* debounce: the poll replaces several nodes in one tick */
			timer = window.setTimeout(function() {
				timer = null;
				pruneDrawer(body);
			}, 400);
		}).observe(body, { childList: true, subtree: true });

		pruneDrawer(body);
	}

	function mount() {
		if (state.mounted)
			return true;

		var viewEl = document.getElementById('view');
		if (!viewEl)
			return false;

		var kids = Array.prototype.slice.call(viewEl.children);
		var hasSection = viewEl.querySelector('.cbi-section, .cbi-title, table') != null;

		if (!kids.length || !hasSection)
			return false;

		var root = E('div', { 'class': 'ngov' });

		state.slots.hero = E('div');
		state.slots.kpis = E('div');
		state.slots.cols = E('div', { 'class': 'ngov-cols' });
		state.slots.apps = E('div');
		state.slots.wol = E('div');
		state.slots.storage = E('div');

		root.appendChild(state.slots.hero);
		root.appendChild(state.slots.kpis);
		root.appendChild(state.slots.cols);
		root.appendChild(state.slots.apps);
		root.appendChild(state.slots.wol);
		root.appendChild(state.slots.storage);

		var drawer = makeDrawer();
		root.appendChild(drawer.det);

		/* Insert above the untouched stock sections, but outside #view so the
		 * theme's MutationObserver never re-wraps our markup. */
		viewEl.parentNode.insertBefore(root, viewEl);

		/* Move the stock sections into the drawer. Their own poll keeps
		 * updating them in place, so nothing is lost by relocating them. */
		var existing = collectExisting(viewEl);

		for (var i = 0; i < existing.length; i++) {
			/* section wrappers are styled as standalone cards; inside the
			 * drawer they should read as grouped rows instead */
			drawer.body.appendChild(existing[i]);
		}

		if (!drawer.body.children.length)
			drawer.det.style.display = 'none';

		/* the stock includes render on their own schedule - keep sweeping */
		watchDrawer(drawer.body);

		state.root = root;
		state.mounted = true;

		return true;
	}

	function render(d) {
		clear(state.slots.hero);
		state.slots.hero.appendChild(renderHero(d));

		clear(state.slots.kpis);
		state.slots.kpis.appendChild(renderKpis(d));

		clear(state.slots.cols);
		/* WAN/upstream LEFT, devices RIGHT (user layout decision) */
		state.slots.cols.appendChild(d.sideRouter ? renderUpstream(d) : renderWan(d));
		state.slots.cols.appendChild(renderDevices(d));

		/* Equal heights: cap the devices card at the WAN/upstream card's
		 * height and let its table scroll internally. The neighbor card in
		 * the same grid row is the natural cap - a fixed max-height would
		 * ignore text scaling. Below the 1100px breakpoint the cards stack,
		 * and a height cap there would just waste space. */
		var cards = state.slots.cols.querySelectorAll(':scope > .ngov-card');
		var ref = cards[0], dev = cards[1];
		var table = dev ? dev.querySelector('table') : null;

		if (ref && dev && table && window.innerWidth > 1100) {
			var refH = ref.getBoundingClientRect().height;
			/* fixed chrome of the devices card = everything except the
			 * table itself, measured as a box difference so paddings and
			 * margins are all included */
			var reserved = dev.getBoundingClientRect().height
				- table.getBoundingClientRect().height;

			if (reserved >= 0) {
				var wrap = document.createElement('div');

				wrap.className = 'ngov-devscroll';
				wrap.style.maxHeight = Math.max(120, Math.round(refH - reserved)) + 'px';
				wrap.style.overflowY = 'auto';
				table.parentNode.insertBefore(wrap, table);
				wrap.appendChild(table);
				dev.style.maxHeight = Math.round(refH) + 'px';
			}
		}

		/* The two optional blocks. Hidden via display:none rather than
		 * simply left empty: the root is a flex column with a gap, so an
		 * empty wrapper would still claim a gap slot. */
		clear(state.slots.apps);
		if (d.showApps) {
			state.slots.apps.style.display = null;
			state.slots.apps.appendChild(renderApps(d));
		}
		else {
			state.slots.apps.style.display = 'none';
		}

		clear(state.slots.wol);
		if (d.showWol) {
			state.slots.wol.style.display = null;
			state.slots.wol.appendChild(renderWol(d));
		}
		else {
			state.slots.wol.style.display = 'none';
		}

		clear(state.slots.storage);
		state.slots.storage.appendChild(renderStorage(d));
	}

	/* ------------------------------------------------------------- poll ----- */

	function refresh() {
		if (state.busy || !state.mounted)
			return;

		if (document.hidden)
			return;

		state.busy = true;

		gather().then(function(norm) {
			state.lastNorm = norm;
			render(norm);
		}).catch(function() {
			/* a transient ubus failure must not blank the page */
		}).then(function() {
			state.busy = false;
		});
	}

	/* probe cadence: 30s, decoupled from the 5s render tick so the admin
	 * browser does not pull a full page from the probe host every 5s. When
	 * a probe settles, repaint immediately from the last known data instead
	 * of waiting for the next poll. */
	function scheduleProbe() {
		if (state.probeTimer)
			return;

		state.probeTimer = window.setInterval(function() {
			if (!document.hidden)
				internetProbe();
		}, 30000);

		document.addEventListener('visibilitychange', function() {
			if (!document.hidden)
				internetProbe();
		});
	}

	/* ------------------------------------------------------------- boot ----- */

	function start() {
		if (!mount())
			return;

		/* click-outside closes the system-info popover (registered once;
		 * the handler itself is a no-op while state.sysOpen is false) */
		document.addEventListener('click', sysPopOutside);

		gather().then(function(norm) {
			state.lastNorm = norm;
			render(norm);
		}).then(function() {
			if (state.timer)
				return;

			state.timer = window.setInterval(function() {
				if (document.hidden || !state.mounted)
					return;

				refresh();
			}, REFRESH_MS);

			document.addEventListener('visibilitychange', function() {
				if (!document.hidden)
					refresh();
			});

			/* first probe runs right away, then every 30s; a settled probe
			 * repaints the internet KPI from state.lastNorm immediately */
			internetProbe();
			scheduleProbe();
		}).catch(function(e) {
			if (window.console && console.error)
				console.error('ngOverview: initial render failed', e);
		});
	}

	/* ------------------------------- attach -------------------------------- */

	function attachCss() {
		/* CSS lives in the THEME tree, so the correct URL builder is
		 * L.media() (→ /luci-static/<theme>/…). L.resource() points at
		 * /luci-static/resources/ (luci-base) and produced a 404 <link>,
		 * which the browser silently ignores. */
		if (CSS_HREF == null)
			CSS_HREF = L.media('assets/css/ngOverview.css');

		if (document.querySelector('link[href*="ngOverview.css"]') != null)
			return;

		document.head.appendChild(E('link', {
			'rel': 'stylesheet',
			'type': 'text/css',
			'href': CSS_HREF
		}));
	}

	/* The theme footer dispatches 'ng-page-rendered' once, right after the
	 * async view has been bootstrap-ified - that is the earliest moment the
	 * stock sections exist AND are already card-wrapped. Fall back to a
	 * bounded poll for safety (e.g. if a future theme version drops it). */
	function boot() {
		attachCss();

		var tries = 0;

		function attempt() {
			if (state.mounted)
				return;

			if (mount()) {
				start();
				return;
			}

			if (++tries < 60)
				window.setTimeout(attempt, 250);
		}

		document.addEventListener('ng-page-rendered', function() {
			attempt();
		});

		if (typeof(L) == 'undefined' || !L.env || !L.loaded)
			document.addEventListener('luci-loaded', function() { attempt(); }, { once: true });

		attempt();
	}

	if (typeof(L) == 'undefined') {
		document.addEventListener('luci-loaded', boot, { once: true });
	}
	else if (!L.loaded) {
		document.addEventListener('luci-loaded', boot, { once: true });
	}
	else {
		boot();
	}
})();
