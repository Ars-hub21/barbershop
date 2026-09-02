/* ==========================================================================
   js/core/site-config.js — ЕДИНАЯ ТОЧКА НАСТРОЙКИ САЛОНА
   ==========================================================================
   Этот файл нужно подключать ПЕРВЫМ в <head>, ДО ссылки на css/theme.css —
   тогда тема применится ещё до отрисовки страницы и не будет "мигания".

   С появлением переключателя "Мужская / Женская версия" этот файл работает
   так:
   1) Читает выбор посетителя из localStorage (ключ salonGender, значения
      'masculine' или 'feminine'). Если выбора ещё нет — по умолчанию
      показывается мужская версия (барбершоп).
   2) На основе этого выбора подставляет нужный набор бренда (BRAND_BY_GENDER
      ниже) и нужную визуальную тему (data-theme, палитры — в css/theme.css).
   3) Даёт остальным скриптам простое API window.SalonGender для чтения и
      переключения версии — им пользуется js/core/gender-toggle.js (кнопка-
      переключатель в шапке) и js/data/masters.js, js/data/services.js,
      js/data/gallery.js (чтобы показывать нужный набор мастеров/услуг/фото).

   ЭТОТ ФАЙЛ НЕ КАСАЕТСЯ БАЗЫ ДАННЫХ И API. Адрес API (Google Apps Script)
   по-прежнему настраивается только в js/core/config.js — сюда не лезем.
   ========================================================================== */

// ЧАСТЬ 1. ЧТЕНИЕ ТЕКУЩЕЙ ВЕРСИИ САЙТА ИЗ localStorage
// Допустимые значения: 'masculine' (мужской барбершоп) или 'feminine'
// (женский салон красоты). Хранится в браузере посетителя — у каждого
// устройства выбор свой, ничего не отправляется на сервер.
function _readSalonGender() {
  try {
    var stored = window.localStorage ? localStorage.getItem('salonGender') : null;
    return stored === 'feminine' ? 'feminine' : 'masculine';
  } catch (e) {
    // localStorage может быть недоступен (приватный режим и т.п.) — используем мужскую версию по умолчанию
    return 'masculine';
  }
}

const SALON_THEME = _readSalonGender();

// ЧАСТЬ 2. БРЕНД САЛОНА — ОТДЕЛЬНЫЙ НАБОР ДЛЯ КАЖДОЙ ВЕРСИИ
const BRAND_BY_GENDER = {
  masculine: {
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
  },

  feminine: {
    // ⚠️ ПЛЕЙСХОЛДЕР — замените на реальное название вашего салона
    name: 'САЛОН КРАСОТЫ',

    addressText: 'Урус-Мартан, ул. им. Шейха Солса-Хаджи Яндарова, 147',

    tagline: 'Красота в каждой детали',
    showTagline: true,

    roleLabel: 'Мастер'
  }
};

const BRAND = BRAND_BY_GENDER[SALON_THEME];

// ЧАСТЬ 3. ПЕРЕКЛЮЧЕНИЕ ВЕРСИИ САЙТА — простое API для остальных скриптов
// Используется кнопкой-переключателем (js/core/gender-toggle.js), но можно
// вызывать и вручную из консоли для проверки: SalonGender.toggle()
window.SalonGender = {
  get: function () {
    return SALON_THEME;
  },
  set: function (gender) {
    var value = gender === 'feminine' ? 'feminine' : 'masculine';
    try {
      localStorage.setItem('salonGender', value);
    } catch (e) { /* localStorage недоступен — переключение всё равно применится через reload не будет сохранено, но не ломаем страницу */ }
    location.reload();
  },
  toggle: function () {
    this.set(SALON_THEME === 'feminine' ? 'masculine' : 'feminine');
  }
};

// ЧАСТЬ 4. ПРИМЕНЕНИЕ (ничего менять не нужно)
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
