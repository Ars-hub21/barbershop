/* ==========================================================================
   js/data/gallery.js — Фотографии для галереи «До / После» на главной
   ==========================================================================
   Список карточек разделён на два независимых набора — GALLERY_BY_GENDER.masculine
   (работы барбершопа) и GALLERY_BY_GENDER.feminine (работы салона красоты:
   маникюр/педикюр). Клиентский сайт показывает набор ТЕКУЩЕЙ версии
   (определяется SALON_THEME из js/core/site-config.js — подключайте этот
   файл после site-config.js).

   Сейчас везде стоят СХЕМАТИЧНЫЕ ПЛЕЙСХОЛДЕРЫ (img/gallery/*.svg) — это не
   настоящие фото работ, а заглушки, чтобы сразу было видно, как работает
   эффект "разрезания" фото ножницами.

   Чтобы поставить реальные фотографии:
   1) Положите свои фото в img/gallery/ (например work1-before.jpg,
      work1-after.jpg — любые имена, форматы jpg/png/webp).
   2) Впишите пути к ним в поля before/after вместо файлов-плейсхолдеров.
   3) Можно добавлять сколько угодно карточек — просто скопируйте один
      объект в нужном массиве и измените title/before/after.

   Соотношение сторон карточки — 4:3 (см. .gallery-photo в css/styles.css).
   Лучше всего смотрятся фото, обрезанные примерно под это соотношение.
   ========================================================================== */
const GALLERY_BY_GENDER = {
  masculine: [
    { title: 'Классическая стрижка', before: 'img/gallery/before.svg', after: 'img/gallery/after.svg' },
    { title: 'Оформление бороды', before: 'img/gallery/before.svg', after: 'img/gallery/after.svg' },
    { title: 'Комплекс "Стрижка + борода"', before: 'img/gallery/before.svg', after: 'img/gallery/after.svg' }
  ],

  // ⚠️ ПЛЕЙСХОЛДЕР — замените на реальные фото работ вашего салона
  feminine: [
    { title: 'Классический маникюр', before: 'img/gallery/nails-before.svg', after: 'img/gallery/nails-after.svg' },
    { title: 'Дизайн ногтей', before: 'img/gallery/nails-before.svg', after: 'img/gallery/nails-after.svg' },
    { title: 'Комплекс "Маникюр + Педикюр"', before: 'img/gallery/nails-before.svg', after: 'img/gallery/nails-after.svg' }
  ]
};

const galleryItems = GALLERY_BY_GENDER[(typeof SALON_THEME !== 'undefined' ? SALON_THEME : 'masculine')] || GALLERY_BY_GENDER.masculine;
