// js/pages/slots-page.js - Мгновенный календарь и умный автопоиск (Часть 1)
const SlotsPage = {
  currentDate: null,
  currentMonth: null,
  currentYear: null,
  selectedDate: null,
  selectedTime: null,
  masterName: null,
  totalDuration: 0,

  init: function() {
    console.log('🏁 [SlotsPage] Запуск Шага 2 с защитой от Race Condition...');
    
    this.selectedDate = AppStorage.get('selectedDate');
    this.selectedTime = AppStorage.get('selectedTime');
    this.totalDuration = this.calculateTotalDuration();
    this.masterName = this.getMasterName();
    
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.currentDate = today;

    this._ensureSlotsWrapper();

    // ЗАЩИТА: Если пакетный кэш еще скачивается из Google Таблиц, блокируем UI и ждем
    if (typeof GlobalCache !== 'undefined') {
      if (GlobalCache.isReady && !GlobalCache.isLoading) {
        this.updateFromCache();
        this.renderCalendar();
        this._autoFocusDate();
      } else {
        this.showLoading(); // Включаем стильный спиннер из Части 3 CSS
        console.log('⏳ [SlotsPage] Пакетный кэш пуст или скачивается. Ждем завершения...');
        
        GlobalCache.addListener(() => {
          console.log('🎯 [SlotsPage] Пакетный кэш успешно получен! Активация календаря.');
          this.hideLoading();
          this.updateFromCache();
          this.renderCalendar();
          this._autoFocusDate();
        });
      }
    } else {
      this.renderCalendar();
      this._autoFocusDate();
    }
    
    this.initEvents();
  },

  _autoFocusDate: function() {
    const todayStr = typeof TimeUtils !== 'undefined' ? TimeUtils.getToday() : new Date().toISOString().split('T')[0];
    const defaultDate = this.selectedDate || todayStr;
    this.selectDate(defaultDate);
  },

  _ensureSlotsWrapper: function() {
    const container = document.getElementById('slotsContainer');
    if (container && !document.getElementById('slotsListWrapper')) {
      const wrapper = document.createElement('div');
      wrapper.id = 'slotsListWrapper';
      container.appendChild(wrapper);
    }
  },

  calculateTotalDuration: function() {
    const serviceIds = AppStorage.get('selectedServices', []);
    let total = 0;
    if (typeof services !== 'undefined') {
      serviceIds.forEach(id => {
        const service = services.find(s => String(s.id) === String(id));
        if (service) total += parseInt(service.duration, 10);
      });
    }
    return total || 15;
  },
// js/pages/slots-page.js - Мгновенный календарь и умный автопоиск (Часть 2)
  getMasterName: function() {
    const anyMaster = AppStorage.get('anyMaster');
    if (anyMaster) return null;
    
    const masterId = AppStorage.get('selectedMaster');
    if (masterId && typeof masters !== 'undefined') {
      const master = masters.find(m => String(m.id) === String(masterId));
      return master ? master.name : null;
    }
    return null;
  },

  updateFromCache: function() {
    if (!this.selectedDate) return;
    
    const masterName = this.masterName;
    const date = this.selectedDate;
    
    // Мгновенное извлечение слотов из пакетной памяти
    const slots = GlobalCache.getSlots(masterName, date, this.totalDuration);
    this.renderSlots(date, masterName || 'Любой барбер', slots);
  },

// js/pages/slots-page.js - Бесконечный календарь с автодозагрузкой пакетов дней

  renderCalendar: function() {
    const monthYear = document.getElementById('calendarMonthYear');
    const grid = document.getElementById('calendarGrid');
    if (!monthYear || !grid) return;

    monthYear.textContent = `${new Date(this.currentYear, this.currentMonth).toLocaleString('ru', { month: 'long' })} ${this.currentYear}`;

    const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    let html = daysOfWeek.map(d => `<div class="day-name">${d}</div>`).join('');

    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    let offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < offset; i++) html += `<div class="day-cell empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = dateStr < todayStr;

      let classes = 'day-cell';
      
      // ИСПРАВЛЕНО: Прошедшие дни блокируем, а ВСЕ будущие дни (хоть 35-й, хоть 65-й день) делаем доступными для клика!
      if (isPast) {
        classes += ' unavailable';
      } else {
        classes += ' available';
      }
      
      if (this.selectedDate === dateStr) {
        classes += ' selected';
      }
      
      html += `<div class="${classes}" data-date="${dateStr}">${d}</div>`;
    }

    grid.innerHTML = html;
    this._attachCalendarEvents();
  },

  _attachCalendarEvents: function() {
    const self = this;
    document.querySelectorAll('#calendarGrid .day-cell').forEach(cell => {
      cell.removeAttribute('onclick');
      cell.addEventListener('click', function() {
        const date = this.dataset.date;
        if (!date || this.classList.contains('empty') || this.classList.contains('unavailable')) return;
        
        self.selectedDate = date;
        AppStorage.save('selectedDate', date);
        
        document.querySelectorAll('#calendarGrid .day-cell').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        
        // ВЫЧИСЛЯЕМ РАССТОЯНИЕ В ДНЯХ ОТ СЕГОДНЯШНЕГО ДНЯ ДО ВЫБРАННОЙ ДАТЫ
        const today = new Date();
        const clickedDate = new Date(date);
        const diffTime = clickedDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Проверяем, есть ли уже данные по этому мастеру и дате в памяти
        const masterName = self.masterName || 'Дени'; // берем любого для базовой проверки наличия ключа даты
        const hasData = GlobalCache.slots[masterName] && GlobalCache.slots[masterName][date] !== undefined;

        if (hasData) {
          // Если данные уже скачаны ранее — выводим кнопки времени мгновенно за 0мс
          self.updateFromCache();
        } else {
          // ДАННЫХ НЕТ (Клиент ушел далеко вперед, например на 35-й или 65-й день)
          self.showLoading(); // Включаем спиннер
          
          // Динамически вычисляем границы нового пакетного окна кратными 30 дням
          const packetIndex = Math.floor(diffDays / 30); // для 35 дня это 1, для 65 дня это 2
          const startOffset = packetIndex * 30;          // для 35 дня это 30, для 65 дня это 60
          const endOffset = startOffset + 30;            // для 35 дня это 60, для 65 дня это 90

          // Запускаем принудительную дозагрузку пакета с сервера Google Таблиц
          GlobalCache.preloadRange(startOffset, endOffset, function() {
            self.hideLoading();
            self.updateFromCache(); // Мгновенно выводим появившееся время на экран!
          });
        }
      });
    });
  },

  // УМНЫЙ АЛГОРИТМ: Ищет ближайший день за 30 дней вперед, где есть окна для записи
  goToNearestAvailableDate: function() {
    console.log('🔍 [SlotsPage] Запуск сканирования памяти на ближайшую свободную дату...');
    const today = new Date();
    const masterName = this.masterName;
    
    for (let i = 0; i < 30; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      
      // Спрашиваем у пакетного кэша данные без единого запроса к сети
      const slots = GlobalCache.getSlots(masterName, dateStr, this.totalDuration);
      
      if (slots && slots.length > 0) {
        console.log(`🎯 [SlotsPage] Ближайшая дата найдена: ${dateStr}. Фокусируем календарь.`);
        
        // Меняем внутренний месяц и год календаря, если свободный день находится в следующем месяце
        this.currentMonth = targetDate.getMonth();
        this.currentYear = targetDate.getFullYear();
        
        this.renderCalendar();
        this.selectDate(dateStr);
        return;
      }
    }
    alert('⚠️ К сожалению, на ближайшие 30 дней все записи полностью заполнены.');
  },
// js/pages/slots-page.js - Мгновенный календарь и умный автопоиск (Часть 3)
  showSelectedMaster: function(masterName) {
    const info = document.getElementById('selectedMasterInfo');
    if (info) {
      info.innerHTML = `<i class="fas fa-cut" style="margin-right: 0.5rem;"></i> Барбер: <strong>${masterName}</strong>`;
      info.classList.add('visible');
    }
  },

  hideSelectedMaster: function() {
    const info = document.getElementById('selectedMasterInfo');
    if (info) info.classList.remove('visible');
  },

  renderSlots: function(date, masterName, slots) {
    const noSlotsMsg = document.getElementById('noSlotsMessage');
    const listWrapper = document.getElementById('slotsListWrapper');
    if (!listWrapper) return;

    this.hideLoading();
    listWrapper.innerHTML = '';

    if (!slots || slots.length === 0) {
      listWrapper.innerHTML = '<p class="slots-placeholder">На выбранный день все часы заняты</p>';
      if (noSlotsMsg) noSlotsMsg.style.display = 'block';
      this.hideSelectedMaster();
      return;
    }

    if (noSlotsMsg) noSlotsMsg.style.display = 'none';
    if (!AppStorage.get('anyMaster')) this.showSelectedMaster(masterName);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let filteredSlots = slots;
    if (date === todayStr) {
      const bufferMinutes = (typeof CONFIG !== 'undefined' && CONFIG.PREP_BUFFER !== undefined) 
        ? CONFIG.PREP_BUFFER 
        : 15;

      filteredSlots = slots.filter(slot => {
        const [h, m] = slot.split(':').map(Number);
        return (h * 60 + m) > currentMinutes + bufferMinutes;
      });
    }

    if (filteredSlots.length === 0) {
      listWrapper.innerHTML = '<p class="slots-placeholder">На сегодня свободного времени больше нет</p>';
      if (noSlotsMsg) noSlotsMsg.style.display = 'block';
      this.hideSelectedMaster();
      return;
    }

    const morning = filteredSlots.filter(s => s >= '10:00' && s < '12:00');
    const day = filteredSlots.filter(s => s >= '12:00' && s < '18:00');
    const evening = filteredSlots.filter(s => s >= '18:00');

    let html = '';
    if (morning.length) {
      html += `<div class="slot-group"><h4>Утреннее время</h4><div class="slots-list">${morning.map(s => `<button class="slot-btn ${this.selectedTime === s ? 'selected' : ''}" data-time="${s}">${s}</button>`).join('')}</div></div>`;
    }
    if (day.length) {
      html += `<div class="slot-group"><h4>Дневное время</h4><div class="slots-list">${day.map(s => `<button class="slot-btn ${this.selectedTime === s ? 'selected' : ''}" data-time="${s}">${s}</button>`).join('')}</div></div>`;
    }
    if (evening.length) {
      html += `<div class="slot-group"><h4>Вечернее время</h4><div class="slots-list">${evening.map(s => `<button class="slot-btn ${this.selectedTime === s ? 'selected' : ''}" data-time="${s}">${s}</button>`).join('')}</div></div>`;
    }

    listWrapper.innerHTML = html;
    this._attachSlotsEvents();
  },

  _attachSlotsEvents: function() {
    const self = this;
    document.querySelectorAll('#slotsListWrapper .slot-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('#slotsListWrapper .slot-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        self.selectedTime = this.dataset.time;
        AppStorage.save('selectedTime', this.dataset.time);
      });
    });
  },

  initEvents: function() {
    // Стрелки переключения месяцев
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
      if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
      else { this.currentMonth--; }
      this.renderCalendar();
    });

    document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
      if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
      else { this.currentMonth++; }
      this.renderCalendar();
    });

    // ОЖИВЛЕНИЕ КНОПКИ АВТОПОИСКА БЛИЖАЙШЕЙ ДАТЫ
    document.getElementById('goToNearestBtn')?.addEventListener('click', () => {
      this.goToNearestAvailableDate();
    });

    // Кнопка перехода к форме контактных данных клиента
    const toContactsBtn = document.getElementById('toContactsBtn');
    if (toContactsBtn) {
      toContactsBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const date = AppStorage.get('selectedDate');
        const time = AppStorage.get('selectedTime');
        if (!date || !time) {
          alert('⚠️ Пожалуйста, выберите дату и время визита.');
          return;
        }
        window.location.href = 'Contacts-form.html';
      });
    }
  },

  selectDate: function(dateStr) {
    this.selectedDate = dateStr;
    AppStorage.save('selectedDate', dateStr);
    
    document.querySelectorAll('#calendarGrid .day-cell').forEach(cell => {
      cell.classList.remove('selected');
      if (cell.dataset.date === dateStr) cell.classList.add('selected');
    });
    
    this.updateFromCache();
  },

  showLoading: function() {
    const loadingEl = document.getElementById('slotsLoading');
    const placeholderEl = document.getElementById('slotsPlaceholder');
    if (loadingEl) loadingEl.style.display = 'block';
    if (placeholderEl) placeholderEl.style.display = 'none';
  },

  hideLoading: function() {
    const loadingEl = document.getElementById('slotsLoading');
    const placeholderEl = document.getElementById('slotsPlaceholder');
    if (loadingEl) loadingEl.style.display = 'none';
    if (placeholderEl) placeholderEl.style.display = 'none';
  }
};


// Чтобы в следующем чате я мгновенно вспомнил всю архитектуру вашего проекта, просто скопируйте и отправьте мне этот короткий технический паспорт.
// Он содержит все ключевые изменения, кэш-структуру и логику, которую мы создали:

// Паспорт проекта: Барбершоп (Онлайн-запись)
// 1. Архитектура: Vanilla JS, SPA-навигация по data-page, бэкенд Google Apps Script.
// 2. Важное ядро: Модуль Storage переименован в AppStorage для исключения CORS-конфликта с window.Storage.
// 3. Пакетный кэш (global-cache.js): preloadAllSlots скачивает пакет данных на 30 дней вперед по всем мастерам сразу при входе. Данные хранятся глобально в sessionStorage.
// 4. Поллинг (checkChanges): Раз в 15 секунд отправляет точечный fetch-запрос к API только по одной выбранной дате, на которую смотрит клиент. На бэкенд улетает имя мастера (или пустая строка при автоподборе).
// 5. Страницы: 
// - home.js: Делегирование кликов по .masters-grid через e.target.closest('.master-card'), сохраняет ID мастера как строку.
// - services-page.js: Калькулятор складывает диапазоны цен (исправлен split массива parts) и суммирует длительность.
// - slots-page.js: Мгновенный рендеринг кнопок времени из кэша за 0мс. Применяет PREP_BUFFER из config.js. Метод goToNearestAvailableDate сканирует кэш на 30 дней вперед и переключает календарь на ближайшие окна.
// - contacts-page.js: Перед отправкой делает защитный перекрестный опрос getFreeSlots. При успехе убирает забронированный слот из локального кэша GlobalCache. slots[master][date].

// Просто отправьте этот текст в начале нового диалога, и я сразу смогу продолжить разработку с этой же точки.
// У нас остались невыпущенными два финальных скрипта: thank-you-page.js (электронный чек) и reviews-page.js (компактная лента отзывов). Готовы прислать их для упаковки или сделаем перерыв?

