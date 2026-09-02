// barber_panel/js/pages/barber-history.js
document.addEventListener('DOMContentLoaded', function() {
  const BarberHistory = {
    init: function() {
      const fallbackMaster = (typeof ALL_MASTERS !== 'undefined' && ALL_MASTERS[0]) ? ALL_MASTERS[0].name : 'Дени';
      let masterName = new URLSearchParams(window.location.search).get('master') || fallbackMaster;
      masterName = masterName.replace(/[▼▶]/g, '').trim();
      
      document.getElementById('historyMasterName').textContent = `— ${masterName}`;
      this.masterName = masterName;

      const monthInput = document.getElementById('historyMonth');
      const now = new Date();
      monthInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

      this.renderHistory();
      this.initEvents();
    },

    formatDate: function(dateStr) {
      if (!dateStr) return '—';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch {
        return '—';
      }
    },

    formatTime: function(timeStr) {
      if (!timeStr) return '—';
      try {
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return '—';
      }
    },

    formatPhone: function(phone) {
      if (!phone) return '—';  // ← Если нет телефона - прочерк
      const clean = String(phone).replace(/\D/g, '');
      if (clean.length === 11) {
        return `+7 (${clean.slice(1, 4)}) ${clean.slice(4, 7)} ${clean.slice(7, 9)} ${clean.slice(9, 11)}`;
      }
      return phone;
    },

    parsePrice: function(price) {
      if (!price) return '0';
      const str = String(price).replace(/\s/g, '');
      if (str.includes('-') || str.includes('–')) {
        const parts = str.split(/[-–]/);
        return parts[0] || '0';
      }
      return str;
    },

    renderHistory: function() {
      API.getHistory(this.masterName).then(data => {
        if (!data.success) {
          console.error('Ошибка загрузки истории:', data.error);
          return;
        }

        const monthInput = document.getElementById('historyMonth');
        const [year, month] = monthInput.value.split('-').map(Number);
        const filtered = data.history.filter(h => {
          try {
            const hDate = new Date(h.date);
            return hDate.getFullYear() === year && hDate.getMonth() === month - 1;
          } catch {
            return false;
          }
        });

        document.getElementById('historyCount').textContent = filtered.length;
        document.getElementById('historyTotal').textContent = 
          filtered.reduce((sum, h) => sum + Number(this.parsePrice(h.price)), 0) + ' ₽';

        const list = document.getElementById('historyList');
        if (filtered.length === 0) {
          list.innerHTML = '<div class="empty-state">Нет обслуженных клиентов</div>';
          return;
        }

        list.innerHTML = filtered
          .sort((a, b) => {
            try {
              return new Date(b.date) - new Date(a.date);
            } catch {
              return 0;
            }
          })
          .map(h => {
            const date = this.formatDate(h.date);
            const time = this.formatTime(h.start);
            const price = this.parsePrice(h.price);
            const clientName = h.clientName || '—';
            const services = h.services || '—';
            const phone = this.formatPhone(h.phone || '');

            return `
              <div class="history-item-new">
                <div class="history-row">
                  <div class="history-col history-col-date">
                    <div class="history-date">${date}</div>
                    <div class="history-time">${time}</div>
                  </div>
                  <div class="history-col history-col-client">
                    <div class="history-name">${clientName}</div>
                    <div class="history-phone">${phone}</div>
                  </div>
                  <div class="history-col history-col-services">
                    <div class="history-services">${services}</div>
                  </div>
                  <div class="history-col history-col-price">
                    <div class="history-price">${price} ₽</div>
                  </div>
                </div>
              </div>
            `;
          }).join('');
      }).catch(error => {
        console.error('Ошибка:', error);
      });
    },

    initEvents: function() {
      document.getElementById('historyMonth').addEventListener('change', () => {
        this.renderHistory();
      });
    }
  };

  BarberHistory.init();
});