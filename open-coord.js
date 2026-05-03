// ==UserScript==
// @name         Google Photos Open in AMap
// @namespace    han.googlephotos.amap
// @version      5.2
// @description  Lean draggable button for Google Photos that opens the current photo location in AMap.
// @homepageURL  https://github.com/HankAviator/google-photos-loc-in-amap
// @supportURL   https://github.com/HankAviator/google-photos-loc-in-amap/issues
// @updateURL    https://raw.githubusercontent.com/HankAviator/google-photos-loc-in-amap/master/open-coord.js
// @downloadURL  https://raw.githubusercontent.com/HankAviator/google-photos-loc-in-amap/master/open-coord.js
// @match        https://photos.google.com/*
// @run-at       document-idle
// @grant        none
// @license      GPLv3
// ==/UserScript==

(function () {
	'use strict';

	const BTN_ID = 'han-gphotos-amap-lean-btn';
	const STYLE_ID = 'han-gphotos-amap-lean-style';

	let dirty = true;
	let lastPhotoHref = '';
	let lastCoords = null;

	injectStyle();
	waitForBody(() => {
		ensureButton();
		installDirtySignals();
		installRouteHooks();
		installUiSelfHeal();
		refreshButtonState();
		console.log('[GP->AMap] lean self-heal script loaded');
	});

	function waitForBody(fn) {
		if (document.body) {
			fn();
			return;
		}

		const timer = setInterval(() => {
			if (document.body) {
				clearInterval(timer);
				fn();
			}
		}, 100);
	}

	function injectStyle() {
		if (document.getElementById(STYLE_ID)) return;

		const style = document.createElement('style');
		style.id = STYLE_ID;
		style.textContent = `
      #${BTN_ID} {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px 12px;
        border: 1px solid rgba(128,128,128,0.35);
        border-radius: 999px;
        background: rgba(255,255,255,0.98);
        color: #1f1f1f;
        font: 500 13px/1 Arial, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.18);
        cursor: grab;
        user-select: none;
      }

      #${BTN_ID}:active {
        cursor: grabbing;
      }

      #${BTN_ID}.is-hidden {
        display: none;
      }

      @media (prefers-color-scheme: dark) {
        #${BTN_ID} {
          background: rgba(32,33,36,0.98);
          color: #e8eaed;
          border-color: rgba(255,255,255,0.18);
        }
      }
    `;
		document.head.appendChild(style);
	}

	function ensureButton() {
		if (!document.body) return null;

		let btn = document.getElementById(BTN_ID);
		if (btn && btn.isConnected) return btn;

		btn = document.createElement('button');
		btn.id = BTN_ID;
		btn.type = 'button';
		btn.textContent = '📍 高德地图';
		btn.title = 'Drag to move. Click to open in AMap. Double-click to reset position.';
		btn.dataset.moved = '0';

		document.body.appendChild(btn);

		makeDraggable(btn);

		btn.addEventListener('click', (e) => {
			if (btn.dataset.moved === '1') {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			openInAMap();
		});

		btn.addEventListener('dblclick', (e) => {
			e.preventDefault();
			resetButton(btn);
		});

		return btn;
	}

	function makeDraggable(btn) {
		let dragging = false;
		let startX = 0;
		let startY = 0;
		let startLeft = 0;
		let startTop = 0;

		btn.addEventListener('mousedown', (e) => {
			if (e.button !== 0) return;

			const rect = btn.getBoundingClientRect();

			btn.style.right = 'auto';
			btn.style.bottom = 'auto';
			btn.style.left = `${rect.left}px`;
			btn.style.top = `${rect.top}px`;

			startX = e.clientX;
			startY = e.clientY;
			startLeft = rect.left;
			startTop = rect.top;
			dragging = true;
			btn.dataset.moved = '0';

			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onUp);

			e.preventDefault();
		});

		function onMove(e) {
			if (!dragging) return;

			const dx = e.clientX - startX;
			const dy = e.clientY - startY;

			if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
				btn.dataset.moved = '1';
			}

			let left = startLeft + dx;
			let top = startTop + dy;

			const maxLeft = Math.max(0, window.innerWidth - btn.offsetWidth);
			const maxTop = Math.max(0, window.innerHeight - btn.offsetHeight);

			left = clamp(left, 0, maxLeft);
			top = clamp(top, 0, maxTop);

			btn.style.left = `${left}px`;
			btn.style.top = `${top}px`;
		}

		function onUp() {
			if (!dragging) return;

			dragging = false;
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);

			setTimeout(() => {
				btn.dataset.moved = '0';
			}, 0);
		}
	}

	function resetButton(btn) {
		btn.style.left = 'auto';
		btn.style.top = 'auto';
		btn.style.right = '24px';
		btn.style.bottom = '24px';
	}

	function clamp(v, min, max) {
		return Math.min(Math.max(v, min), max);
	}

	function installDirtySignals() {
		document.addEventListener('click', () => {
			dirty = true;
			ensureButton();
			refreshButtonState();
		}, true);

		document.addEventListener('keydown', (e) => {
			const keys = new Set([
				'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
				'PageUp', 'PageDown', 'Home', 'End',
				'a', 'd', 'j', 'k', 'n', 'p'
			]);

			if (keys.has(e.key)) {
				dirty = true;
				ensureButton();
				refreshButtonState();
			}
		}, true);

		window.addEventListener('focus', () => {
			ensureButton();
			refreshButtonState();
		}, true);

		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) {
				ensureButton();
				refreshButtonState();
			}
		}, true);
	}

	function installRouteHooks() {
		const originalPushState = history.pushState;
		const originalReplaceState = history.replaceState;

		history.pushState = function () {
			const result = originalPushState.apply(this, arguments);
			onRouteChanged();
			return result;
		};

		history.replaceState = function () {
			const result = originalReplaceState.apply(this, arguments);
			onRouteChanged();
			return result;
		};

		window.addEventListener('popstate', onRouteChanged, true);
		window.addEventListener('hashchange', onRouteChanged, true);
	}

	function onRouteChanged() {
		dirty = true;
		lastPhotoHref = '';
		lastCoords = null;
		ensureButton();
		refreshButtonState();
	}

	function installUiSelfHeal() {
		// Very cheap observer: only watch body direct children.
		// No subtree, no DOM scanning, no coord work here.
		const observer = new MutationObserver(() => {
			const btn = document.getElementById(BTN_ID);
			if (!btn || !btn.isConnected) {
				ensureButton();
			}
			refreshButtonState();
		});

		observer.observe(document.body, {
			childList: true
		});

		// Extra low-cost fallback in case the page silently replaces body-level nodes.
		setInterval(() => {
			const btn = document.getElementById(BTN_ID);
			if (!btn || !btn.isConnected) {
				ensureButton();
				refreshButtonState();
			}
		}, 3000);
	}

	function refreshButtonState() {
		const btn = ensureButton();
		if (!btn) return;

		const onPhotoPage = isPhotoPage();
		btn.classList.toggle('is-hidden', !onPhotoPage);
	}

	function isPhotoPage() {
		return /^\/photo\//.test(location.pathname);
	}

	function openInAMap() {
		const debug = [];
		const coords = getCoordsForCurrentPhoto(debug);

		if (coords) {
			const url = `https://uri.amap.com/marker?position=${coords.lng},${coords.lat}&src=convert-script&coordinate=wgs84&callnative=0`;
			console.log('[GP->AMap] opening', url, debug);
			window.open(url, '_blank', 'noopener');
			return;
		}

		console.warn('[GP->AMap] no coordinates found', debug);
		alert('Could not extract GPS coordinates from the current visible map link.');
	}

	function getCoordsForCurrentPhoto(debug) {
		const currentHref = location.href;

		if (!dirty && currentHref === lastPhotoHref && lastCoords) {
			debug.push('using cached coords');
			return lastCoords;
		}

		const coords = extractCurrentCoords(debug);

		lastPhotoHref = currentHref;
		lastCoords = coords;
		dirty = false;

		return coords;
	}

	function extractCurrentCoords(debug) {
		const link = findVisibleGoogleMapsLink(debug);
		if (!link) {
			debug.push('no visible Google Maps link found');
			return null;
		}

		debug.push(`using visible link: ${String(link.href).slice(0, 250)}`);

		const coords = parseCoordsFromMapsUrl(link.href, debug);
		if (coords) return coords;

		debug.push('failed to parse coordinates from visible link');
		return null;
	}

	function findVisibleGoogleMapsLink(debug) {
		const anchors = Array.from(document.querySelectorAll('a[href]'))
			.filter((a) => {
				if (!isVisible(a)) return false;

				const href = a.href || '';
				if (!looksLikeMapsLink(href)) return false;

				const rect = a.getBoundingClientRect();

				if (rect.left < window.innerWidth * 0.65) return false;
				if (rect.width < 24 || rect.height < 24) return false;

				return true;
			})
			.sort((a, b) => {
				const ra = a.getBoundingClientRect();
				const rb = b.getBoundingClientRect();

				if (Math.abs(rb.top - ra.top) > 4) return rb.top - ra.top;

				const areaA = ra.width * ra.height;
				const areaB = rb.width * rb.height;
				return areaB - areaA;
			});

		debug.push(`visible map-link candidates: ${anchors.length}`);
		return anchors[0] || null;
	}

	function looksLikeMapsLink(href) {
		if (!href) return false;
		return /google\.[^/]+\/maps/i.test(href) ||
			/maps\.google\./i.test(href) ||
			/\/maps\//i.test(href) ||
			/[?&](q|query|ll|center|destination|origin|lat|lng)=/i.test(href);
	}

	function parseCoordsFromMapsUrl(rawUrl, debug) {
		const candidates = unwrapUrlCandidates(rawUrl);

		for (const candidate of candidates) {
			const coords = parseOneUrlCandidate(candidate, debug);
			if (coords) return coords;
		}

		return null;
	}

	function unwrapUrlCandidates(rawUrl) {
		const out = [];
		const seen = new Set();

		function push(value) {
			if (!value || seen.has(value)) return;
			seen.add(value);
			out.push(value);
		}

		let current = rawUrl;
		push(current);

		for (let i = 0; i < 3; i++) {
			try {
				const decoded = decodeURIComponent(current);
				if (decoded === current) break;
				current = decoded;
				push(current);
			} catch (e) {
				break;
			}
		}

		for (const value of [...out]) {
			const matches = value.match(/https?:\/\/[^"'<> ]+/g);
			if (matches) {
				for (const part of matches) push(part);
			}
		}

		return out;
	}

	function parseOneUrlCandidate(text, debug) {
		if (!text) return null;

		let m = text.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/i);
		if (m) {
			const lat = parseFloat(m[1]);
			const lng = parseFloat(m[2]);
			if (isLat(lat) && isLng(lng)) {
				debug.push('coords from !3d !4d pattern');
				return { lat, lng };
			}
		}

		m = text.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/i);
		if (m) {
			const lat = parseFloat(m[1]);
			const lng = parseFloat(m[2]);
			if (isLat(lat) && isLng(lng)) {
				debug.push('coords from @lat,lng pattern');
				return { lat, lng };
			}
		}

		try {
			const url = new URL(text, location.origin);

			const directLat = getNumericParam(url, ['lat', 'latitude']);
			const directLng = getNumericParam(url, ['lng', 'lon', 'longitude']);

			if (Number.isFinite(directLat) && Number.isFinite(directLng) && isLat(directLat) && isLng(directLng)) {
				debug.push('coords from explicit lat/lng params');
				return { lat: directLat, lng: directLng };
			}

			const pairKeys = ['q', 'query', 'll', 'center', 'destination', 'origin'];
			for (const key of pairKeys) {
				const value = url.searchParams.get(key);
				const pair = parseCoordPair(value);
				if (pair) {
					debug.push(`coords from ${key} param`);
					return pair;
				}
			}
		} catch (e) {
			// ignore URL parse errors
		}

		const rawPair = parseCoordPair(text);
		if (rawPair) {
			debug.push('coords from raw pair inside visible link');
			return rawPair;
		}

		return null;
	}

	function getNumericParam(url, keys) {
		for (const key of keys) {
			const value = url.searchParams.get(key);
			if (value == null) continue;
			const num = parseFloat(value);
			if (Number.isFinite(num)) return num;
		}
		return NaN;
	}

	function parseCoordPair(value) {
		if (!value) return null;

		const m = String(value).match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
		if (!m) return null;

		const a = parseFloat(m[1]);
		const b = parseFloat(m[2]);
		if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

		if (isLat(a) && isLng(b)) return { lat: a, lng: b };
		if (isLng(a) && isLat(b)) return { lat: b, lng: a };

		return null;
	}

	function isVisible(el) {
		if (!el || !el.isConnected) return false;

		const style = window.getComputedStyle(el);
		if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
			return false;
		}

		const rect = el.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0;
	}

	function isPhotoPage() {
		return /^\/photo\//.test(location.pathname);
	}

	function isLat(v) {
		return v >= -90 && v <= 90;
	}

	function isLng(v) {
		return v >= -180 && v <= 180;
	}
})();
