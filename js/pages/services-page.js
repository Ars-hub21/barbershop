// js/pages/services-page.js - Страница выбора услуг барбершопа (Часть 1)
const ServicesPage = {
  selectedServices: [],
  currentCategory: 'all',

  init: function() {
    console.log('🏁 [ServicesPage] Инициализация Шага 3...');
    
    // Безопасно загружаем и приводим все сохраненные ID услуг к строкам String() из AppStorage
    const saved = AppStorage.get('selectedServices', []);
    this.selectedServices = Array.isArray(saved) ? saved.map(String) : [];
    
    this.renderServices();
    this.initTabs();
    this.updateSummary();
    this.initNavigation();
  },

  renderServices: function() {
    const container = document.getElementById('servicesContainer');
    if (!container) return;

    if (typeof services === 'undefined' || !Array.isArray(services)) {
      container.innerHTML = '<div class="slots-placeholder">Ошибка: Список услуг не найден.</div>';
      return;
    }

    let filtered = services;
    if (this.currentCategory !== 'all') {
      filtered = services.filter(s => s.category === this.currentCategory);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="slots-placeholder">В данной категории пока нет доступных услуг.</div>';
      return;
    }

    // Генерируем разметку прайс-листа барбершопа по Части 4 нашего CSS
    container.innerHTML = filtered.map(service => {
      const isSelected = this.selectedServices.includes(String(service.id));
      
      return `
        <div class="service-card ${isSelected ? 'selected' : ''}" data-id="${service.id}">
          <div class="service-header">
            <input type="checkbox" value="${service.id}" ${isSelected ? 'checked' : ''}>
            <div class="service-info">
              <div class="service-name">${service.name}</div>
              <div class="service-desc">${service.description || ''}</div>
              <div class="service-meta">
                <span><i class="far fa-clock" style="margin-right: 0.3rem;"></i>${typeof TimeUtils !== 'undefined' ? TimeUtils.formatDuration(service.duration) : service.duration + ' мин.'}</span>
                <span class="service-price">${service.price} ₽</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.initServiceEvents();
  },
// js/pages/services-page.js - Страница выбора услуг барбершопа (Часть 2)
  initServiceEvents: function() {
    const self = this; // Жестко фиксируем контекст объекта страницы для внутренней логики событий

    document.querySelectorAll('.service-card').forEach(card => {
      card.addEventListener('click', function(e) {
        // Исключаем двойное срабатывание при прямом клике на сам чекбокс
        if (e.target.closest('input[type="checkbox"]')) return;
        
        const cb = this.querySelector('input[type="checkbox"]');
        if (cb) {
          cb.checked = !cb.checked;
          // Корректно вызываем триггер события изменения
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });

    document.querySelectorAll('.service-card input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', function() {
        const idStr = String(this.value);
        const card = this.closest('.service-card');
        
        if (this.checked) {
          if (!self.selectedServices.includes(idStr)) {
            self.selectedServices.push(idStr);
          }
          if (card) card.classList.add('selected'); // Подсвечиваем золотой рамкой CSS
        } else {
          self.selectedServices = self.selectedServices.filter(s => s !== idStr);
          if (card) card.classList.remove('selected'); // Гасим подсветку
        }
        
        // Переведено на использование AppStorage
        AppStorage.save('selectedServices', self.selectedServices);
        self.updateSummary();
      });
    });
  },

  initTabs: function() {
    const self = this;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        self.currentCategory = this.dataset.category;
        self.renderServices();
      });
    });
  },

  updateSummary: function() {
    const totalPriceSpan = document.getElementById('totalPrice');
    const totalDurationSpan = document.getElementById('totalDuration');
    
    let totalMinPrice = 0;
    let totalMaxPrice = 0;
    let totalDuration = 0;

    this.selectedServices.forEach(idStr => {
      const service = services.find(s => String(s.id) === idStr);
      if (service) {
        // Парсим ценовые диапазоны (например, если цена записана строкой вида "1400–2000")
        const priceStr = String(service.price).replace(/\s/g, '');
        let minPrice = 0, maxPrice = 0;
        
        if (priceStr.includes('-') || priceStr.includes('–')) {
          const parts = priceStr.split(/[-–]/);
          // ИСПРАВЛЕНО: Теперь берем конкретные элементы массива по индексам
          minPrice = parseInt(parts[0], 10) || 0;
          maxPrice = parseInt(parts[1], 10) || 0;
        } else {
          minPrice = parseInt(priceStr, 10) || 0;
          maxPrice = minPrice;
        }
        
        totalMinPrice += minPrice;
        totalMaxPrice += maxPrice;
        totalDuration += parseInt(service.duration, 10);
      }
    });

    // Красиво отображаем итоговый диапазон цен или моно-цену
    if (totalPriceSpan) {
      totalPriceSpan.textContent = (totalMinPrice === totalMaxPrice) 
        ? totalMinPrice 
        : `${totalMinPrice}–${totalMaxPrice}`;
    }
    
    if (totalDurationSpan) {
      totalDurationSpan.textContent = (typeof TimeUtils !== 'undefined' && TimeUtils.formatDuration)
        ? TimeUtils.formatDuration(totalDuration)
        : totalDuration + ' мин.';
    }
  },

  initNavigation: function() {
    const toFreeSlotsBtn = document.getElementById('toFreeSlotsBtn');
    if (toFreeSlotsBtn) {
      // Очищаем старые слушатели путем клонирования, предотвращая размножение событий
      const newBtn = toFreeSlotsBtn.cloneNode(true);
      toFreeSlotsBtn.parentNode.replaceChild(newBtn, toFreeSlotsBtn);

      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        // Переведено на использование AppStorage
        const currentSelection = AppStorage.get('selectedServices', []);
        
        if (!currentSelection || currentSelection.length === 0) {
          alert('⚠️ Пожалуйста, выберите хотя бы одну услугу из прайс-листа барбершопа.');
          return;
        }
        window.location.href = 'Free-slots.html';
      });
    }
  }
};
