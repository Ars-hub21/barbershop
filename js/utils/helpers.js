/* ============================================
   frontend/client/js/helpers.js
   Вспомогательные функции
   ============================================ */

function saveToLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getFromLocal(key, defaultVal = null) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultVal;
}

function getOrders() {
  return getFromLocal('orders', []);
}

function getBusySlots() {
  return getFromLocal('busySlots', []);
}

function getReviews() {
  return getFromLocal('reviews', []);
}

function generateOrderNumber() {
  const now = new Date();
  const datePart = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${datePart}-${random}`;
}

// function formatDuration(minutes) {
//   if (minutes < 60) return `${minutes} мин`;
//   const h = Math.floor(minutes / 60);
//   const m = minutes % 60;
//   return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
// }

// function generateAllSlots() {
//   const slots = [];
//   for (let h = 10; h < 24; h++) {
//     for (let m = 0; m < 60; m += 15) {
//       slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
//     }
//   }
//   return slots;
// }

function renderStars(rating, maxStars = 5) {
  let html = '';
  for (let i = 1; i <= maxStars; i++) {
    if (i <= Math.round(rating)) {
      html += '<i class="fas fa-star"></i>';
    } else {
      html += '<i class="fas fa-star star-empty"></i>';
    }
  }
  return html;
}

function filterSlotsByDuration(slots, totalDuration) {
  if (totalDuration === 0) return slots;
  return slots.filter(slot => {
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m + totalDuration <= 24 * 60;
  });
}

// function timeToMinutes(time) {
//   const [h, m] = time.split(':').map(Number);
//   return h * 60 + m;
// }

// ===== УНИВЕРСАЛЬНАЯ БЛОКИРОВКА КНОПКИ =====
// Если на странице подключен js/utils/scissors-loader.js — кнопка "подстригается"
// ножницами, иначе используется старый текстовый вариант (запасной путь).
function withButtonLock(button, asyncFn, loadingText = 'Отправка...') {
  if (!button || button.disabled) return Promise.reject('Button already locked');

  if (typeof ScissorsLoader !== 'undefined') {
    ScissorsLoader.start(button, { loadingText: loadingText });
    return asyncFn().finally(() => ScissorsLoader.stop(button));
  }

  const originalText = button.innerHTML;
  button.disabled = true;
  button.innerHTML = loadingText;

  return asyncFn()
    .finally(() => {
      button.disabled = false;
      button.innerHTML = originalText;
    });
}