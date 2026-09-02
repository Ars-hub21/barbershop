/* ==========================================================================
   barber_panel/gallery-tool/gallery-tool.js
   ==========================================================================
   Вкладка "Галерея" на странице Истории панели барберов (history.html).

   Что делает:
   - Добавляет вкладки "История" / "Галерея" над существующим содержимым
     страницы (сама история и её логика — barber-history.js — не трогаются
     вообще, просто визуально прячутся под вкладку).
   - На вкладке "Галерея": форма — пол (мужская/женская), название работы
     (например "Классическая стрижка"), тип фото (До/После) и выбор файла.
   - После выбора файла открывается окно кадрирования — как при загрузке
     аватарки в Instagram: фото можно двигать пальцем/мышью и увеличивать
     ползунком, рамка всегда ровно 4:3 (формат карточек галереи на сайте).
   - После подтверждения кадра фото конвертируется в формат WebP (меньше
     вес, быстрее грузится) и отправляется на сервер через уже существующий
     общий метод API.post(...) из barber_panel/js/api.js — этот файл НЕ
     редактировался, используется как есть.

   ВАЖНО — ЧТО ЭТОТ ФАЙЛ НЕ ДЕЛАЕТ:
   - Не трогает js/core/api.js, js/core/config.js, js/core/storage.js,
     js/core/global-cache.js, barber_panel/js/api.js и логику истории
     (barber-history.js) — ни одна из этих строк не менялась.
   - Не подключён к клиентскому сайту и не меняет, что видят клиенты —
     фото сохраняются на сервере (в Google Таблице, лист "Галерея") и
     появляются на самом сайте только после того, как администратор сам
     решит их туда добавить (так же вручную, как и все остальные фото и
     данные в этом проекте — см. barber_panel/masters.html для сравнения).
   - Действие 'addGalleryPhoto', которое эта форма отправляет на сервер,
     ПОКА НЕ СУЩЕСТВУЕТ в Google Apps Script — что именно нужно добавить
     на стороне Google, подробно описано в barber_panel/google/GALLERY-SHEET-SETUP.md.
     Пока это не сделано, форма будет показывать ошибку отправки — это
     ожидаемо, кадрирование и конвертация в WebP при этом уже полностью
     работают.
   ========================================================================== */

(function () {
  'use strict';

  // Категории-подсказки — те, что уже есть на сайте (см. js/data/gallery.js).
  // Это просто подсказки в поле — можно вписать своё название категории.
  var CATEGORY_SUGGESTIONS = {
    masculine: ['Классическая стрижка', 'Оформление бороды', 'Комплекс "Стрижка + борода"'],
    feminine: ['Стрижки и укладки', 'Маникюр и дизайн ногтей', 'Маски и уход за кожей', 'Дневной и вечерний макияж']
  };

  // Итоговый формат карточки галереи на сайте — 4:3 (см. .gallery-photo в css/styles.css)
  var TARGET_RATIO = 4 / 3;
  var OUTPUT_WIDTH = 900;
  var OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / TARGET_RATIO); // 675
  var MAX_BASE64_LENGTH = 45000; // запас внутри лимита ячейки Google Таблицы (~50 000 символов)

  var queue = []; // { id, gender, title, type, thumb, status } — только на время сессии, для наглядности

  /* ============================== МОНТИРОВАНИЕ ВКЛАДОК ============================== */

  function init() {
    var main = document.querySelector('main.container');
    if (!main) return; // не страница истории — ничего не делаем

    // Забираем всё текущее содержимое (контролы истории, статистику, список)
    // в отдельный контейнер, ничего в них не меняя.
    var existing = Array.prototype.slice.call(main.children);
    var historyPanel = document.createElement('div');
    historyPanel.id = 'gtHistoryPanel';
    existing.forEach(function (el) { historyPanel.appendChild(el); });

    var tabs = document.createElement('div');
    tabs.className = 'gt-tabs';
    tabs.innerHTML =
      '<button type="button" class="gt-tab-btn active" data-tab="history"><i class="fas fa-history"></i> История</button>' +
      '<button type="button" class="gt-tab-btn" data-tab="gallery"><i class="fas fa-images"></i> Галерея</button>';

    var galleryPanel = buildGalleryPanel();
    galleryPanel.hidden = true;

    main.appendChild(tabs);
    main.appendChild(historyPanel);
    main.appendChild(galleryPanel);

    tabs.querySelectorAll('.gt-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var isHistory = btn.dataset.tab === 'history';
        tabs.querySelectorAll('.gt-tab-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
        historyPanel.hidden = !isHistory;
        galleryPanel.hidden = isHistory;
      });
    });
  }

  /* ============================== ПАНЕЛЬ "ГАЛЕРЕЯ" ============================== */

  function buildGalleryPanel() {
    var panel = document.createElement('div');
    panel.id = 'gtGalleryPanel';

    panel.innerHTML =
      '<div class="gt-panel-intro">' +
        'Фото сохраняются в Google Таблицу (лист <code>Галерея</code>) в формате WebP. ' +
        'Чтобы они появились на самом сайте, администратор переносит их в галерею вручную — ' +
        'так же, как обновляются мастера и другие фото в этом проекте.' +
      '</div>' +
      '<form class="gt-upload-form" id="gtUploadForm">' +
        '<div class="form-group">' +
          '<label for="gtGender">Версия сайта</label>' +
          '<select id="gtGender">' +
            '<option value="masculine">Мужская (барбершоп)</option>' +
            '<option value="feminine">Женская (салон красоты)</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="gtTitle">Название работы</label>' +
          '<input type="text" id="gtTitle" list="gtCategoryList" placeholder="Например: Классическая стрижка" />' +
          '<datalist id="gtCategoryList"></datalist>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="gtType">Тип фото</label>' +
          '<select id="gtType">' +
            '<option value="before">До</option>' +
            '<option value="after">После</option>' +
          '</select>' +
        '</div>' +
        '<div class="gt-file-row">' +
          '<label class="gt-file-label" for="gtFileInput">' +
            '<i class="fas fa-camera"></i> Выбрать фото' +
          '</label>' +
          '<input type="file" id="gtFileInput" accept="image/*" hidden />' +
          '<span class="gt-file-name" id="gtFileName">Файл не выбран</span>' +
        '</div>' +
      '</form>' +
      '<div id="gtStatusLine" class="gt-status-line"></div>' +
      '<div class="gt-queue" id="gtQueue"><p class="gt-queue-empty">Пока ничего не добавлено в этой сессии.</p></div>' +
      buildModalMarkup();

    // Подсказки категорий переключаются под выбранный пол
    var genderSelect = panel.querySelector('#gtGender');
    var datalist = panel.querySelector('#gtCategoryList');
    function refreshSuggestions() {
      var list = CATEGORY_SUGGESTIONS[genderSelect.value] || [];
      datalist.innerHTML = list.map(function (name) { return '<option value="' + escapeHtml(name) + '"></option>'; }).join('');
    }
    genderSelect.addEventListener('change', refreshSuggestions);
    refreshSuggestions();

    // Выбор файла -> сразу открываем кадрирование
    var fileInput = panel.querySelector('#gtFileInput');
    var fileNameEl = panel.querySelector('#gtFileName');
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      fileNameEl.textContent = file.name;
      openCropper(panel, file);
    });

    return panel;
  }

  /* ============================== ОКНО КАДРИРОВАНИЯ ============================== */

  function buildModalMarkup() {
    return (
      '<div class="gt-modal-overlay" id="gtModalOverlay" hidden>' +
        '<div class="gt-modal-box">' +
          '<h3>Выберите видимую часть фото</h3>' +
          '<p class="gt-modal-hint">Перетащите фото пальцем/мышью и настройте масштаб ползунком — рамка соответствует тому, как фото ляжет в карточку галереи на сайте.</p>' +
          '<div class="gt-crop-viewport" id="gtCropViewport">' +
            '<img id="gtCropImage" alt="" />' +
            '<div class="gt-crop-grid"></div>' +
          '</div>' +
          '<div class="gt-zoom-row">' +
            '<i class="fas fa-search-minus"></i>' +
            '<input type="range" id="gtZoomRange" min="100" max="300" value="100" />' +
            '<i class="fas fa-search-plus"></i>' +
          '</div>' +
          '<div class="gt-modal-actions">' +
            '<button type="button" class="btn btn-secondary" id="gtCropCancel">Отмена</button>' +
            '<button type="button" class="btn btn-primary" id="gtCropConfirm"><i class="fas fa-check"></i> Готово</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // Состояние текущего кадрирования
  var crop = {
    natW: 0, natH: 0, baseScale: 1, scale: 1, x: 0, y: 0,
    viewportW: 0, viewportH: 0, dragging: false,
    startPX: 0, startPY: 0, startX: 0, startY: 0,
    objectUrl: null
  };

  function openCropper(panel, file) {
    var overlay = panel.querySelector('#gtModalOverlay');
    var img = panel.querySelector('#gtCropImage');
    var viewport = panel.querySelector('#gtCropViewport');
    var zoomRange = panel.querySelector('#gtZoomRange');

    if (crop.objectUrl) URL.revokeObjectURL(crop.objectUrl);
    crop.objectUrl = URL.createObjectURL(file);

    img.onload = function () {
      // Важно: сначала показываем модалку (overlay.hidden = false), и только
      // ПОТОМ измеряем viewport.clientWidth/clientHeight — пока модалка скрыта
      // (display:none), её размеры равны 0, и расчёт масштаба/смещения
      // получится нулевым (итог — картинка вообще не рисуется на canvas).
      overlay.hidden = false;
      crop.natW = img.naturalWidth;
      crop.natH = img.naturalHeight;
      crop.viewportW = viewport.clientWidth;
      crop.viewportH = viewport.clientHeight;
      crop.baseScale = Math.max(crop.viewportW / crop.natW, crop.viewportH / crop.natH);
      crop.scale = crop.baseScale;
      crop.x = (crop.viewportW - crop.natW * crop.scale) / 2;
      crop.y = (crop.viewportH - crop.natH * crop.scale) / 2;
      zoomRange.value = 100;
      applyCropTransform(img);
    };
    img.src = crop.objectUrl;

    // Перетаскивание (мышь + тач через Pointer Events — единый обработчик для обоих)
    function onPointerDown(e) {
      crop.dragging = true;
      crop.startPX = e.clientX;
      crop.startPY = e.clientY;
      crop.startX = crop.x;
      crop.startY = crop.y;
      viewport.classList.add('gt-dragging');
      viewport.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e) {
      if (!crop.dragging) return;
      crop.x = crop.startX + (e.clientX - crop.startPX);
      crop.y = crop.startY + (e.clientY - crop.startPY);
      clampCrop();
      applyCropTransform(img);
    }
    function onPointerUp() {
      crop.dragging = false;
      viewport.classList.remove('gt-dragging');
    }

    viewport.onpointerdown = onPointerDown;
    viewport.onpointermove = onPointerMove;
    viewport.onpointerup = onPointerUp;
    viewport.onpointercancel = onPointerUp;

    // Зум ползунком — центр видимой области остаётся на месте при увеличении
    zoomRange.oninput = function () {
      var factor = Number(zoomRange.value) / 100;
      var newScale = crop.baseScale * factor;
      var cx = crop.viewportW / 2;
      var cy = crop.viewportH / 2;
      var imgX = (cx - crop.x) / crop.scale;
      var imgY = (cy - crop.y) / crop.scale;
      crop.scale = newScale;
      crop.x = cx - imgX * crop.scale;
      crop.y = cy - imgY * crop.scale;
      clampCrop();
      applyCropTransform(img);
    };

    // Прокрутка колёсиком мыши — тоже зум (десктоп)
    viewport.onwheel = function (e) {
      e.preventDefault();
      var delta = e.deltaY < 0 ? 10 : -10;
      var newValue = Math.min(300, Math.max(100, Number(zoomRange.value) + delta));
      zoomRange.value = newValue;
      zoomRange.oninput();
    };

    var cancelBtn = panel.querySelector('#gtCropCancel');
    var confirmBtn = panel.querySelector('#gtCropConfirm');

    cancelBtn.onclick = function () {
      overlay.hidden = true;
      panel.querySelector('#gtFileInput').value = '';
      panel.querySelector('#gtFileName').textContent = 'Файл не выбран';
    };

    confirmBtn.onclick = function () {
      var dataUrl = renderCroppedWebp(img);
      overlay.hidden = true;
      handleCroppedPhoto(panel, dataUrl);
    };
  }

  function clampCrop() {
    var scaledW = crop.natW * crop.scale;
    var scaledH = crop.natH * crop.scale;
    var minX = crop.viewportW - scaledW;
    var minY = crop.viewportH - scaledH;
    crop.x = Math.min(0, Math.max(minX, crop.x));
    crop.y = Math.min(0, Math.max(minY, crop.y));
  }

  function applyCropTransform(img) {
    img.style.width = crop.natW + 'px';
    img.style.height = crop.natH + 'px';
    img.style.transform = 'translate(' + crop.x + 'px,' + crop.y + 'px) scale(' + crop.scale + ')';
  }

  // Вырезает то, что сейчас видно в рамке 4:3, и конвертирует в WebP.
  // Автоматически подбирает качество так, чтобы итоговый base64 уместился
  // в ячейку Google Таблицы (см. MAX_BASE64_LENGTH выше и инструкцию в google/).
  function renderCroppedWebp(img) {
    var sx = -crop.x / crop.scale;
    var sy = -crop.y / crop.scale;
    var sw = crop.viewportW / crop.scale;
    var sh = crop.viewportH / crop.scale;

    var canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    var quality = 0.85;
    var dataUrl = canvas.toDataURL('image/webp', quality);
    while (dataUrl.length > MAX_BASE64_LENGTH && quality > 0.35) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/webp', quality);
    }
    return dataUrl;
  }

  /* ============================== ОТПРАВКА НА СЕРВЕР ============================== */

  function handleCroppedPhoto(panel, dataUrl) {
    var gender = panel.querySelector('#gtGender').value;
    var title = panel.querySelector('#gtTitle').value.trim() || 'Без названия';
    var type = panel.querySelector('#gtType').value;
    var statusLine = panel.querySelector('#gtStatusLine');

    var entry = {
      id: 'g' + Date.now() + Math.random().toString(16).slice(2, 6),
      gender: gender,
      title: title,
      type: type,
      thumb: dataUrl,
      status: 'pending'
    };
    queue.unshift(entry);
    renderQueue(panel);

    statusLine.className = 'gt-status-line';
    statusLine.textContent = 'Отправка на сервер…';

    // Используем УЖЕ СУЩЕСТВУЮЩИЙ общий метод API.post (barber_panel/js/api.js) —
    // этот файл не редактировался. Действие 'addGalleryPhoto' нужно добавить
    // на стороне Google Apps Script — см. barber_panel/google/GALLERY-SHEET-SETUP.md.
    var base64 = dataUrl.split(',')[1] || '';

    if (typeof API === 'undefined' || typeof API.post !== 'function') {
      entry.status = 'error';
      renderQueue(panel);
      statusLine.className = 'gt-status-line gt-error';
      statusLine.textContent = 'Не найден модуль API (barber_panel/js/api.js) — фото сохранено только локально в этой вкладке.';
      return;
    }

    API.post('addGalleryPhoto', {
      gender: gender,
      title: title,
      type: type,
      imageMime: 'image/webp',
      imageBase64: base64,
      capturedAt: new Date().toISOString()
    }).then(function () {
      entry.status = 'sent';
      renderQueue(panel);
      statusLine.className = 'gt-status-line gt-ok';
      statusLine.textContent = 'Фото отправлено на сервер (лист "Галерея").';
    }).catch(function (err) {
      entry.status = 'error';
      renderQueue(panel);
      statusLine.className = 'gt-status-line gt-error';
      statusLine.textContent = 'Не удалось отправить — похоже, на сервере ещё не настроен приём фото галереи. ' +
        'Инструкция для программиста: barber_panel/google/GALLERY-SHEET-SETUP.md. (' + (err && err.message ? err.message : 'ошибка сети') + ')';
    });

    // Форма готова к следующему фото
    panel.querySelector('#gtFileInput').value = '';
    panel.querySelector('#gtFileName').textContent = 'Файл не выбран';
  }

  function renderQueue(panel) {
    var box = panel.querySelector('#gtQueue');
    if (queue.length === 0) {
      box.innerHTML = '<p class="gt-queue-empty">Пока ничего не добавлено в этой сессии.</p>';
      return;
    }
    var genderLabel = { masculine: 'Мужская', feminine: 'Женская' };
    var typeLabel = { before: 'До', after: 'После' };
    var statusLabel = { pending: 'Отправка…', sent: 'Отправлено', error: 'Ошибка' };

    box.innerHTML = queue.map(function (e) {
      return (
        '<div class="gt-queue-item">' +
          '<img class="gt-queue-thumb" src="' + e.thumb + '" alt="" />' +
          '<div class="gt-queue-info">' +
            '<div class="gt-queue-title">' + escapeHtml(e.title) + '</div>' +
            '<div class="gt-queue-meta">' + genderLabel[e.gender] + ' · ' + typeLabel[e.type] + '</div>' +
          '</div>' +
          '<span class="gt-queue-status ' + e.status + '">' + statusLabel[e.status] + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
