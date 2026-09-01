// js/core/global-cache.js - Пакетный кэш на 30 дней вперед (Часть 1)
const GlobalCache = {
  slots: {}, // Структура: { 'Дени': { '2026-08-10': [...] }, 'Бауди': {...} }
  isReady: false,
  isLoading: false,
  listeners: [],

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

  // Базовый запуск: теперь качает первые 30 дней от текущей даты
  preloadAllSlots: function() {
    this.initCacheStructure();

    if (sessionStorage.getItem('barberCacheLoaded') === 'true' && this.loadCache()) {
      this.notifyListeners();
      return;
    }

    // Загружаем первый стартовый пакет на 30 дней вперед
    this.preloadRange(0, 30);
  },

  // УНИВЕРСАЛЬНЫЙ МЕТОД: Скачивает любой указанный диапазон дней и пришивает к кэшу
  preloadRange: function(startOffset, endOffset, callback) {
    if (this.isLoading) return;
    this.isLoading = true;

    console.log(`🚀 [GlobalCache] Дозагрузка пакета дней с ${startOffset} по ${endOffset} вперед...`);

    const today = new Date();
    const activeMasters = Object.keys(this.slots);
    const dates = [];
    
    // Формируем сетку дат для запрашиваемого окна
    for (let i = startOffset; i < endOffset; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T'));
    }

    const promises = [];

    activeMasters.forEach(master => {
      dates.forEach(dateStr => {
        // Если данные по этому дню уже есть — не качаем заново, берем из памяти
        if (this.slots[master] && this.slots[master][dateStr]) return;

        const p = API.getFreeSlots(master, dateStr, 15)
          .then(data => {
            if (!this.slots[master]) this.slots[master] = {};
            this.slots[master][dateStr] = (data && data.success) ? data.slots : [];
          })
          .catch(() => {
            if (!this.slots[master]) this.slots[master] = {};
            this.slots[master][dateStr] = [];
          });
        promises.push(p);
      });
    });

    Promise.all(promises).then(() => {
      this.isReady = true;
      this.isLoading = false;
      this.saveCache(); // Перезаписываем sessionStorage, дополняя его новыми днями
      sessionStorage.setItem('barberCacheLoaded', 'true');
      console.log(`🎯 [GlobalCache] Пакет дней успешно докачан в память. Всего дат в кэше: ${Object.keys(this.slots[activeMasters[0]]).length}`);
      
      this.notifyListeners();
      if (typeof callback === 'function') callback();
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
