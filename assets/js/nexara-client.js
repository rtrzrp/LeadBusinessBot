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

        // Добавляем диаризацию если включена
        if (settings.diarization) {
            formData.append('task', 'diarize');

            // Добавляем количество спикеров если указано
            if (settings.numSpeakers && settings.numSpeakers.trim()) {
                const numSpeakers = parseInt(settings.numSpeakers);
                if (numSpeakers > 0 && numSpeakers <= 10) {
                    formData.append('num_speakers', numSpeakers.toString());
                    logActivity(`Установлено количество спикеров: ${numSpeakers}`, 'info');
                }
            }

            // Добавляем режим диаризации
            formData.append('diarization_setting', settings.diarizationSetting || 'general');
            logActivity(`Режим диаризации: ${settings.diarizationSetting || 'general'}`, 'info');

            // НЕ отправляем response_format при диаризации - API игнорирует его
        } else {
            // Для обычной транскрибации отправляем response_format
            formData.append('response_format', 'json');
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

            // Отладка: логируем полный ответ API
            console.log('Nexara API Response:', result);
            logActivity(`📋 API Response: task=${result.task}, segments=${result.segments?.length || 0}`, 'info');

            let transcriptText = '';

            if (settings.diarization && result.task === 'diarize') {
                // Диаризация запрошена и получена
                if (result.segments && result.segments.length > 0) {
                    // Форматируем диаризированный текст
                    transcriptText = result.segments
                        .map(segment => `${segment.speaker}: ${segment.text}`)
                        .join('\n');

                    logActivity(`✅ Диаризация получена (${result.segments.length} сегментов)`, 'success');
                    logActivity(`📊 Найдено спикеров: ${new Set(result.segments.map(s => s.speaker)).size}`, 'info');
                } else {
                    // Диаризация запрошена, но segments пустые - используем обычный текст
                    transcriptText = result.text || '';
                    logActivity(`⚠️ Диаризация: segments пустые, используем обычный текст`, 'warning');
                    console.warn('Diariazation requested but segments empty:', result);
                }
            } else {
                // Обычная транскрипция
                transcriptText = result.text || '';
                logActivity(`✅ Транскрипция получена (${transcriptText.length} символов)`, 'success');
            }
            
            if (!transcriptText.trim()) {
                throw new Error('Получена пустая транскрипция');
            }

            // Возвращаем объект с отформатированным текстом и полным ответом API
            return {
                formattedText: transcriptText.trim(),
                rawResponse: result,
                isDiarized: settings.diarization && result.task === 'diarize'
            };

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

    async function testDiarization() {
        const settings = SettingsManager.getSettings();

        if (!settings.apiKey) {
            throw new Error('API ключ не указан');
        }

        // Создаем тестовый аудиофайл с разговором
        const testData = new Uint8Array(1024); // Минимальный тестовый файл
        const testBlob = new Blob([testData], { type: 'audio/webm' });

        logActivity('🧪 Тестирование диаризации...', 'info');

        const formData = new FormData();
        formData.append('file', testBlob, 'test-diarization.webm');
        formData.append('task', 'diarize');
        formData.append('diarization_setting', 'general');

        try {
            const response = await fetch(`${settings.baseUrl}/audio/transcriptions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log('Diariazation test result:', result);

            if (result.segments && result.segments.length > 0) {
                logActivity(`✅ Диаризация работает! Найдено ${result.segments.length} сегментов`, 'success');
                return result;
            } else {
                logActivity(`⚠️ Диаризация: segments не получены, но API ответил`, 'warning');
                return result;
            }

        } catch (error) {
            logActivity(`❌ Тест диаризации не удался: ${error.message}`, 'error');
            throw error;
        }
    }

    return {
        transcribe,
        validateSettings,
        testConnection,
        testDiarization
    };

})();