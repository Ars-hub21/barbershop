// js/pages/contacts-page.js - Полная версия без ошибок Storage (Часть 1)
const ContactsPage = {
  init: function() {
    console.log('🏁 [ContactsPage] Запуск Шага 4 с AppStorage...');
    
    const date = AppStorage.get('selectedDate');
    const time = AppStorage.get('selectedTime');
    const servicesSelected = AppStorage.get('selectedServices', []);

    if (!date || !time) {
      alert('⚠️ Сначала выберите дату и время визита.');
      window.location.href = 'Free-slots.html';
      return;
    }

    if (!servicesSelected || servicesSelected.length === 0) {
      alert('⚠️ Сначала выберите услуги из меню прайс-листа.');
      window.location.href = 'Services.html';
      return;
    }

    this.renderSummary();
    this.initForm();
    this.loadClientData();
  },

  renderSummary: function() {
    const summary = document.getElementById('orderSummary');
    if (!summary) return;

    const masterId = AppStorage.get('selectedMaster');
    const anyMaster = AppStorage.get('anyMaster');
    const serviceIds = AppStorage.get('selectedServices', []);
    
    const selectedServicesList = typeof services !== 'undefined' 
      ? services.filter(s => serviceIds.map(String).includes(String(s.id)))
      : [];
      
    const date = AppStorage.get('selectedDate');
    const time = AppStorage.get('selectedTime');

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

    summary.innerHTML = `
      <div class="detail-row"><span class="detail-label">Барбер</span><span class="detail-value">${masterName}</span></div>
      <div class="detail-row"><span class="detail-label">Дата визита</span><span class="detail-value">${date}</span></div>
      <div class="detail-row"><span class="detail-label">Время записи</span><span class="detail-value">${time}</span></div>
      <div class="detail-row"><span class="detail-label">Услуги</span><span class="detail-value">${selectedServicesList.map(s => s.name).join(', ')}</span></div>
      <div class="detail-row"><span class="detail-label">Длительность</span><span class="detail-value">${typeof TimeUtils !== 'undefined' ? TimeUtils.formatDuration(totalDuration) : totalDuration + ' мин.'}</span></div>
      <div class="detail-row"><span class="detail-label">Итого к оплате</span><span class="detail-value">${totalPriceDisplay} ₽</span></div>
    `;
  },
// js/pages/contacts-page.js - Полная версия без ошибок Storage (Часть 2)
  initForm: function() {
    const form = document.getElementById('clientForm');
    if (!form) return;

    const phoneInput = document.getElementById('clientPhone');
    if (phoneInput) {
      phoneInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        if (value.length === 0) { this.value = '+7'; return; }
        if (value.length === 1 && value !== '7') value = '7' + value;
        
        let formatted = '+7';
        if (value.length > 1) {
          formatted += ' (' + value.substring(1, 4);
          if (value.length >= 4) {
            formatted += ') ' + value.substring(4, 7);
            if (value.length >= 7) {
              formatted += '-' + value.substring(7, 9);
              if (value.length >= 9) {
                formatted += '-' + value.substring(9, 11);
              }
            }
          }
        }
        this.value = formatted;
      });
    }

    form.addEventListener('submit', this.handleSubmit.bind(this));
  },

  loadClientData: function() {
    const clientData = AppStorage.get('clientData', {});
    const nameEl = document.getElementById('clientName');
    const phoneEl = document.getElementById('clientPhone');
    const emailEl = document.getElementById('clientEmail');
    const commentEl = document.getElementById('clientComment');

    if (clientData.name && nameEl) nameEl.value = clientData.name;
    if (clientData.phone && phoneEl) phoneEl.value = clientData.phone;
    if (clientData.email && emailEl) emailEl.value = clientData.email;
    if (clientData.comment && commentEl) commentEl.value = clientData.comment;
    
    if (clientData.consents) {
      const personalEl = document.getElementById('consentPersonal');
      const mailingEl = document.getElementById('consentMailing');
      if (personalEl) personalEl.checked = clientData.consents.personal !== false;
      if (mailingEl) mailingEl.checked = clientData.consents.mailing || false;
    }
  },

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

  getTotalDuration: function() {
    const serviceIds = AppStorage.get('selectedServices', []);
    let total = 0;
    if (typeof services !== 'undefined') {
      serviceIds.forEach(id => {
        // ИСПРАВЛЕНО: Теперь считывает из AppStorage без падения JavaScript
        const service = services.find(s => String(s.id) === String(id));
        if (service) total += parseInt(service.duration, 10);
      });
    }
    return total || 15;
  },
// js/pages/contacts-page.js - Полная версия без ошибок Storage (Часть 3)
  handleSubmit: function(e) {
    e.preventDefault();

    const name = document.getElementById('clientName').value.trim();
    const phoneRaw = document.getElementById('clientPhone').value.replace(/\D/g, '');
    const email = document.getElementById('clientEmail').value.trim();
    const comment = document.getElementById('clientComment').value.trim();
    const consentPersonal = document.getElementById('consentPersonal').checked;

    if (name.length < 2) { alert('⚠️ Пожалуйста, введите корректное имя (минимум 2 символа).'); return; }
    if (phoneRaw.length !== 11) { alert('⚠️ Пожалуйста, введите корректный номер телефона (11 цифр).'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('⚠️ Введите корректный e-mail адрес.'); return; }
    if (!consentPersonal) { alert('⚠️ Необходимо дать согласие на обработку персональных данных.'); return; }

    const submitBtn = document.getElementById('submitOrderBtn');

    // Механизм блокировки кнопки для предотвращения дублирования записей в таблице.
    // Визуально — кнопка "подстригается" ножницами (js/utils/scissors-loader.js).
    if (submitBtn) {
      if (submitBtn.disabled) return;
      if (typeof ScissorsLoader !== 'undefined') {
        ScissorsLoader.start(submitBtn, { loadingText: 'Стрижка...' });
      } else {
        submitBtn.disabled = true;
        submitBtn.innerText = '⏳ Сохранение записи...';
      }
    }

    const date = AppStorage.get('selectedDate');
    const time = AppStorage.get('selectedTime');
    const totalDuration = this.getTotalDuration();
    const serviceIds = AppStorage.get('selectedServices', []);
    
    const selectedServicesList = typeof services !== 'undefined' 
      ? services.filter(s => serviceIds.map(String).includes(String(s.id)))
      : [];

    // Определяем имя барбера
    const masterName = this.getMasterName();
    
    // Если включен режим автоподбора "Любой специалист", распределяем запись
    // самому свободному мастеру. Работает для ЛЮБОГО количества мастеров
    // (1-50) — список берётся из js/data/masters.js, а не захардкожен.
    const masterPromise = masterName
      ? Promise.resolve(masterName)
      : Promise.all(
          (typeof masters !== 'undefined' ? masters : []).map(m => API.getFreeSlots(m.name, date, totalDuration))
        ).then(results => {
          let bestMaster = null;
          let bestCount = -1;
          results.forEach((data, i) => {
            const count = (data && data.success) ? data.slots.length : 0;
            if (count > bestCount) {
              bestCount = count;
              bestMaster = masters[i].name;
            }
          });
          return bestMaster;
        });
    
    masterPromise.then(finalMaster => {
      // Защитная проверка занятости времени непосредственно перед фиксацией
      return API.getFreeSlots(finalMaster, date, totalDuration)
        .then(slotsData => {
          if (!slotsData || !slotsData.success) {
            throw new Error('SERVER_ERROR');
          }
          
          const isAvailable = slotsData.slots.includes(time);
          if (!isAvailable) {
            alert('⚠️ Пока вы заполняли форму, выбранное время уже прошло или его успел занять другой клиент. Пожалуйста, выберите другие свободные часы в календаре.');
            
            // ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ КЭША: Записываем в память свежие слоты, где этого времени уже точно нет
            if (slotsData.slots) {
              GlobalCache.slots[finalMaster][date] = slotsData.slots;
              GlobalCache.saveCache();
            }

            AppStorage.remove('selectedTime');
            window.location.href = 'Free-slots.html';
            return;
          }
          
          // Всё чисто — отправляем JSON-пакет на бэкенд Google Apps Script
          return this.createOrder(finalMaster, name, phoneRaw, email, comment, selectedServicesList, date, time, totalDuration);
        });
    }).catch(err => {
      // Разблокируем кнопку, если произошел сбой сети
      if (submitBtn) {
        if (typeof ScissorsLoader !== 'undefined') {
          ScissorsLoader.stop(submitBtn, { text: 'Записаться' });
        } else {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Записаться';
        }
      }
      if (err.message !== 'TIME_NOT_AVAILABLE' && err.message !== 'SERVER_ERROR') {
        alert('❌ Произошла непредвиденная ошибка при отправке данных. Попробуйте еще раз.');
        console.error(err);
      }
    });
  },

  createOrder: function(masterName, name, phoneRaw, email, comment, selectedServicesList, date, time, totalDuration) {
    let totalMinPrice = 0;
    let totalMaxPrice = 0;
    
    selectedServicesList.forEach(s => {
      const priceStr = String(s.price).replace(/\s/g, '');
      if (priceStr.includes('-') || priceStr.includes('–')) {
        const parts = priceStr.split(/[-–]/);
        totalMinPrice += parseInt(parts[0], 10) || 0;
        totalMaxPrice += parseInt(parts[1], 10) || 0;
      } else {
        const price = parseInt(priceStr, 10) || 0;
        totalMinPrice += price;
        totalMaxPrice += price;
      }
    });

    const totalPriceDisplay = (totalMinPrice === totalMaxPrice) 
      ? String(totalMinPrice) 
      : `${totalMinPrice}–${totalMaxPrice}`;

    const orderData = {
      master: masterName,
      date: date,
      time: time,
      services: selectedServicesList.map(s => s.name),
      duration: totalDuration,
      totalPrice: totalPriceDisplay,
      clientName: name,
      clientPhone: phoneRaw,
      clientEmail: email,
      comment: comment
    };

    return API.createOrder(orderData).then(response => {
      if (response && response.success) {
        // Кэшируем контактную анкету для удобства повторных записей
        AppStorage.save('clientData', {
          name, 
          phone: document.getElementById('clientPhone').value, 
          email, 
          comment,
          consents: {
            personal: document.getElementById('consentPersonal').checked,
            mailing: document.getElementById('consentMailing').checked
          }
        });
        
        // Записываем полученный ID транзакции в память сессии
        AppStorage.save('lastOrderNumber', response.id);
        
        // Удаляем забронированный слот из локальной памяти GlobalCache, чтобы он сразу скрылся у других пользователей
        if (typeof GlobalCache !== 'undefined' && GlobalCache.slots[masterName] && GlobalCache.slots[masterName][date]) {
          const updated = GlobalCache.slots[masterName][date].filter(s => s !== time);
          GlobalCache.updateSlots(masterName, date, updated);
        }

        console.log(`[ContactsPage] Успех! Запись №${response.id} создана. Переход к квитанции.`);
        window.location.href = 'Thank-you.html';
      } else {
        const errorMsg = (response && response.error) ? response.error : 'Неизвестная ошибка сервера';
        if (errorMsg === 'TIME_NOT_AVAILABLE') {
          alert('⚠️ Это время уже занято. Пожалуйста, выберите другую дату визита.');
          window.location.href = 'Free-slots.html';
        } else {
          alert('❌ Ошибка бэкенда Google Таблиц: ' + errorMsg);
        }
        throw new Error(errorMsg);
      }
    });
  }
};
