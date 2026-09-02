/* ==========================================================================
   js/data/services.js — ПРАЙС-ЛИСТ (мужская + женская версии)
   ==========================================================================
   Список услуг разделён на два независимых набора: SERVICES_BY_GENDER.masculine
   (барбершоп) и SERVICES_BY_GENDER.feminine (салон красоты). Клиентский сайт
   показывает набор ТЕКУЩЕЙ версии (определяется SALON_THEME из
   js/core/site-config.js — подключайте этот файл после site-config.js).

   Категории (category) одинаковые для обеих версий: 'main' — основные,
   'extra' — дополнительные, 'complex' — комплексы. Вкладки на странице
   Services.html их не переименовывают под версию специально, т.к. слова
   "Основные / Дополнительные / Комплексы" одинаково уместны для обеих.
   ========================================================================== */
const SERVICES_BY_GENDER = {
  masculine: [
    { id: 1, name: 'Стрижка', description: 'Классическая или современная стрижка', duration: 60, price: '1400–2000', category: 'main' },
    { id: 2, name: 'Стрижка машинкой', description: 'Быстрая стрижка машинкой', duration: 40, price: '800–1200', category: 'main' },
    { id: 3, name: 'Моделирование бороды/бритье', description: 'Уход за бородой и бритьё', duration: 30, price: '800–1200', category: 'main' },
    { id: 4, name: 'Детская стрижка от 5 до 12 лет', description: 'Стрижка для детей', duration: 40, price: '800–1200', category: 'main' },
    { id: 5, name: 'Тонирование седины', description: 'Тонировка седых волос', duration: 40, price: '1000–1500', category: 'extra' },
    { id: 6, name: 'Воск 1 точка', description: 'Удаление волос воском', duration: 15, price: '300', category: 'extra' },
    { id: 7, name: 'Воск 2 точки', description: 'Удаление волос воском', duration: 30, price: '500', category: 'extra' },
    { id: 8, name: 'Комплекс "Стрижка+борода"', description: 'Стрижка и моделирование бороды', duration: 90, price: '2000–2500', category: 'complex' },
    { id: 9, name: 'Премиум комплекс', description: 'Стрижка, борода, маска', duration: 120, price: '3000–3500', category: 'complex' }
  ],

  // ⚠️ ПЛЕЙСХОЛДЕР — названия услуг и цены ниже придуманы для примера,
  // отредактируйте под реальный прайс-лист вашего салона красоты.
  feminine: [
    { id: 101, name: 'Маникюр классический', description: 'Обработка кутикулы, придание формы ногтям, покрытие базой', duration: 60, price: '1200–1800', category: 'main' },
    { id: 102, name: 'Маникюр с покрытием гель-лак', description: 'Классический маникюр + стойкое цветное покрытие', duration: 90, price: '1800–2500', category: 'main' },
    { id: 103, name: 'Педикюр классический', description: 'Уход за стопами и ногтями', duration: 75, price: '2000–2800', category: 'main' },
    { id: 104, name: 'Педикюр с покрытием', description: 'Педикюр + стойкое гель-лак покрытие', duration: 100, price: '2800–3500', category: 'main' },
    { id: 105, name: 'Наращивание ногтей', description: 'Моделирование формы и длины гелем', duration: 120, price: '3000–4000', category: 'extra' },
    { id: 106, name: 'Дизайн ногтей (1 ноготь)', description: 'Художественная роспись, стразы или фольга', duration: 10, price: '150', category: 'extra' },
    { id: 107, name: 'Снятие покрытия', description: 'Аккуратное снятие старого покрытия или наращивания', duration: 30, price: '500', category: 'extra' },
    { id: 108, name: 'Комплекс "Маникюр + Педикюр"', description: 'Уход за руками и ногами в один визит', duration: 150, price: '3500–4500', category: 'complex' },
    { id: 109, name: 'Премиум комплекс', description: 'Маникюр, педикюр, дизайн и уходовая маска для рук', duration: 180, price: '5000–6000', category: 'complex' }
  ]
};

const services = SERVICES_BY_GENDER[(typeof SALON_THEME !== 'undefined' ? SALON_THEME : 'masculine')] || SERVICES_BY_GENDER.masculine;
