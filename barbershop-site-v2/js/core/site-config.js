/* ==========================================================================
   js/core/site-config.js — ЕДИНАЯ ТОЧКА НАСТРОЙКИ САЛОНА
   ==========================================================================
   Этот файл нужно подключать ПЕРВЫМ в <head>, ДО ссылки на css/theme.css —
   тогда тема применится ещё до отрисовки страницы и не будет "мигания".

   Меняя ТОЛЬКО этот файл, можно:
   1) переключить весь сайт между мужской ("угольной") и женской
      ("бархатной") версией оформления;
   2) поменять название салона, адрес и короткий слоган-тэглайн на всех
      страницах сразу, не редактируя каждый HTML-файл вручную.

   ЭТОТ ФАЙЛ НЕ КАСАЕТСЯ БАЗЫ ДАННЫХ И API. Адрес API (Google Apps Script)
   по-прежнему настраивается только в js/core/config.js — сюда не лезем.
   ========================================================================== */

// ЧАСТЬ 1. ТЕМА ОФОРМЛЕНИЯ
// Допустимые значения: 'masculine' (угольная мужская) или 'feminine' (бархатная женская).
// Сами палитры цветов/шрифтов описаны в css/theme.css.
const SALON_THEME = 'masculine';

// ЧАСТЬ 2. БРЕНД САЛОНА
const BRAND = {
  // Название, которое подставляется в <title> вместо "БАРБЕРШОП"
  name: 'БАРБЕРШОП',

  // Текст адреса в шапке всех страниц (иконка рядом добавляется автоматически)
  addressText: 'Урус-Мартан, ул. им. Шейха Солса-Хаджи Яндарова, 147',

  // Короткий слоган под шапкой на главной странице.
  // Показывается только если showTagline: true.
  tagline: 'Стиль начинается с деталей',
  showTagline: true,

  // Название роли мастера по умолчанию (используется, если у мастера
  // в js/data/masters.js не указано своё поле title)
  roleLabel: 'Барбер'
};

// ЧАСТЬ 3. ПРИМЕНЕНИЕ (ничего менять не нужно)
(function () {
  var root = document.documentElement;
  root.setAttribute('data-theme', SALON_THEME);

  function applyBrand() {
    // Адрес в шапке — во всех вариантах разметки заголовка
    document.querySelectorAll('.address-text').forEach(function (el) {
      el.textContent = BRAND.addressText;
    });

    // Заголовок вкладки браузера: подменяем только "БАРБЕРШОП",
    // остальная часть (например, "— Онлайн-бронирование") сохраняется
    if (document.title.indexOf('БАРБЕРШОП') !== -1) {
      document.title = document.title.split('БАРБЕРШОП').join(BRAND.name);
    }

    // Слоган на главной странице
    var taglineEl = document.querySelector('.brand-tagline');
    if (taglineEl) {
      if (BRAND.showTagline && BRAND.tagline) {
        taglineEl.textContent = BRAND.tagline;
        taglineEl.hidden = false;
      } else {
        taglineEl.hidden = true;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrand);
  } else {
    applyBrand();
  }
})();
