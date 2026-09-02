// js/pages/thank-you-page.js - Экран электронного чека-квитанции (Часть 1)
const ThankYouPage = {
  init: function() {
    console.log('🏁 [ThankYouPage] Инициализация экрана успешного визита...');
    
    // Переведено на безопасное хранилище AppStorage
    const orderNumber = AppStorage.get('lastOrderNumber');
    if (!orderNumber) {
      console.warn('[ThankYouPage] Номер заказа не найден в памяти сессии. Возврат на главную.');
      window.location.href = 'index.html';
      return;
    }
    
    this.displayOrderDetails();
    this.initHomeButton();
  },

  displayOrderDetails: function() {
    const orderNumber = AppStorage.get('lastOrderNumber', 'Неизвестный номер');
    const orderNumberEl = document.getElementById('orderNumber');
    if (orderNumberEl) {
      orderNumberEl.textContent = `Номер записи: ${orderNumber}`;
    }

    const masterId = AppStorage.get('selectedMaster');
    const anyMaster = AppStorage.get('anyMaster');
    const date = AppStorage.get('selectedDate');
    const time = AppStorage.get('selectedTime');
    const serviceIds = AppStorage.get('selectedServices', []);
    const clientData = AppStorage.get('clientData', {});

    // ИСПРАВЛЕНО: Безопасная фильтрация услуг с приведением типов к строке
    const selectedServicesList = typeof services !== 'undefined' 
      ? services.filter(s => serviceIds.map(String).includes(String(s.id)))
      : [];

    // ИСПРАВЛЕНО: Безопасный поиск мастера по строковому ID
    let masterName = 'Любой специалист';
    if (!anyMaster && masterId && typeof masters !== 'undefined') {
      const master = masters.find(m => String(m.id) === String(masterId));
      if (master) masterName = master.name;
    }

    let totalMinPrice = 0;
    let totalMaxPrice = 0;
    let totalDuration = 0;
    
    selectedServicesList.forEach(s => {
      const priceStr = String(s.price).replace(/\s/g, '');
      let minPrice = 0, maxPrice = 0;
      
      if (priceStr.includes('-') || priceStr.includes('–')) {
        const parts = priceStr.split(/[-–]/);
        // ИСПРАВЛЕНО: Корректный парсинг элементов массива по индексам
        minPrice = parseInt(parts[0], 10) || 0;
        maxPrice = parseInt(parts[1], 10) || 0;
      } else {
        minPrice = parseInt(priceStr, 10) || 0;
        maxPrice = minPrice;
      }
      
      totalMinPrice += minPrice;
      totalMaxPrice += maxPrice;
      totalDuration += parseInt(s.duration, 10);
    });

    let totalPriceDisplay = (totalMinPrice === totalMaxPrice) 
      ? totalMinPrice 
      : `${totalMinPrice}–${totalMaxPrice}`;
// js/pages/thank-you-page.js - Экран электронного чека-квитанции (Часть 2)
    const orderDetailsEl = document.getElementById('orderDetails');
    if (orderDetailsEl) {
      orderDetailsEl.innerHTML = `
        <div class="detail-row"><span class="detail-label">Барбер</span><span class="detail-value">${masterName}</span></div>
        <div class="detail-row"><span class="detail-label">Дата визита</span><span class="detail-value">${date}</span></div>
        <div class="detail-row"><span class="detail-label">Время записи</span><span class="detail-value">${time}</span></div>
        <div class="detail-row"><span class="detail-label">Услуги</span><span class="detail-value">${selectedServicesList.map(s => s.name).join(', ')}</span></div>
        <div class="detail-row"><span class="detail-label">Длительность</span><span class="detail-value">${typeof TimeUtils !== 'undefined' ? TimeUtils.formatDuration(totalDuration) : totalDuration + ' мин.'}</span></div>
        <div class="detail-row"><span class="detail-label">Итого к оплате</span><span class="detail-value">${totalPriceDisplay} ₽</span></div>
        <div class="detail-row"><span class="detail-label">Клиент</span><span class="detail-value">${clientData.name || 'Не указано'}</span></div>
        <div class="detail-row"><span class="detail-label">Телефон</span><span class="detail-value">${clientData.phone || 'Не указано'}</span></div>
        ${clientData.email ? `<div class="detail-row"><span class="detail-label">E-mail</span><span class="detail-value">${clientData.email}</span></div>` : ''}
        ${clientData.comment ? `<div class="detail-row"><span class="detail-label">Комментарий</span><span class="detail-value">${clientData.comment}</span></div>` : ''}
      `;
    }
  },

  initHomeButton: function() {
    const homeBtn = document.getElementById('resetAndGoHome');
    if (homeBtn) {
      homeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        const date = AppStorage.get('selectedDate');
        const masterId = AppStorage.get('selectedMaster');
        let masterName = null;
        
        if (masterId && typeof masters !== 'undefined') {
          const found = masters.find(m => String(m.id) === String(masterId));
          if (found) masterName = found.name;
        }

        // Перед очисткой шагов принудительно заставляем кэш обновить этот день с сервера
        if (date && masterName && typeof API !== 'undefined') {
          API.getFreeSlots(masterName, date, 15).then(data => {
            if (data && data.success) {
              GlobalCache.slots[masterName][date] = data.slots || [];
              GlobalCache.saveCache();
            }
          }).catch(err => console.warn(err));
        }

        AppStorage.clear();
        window.location.href = 'index.html';
      });
    }
  }

};
