/* ==========================================================================
   barber_panel/gallery-tool/gallery-tool.js
   ==========================================================================
   Вкладка "Галерея" на странице Истории панели барберов (history.html).

   Что делает:
   - Добавляет вкладки "История" / "Галерея" над существующим содержимым
     страницы (сама история и её логика — barber-history.js — не трогаются
     вообще, просто визуально прячутся под вкладку).
   - На вкладке "Галерея": форма — пол (мужская/женская), название работы
     (например "Классическая стрижка") и ДВЕ КОЛОНКИ загрузки — "Фото До"
     и "Фото После" — рядом друг с другом, каждая со своим окном
     кадрирования. Так обе фотографии одной работы загружаются сразу одним
     действием, а не по очереди через выпадающий список "Тип фото" (как
     было раньше) — и в списке добавленного за сессию они тоже показаны
     парой, колонками, а не двумя отдельными строками.
   - После выбора файла в любой из колонок открывается окно кадрирования —
     как при загрузке аватарки в Instagram: фото можно двигать пальцем/
     мышью и увеличивать ползунком, рамка всегда ровно 4:3 (формат карточек
     галереи на сайте).
   - После подтверждения кадра фото конвертируется в формат WebP (меньше
     вес, быстрее грузится). По кнопке "Отправить" обе фотографии (до и
     после — можно отправить и только одну, если вторая ещё не готова)
     уходят на сервер ОДНИМ запросом через уже существующий общий метод
     API.post(...) из barber_panel/js/api.js — этот файл НЕ редактировался.

   ВАЖНО — ЧТО ЭТОТ ФАЙЛ НЕ ДЕЛАЕТ:
   - Не трогает js/core/api.js, js/core/config.js, js/core/storage.js,
     js/core/global-cache.js, barber_panel/js/api.js и логику истории
     (barber-history.js) — ни одна из этих строк не менялась.
   - Не подключён к клиентскому сайту и не меняет, что видят клиенты —
     фото сохраняются на сервере (в Google Таблице, лист "Галерея") и
     появляются на самом сайте только после того, как администратор сам
     решит их туда добавить (так же вручную, как и все остальные фото и
     данные в этом проекте — см. barber_panel/masters.html для сравнения).

   ИСПРАВЛЕНО (после проверки реального Google Apps Script, файл Utils.gs):
   действие 'addGalleryPhoto' на сервере УЖЕ существует (Utils.saveGalleryPair),
   но ждёт ОДИН запрос с полями imageBeforeBase64 + imageAfterBase64 на пару
   фото — а эта форма раньше отправляла ДВА отдельных запроса (по одному на
   фото, с полями imageBase64 + type). Из-за несовпадения имён полей сервер
   получал пустые imageBeforeBase64/imageAfterBase64 и дважды дописывал в
   таблицу строку с датой/полом/названием, но БЕЗ фото — ровно то, на что
   жаловались ("основная информация сохраняется, а фото нет"). Теперь
   отправляется один запрос с теми полями, которые сервер реально читает.
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

  var TYPE_LABEL = { before: 'До', after: 'После' };
  var GENDER_LABEL = { masculine: 'Мужская', feminine: 'Женская' };

  var queue = []; // { id, gender, title, before:{thumb,status}, after:{thumb,status} } — только на время сессии

  // Фото, уже подобранные для ТЕКУЩЕЙ, ещё не отправленной пары "до/после".
  var pending = { before: null, after: null };

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
        'Загрузите фото "До" и "После" одной работы рядом — они отправятся вместе — ' +
        'и перенесите их на сам сайт вручную, так же, как обновляются мастера и другие данные проекта.' +
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
      '</form>' +
      '<div class="gt-before-after-row">' +
        buildPhotoSlotMarkup('before', 'Фото «До»') +
        buildPhotoSlotMarkup('after', 'Фото «После»') +
      '</div>' +
      '<button type="button" class="btn btn-primary gt-submit-pair-btn" id="gtSubmitPairBtn" disabled>' +
        '<i class="fas fa-paper-plane"></i> Отправить' +
      '</button>' +
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

    // Выбор файла в любой из двух колонок -> сразу открываем кадрирование,
    // помечая, какая колонка (до/после) сейчас кадрируется.
    ['before', 'after'].forEach(function (type) {
      var fileInput = panel.querySelector('#gtFileInput_' + type);
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        openCropper(panel, file, type);
      });
    });

    panel.querySelector('#gtSubmitPairBtn').addEventListener('click', function () {
      submitPending(panel);
    });

    return panel;
  }

  function buildPhotoSlotMarkup(type, label) {
    return (
      '<div class="gt-photo-slot" data-type="' + type + '">' +
        '<div class="gt-photo-slot-label">' + label + '</div>' +
        '<div class="gt-slot-preview" id="gtPreview_' + type + '">' +
          '<i class="fas fa-camera"></i>' +
        '</div>' +
        '<label class="gt-file-label" for="gtFileInput_' + type + '">' +
          '<i class="fas fa-upload"></i> Выбрать фото' +
        '</label>' +
        '<input type="file" id="gtFileInput_' + type + '" accept="image/*" hidden />' +
        '<button type="button" class="gt-slot-clear" id="gtClear_' + type + '" hidden title="Убрать фото">' +
          '<i class="fas fa-times"></i>' +
        '</button>' +
      '</div>'
    );
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
    objectUrl: null,
    activeType: null // 'before' | 'after' — какая колонка сейчас кадрируется
  };

  function openCropper(panel, file, type) {
    var overlay = panel.querySelector('#gtModalOverlay');
    var img = panel.querySelector('#gtCropImage');
    var viewport = panel.querySelector('#gtCropViewport');
    var zoomRange = panel.querySelector('#gtZoomRange');

    crop.activeType = type;

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
      var slotType = crop.activeType;
      panel.querySelector('#gtFileInput_' + slotType).value = '';
    };

    confirmBtn.onclick = function () {
      var dataUrl = renderCroppedWebp(img);
      overlay.hidden = true;
      handleCroppedPhoto(panel, dataUrl, crop.activeType);
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

  /* ============================== ПОДГОТОВКА ПАРЫ "ДО/ПОСЛЕ" ============================== */

  // Кадр подтверждён — сохраняем его как "готово к отправке" для своей
  // колонки (до/после), обновляем превью и разблокируем кнопку "Отправить",
  // как только готова хотя бы одна из двух фотографий.
  function handleCroppedPhoto(panel, dataUrl, type) {
    pending[type] = dataUrl;

    var preview = panel.querySelector('#gtPreview_' + type);
    preview.innerHTML = '<img src="' + dataUrl + '" alt="" />';

    var clearBtn = panel.querySelector('#gtClear_' + type);
    clearBtn.hidden = false;
    clearBtn.onclick = function () {
      pending[type] = null;
      preview.innerHTML = '<i class="fas fa-camera"></i>';
      clearBtn.hidden = true;
      panel.querySelector('#gtFileInput_' + type).value = '';
      updateSubmitButtonState(panel);
    };

    updateSubmitButtonState(panel);
  }

  function updateSubmitButtonState(panel) {
    var submitBtn = panel.querySelector('#gtSubmitPairBtn');
    submitBtn.disabled = !pending.before && !pending.after;
  }

  /* ============================== ОТПРАВКА НА СЕРВЕР ============================== */

  function submitPending(panel) {
    var gender = panel.querySelector('#gtGender').value;
    var title = panel.querySelector('#gtTitle').value.trim() || 'Без названия';
    var statusLine = panel.querySelector('#gtStatusLine');

    if (!pending.before && !pending.after) return;

    var entry = {
      id: 'g' + Date.now() + Math.random().toString(16).slice(2, 6),
      gender: gender,
      title: title,
      before: pending.before ? { thumb: pending.before, status: 'pending' } : null,
      after: pending.after ? { thumb: pending.after, status: 'pending' } : null
    };
    queue.unshift(entry);
    renderQueue(panel);

    statusLine.className = 'gt-status-line';
    statusLine.textContent = 'Отправка на сервер…';

    if (typeof API === 'undefined' || typeof API.post !== 'function') {
      ['before', 'after'].forEach(function (type) {
        if (entry[type]) entry[type].status = 'error';
      });
      renderQueue(panel);
      statusLine.className = 'gt-status-line gt-error';
      statusLine.textContent = 'Не найден модуль API (barber_panel/js/api.js) — фото сохранены только локально в этой вкладке.';
      resetSlots(panel);
      return;
    }

    // ВАЖНО: отправляем "до" и "после" ОДНИМ запросом, одной строкой в
    // Google Таблицу — именно так их принимает существующий обработчик
    // Utils.saveGalleryPair(data) на бэкенде: он читает data.imageBeforeBase64
    // и data.imageAfterBase64 из ОДНОГО запроса. Раньше здесь уходило ДВА
    // отдельных запроса (по одному на фото, с полем imageBase64 + type) —
    // бэкенд каждый раз читал несуществующие imageBeforeBase64/imageAfterBase64
    // как пустые строки, поэтому в таблицу попадала основная информация
    // (пол, название, дата), а сами фото — нет. Теперь поля совпадают 1-в-1.
    var payload = {
      gender: gender,
      title: title,
      imageMime: 'image/webp',
      imageBeforeBase64: entry.before ? (entry.before.thumb.split(',')[1] || '') : '',
      imageAfterBase64: entry.after ? (entry.after.thumb.split(',')[1] || '') : '',
      capturedAt: new Date().toISOString()
    };

    API.post('addGalleryPhoto', payload).then(function (result) {
      var ok = !result || result.success !== false;
      ['before', 'after'].forEach(function (type) {
        if (entry[type]) entry[type].status = ok ? 'sent' : 'error';
      });
      renderQueue(panel);

      if (ok) {
        statusLine.className = 'gt-status-line gt-ok';
        statusLine.textContent = 'Фото отправлены на сервер (лист "Галерея").';
      } else {
        statusLine.className = 'gt-status-line gt-error';
        statusLine.textContent = 'Сервер вернул ошибку при сохранении: ' + (result && result.error ? result.error : 'см. лист "Галерея"') + '.';
      }
    }).catch(function () {
      ['before', 'after'].forEach(function (type) {
        if (entry[type]) entry[type].status = 'error';
      });
      renderQueue(panel);
      statusLine.className = 'gt-status-line gt-error';
      statusLine.textContent = 'Не удалось отправить — проверьте подключение и попробуйте ещё раз.';
    });

    // Форма готова к следующей паре фото
    resetSlots(panel);
  }

  function resetSlots(panel) {
    pending = { before: null, after: null };
    ['before', 'after'].forEach(function (type) {
      panel.querySelector('#gtPreview_' + type).innerHTML = '<i class="fas fa-camera"></i>';
      panel.querySelector('#gtClear_' + type).hidden = true;
      panel.querySelector('#gtFileInput_' + type).value = '';
    });
    updateSubmitButtonState(panel);
  }

  function renderQueue(panel) {
    var box = panel.querySelector('#gtQueue');
    if (queue.length === 0) {
      box.innerHTML = '<p class="gt-queue-empty">Пока ничего не добавлено в этой сессии.</p>';
      return;
    }
    var statusLabel = { pending: 'Отправка…', sent: 'Отправлено', error: 'Ошибка' };

    box.innerHTML = queue.map(function (e) {
      return (
        '<div class="gt-queue-item">' +
          '<div class="gt-queue-photos">' +
            buildQueueThumb(e.before, 'До') +
            buildQueueThumb(e.after, 'После') +
          '</div>' +
          '<div class="gt-queue-info">' +
            '<div class="gt-queue-title">' + escapeHtml(e.title) + '</div>' +
            '<div class="gt-queue-meta">' + GENDER_LABEL[e.gender] + '</div>' +
          '</div>' +
        '</div>'
      );
      function buildQueueThumb(photo, label) {
        if (!photo) return '<div class="gt-queue-thumb-col gt-queue-thumb-empty"><span>' + label + ' — нет</span></div>';
        return (
          '<div class="gt-queue-thumb-col">' +
            '<img class="gt-queue-thumb" src="' + photo.thumb + '" alt="" />' +
            '<span class="gt-queue-status ' + photo.status + '">' + label + ' · ' + statusLabel[photo.status] + '</span>' +
          '</div>'
        );
      }
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
