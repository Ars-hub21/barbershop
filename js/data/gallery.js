/* ==========================================================================
   js/data/gallery.js — Фотографии для галереи «До / После» на главной
   ==========================================================================
   Список карточек разделён на два независимых набора — GALLERY_BY_GENDER.masculine
   (работы барбершопа) и GALLERY_BY_GENDER.feminine (работы салона красоты).
   Клиентский сайт показывает набор ТЕКУЩЕЙ версии (определяется SALON_THEME
   из js/core/site-config.js — подключайте этот файл после site-config.js).

   Чтобы добавить/заменить фото:
   1) Положите файлы в img/gallery/ (jpg/png/webp — любой формат).
   2) Впишите пути к ним в поля before/after нужной карточки.
   3) Можно добавлять сколько угодно карточек — просто скопируйте один
      объект в нужном массиве и измените title/before/after.

   Соотношение сторон карточки — 4:3, фото автоматически обрезается по
   центру под этот формат (см. .gallery-photo в css/styles.css) — не нужно
   подгонять размер фото самостоятельно.
   ========================================================================== */
const GALLERY_BY_GENDER = {
  masculine: [
    { title: 'Классическая стрижка', before: 'img/gallery/classic-cut-before.png', after: 'img/gallery/classic-cut-after.png' },
    { title: 'Оформление бороды', before: 'img/gallery/beard-before.png', after: 'img/gallery/beard-after.png' },
    { title: 'Комплекс "Стрижка + борода"', before: 'img/gallery/combo-before.png', after: 'img/gallery/combo-after.png' }
  ],

  feminine: [
    { title: 'Стрижки и укладки', before: 'img/gallery/hair-before.png', after: 'img/gallery/hair-after.png' },
    { title: 'Маникюр и дизайн ногтей', before: 'img/gallery/manicure-before.png', after: 'img/gallery/manicure-after.png' },
    { title: 'Маски и уход за кожей', before: 'img/gallery/skincare-before.png', after: 'img/gallery/skincare-after.png' },
    { title: 'Дневной и вечерний макияж', before: 'img/gallery/makeup-before.png', after: 'img/gallery/makeup-after.png' }
  ]
};

const galleryItems = GALLERY_BY_GENDER[(typeof SALON_THEME !== 'undefined' ? SALON_THEME : 'masculine')] || GALLERY_BY_GENDER.masculine;
