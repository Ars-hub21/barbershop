/* ==========================================================================
   js/pages/gallery-widget.js
   ==========================================================================
   Второстепенный блок на главной странице: свёрнутая по умолчанию галерея
   работ "До / После". Раскрывается по клику на заголовок. Внутри каждая
   карточка сама по себе автоматически переключается между "до" и "после"
   каждые 3 секунды с эффектом разрезания фото на полоски (см. .gallery-*
   в css/styles.css). Тап/клик по карточке в состоянии "до" — форсирует
   немедленный переход к "после" и сбрасывает таймер.

   Не имеет отношения к API/бэкенду — чистая фронтенд-декорация.
   ========================================================================== */
const GalleryWidget = {
  STRIP_COUNT: 6,
  CYCLE_MS: 3000,

  init: function () {
    if (typeof galleryItems === 'undefined' || !Array.isArray(galleryItems) || !galleryItems.length) return;
    this.renderCards();
    this.initToggle();
    this.initCards();
  },

  renderCards: function () {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    const strips = new Array(this.STRIP_COUNT).fill('<div class="gallery-strip"></div>').join('');

    grid.innerHTML = galleryItems.map(function (item, idx) {
      return (
        '<div class="gallery-card" data-index="' + idx + '" tabindex="0" role="button" ' +
        'aria-label="Показать результат: ' + item.title + '">' +
          '<div class="gallery-photo">' +
            '<div class="gallery-after-layer" style="background-image:url(\'' + item.after + '\')"></div>' +
            '<div class="gallery-before-layer">' + strips + '</div>' +
            '<span class="gallery-swipe"><i class="fas fa-cut"></i></span>' +
            '<span class="gallery-badge gallery-badge-before">До</span>' +
            '<span class="gallery-badge gallery-badge-after">После</span>' +
          '</div>' +
          '<div class="gallery-caption">' + item.title + '</div>' +
        '</div>'
      );
    }).join('') + '<div class="gallery-note">Фото в галерее — демонстрационные плейсхолдеры</div>';

    // Проставляем before-картинку каждой полоске (шире карточки в 6 раз — см. CSS)
    grid.querySelectorAll('.gallery-card').forEach(function (card, idx) {
      const beforeUrl = galleryItems[idx].before;
      card.querySelectorAll('.gallery-strip').forEach(function (strip) {
        strip.style.backgroundImage = "url('" + beforeUrl + "')";
      });
    });
  },

  initToggle: function () {
    const self = this;
    const btn = document.getElementById('galleryToggle');
    const panel = document.getElementById('galleryPanel');
    if (!btn || !panel) return;

    btn.addEventListener('click', function () {
      const open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.classList.toggle('is-open', open);

      if (open && !self._started) {
        self._started = true;
        self.startCycling();
      }
    });
  },

  initCards: function () {
    const self = this;
    document.querySelectorAll('.gallery-card').forEach(function (card) {
      const trigger = function () {
        const photo = card.querySelector('.gallery-photo');
        if (photo && !photo.classList.contains('is-cut')) {
          self.cut(card);
          self.resetTimer(card);
        }
      };
      card.addEventListener('click', trigger);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
      });
    });
  },

  cut: function (card) {
    const photo = card.querySelector('.gallery-photo');
    if (photo) photo.classList.add('is-cut');
  },

  restore: function (card) {
    const photo = card.querySelector('.gallery-photo');
    if (photo) photo.classList.remove('is-cut');
  },

  tick: function (card) {
    const photo = card.querySelector('.gallery-photo');
    if (!photo) return;
    if (photo.classList.contains('is-cut')) this.restore(card);
    else this.cut(card);
  },

  resetTimer: function (card) {
    const self = this;
    if (card._galleryTimer) clearInterval(card._galleryTimer);
    card._galleryTimer = setInterval(function () { self.tick(card); }, this.CYCLE_MS);
  },

  startCycling: function () {
    const self = this;
    document.querySelectorAll('.gallery-card').forEach(function (card) {
      card._galleryTimer = setInterval(function () { self.tick(card); }, self.CYCLE_MS);
    });
  }
};

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('galleryWidget')) GalleryWidget.init();
});
