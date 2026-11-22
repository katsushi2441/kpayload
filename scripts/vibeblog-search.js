/* /vibeblog/ の記事のキーワード検索（2026-11-22）。build-vibeblog.ts が dist/vibeblog/search.js に写す。
 * 一覧のページの #vbq に入力したときに初めて search-index.json を読み、その場で絞り込む。
 * 検索語は #q= に入れる（?q= は Google が別ページとして拾うので使わない）。 */
(function () {
  var q = document.getElementById('vbq'), out = document.getElementById('vbr');
  if (!q || !out) return;
  var base = q.getAttribute('data-base') || '';
  var idx = null, loading = null;
  function norm(s) {
    s = (s || '').normalize('NFKC').toLowerCase();
    return s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function mark(s, terms) {
    var t = esc(s);
    terms.forEach(function (w) {
      if (!w) return;
      t = t.replace(new RegExp(reEsc(esc(w)), 'ig'), function (m) { return '<mark>' + m + '</mark>'; });
    });
    return t;
  }
  function load() {
    if (idx) return Promise.resolve(idx);
    if (loading) return loading;
    loading = fetch(base + '/search-index.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
      idx = d.map(function (p) {
        p._t = norm(p.t); p._k = norm(p.k + ' ' + (p.g || []).join(' ')); p._h = norm((p.h || []).join(' ')); p._d = norm(p.d);
        return p;
      });
      return idx;
    });
    return loading;
  }
  function run() {
    var raw = q.value.trim();
    try { history.replaceState(null, '', raw ? ('#q=' + encodeURIComponent(raw)) : location.pathname); } catch (e) { }
    if (!raw) { out.innerHTML = ''; return; }
    load().then(function (list) {
      var terms = norm(raw).split(/\s+/).filter(Boolean);
      var shown = raw.split(/[\s　]+/).filter(Boolean);
      var hits = [];
      list.forEach(function (p) {
        var sc = 0;
        var ok = terms.every(function (w) {
          var s = 0;
          if (p._t.indexOf(w) >= 0) s += 6;
          if (p._k.indexOf(w) >= 0) s += 4;
          if (p._h.indexOf(w) >= 0) s += 2;
          if (p._d.indexOf(w) >= 0) s += 1;
          sc += s;
          return s > 0;
        });
        if (ok) hits.push([sc, p]);
      });
      hits.sort(function (a, b) { return b[0] - a[0] || (b[1].dt || '').localeCompare(a[1].dt || ''); });
      var top = hits.slice(0, 40);
      out.innerHTML = '<div class="vs-n">「' + esc(raw) + '」に当たる記事 ' + hits.length + '本' + (hits.length > 40 ? '（上位40本）' : '') + '</div>' +
        top.map(function (h) {
          var p = h[1];
          return '<a class="vs-i" href="' + base + '/' + p.s + '.html"><div class="vs-t">' + mark(p.t, shown) + '</div>' +
            '<div class="vs-m">' + esc(p.dt || '') + (p.o ? '・AI OSS技術解説' : '') + '</div>' +
            '<div class="vs-d">' + mark((p.d || '').slice(0, 110), shown) + '</div></a>';
        }).join('') +
        (hits.length ? '' : '<div class="vs-n">見つかりませんでした。言葉を短くするか、別の言い方でお試しください。</div>');
    });
  }
  var timer = null;
  q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 160); });
  q.addEventListener('focus', load, { once: true });
  function fromHash() {
    var m = location.hash.match(/^#q=(.+)$/);
    if (m) { try { var v = decodeURIComponent(m[1]); if (v !== q.value.trim()) { q.value = v; run(); } } catch (e) { } }
    if (location.hash === '#search') { setTimeout(function () { q.focus(); }, 60); }
  }
  fromHash();
  window.addEventListener('hashchange', fromHash);   // 同じページで #q= だけ変わったときも検索し直す
})();
