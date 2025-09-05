document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM загружен, начинаем инициализацию...');
    
    // ДИАГНОСТИКА: Проверяем все элементы
    const micButton = document.getElementById('main-mic-btn');
    const deviceSelect = document.getElementById('audio-devices');
    const logContainer = document.getElementById('log-container');
    const statusText = document.getElementById('status-text');
    const micStatusDot = document.getElementById('mic-status-dot');
    const timerDisplay = document.getElementById('elapsed-time');
    const fileInput = document.getElementById('audio-file');
    
    console.log('🔍 Проверка элементов:', {
        micButton: !!micButton,
        deviceSelect: !!deviceSelect,
        logContainer: !!logContainer,
        statusText: !!statusText,
        micStatusDot: !!micStatusDot,
        timerDisplay: !!timerDisplay,
        fileInput: !!fileInput
    });
    
    // Если какой-то элемент не найден, показываем ошибку
    if (!micButton || !logContainer) {
        console.error('❌ Критические элементы не найдены!');
        alert('Ошибка: не найдены критические элементы DOM!');
        return;
    }
    
    let mediaRecorder = null;
    let isRecording = false;
    let audioChunks = [];
    let timer = null;
    let seconds = 0;
    
    // Функция логирования
    function log(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const time = new Date().toLocaleTimeString();
        entry.innerHTML = `<span class="timestamp">[${time}]</span> ${message}`;
        logContainer.insertBefore(entry, logContainer.firstChild);
        console.log(message);
    }
    
    // Простая инициализация микрофона
    async function initMicrophone() {
        try {
            log('Попытка получить доступ к микрофону...');
            
            // Запрашиваем доступ
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            log('Доступ к микрофону получен!', 'success');
            
            // Получаем список устройств
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(d => d.kind === 'audioinput');
            
            log(`Найдено микрофонов: ${audioDevices.length}`, 'success');
            
            // Заполняем список
            deviceSelect.innerHTML = '';
            audioDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Микрофон ${index + 1}`;
                deviceSelect.appendChild(option);
            });
            
            // Включаем контролы
            deviceSelect.disabled = false;
            micButton.disabled = false;
            micStatusDot.classList.add('ok');
            
            // ВАЖНО: меняем статус!
            statusText.textContent = 'Готов к записи';
            statusText.className = 'status-text';
            
            // Останавливаем поток
            stream.getTracks().forEach(track => track.stop());
            
            log('🎤 Микрофон готов к работе!', 'success');
            
            return true;
            
        } catch (error) {
            log(`Ошибка доступа к микрофону: ${error.message}`, 'error');
            micStatusDot.classList.remove('ok');
            return false;
        }
    }
    
    // Запуск записи
    async function startRecording() {
        try {
            log('🎬 Начинаем запись...');
            
            const deviceId = deviceSelect.value;
            log(`Используем устройство: ${deviceId || 'по умолчанию'}`);
            
            const constraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    channelCount: 1,
                    sampleRate: 16000
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            log('✅ Поток получен');
            
            // Приоритет для ГОЛОСА: WAV -> OGG -> MP3 (избегаем MP4)
            let mimeType = '';
            
            if (MediaRecorder.isTypeSupported('audio/wav')) {
                mimeType = 'audio/wav';
            } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                mimeType = 'audio/ogg;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                mimeType = 'audio/ogg';
            } else {
                // В крайнем случае MP4, но это не оптимально для голоса
                mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
            }
            
            log(`📡 Используем поддерживаемый формат: ${mimeType || 'по умолчанию браузера'}`, 'success');
            
            const options = mimeType ? { mimeType } : {};
            mediaRecorder = new MediaRecorder(stream, options);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                    log(`📊 Получен chunk: ${(event.data.size / 1024).toFixed(1)} KB`);
                }
            };
            
            mediaRecorder.onstart = () => {
                log('🔴 MediaRecorder запущен');
            };
            
            mediaRecorder.onstop = () => {
                // Создаем blob с правильным MIME типом
                const finalMimeType = mimeType || 'audio/ogg';
                const audioBlob = new Blob(audioChunks, { type: finalMimeType });
                
                log(`✅ Запись завершена. Размер: ${(audioBlob.size / 1024).toFixed(1)} KB`, 'success');
                log(`📦 Тип файла: ${finalMimeType}`, 'info');
                
                if (audioBlob.size > 0) {
                    // Определяем расширение
                    let extension = 'wav';
                    if (finalMimeType.includes('wav')) {
                        extension = 'wav';
                    } else if (finalMimeType.includes('ogg')) {
                        extension = 'ogg';
                    } else if (finalMimeType.includes('mp4')) {
                        extension = 'mp4';
                    }
                    
                    // ВАЖНО: Создаем File объект с именем и расширением
                    const audioFile = new File([audioBlob], `recording.${extension}`, {
                        type: finalMimeType
                    });

                    log(`🎵 Создан и отправляется файл: ${audioFile.name}`, 'info');
                    
                    processAudio(audioFile);
                } else {
                    log('⚠️ Пустой аудиофайл', 'warning');
                }
            };
            
            mediaRecorder.onerror = (event) => {
                log(`❌ Ошибка MediaRecorder: ${event.error}`, 'error');
            };
            
            // Запускаем запись с интервалом в 1 секунду
            mediaRecorder.start(1000);
            isRecording = true;
            
            // Обновляем интерфейс
            micButton.innerHTML = '🛑';
            statusText.textContent = 'Идет запись...';
            statusText.className = 'status-text recording';
            micButton.classList.add('recording');
            
            // Включаем волны
            document.querySelector('.mic-container').classList.add('recording');
            
            // Запускаем таймер
            seconds = 0;
            timer = setInterval(() => {
                seconds++;
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }, 1000);
            
            log('🎙️ Запись началась!', 'success');
            
        } catch (error) {
            log(`❌ Ошибка запуска записи: ${error.message}`, 'error');
            console.error('Detailed error:', error);
        }
    }
    
    // Остановка записи
    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            clearInterval(timer);
            isRecording = false;
            
            // Обновляем интерфейс
            micButton.innerHTML = '<svg class="mic-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"></path></svg>';
            statusText.textContent = 'Готов к записи';
            statusText.className = 'status-text';
            micButton.classList.remove('recording');
            
            log('Запись остановлена', 'info');
        }
    }
    
    // Обработка аудио (заглушка)
    async function processAudio(audioBlob) {
        log('Обработка аудио...', 'info');
        
        // Здесь будет код для отправки в Nexara API
        // Пока просто показываем что файл готов
        setTimeout(() => {
            log('Аудио готово к обработке!', 'success');
        }, 1000);
    }
    
    // ПРИНУДИТЕЛЬНО устанавливаем event listeners
    console.log('⚙️ Устанавливаем event listeners...');
    
    // Обработчик кнопки микрофона
    try {
        micButton.addEventListener('click', async (event) => {
            console.log('🖱️ КЛИК ПО МИКРОФОНУ!');
            event.preventDefault();
            log('🖱️ Клик по кнопке микрофона');
            
            try {
                if (isRecording) {
                    log('🛑 Останавливаем запись...');
                    stopRecording();
                } else {
                    log('▶️ Запускаем запись...');
                    await startRecording();
                }
            } catch (error) {
                log(`❌ Ошибка в обработчике кнопки: ${error.message}`, 'error');
                console.error('Button handler error:', error);
            }
        });
        console.log('✅ Event listener для микрофона установлен');
    } catch (error) {
        console.error('❌ Ошибка установки event listener для микрофона:', error);
    }

    // Обработчик загрузки файлов
    try {
        fileInput.addEventListener('change', async (event) => {
            console.log('📎 ВЫБРАН ФАЙЛ!');
            log('📎 Выбран файл для загрузки');
            
            const file = event.target.files[0];
            if (!file) {
                log('Файл не выбран', 'warning');
                return;
            }
            
            log(`Обрабатываем файл: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
            
            try {
                await processAudio(file);
            } catch (error) {
                log(`Ошибка обработки файла: ${error.message}`, 'error');
            } finally {
                event.target.value = ''; // Сбросить input
            }
        });
        console.log('✅ Event listener для загрузки файлов установлен');
    } catch (error) {
        console.error('❌ Ошибка установки event listener для файлов:', error);
    }
    
    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        
        if (e.code === 'Space') {
            e.preventDefault();
            micButton.click();
        }
    });
    
    // Очистка лога
    document.getElementById('clear-log')?.addEventListener('click', () => {
        logContainer.innerHTML = '';
    });
    
    // Переключение темы
    document.querySelector('.theme-toggle')?.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme');
    });
    
    // Настройки
    let settings = {
        apiKey: '',
        baseUrl: 'https://api.nexara.ru/api/v1',
        userName: '',
        telegramId: '',
        webhookUrl: '',
        diarization: false
    };

    // Загрузка настроек
    function loadSettings() {
        const saved = localStorage.getItem('nexaraSettings');
        if (saved) {
            try {
                settings = { ...settings, ...JSON.parse(saved) };
                document.getElementById('nexara-api-key').value = settings.apiKey;
                document.getElementById('base-url').value = settings.baseUrl;
                document.getElementById('user-name').value = settings.userName;
                document.getElementById('telegram-id').value = settings.telegramId;
                document.getElementById('webhook-url').value = settings.webhookUrl;
                document.getElementById('diarization').checked = settings.diarization;
            } catch (e) {
                log('Ошибка загрузки настроек', 'warning');
            }
        }
    }

    // Сохранение настроек
    function saveSettings() {
        settings.apiKey = document.getElementById('nexara-api-key').value;
        settings.baseUrl = document.getElementById('base-url').value;
        settings.userName = document.getElementById('user-name').value;
        settings.telegramId = document.getElementById('telegram-id').value;
        settings.webhookUrl = document.getElementById('webhook-url').value;
        settings.diarization = document.getElementById('diarization').checked;
        
        localStorage.setItem('nexaraSettings', JSON.stringify(settings));
        log('Настройки сохранены!', 'success');
    }

    // Сворачивание настроек
    const settingsHeader = document.querySelector('.collapsible-header');
    const settingsPanel = document.querySelector('.settings-panel');
    
    settingsHeader.addEventListener('click', () => {
        settingsPanel.classList.toggle('closed');
    });

    // Сохранение настроек
    document.getElementById('save-settings').addEventListener('click', saveSettings);

    // Транскрипция через НАШ ОБЪЕДИНЕННЫЙ СЕРВЕР
    async function transcribeAudio(audioFile) {
        if (!settings.apiKey) {
            log('API ключ не указан в настройках!', 'error');
            return null;
        }

        const url = "/api/transcribe"; // Новый относительный URL
        
        try {
            log('🔄 Отправка на наш сервер...');
            
            const formData = new FormData();
            formData.append("file", audioFile);
            formData.append("response_format", "json");
            if (settings.diarization) {
                formData.append('task', 'diarize');
            }

            const response = await fetch(url, {
                method: "POST",
                headers: { 'x-nexara-api-key': settings.apiKey },
                body: formData,
            });

            log(`📡 Ответ от нашего сервера получен. Статус: ${response.status}`, 'info');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || JSON.stringify(errorData));
            }

            const result = await response.json();
            const text = result.text || (result.segments ? result.segments.map(s => `${s.speaker}: ${s.text}`).join('\n') : '');
            
            log(`✅ Транскрипция получена: ${text.substring(0, 50)}...`, 'success');
            return text;

        } catch (error) {
            log(`❌ Ошибка транскрипции: ${error.message}`, 'error');
            return null;
        }
    }

    // Отправка в webhook через НАШ ОБЪЕДИНЕННЫЙ СЕРВЕР
    async function sendToWebhook(text) {
        if (!settings.webhookUrl) {
            log('Webhook URL не указан', 'warning');
            return;
        }
        if (!text) {
            log('Нет текста для отправки', 'warning');
            return;
        }

        const url = "/api/webhook"; // Новый относительный URL
        
        try {
            log('🔄 Отправка webhook через наш сервер...');
            
            const serverPayload = {
                webhookUrl: settings.webhookUrl,
                payload: {
                    name: settings.userName || 'Unknown',
                    date: new Date().toISOString(),
                    tg_id: settings.telegramId || '',
                    text: text
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverPayload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || JSON.stringify(errorData));
            }

            log('✅ Webhook успешно перенаправлен!', 'success');
            
        } catch (error) {
            log(`❌ Ошибка отправки webhook: ${error.message}`, 'error');
        }
    }

    // Обновляем функцию обработки аудио
    async function processAudio(audioBlob) {
        const text = await transcribeAudio(audioBlob);
        if (text) {
            log(`📄 Текст: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`, 'info');
            await sendToWebhook(text);
        }
    }

    // Инициализация
    log('🚀 Инициализация приложения...');
    
    // Загружаем настройки
    loadSettings();
    
    // Автоматически пробуем получить доступ к микрофону
    const micAccess = await initMicrophone();
    
    if (micAccess) {
        log('✅ Приложение готово к работе!', 'success');
        log('💡 Не забудьте настроить API ключ и webhook в настройках', 'info');
        
        // ПРИНУДИТЕЛЬНО обновляем UI
        micButton.disabled = false;
        statusText.textContent = 'Готов к записи';
        statusText.className = 'status-text';
        
        log('🖱️ Кнопка микрофона активна - можно нажимать!', 'info');
        
    } else {
        log('⚠️ Приложение запущено без доступа к микрофону', 'warning');
        log('Нажмите на кнопку микрофона для запроса доступа', 'info');
        statusText.textContent = 'Нет доступа к микрофону';
        
        // Если нет доступа, пробуем при клике
        micButton.addEventListener('click', async () => {
            const success = await initMicrophone();
            if (success) {
                // После получения доступа, начинаем запись
                setTimeout(() => startRecording(), 500);
            }
        }, { once: true });
    }

    // ФИНАЛЬНЫЙ ТЕСТ КЛИКАБЕЛЬНОСТИ
    console.log('🧪 Тестируем кликабельность элементов...');
    
    // Проверяем, можно ли программно кликнуть на элементы
    setTimeout(() => {
        try {
            console.log('Тест 1: Проверка кнопки микрофона');
            console.log('micButton.disabled:', micButton.disabled);
            console.log('micButton.style.pointerEvents:', micButton.style.pointerEvents);
            console.log('micButton.getBoundingClientRect():', micButton.getBoundingClientRect());
            
            console.log('Тест 2: Проверка поля загрузки файла');
            console.log('fileInput.disabled:', fileInput.disabled);
            console.log('fileInput.style.display:', fileInput.style.display);
            
            log('🧪 Диагностика завершена. Проверьте консоль браузера для деталей.', 'info');
            log('💡 Попробуйте кликнуть сейчас - должны появиться сообщения в консоли!', 'info');
            
        } catch (error) {
            console.error('Ошибка диагностики:', error);
        }
    }, 1000);
});