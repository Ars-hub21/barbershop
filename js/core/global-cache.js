// js/core/global-cache.js - Пакетный кэш на 30 дней вперед (Часть 1)
const GlobalCache = {
  slots: {}, // Структура: { 'Дени': { '2026-08-10': [...] }, 'Бауди': {...} }
  isReady: false,
  isLoading: false,
  listeners: [],

  // РАЗМЕР ПАКЕТА ЗАГРУЗКИ (в днях). Раньше при первом заходе на сайт сразу
  // скачивался весь месяц (30 дней) по КАЖДОМУ мастеру параллельно одним
  // Promise.all — то есть мужская версия (2 мастера) слала 60 запросов к
  // Google Apps Script одновременно, а женская версия (5 мастеров) — уже
  // 150 запросов разом. У Apps Script есть лимит на число одновременных
  // выполнений скрипта — при таком всплеске часть запросов обрывалась с
  // ошибкой, и (см. ниже) эта ошибка раньше сохранялась в кэш как "слотов
  // нет" НАВСЕГДА, из-за чего казалось, что даты вообще не грузятся.
  // Теперь загрузка идёт пакетами по BATCH_SIZE дней: сначала только первые
  // 14 дней по всем существующим мастерам (не важно, 1 их или больше), а
  // следующие 14 дней подгружаются пакетно только когда клиент реально
  // пролистал календарь дальше уже загруженного диапазона (см.
  // ensureLoadedThrough ниже и js/pages/slots-page.js).
  BATCH_SIZE: 14,

  // Сколько дней от сегодня уже гарантированно загружены в кэш (пакетами
  // по BATCH_SIZE). Восстанавливается из sessionStorage вместе с самим кэшем.
  loadedDays: 0,

  initCacheStructure: function() {
    if (typeof masters !== 'undefined' && Array.isArray(masters)) {
      masters.forEach(m => {
        if (m.name && !this.slots[m.name]) this.slots[m.name] = {};
      });
    } else {
      this.slots = { 'Дени': {}, 'Бауди': {} };
    }
  },

  saveCache: function() {
    try {
      sessionStorage.setItem('barberCacheData', JSON.stringify(this.slots));
      sessionStorage.setItem('barberCacheLoaded', 'true');
      console.log('💾 [GlobalCache] Весь месячный пакет успешно сохранен в sessionStorage');
    } catch (e) {
      console.warn('[GlobalCache] Не удалось сохранить кэш:', e);
    }
  },

  loadCache: function() {
    try {
      const data = sessionStorage.getItem('barberCacheData');
      if (data) {
        this.slots = JSON.parse(data);
        this.isReady = true;
        console.log('✅ [GlobalCache] Пакетный кэш на 30 дней успешно восстановлен из sessionStorage');
        return true;
      }
    } catch (e) {
      console.warn('[GlobalCache] Ошибка восстановления кэша:', e);
    }
    return false;
  },

  // ГЛАВНЫЙ МЕТОД: Пакетный сбор данных при первом посещении главной страницы
  // ОБНОВЛЕННЫЙ МЕТОД: Пакетный сбор работает на любой странице, если кэш пуст
// js/core/global-cache.js - Бесконечный докачиваемый кэш (Кусок для замены)

  // Базовый запуск: теперь качает только первый пакет (BATCH_SIZE дней)
  // от текущей даты — остальное подгружается по требованию (см.
  // ensureLoadedThrough).
  preloadAllSlots: function() {
    this.initCacheStructure();

    if (sessionStorage.getItem('barberCacheLoaded') === 'true' && this.loadCache()) {
      // Восстанавливаем из sessionStorage вместе с кэшем и то, сколько дней
      // уже было загружено пакетами — иначе после перезагрузки страницы
      // счётчик обнулился бы и календарь думал бы, что загружен только
      // первый пакет, даже если пользователь уже пролистал дальше.
      const savedLoadedDays = parseInt(sessionStorage.getItem('barberCacheLoadedDays') || '0', 10);
      this.loadedDays = savedLoadedDays > 0 ? savedLoadedDays : this.BATCH_SIZE;
      this.notifyListeners();
      return;
    }

    // Загружаем первый стартовый пакет — BATCH_SIZE (14) дней вперед
    this.preloadRange(0, this.BATCH_SIZE);
  },

  // УНИВЕРСАЛЬНЫЙ МЕТОД: Скачивает любой указанный диапазон дней и пришивает
  // к кэшу — ОДНИМ POST-запросом через уже существующее на бэкенде действие
  // 'getFreeSlotsBatch' (см. Router.gs/Slots.gs), а не отдельным GET-запросом
  // на КАЖДОГО мастера и КАЖДЫЙ день по отдельности. Раньше пакет в 14/30
  // дней превращался в дни×мастеров одновременных запросов (60 для мужской
  // версии, 150 для женской) — Google Apps Script ограничивает число
  // одновременных выполнений скрипта, и часть запросов при таком всплеске
  // обрывалась с ошибкой. Один POST с массивом дат и мастеров решает это
  // полностью — сервер сам проходит по датам в цикле и отдаёт всё разом.
  preloadRange: function(startOffset, endOffset, callback) {
    if (this.isLoading) return;
    this.isLoading = true;

    console.log(`🚀 [GlobalCache] Дозагрузка пакета дней с ${startOffset} по ${endOffset} вперед (один batch-запрос)...`);

    const today = new Date();
    const activeMasters = Object.keys(this.slots);
    const dates = [];

    // Формируем сетку дат для запрашиваемого окна
    for (let i = startOffset; i < endOffset; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      // ИСПРАВЛЕНО: не хватало [0] — split('T') без индекса возвращал массив
      // ['2026-09-07', '12:00:00.000Z'] целиком, и дата в кэше сохранялась
      // под ключом-строкой "2026-09-07,12:00:00.000Z" вместо "2026-09-07".
      // Из-за этого календарь и главная страница (которые ищут слоты по
      // обычной дате "YYYY-MM-DD") никогда не находили уже скачанные данные —
      // ключи физически не совпадали, и слоты выглядели пустыми/"Запись
      // закрыта" почти постоянно, а не только в момент загрузки.
      dates.push(d.toISOString().split('T')[0]);
    }

    // Не запрашиваем повторно дни, которые уже реально есть в кэше хотя бы
    // у одного мастера (сравниваем по первому мастеру — все мастера
    // загружаются одним и тем же пакетным запросом, так что либо загружены
    // все сразу, либо ни один).
    const firstMaster = activeMasters[0];
    const datesToFetch = dates.filter(dateStr => !(this.slots[firstMaster] && this.slots[firstMaster][dateStr] !== undefined));

    if (datesToFetch.length === 0 || activeMasters.length === 0) {
      this.isReady = true;
      this.isLoading = false;
      this.loadedDays = Math.max(this.loadedDays, endOffset);
      this.notifyListeners();
      if (typeof callback === 'function') callback();
      return;
    }

    API.post('getFreeSlotsBatch', { masters: activeMasters, dates: datesToFetch, duration: 15 })
      .then(data => {
        const batch = (data && data.success && data.slots) ? data.slots : null;

        activeMasters.forEach(master => {
          if (!this.slots[master]) this.slots[master] = {};
          datesToFetch.forEach(dateStr => {
            // ВАЖНО: при ошибке сервера НЕ записываем "[]" — оставляем день
            // незагруженным (undefined), чтобы его можно было спокойно
            // повторить позже (например, точечным поллингом checkChanges,
            // как только клиент откроет именно этот день), а не запомнить
            // навсегда как "слотов нет" из-за одного временного сбоя.
            if (batch && batch[master] && batch[master][dateStr] !== undefined) {
              this.slots[master][dateStr] = batch[master][dateStr];
            }
          });
        });
      })
      .catch(() => {
        // Сетевая ошибка на весь пакет — та же логика: ничего не кэшируем
        // как пустое, просто оставляем эти дни незагруженными для повтора.
      })
      .then(() => {
        this.isReady = true;
        this.isLoading = false;
        this.loadedDays = Math.max(this.loadedDays, endOffset);
        this.saveCache(); // Перезаписываем sessionStorage, дополняя его новыми днями
        sessionStorage.setItem('barberCacheLoaded', 'true');
        sessionStorage.setItem('barberCacheLoadedDays', String(this.loadedDays));
        console.log(`🎯 [GlobalCache] Пакет дней успешно докачан в память (загружено дней от сегодня: ${this.loadedDays}).`);

        this.notifyListeners();
        if (typeof callback === 'function') callback();
      });
  },

  // НОВОЕ: гарантирует, что дни вплоть до targetOffsetDays (включительно)
  // уже загружены в кэш — если нет, докачивает следующие пакеты по
  // BATCH_SIZE дней один за другим (а не сразу весь недостающий диапазон),
  // пока не покроет нужный день. Используется календарём (slots-page.js),
  // когда клиент листает дальше уже загруженного окна.
  ensureLoadedThrough: function(targetOffsetDays, callback) {
    if (targetOffsetDays < this.loadedDays) {
      if (typeof callback === 'function') callback();
      return;
    }
    const nextStart = this.loadedDays;
    const nextEnd = nextStart + this.BATCH_SIZE;
    this.preloadRange(nextStart, nextEnd, () => {
      this.ensureLoadedThrough(targetOffsetDays, callback);
    });
  },


// js/core/global-cache.js - Пакетный кэш на 30 дней вперед (Часть 2)
  getSlots: function(masterName, date, duration = 15) {
    // Режим "Любой специалист": склеиваем уникальные доступные слоты от всех мастеров
    if (!masterName) {
      return this.getCombinedSlotsForAnyMaster(date, duration);
    }

    if (this.slots[masterName] && this.slots[masterName][date]) {
      return this.filterSlotsByDuration(this.slots[masterName][date], duration);
    }
    return []; // Возвращаем пустой массив вместо null для предотвращения падения UI
  },

  getCombinedSlotsForAnyMaster: function(date, duration) {
    const allUniqueSlots = new Set();
    Object.keys(this.slots).forEach(master => {
      if (this.slots[master] && this.slots[master][date]) {
        const filtered = this.filterSlotsByDuration(this.slots[master][date], duration);
        filtered.forEach(slot => allUniqueSlots.add(slot));
      }
    });
    return Array.from(allUniqueSlots).sort();
  },

  filterSlotsByDuration: function(slots, duration) {
    if (!slots || slots.length === 0) return [];
    if (duration <= 15) return slots; 
    
    const requiredIntervals = Math.ceil(duration / 15);
    const slotsSet = new Set(slots);
    
    return slots.filter(slot => {
      const [h, m] = slot.split(':').map(Number);
      let currentMinutes = h * 60 + m;
      
      for (let i = 1; i < requiredIntervals; i++) {
        const nextMinutes = currentMinutes + (i * 15);
        const nextH = Math.floor(nextMinutes / 60);
        const nextM = nextMinutes % 60;
        const nextSlotStr = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
        
        if (!slotsSet.has(nextSlotStr)) {
          return false; 
        }
      }
      return true;
    });
  },

  updateSlots: function(masterName, date, slots) {
    if (!this.slots[masterName]) this.slots[masterName] = {};
    this.slots[masterName][date] = slots;
    this.saveCache();
    this.notifyListeners();
  },

  addListener: function(callback) {
    this.listeners.push(callback);
    if (this.isReady) callback();
  },

  notifyListeners: function() {
    this.listeners.forEach(callback => {
      try { callback(); } catch (e) { console.error('Ошибка в слушателе кэша:', e); }
    });
  },

  // ТОЧЕЧНОЕ ОБНОВЛЕНИЕ РАЗ В 15 СЕКУНД (Поллинг без перегрузки сервера)
  checkChanges: function() {
    const page = document.body.dataset.page;
    // Проверяем изменения только на шагах, где клиент смотрит на расписание
    if (page !== 'slots' && page !== 'contacts') return;

    const selectedDate = AppStorage.get('selectedDate');
    if (!selectedDate) return;

    let targetMaster = AppStorage.get('selectedMaster');
    if (targetMaster && typeof masters !== 'undefined') {
      const found = masters.find(m => String(m.id) === String(targetMaster));
      targetMaster = found ? found.name : null;
    } else if (AppStorage.get('anyMaster')) {
      targetMaster = null; 
    }

    // Если мастер конкретный — опрашиваем только его, если "Любой" — опрашиваем всех барберов по очереди
    const mastersToPoll = targetMaster ? [targetMaster] : Object.keys(this.slots);

    mastersToPoll.forEach(master => {
      if (!this.slots[master]) return;
      const oldSlots = this.slots[master][selectedDate] || [];

      // Запрашиваем из Google Таблиц обновления ТОЛЬКО по одной этой рассматриваемой дате
      API.getFreeSlots(master, selectedDate, 15).then(data => {
        if (data && data.success) {
          const newSlots = data.slots || [];
          const oldSet = new Set(oldSlots);
          const newSet = new Set(newSlots);
          
          // Вычисляем, изменилось ли что-то внутри массивов времени
          const hasChanges = oldSlots.some(s => !newSet.has(s)) || newSlots.some(s => !oldSet.has(s));
          
          if (hasChanges) {
            this.slots[master][selectedDate] = newSlots;
            this.saveCache(); // Сохраняем обновленный срез в sessionStorage
            console.log(`🔄 [GlobalCache] Тихий поллинг выявил изменения для ${master} на ${selectedDate}. Интерфейс перерисован.`);
            this.notifyListeners(); // Автоматически заставляем SlotsPage обновить кнопки на экране
          }
        }
      }).catch(err => console.warn('[GlobalCache] Ошибка фоновой синхронизации:', err));
    });
  }
};
