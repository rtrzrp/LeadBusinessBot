const AudioRecorder = (() => {
    let mediaRecorder = null;
    let audioChunks = [];
    let stream = null;
    let timerInterval = null;
    let elapsedTime = 0;
    let isInitialized = false;

    async function initialize() {
        if (isInitialized) return true;
        
        try {
            // Получаем доступ к микрофону
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Получаем список устройств
            const devices = await navigator.mediaDevices.enumerateDevices();
            UIController.populateDeviceList(devices);
            UIController.setMicStatus(true);
            
            // Освобождаем поток, он нам пока не нужен
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            
            isInitialized = true;
            logActivity('Микрофон успешно инициализирован', 'success');
            return true;
            
        } catch (error) {
            logActivity(`Ошибка доступа к микрофону: ${error.message}`, 'error');
            UIController.setMicStatus(false, error.message);
            return false;
        }
    }

    async function start(deviceId) {
        try {
            // Получаем новый поток для записи
            const constraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    channelCount: 1,
                    sampleRate: 16000
                }
            };
            
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Создаем MediaRecorder
            const options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/webm';
            }
            
            mediaRecorder = new MediaRecorder(stream, options);
            audioChunks = [];
            elapsedTime = 0;
            
            // Обработчики событий MediaRecorder
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstart = () => {
                startTimer();
                UIController.update(UIController.AppState.RECORDING);
                logActivity('Запись начата');
            };
            
            mediaRecorder.onpause = () => {
                stopTimer();
                UIController.update(UIController.AppState.PAUSED);
                logActivity('Запись приостановлена');
            };
            
            mediaRecorder.onresume = () => {
                startTimer();
                UIController.update(UIController.AppState.RECORDING);
                logActivity('Запись возобновлена');
            };
            
            mediaRecorder.onstop = () => {
                stopTimer();
                UIController.update(UIController.AppState.IDLE);
                logActivity('Запись остановлена');
            };
            
            // Начинаем запись
            mediaRecorder.start(1000); // Получаем данные каждую секунду
            
        } catch (error) {
            logActivity(`Ошибка начала записи: ${error.message}`, 'error');
            UIController.update(UIController.AppState.IDLE);
            throw error;
        }
    }

    function pause() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            
            // Возвращаем текущие chunks как Blob для частичной транскрипции
            if (audioChunks.length > 0) {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                return blob;
            }
        }
        return null;
    }

    function resume() {
        if (mediaRecorder && mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
        }
    }

    function stop() {
        return new Promise((resolve) => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    cleanup();
                    resolve(audioBlob);
                };
                mediaRecorder.stop();
            } else {
                resolve(null);
            }
        });
    }

    function cleanup() {
        stopTimer();
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        mediaRecorder = null;
        audioChunks = [];
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            elapsedTime++;
            UIController.updateTimer(elapsedTime);
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function getState() {
        return mediaRecorder ? mediaRecorder.state : 'inactive';
    }

    return {
        initialize,
        start,
        pause,
        resume,
        stop,
        getState,
        cleanup
    };
})();