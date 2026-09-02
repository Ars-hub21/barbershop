/* ============================================
   barber_panel/components/columnToggle.js
   ============================================ */

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

    const column = document.querySelector(`.master-column[data-master="${masterName}"]`);
    if (!column) return;

    const indicator = column.querySelector('.column-toggle-indicator');

    if (newState) {
        column.classList.remove('collapsed');
        if (indicator) {
            indicator.textContent = '▼';
            indicator.classList.remove('rotated');
        }
    } else {
        column.classList.add('collapsed');
        if (indicator) {
            indicator.textContent = '▶';
            indicator.classList.add('rotated');
        }
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
function initColumnToggle() {
    document.querySelectorAll('.master-column').forEach(column => {
        const masterName = column.dataset.master;
        if (!masterName) return;

        const title = column.querySelector('.column-title h2');
        if (!title) return;

        // ===== ЗАЩИТА ОТ ДУБЛИРОВАНИЯ LISTENERS =====
        if (title.dataset.toggleInitialized === 'true') return;
        title.dataset.toggleInitialized = 'true';

        // Добавляем индикатор
        let indicator = column.querySelector('.column-toggle-indicator');
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'column-toggle-indicator';
            title.appendChild(indicator);
        }

        // Применяем состояние при загрузке
        const isOpen = getColumnState(masterName);
        if (!isOpen) {
            column.classList.add('collapsed');
            indicator.textContent = '▶';
            indicator.classList.add('rotated');
        } else {
            column.classList.remove('collapsed');
            indicator.textContent = '▼';
            indicator.classList.remove('rotated');
        }

        // ===== ДВОЙНОЙ КЛИК (десктоп) =====
        title.addEventListener('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleColumn(masterName);
        });

        // ===== ДВОЙНОЙ ТАП (сенсор) =====
        title.addEventListener('touchstart', function(e) {
            const now = Date.now();
            const lastTouch = parseInt(title.dataset.lastTouchTime || '0');
            const timeSinceLastTap = now - lastTouch;

            if (timeSinceLastTap < 300 && timeSinceLastTap > 30) {
                // Двойной тап обнаружен
                e.preventDefault();
                e.stopPropagation();
                toggleColumn(masterName);
                title.dataset.lastTouchTime = '0';
            } else {
                title.dataset.lastTouchTime = String(now);
            }
        }, { passive: false });
    });
}

// ===== АВТОЗАПУСК =====
document.addEventListener('DOMContentLoaded', function() {
    initColumnToggle();
});