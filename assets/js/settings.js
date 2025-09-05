const SettingsManager = (() => {
    let DOM = {};
    let settings = {
        apiKey: '',
        baseUrl: 'https://api.nexara.ru/api/v1',
        userName: '',
        telegramId: '',
        diarization: false,
        webhooks: [],
        activeWebhookIndex: 0
    };

    function save() {
        settings.apiKey = DOM.apiKey.value.trim();
        settings.baseUrl = DOM.baseUrl.value.trim();
        settings.userName = DOM.userName.value.trim();
        settings.telegramId = DOM.telegramId.value.trim();
        settings.diarization = DOM.diarization.checked;
        settings.activeWebhookIndex = DOM.activeWebhook.selectedIndex;

        settings.webhooks = [];
        $$('.preset-item').forEach(item => {
            const name = item.querySelector('.preset-name').value.trim();
            const url = item.querySelector('.preset-url').value.trim();
            if (name && url) {
                settings.webhooks.push({ name, url });
            }
        });
        
        localStorage.setItem('nexaraTranscriberSettings', JSON.stringify(settings));
        logActivity('Настройки сохранены.', 'success');
        load(); // Reload to ensure consistency
    }

    function load() {
        const savedSettings = localStorage.getItem('nexaraTranscriberSettings');
        if (savedSettings) {
            try {
                settings = { ...settings, ...JSON.parse(savedSettings) };
            } catch (error) {
                logActivity('Не удалось загрузить настройки. Используются значения по умолчанию.', 'warning');
                localStorage.removeItem('nexaraTranscriberSettings'); // Clear corrupted settings
            }
        }

        DOM.apiKey.value = settings.apiKey;
        DOM.baseUrl.value = settings.baseUrl;
        DOM.userName.value = settings.userName;
        DOM.telegramId.value = settings.telegramId;
        DOM.diarization.checked = settings.diarization;
        
        renderWebhooks();
    }

    function renderWebhooks() {
        DOM.presetList.innerHTML = '';
        DOM.activeWebhook.innerHTML = '';

        if (settings.webhooks.length === 0) {
            settings.webhooks.push({name: 'Default', url: ''});
        }

        settings.webhooks.forEach((webhook, index) => {
            addPresetToDOM(webhook.name, webhook.url);
            
            const option = document.createElement('option');
            option.value = index;
            option.textContent = webhook.name;
            DOM.activeWebhook.appendChild(option);
        });
        
        DOM.activeWebhook.selectedIndex = settings.activeWebhookIndex;
    }

    function addPresetToDOM(name = '', url = '') {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.innerHTML = `
            <input type="text" class="preset-name" placeholder="Название" value="${name}">
            <input type="url" class="preset-url" placeholder="URL" value="${url}">
            <button class="delete-btn">🗑️</button>
        `;
        item.querySelector('.delete-btn').addEventListener('click', () => {
            item.remove();
            // User needs to press save to confirm deletion
            logActivity('Пресет удален. Нажмите "Сохранить", чтобы подтвердить.', 'info');
        });
        DOM.presetList.appendChild(item);
    }

    function init() {
        DOM = {
            apiKey: $('#nexara-api-key'),
            baseUrl: $('#base-url'),
            userName: $('#user-name'),
            telegramId: $('#telegram-id'),
            diarization: $('#diarization'),
            saveButton: $('#save-settings'),
            presetList: $('#preset-list'),
            addPresetButton: $('#add-preset'),
            activeWebhook: $('#active-webhook')
        };

        DOM.saveButton.addEventListener('click', save);
        DOM.addPresetButton.addEventListener('click', () => addPresetToDOM());
        
        // Добавляем обработчики для кнопок тестирования
        document.getElementById('test-nexara').addEventListener('click', testNexaraAPI);
        document.getElementById('test-webhook').addEventListener('click', testWebhookConnection);
        
        load(); // Load settings after DOM is ready
    }

    async function testNexaraAPI() {
        const button = document.getElementById('test-nexara');
        button.disabled = true;
        button.textContent = '🔄 Тестирование...';
        
        try {
            // Сначала сохраняем текущие настройки
            save();
            
            const validation = NexaraClient.validateSettings();
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Создаем тестовый аудио blob (минимальный размер)
            const testData = new Uint8Array(44); // Заголовок WAV
            const testBlob = new Blob([testData], { type: 'audio/wav' });
            
            await NexaraClient.transcribe(testBlob);
            
            logActivity('✅ Тест Nexara API успешен!', 'success');
            
        } catch (error) {
            logActivity(`❌ Тест Nexara API не удался: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = '🔬 Тест Nexara API';
        }
    }

    async function testWebhookConnection() {
        const button = document.getElementById('test-webhook');
        button.disabled = true;
        button.textContent = '🔄 Тестирование...';
        
        try {
            // Сначала сохраняем текущие настройки
            save();
            
            await WebhookSender.testWebhook();
            
        } catch (error) {
            logActivity(`❌ Тест webhook не удался: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = '🔗 Тест Webhook';
        }
    }

    function getActiveWebhook() {
        if (!settings.webhooks || settings.webhooks.length === 0) {
            return null;
        }
        return settings.webhooks[settings.activeWebhookIndex];
    }

    function getSettings() {
        // Return a copy to prevent mutation
        return { ...settings };
    }

    return {
        init,
        getSettings,
        getActiveWebhook
    };
})();