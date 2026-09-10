// barber_panel/js/dashboard-controls.js
// ОТВЕЧАЕТ ЗА:
// - Попап "Настройки экрана" — сколько столбцов мастеров показывать на
//   главном экране панели (вместо только автоматического режима "compact"
//   при 5+ мастерах — теперь барбер сам может задать число).
// - Фильтр "Мужчины / Женщины / Все" — какие колонки мастеров показывать
//   на дашборде, по аналогии с переключателем мужской/женской версии на
//   клиентском сайте (js/core/gender-toggle.js). Это ЧИСТО ВИЗУАЛЬНЫЙ
//   фильтр, локальный для этого устройства/браузера (localStorage) — он
//   не трогает данные заказов/занятости, не влияет на синхронизацию и не
//   меняет, что видят клиенты. Скрытые колонки остаются в DOM и продолжают
//   получать новые заказы/занятость как обычно — просто не отображаются,
//   пока фильтр не переключат обратно.
//
// ЭТОТ ФАЙЛ НЕ ТРОГАЕТ js/core/api.js, js/core/config.js,
// js/core/global-cache.js, js/core/storage.js и barber_panel/js/api.js —
// только localStorage и DOM/CSS.

const DashboardControls = {
  COLUMN_COUNT_KEY: 'dashboardColumnCount', // 'auto' | '1'..'8'
  GENDER_FILTER_KEY: 'panelMasterGenderFilter', // 'all' | 'masculine' | 'feminine'

  init: function () {
    const grid = document.getElementById('dashboardGrid');
    if (!grid) return; // не страница дашборда

    this.applyColumnCount(this.getColumnCount());
    this.applyGenderFilter(this.getGenderFilter());
    this.initSettingsPopup();
    this.initGenderFilterUI();
  },

  /* ============================== СТОЛБЦЫ ============================== */

  getColumnCount: function () {
    return localStorage.getItem(this.COLUMN_COUNT_KEY) || 'auto';
  },

  setColumnCount: function (value) {
    localStorage.setItem(this.COLUMN_COUNT_KEY, value);
    this.applyColumnCount(value);
  },

  applyColumnCount: function (value) {
    const grid = document.getElementById('dashboardGrid');
    if (!grid) return;

    if (!value || value === 'auto') {
      // Возвращаем автоматическое поведение из barber_styles.css
      // (columns: 2, с потолком в 1 колонку на экранах ≤780px).
      grid.removeAttribute('data-columns');
      grid.style.columnWidth = '';
      grid.style.columnCount = '';
    } else {
      // ВАЖНО: помимо инлайн-стиля (который в теории и так должен
      // перекрывать правила из внешнего CSS-файла) дублируем выбор через
      // атрибут data-columns с соответствующими правилами !important в
      // dashboard-controls.css — это исключает любые скрытые нестыковки
      // каскада (например, если где-то в стилях появится своё !important)
      // и делает выбранное число колонок легко проверить прямо в DOM
      // через инструменты разработчика.
      grid.setAttribute('data-columns', value);
      // columnWidth должен быть сброшен в auto — иначе "columns" (шорткат)
      // продолжит учитывать ширину и итоговое число колонок не совпадёт
      // с тем, что выбрал барбер.
      grid.style.columnWidth = 'auto';
      grid.style.columnCount = value;
    }
  },

  /* ============================== ПОПАП НАСТРОЕК ============================== */

  initSettingsPopup: function () {
    const openBtn = document.getElementById('dashboardSettingsBtn');
    const popup = document.getElementById('dashboardSettingsPopup');
    const closeBtn = document.getElementById('settingsPopupClose');
    const select = document.getElementById('columnCountSelect');
    if (!openBtn || !popup || !select) return;

    select.value = this.getColumnCount();

    openBtn.addEventListener('click', () => {
      select.value = this.getColumnCount();
      popup.style.display = 'flex';
    });

    closeBtn?.addEventListener('click', () => {
      popup.style.display = 'none';
    });

    popup.addEventListener('click', (e) => {
      if (e.target === popup) popup.style.display = 'none';
    });

    select.addEventListener('change', () => {
      this.setColumnCount(select.value);
    });
  },

  /* ============================== ФИЛЬТР ПОЛА МАСТЕРОВ ============================== */

  getGenderFilter: function () {
    return localStorage.getItem(this.GENDER_FILTER_KEY) || 'all';
  },

  setGenderFilter: function (value) {
    localStorage.setItem(this.GENDER_FILTER_KEY, value);
    this.applyGenderFilter(value);
  },

  applyGenderFilter: function (value) {
    const grid = document.getElementById('dashboardGrid');
    if (!grid) return;

    grid.querySelectorAll('.master-column[data-gender]').forEach(col => {
      const matches = value === 'all' || col.dataset.gender === value;
      col.classList.toggle('gender-filtered-out', !matches);
    });

    document.querySelectorAll('#panelGenderFilter .pgf-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  },

  initGenderFilterUI: function () {
    const box = document.getElementById('panelGenderFilter');
    if (!box) return;

    box.querySelectorAll('.pgf-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setGenderFilter(btn.dataset.value);
      });
    });

    // Колонки мастеров рендерятся в dashboard.js ДО подключения этого файла
    // (см. порядок <script> в dashboard.html), поэтому к этому моменту
    // data-gender уже расставлен — применяем сохранённый фильтр сразу.
    this.applyGenderFilter(this.getGenderFilter());
  }
};

document.addEventListener('DOMContentLoaded', function () {
  DashboardControls.init();
});
