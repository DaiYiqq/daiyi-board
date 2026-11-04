/* PWA：注册 service worker，并提示「添加到桌面」。
 * 安卓/桌面 Chrome：捕获 beforeinstallprompt，点「添加」弹系统安装框。
 * iOS Safari：没有安装接口，显示图文引导（分享 → 添加到主屏幕）。
 * 用户关闭提示后写入 localStorage，不再自动弹出；已经是 standalone（从桌面图标打开）时不显示。 */
(function () {
  'use strict';
  var DISMISS_KEY = 'cnmPwa.dismissed.v1';
  var INSTALLED_KEY = 'cnmPwa.installed.v1';
  var script = document.currentScript;
  var root = script && script.src ? new URL('../', script.src).href : new URL('/', location.href).href;
  var track = window.cnmTrack || function () {};

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式 */ } }

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(root + 'sw.js', { scope: root }).catch(function () { /* 不支持或被禁用时静默 */ });
    });
  }

  /* ---------- 添加到桌面 ---------- */
  var standalone = window.cnmIsStandalone != null ? window.cnmIsStandalone
    : ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true);
  if (standalone) return;

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isIOSSafari = isIOS && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|MicroMessenger|QQ\/|MQQBrowser|UCBrowser|Baidu|Quark|Weibo|DingTalk|AliApp/.test(ua);
  var isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferred = null;
  var bar = null;
  var sheet = null;
  var footerLink = null;
  var shownTracked = false;

  function dismissed() { return !!lsGet(DISMISS_KEY); }
  function installed() { return lsGet(INSTALLED_KEY) === '1'; }
  function canInstall() { return !installed() && (!!deferred || isIOSSafari); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function closeBar(remember) {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
    if (remember) { lsSet(DISMISS_KEY, String(Date.now())); track('install_hint_closed', { platform: isIOSSafari ? 'ios' : 'chrome' }); }
  }

  function closeSheet(remember) {
    if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
    sheet = null;
    document.removeEventListener('keydown', onKey);
    if (remember) { lsSet(DISMISS_KEY, String(Date.now())); closeBar(false); }
  }

  function onKey(e) { if (e.key === 'Escape') closeSheet(false); }

  async function promptInstall() {
    if (!deferred) return;
    var p = deferred;
    deferred = null;
    closeBar(false);
    track('install_prompt_shown', { platform: 'chrome' });
    try {
      p.prompt();
      var choice = await p.userChoice;
      track(choice && choice.outcome === 'accepted' ? 'install_prompt_accepted' : 'install_prompt_dismissed', { platform: 'chrome' });
    } catch (e) { /* 系统弹框被拦截 */ }
    lsSet(DISMISS_KEY, String(Date.now()));
    refreshFooter();
  }

  /* 引导图：纯 SVG，颜色走站点变量，深浅色都能看清 */
  var SVG_OPEN = '<svg class="pwa-pic" viewBox="0 0 300 100" role="img" aria-hidden="true" focusable="false">';
  var PICS = [
    SVG_OPEN +
      '<rect x="6" y="6" width="288" height="88" rx="14" class="pic-bg"/>' +
      '<rect x="24" y="16" width="252" height="22" rx="11" class="pic-field"/>' +
      '<text x="150" y="31" text-anchor="middle" class="pic-txt" font-size="11.5">math.pansgo.com</text>' +
      '<circle cx="150" cy="68" r="19" class="pic-hit"/>' +
      '<g class="pic-line" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M46 60l-8 8 8 8"/><path d="M96 60l8 8-8 8"/>' +
        '<path d="M150 70V56m0 0l-5 5m5-5l5 5"/><path d="M143 63h-3v15h20V63h-3"/>' +
        '<path d="M200 62q8-3 14 0v14q-6-3-14 0zM214 62q6-3 14 0v14q-8-3-14 0z" stroke-width="1.8"/>' +
        '<rect x="248" y="60" width="16" height="16" rx="3" stroke-width="1.8"/><rect x="253" y="55" width="16" height="16" rx="3" stroke-width="1.8"/>' +
      '</g>' +
    '</svg>',
    SVG_OPEN +
      '<rect x="6" y="6" width="288" height="88" rx="14" class="pic-bg"/>' +
      '<g class="pic-txt" font-size="13">' +
        '<text x="24" y="26">拷贝</text>' +
        '<text x="24" y="86">添加书签</text>' +
      '</g>' +
      '<rect x="14" y="34" width="272" height="28" rx="8" class="pic-hit"/>' +
      '<g class="pic-line" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="256" y="40" width="16" height="16" rx="3"/><path d="M264 44v8M260 48h8"/>' +
      '</g>' +
      '<text x="24" y="53" class="pic-txt pic-strong" font-size="13.5">添加到主屏幕</text>' +
    '</svg>',
    SVG_OPEN +
      '<rect x="6" y="6" width="288" height="88" rx="14" class="pic-bg"/>' +
      '<g class="pic-txt" font-size="12.5"><text x="22" y="28">取消</text>' +
      '<text x="150" y="28" text-anchor="middle" class="pic-strong">添加到主屏幕</text></g>' +
      '<rect x="236" y="14" width="48" height="20" rx="10" class="pic-hit"/>' +
      '<text x="260" y="28.5" text-anchor="middle" class="pic-txt pic-strong" font-size="12.5">添加</text>' +
      '<rect x="22" y="44" width="40" height="40" rx="10" class="pic-icon"/>' +
      '<path d="M32 74h6q4 0 4-4v-4q0-3 3-3h4" class="pic-icon-line" fill="none" stroke-width="3" stroke-linecap="round"/>' +
      '<rect x="72" y="46" width="206" height="26" rx="8" class="pic-field"/>' +
      '<text x="82" y="63.5" class="pic-txt" font-size="13">知识图谱</text>' +
      '<text x="72" y="84" class="pic-muted" font-size="10.5">math.pansgo.com</text>' +
    '</svg>'
  ];

  function openGuide() {
    if (sheet) return;
    track('ios_guide_opened');
    sheet = el('div', 'pwa-sheet-wrap');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', '添加到主屏幕');
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(false); });
    var panel = el('div', 'pwa-sheet');
    panel.appendChild(el('h2', 'pwa-sheet-title', '添加到主屏幕'));
    panel.appendChild(el('p', 'pwa-sheet-lead', '加到桌面后，从图标一点就开，像 App 一样全屏使用，没有网络时也能浏览知识图谱。'));
    var steps = [
      ['点' + (isIPad ? '地址栏旁边' : '底部工具栏中间') + '的「分享」按钮', '方框加向上箭头的图标。'],
      ['在菜单里往上滑，点「添加到主屏幕」', '在列表里找不到时，滑到最下面再看。'],
      ['点右上角的「添加」', '桌面上就会出现「知识图谱」的图标。']
    ];
    var list = el('ol', 'pwa-steps');
    steps.forEach(function (s, i) {
      var li = el('li', 'pwa-step');
      var head = el('div', 'pwa-step-head');
      head.appendChild(el('span', 'pwa-step-no', String(i + 1)));
      head.appendChild(el('b', null, s[0]));
      li.appendChild(head);
      var pic = el('div', 'pwa-pic-wrap');
      pic.innerHTML = PICS[i];
      li.appendChild(pic);
      li.appendChild(el('p', 'pwa-step-note', s[1]));
      list.appendChild(li);
    });
    panel.appendChild(list);
    var row = el('div', 'pwa-sheet-actions');
    var ok = el('button', 'primary', '知道了');
    ok.type = 'button';
    ok.addEventListener('click', function () { closeSheet(true); });
    row.appendChild(ok);
    panel.appendChild(row);
    sheet.appendChild(panel);
    document.body.appendChild(sheet);
    document.addEventListener('keydown', onKey);
    ok.focus();
  }

  function showBar() {
    if (bar || sheet || dismissed() || !canInstall()) return;
    bar = el('div', 'pwa-bar');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', '添加到桌面');
    var icon = el('img', 'pwa-bar-icon');
    icon.src = root + 'assets/icons/icon-192.png';
    icon.alt = '';
    icon.width = 44; icon.height = 44;
    var text = el('div', 'pwa-bar-text');
    text.appendChild(el('b', null, '添加到桌面'));
    text.appendChild(el('span', null, isIOSSafari && !deferred
      ? '从桌面图标一点就开，没有网络时也能看图谱。'
      : '像 App 一样从桌面一点就开，没有网络时也能看图谱。'));
    var actions = el('div', 'pwa-bar-actions');
    var go = el('button', 'primary', isIOSSafari && !deferred ? '怎么添加' : '添加');
    go.type = 'button';
    go.addEventListener('click', function () { if (deferred) promptInstall(); else openGuide(); });
    var no = el('button', null, '暂不');
    no.type = 'button';
    no.addEventListener('click', function () { closeBar(true); refreshFooter(); });
    actions.appendChild(go);
    actions.appendChild(no);
    bar.appendChild(icon);
    bar.appendChild(text);
    bar.appendChild(actions);
    document.body.appendChild(bar);
    if (!shownTracked) { shownTracked = true; track('install_hint_shown', { platform: isIOSSafari && !deferred ? 'ios' : 'chrome' }); }
  }

  /* 页脚里的入口：提示被关掉之后，想装的人仍然能找到 */
  function refreshFooter() {
    var p = document.querySelector('.site-footer p');
    if (!p) return;
    if (!footerLink) {
      footerLink = el('button', 'pwa-footer-link', '添加到桌面');
      footerLink.type = 'button';
      footerLink.addEventListener('click', function () { if (deferred) promptInstall(); else openGuide(); });
      p.appendChild(document.createTextNode(' · '));
      p.appendChild(footerLink);
    }
    footerLink.hidden = !canInstall();
    if (footerLink.previousSibling && footerLink.previousSibling.nodeType === 3) {
      footerLink.previousSibling.textContent = footerLink.hidden ? '' : ' · ';
    }
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    refreshFooter();
    setTimeout(showBar, 1200);
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    lsSet(INSTALLED_KEY, '1');
    closeBar(false);
    closeSheet(false);
    refreshFooter();
  });

  function init() {
    refreshFooter();
    if (isIOSSafari) setTimeout(showBar, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
