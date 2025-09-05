const NexaraClient = (() => {

    async function transcribe(audioBlob) {
        const settings = SettingsManager.getSettings();
        
        if (!settings.apiKey) {
            throw new Error('API ключ Nexara не указан в настройках');
        }

        const formData = new FormData();
        
        // Определяем имя файла в зависимости от типа blob
        let fileName = 'recording.webm';
        if (audioBlob.type) {
            if (audioBlob.type.includes('mp3')) fileName = 'recording.mp3';
            else if (audioBlob.type.includes('wav')) fileName = 'recording.wav';
            else if (audioBlob.type.includes('mp4')) fileName = 'recording.mp4';
        }
        
        formData.append('file', audioBlob, fileName);
        formData.append('response_format', 'json');

        // Добавляем диаризацию если включена
        if (settings.diarization) {
            formData.append('task', 'diarize');
            formData.append('diarization_setting', 'general');
        }

        logActivity('🔄 Отправка аудио на транскрипцию...');
        
        try {
            const response = await fetch(`${settings.baseUrl}/audio/transcriptions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error?.message || errorData.detail || errorMessage;
                } catch (e) {
                    // Если не можем распарсить JSON ошибки, используем статус
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            
            let transcriptText = '';
            
            if (settings.diarization && result.segments) {
                // Форматируем диаризированный текст
                transcriptText = result.segments
                    .map(segment => `${segment.speaker}: ${segment.text}`)
                    .join('\n');
                
                logActivity(`✅ Транскрипция получена (${result.segments.length} сегментов, ${transcriptText.length} символов)`, 'success');
            } else {
                // Обычная транскрипция
                transcriptText = result.text || '';
                logActivity(`✅ Транскрипция получена (${transcriptText.length} символов)`, 'success');
            }
            
            if (!transcriptText.trim()) {
                throw new Error('Получена пустая транскрипция');
            }
            
            return transcriptText.trim();

        } catch (error) {
            const errorMsg = `Ошибка транскрипции: ${error.message}`;
            logActivity(errorMsg, 'error');
            
            // Повторный бросок ошибки для обработки в вызывающем коде
            throw new Error(error.message);
        }
    }

    function validateSettings() {
        const settings = SettingsManager.getSettings();
        
        if (!settings.apiKey) {
            return { valid: false, error: 'API ключ не указан' };
        }
        
        if (!settings.baseUrl) {
            return { valid: false, error: 'Base URL не указан' };
        }
        
        return { valid: true };
    }

    async function testConnection() {
        const validation = validateSettings();
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Создаем минимальный аудиофайл для тестирования
        const testBlob = new Blob(['test'], { type: 'audio/webm' });
        
        try {
            await transcribe(testBlob);
            return true;
        } catch (error) {
            throw new Error(`Тест соединения не удался: ${error.message}`);
        }
    }

    return {
        transcribe,
        validateSettings,
        testConnection
    };

})();