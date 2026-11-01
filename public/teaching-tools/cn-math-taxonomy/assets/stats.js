/* 统计钩子：区分「从桌面图标打开（standalone）」和「普通网页访问」，记录安装和回访。
 * 不收集孩子昵称、年级、答题内容等个人信息，事件里只有事件名、来源、页面路径和时间。
 * 对外提供 window.cnmTrack(name, props)。配置见 assets/stats-config.js。 */
(function () {
  'use strict';
  var cfg = window.CNM_STATS || {};
  var LS = 'cnmStats.v1';

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
    } catch (e) { /* ignore */ }
    return window.navigator.standalone === true;
  }
  var standalone = isStandalone();
  var source = standalone ? 'pwa' : 'web';
  window.cnmIsStandalone = standalone;
  document.documentElement.setAttribute('data-display-mode', standalone ? 'standalone' : 'browser');

  function track(name, props) {
    var ev = { event: name, source: source, path: location.pathname, ts: new Date().toISOString() };
    if (props) Object.keys(props).forEach(function (k) { ev[k] = props[k]; });
    try { window.dispatchEvent(new CustomEvent('cnm:track', { detail: ev })); } catch (e) { /* ignore */ }
    try { if (typeof cfg.onEvent === 'function') cfg.onEvent(ev); } catch (e) { /* ignore */ }
    if (cfg.endpoint) {
      try {
        var body = JSON.stringify(ev);
        if (navigator.sendBeacon) navigator.sendBeacon(cfg.endpoint, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        else fetch(cfg.endpoint, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }).catch(function () { /* ignore */ });
      } catch (e) { /* ignore */ }
    }
  }
  window.cnmTrack = track;

  if (cfg.cloudflareToken) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: cfg.cloudflareToken }));
    document.head.appendChild(s);
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function visit() {
    var st = null;
    try { st = JSON.parse(localStorage.getItem(LS)); } catch (e) { st = null; }
    var day = today();
    var returning = false;
    if (!st || !st.first) st = { first: day, last: day, days: 1 };
    else if (st.last !== day) { st.last = day; st.days = (st.days || 1) + 1; returning = true; }
    try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* 隐私模式 */ }

    track('pageview');
    var launched = false;
    try { launched = sessionStorage.getItem('cnmStats.launch') === '1'; sessionStorage.setItem('cnmStats.launch', '1'); } catch (e) { /* ignore */ }
    if (standalone && !launched) track('pwa_launch');
    if (returning && !launched) {
      track('return_visit', {
        days_since_first: Math.round((Date.parse(day) - Date.parse(st.first)) / 86400000),
        visit_days: st.days
      });
    }
  }

  window.addEventListener('appinstalled', function () {
    try { localStorage.setItem('cnmPwa.installed.v1', '1'); } catch (e) { /* ignore */ }
    track('appinstalled');
  });

  visit();
})();
