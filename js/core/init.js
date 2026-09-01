// js/core/init.js - Центральный диспетчер инициализации страниц
document.addEventListener('DOMContentLoaded', function() {
  const page = document.body.dataset.page || 'home';
  console.log(`[BarberApp] Запуск приложения. Текущая страница: ${page}`);

  // Инициализируем структуру кэша перед запуском страниц
  if (typeof GlobalCache !== 'undefined') {
    GlobalCache.initCacheStructure();
    
    // Пытаемся восстановить данные из sessionStorage с использованием исправленного AppStorage
    if (GlobalCache.loadCache()) {
      GlobalCache.notifyListeners();
    } else if (!GlobalCache.isLoading) {
      setTimeout(() => {
        GlobalCache.preloadAllSlots();
      }, 300);
    }
  }

  // Безопасный запуск логики конкретного шага онлайн-записи
  switch(page) {
    case 'home':
      if (typeof Home !== 'undefined' && typeof Home.init === 'function') Home.init();
      break;
    case 'services':
      if (typeof ServicesPage !== 'undefined' && typeof ServicesPage.init === 'function') ServicesPage.init();
      break;
    case 'slots':
      if (typeof SlotsPage !== 'undefined' && typeof SlotsPage.init === 'function') SlotsPage.init();
      break;
    case 'contacts':
      if (typeof ContactsPage !== 'undefined' && typeof ContactsPage.init === 'function') ContactsPage.init();
      break;
    case 'thankyou':
      if (typeof ThankYouPage !== 'undefined' && typeof ThankYouPage.init === 'function') ThankYouPage.init();
      break;
    case 'reviews':
      if (typeof ReviewsPage !== 'undefined' && typeof ReviewsPage.init === 'function') ReviewsPage.init();
      break;
  }

  // Безопасный запуск фонового поллинга (Real-time синхронизация раз в 15 сек)
  if (!window._pollingStarted) {
    window._pollingStarted = true;
    setInterval(() => {
      if (typeof GlobalCache !== 'undefined' && typeof GlobalCache.checkChanges === 'function') {
        GlobalCache.checkChanges();
      }
    }, 15000);
  }
});
