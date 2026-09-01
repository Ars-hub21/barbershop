/* ==========================================================================
   js/utils/scissors-loader.js
   ==========================================================================
   Универсальный индикатор загрузки «ножницы» для ЛЮБОЙ кнопки сайта.
   Ничего не знает про API/бэкенд — просто визуальный эффект.

   Использование:
     ScissorsLoader.start(button, { loadingText: 'Отправка...' });
     // ...ждём асинхронную операцию...
     ScissorsLoader.stop(button);                 // вернуть исходный текст
     ScissorsLoader.stop(button, { text: 'Ой!' }); // или показать свой текст

   Поведение по ТЗ: ножницы стартуют НАПОЛОВИНУ за пределами левого края
   кнопки и заканчивают путь НАПОЛОВИНУ за пределами правого края —
   поэтому у кнопки не должно быть overflow:hidden (см. css/styles.css,
   класс .btn изначально его не задаёт — не добавляйте его туда).
   ========================================================================== */
const ScissorsLoader = (function () {
  const SCISSORS_WIDTH = 46;

  const SCISSORS_SVG =
    '<svg viewBox="0 0 100 100" width="100%" height="100%">' +
      '<g class="sl-part-left">' +
        '<circle cx="20" cy="35" r="9" fill="none" stroke="currentColor" stroke-width="3"/>' +
        '<path d="M28,38 L45,50" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M45,50 L85,49 L45,51 Z" fill="#ecf0f1" stroke="#95a5a6" stroke-width="0.5"/>' +
      '</g>' +
      '<g class="sl-part-right">' +
        '<circle cx="20" cy="65" r="9" fill="none" stroke="currentColor" stroke-width="3"/>' +
        '<path d="M28,62 L45,50" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M45,50 L85,51 L45,49 Z" fill="#bdc3c7" stroke="#7f8c8d" stroke-width="0.5"/>' +
      '</g>' +
      '<circle cx="45" cy="50" r="3" fill="#2c3e50" />' +
    '</svg>';

  // ---------- Общий canvas для "падающих волосков" (один на всю страницу) ----------
  let canvas = null, ctx = null, particles = [], hairRafId = null;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ensureCanvas() {
    if (canvas || reducedMotion) return;
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');

    const resize = function () {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    hairLoop();
  }

  function hairLoop() {
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles = particles.filter(function (p) { return p.o > 0; });
      particles.forEach(function (p) {
        p.vy += 0.3;
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.va;
        p.o -= 0.025;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.beginPath();
        ctx.moveTo(-p.len / 2, 0);
        ctx.lineTo(p.len / 2, 0);
        ctx.strokeStyle = 'rgba(30,30,30,' + p.o + ')';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      });
    }
    hairRafId = requestAnimationFrame(hairLoop);
  }

  function spawnHair(x, y) {
    if (reducedMotion) return;
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: x, y: y,
        len: Math.random() * 5 + 4,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2,
        a: Math.random() * Math.PI * 2,
        va: (Math.random() - 0.5) * 0.2,
        o: 1
      });
    }
  }

  // ---------- Состояние по кнопкам ----------
  const state = new WeakMap();

  function start(button, opts) {
    if (!button || state.has(button)) return;
    opts = opts || {};
    ensureCanvas();

    const originalHTML = button.innerHTML;
    const originalWidth = button.offsetWidth || 200;

    button.disabled = true;
    button.classList.add('btn-cutting');
    button.innerHTML = '<span class="btn-cutting-text">' + (opts.loadingText || 'Загрузка...') + '</span>';

    const scissors = document.createElement('div');
    scissors.className = 'btn-scissors';
    scissors.innerHTML = SCISSORS_SVG;
    button.appendChild(scissors);

    // Наполовину за левым краем на старте, наполовину за правым на финише
    const startLeft = -SCISSORS_WIDTH / 2;
    const endLeft = originalWidth - SCISSORS_WIDTH / 2;

    const entry = { originalHTML: originalHTML, scissors: scissors, rafId: null };
    state.set(button, entry);

    if (reducedMotion) {
      // Без анимации ножниц — просто держим их по центру кнопки
      scissors.style.left = (originalWidth / 2 - SCISSORS_WIDTH / 2) + 'px';
      return;
    }

    let progress = 0;
    let dir = 1;

    function frame() {
      if (!state.has(button)) return; // остановлено
      progress += dir * 1.8;
      if (progress >= 100) { progress = 100; dir = -1; }
      if (progress <= 0) { progress = 0; dir = 1; }

      const left = startLeft + (endLeft - startLeft) * (progress / 100);
      scissors.style.left = left + 'px';

      const rect = button.getBoundingClientRect();
      spawnHair(rect.left + left + SCISSORS_WIDTH * 0.8, rect.top + rect.height / 2);

      entry.rafId = requestAnimationFrame(frame);
    }
    entry.rafId = requestAnimationFrame(frame);
  }

  function stop(button, opts) {
    const entry = state.get(button);
    if (!entry) return;
    opts = opts || {};

    if (entry.rafId) cancelAnimationFrame(entry.rafId);
    state.delete(button); // помечаем как остановленное ДО удаления DOM (иначе frame() успеет выполниться ещё раз)
    if (entry.scissors && entry.scissors.parentNode) entry.scissors.remove();

    button.classList.remove('btn-cutting');
    button.innerHTML = (opts.text !== undefined) ? opts.text : entry.originalHTML;
    button.disabled = !!opts.keepDisabled;
  }

  return { start: start, stop: stop };
})();
