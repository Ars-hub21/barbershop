// js/core/config.js - Глобальная конфигурация приложения барбершопа
const CONFIG = {
  // Ваш реальный URL развернутого Web App Google Apps Script
  API_URL: 'https://script.google.com/macros/s/AKfycbyoobwP4KjK08nJe7gW3kxzbb6YknK2XFxfBUlzhrh7GV1wETQtr8l_yiQbhiLwhd56/exec', 
  
  // Системные настройки расписания визитов
  WORK_START: '10:00',
  WORK_END: '00:00',
  SLOT_INTERVAL: 15, // Шаг сетки времени
  
  // ===== ВРЕМЯ НА ПОДГОТОВКУ МАСТЕРА (В МИНУТАХ) =====
  PREP_BUFFER: 0    // Поменяйте это число, например, на 5 или 30, когда нужно
};