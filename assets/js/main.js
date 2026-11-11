(function () {
  'use strict';

  var navToggle = document.getElementById('navToggle');
  var navMenu = document.getElementById('navMenu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      navMenu.classList.toggle('open');
      navToggle.classList.toggle('active');
    });
  }

  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-href]');
    if (!card) return;
    if (e.target.closest('a, button, input, textarea, select, label')) return;
    window.location.href = card.getAttribute('data-href');
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    var msg = form.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) {
      e.preventDefault();
    }
  });

  (function () {
    var car = document.getElementById('annCarousel');
    if (!car) return;
    var slides = car.querySelectorAll('.ann-slide');
    var dots = car.querySelectorAll('.ann-dot');
    if (slides.length <= 1) {
      if (slides[0]) slides[0].classList.add('active');
      return;
    }
    var idx = 0;
    var timer = null;
    function go(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('active', i === idx); });
      dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
    }
    function start() { timer = setInterval(function () { go(idx + 1); }, 3000); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    dots.forEach(function (d) {
      d.addEventListener('click', function () { go(parseInt(d.getAttribute('data-i'), 10)); stop(); start(); });
    });
    car.addEventListener('mouseenter', stop);
    car.addEventListener('mouseleave', start);
    go(0);
    start();
  })();

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn) return;
    var url = btn.getAttribute('data-url') || '';
    function toast() {
      var t = document.createElement('span'); t.className = 'copy-toast'; t.textContent = '已复制';
      btn.parentNode.appendChild(t); setTimeout(function () { t.remove(); }, 1200);
    }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(); } catch (e) {}
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(toast).catch(fallback);
    } else { fallback(); }
  });

  (function () {
    var btn = document.getElementById('backToTop');
    if (!btn) return;
    var ring = btn.querySelector('.btp-progress');
    var C = 2 * Math.PI * 19;
    function update() {
      var st = window.scrollY || document.documentElement.scrollTop;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? st / max : 0;
      btn.classList.toggle('show', st > 400);
      if (ring) ring.style.strokeDashoffset = String(C * (1 - ratio));
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    update();
  })();

  var planTables = document.querySelectorAll('table.plan-table');
  for (var ptIndex = 0; ptIndex < planTables.length; ptIndex++) {
    var ptHead = planTables[ptIndex].querySelector('thead th');
    if (!ptHead || ptHead.textContent.trim() !== '套餐') continue;
    var ptRows = planTables[ptIndex].querySelectorAll('tbody tr');
    if (!ptRows.length) continue;
    ptRows[0].classList.add('plan-first');
    if (ptRows.length >= 3) ptRows[1].classList.add('plan-pick');
  }

  var ctaLabels = ['查看教程', '查看详情', '了解更多', '查看全文'];
  var ctaLinks = document.querySelectorAll('.post-content a');
  for (var ctaIndex = 0; ctaIndex < ctaLinks.length; ctaIndex++) {
    if (ctaLabels.indexOf(ctaLinks[ctaIndex].textContent.trim()) !== -1) {
      ctaLinks[ctaIndex].classList.add('pc-cta');
    }
  }

  function tuneCharts() {
    if (!window.Chart || window.innerWidth > 900) return;
    var chartCanvases = document.querySelectorAll('canvas');
    for (var chIndex = 0; chIndex < chartCanvases.length; chIndex++) {
      var instance = Chart.getChart(chartCanvases[chIndex]);
      if (!instance) continue;
      if (instance.options.plugins && instance.options.plugins.legend && instance.options.plugins.legend.labels) {
        instance.options.plugins.legend.labels.boxWidth = 8;
        instance.options.plugins.legend.labels.font = { size: 9 };
        instance.options.plugins.legend.labels.padding = 6;
      }
      var scaleKeys = Object.keys(instance.options.scales || {});
      for (var scIndex = 0; scIndex < scaleKeys.length; scIndex++) {
        var scale = instance.options.scales[scaleKeys[scIndex]];
        if (scale.ticks) {
          scale.ticks.maxTicksLimit = 4;
          scale.ticks.font = { size: 9 };
          scale.ticks.padding = 2;
        }
        if (scale.title) scale.title.display = false;
      }
      instance.update('none');
    }
  }
  window.addEventListener('load', tuneCharts);

  var navItems = document.querySelectorAll('.nav-item > .nm');
  for (var navIndex = 0; navIndex < navItems.length; navIndex++) {
    navItems[navIndex].addEventListener('click', function (event) {
      if (window.innerWidth > 1024) return;
      var item = this.parentElement;
      if (item.classList.contains('open')) return;
      event.preventDefault();
      var openItems = document.querySelectorAll('.nav-item.open');
      for (var oi = 0; oi < openItems.length; oi++) openItems[oi].classList.remove('open');
      item.classList.add('open');
    });
  }

  var pcKvList = document.querySelectorAll('.post-content div');
  for (var pcKvIndex = 0; pcKvIndex < pcKvList.length; pcKvIndex++) {
    var pcKvKids = pcKvList[pcKvIndex].children;
    if (pcKvKids.length === 2 &&
        pcKvKids[0].tagName === 'DIV' && pcKvKids[1].tagName === 'DIV' &&
        pcKvKids[0].children.length === 0 && pcKvKids[1].children.length === 0) {
      pcKvList[pcKvIndex].classList.add('pc-kv');
    }
  }
})();
