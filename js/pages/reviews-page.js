// client/js/pages/reviews-page.js
const ReviewsPage = {
  selectedRating: 0,

  init: function() {
    this.renderMasterOptions();
    this.renderReviews();
    this.initStarRating();
    this.initSubmit();
  },

  // Список мастеров в фильтре "Выберите мастера" — из js/data/masters.js,
  // работает для любого количества мастеров (1-50).
  renderMasterOptions: function() {
    const select = document.getElementById('reviewMaster');
    if (!select || typeof masters === 'undefined') return;
    select.innerHTML = masters.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
  },

  formatDate: function(dateStr) {
    if (!dateStr) return '—';
    
    try {
      const parts = dateStr.split(' ');
      const datePart = parts[0] || dateStr;
      const timePart = parts[1] || '';
      
      const dateParts = datePart.split('-');
      if (dateParts.length === 3) {
        let result = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
        if (timePart) {
          const time = timePart.split(':');
          result += ` ${time[0]}:${time[1]}`;
        }
        return result;
      }
      
      if (dateStr.includes('T')) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${day}.${month}.${year} ${hours}:${minutes}`;
        }
      }
      
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  },

  renderReviews: function() {
    API.getReviews().then(data => {
      const list = document.getElementById('reviewsList');
      if (!list) return;

      if (!data.success || data.reviews.length === 0) {
        list.innerHTML = '<div class="empty-state">Пока нет отзывов. Будьте первым!</div>';
        return;
      }

      const sortedReviews = data.reviews.sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });

      list.innerHTML = sortedReviews.map(r => `
        <div class="review-item">
          <div class="review-top-row">
            <div class="review-client-info">
              <span class="review-client-name">👤 ${r.clientName || '—'}</span>
            </div>
            <div class="review-master">
              <span class="review-master-name">Мастер: ${r.masterName || '—'}</span>
            </div>
          </div>
          <div class="review-bottom-row">
            <span class="review-client-date">📅 ${this.formatDate(r.date)}</span>
            <span class="review-stars">${this.renderStars(r.rating)}</span>
          </div>
          <div class="review-text">${r.text || ''}</div>
        </div>
      `).join('');
    }).catch(err => {
      // Небольшая защита от необработанного отказа сети — не меняет логику работы с API,
      // просто не даёт странице упасть с необработанной ошибкой, если сервер недоступен.
      console.warn('[ReviewsPage] Не удалось загрузить отзывы:', err);
      const list = document.getElementById('reviewsList');
      if (list) list.innerHTML = '<div class="empty-state">Не удалось загрузить отзывы. Попробуйте обновить страницу.</div>';
    });
  },

  renderStars: function(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += i <= Math.round(rating) 
        ? '<i class="fas fa-star"></i>' 
        : '<i class="fas fa-star star-empty"></i>';
    }
    return html;
  },

  initStarRating: function() {
    document.querySelectorAll('#starRating .star').forEach(star => {
      star.addEventListener('click', () => {
        this.selectedRating = parseInt(star.dataset.value);
        document.querySelectorAll('#starRating .star').forEach(s => {
          s.classList.toggle('active', parseInt(s.dataset.value) <= this.selectedRating);
        });
      });

      star.addEventListener('mouseenter', () => {
        const val = parseInt(star.dataset.value);
        document.querySelectorAll('#starRating .star').forEach(s => {
          s.style.color = parseInt(s.dataset.value) <= val ? 'var(--star-active)' : 'var(--star-inactive)';
        });
      });

      star.addEventListener('mouseleave', () => {
        document.querySelectorAll('#starRating .star').forEach(s => {
          s.style.color = s.classList.contains('active') ? 'var(--star-active)' : 'var(--star-inactive)';
        });
      });
    });
  },

  initSubmit: function() {
    const submitBtn = document.getElementById('submitReview');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', () => {
      const masterName = document.getElementById('reviewMaster').value;
      const clientName = document.getElementById('reviewName').value.trim();
      const text = document.getElementById('reviewText').value.trim();
      const rating = this.selectedRating;

      if (!clientName) { alert('Введите ваше имя.'); return; }
      if (!text) { alert('Напишите текст отзыва.'); return; }
      if (rating === 0) { alert('Поставьте оценку.'); return; }

      withButtonLock(submitBtn, () => 
        API.addReview({ masterName, clientName, text, rating })
          .then(() => {
            document.getElementById('reviewName').value = '';
            document.getElementById('reviewText').value = '';
            this.selectedRating = 0;
            document.querySelectorAll('#starRating .star').forEach(s => s.classList.remove('active'));
            this.renderReviews();
            alert('Спасибо за ваш отзыв!');
          })
      , 'Отправка...').catch(err => {
        if (err !== 'Button already locked') {
          alert('Ошибка при отправке отзыва. Попробуйте ещё раз.');
          console.error('Ошибка отправки отзыва:', err);
        }
      });
    });
  }
};