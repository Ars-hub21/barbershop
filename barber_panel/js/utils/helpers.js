// frontend/barber_panel/js/utils/helpers.js — общие утилиты для панели
// ОТВЕЧАЕТ ЗА:
// - Вставку карточек в DOM
// - Редактирование цены (клик по цене) С ИНДИКАТОРОМ
// - Удаление карточек (отмена записи/занятости)

// ============================================================
// 1. УНИВЕРСАЛЬНАЯ ВСТАВКА КАРТОЧКИ
// ============================================================
function insertCard(container, html, selector) {
  const existing = container.querySelector(selector);
  if (existing) {
    console.log(`⚠️ Карточка уже есть в DOM: ${selector}`);
    return false;
  }
  console.log(`✅ Вставляем новую карточку: ${selector}`);
  container.insertAdjacentHTML('beforeend', html);
  return true;
}

// ============================================================
// 2. УНИВЕРСАЛЬНОЕ РЕДАКТИРОВАНИЕ ЦЕНЫ
//    При клике на цену появляется поле ввода
// ============================================================
function initPriceEditor(options) {
  document.addEventListener('click', function(e) {
    const priceEl = e.target.closest(options.selector);
    if (!priceEl) return;
    
    const card = priceEl.closest(options.cardSelector);
    if (!card) return;
    
    const id = card.getAttribute(options.idAttr);
    if (!id) return;
    
    const currentPrice = parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) || 0;
    
    // Создаем поле ввода
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'edit-price-input';
    input.value = currentPrice;
    input.min = 0;
    
    priceEl.textContent = '';
    priceEl.appendChild(input);
    input.focus();
    input.select();
    
    const savePrice = () => {
      const newPrice = parseInt(input.value);
      if (!isNaN(newPrice) && newPrice >= 0) {
        if (options.onSave) {
          options.onSave(id, newPrice);
        }
        priceEl.textContent = newPrice + ' ₽';
      } else {
        priceEl.textContent = currentPrice + ' ₽';
      }
    };
    
    input.addEventListener('blur', savePrice);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { 
        e.preventDefault();
        priceEl.textContent = currentPrice + ' ₽';
      }
    });
    input.addEventListener('click', (e) => e.stopPropagation());
  });
}

// ============================================================
// 3. ИНИЦИАЛИЗАЦИЯ ВСЕХ РЕДАКТОРОВ ЦЕН
// ============================================================
function initAllPriceEditors() {
  // ===== ДЛЯ ЗАКАЗОВ (С ИНДИКАТОРОМ СИНХРОНИЗАЦИИ) =====
  initPriceEditor({
    selector: '.order-price',
    cardSelector: '.order-card',
    idAttr: 'data-order-id',
    onSave: function(id, newPrice) {
      // ===== 1. ПОКАЗЫВАЕМ ИНДИКАТОР "ИДЁТ СИНХРОНИЗАЦИЯ" =====
      SyncIndicator.updateOrderById(id, 'syncing', 'Обновление цены...');
      
      // ===== 2. Обновляем локально =====
      let orders = JSON.parse(localStorage.getItem('orders') || '[]');
      const order = orders.find(o => o.id === id);
      if (order) {
        order.actualPrice = newPrice;
        localStorage.setItem('orders', JSON.stringify(orders));
        
        // Обновляем в state
        const stateIndex = Sync.state.orders.findIndex(o => o.id === id);
        if (stateIndex !== -1) {
          Sync.state.orders[stateIndex].actualPrice = newPrice;
        }
        
        // ===== 3. ОТПРАВЛЯЕМ НА СЕРВЕР =====
        API.updateOrderPrice(id, newPrice)
          .then(response => {
            if (response.success) {
              // ===== УСПЕШНО — ПОКАЗЫВАЕМ ✅ =====
              SyncIndicator.updateOrderById(id, 'synced', 'Цена обновлена в Google Sheets');
              console.log(`✅ Цена заказа обновлена на сервере для ${id}: ${newPrice} ₽`);
            } else {
              // ===== ОШИБКА — ПОКАЗЫВАЕМ ❌ =====
              SyncIndicator.updateOrderById(id, 'error', 'Ошибка обновления цены!');
              console.warn(`⚠️ Не удалось обновить цену на сервере:`, response.error);
            }
          })
          .catch(error => {
            // ===== ОШИБКА — ПОКАЗЫВАЕМ ❌ =====
            SyncIndicator.updateOrderById(id, 'error', 'Ошибка синхронизации!');
            console.error('❌ Ошибка обновления цены на сервере:', error);
          });
      }
    }
  });

  // ===== ДЛЯ ЗАНЯТОСТИ (С ИНДИКАТОРОМ СИНХРОНИЗАЦИИ) =====
  initPriceEditor({
    selector: '.slot-price',
    cardSelector: '.busy-slot-card',
    idAttr: 'data-id',
    onSave: function(id, newPrice) {
      // ===== 1. ПОКАЗЫВАЕМ ИНДИКАТОР "ИДЁТ СИНХРОНИЗАЦИЯ" =====
      SyncIndicator.updateById(id, 'syncing', 'Обновление цены...');
      
      // ===== 2. Обновляем локально =====
      let busySlots = JSON.parse(localStorage.getItem('busySlots') || '[]');
      const slot = busySlots.find(b => b.id === id);
      if (slot) {
        slot.price = newPrice;
        localStorage.setItem('busySlots', JSON.stringify(busySlots));
        
        // Обновляем в state
        const stateIndex = Sync.state.busySlots.findIndex(b => b.id === id);
        if (stateIndex !== -1) {
          Sync.state.busySlots[stateIndex].price = newPrice;
        }
        
        // ===== 3. ОТПРАВЛЯЕМ НА СЕРВЕР =====
        API.updateBusyPrice(id, newPrice)
          .then(response => {
            if (response.success) {
              // ===== УСПЕШНО — ПОКАЗЫВАЕМ ✅ =====
              SyncIndicator.updateById(id, 'synced', 'Цена обновлена в Google Sheets');
              console.log(`✅ Цена обновлена на сервере для ${id}: ${newPrice} ₽`);
            } else {
              // ===== ОШИБКА — ПОКАЗЫВАЕМ ❌ =====
              SyncIndicator.updateById(id, 'error', 'Ошибка обновления цены!');
              console.warn(`⚠️ Не удалось обновить цену на сервере:`, response.error);
            }
          })
          .catch(error => {
            // ===== ОШИБКА — ПОКАЗЫВАЕМ ❌ =====
            SyncIndicator.updateById(id, 'error', 'Ошибка синхронизации!');
            console.error('❌ Ошибка обновления цены на сервере:', error);
          });
      }
    }
  });
}

// ============================================================
// 4. УНИВЕРСАЛЬНОЕ УДАЛЕНИЕ КАРТОЧКИ
// ============================================================
function initCardRemover(options) {
  document.addEventListener('click', function(e) {
    const btn = e.target.closest(options.btnSelector);
    if (!btn) return;
    
    const card = btn.closest(options.cardSelector);
    if (!card) return;
    
    const id = card.dataset.id || card.dataset.orderId;
    if (!id) return;
    
    e.stopPropagation();
    
    if (confirm(options.confirmText)) {
      // Блокируем кнопку
      btn.disabled = true;
      btn.textContent = '⏳';
      
      options.onRemove(id)
        .then(() => {
          card.remove();
          if (options.afterRemove) options.afterRemove();
        })
        .catch(err => {
          console.error('Ошибка:', err);
          alert('Не удалось удалить. Попробуйте еще раз.');
        })
        .finally(() => {
          btn.disabled = false;
          btn.textContent = 'Отменить';
        });
    }
  });
}

// ============================================================
// 5. ИНИЦИАЛИЗАЦИЯ ВСЕХ УДАЛЕНИЙ
// ============================================================
function initAllCardRemovers() {
  // ===== УДАЛЕНИЕ ЗАКАЗА (ОТМЕНА) =====
  initCardRemover({
    btnSelector: '.btn-cancel',
    cardSelector: '.order-card',
    confirmText: 'Отменить запись?',
    onRemove: function(id) {
      return API.updateOrderStatus(id, 'canceled');
    },
    afterRemove: function() {
      Sync.performFullSync();
    }
  });

  // ===== УДАЛЕНИЕ ЗАНЯТОСТИ (ОТМЕНА) =====
  initCardRemover({
    btnSelector: '.btn-cancel',
    cardSelector: '.busy-slot-card',
    confirmText: 'Отменить занятость?',
    onRemove: function(id) {
      return API.updateBusyStatus(id, 'canceled');
    },
    afterRemove: function() {
      Sync.performFullSync();
    }
  });
}

// ============================================================
// 6. ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ПОИСК И УДАЛЕНИЕ ПО СОВПАДЕНИЮ
// ============================================================
function findAndDeleteByMatch(master, date, start, end) {
  return API.getBusySlots(date).then(data => {
    if (!data.success) throw new Error('Не удалось загрузить занятость');
    
    const match = data.slots.find(s => 
      s.masterName === master && 
      s.date === date && 
      s.start === start && 
      s.end === end &&
      s.status === 'active'
    );
    
    if (!match) {
      return { success: true, alreadyDeleted: true };
    }
    
    return API.updateBusyStatus(match.id, 'canceled');
  });
}