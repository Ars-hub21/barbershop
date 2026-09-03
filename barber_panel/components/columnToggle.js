/* ============================================
   barber_panel/components/columnToggle.js
   ============================================
   Разворачивание/сворачивание карточки мастера — ОДНИМ кликом/тапом по
   заголовку карточки (раньше требовался двойной клик/тап, что было
   неудобно и не всегда срабатывало с первого раза).

   Состояние (открыта/свёрнута) хранится в localStorage — то есть само по
   себе уже работает только на этом устройстве/браузере, ни с чем не
   синхронизируется. */

// ===== СОСТОЯНИЕ КОЛОНОК =====
function getColumnState(masterName) {
    const states = getFromLocal('columnStates', {});
    return states[masterName] !== undefined ? states[masterName] : true;
}

function setColumnState(masterName, isOpen) {
    const states = getFromLocal('columnStates', {});
    states[masterName] = isOpen;
    saveToLocal('columnStates', states);
}

// ===== ПЕРЕКЛЮЧЕНИЕ КОЛОНКИ =====
function toggleColumn(masterName) {
    const isOpen = getColumnState(masterName);
    const newState = !isOpen;
    setColumnState(masterName, newState);
    applyColumnState(masterName, newState);
}

function applyColumnState(masterName, isOpen) {
    const column = document.querySelector(`.master-column[data-master="${masterName}"]`);
    if (!column) return;

    const indicator = column.querySelector('.column-toggle-indicator');

    if (isOpen) {
        column.classList.remove('collapsed');
        if (indicator) indicator.classList.remove('rotated');
    } else {
        column.classList.add('collapsed');
        if (indicator) indicator.classList.add('rotated');
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
function initColumnToggle() {
    document.querySelectorAll('.master-column').forEach(column => {
        const masterName = column.dataset.master;
        if (!masterName) return;

        const header = column.querySelector('.column-header');
        const columnTitle = column.querySelector('.column-title');
        if (!header || !columnTitle) return;

        // ===== ЗАЩИТА ОТ ДУБЛИРОВАНИЯ LISTENERS =====
        if (header.dataset.toggleInitialized === 'true') return;
        header.dataset.toggleInitialized = 'true';

        // Добавляем индикатор (единая иконка Font Awesome — см. columnToggle.css).
        // ВАЖНО: индикатор — ОТДЕЛЬНЫЙ элемент рядом с именем, а НЕ внутри <h2>
        // и не внутри .master-avatar. У этих двух элементов уже есть своя
        // скрытая функция (тройной клик/тап — переход в историю мастера,
        // см. barber_script.js, initTripleClickForHistory) — её трогать нельзя.
        // Если бы индикатор/клик по сворачиванию срабатывал через h2 или
        // аватар, каждый третий клик по нему неожиданно уводил бы барбера
        // на страницу истории вместо того, чтобы просто свернуть карточку.
        let indicator = column.querySelector('.column-toggle-indicator');
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'column-toggle-indicator';
            indicator.innerHTML = '<i class="fas fa-chevron-down"></i>';
            header.insertBefore(indicator, columnTitle.nextSibling);
        }

        // Применяем состояние при загрузке
        applyColumnState(masterName, getColumnState(masterName));

        // ===== ОДИН КЛИК / ТАП ПО ЗАГОЛОВКУ =====
        // Сворачивает/разворачивает карточку. НЕ срабатывает при клике по:
        // - кнопкам (Занят, закрепить) — у них своё действие;
        // - имени мастера (<h2>) и аватару — там уже есть отдельный жест
        //   (тройной клик/тап → история мастера), который не должен
        //   конфликтовать с обычным одиночным кликом по заголовку.
        header.addEventListener('click', function (e) {
            if (e.target.closest('button')) return;
            if (e.target.closest('h2')) return;
            if (e.target.closest('.master-avatar')) return;
            toggleColumn(masterName);
        });
    });
}

// ===== АВТОЗАПУСК =====
document.addEventListener('DOMContentLoaded', function() {
    initColumnToggle();
});
