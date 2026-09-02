// barber_panel/js/pages/masters-manager.js
// ОТВЕЧАЕТ ЗА:
// - Экран управления составом мастеров ОБЕИХ версий сайта (мужская команда
//   барбершопа и женская команда салона красоты — 1-50 мастеров в каждой)
// - Генерацию готового файла js/data/masters.js для выгрузки на GitHub,
//   содержащего сразу обе команды (MASTERS_BY_GENDER)
//
// ВАЖНО: эта страница НИЧЕГО не отправляет на сервер и не трогает Google
// Таблицы/API — она только редактирует список мастеров в памяти браузера
// и в конце формирует текстовый файл, который администратор сам заливает
// на GitHub (тот же ручной способ, каким публиковался весь сайт).

document.addEventListener('DOMContentLoaded', function () {
  const MastersManager = {
    // Рабочие копии ОБЕИХ команд — редактируем их, не трогая исходный
    // MASTERS_BY_GENDER напрямую, пока администратор не нажмёт
    // "Скачать обновлённый файл".
    workingByGender: { masculine: [], feminine: [] },
    activeGender: 'masculine',

    init: function () {
      const src = (typeof MASTERS_BY_GENDER !== 'undefined') ? MASTERS_BY_GENDER : { masculine: [], feminine: [] };
      this.workingByGender.masculine = (src.masculine || []).map(m => ({ ...m }));
      this.workingByGender.feminine = (src.feminine || []).map(m => ({ ...m }));

      this.render();
      this.initTabs();
      document.getElementById('addMasterBtn').addEventListener('click', () => this.addMaster());
      document.getElementById('downloadMastersBtn').addEventListener('click', () => this.downloadFile());
    },

    // Текущий редактируемый массив (мужская или женская команда — по вкладке)
    current: function () {
      return this.workingByGender[this.activeGender];
    },

    // Все мастера обеих команд разом — нужно для проверки уникальности id/key
    allWorking: function () {
      return this.workingByGender.masculine.concat(this.workingByGender.feminine);
    },

    initTabs: function () {
      const tabs = document.querySelectorAll('.gender-tab-btn');
      tabs.forEach(btn => {
        btn.addEventListener('click', () => {
          this.activeGender = btn.dataset.gender === 'feminine' ? 'feminine' : 'masculine';
          tabs.forEach(b => b.classList.toggle('active', b === btn));
          this.render();
        });
      });
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

    // Гарантируем уникальность ключа СРЕДИ ВСЕХ мастеров обеих команд
    // (ключ используется для id элементов в HTML — должен быть глобально уникальным)
    uniqueKey: function (base, exceptEntry) {
      let key = base;
      let i = 2;
      const all = this.allWorking();
      while (all.some(m => m !== exceptEntry && m.key === key)) {
        key = base + i;
        i++;
      }
      return key;
    },

    // Гарантируем уникальность id СРЕДИ ВСЕХ мастеров обеих команд
    nextId: function () {
      const all = this.allWorking();
      const max = all.reduce((acc, m) => Math.max(acc, Number(m.id) || 0), 0);
      return max + 1;
    },

    addMaster: function () {
      const list = this.current();
      if (list.length >= 50) {
        alert('Достигнут максимум — 50 мастеров в этой команде.');
        return;
      }
      const id = this.nextId();
      list.push({
        id: id,
        key: this.uniqueKey('Master' + id),
        name: '',
        title: this.activeGender === 'feminine' ? 'Мастер' : 'Барбер',
        avatar: ''
      });
      this.render();
      // Фокус на поле имени только что добавленной карточки
      const cards = document.querySelectorAll('.master-edit-card');
      const last = cards[cards.length - 1];
      last?.querySelector('input[data-field="name"]')?.focus();
    },

    removeMaster: function (index) {
      const list = this.current();
      const m = list[index];
      if (!confirm(`Убрать мастера «${m.name || '(без имени)'}» из списка?`)) return;
      list.splice(index, 1);
      this.render();
    },

    updateField: function (index, field, value) {
      const list = this.current();
      list[index][field] = value;
      if (field === 'name' && !list[index]._keyEditedManually) {
        // Пока ключ не редактировали руками — подстраиваем его под имя
        list[index].key = this.uniqueKey(this.slugify(value), list[index]);
        this.render();
      }
    },

    render: function () {
      const list = document.getElementById('mastersList');
      const countEl = document.getElementById('mastersCount');
      const working = this.current();

      if (working.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary);">Список пуст. Добавьте хотя бы одного мастера.</p>';
      } else {
        list.innerHTML = working.map((m, i) => `
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
                <input type="text" data-field="title" data-index="${i}" value="${this.escape(m.title || '')}" placeholder="${this.activeGender === 'feminine' ? 'Мастер' : 'Барбер'}" />
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

      const total = this.workingByGender.masculine.length + this.workingByGender.feminine.length;
      countEl.textContent = `В этой команде: ${working.length} из 50 · Всего в обеих командах: ${total}`;

      // Навешиваем обработчики (после каждой перерисовки)
      list.querySelectorAll('input[data-field]').forEach(input => {
        input.addEventListener('input', (e) => {
          const idx = Number(e.target.dataset.index);
          const field = e.target.dataset.field;
          const arr = this.current();
          if (field === 'key') {
            arr[idx]._keyEditedManually = true;
            arr[idx].key = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
          } else if (field === 'avatar') {
            arr[idx].avatar = e.target.value.trim();
            // Обновляем превью без полной перерисовки списка (чтобы не терять фокус)
            const preview = e.target.closest('.master-edit-card').querySelector('.master-edit-avatar img');
            if (preview) preview.src = '../img/' + (arr[idx].avatar || 'placeholder-avatar.svg');
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
      const genderLabel = { masculine: 'мужская команда', feminine: 'женская команда' };

      ['masculine', 'feminine'].forEach(gender => {
        const list = this.workingByGender[gender];
        if (list.length > 50) errors.push(`${genderLabel[gender]}: мастеров больше 50 — уберите лишних.`);
        list.forEach((m, i) => {
          const n = i + 1;
          if (!m.name || !m.name.trim()) errors.push(`${genderLabel[gender]}, мастер №${n}: не указано имя.`);
          if (!m.key || !/^[a-zA-Z0-9]+$/.test(m.key)) errors.push(`${genderLabel[gender]}, мастер №${n} (${m.name || '?'}): ключ должен быть латиницей/цифрами без пробелов.`);
        });
      });

      if (this.workingByGender.masculine.length === 0 && this.workingByGender.feminine.length === 0) {
        errors.push('Список мастеров пуст в обеих командах — добавьте хотя бы одного мастера.');
      }

      // Уникальность key/id ПРОВЕРЯЕМ СРЕДИ ВСЕХ МАСТЕРОВ ОБЕИХ КОМАНД —
      // это общее требование js/data/masters.js (см. комментарий в файле).
      const keys = new Set();
      const ids = new Set();
      this.allWorking().forEach(m => {
        if (m.key) {
          if (keys.has(m.key)) errors.push(`Ключ "${m.key}" повторяется у нескольких мастеров — сделайте его уникальным.`);
          keys.add(m.key);
        }
        if (m.id !== undefined && m.id !== null) {
          if (ids.has(m.id)) errors.push(`id "${m.id}" повторяется у нескольких мастеров.`);
          ids.add(m.id);
        }
      });

      return errors;
    },

    buildGenderEntries: function (list) {
      return list.map(m => {
        const title = m.title && m.title.trim() ? m.title.trim() : 'Барбер';
        return `    { id: ${JSON.stringify(m.id)}, key: ${JSON.stringify(m.key)}, name: ${JSON.stringify(m.name.trim())}, title: ${JSON.stringify(title)}, avatar: ${JSON.stringify(m.avatar || 'placeholder-avatar.svg')} }`;
      }).join(',\n');
    },

    buildFileContent: function () {
      const masculineEntries = this.buildGenderEntries(this.workingByGender.masculine);
      const feminineEntries = this.buildGenderEntries(this.workingByGender.feminine);

      return `/* ==========================================================================
   js/data/masters.js — СПИСОК МАСТЕРОВ САЛОНА (мужская + женская версии)
   ==========================================================================
   Сформировано автоматически на странице "Мастера" панели барберов
   (barber_panel/masters.html) — ${new Date().toLocaleString('ru-RU')}.

   Этот файл — единственный источник правды о составе мастеров. Его читают
   и клиентский сайт (показывает только текущую версию — мужскую или
   женскую, в зависимости от переключателя на сайте), и панель барберов
   (показывает ОБЕИХ — см. ALL_MASTERS ниже). Замените этим файлом файл
   js/data/masters.js в репозитории на GitHub, чтобы изменения применились
   везде. Не забудьте также загрузить в папку img/ фотографии новых
   мастеров под именами файлов, указанными в поле avatar ниже.

   ЭТОТ ФАЙЛ НЕ КАСАЕТСЯ БАЗЫ ДАННЫХ И API.
   ========================================================================== */
const MASTERS_BY_GENDER = {
  masculine: [
${masculineEntries}
  ],
  feminine: [
${feminineEntries}
  ]
};

const ALL_MASTERS = [].concat(MASTERS_BY_GENDER.masculine, MASTERS_BY_GENDER.feminine);

const masters = MASTERS_BY_GENDER[(typeof SALON_THEME !== 'undefined' ? SALON_THEME : 'masculine')] || MASTERS_BY_GENDER.masculine;

/* ---------- Вспомогательные функции (используются панелью барберов) ---------- */

function getMasterByName(name) {
  return ALL_MASTERS.find(function (m) { return m.name === name; });
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
