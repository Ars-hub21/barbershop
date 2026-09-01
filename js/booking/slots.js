// booking/slots.js - Получение и отображение свободных слотов (Оптимизированный)
const SlotsUI = {
  selectedDate: null,
  selectedTime: null,
  currentMaster: null,
  totalDuration: 0,

  init: function() {
    this.selectedDate = Storage.get('selectedDate');
    this.selectedTime = Storage.get('selectedTime');
    this.totalDuration = this.calculateTotalDuration();
    this.currentMaster = this.getCurrentMaster();
    
    this.renderCalendar();
    this.initEvents();
  },

  calculateTotalDuration: function() {
    const serviceIds = Storage.get('selectedServices', []);
    let total = 0;
    
    serviceIds.forEach(id => {
      // Приводим оба ID к строке String(), чтобы избежать несовпадения типов данных (строка/число)
      const service = services.find(s => String(s.id) === String(id));
      if (service) total += Number(service.duration);
    });
    return total;
  },

  getCurrentMaster: function() {
    const anyMaster = Storage.get('anyMaster');
    if (anyMaster) return null;
    
    const masterId = Storage.get('selectedMaster');
    // Безопасное приведение типов при поиске мастера
    const master = masters.find(m => String(m.id) === String(masterId));
    return master ? master.name : null;
  },

  renderCalendar: function() {
    const calendarContainer = document.getElementById('calendarMonthYear');
    if (!calendarContainer) return;

    // Включаем лоадер, который мы стилизовали в Части 3 CSS
    this.toggleLoading(true);

    // Вызываем API для получения слотов с учетом безопасных параметров
    API.getFreeSlots(this.currentMaster, this.selectedDate, this.totalDuration)
      .then(data => {
        // Здесь будет ваш код рендеринга сетки на основе полученных слотов бэкенда
        // Пример: this._buildCalendarGrid(data.slots);
      })
      .catch(error => {
        console.error('Ошибка получения слотов:', error);
        this.showErrorMessage('Не удалось загрузить доступное время. Попробуйте позже.');
      })
      .finally(() => {
        this.toggleLoading(false);
      });
  },

  toggleLoading: function(show) {
    // Используем класс .slots-loading из нашей Части 3 CSS
    const loader = document.querySelector('.slots-loading');
    if (loader) {
      loader.style.display = show ? 'block' : 'none';
    }
  },

  showErrorMessage: function(msg) {
    // Используем класс .no-slots-message из нашей Части 3 CSS
    const container = document.querySelector('.slots-container');
    if (container) {
      container.innerHTML = `
        <div class="no-slots-message">
          <p>${msg}</p>
        </div>
      `;
    }
  },

  initEvents: function() {
    // Навешивание обработчиков событий клика на ячейки дней и кнопок времени
  }
};
