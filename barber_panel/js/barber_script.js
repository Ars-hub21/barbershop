// frontend/barber_panel/js/barber_script.js
// ОТВЕЧАЕТ ЗА:
// - Вход в панель
// - Инициализацию всех компонентов
// - Двойной клик/тап для заказов И занятости (общий обработчик)

// ==========================================================================
// ПАРОЛЬ ВХОДА В ПАНЕЛЬ БАРБЕРОВ
// ==========================================================================
// Сайт статический (без сервера), поэтому пароль хранится не текстом, а в
// виде SHA-256 хэша — так посетитель, открывший исходный код страницы, не
// увидит сам пароль напрямую. Это не полноценная серверная защита (файл
// всё равно лежит в открытом репозитории на GitHub), но она надёжно
// закрывает панель от случайных клиентов и подбора "на глаз".
//
// КАК СМЕНИТЬ ПАРОЛЬ:
// 1) Откройте консоль браузера (клавиша F12 → вкладка Console) на любой странице.
// 2) Вставьте и выполните (замените НОВЫЙ_ПАРОЛЬ на свой):
//      crypto.subtle.digest('SHA-256', new TextEncoder().encode('НОВЫЙ_ПАРОЛЬ'))
//        .then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('')))
// 3) Скопируйте результат (строка из 64 символов) и вставьте его вместо
//    значения PANEL_PASSWORD_HASH ниже.
//
// Текущий пароль (сообщите только тем, кому доверяете вход в панель):
//   UrusMartan_Panel-2026!
const PANEL_PASSWORD_HASH = 'a6faff5e400fa33056395137343a28918deb4a09bd3894182ae41b3b9c021b68';

async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

function getClickDelay() {
    return isMobileDevice() ? 1000 : 800;
}

document.addEventListener('DOMContentLoaded', function() {
    // ===== ВХОД =====
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const password = document.getElementById('passwordInput').value;

            if (submitBtn) submitBtn.disabled = true;
            let hash;
            try {
                hash = await sha256Hex(password);
            } catch (err) {
                // crypto.subtle недоступен (например, страница открыта не по HTTPS/localhost)
                console.error('Не удалось проверить пароль:', err);
                document.getElementById('loginError').textContent = 'Ошибка проверки пароля. Откройте сайт по https-ссылке.';
                if (submitBtn) submitBtn.disabled = false;
                return;
            }

            if (hash === PANEL_PASSWORD_HASH) {
                localStorage.setItem('deviceAuthorized', 'true');
                window.location.href = 'dashboard.html';
            } else {
                document.getElementById('loginError').textContent = 'Неверный пароль. Попробуйте снова.';
                document.getElementById('passwordInput').value = '';
                if (submitBtn) submitBtn.disabled = false;
            }
        });
        return;
    }

    // ===== АВТОРИЗАЦИЯ =====
    if (!localStorage.getItem('deviceAuthorized')) {
        window.location.href = 'index.html';
        return;
    }

    // ===== ДАШБОРД =====
    if (document.querySelector('.dashboard-grid')) {
        Dashboard.init();
        Sync.init();
        BusyPopup.init();

        if (typeof initColumnToggle === 'function') {
            initColumnToggle();
        }

        initTripleClickForHistory();
        initCardHandlers();  // ← ОБЩИЙ ОБРАБОТЧИК ДЛЯ ЗАКАЗОВ И ЗАНЯТОСТИ
        initAllPriceEditors();
        initAllCardRemovers();
    }
});

// ===== ТРОЙНОЙ КЛИК ДЛЯ ИСТОРИИ =====
function initTripleClickForHistory() {
    document.querySelectorAll('.master-column').forEach(column => {
        const masterName = column.dataset.master;
        if (!masterName) return;

        const title = column.querySelector('.column-title h2');
        if (title) setupTripleClick(title, masterName);

        const avatar = column.querySelector('.master-avatar');
        if (avatar) setupTripleClick(avatar, masterName);
    });
}

// ===== УНИВЕРСАЛЬНАЯ НАСТРОЙКА ТРОЙНОГО КЛИКА =====
function setupTripleClick(element, masterName) {
    if (element.dataset.historyInitialized === 'true') return;
    element.dataset.historyInitialized = 'true';

    const delay = getClickDelay();

    let clickCount = 0;
    let clickTimer = null;

    element.addEventListener('click', function(e) {
        if (isMobileDevice()) return;

        clickCount++;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, delay);

        if (clickCount === 3) {
            clickCount = 0;
            clearTimeout(clickTimer);
            goToHistory(masterName);
        }
    });

    if (isMobileDevice()) {
        let tapCount = 0;
        let tapTimer = null;

        element.addEventListener('touchend', function(e) {
            tapCount++;
            clearTimeout(tapTimer);
            tapTimer = setTimeout(() => { tapCount = 0; }, delay);

            if (tapCount === 3) {
                tapCount = 0;
                clearTimeout(tapTimer);
                goToHistory(masterName);
            }
        });
    }
}

// ===== ПЕРЕХОД В ИСТОРИЮ =====
function goToHistory(masterName) {
    window.location.href = `history.html?master=${encodeURIComponent(masterName)}`;
}

// ============================================================
// ===== ОБЩИЙ ОБРАБОТЧИК КАРТОЧЕК (ЗАКАЗЫ + ЗАНЯТОСТЬ) =====
// ============================================================

function initCardHandlers() {
    if (window._cardHandlersInitialized) return;
    window._cardHandlersInitialized = true;

    // =========================================================
    // 1. ДВОЙНОЙ КЛИК (ДЕСКТОП)
    // =========================================================
    document.addEventListener('dblclick', function(e) {
        // ---- СНАЧАЛА ПРОВЕРЯЕМ: это заказ? ----
        const orderCard = e.target.closest('.order-card');
        if (orderCard) {
            // Не обрабатываем клик по кнопке
            if (e.target.closest('.btn-cancel')) return;
            handleOrderComplete(orderCard);
            return;
        }

        // ---- ПРОВЕРЯЕМ: это занятость? ----
        const busyCard = e.target.closest('.busy-slot-card');
        if (busyCard) {
            // Не обрабатываем клик по кнопке
            if (e.target.closest('.btn-cancel')) return;
            handleBusyComplete(busyCard);
            return;
        }
    });

    // =========================================================
    // 2. ДВОЙНОЙ ТАП (МОБИЛЬНЫЕ)
    // =========================================================
    let lastTapTime = 0;
    let tapTarget = null;

    document.addEventListener('touchstart', function(e) {
        // ---- СНАЧАЛА ПРОВЕРЯЕМ: это заказ? ----
        const orderCard = e.target.closest('.order-card');
        if (orderCard) {
            if (e.target.closest('.btn-cancel')) return;
            
            const now = Date.now();
            if (now - lastTapTime < 300 && tapTarget === orderCard) {
                e.preventDefault();
                handleOrderComplete(orderCard);
                lastTapTime = 0;
                tapTarget = null;
                return;
            }
            lastTapTime = now;
            tapTarget = orderCard;
            return;
        }

        // ---- ПРОВЕРЯЕМ: это занятость? ----
        const busyCard = e.target.closest('.busy-slot-card');
        if (busyCard) {
            if (e.target.closest('.btn-cancel')) return;
            
            const now = Date.now();
            if (now - lastTapTime < 300 && tapTarget === busyCard) {
                e.preventDefault();
                handleBusyComplete(busyCard);
                lastTapTime = 0;
                tapTarget = null;
                return;
            }
            lastTapTime = now;
            tapTarget = busyCard;
            return;
        }
    }, { passive: false });
}

// ============================================================
// ===== ЗАВЕРШЕНИЕ ЗАКАЗА (КЛИЕНТ) =====
// ============================================================
function handleOrderComplete(card) {
    const orderId = card.dataset.orderId;
    const priceEl = card.querySelector('.order-price');
    const actualPrice = parseInt(priceEl.textContent.replace(/[^0-9]/g, ''));
    
    if (!confirm('Отметить клиента как обслуженного?')) return;
    
    API.addHistory({
        type: 'client',
        masterName: card.dataset.master,
        clientName: card.querySelector('.order-client').textContent,
        phone: card.querySelector('.order-phone a')?.textContent || '',
        date: card.dataset.date,
        start: card.querySelector('.order-time').textContent,
        price: actualPrice,
        services: card.querySelector('.order-services').textContent,
        id: orderId
    }).then(() => {
        return API.updateOrderStatus(orderId, 'served');
    }).then(() => {
        card.remove();
        Sync.performFullSync();
        console.log('✅ Клиент обслужен:', orderId);
    }).catch(err => {
        console.error('Ошибка:', err);
        alert('Не удалось отметить клиента. Попробуйте еще раз.');
    });
}

// ============================================================
// ===== ЗАВЕРШЕНИЕ ЗАНЯТОСТИ =====
// ============================================================
function handleBusyComplete(card) {
    const busyId = card.dataset.id;
    
    if (!confirm('Отметить занятость как выполненную?')) return;
    
    // Получаем данные из карточки
    const masterName = card.dataset.master;
    const date = card.dataset.date;
    const timeEl = card.querySelector('.slot-time');
    const priceEl = card.querySelector('.slot-price');
    const reasonEl = card.querySelector('.slot-reason');
    
    let start = '';
    let end = '';
    if (timeEl) {
        const parts = timeEl.textContent.split(' – ');
        start = parts[0] || '';
        end = parts[1] || '';
    }
    
    const price = parseInt(priceEl?.textContent.replace(/[^0-9]/g, '')) || 0;
    const reason = reasonEl?.textContent || 'Занятость';
    
    // 1. Отправляем в историю
    API.addHistory({
        type: 'busy',
        masterName: masterName,
        clientName: 'Занятость',
        phone: '',
        date: date,
        start: start,
        end: end,
        price: price,
        services: reason,
        id: busyId
    }).then(() => {
        // 2. Обновляем статус на сервере
        return API.updateBusyStatus(busyId, 'completed');
    }).then(() => {
        // 3. Удаляем карточку из DOM
        card.remove();
        // 4. Обновляем состояние
        Sync.state.busySlots = Sync.state.busySlots.filter(b => b.id !== busyId);
        // 5. Обновляем localStorage
        let localBusy = JSON.parse(localStorage.getItem('busySlots') || '[]');
        localBusy = localBusy.filter(b => b.id !== busyId);
        localStorage.setItem('busySlots', JSON.stringify(localBusy));
        // 6. Полная синхронизация
        Sync.performFullSync();
        console.log('✅ Занятость завершена и отправлена в историю:', busyId);
    }).catch(err => {
        console.error('❌ Ошибка завершения занятости:', err);
        alert('Не удалось завершить занятость. Попробуйте еще раз.');
    });
}