// frontend/barber_panel/js/utils/helpers.js — общие утилиты для панели
// ОТВЕЧАЕТ ЗА:
// - Вставку карточек в DOM
// - Редактирование цены (клик по цене) С ИНДИКАТОРОМ
// - Удаление карточек (отмена записи/занятости)

// ============================================================
// 0. РАЗБОР ЦЕНЫ ИЗ ТЕКСТА КАРТОЧКИ (НЕ ТЕРЯЯ ДИАПАЗОН С ТИРЕ)
// ============================================================
// Некоторые услуги в прайс-листе (js/data/services.js) стоят "неточно" —
// диапазоном, например "300–500". Пока барбер не назначил точную цену
// вручную, эта строка-диапазон может дойти и до карточки заказа/занятости
// в панели как есть. Раньше цена везде разбиралась одинаково —
// `parseInt(text.replace(/[^0-9]/g, ''))` — что для диапазона склеивало
// обе границы в одно бессмысленное число ("300–500" → 300500) и по факту
// "съедало" тире. Эта функция вместо этого распознаёт диапазон отдельно.
function parsePriceFromText(text) {
  const cleaned = String(text || '').replace(/₽/g, '').replace(/\s+/g, ' ').trim();
  const rangeMatch = cleaned.match(/^(\d+)\s*[-–—]\s*(\d+)$/);

  if (rangeMatch) {
    return {
      isRange: true,
      text: `${rangeMatch[1]}–${rangeMatch[2]}`,
      low: parseInt(rangeMatch[1], 10),
      high: parseInt(rangeMatch[2], 10)
    };
  }

  const digits = cleaned.replace(/[^0-9]/g, '');
  return {
    isRange: false,
    text: digits || '0',
    value: digits ? parseInt(digits, 10) : 0
  };
}

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
    
    const parsedPrice = parsePriceFromText(priceEl.textContent);
    // Поле ввода — число, диапазон туда не поместить. Если цена ещё не
    // назначена точно (диапазон, например "300–500"), подставляем нижнюю
    // границу как отправную точку — барбер тут же вписывает точную сумму,
    // вместо того чтобы поле молча предзаполнилось слипшимся мусорным
    // числом вроде 300500.
    const currentPrice = parsedPrice.isRange ? parsedPrice.low : (parsedPrice.value || 0);
    const currentPriceDisplay = parsedPrice.isRange ? parsedPrice.text : String(currentPrice);

    // Создаем поле ввода
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'edit-price-input';
    input.value = currentPrice;
    input.min = 0;
    if (parsedPrice.isRange) {
      input.title = `Была указана неточная цена (${parsedPrice.text} ₽) — укажите точную сумму`;
      input.placeholder = parsedPrice.text;
    }
    
    priceEl.textContent = '';
    priceEl.appendChild(input);
    input.focus();
    input.select();
    
    const savePrice = () => {
      const newPrice = parseInt(input.value);
      // Если поле не трогали (значение осталось равно предложенной нижней
      // границе диапазона) — считаем, что барбер передумал редактировать,
      // и возвращаем исходный диапазон как есть, а не подменяем его молча
      // одним числом.
      if (parsedPrice.isRange && String(input.value) === String(currentPrice)) {
        priceEl.textContent = currentPriceDisplay + ' ₽';
        return;
      }
      if (!isNaN(newPrice) && newPrice >= 0) {
        if (options.onSave) {
          options.onSave(id, newPrice);
        }
        priceEl.textContent = newPrice + ' ₽';
      } else {
        priceEl.textContent = currentPriceDisplay + ' ₽';
      }
    };

    input.addEventListener('blur', savePrice);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') {
        e.preventDefault();
        priceEl.textContent = currentPriceDisplay + ' ₽';
        input.removeEventListener('blur', savePrice);
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