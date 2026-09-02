  // barber_panel/js/api.js
// ОТВЕЧАЕТ ЗА:
// - Все HTTP-запросы к Google Apps Script
// - GET и POST методы
// - Обновление статусов заказов и занятости

const API = {
  BASE_URL: 'https://script.google.com/macros/s/AKfycbyoobwP4KjK08nJe7gW3kxzbb6YknK2XFxfBUlzhrh7GV1wETQtr8l_yiQbhiLwhd56/exec',

  // ===== GET ЗАПРОС =====
  get: function(action, params = {}) {
    let url = this.BASE_URL;
    const queryParams = new URLSearchParams();
    queryParams.append('action', action);
    
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        queryParams.append(key, params[key]);
      }
    });
    
    const queryString = queryParams.toString();
    if (queryString) {
      url += '?' + queryString;
    }
    
    console.log('📡 GET запрос:', url);
    
    return fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error('HTTP error! status: ' + response.status);
        }
        return response.json();
      })
      .then(data => {
        if (!data.success) {
          throw new Error(data.error || 'API Error');
        }
        return data;
      })
      .catch(error => {
        console.error('❌ Ошибка GET запроса:', error);
        throw error;
      });
  },

  // ===== POST ЗАПРОС =====
  post: function(action, payload) {
    console.log('📡 POST запрос:', this.BASE_URL, action);
    
    return fetch(this.BASE_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: action,
        ...payload
      })
    })
    .then(response => response.text())
    .then(text => {
      try {
        return JSON.parse(text);
      } catch {
        return { success: true };
      }
    })
    .catch(error => {
      console.error('❌ Ошибка POST запроса:', error);
      throw error;
    });
  },

  // ===== ПОЛУЧЕНИЕ ЗАКАЗОВ =====
  getOrders: function(date, master) {
    return this.get('getOrders', { date, master });
  },

  // ===== ПОЛУЧЕНИЕ НОВЫХ ЗАКАЗОВ (для поллинга) =====
  getNewOrders: function(since) {
    return this.get('getNewOrders', { since });
  },

  // ===== ОБНОВЛЕНИЕ СТАТУСА ЗАКАЗА =====
  updateOrderStatus: function(id, status) {
    return this.post('updateOrderStatus', { id, status });
  },

  // ===== НОВЫЙ МЕТОД: ОБНОВЛЕНИЕ ЦЕНЫ ЗАКАЗА =====
  updateOrderPrice: function(id, price) {
    return this.post('updateOrderPrice', { id, price });
  },

  // ===== ОБНОВЛЕНИЕ СТАТУСА ЗАНЯТОСТИ =====
  updateBusyStatus: function(id, status) {
    return this.post('updateBusyStatus', { id, status });
  },

  // ===== ОБНОВЛЕНИЕ ЦЕНЫ ЗАНЯТОСТИ =====
  updateBusyPrice: function(id, price) {
    return this.post('updateBusyPrice', { id, price });
  },

  // ===== ЗАВЕРШЕНИЕ ЗАНЯТОСТИ =====
  completeBusySlot: function(id) {
    return this.post('completeBusySlot', { id: id });
  },

  // ===== ДОБАВЛЕНИЕ В ИСТОРИЮ =====
  addHistory: function(data) {
    return this.post('addHistory', data);
  },

  // ===== ДОБАВЛЕНИЕ ЗАНЯТОСТИ =====
  addBusy: function(data) {
    return this.post('addBusy', data);
  },

  // ===== ПОЛУЧЕНИЕ ЗАНЯТОСТИ =====
  getBusySlots: function(date) {
    return this.get('getBusySlots', { date });
  },

  // ===== ПОЛУЧЕНИЕ ОТЗЫВОВ =====
  getReviews: function() {
    return this.get('getReviews');
  },

  // ===== ПОЛУЧЕНИЕ ИСТОРИИ =====
  getHistory: function(master) {
    return this.get('getHistory', { master });
  }
};

function getFromLocal(key, defaultVal) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultVal;
}

function saveToLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}