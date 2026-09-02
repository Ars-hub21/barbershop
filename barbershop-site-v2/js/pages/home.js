// js/pages/home.js - Главная страница выбора мастера (Часть 1)
const Home = {
  init: function() {
    console.log('🏁 [Home] Инициализация Шага 1 с AppStorage...');
    
    // 1. Генерируем карточки мастеров в DOM
    this.renderMasters();
    
    // 2. Навешиваем глобальные обработчики событий (Делегирование)
    this.initEvents();
    
    // 3. Загружаем отзывы и заполняем слоты времени
    this.loadReviewsAndSlots();
    
    // 4. Реагируем на фоновые пакетные обновления GlobalCache
    if (typeof GlobalCache !== 'undefined' && typeof GlobalCache.addListener === 'function') {
      GlobalCache.addListener(() => {
        this.updateSlotsFromCache();
      });
    }
  },

  renderMasters: function() {
    const grid = document.querySelector('.masters-grid');
    if (!grid) return;

    if (typeof masters === 'undefined' || !Array.isArray(masters)) {
      console.error('[BarberHome] КРИТИЧЕСКАЯ ОШИБКА: Массив данных masters не найден!');
      return;
    }

    // Рендерим разметку карточек с оберткой .master-card-info для мобильной адаптивности
    grid.innerHTML = masters.map(master => {
      const masterKey = getMasterKey(master.name);
      
      return `
        <div class="master-card" data-id="${master.id}">
          <div class="master-photo">
            <img src="img/${master.avatar || 'placeholder-avatar.svg'}" alt="${master.name}" onerror="this.onerror=null;this.src='img/placeholder-avatar.svg';" />
          </div>
          <div class="master-card-info">
            <div class="master-name">${master.name}</div>
            <div class="master-title">${master.title || 'Барбер'}</div>
            <div class="master-rating" id="rating${masterKey}">⏳ Загрузка...</div>
            <div class="master-slots" id="slots${masterKey}"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  loadReviewsAndSlots: function() {
    if (typeof API === 'undefined' || !API.getReviews) {
      this.updateSlotsFromCache();
      return;
    }

    // Асинхронно запрашиваем отзывы с сервера Google Таблиц
    API.getReviews().then(data => {
      if (data && data.success && Array.isArray(data.reviews)) {
        masters.forEach(master => {
          const masterKey = getMasterKey(master.name);
          const ratingEl = document.getElementById(`rating${masterKey}`);
          if (!ratingEl) return;

          const masterReviews = data.reviews.filter(r => r.masterName === master.name);
          const rating = masterReviews.length > 0 
            ? masterReviews.reduce((sum, r) => sum + Number(r.rating), 0) / masterReviews.length 
            : 0;
          
          if (rating > 0) {
            ratingEl.innerHTML = `${this.renderStars(rating)} <span class="rating-count">(${masterReviews.length})</span>`;
          } else {
            ratingEl.innerHTML = '<span class="rating-count">Новый мастер</span>';
          }
        });
      }
    }).catch(err => console.warn('[BarberHome] Не удалось подгрузить отзывы клиентов:', err));

    this.updateSlotsFromCache();
  },
// js/pages/home.js - Главная страница выбора мастера (Часть 2)
  updateSlotsFromCache: function() {
    if (typeof GlobalCache === 'undefined' || !GlobalCache.getSlots) return;

    const today = (typeof TimeUtils !== 'undefined' && TimeUtils.getToday) ? TimeUtils.getToday() : new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    masters.forEach(master => {
      const masterKey = getMasterKey(master.name);
      const slotsEl = document.getElementById(`slots${masterKey}`);
      if (!slotsEl) return;

      const slots = GlobalCache.getSlots(master.name, today, 15);
      
      if (slots && Array.isArray(slots) && slots.length > 0) {
        const futureSlots = slots.filter(slot => {
          if (typeof TimeUtils !== 'undefined' && TimeUtils.timeToMinutes) {
            return TimeUtils.timeToMinutes(slot) > currentMinutes + 15;
          }
          const [h, m] = slot.split(':').map(Number);
          return (h * 60 + m) > currentMinutes + 15;
        });
        
        const firstSlots = futureSlots.slice(0, 3);
        
        if (firstSlots.length > 0) {
          slotsEl.innerHTML = firstSlots.map(s => `<span class="slot-time">${s}</span>`).join('');
        } else {
          slotsEl.innerHTML = '<span class="slot-time no-slots">Свободного времени нет</span>';
        }
      } else {
        slotsEl.innerHTML = '<span class="slot-time no-slots">Запись закрыта</span>';
      }
    });
  },

  renderStars: function(rating) {
    let html = '';
    const roundedRating = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
      html += i <= roundedRating 
        ? '<i class="fas fa-star"></i>' 
        : '<i class="fas fa-star star-empty"></i>';
    }
    return html;
  },

  initEvents: function() {
    const grid = document.querySelector('.masters-grid');
    const anyMasterCheck = document.getElementById('anyMasterCheck');

    if (grid) {
      // ИСПОЛЬЗУЕМ ДЕЛЕГИРОВАНИЕ КЛИКОВ: Одно событие на всю сетку
      grid.addEventListener('click', function(e) {
        const card = e.target.closest('.master-card');
        if (!card) return;

        // Если кликнули по конкретному барберу — снимаем флаг "Любой специалист"
        if (anyMasterCheck) {
          anyMasterCheck.checked = false;
          AppStorage.remove('anyMaster');
        }
        
        document.querySelectorAll('.master-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        // Сохраняем ID строго как строку в AppStorage
        AppStorage.save('selectedMaster', String(card.dataset.id));
        console.log(`[BarberHome] В AppStorage зафиксирован мастер ID: ${card.dataset.id}`);
      });
    }

    // Управление чекбоксом "Любой специалист"
    if (anyMasterCheck) {
      if (AppStorage.get('anyMaster')) {
        anyMasterCheck.checked = true;
        document.querySelectorAll('.master-card').forEach(c => c.classList.remove('selected'));
      }

      anyMasterCheck.addEventListener('change', function() {
        if (this.checked) {
          document.querySelectorAll('.master-card').forEach(c => c.classList.remove('selected'));
          AppStorage.save('anyMaster', true);
          AppStorage.remove('selectedMaster');
          console.log('[BarberHome] Включен автоподбор: Любой специалист');
        } else {
          AppStorage.remove('anyMaster');
        }
      });
    }

    // Восстанавливаем выделение карточки при возврате на Шаг 1 назад
    const savedMaster = AppStorage.get('selectedMaster');
    if (savedMaster && (!anyMasterCheck || !anyMasterCheck.checked)) {
      document.querySelectorAll('.master-card').forEach(card => {
        if (String(card.dataset.id) === String(savedMaster)) {
          card.classList.add('selected');
        }
      });
    }

    // Обработчик и валидация кнопки "Выбрать услуги"
    const toServicesBtn = document.getElementById('toStep3Btn');
    if (toServicesBtn) {
      toServicesBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        const selected = AppStorage.get('selectedMaster');
        const anyMaster = AppStorage.get('anyMaster');
        
        if (!selected && !anyMaster) {
          alert('⚠️ Пожалуйста, выберите мастера или включите режим "Любой специалист".');
          return;
        }
        
        window.location.href = 'Services.html';
      });
    }
  }
};
