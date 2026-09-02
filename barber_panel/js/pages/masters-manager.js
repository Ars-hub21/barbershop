// barber_panel/js/pages/masters-manager.js
// ОТВЕЧАЕТ ЗА:
// - Экран управления составом мастеров (добавить/изменить/убрать, 1-50 шт.)
// - Генерацию готового файла js/data/masters.js для выгрузки на GitHub
//
// ВАЖНО: эта страница НИЧЕГО не отправляет на сервер и не трогает Google
// Таблицы/API — она только редактирует список мастеров в памяти браузера
// и в конце формирует текстовый файл, который администратор сам заливает
// на GitHub (тот же ручной способ, каким публиковался весь сайт).

document.addEventListener('DOMContentLoaded', function () {
  const MastersManager = {
    // Рабочая копия — редактируем её, не трогая исходный массив masters
    // напрямую, пока администратор не нажмёт "Скачать обновлённый файл".
    working: [],

    init: function () {
      this.working = (typeof masters !== 'undefined' ? masters : []).map(m => ({ ...m }));
      this.render();
      document.getElementById('addMasterBtn').addEventListener('click', () => this.addMaster());
      document.getElementById('downloadMastersBtn').addEventListener('click', () => this.downloadFile());
    },

    // ===== ТРАНСЛИТЕРАЦИЯ ИМЕНИ В ЛАТИНСКИЙ "КЛЮЧ" =====
    slugify: function (name) {
      const map = {
        а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',
        к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
        х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
      };
      const lower = String(name || '').toLowerCase();
      let out = '';
      for (const ch of lower) {
        out += map[ch] !== undefined ? map[ch] : ch;
      }
      out = out.replace(/[^a-z0-9]/g, '');
      if (!out) out = 'master';
      return out.charAt(0).toUpperCase() + out.slice(1);
    },

    // Гарантируем уникальность ключа/id при автогенерации
    uniqueKey: function (base, exceptIndex) {
      let key = base;
      let i = 2;
      while (this.working.some((m, idx) => idx !== exceptIndex && m.key === key)) {
        key = base + i;
        i++;
      }
      return key;
    },

    nextId: function () {
      const max = this.working.reduce((acc, m) => Math.max(acc, Number(m.id) || 0), 0);
      return max + 1;
    },

    addMaster: function () {
      if (this.working.length >= 50) {
        alert('Достигнут максимум — 50 мастеров.');
        return;
      }
      this.working.push({
        id: this.nextId(),
        key: this.uniqueKey('Master' + this.nextId()),
        name: '',
        title: 'Барбер',
        avatar: ''
      });
      this.render();
      // Фокус на поле имени только что добавленной карточки
      const cards = document.querySelectorAll('.master-edit-card');
      const last = cards[cards.length - 1];
      last?.querySelector('input[data-field="name"]')?.focus();
    },

    removeMaster: function (index) {
      const m = this.working[index];
      if (!confirm(`Убрать мастера «${m.name || '(без имени)'}» из списка?`)) return;
      this.working.splice(index, 1);
      this.render();
    },

    updateField: function (index, field, value) {
      this.working[index][field] = value;
      if (field === 'name' && !this.working[index]._keyEditedManually) {
        // Пока ключ не редактировали руками — подстраиваем его под имя
        this.working[index].key = this.uniqueKey(this.slugify(value), index);
        this.render();
      }
    },

    render: function () {
      const list = document.getElementById('mastersList');
      const countEl = document.getElementById('mastersCount');

      if (this.working.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary);">Список пуст. Добавьте хотя бы одного мастера.</p>';
      } else {
        list.innerHTML = this.working.map((m, i) => `
          <div class="master-edit-card">
            <div class="master-edit-avatar">
              <img src="../img/${m.avatar || 'placeholder-avatar.svg'}" alt="" onerror="this.onerror=null;this.src='../img/placeholder-avatar.svg';" />
            </div>
            <div class="master-edit-fields">
              <div class="form-group">
                <label>Имя</label>
                <input type="text" data-field="name" data-index="${i}" value="${this.escape(m.name)}" placeholder="Например, Иван" />
              </div>
              <div class="form-group">
                <label>Должность</label>
                <input type="text" data-field="title" data-index="${i}" value="${this.escape(m.title || '')}" placeholder="Барбер" />
              </div>
              <div class="form-group">
                <label>Файл фото (в папке img/)</label>
                <input type="text" data-field="avatar" data-index="${i}" value="${this.escape(m.avatar || '')}" placeholder="Ivan.png" />
              </div>
              <div class="form-group">
                <label>Ключ (латиницей, для системы)</label>
                <input type="text" data-field="key" data-index="${i}" value="${this.escape(m.key)}" placeholder="Ivan" />
              </div>
            </div>
            <button class="btn btn-danger btn-sm master-edit-remove" data-index="${i}" title="Убрать мастера">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `).join('');
      }

      countEl.textContent = `Мастеров в списке: ${this.working.length} из 50`;

      // Навешиваем обработчики (после каждой перерисовки)
      list.querySelectorAll('input[data-field]').forEach(input => {
        input.addEventListener('input', (e) => {
          const idx = Number(e.target.dataset.index);
          const field = e.target.dataset.field;
          if (field === 'key') {
            this.working[idx]._keyEditedManually = true;
            this.working[idx].key = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
          } else if (field === 'avatar') {
            this.working[idx].avatar = e.target.value.trim();
            // Обновляем превью без полной перерисовки списка (чтобы не терять фокус)
            const preview = e.target.closest('.master-edit-card').querySelector('.master-edit-avatar img');
            if (preview) preview.src = '../img/' + (this.working[idx].avatar || 'placeholder-avatar.svg');
          } else {
            this.updateField(idx, field, e.target.value);
          }
        });
      });

      list.querySelectorAll('.master-edit-remove').forEach(btn => {
        btn.addEventListener('click', () => this.removeMaster(Number(btn.dataset.index)));
      });
    },

    escape: function (str) {
      return String(str || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    },

    validate: function () {
      const errors = [];
      if (this.working.length === 0) errors.push('Список мастеров пуст.');
      if (this.working.length > 50) errors.push('Мастеров больше 50 — уберите лишних.');

      const keys = new Set();
      const ids = new Set();
      this.working.forEach((m, i) => {
        const n = i + 1;
        if (!m.name || !m.name.trim()) errors.push(`Мастер №${n}: не указано имя.`);
        if (!m.key || !/^[a-zA-Z0-9]+$/.test(m.key)) errors.push(`Мастер №${n} (${m.name || '?'}): ключ должен быть латиницей/цифрами без пробелов.`);
        if (keys.has(m.key)) errors.push(`Мастер №${n} (${m.name || '?'}): ключ "${m.key}" уже занят другим мастером.`);
        keys.add(m.key);
        if (ids.has(m.id)) errors.push(`Мастер №${n} (${m.name || '?'}): повторяющийся id.`);
        ids.add(m.id);
      });
      return errors;
    },

    buildFileContent: function () {
      const entries = this.working.map(m => {
        const title = m.title && m.title.trim() ? m.title.trim() : 'Барбер';
        return `  { id: ${JSON.stringify(m.id)}, key: ${JSON.stringify(m.key)}, name: ${JSON.stringify(m.name.trim())}, title: ${JSON.stringify(title)}, avatar: ${JSON.stringify(m.avatar || 'placeholder-avatar.svg')} }`;
      }).join(',\n');

      return `/* ==========================================================================
   js/data/masters.js — ЕДИНЫЙ СПИСОК МАСТЕРОВ САЛОНА
   ==========================================================================
   Сформировано автоматически на странице "Мастера" панели барберов
   (barber_panel/masters.html) — ${new Date().toLocaleString('ru-RU')}.

   Этот файл — единственный источник правды о составе мастеров. Его читают
   и клиентский сайт, и панель барберов. Замените этим файлом файл
   js/data/masters.js в репозитории на GitHub, чтобы изменения применились
   везде. Не забудьте также загрузить в папку img/ фотографии новых
   мастеров под именами файлов, указанными в поле avatar ниже.

   ЭТОТ ФАЙЛ НЕ КАСАЕТСЯ БАЗЫ ДАННЫХ И API.
   ========================================================================== */
const masters = [
${entries}
];

/* ---------- Вспомогательные функции (используются панелью барберов) ---------- */

function getMasterByName(name) {
  return masters.find(function (m) { return m.name === name; });
}

function getMasterKey(name) {
  const found = getMasterByName(name);
  if (found) return found.key;
  return String(name || 'master').replace(/[^a-zA-Z0-9]/g, '') || 'master';
}
`;
    },

    downloadFile: function () {
      const errors = this.validate();
      if (errors.length > 0) {
        alert('Прежде чем скачать файл, исправьте:\n\n- ' + errors.join('\n- '));
        return;
      }

      const content = this.buildFileContent();
      const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'masters.js';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  MastersManager.init();
});
