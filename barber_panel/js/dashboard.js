// barber_panel/js/dashboard.js
// ОТВЕЧАЕТ ЗА:
// - Управление текущей датой (навигация по дням)
// - Переключение между днями
// - Полную перезагрузку дня

const Dashboard = {
  currentDate: new Date(),

  init: function() {
    this.renderMasterColumns();
    this.updateDateDisplay();
    this.initEvents();
  },

  // ===== ГЕНЕРАЦИЯ КОЛОНОК МАСТЕРОВ =====
  // Строит разметку .dashboard-grid из ../js/data/masters.js — работает
  // для любого количества мастеров (1-50), без правки HTML вручную.
  // ВАЖНО: должна отработать до Sync.init()/columnToggle, поэтому
  // dashboard.js подключён в dashboard.html раньше js/sync.js.
  renderMasterColumns: function() {
    const grid = document.getElementById('dashboardGrid');
    if (!grid) return;

    // ВАЖНО: панель барберов всегда показывает мастеров ОБЕИХ версий сайта
    // (ALL_MASTERS из ../js/data/masters.js) — переключатель мужская/женская
    // на клиентском сайте не должен прятать от персонала часть записей.
    if (typeof ALL_MASTERS === 'undefined' || !Array.isArray(ALL_MASTERS) || ALL_MASTERS.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-secondary);padding:1rem;">Список мастеров пуст — добавьте мастера на странице "Мастера".</p>';
      return;
    }

    // При большом числе мастеров переключаем сетку в более компактный режим
    // (см. .dashboard-grid[data-density="compact"] в css/barber_styles.css)
    if (ALL_MASTERS.length > 4) {
      grid.setAttribute('data-density', 'compact');
    } else {
      grid.removeAttribute('data-density');
    }

    grid.innerHTML = ALL_MASTERS.map(m => `
      <div class="master-column" data-master="${m.name}">
        <div class="column-header" id="header${m.key}">
          <div class="master-avatar">
            <img src="../img/${m.avatar || 'placeholder-avatar.svg'}" alt="${m.name}" onerror="this.onerror=null;this.src='../img/placeholder-avatar.svg';" />
          </div>
          <div class="column-title">
            <h2>${m.name}</h2>
            <span class="master-status">${m.title || 'Барбер'}</span>
            <span class="master-rating-small" id="rating${m.key}"></span>
          </div>
          <button type="button" class="btn-pin-master" data-master="${m.name}" title="Показывать эту карточку первой на этом устройстве">
            <i class="fas fa-star"></i>
          </button>
          <button class="btn btn-accent btn-add-busy" data-master="${m.name}">
            <i class="fas fa-plus"></i> Занят
          </button>
        </div>
        <div class="column-content" id="content${m.key}">
          <div class="orders-list" id="orders${m.key}"></div>
        </div>
      </div>
    `).join('');

    // Запоминаем исходный порядок колонок (как в ../js/data/masters.js) —
    // нужен, чтобы при снятии "закрепления" вернуть карточки на их обычные
    // места, а не просто оставить их в том порядке, в каком они оказались
    // после последнего закрепления.
    this._originalColumns = Array.from(grid.children);

    this.applyMasterPinOrder();
    this.initMasterPinButtons();
  },

  // ===== "ЗАКРЕПИТЬ ПЕРВЫМ НА ЭТОМ УСТРОЙСТВЕ" =====
  // Мастер на СВОЁМ телефоне может отметить свою карточку, чтобы она
  // всегда открывалась первой (не нужно листать вниз до себя). Хранится
  // в localStorage — то есть чисто локально на этом телефоне/браузере,
  // ни с чем не синхронизируется и не влияет на то, что видят другие.
  PIN_STORAGE_KEY: 'pinnedMasterName',

  getPinnedMaster: function () {
    return localStorage.getItem(this.PIN_STORAGE_KEY) || null;
  },

  setPinnedMaster: function (name) {
    if (name) {
      localStorage.setItem(this.PIN_STORAGE_KEY, name);
    } else {
      localStorage.removeItem(this.PIN_STORAGE_KEY);
    }
  },

  // Переставляет DOM-узлы колонок (не пересоздаёт их!) — так все уже
  // навешенные обработчики (сворачивание, кнопка "Занят" и т.д.) и уже
  // отрисованные заказы остаются на месте, просто карточки меняются местами.
  applyMasterPinOrder: function () {
    const grid = document.getElementById('dashboardGrid');
    if (!grid || !this._originalColumns) return;

    const pinned = this.getPinnedMaster();
    const ordered = this._originalColumns.slice();

    if (pinned) {
      const idx = ordered.findIndex(el => el.dataset.master === pinned);
      if (idx > 0) {
        const [el] = ordered.splice(idx, 1);
        ordered.unshift(el);
      }
    }

    ordered.forEach(el => grid.appendChild(el));

    // Обновляем визуальное состояние кнопок закрепления
    grid.querySelectorAll('.btn-pin-master').forEach(btn => {
      const isPinned = pinned && btn.dataset.master === pinned;
      btn.classList.toggle('pinned', !!isPinned);
      btn.title = isPinned
        ? 'Убрать из первых на этом устройстве'
        : 'Показывать эту карточку первой на этом устройстве';
    });
  },

  initMasterPinButtons: function () {
    document.querySelectorAll('.btn-pin-master').forEach(btn => {
      if (btn.dataset.pinInitialized === 'true') return;
      btn.dataset.pinInitialized = 'true';

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.dataset.master;
        const current = this.getPinnedMaster();
        this.setPinnedMaster(current === name ? null : name);
        this.applyMasterPinOrder();
      });
    });
  },

  // ===== ОБНОВЛЕНИЕ ОТОБРАЖЕНИЯ ДАТЫ =====
  updateDateDisplay: function() {
    const display = document.getElementById('currentDateDisplay');
    if (display) {
      display.textContent = this.currentDate.toLocaleDateString('ru', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      display.dataset.date = this.currentDate.toISOString().split('T')[0];
    }
  },

  // ===== ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ НАВИГАЦИИ =====
  initEvents: function() {
    document.getElementById('prevDayBtn')?.addEventListener('click', () => {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
      this.updateDateDisplay();
      this.reloadDay();
    });

    document.getElementById('nextDayBtn')?.addEventListener('click', () => {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
      this.updateDateDisplay();
      this.reloadDay();
    });

    document.getElementById('todayBtn')?.addEventListener('click', () => {
      this.currentDate = new Date();
      this.updateDateDisplay();
      this.reloadDay();
    });
  },

  // ===== ПОЛНАЯ ПЕРЕЗАГРУЗКА ДНЯ =====
  // ВАЖНО: сбрасывает локальное состояние и загружает свежие данные
  reloadDay: function() {
    // 1. Очищаем контейнеры (для каждого мастера из ALL_MASTERS — ../js/data/masters.js)
    (typeof ALL_MASTERS !== 'undefined' ? ALL_MASTERS : []).forEach(m => {
      const el = document.getElementById(`orders${m.key}`);
      if (el) el.innerHTML = '';
    });

    // 2. Сбрасываем состояние синхронизации
    Sync.state.orders = [];
    Sync.state.busySlots = [];
    
    // ===== 3. ОБНОВЛЯЕМ LOCALSTORAGE =====
    // Удаляем все синхронизированные записи за текущую дату,
    // но сохраняем несинхронизированные
    const allBusy = JSON.parse(localStorage.getItem('busySlots') || '[]');
    const currentDate = this.currentDate.toISOString().split('T')[0];
    
    // Оставляем только несинхронизированные записи на сегодня
    // и все записи на другие даты
    const filteredBusy = allBusy.filter(b => 
      b.date !== currentDate || b.synced === false
    );
    localStorage.setItem('busySlots', JSON.stringify(filteredBusy));
    
    // Также обновляем состояние
    Sync.state.busySlots = filteredBusy.filter(b => b.status !== 'canceled');
    
    // 4. Обновляем время последней синхронизации
    Sync.lastSyncTime = new Date().toISOString();
    
    // 5. Загружаем заново
    Sync.performFullSync();
  }
};