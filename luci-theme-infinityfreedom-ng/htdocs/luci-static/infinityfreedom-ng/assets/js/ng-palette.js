/*
 * Palette (color scheme) switcher for luci-theme-infinityfreedom-ng.
 *
 * Part of luci-theme-infinityfreedom-ng.
 *
 * Renders the entries of the #if-palette-picker dropdown (emitted by
 * header.ut from the theme's palette registry) into a live switcher:
 *
 *   - click entry -> save choice to UCI (infinityfreedom-ng.theme.palette)
 *     via the LuCI rpc client (requires the theme's acl.d grant), then
 *     apply instantly: swap <body data-if-palette> and the palette
 *     stylesheet <link>, no page reload.
 *   - when the section is missing (fresh install, uci set returns
 *     NOT_FOUND) it is created with `uci add` first.
 *   - on a read-only rpc failure (no ACL grant) it still applies the
 *     palette for this browser session and shows a hint, instead of
 *     failing silently.
 */

(function() {
	'use strict';

	/* The <script> tag sits in <head> (header.ut) while the #if-palette-picker
	 * dropdown lives in the <body> markup further down, so wait for the DOM
	 * to finish parsing before grabbing the picker. */
	function init() {
	var picker = document.getElementById('if-palette-picker');
	if (!picker)
		return;

	var current = picker.getAttribute('data-current') || 'default';
	var baseUrl = document.querySelector('link#if-palette-stylesheet')?.href;

	function ensureLink(palette) {
		var link = document.getElementById('if-palette-stylesheet');
		if (palette == 'default') {
			if (link)
				link.remove();
			return;
		}
		if (!link) {
			link = document.createElement('link');
			link.id = 'if-palette-stylesheet';
			link.rel = 'stylesheet';
			link.type = 'text/css';
			document.head.appendChild(link);
		}
		/* derive /assets/css/palette-<name>.min.css?v=1 from any theme asset url;
		 * the ?v= mirrors the server-emitted <link> so both share one cache entry */
		var base = baseUrl || (document.querySelector('link[id="app-dark-stylesheet"]')?.href || '');
		var dir = base.replace(/[^/]*$/, '');
		link.href = dir + 'palette-' + palette + '.min.css?v=4';
	}

	function applyPalette(palette) {
		if (palette == 'default')
			document.body.removeAttribute('data-if-palette');
		else
			document.body.setAttribute('data-if-palette', palette);
		ensureLink(palette);
		current = palette;
		picker.setAttribute('data-current', palette);
		picker.querySelectorAll('.if-palette-option').forEach(function(el) {
			var icon = el.querySelector('i');
			if (!icon)
				return;
			if (el.getAttribute('data-palette') == palette) {
				icon.classList.remove('mdi-radiobox-blank');
				icon.classList.add('mdi-radiobox-marked');
			} else {
				icon.classList.remove('mdi-radiobox-marked');
				icon.classList.add('mdi-radiobox-blank');
			}
		});
		/* meta theme-color follows the palette (mobile browser chrome) */
		var meta = document.querySelector('meta[name="theme-color"]');
		if (meta) {
			if (palette == 'default')
				meta.setAttribute('content', '#0099CC');
			else
				meta.setAttribute('content', getComputedStyle(document.body).backgroundColor || '#121315');
		}
	}

	function savePalette(palette) {
		/* LuCI rpc client is loaded by cbi.js on every admin page */
		if (typeof(L) == 'undefined' || !L.Request) {
			applyPalette(palette);
			return;
		}
		/* Homelede LuCI exposes the ubus endpoint as L.env.ubuspath ('/ubus/');
		 * upstream LuCI uses dispatchdir + '/admin/ubus/'. L.Request.post wraps
		 * the payload in a JSON-RPC *batch* array which the plain /ubus/ endpoint
		 * rejects with a parse error, so use a plain fetch with the single-object
		 * form that both endpoints accept. */
		var ubusUrl = L.env.ubuspath
			|| ((L.env.dispatchdir || L.env.cgi_base || '') + '/admin/ubus/');

		var call = function(name, args) {
			return fetch(ubusUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: Date.now(),
					method: 'call',
					params: [ L.env.sessionid, 'uci', name, args ]
				})
			}).then(function(res) {
				if (!res.ok)
					throw new Error('ubus HTTP ' + res.status);
				return res.json();
			}).then(function(j) {
				if (j.error || (j.result && j.result[0] !== 0))
					throw new Error('ubus error: ' + JSON.stringify(j.error || j.result));
				return j;
			});
		};

		call('set', {
			config: 'infinityfreedom-ng',
			section: 'palette',
			values: { name: palette }
		}).then(function() {
			/* committed delta survives the session; also commit so the
			   theme template (server side uci.get) sees it immediately */
			return call('commit', { config: 'infinityfreedom-ng' });
		}, function() {
			/* section may not exist yet (fresh install): add then set */
			return call('add', {
				config: 'infinityfreedom-ng',
				type: 'theme',
				name: 'palette',
				values: { name: palette }
			}).then(function() {
				return call('commit', { config: 'infinityfreedom-ng' });
			});
		}).catch(function() {
			/* no ACL grant (read-only): session-local only */
			if (window.console)
				console.warn('palette switch not persisted (rpc denied)');
		}).finally(function() {
			applyPalette(palette);
		});
	}

	picker.addEventListener('click', function(ev) {
		var el = ev.target.closest('.if-palette-option');
		if (!el)
			return;
		ev.preventDefault();
		var palette = el.getAttribute('data-palette');
		if (!palette || palette == current)
			return;
		savePalette(palette);
	});
	}

	if (document.readyState === 'loading')
		document.addEventListener('DOMContentLoaded', init);
	else
		init();
})();
