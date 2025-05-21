document.addEventListener('DOMContentLoaded', () => {
    // Pantallas
    const setupScreen = document.getElementById('setupScreen');
    const timerScreen = document.getElementById('timerScreen');
    const completionScreen = document.getElementById('completionScreen');

    // Elementos de Configuración
    const seriesInput = document.getElementById('seriesInput');
    const workInput = document.getElementById('workInput');
    const restInput = document.getElementById('restInput');
    const startButton = document.getElementById('startButton');

    // Elementos del Temporizador Principal
    const mainTimerDisplay = document.getElementById('mainTimerDisplay');
    const centralSeriesProgress = document.getElementById('centralSeriesProgress');
    const linearIntervalProgressFill = document.getElementById('linearIntervalProgressFill');


    // Elementos de la Tarjeta de Estado Activo
    const activeStateCard = document.getElementById('activeStateCard');
    const stateCardTitle = document.getElementById('stateCardTitle');
    const stateCardTimer = document.getElementById('stateCardTimer');

    // Botones de Control
    const pauseResumeButton = document.getElementById('pauseResumeButton');
    const resetButton = document.getElementById('resetButton');
    const abortButton = document.getElementById('abortButton');
    const restartSetupButton = document.getElementById('restartSetupButton');

    const ICON_PAUSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    const ICON_PLAY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M8 5v14l11-7z"/></svg>`;

    let configTotalSeries = 0, configWorkTime = 0, configRestTime = 0;
    let currentSeries = 1, currentIntervalTime = 0;
    let mainCountdownTime = 0;
    let isWorkTime = false, isRestTime = false, isPreparationPhase = false, isPaused = false;
    let intervalId = null;
    let lastTenSecondsBellPlayed = false;

    // --- Variables para Web Audio API ---
    let audioContext;
    let convolverNode; // Para la reverberación
    let dryGainNode;   // Para la señal original (sin reverb)
    let wetGainNode;   // Para la señal con reverberación

    // --- Constantes de Sonido (con tus valores óptimos) ---
    const PREPARE_BEEP_FREQUENCY = 800, PREPARE_BEEP_DURATION = 0.09, PREPARE_BEEP_TYPE = 'triangle', PREPARE_BEEP_VOLUME = 0.35;
    const START_WORK_BEEP_FREQUENCY = 987.77, START_WORK_BEEP_DURATION = 0.18, START_WORK_BEEP_TYPE = 'square', START_WORK_BEEP_VOLUME = 0.75;
    const END_INTERVAL_BEEP_FREQUENCY = 659.25, END_INTERVAL_BEEP_DURATION = 0.28, END_INTERVAL_BEEP_TYPE = 'sawtooth', END_INTERVAL_BEEP_VOLUME = 0.65;
    const WORKOUT_COMPLETE_BEEP_FREQUENCY = 440, WORKOUT_COMPLETE_BEEP_DURATION = 0.6, WORKOUT_COMPLETE_BEEP_TYPE = 'sine', WORKOUT_COMPLETE_BEEP_VOLUME = 0.8;
    const TEN_SECONDS_LEFT_BELL_FREQUENCY = 1318.51, TEN_SECONDS_LEFT_BELL_DURATION = 0.35, TEN_SECONDS_LEFT_BELL_TYPE = 'triangle', TEN_SECONDS_LEFT_BELL_VOLUME = 0.7;

    function initAudio() {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Nodos para la mezcla Dry/Wet de la reverberación
            dryGainNode = audioContext.createGain();
            wetGainNode = audioContext.createGain();
            dryGainNode.connect(audioContext.destination); // Dry va directo a la salida

            // Convolver para la reverberación
            convolverNode = audioContext.createConvolver();
            const impulseResponse = generateSimpleImpulseResponse(audioContext, 1.5, 1.2, false); // IR: Duración 1.5s, Decaimiento 1.2
            
            if (impulseResponse) {
                convolverNode.buffer = impulseResponse;
                wetGainNode.connect(convolverNode); // Wet pasa por el convolver
                convolverNode.connect(audioContext.destination); // Convolver a la salida
                console.log("IR Sintética generada y reverberación activada.");
            } else {
                convolverNode = null; // Desactivar reverb si la IR no se puede generar
                wetGainNode.connect(audioContext.destination); // Si no hay reverb, el wet "path" va directo (aunque su ganancia será 0)
                console.warn("No se pudo generar IR sintética, reverberación desactivada.");
            }
            
            // Tus niveles óptimos de mezcla Dry/Wet
            dryGainNode.gain.value = 0.5; 
            wetGainNode.gain.value = (convolverNode && convolverNode.buffer) ? 0.4 : 0;

        } catch (e) {
            console.warn("Web Audio API no soportada o error al inicializar reverberación.", e);
            convolverNode = null; dryGainNode = null; wetGainNode = null;
        }
    }

    function generateSimpleImpulseResponse(audioCtx, duration, decay, reverse = false) {
        if (!audioCtx) return null;
        const sampleRate = audioCtx.sampleRate;
        const length = Math.floor(sampleRate * duration);
        if (length <= 0) return null;
        const impulse = audioCtx.createBuffer(2, length, sampleRate); // Buffer estéreo
        for (let channel = 0; channel < 2; channel++) {
            const impulseChannel = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const n = reverse ? length - 1 - i : i;
                // Tu factor de decaimiento óptimo
                impulseChannel[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay * 1.1); 
            }
        }
        return impulse;
    }
    
    function playGeneratedSound(frequency, duration, type = 'sine', volume = 0.1) {
        if (!audioContext) { return; }
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(err => console.error("Error al resumir AudioContext:", err));
        }
        
        const oscillator = audioContext.createOscillator();
        const mainSoundGainNode = audioContext.createGain(); // Ganancia principal para este sonido

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        const safeVolume = Math.min(1.0, Math.max(0, volume));
        mainSoundGainNode.gain.setValueAtTime(0, audioContext.currentTime);
        mainSoundGainNode.gain.linearRampToValueAtTime(safeVolume, audioContext.currentTime + 0.01);
        // El decaimiento principal del sonido antes de la reverb
        mainSoundGainNode.gain.linearRampToValueAtTime(0.0001, audioContext.currentTime + duration + 0.05); 
        
        oscillator.connect(mainSoundGainNode);

        // Enrutar a través de dry/wet si la reverberación está configurada
        if (convolverNode && convolverNode.buffer && dryGainNode && wetGainNode) {
            mainSoundGainNode.connect(dryGainNode);  // Parte de la señal va directa (dry)
            mainSoundGainNode.connect(wetGainNode);  // Parte de la señal va al wet (que luego va al convolver)
        } else {
            mainSoundGainNode.connect(audioContext.destination); // Sin reverberación, directo a la salida
        }
        
        oscillator.start(audioContext.currentTime);
        // Dejar que el oscilador dure un poco más para la cola de la reverb si está activa.
        // El mainSoundGainNode ya controla el envelope del sonido directo.
        oscillator.stop(audioContext.currentTime + duration + (convolverNode && convolverNode.buffer ? 1.0 : 0.1) ); 
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function calculateTotalWorkoutTime() {
        const workTotal = configWorkTime * configTotalSeries;
        const restTotal = configRestTime * (configTotalSeries > 1 ? configTotalSeries - 1 : 0);
        return workTotal + restTotal;
    }
    
    function updateIntervalProgressBar() {
        if (!linearIntervalProgressFill) return;
        let totalDurationOfInterval;
        if (isPreparationPhase) { totalDurationOfInterval = 3; } 
        else if (isWorkTime) { totalDurationOfInterval = configWorkTime; } 
        else { 
             if (configRestTime <= 0) {
                linearIntervalProgressFill.style.width = `0%`;
                linearIntervalProgressFill.style.backgroundColor = 'var(--color-linear-progress-track)';
                return;
            }
            totalDurationOfInterval = configRestTime;
        }

        if (totalDurationOfInterval <= 0) {
            linearIntervalProgressFill.style.width = `0%`; return;
        }
        const timeElapsed = totalDurationOfInterval - currentIntervalTime;
        const percentage = Math.min(100, Math.max(0, (timeElapsed / totalDurationOfInterval) * 100));
        linearIntervalProgressFill.style.width = `${percentage}%`;
        let progressColor = 'var(--color-accent-active)'; 
        if (isPaused) { progressColor = 'var(--color-accent-paused)'; } 
        else if (isPreparationPhase) { progressColor = 'var(--color-accent-prepare)'; } 
        else if (isWorkTime) { progressColor = 'var(--color-accent-active)'; }
        else if (isRestTime && configRestTime > 0) { progressColor = `var(--color-accent-rest-progress)`;} 
        linearIntervalProgressFill.style.backgroundColor = progressColor;
    }

    function updateDisplay() {
        stateCardTimer.textContent = formatTime(currentIntervalTime);
        mainTimerDisplay.textContent = formatTime(Math.max(0, mainCountdownTime)); 
        if (centralSeriesProgress) {
            centralSeriesProgress.innerHTML = `<span class="current">${currentSeries}</span><span class="separator">/</span><span class="total">${configTotalSeries}</span>`;
        }
        activeStateCard.classList.remove('is-preparing', 'is-working', 'is-resting', 'is-paused');
        pauseResumeButton.innerHTML = isPaused ? ICON_PLAY : ICON_PAUSE;
        if (isPaused) {
            stateCardTitle.textContent = "PAUSADO"; activeStateCard.classList.add('is-paused');
        } else if (isPreparationPhase) {
            stateCardTitle.textContent = "PREPÁRATE"; activeStateCard.classList.add('is-preparing');
        } else if (isWorkTime) {
            stateCardTitle.textContent = "ENTRENA"; activeStateCard.classList.add('is-working');
        } else { 
            stateCardTitle.textContent = "PAUSA"; activeStateCard.classList.add('is-resting');
        }
        updateIntervalProgressBar();
    }

    function tick() {
        if (isPaused) return;
        
        if (isPreparationPhase) {
            currentIntervalTime--; 
            if (currentIntervalTime > 0 && currentIntervalTime < 3) { 
                playGeneratedSound(PREPARE_BEEP_FREQUENCY, PREPARE_BEEP_DURATION, PREPARE_BEEP_TYPE, PREPARE_BEEP_VOLUME);
            }
            if (currentIntervalTime <= 0) {
                isPreparationPhase = false; isWorkTime = true; isRestTime = false;
                currentIntervalTime = configWorkTime; 
                playGeneratedSound(START_WORK_BEEP_FREQUENCY, START_WORK_BEEP_DURATION, START_WORK_BEEP_TYPE, START_WORK_BEEP_VOLUME);
                lastTenSecondsBellPlayed = false;
            }
        } else { 
            currentIntervalTime--; 
            if (mainCountdownTime > 0) { mainCountdownTime--; }

            if (isWorkTime) {
                if (configWorkTime > 10 && currentIntervalTime === 10) { 
                    if (!lastTenSecondsBellPlayed) {
                        playGeneratedSound(TEN_SECONDS_LEFT_BELL_FREQUENCY, TEN_SECONDS_LEFT_BELL_DURATION, TEN_SECONDS_LEFT_BELL_TYPE, TEN_SECONDS_LEFT_BELL_VOLUME);
                        lastTenSecondsBellPlayed = true;
                    }
                }
                if (currentIntervalTime <= 0) { 
                    clearInterval(intervalId); 
                    if (currentSeries >= configTotalSeries) { 
                        completeWorkout(); return; 
                    } else {
                        playGeneratedSound(END_INTERVAL_BEEP_FREQUENCY, END_INTERVAL_BEEP_DURATION, END_INTERVAL_BEEP_TYPE, END_INTERVAL_BEEP_VOLUME);
                        switchIntervalLogic(); return; 
                    }
                }
            } else { // isRestTime
                if (currentIntervalTime <= 0) { 
                    playGeneratedSound(END_INTERVAL_BEEP_FREQUENCY, END_INTERVAL_BEEP_DURATION, END_INTERVAL_BEEP_TYPE, END_INTERVAL_BEEP_VOLUME);
                    clearInterval(intervalId);
                    switchIntervalLogic(); return; 
                }
            }
        }
        updateDisplay(); 
    }

    function switchIntervalLogic() {
        if (isWorkTime) { 
            isWorkTime = false; isRestTime = true;
            currentIntervalTime = configRestTime; 
            lastTenSecondsBellPlayed = false;
            if (configRestTime === 0) { 
                currentSeries++; 
                isWorkTime = true; isRestTime = false;
                currentIntervalTime = configWorkTime; 
                playGeneratedSound(START_WORK_BEEP_FREQUENCY, START_WORK_BEEP_DURATION, START_WORK_BEEP_TYPE, START_WORK_BEEP_VOLUME);
            }
        } else { 
            currentSeries++; 
            isWorkTime = true; isRestTime = false;
            currentIntervalTime = configWorkTime; 
            playGeneratedSound(START_WORK_BEEP_FREQUENCY, START_WORK_BEEP_DURATION, START_WORK_BEEP_TYPE, START_WORK_BEEP_VOLUME);
            lastTenSecondsBellPlayed = false;
        }
        updateDisplay(); 
        if (!isPaused && !completionScreen.classList.contains('active-screen')) {
            if (intervalId) clearInterval(intervalId);
            intervalId = setInterval(tick, 1000);
        }
    }

    function startWorkout() {
        initAudio(); // Asegurar que el audio y la reverb se inicialicen
        configTotalSeries = parseInt(seriesInput.value);
        configWorkTime = parseInt(workInput.value);
        configRestTime = parseInt(restInput.value);
        if (isNaN(configTotalSeries) || configTotalSeries < 1 || isNaN(configWorkTime) || configWorkTime < 1 || isNaN(configRestTime) || configRestTime < 0) {
            alert("Valores de configuración inválidos."); return;
        }
        currentSeries = 1; 
        isPreparationPhase = true; 
        currentIntervalTime = 3; 
        mainCountdownTime = calculateTotalWorkoutTime();
        isWorkTime = false; isRestTime = false; isPaused = false; 
        lastTenSecondsBellPlayed = false;
        showScreen(timerScreen); 
        updateDisplay(); 
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(tick, 1000);
    }

    function showScreen(screenToShow) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        screenToShow.classList.add('active-screen');
    }

    function pauseResumeTimer() {
        isPaused = !isPaused;
        if (isPaused) { clearInterval(intervalId); }
        else {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().catch(err => console.error("Error al resumir AudioContext:", err));
            }
            intervalId = setInterval(tick, 1000);
        }
        updateDisplay();
    }

    function resetCurrentInterval() {
        clearInterval(intervalId);
        if (isPreparationPhase) { 
            currentIntervalTime = 3; 
        } else { 
            currentIntervalTime = isWorkTime ? configWorkTime : configRestTime; 
        }
        lastTenSecondsBellPlayed = false;
        // Recalcular el tiempo principal podría ser complejo si se resetea a mitad de un intervalo.
        // Por simplicidad, lo mantenemos o lo reiniciamos al total si se desea un reset completo del progreso.
        // mainCountdownTime = calculateTotalWorkoutTime(); // Opcional: resetear timer principal también
        // if(isPreparationPhase) mainCountdownTime += 3;

        updateDisplay(); 
        if (!isPaused) { 
            intervalId = setInterval(tick, 1000); 
        }
    }

    function abortSession() {
        clearInterval(intervalId);
        isPreparationPhase = false; isWorkTime = true; isRestTime = false; isPaused = false;
        lastTenSecondsBellPlayed = false; currentSeries = 1; mainCountdownTime = 0;
        if (linearIntervalProgressFill) { 
            linearIntervalProgressFill.style.width = '0%';
            linearIntervalProgressFill.style.backgroundColor = 'var(--color-linear-progress-track)';
        }
        showScreen(setupScreen);
    }

    function completeWorkout() {
        clearInterval(intervalId); 
        mainCountdownTime = 0; 
        currentIntervalTime = 0; 
        if (linearIntervalProgressFill) { 
             linearIntervalProgressFill.style.width = '100%';
             linearIntervalProgressFill.style.backgroundColor = 'var(--color-accent-active)';
        }
        playGeneratedSound(WORKOUT_COMPLETE_BEEP_FREQUENCY, WORKOUT_COMPLETE_BEEP_DURATION, WORKOUT_COMPLETE_BEEP_TYPE, WORKOUT_COMPLETE_BEEP_VOLUME);
        showScreen(completionScreen);
        updateDisplay(); 
    }

    startButton.addEventListener('click', startWorkout);
    pauseResumeButton.addEventListener('click', pauseResumeTimer);
    resetButton.addEventListener('click', resetCurrentInterval);
    abortButton.addEventListener('click', abortSession);
    restartSetupButton.addEventListener('click', () => {
        showScreen(setupScreen);
        seriesInput.value = "3"; 
        workInput.value = "25";
        restInput.value = "10";
    });

    pauseResumeButton.innerHTML = ICON_PAUSE;
    showScreen(setupScreen);
});