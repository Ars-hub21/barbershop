// barber_panel/js/utils/sync-indicator.js
// ОТВЕЧАЕТ ЗА:
// - Отображение индикатора синхронизации на карточках (заказы + занятость)
// - Визуальное подтверждение успешной синхронизации с Google Sheets
// - Переиспользуемый компонент для всех операций

// ============================================================
// 1. СОСТОЯНИЯ ИНДИКАТОРА
// ============================================================
const SyncIndicator = {
    // Состояния:
    // 'synced'   - ✅ синхронизировано с сервером
    // 'syncing'  - ⏳ идет синхронизация
    // 'error'    - ❌ ошибка синхронизации
    // 'pending'  - ⏳ ожидает синхронизации

    // ===== ОБНОВЛЕНИЕ ИНДИКАТОРА НА КАРТОЧКЕ ЗАНЯТОСТИ =====
    update: function(cardElement, state, message = '') {
        if (!cardElement) return;
        
        // Ищем существующий индикатор
        let indicator = cardElement.querySelector('.sync-indicator');
        
        // Если индикатора нет — создаём
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'sync-indicator';
            const slotInfo = cardElement.querySelector('.slot-info');
            if (slotInfo) {
                slotInfo.appendChild(indicator);
            } else {
                cardElement.appendChild(indicator);
            }
        }
        
        this._setIndicatorState(indicator, state, message);
    },

    // ===== ОБНОВЛЕНИЕ ИНДИКАТОРА НА КАРТОЧКЕ ЗАКАЗА =====
    updateOrder: function(cardElement, state, message = '') {
        if (!cardElement) return;
        
        // Ищем существующий индикатор
        let indicator = cardElement.querySelector('.sync-indicator');
        
        // Если индикатора нет — создаём
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'sync-indicator';
            // ===== ВСТАВЛЯЕМ РЯДОМ С ЦЕНОЙ =====
            const priceWrapper = cardElement.querySelector('.order-price-wrapper');
            if (priceWrapper) {
                priceWrapper.appendChild(indicator);
            } else {
                // Fallback: если нет wrapper, ищем цену и вставляем после неё
                const priceEl = cardElement.querySelector('.order-price');
                if (priceEl) {
                    priceEl.after(indicator);
                } else {
                    cardElement.appendChild(indicator);
                }
            }
        }
        
        this._setIndicatorState(indicator, state, message);
    },

    // ===== ВНУТРЕННИЙ МЕТОД: УСТАНОВКА СОСТОЯНИЯ =====
    _setIndicatorState: function(indicator, state, message = '') {
        indicator.className = `sync-indicator sync-${state}`;
        
        switch(state) {
            case 'synced':
                indicator.textContent = '✅';
                indicator.title = message || 'Синхронизировано с Google Sheets';
                indicator.style.color = 'var(--success)';
                break;
            case 'syncing':
                indicator.textContent = '⏳';
                indicator.title = message || 'Синхронизация...';
                indicator.style.color = 'var(--accent)';
                break;
            case 'error':
                indicator.textContent = '❌';
                indicator.title = message || 'Ошибка синхронизации!';
                indicator.style.color = 'var(--danger)';
                break;
            case 'pending':
                indicator.textContent = '⏳';
                indicator.title = message || 'Ожидает синхронизации...';
                indicator.style.color = 'var(--accent)';
                break;
            default:
                indicator.textContent = '❓';
                indicator.title = 'Неизвестный статус';
                indicator.style.color = 'var(--text-secondary)';
        }
        
        // Анимация для состояний syncing и pending
        if (state === 'syncing' || state === 'pending') {
            indicator.style.animation = 'syncPulse 1s ease-in-out infinite';
        } else {
            indicator.style.animation = 'none';
        }
    },

    // ===== ПОИСК КАРТОЧКИ ЗАНЯТОСТИ ПО ID =====
    findCard: function(id) {
        return document.querySelector(`.busy-slot-card[data-id="${id}"]`);
    },

    // ===== ПОИСК КАРТОЧКИ ЗАКАЗА ПО ID =====
    findOrderCard: function(id) {
        return document.querySelector(`.order-card[data-order-id="${id}"]`);
    },

    // ===== ОБНОВЛЕНИЕ ИНДИКАТОРА ЗАНЯТОСТИ ПО ID =====
    updateById: function(id, state, message = '') {
        const card = this.findCard(id);
        if (card) {
            this.update(card, state, message);
            return true;
        }
        return false;
    },

    // ===== ОБНОВЛЕНИЕ ИНДИКАТОРА ЗАКАЗА ПО ID =====
    updateOrderById: function(id, state, message = '') {
        const card = this.findOrderCard(id);
        if (card) {
            this.updateOrder(card, state, message);
            return true;
        }
        return false;
    },

    // ===== УДАЛЕНИЕ ИНДИКАТОРА С КАРТОЧКИ =====
    remove: function(cardElement) {
        if (!cardElement) return;
        const indicator = cardElement.querySelector('.sync-indicator');
        if (indicator) {
            indicator.remove();
        }
    },

    // ===== УДАЛЕНИЕ ИНДИКАТОРА ПО ID (ЗАНЯТОСТЬ) =====
    removeById: function(id) {
        const card = this.findCard(id);
        if (card) {
            this.remove(card);
            return true;
        }
        return false;
    },

    // ===== УДАЛЕНИЕ ИНДИКАТОРА ПО ID (ЗАКАЗ) =====
    removeOrderById: function(id) {
        const card = this.findOrderCard(id);
        if (card) {
            this.remove(card);
            return true;
        }
        return false;
    }
};