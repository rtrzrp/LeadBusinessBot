const WebhookSender = (() => {

    async function send(transcriptionResult) {
        const activeWebhook = SettingsManager.getActiveWebhook();
        const settings = SettingsManager.getSettings();

        // Валидация данных
        if (!activeWebhook || !activeWebhook.url) {
            logActivity('⚠️ Webhook не настроен. Проверьте настройки.', 'warning');
            return false;
        }

        if (!transcriptionResult) {
            logActivity('⚠️ Нет данных для отправки в webhook', 'warning');
            return false;
        }

        // Подготовка payload согласно требованиям
        const payload = {
            name: settings.userName || 'Неизвестный пользователь',
            date: new Date().toISOString(),
            tg_id: settings.telegramId || '',
            text: transcriptionResult.formattedText || transcriptionResult.text || '',
            transcription_data: transcriptionResult.rawResponse || null
        };

        logActivity(`🔄 Отправка в webhook: ${activeWebhook.name}...`);

        try {
            const response = await fetch(activeWebhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'NexaraBot-Transcriber/1.0'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status} ${response.statusText}`;
                
                try {
                    const errorBody = await response.text();
                    if (errorBody) {
                        errorMessage += ` - ${errorBody}`;
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга тела ответа
                }
                
                throw new Error(errorMessage);
            }

            // Проверяем, что ответ успешный
            let responseData;
            try {
                responseData = await response.text();
            } catch (e) {
                responseData = 'OK';
            }

            const textLength = payload.text.length;
            logActivity(`✅ Данные отправлены в "${activeWebhook.name}" (${textLength} символов)`, 'success');

            // Показываем информацию о диаризации если есть
            if (payload.transcription_data && payload.transcription_data.task === 'diarize') {
                const segmentsCount = payload.transcription_data.segments?.length || 0;
                const speakersCount = new Set(payload.transcription_data.segments?.map(s => s.speaker) || []).size;
                logActivity(`🎭 Диаризация: ${segmentsCount} сегментов, ${speakersCount} спикеров`, 'info');
            }

            // Показываем краткую информацию об отправке
            const preview = payload.text.length > 100 ? payload.text.substring(0, 100) + '...' : payload.text;
            logActivity(`📄 Отправленный текст: "${preview}"`, 'info');
            
            return true;

        } catch (error) {
            const errorMsg = `Ошибка отправки в webhook "${activeWebhook.name}": ${error.message}`;
            logActivity(errorMsg, 'error');
            
            // Дополнительная информация для отладки
            if (error.name === 'TypeError') {
                logActivity('💡 Проверьте правильность URL webhook и подключение к интернету', 'warning');
            }
            
            throw new Error(error.message);
        }
    }

    function validateWebhookSettings() {
        const activeWebhook = SettingsManager.getActiveWebhook();
        const settings = SettingsManager.getSettings();
        
        const issues = [];
        
        if (!activeWebhook || !activeWebhook.url) {
            issues.push('Webhook не выбран или URL не указан');
        } else {
            // Проверяем формат URL
            try {
                new URL(activeWebhook.url);
            } catch (e) {
                issues.push('Некорректный формат URL webhook');
            }
        }
        
        if (!settings.userName) {
            issues.push('Имя пользователя не указано');
        }
        
        // telegramId не обязателен, но предупредим если не указан
        if (!settings.telegramId) {
            issues.push('Telegram ID не указан (не критично)');
        }
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    async function testWebhook() {
        const validation = validateWebhookSettings();
        
        if (!validation.valid) {
            const criticalIssues = validation.issues.filter(issue => 
                !issue.includes('не критично')
            );
            
            if (criticalIssues.length > 0) {
                throw new Error(`Проблемы с настройками: ${criticalIssues.join(', ')}`);
            }
        }

        const testPayload = {
            name: SettingsManager.getSettings().userName || 'Test User',
            date: new Date().toISOString(),
            tg_id: SettingsManager.getSettings().telegramId || 'test_id',
            text: 'Тестовое сообщение от NexaraBot Transcriber'
        };

        const activeWebhook = SettingsManager.getActiveWebhook();
        
        try {
            const response = await fetch(activeWebhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testPayload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            logActivity(`✅ Тест webhook "${activeWebhook.name}" успешен`, 'success');
            return true;
            
        } catch (error) {
            logActivity(`❌ Тест webhook не прошел: ${error.message}`, 'error');
            throw error;
        }
    }

    return {
        send,
        validateWebhookSettings,
        testWebhook
    };

})();