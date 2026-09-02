// barber_panel/js/sync.js - УМНАЯ СИНХРОНИЗАЦИЯ
// ОТВЕЧАЕТ ЗА: 
// - Синхронизацию заказов и занятости между локальным хранилищем и Google Sheets
// - Обновление интерфейса в реальном времени

const Sync = {
  lastSyncTime: null,
  syncInterval: null,
  state: {
    orders: [],
    busySlots: []
  },

  init: function() {
    this.lastSyncTime = new Date().toISOString();
    this.performFullSync();
    this.startPolling();
  },

  // ===== ПОЛНАЯ СИНХРОНИЗАЦИЯ =====
  performFullSync: function() {
      const date = document.getElementById('currentDateDisplay')?.dataset.date || new Date().toISOString().split('T')[0];
      
      console.log('📡 Умная синхронизация для даты:', date);
      
      Promise.all([
          API.getOrders(date, null),
          API.getBusySlots(date)
      ]).then(([ordersData, busyData]) => {
          
          console.log('📦 Ответ от API getBusySlots:', busyData);
          
          if (ordersData.success) {
              const newOrders = ordersData.orders.filter(order => order.status === 'active');
              this.smartUpdateOrders(newOrders);
          }
          
          if (busyData.success) {
              // ===== БЕРЕМ ТОЛЬКО ACTIVE =====
              const newBusy = busyData.slots.filter(slot => slot.status === 'active');
              console.log('📋 Получено active занятостей:', newBusy.length);
              console.log('📋 Данные:', newBusy);
              this.smartUpdateBusy(newBusy);
          } else {
              console.error('❌ Ошибка получения занятости:', busyData.error);
          }
          
      }).catch(error => {
          console.error('❌ Ошибка синхронизации:', error);
      });
  },

  // ===== УМНОЕ ОБНОВЛЕНИЕ ЗАКАЗОВ =====
  smartUpdateOrders: function(newOrders) {
    localStorage.setItem('orders', JSON.stringify(newOrders));
    
    const oldOrders = this.state.orders;
    
    const oldIds = new Set(oldOrders.map(o => o.id));
    const newIds = new Set(newOrders.map(o => o.id));
    
    const removedOrderIds = [...oldIds].filter(id => !newIds.has(id));
    removedOrderIds.forEach(id => {
      const card = document.querySelector(`.order-card[data-order-id="${id}"]`);
      if (card) {
        card.remove();
        console.log(`🗑️ Удалена карточка заказа: ${id}`);
      }
    });
    
    const newOrderIds = [...newIds].filter(id => !oldIds.has(id));
    newOrderIds.forEach(id => {
      const order = newOrders.find(o => o.id === id);
      if (order) {
        this.renderSingleOrder(order);
        this.playNewOrderSound();
        console.log(`➕ Добавлена карточка заказа: ${id}`);
      }
    });
    
    newOrders.forEach(order => {
      const card = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
      if (card) {
        this.updateOrderCard(card, order);
      }
    });
    
    this.state.orders = newOrders;
    
    console.log(`📊 Заказы: ${oldOrders.length} → ${newOrders.length}`);
  },

  updateOrderCard: function(card, order) {
    const priceEl = card.querySelector('.order-price');
    if (priceEl) {
      const price = order.actualPrice || order.totalPrice;
      priceEl.textContent = `${price} ₽`;
    }
    
    let commentEl = card.querySelector('.order-comment');
    if (order.comment) {
      if (!commentEl) {
        const phoneEl = card.querySelector('.order-phone');
        if (phoneEl) {
          const commentDiv = document.createElement('div');
          commentDiv.className = 'order-comment';
          commentDiv.textContent = `📝 ${order.comment}`;
          phoneEl.insertAdjacentElement('afterend', commentDiv);
        }
      } else {
        commentEl.textContent = `📝 ${order.comment}`;
      }
    } else {
      if (commentEl) {
        commentEl.remove();
      }
    }
  },

  // ===== УМНОЕ ОБНОВЛЕНИЕ ЗАНЯТОСТИ =====
  // УПРОЩЕННАЯ ВЕРСИЯ: ID одинаковые на клиенте и сервере
  smartUpdateBusy: function(newBusy) {
    console.log('🔄 Обновление занятости, получено записей:', newBusy.length);
    
    // ===== 1. СОХРАНЯЕМ В LOCALSTORAGE =====
    let localBusy = JSON.parse(localStorage.getItem('busySlots') || '[]');
    
    // Обновляем или добавляем записи по ID
    newBusy.forEach(serverItem => {
      const existingIndex = localBusy.findIndex(local => local.id === serverItem.id);
      if (existingIndex !== -1) {
        // Обновляем существующую (сохраняем synced=true)
        localBusy[existingIndex] = {
          ...localBusy[existingIndex],
          ...serverItem,
          synced: true
        };
      } else {
        // Добавляем новую
        localBusy.push({
          ...serverItem,
          synced: true
        });
      }
    });
    
    // Убираем те, которых нет на сервере (только если они синхронизированы)
    const serverIds = new Set(newBusy.map(b => b.id));
    const filtered = localBusy.filter(item => 
      item.synced === false || serverIds.has(item.id)
    );
    
    localStorage.setItem('busySlots', JSON.stringify(filtered));
    
    // ===== 2. ОБНОВЛЯЕМ STATE =====
    this.state.busySlots = filtered;
    
    // ===== 3. ПЕРЕРИСОВЫВАЕМ =====
    this.renderAllBusySlots();
    
    console.log(`📊 Занятость обновлена: ${filtered.length} записей`);
  },

  // ===== СИНХРОНИЗАЦИЯ НОВЫХ ЗАКАЗОВ (ПОЛЛИНГ) =====
  syncNewOrders: function() {
    const since = this.lastSyncTime || new Date().toISOString();
    
    API.getNewOrders(since).then(data => {
      if (data.success && data.orders.length > 0) {
        console.log(`🆕 Найдено ${data.orders.length} новых заказов`);
        
        const currentDate = document.getElementById('currentDateDisplay')?.dataset.date || new Date().toISOString().split('T')[0];
        const todayOrders = data.orders.filter(o => o.date === currentDate);
        
        if (todayOrders.length > 0) {
          todayOrders.forEach(order => {
            const exists = this.state.orders.some(o => o.id === order.id);
            if (!exists) {
              this.state.orders.push(order);
              this.renderSingleOrder(order);
              this.playNewOrderSound();
              console.log(`🆕 Новый заказ: ${order.id} от ${order.clientName}`);
            }
          });
        }
        
        this.lastSyncTime = new Date().toISOString();
      }
    }).catch(error => {
      console.error('❌ Ошибка синхронизации новых заказов:', error);
    });
  },

  // ===== СИНХРОНИЗАЦИЯ ЗАНЯТОСТИ (ПОЛЛИНГ) =====
  syncBusySlots: function() {
    const date = document.getElementById('currentDateDisplay')?.dataset.date || new Date().toISOString().split('T')[0];
    
    API.getBusySlots(date).then(data => {
      if (data.success) {
        const newBusy = data.slots.filter(slot => slot.status === 'active');
        const currentBusy = this.state.busySlots;
        
        const oldIds = new Set(currentBusy.map(b => b.id));
        const newIds = new Set(newBusy.map(b => b.id));
        
        // Проверяем, изменилось ли состояние
        const hasChanges = oldIds.size !== newIds.size || 
          [...oldIds].some(id => !newIds.has(id));
        
        if (hasChanges) {
          this.smartUpdateBusy(newBusy);
        }
      }
    });
  },

  // ===== ПОВТОРНАЯ СИНХРОНИЗАЦИЯ НЕСИНХРОНИЗИРОВАННЫХ ЗАПИСЕЙ =====
  retrySyncBusy: function() {
    const localBusy = JSON.parse(localStorage.getItem('busySlots') || '[]');
    const unsynced = localBusy.filter(b => b.synced === false);
    
    if (unsynced.length === 0) return;
    
    console.log(`🔄 Повторная синхронизация ${unsynced.length} блоков занятости...`);
    
    unsynced.forEach(busy => {
      API.addBusy({
        id: busy.id,  // ← ПЕРЕДАЁМ ГОТОВЫЙ ID
        master: busy.masterName,
        date: busy.date,
        start: busy.start,
        end: busy.end,
        price: busy.price || 0,
        reason: busy.reason || ''
      }).then(response => {
        if (response.success) {
          busy.synced = true;
          localStorage.setItem('busySlots', JSON.stringify(localBusy));
          console.log(`✅ Синхронизирован блок: ${busy.id}`);
        }
      }).catch(() => {
        console.log(`⏳ Блок ${busy.id} еще не синхронизирован`);
      });
    });
  },

  // ===== ОТРИСОВКА ОДНОЙ КАРТОЧКИ ЗАКАЗА =====
  renderSingleOrder: function(order) {
    const container = document.getElementById(`orders${getMasterKey(order.masterName)}`);
    if (!container) return;
    
    const existing = container.querySelector(`.order-card[data-order-id="${order.id}"]`);
    if (existing) {
      this.updateOrderCard(existing, order);
      return;
    }
    const card = this.createOrderCard(order);
    container.insertAdjacentHTML('beforeend', card);
  },

  // ===== ОТРИСОВКА ОДНОЙ КАРТОЧКИ ЗАНЯТОСТИ =====
  renderSingleBusySlot: function(slot) {
    const container = document.getElementById(`orders${getMasterKey(slot.masterName)}`);
    if (!container) return;
    
    // Проверяем, нет ли уже такой карточки
    const existing = container.querySelector(`.busy-slot-card[data-id="${slot.id}"]`);
    if (existing) {
      // Обновляем существующую карточку
      existing.replaceWith(this.createBusySlotCard(slot));
      return;
    }
    
    const card = this.createBusySlotCard(slot);
    container.insertAdjacentHTML('beforeend', card);
  },

// ===== СОЗДАНИЕ HTML КАРТОЧКИ ЗАКАЗА =====
createOrderCard: function(order) {
    const price = order.actualPrice || order.totalPrice;
    const phone = order.clientPhone || '';
    const formattedPhone = phone.replace(/[^0-9+]/g, '');
    
    return `
        <div class="order-card" data-order-id="${order.id}" data-master="${order.masterName}" data-date="${order.date}">
            <!-- ===== 1 СТРОКА: ВРЕМЯ (СЛЕВА) + ИМЯ (СПРАВА) ===== -->
            <div class="order-row order-row-top">
                <span class="order-time">${order.time}</span>
                <span class="order-client">${order.clientName}</span>
            </div>
            
            <!-- ===== 2 СТРОКА: ДЛИТЕЛЬНОСТЬ (СЛЕВА) + ТЕЛЕФОН (СПРАВА) ===== -->
            <div class="order-row order-row-middle">
                <span class="order-duration">${this.formatDuration(order.duration)}</span>
                <span class="order-phone"><a href="tel:${formattedPhone}">${phone}</a></span>
            </div>
            
            <!-- ===== 3 СТРОКА: УСЛУГИ ===== -->
            <div class="order-services">${Array.isArray(order.services) ? order.services.join(', ') : order.services}</div>
            
            <!-- ===== 4 СТРОКА: КОММЕНТАРИЙ (если есть) ===== -->
            ${order.comment ? `<div class="order-comment">📝 ${order.comment}</div>` : ''}
            
            <!-- ===== 5 СТРОКА: ЦЕНА + ИНДИКАТОР (СЛЕВА) + КНОПКА (СПРАВА) ===== -->
            <div class="order-bottom-row">
                <div class="order-price-wrapper">
                    <span class="order-price" data-order-id="${order.id}">${price} ₽</span>
                    <span class="sync-indicator sync-synced" title="Синхронизировано с Google Sheets" style="color:var(--success);">✅</span>
                </div>
                <div class="order-actions">
                    <button class="btn btn-cancel" data-order-id="${order.id}">Отменить</button>
                </div>
            </div>
        </div>
    `;
},

  // ===== ОТРИСОВКА ВСЕХ ЗАКАЗОВ =====
  // Генерирует список контейнеров по текущему составу мастеров
  // (../js/data/masters.js) — работает для 1-50 мастеров, а не только двух.
  renderAllOrders: function() {
    const containers = {};
    (typeof ALL_MASTERS !== 'undefined' ? ALL_MASTERS : []).forEach(m => {
      containers[m.name] = document.getElementById(`orders${m.key}`);
    });

    Object.keys(containers).forEach(masterName => {
      const container = containers[masterName];
      if (!container) return;

      const masterOrders = this.state.orders.filter(o => o.masterName === masterName);
      masterOrders.sort((a, b) => a.time.localeCompare(b.time));
      container.innerHTML = masterOrders.map(order => this.createOrderCard(order)).join('');
    });
  },

  // ===== ОТРИСОВКА ВСЕХ ЗАНЯТОСТЕЙ =====
  renderAllBusySlots: function() {
      console.log('🔄 renderAllBusySlots вызван, записей:', this.state.busySlots.length);

      const containers = {};
      (typeof ALL_MASTERS !== 'undefined' ? ALL_MASTERS : []).forEach(m => {
        containers[m.name] = document.getElementById(`orders${m.key}`);
      });

      // Очищаем все старые карточки занятости
      Object.keys(containers).forEach(masterName => {
          const container = containers[masterName];
          if (!container) {
              console.warn(`⚠️ Контейнер для ${masterName} не найден!`);
              return;
          }

          // Удаляем все старые карточки занятости
          const cards = container.querySelectorAll('.busy-slot-card');
          console.log(`🗑️ Удаляем ${cards.length} карточек для ${masterName}`);
          cards.forEach(card => card.remove());
      });

      // Рисуем заново
      let renderedCount = 0;
      this.state.busySlots.forEach(slot => {
          console.log(`📝 Рендерим занятость: ${slot.masterName} ${slot.start}-${slot.end} (${slot.id})`);
          this.renderSingleBusySlot(slot);
          renderedCount++;
      });
      
      console.log(`✅ Отрисовано ${renderedCount} карточек занятости`);
  },

  // ===== СОЗДАНИЕ HTML КАРТОЧКИ ЗАНЯТОСТИ =====
  createBusySlotCard: function(slot) {
      const duration = this.getDuration(slot.start, slot.end);
      const price = slot.price || 0;
      
      // Определяем состояние индикатора
      let indicatorState = 'pending';
      let indicatorTitle = 'Ожидает синхронизации...';
      if (slot.synced === true) {
          indicatorState = 'synced';
          indicatorTitle = 'Синхронизировано с Google Sheets';
      } else if (slot.synced === false && slot.isNew) {
          indicatorState = 'pending';
          indicatorTitle = 'Ожидает синхронизации...';
      }
      
      return `
          <div class="busy-slot-card" data-id="${slot.id}" data-master="${slot.masterName}" data-date="${slot.date}">
              <div class="slot-info">
                  <span class="slot-time">${slot.start} – ${slot.end}</span>
                  <span class="slot-duration">${this.formatDuration(duration)}</span>
                  <span class="slot-price" data-id="${slot.id}">${price} ₽</span>
                  <!-- Индикатор синхронизации будет добавлен через SyncIndicator -->
              </div>
              <div class="order-actions">
                  <button class="btn btn-cancel" data-id="${slot.id}">X</button>
              </div>
          </div>
      `;
  },

  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
  getDuration: function(start, end) {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  },

  formatDuration: function(minutes) {
    if (minutes < 60) return `${minutes} мин`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  },

  // ===== ЗАПУСК ПОЛЛИНГА =====
  startPolling: function() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      this.syncNewOrders();
      this.syncBusySlots();
      this.retrySyncBusy();
    }, 10000);
  },

  // ===== ЗВУКОВЫЕ УВЕДОМЛЕНИЯ =====
  playNewOrderSound: function() {
    const audio = document.getElementById('newOrderSound');
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  },

  playNotificationSound: function() {
    const audio = document.getElementById('notificationSound');
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  },

  // ===== ОСТАНОВКА ПОЛЛИНГА =====
  stop: function() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
};