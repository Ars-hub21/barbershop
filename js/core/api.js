// core/api.js - Единый слой для работы с API (Оптимизированный)
const API = {
  // Универсальный обработчик ответов от бэкенда Google Apps Script
  _handleResponse: function(response) {
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    return response.json().then(data => {
      // Если сервер прислал success: false внутри JSON
      if (data && data.success === false) {
        throw new Error(data.error || 'Ошибка выполнения операции на сервере');
      }
      return data;
    });
  },

  get: function(action, params = {}) {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.append('action', action);
    
    Object.keys(params).forEach(key => {
      // Исключаем передачу null/undefined как строк, преобразуя в пустые поля
      const value = (params[key] === null || params[key] === undefined) ? '' : params[key];
      url.searchParams.append(key, value);
    });
    
    return fetch(url.toString()).then(this._handleResponse);
  },

  post: function(action, payload) {
    // ИСПРАВЛЕНО: Заголовки переведены на text/plain для обхода Preflight OPTIONS проверок
    return fetch(CONFIG.API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify({
        action: action,
        ...payload
      })
    }).then(this._handleResponse);
  },
// core/api.js - Единый слой для работы с API (Часть 2)
  getFreeSlots: function(master, date, duration) {
    // Если выбран "Любой специалист", передаем пустую строку для бэкенда
    return this.get('getFreeSlots', { master: master || '', date, duration });
  },

  getOrders: function(date, master) {
    return this.get('getOrders', { date, master: master || '' });
  },

  getReviews: function() {
    return this.get('getReviews');
  },

  createOrder: function(data) {
    return this.post('createOrder', data);
  },

  addReview: function(data) {
    return this.post('addReview', data);
  },

  getNewOrders: function(since) {
    return this.get('getNewOrders', { since });
  },

  updateOrderStatus: function(id, status) {
    return this.post('updateOrderStatus', { id, status });
  },

  addBusy: function(data) {
    return this.post('addBusy', data);
  }
};
