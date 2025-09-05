const UIController = (() => {
    const AppState = {
        IDLE: 'idle',
        RECORDING: 'recording',
        PAUSED: 'paused',
        PROCESSING: 'processing',
        SENDING: 'sending'
    };

    let DOM = {}; // Defer initialization
    let currentState = AppState.IDLE;

    function init() {
        DOM = {
            themeToggle: $('.theme-toggle'),
            micButton: $('#main-mic-btn'),
            micContainer: $('.mic-container'),
            pauseButton: $('#pause-btn'),
            resumeButton: $('#resume-btn'),
            stopButton: $('#stop-btn'),
            timerDisplay: $('#elapsed-time'),
            statusText: $('#status-text'),
            audioDeviceSelector: $('#audio-devices'),
            logContainer: $('#log-container'),
            clearLogButton: $('#clear-log'),
            settingsPanel: $('.settings-panel'),
            settingsHeader: $('.collapsible-header'),
            errorDisplay: $('#recorder-error-display'),
            micStatusDot: $('#mic-status-dot')
        };

        // Move event listeners that depend on DOM here
        DOM.themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            document.body.classList.toggle('light-theme');
            const isDark = document.body.classList.contains('dark-theme');
            DOM.themeToggle.textContent = isDark ? '🌙' : '☀️';
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });

        DOM.clearLogButton.addEventListener('click', () => {
            DOM.logContainer.innerHTML = '';
        });

        DOM.settingsHeader.addEventListener('click', () => {
            DOM.settingsPanel.classList.toggle('closed');
            const isClosed = DOM.settingsPanel.classList.contains('closed');
            localStorage.setItem('settingsClosed', isClosed);
        });

        // Load theme and settings panel state
        if (localStorage.getItem('theme') === 'light') {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            DOM.themeToggle.textContent = '☀️';
        }
        if (localStorage.getItem('settingsClosed') === 'true') {
            DOM.settingsPanel.classList.add('closed');
        }
    }

    function setStatus(state, text) {
        DOM.statusText.textContent = text;
        DOM.statusText.className = `status-text ${state}`;
    }

    function update(state) {
        currentState = state;
        const isRecording = state === AppState.RECORDING;
        const isPaused = state === AppState.PAUSED;
        const isIdle = state === AppState.IDLE;
        const isProcessing = state === AppState.PROCESSING || state === AppState.SENDING;

        DOM.micButton.classList.toggle('recording', isRecording);
        DOM.micContainer.classList.toggle('recording', isRecording);
        
        DOM.micButton.disabled = isProcessing;
        DOM.pauseButton.disabled = !isRecording;
        DOM.resumeButton.disabled = !isPaused;
        DOM.stopButton.disabled = !isRecording && !isPaused;

        switch (state) {
            case AppState.IDLE:
                setStatus('idle', 'Готов к записи');
                break;
            case AppState.RECORDING:
                setStatus('recording', 'Идет запись...');
                break;
            case AppState.PAUSED:
                setStatus('paused', 'Пауза');
                break;
            case AppState.PROCESSING:
                setStatus('processing', 'Обработка аудио...');
                break;
            case AppState.SENDING:
                setStatus('sending', 'Отправка транскрипции...');
                break;
        }
    }

    function populateDeviceList(devices) {
        DOM.audioDeviceSelector.innerHTML = '';
        devices.forEach(device => {
            if (device.kind === 'audioinput') {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Микрофон ${DOM.audioDeviceSelector.options.length + 1}`;
                DOM.audioDeviceSelector.appendChild(option);
            }
        });
    }

    function updateTimer(seconds) {
        DOM.timerDisplay.textContent = formatTime(seconds);
    }

    function setMicStatus(isOk, error) {
        DOM.micStatusDot.classList.toggle('ok', isOk);
        DOM.audioDeviceSelector.disabled = !isOk;
        if (isOk) {
            DOM.errorDisplay.style.display = 'none';
        } else {
            DOM.errorDisplay.textContent = `ОШИБКА: ${error}. Убедитесь, что вы используете HTTPS (или localhost) и предоставили доступ к микрофону в настройках браузера.`;
            DOM.errorDisplay.style.display = 'block';
        }
    }

    return {
        init,
        update,
        populateDeviceList,
        updateTimer,
        setMicStatus,
        get DOM() { return DOM; }, // Use a getter to ensure DOM is initialized
        AppState,
        getCurrentState: () => currentState
    };
})();