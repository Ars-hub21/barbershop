// barber_panel/js/busy-popup.js
// ОТВЕЧАЕТ ЗА:
// - Открытие/закрытие попапа добавления занятости
// - Создание новой занятости (локально + синхронизация с сервером)
// - Обновление статуса синхронизации

// ===== ФУНКЦИЯ ГЕНЕРАЦИИ ID КАК НА СЕРВЕРЕ =====
function generateBusyId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BUS-${datePart}-${random}`;
}

const BusyPopup = {
  init: function() {
    this.popup = document.getElementById('busyPopup');
    this.closeBtn = document.getElementById('popupClose');
    this.saveBtn = document.getElementById('popupSave');
    
    this.initAddButtons();
    this.initCloseEvents();
    this.initSaveEvent();
  },

  // ===== ИНИЦИАЛИЗАЦИЯ КНОПОК "ЗАНЯТ" =====
  initAddButtons: function() {
    document.querySelectorAll('.btn-add-busy').forEach(btn => {
      btn.addEventListener('click', () => {
        const master = btn.dataset.master;
        const date = document.getElementById('currentDateDisplay').dataset.date;
        
        document.getElementById('popupMaster').value = master;
        document.getElementById('popupDate').value = date;
        this.popup.style.display = 'flex';
      });
    });
  },

  // ===== ИНИЦИАЛИЗАЦИЯ ЗАКРЫТИЯ ПОПАПА =====
  initCloseEvents: function() {
    this.closeBtn?.addEventListener('click', () => {
      this.popup.style.display = 'none';
    });

    this.popup?.addEventListener('click', (e) => {
      if (e.target === this.popup) {
        this.popup.style.display = 'none';
      }
    });
  },

  // ===== СОХРАНЕНИЕ НОВОЙ ЗАНЯТОСТИ =====
  initSaveEvent: function() {
    this.saveBtn?.addEventListener('click', () => {
      const master = document.getElementById('popupMaster').value;
      const date = document.getElementById('popupDate').value;
      const start = document.getElementById('popupStart').value;
      const end = document.getElementById('popupEnd').value;
      const price = document.getElementById('popupPrice').value;
      const reason = document.getElementById('popupReason').value;

      // ===== ВАЛИДАЦИЯ =====
      if (!start || !end) {
        alert('Выберите время начала и окончания.');
        return;
      }

      if (start >= end) {
        alert('Время окончания должно быть позже времени начала.');
        return;
      }

      // Проверяем пересечение с существующей занятостью
      const existingBusy = JSON.parse(localStorage.getItem('busySlots') || '[]');
      const isOverlap = existingBusy.some(b => 
        b.masterName === master && 
        b.date === date && 
        b.start < end && 
        b.end > start &&
        b.status !== 'canceled'
      );

      if (isOverlap) {
        alert('Это время пересекается с существующей занятостью.');
        return;
      }

      // ===== ГЕНЕРИРУЕМ ID КАК НА СЕРВЕРЕ =====
      const busyId = generateBusyId();
      
      const busyData = {
        id: busyId,
        masterName: master,
        date: date,
        start: start,
        end: end,
        price: price || 0,
        reason: reason || '',
        status: 'active',
        synced: false,            // ← ПОКА НЕ СИНХРОНИЗИРОВАНО
        isNew: true
      };

      // ===== СОХРАНЯЕМ ЛОКАЛЬНО =====
      let localBusy = JSON.parse(localStorage.getItem('busySlots') || '[]');
      localBusy.push(busyData);
      localStorage.setItem('busySlots', JSON.stringify(localBusy));
      
      // ===== ДОБАВЛЯЕМ В STATE =====
      Sync.state.busySlots.push({...busyData});

      // ===== ПОКАЗЫВАЕМ КАРТОЧКУ С ИНДИКАТОРОМ ⏳ =====
      if (typeof Sync !== 'undefined' && Sync.renderSingleBusySlot) {
        Sync.renderSingleBusySlot({...busyData});
      }
      
      // ===== НАХОДИМ КАРТОЧКУ И УСТАНАВЛИВАЕМ ИНДИКАТОР =====
      setTimeout(() => {
        const card = SyncIndicator.findCard(busyId);
        if (card) {
          SyncIndicator.update(card, 'pending', 'Ожидает синхронизации...');
        }
      }, 100);

      // ===== ЗАКРЫВАЕМ ПОПАП =====
      this.popup.style.display = 'none';

      // ===== ОТПРАВЛЯЕМ В API С ГОТОВЫМ ID =====
      API.addBusy({
        id: busyId,
        master: master,
        date: date,
        start: start,
        end: end,
        price: price || 0,
        reason: reason || ''
      }).then(response => {
        if (response.success) {
          // ===== ОБНОВЛЯЕМ СТАТУС НА СИНХРОНИЗИРОВАН =====
          this.updateBusySyncStatus(busyId, true);
          console.log('✅ Занятость создана с ID:', busyId);
        } else {
          console.warn('⚠️ Ошибка при создании занятости:', response.error);
          this.updateBusySyncStatus(busyId, false);
        }
      }).catch((error) => {
        console.error('❌ Ошибка сохранения занятости:', error);
        this.updateBusySyncStatus(busyId, false);
        alert('⚠️ Ошибка при сохранении занятости. Проверьте интернет.');
      });
    });
  },

  // ===== ОБНОВЛЕНИЕ СТАТУСА СИНХРОНИЗАЦИИ =====
  updateBusySyncStatus: function(busyId, isSynced) {
    // Обновляем в localStorage
    let localBusy = JSON.parse(localStorage.getItem('busySlots') || '[]');
    const index = localBusy.findIndex(b => b.id === busyId);
    if (index !== -1) {
      localBusy[index].synced = isSynced;
      if (isSynced) {
        localBusy[index].isNew = false;
      }
      localStorage.setItem('busySlots', JSON.stringify(localBusy));
    }

    // Обновляем в state
    const stateIndex = Sync.state.busySlots.findIndex(b => b.id === busyId);
    if (stateIndex !== -1) {
      Sync.state.busySlots[stateIndex].synced = isSynced;
      if (isSynced) {
        Sync.state.busySlots[stateIndex].isNew = false;
      }
    }

    // ===== ОБНОВЛЯЕМ ИНДИКАТОР НА КАРТОЧКЕ =====
    if (isSynced) {
      SyncIndicator.updateById(busyId, 'synced', 'Синхронизировано с Google Sheets');
    } else {
      SyncIndicator.updateById(busyId, 'error', 'Ошибка синхронизации!');
    }
  }
};