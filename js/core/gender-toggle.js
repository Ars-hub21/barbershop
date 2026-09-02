/* ==========================================================================
   js/core/gender-toggle.js — Переключатель "Мужская / Женская" версия сайта
   ==========================================================================
   Добавляет в шапку каждой клиентской страницы понятный переключатель —
   по типу кнопки тёмная/светлая тема — которым посетитель сам выбирает,
   что ему показать: мужской барбершоп или женский салон красоты.

   Выбор сохраняется в localStorage (ключ salonGender) и применяется полной
   перезагрузкой страницы — так согласованно переключаются сразу все части
   сайта: цвета и шрифты (css/theme.css через data-theme), название и адрес
   салона (js/core/site-config.js → BRAND), список мастеров
   (js/data/masters.js), прайс-лист (js/data/services.js) и галерея работ
   (js/data/gallery.js).

   Подключайте этот файл на КЛИЕНТСКИХ страницах сайта, СРАЗУ ПОСЛЕ
   js/core/site-config.js (нужен window.SalonGender). В панели барберов
   (barber_panel/) этот файл НЕ подключается — персонал всегда должен
   видеть и мужских, и женских мастеров одновременно (см. ALL_MASTERS
   в js/data/masters.js).

   ЭТОТ ФАЙЛ НЕ КАСАЕТСЯ БАЗЫ ДАННЫХ И API.
   ========================================================================== */
(function () {
  var STYLE_ID = 'salonGenderToggleStyles';

  var CSS = ''
    + '.salon-gender-toggle{position:relative;display:inline-flex;align-items:center;'
    + 'width:172px;height:42px;flex-shrink:0;border-radius:999px;padding:3px;'
    + 'border:1px solid rgba(255,255,255,0.16);background:rgba(0,0,0,0.28);'
    + 'cursor:pointer;box-shadow:inset 0 1px 3px rgba(0,0,0,0.35);'
    + 'font-family:var(--font-body,sans-serif);-webkit-tap-highlight-color:transparent;}'
    + '.salon-gender-toggle:focus-visible{outline:2px solid var(--accent,#c5a059);outline-offset:2px;}'
    + '.salon-gender-toggle .sgt-knob{position:absolute;top:3px;left:3px;'
    + 'width:calc(50% - 3px);height:calc(100% - 6px);border-radius:999px;z-index:1;'
    + 'background:linear-gradient(135deg,#c5a059,#e7c88d);'
    + 'box-shadow:0 2px 6px rgba(0,0,0,0.35);'
    + 'transition:transform .32s cubic-bezier(.25,.8,.25,1),background .32s;}'
    + '.salon-gender-toggle[data-active="feminine"] .sgt-knob{'
    + 'transform:translateX(100%);background:linear-gradient(135deg,#d9a5b0,#f0c9cf);}'
    + '.salon-gender-toggle .sgt-option{position:relative;z-index:2;flex:1 1 50%;'
    + 'display:flex;align-items:center;justify-content:center;gap:5px;'
    + 'font-size:.66rem;font-weight:700;letter-spacing:.2px;white-space:nowrap;'
    + 'color:rgba(255,255,255,0.55);transition:color .32s;pointer-events:none;}'
    + '.salon-gender-toggle .sgt-option i{font-size:.78rem;}'
    + '.salon-gender-toggle[data-active="masculine"] .sgt-masculine,'
    + '.salon-gender-toggle[data-active="feminine"] .sgt-feminine{color:#211705;}'
    + '@media (max-width:480px){'
    + '.salon-gender-toggle{width:88px;}'
    + '.salon-gender-toggle .sgt-text{display:none;}'
    + '.salon-gender-toggle .sgt-option i{font-size:1rem;}'
    + '}';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildToggle(current) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'salonGenderToggle';
    btn.className = 'salon-gender-toggle';
    btn.setAttribute('data-active', current);
    btn.setAttribute('aria-label', 'Переключить версию сайта: мужской барбершоп или женский салон красоты. Сейчас: ' + (current === 'feminine' ? 'женская версия' : 'мужская версия'));
    btn.title = 'Мужская версия (барбершоп) / Женская версия (салон красоты)';

    btn.innerHTML =
      '<span class="sgt-knob"></span>' +
      '<span class="sgt-option sgt-masculine"><i class="fas fa-scissors"></i><span class="sgt-text">Мужская</span></span>' +
      '<span class="sgt-option sgt-feminine"><i class="fas fa-hand-sparkles"></i><span class="sgt-text">Женская</span></span>';

    btn.addEventListener('click', function () {
      if (window.SalonGender && typeof window.SalonGender.toggle === 'function') {
        window.SalonGender.toggle();
      }
    });

    return btn;
  }

  function inject() {
    if (document.getElementById('salonGenderToggle')) return;
    if (!window.SalonGender || typeof window.SalonGender.get !== 'function') return;

    ensureStyles();

    var current = window.SalonGender.get();
    var toggle = buildToggle(current);

    var host = document.querySelector('.header-content')
      || document.querySelector('.header .container')
      || document.querySelector('.header');

    if (host) {
      host.appendChild(toggle);
    } else {
      // Совсем без шапки — на всякий случай добавляем в начало страницы
      document.body.insertBefore(toggle, document.body.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
