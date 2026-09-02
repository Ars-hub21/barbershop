// barber_panel/js/pages/barber-reviews.js
document.addEventListener('DOMContentLoaded', function() {
  const BarberReviews = {
    // ===== ДОБАВЛЕНО: интервал поллинга =====
    syncInterval: null,
    lastReviewsHash: null,  // Для отслеживания изменений

    init: function() {
      this.renderMasterFilterOptions();
      this.renderReviews();
      this.initEvents();
      this.startPolling();  // ← ЗАПУСКАЕМ ПОЛЛИНГ
    },

    // ===== СПИСОК МАСТЕРОВ В ФИЛЬТРЕ (из ../js/data/masters.js) =====
    // Работает для любого количества мастеров (1-50), а не только двух.
    renderMasterFilterOptions: function() {
      const select = document.getElementById('filterMaster');
      if (!select || typeof masters === 'undefined') return;
      const options = masters.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
      select.innerHTML = '<option value="all">Все</option>' + options;
    },

    // ===== НОВЫЙ МЕТОД: поллинг отзывов =====
    startPolling: function() {
      // Проверяем каждые 15 секунд
      this.syncInterval = setInterval(() => {
        this.checkForNewReviews();
      }, 15000);
      console.log('🔄 Поллинг отзывов запущен (каждые 10 сек)');
    },

    // ===== НОВЫЙ МЕТОД: проверка новых отзывов =====
    checkForNewReviews: function() {
      API.getReviews().then(data => {
        if (!data.success) return;

        // Создаём "хэш" для сравнения — количество + дата последнего
        const reviews = data.reviews;
        const latestDate = reviews.length > 0 ? reviews[0].date : '';
        const newHash = `${reviews.length}|${latestDate}`;

        // Если изменилось — перерендериваем
        if (this.lastReviewsHash && this.lastReviewsHash !== newHash) {
          console.log('🆕 Обнаружены новые отзывы, обновляем...');
          this.renderReviewsFromData(data);
          this.playNotificationSound();  // Опционально: звук уведомления
        }

        this.lastReviewsHash = newHash;
      }).catch(err => {
        console.error('Ошибка поллинга отзывов:', err);
      });
    },

    // ===== ВЫДЕЛЕННЫЙ РЕНДЕР (чтобы не дублировать код) =====
    renderReviewsFromData: function(data) {
      const filter = document.getElementById('filterMaster').value;
      let reviews = filter === 'all' 
        ? data.reviews 
        : data.reviews.filter(r => r.masterName === filter);

      // Сортировка: новые сверху
      reviews = reviews.sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });

      // Обновляем статистику
      this.updateStats(data.reviews);

      const list = document.getElementById('reviewsList');
      if (reviews.length === 0) {
        list.innerHTML = '<div class="empty-state">Нет отзывов</div>';
        return;
      }

      list.innerHTML = reviews.map(r => `
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
    },

    // ===== ОБНОВЛЁННЫЙ renderReviews =====
    renderReviews: function() {
      API.getReviews().then(data => {
        if (!data.success) return;

        // Сохраняем начальный хэш
        const reviews = data.reviews;
        const latestDate = reviews.length > 0 ? reviews[0].date : '';
        this.lastReviewsHash = `${reviews.length}|${latestDate}`;

        this.renderReviewsFromData(data);
      });
    },

    // ===== НОВЫЙ МЕТОД: обновление статистики =====
    updateStats: function(allReviews) {
      const stats = document.getElementById('reviewsStats');
      // Список имён мастеров из ../js/data/masters.js — работает для
      // любого количества мастеров (1-50), а не только двух захардкоженных.
      const masterNames = (typeof masters !== 'undefined' ? masters : []).map(m => m.name);
      let statsHtml = '<div class="history-stats">';
      masterNames.forEach(m => {
        const mReviews = allReviews.filter(r => r.masterName === m);
        const count = mReviews.length;
        const avg = count > 0 ? (mReviews.reduce((s, r) => s + r.rating, 0) / count) : 0;
        statsHtml += `
          <div class="stat-card">
            <span class="stat-label">${m}</span>
            <span class="stat-value">${avg > 0 ? avg.toFixed(1) : '—'} ⭐</span>
            <span style="color:var(--text-secondary);font-size:0.9rem;">${count} отзывов</span>
          </div>
        `;
      });
      statsHtml += '</div>';
      stats.innerHTML = statsHtml;
    },

    // ===== ОПЦИОНАЛЬНО: звук уведомления =====
    playNotificationSound: function() {
      const audio = document.getElementById('notificationSound');
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
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

    initEvents: function() {
      document.getElementById('filterMaster').addEventListener('change', () => {
        this.renderReviews();  // Перезагружаем с учётом фильтра
      });
    },

    // ===== ДОБАВЛЕНО: остановка поллинга при уходе =====
    stopPolling: function() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        console.log('⏹️ Поллинг отзывов остановлен');
      }
    }
  };

  BarberReviews.init();

  // Останавливаем поллинг при уходе со страницы
  window.addEventListener('beforeunload', () => {
    BarberReviews.stopPolling();
  });
});