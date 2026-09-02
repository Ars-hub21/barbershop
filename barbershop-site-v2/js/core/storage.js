// js/core/storage.js - Исправленный модуль управления локальным кэшем
const AppStorage = {
  save: function(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Ошибка записи в LocalStorage:', e);
    }
  },

  get: function(key, defaultVal = null) {
    const data = localStorage.getItem(key);
    
    if (!data || data === 'undefined' || data === 'null') {
      return defaultVal;
    }
    
    try {
      return JSON.parse(data);
    } catch (e) {
      console.warn(`Ошибка чтения ключа "${key}", применен дефолт:`, e);
      return defaultVal;
    }
  },

  remove: function(key) {
    localStorage.removeItem(key);
  },

  clear: function() {
    const keysToClear = [
      'selectedMaster', 
      'selectedServices', 
      'selectedDate', 
      'selectedTime', 
      'clientData', 
      'anyMaster', 
      'lastOrderNumber'
    ];
    keysToClear.forEach(key => localStorage.removeItem(key));
  }
};

// Создаем глобальный безопасный алиас на случай, если где-то в старых файлах остался вызов старого имени
window.BarberStorage = AppStorage;
