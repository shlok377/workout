// State Management
let exerciseHistory = JSON.parse(localStorage.getItem('exerciseHistory')) || {};
let activity = JSON.parse(localStorage.getItem('activity')) || {};
let theme = localStorage.getItem('theme') || 'light';
let selectedDate = getTodayString();
let currentEditId = null;
let lastAddedId = null;
let timerInterval = null;
let audioCtx = null;

// DOM Elements
const exerciseForm = document.getElementById('exercise-form');
const exerciseList = document.getElementById('exercise-list');
const streakGrid = document.getElementById('streak-grid');
const editModal = document.getElementById('edit-modal');
const editNameInput = document.getElementById('edit-name');
const editSetsInput = document.getElementById('edit-sets');
const editRepsInput = document.getElementById('edit-reps');
const saveEditBtn = document.getElementById('save-edit');
const cancelEditBtn = document.getElementById('cancel-edit');
const themeToggleBtn = document.getElementById('theme-toggle');
const datePicker = document.getElementById('date-picker');
const selectedDateLabel = document.getElementById('selected-date-label');

// Initialize
function init() {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeToggleUI();
    
    cleanupOldData();
    renderDatePicker(true);
    renderExercises();
    generateGrid(true);
    renderVolumeChart();
    updateQuickStats();
    
    setTimeout(scrollToToday, 1500);
}

// Data Persistence
function saveData() {
    localStorage.setItem('exerciseHistory', JSON.stringify(exerciseHistory));
    localStorage.setItem('activity', JSON.stringify(activity));
}

function cleanupOldData() {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() - 15);
    const cutoffStr = getDateString(cutoff);
    
    Object.keys(exerciseHistory).forEach(date => {
        if (date < cutoffStr) delete exerciseHistory[date];
    });
    saveData();
}

// Date Utility Functions
function getDateString(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayString() {
    return getDateString(new Date());
}

// Date Picker Logic
function renderDatePicker(isInitial = false) {
    if (!datePicker) return;
    datePicker.innerHTML = '';
    const today = new Date();
    
    for (let i = 0; i < 15; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = getDateString(d);
        
        const dateItem = document.createElement('div');
        dateItem.className = `date-item ${dateStr === selectedDate ? 'active' : ''} ${isInitial ? 'pop-animate' : ''}`;
        
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = d.getDate();
        
        dateItem.innerHTML = `
            <span class="date-day">${dayName}</span>
            <span class="date-num">${dayNum}</span>
        `;
        
        dateItem.onclick = () => selectDate(dateStr);
        datePicker.appendChild(dateItem);
    }
}

function selectDate(dateStr) {
    playTactileClick('soft');
    selectedDate = dateStr;
    const today = getTodayString();
    selectedDateLabel.innerText = dateStr === today ? 'Today' : dateStr;
    
    renderDatePicker(false);
    renderExercises();
    
    const activeItem = datePicker.querySelector('.date-item.active');
    if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

function updateThemeToggleUI() {
    const sunIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    const moonIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    themeToggleBtn.innerHTML = theme === 'light' ? moonIcon : sunIcon;
}

// Navigation Logic
function switchScreen(screen) {
    const container = document.getElementById('screens-container');
    const tabs = document.querySelectorAll('.tab-item');
    const screenStats = document.getElementById('screen-stats');
    const screenWorkout = document.getElementById('screen-workout');
    
    playTactileClick('soft');

    if (screen === 'stats') {
        container.style.transform = 'translateX(0%)';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
        screenStats.classList.add('active');
        screenWorkout.classList.remove('active');
    } else {
        container.style.transform = 'translateX(-50%)';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
        screenStats.classList.remove('active');
        screenWorkout.classList.add('active');
    }
}

// Quick Stats Calculation
function updateQuickStats() {
    const today = getTodayString();
    
    // 1. Current Streak
    let currentStreak = 0;
    const tempDate = new Date();
    while (true) {
        const dateStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
        if (activity[dateStr] && activity[dateStr] > 0) {
            currentStreak++;
            tempDate.setDate(tempDate.getDate() - 1);
        } else {
            // Check if missed only today (streak might still be active if they haven't worked out YET today)
            if (dateStr === today && currentStreak === 0) {
                tempDate.setDate(tempDate.getDate() - 1);
                const yesterdayStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
                if (!(activity[yesterdayStr] > 0)) break;
                else {
                    tempDate.setDate(tempDate.getDate() + 1); // Reset to today and continue checking from yesterday
                    tempDate.setDate(tempDate.getDate() - 1);
                    continue; 
                }
            }
            break;
        }
    }

    // 2. Lifetime Volume
    const lifetimeVolume = Object.values(activity).reduce((a, b) => a + b, 0);

    // 3. Personal Record (Best Day)
    const prVolume = Math.max(...Object.values(activity), 0);

    // 4. Daily Average (last 30 days)
    const last30Days = [];
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (activity[dateStr]) last30Days.push(activity[dateStr]);
    }
    const avgVolume = last30Days.length > 0 
        ? Math.round(last30Days.reduce((a, b) => a + b, 0) / 30) 
        : 0;

    // Update DOM
    document.getElementById('stat-streak').innerText = currentStreak;
    document.getElementById('stat-lifetime').innerText = lifetimeVolume.toLocaleString();
    document.getElementById('stat-pr').innerText = prVolume.toLocaleString();
    document.getElementById('stat-avg').innerText = avgVolume.toLocaleString();
}

// Tactile Feedback (Audio & Haptics)
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTactileClick(type = 'soft') {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(type === 'soft' ? 150 : 250, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);

    if (navigator.vibrate) {
        navigator.vibrate(type === 'soft' ? 10 : 25);
    }
}

function playSuccessChime() {
    initAudio();
    const now = audioCtx.currentTime;
    [440, 554, 659].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.05, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.3);
    });
}

// Theme Toggling
themeToggleBtn.addEventListener('click', () => {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeToggleUI();
    localStorage.setItem('theme', theme);
    playTactileClick('hard');
});

// Data Persistence
function saveData() {
    localStorage.setItem('exerciseHistory', JSON.stringify(exerciseHistory));
    localStorage.setItem('activity', JSON.stringify(activity));
}

// Exercise Operations
exerciseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    playTactileClick('hard');
    const nameInput = document.getElementById('exercise-name');
    const setsInput = document.getElementById('sets');
    const repsInput = document.getElementById('reps');
    
    const name = nameInput.value;
    const sets = parseInt(setsInput.value);
    const reps = parseInt(repsInput.value);

    const newExercise = {
        id: Date.now(),
        name,
        sets,
        reps,
        completed: false
    };

    if (!exerciseHistory[selectedDate]) {
        exerciseHistory[selectedDate] = [];
    }

    lastAddedId = newExercise.id;
    exerciseHistory[selectedDate].push(newExercise);
    saveData();
    renderExercises();
    exerciseForm.reset();
});

function deleteExercise(id) {
    playTactileClick('soft');
    const item = document.getElementById(`exercise-${id}`);
    const workout = exerciseHistory[selectedDate] || [];
    
    if (item) {
        item.classList.add('removing');
        setTimeout(() => {
            exerciseHistory[selectedDate] = workout.filter(ex => ex.id !== id);
            saveData();
            renderExercises();
            renderVolumeChart();
            updateQuickStats();
        }, 600); 
    } else {
        exerciseHistory[selectedDate] = workout.filter(ex => ex.id !== id);
        saveData();
        renderExercises();
        renderVolumeChart();
        updateQuickStats();
    }
}

function toggleExercise(id) {
    const workout = exerciseHistory[selectedDate] || [];
    const exercise = workout.find(ex => ex.id === id);
    const activityDate = selectedDate; 
    const previousActivity = activity[activityDate] || 0;
    
    playTactileClick(exercise.completed ? 'soft' : 'hard');

    if (!exercise.completed) {
        exercise.completed = true;
        activity[activityDate] = previousActivity + (exercise.sets * exercise.reps);
        if (activityDate === getTodayString()) startTimer();
    } else {
        exercise.completed = false;
        activity[activityDate] = Math.max(0, previousActivity - (exercise.sets * exercise.reps));
        if (activityDate === getTodayString()) stopTimer();
    }
    
    saveData();
    updateExerciseDOM(id);
    
    // Update grid, Chart, and Quick Stats
    generateGrid(false);
    renderVolumeChart();
    updateQuickStats();

    if (activity[activityDate] > previousActivity) {
        pulseTodayGridCell();
    }

    // Victory check
    checkAllDone();
}

function updateExerciseDOM(id) {
    const workout = exerciseHistory[selectedDate] || [];
    const exercise = workout.find(ex => ex.id === id);
    const li = document.getElementById(`exercise-${id}`);
    if (li) {
        li.className = `exercise-item ${exercise.completed ? 'done-state' : ''}`;
        const checkbox = li.querySelector('.custom-checkbox');
        const info = li.querySelector('.exercise-info');
        
        if (exercise.completed) {
            checkbox.classList.add('checked');
            info.classList.add('done');
        } else {
            checkbox.classList.remove('checked');
            info.classList.remove('done');
        }
    }
}

function checkAllDone() {
    const workout = exerciseHistory[selectedDate] || [];
    const allDone = workout.length > 0 && workout.every(ex => ex.completed);
    const shareContainer = document.getElementById('share-container');
    const workoutScreen = document.getElementById('screen-workout');
    
    if (allDone) {
        if (selectedDate === getTodayString() && !workoutScreen.classList.contains('victory-achieved')) {
            triggerConfetti();
            playSuccessChime();
            workoutScreen.classList.add('victory-achieved');
        }
        shareContainer.classList.add('show');
    } else {
        workoutScreen.classList.remove('victory-achieved');
        shareContainer.classList.remove('show');
    }
}

// Volume Chart Rendering
function renderVolumeChart() {
    const container = document.getElementById('volume-chart');
    if (!container) return;
    container.innerHTML = '';
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        last7Days.push({
            date: dateStr,
            label: d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
            volume: activity[dateStr] || 0
        });
    }

    const maxVolume = Math.max(...last7Days.map(d => d.volume), 100);

    last7Days.forEach(day => {
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-bar-wrapper';
        
        const heightPercent = (day.volume / maxVolume) * 100;
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = '0%';
        bar.title = `${day.date}: ${day.volume} reps`;
        
        const label = document.createElement('div');
        label.className = 'chart-label';
        label.innerText = day.label;
        
        wrapper.appendChild(bar);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
        
        setTimeout(() => {
            bar.style.height = `${Math.max(heightPercent, 5)}%`;
        }, 100);
    });
}

// Rest Timer Logic
function startTimer() {
    const overlay = document.getElementById('rest-timer-overlay');
    const display = document.getElementById('timer-display');
    const progress = document.getElementById('timer-progress');
    
    let timeLeft = 60;
    const totalTime = 60;
    
    stopTimer();
    overlay.style.display = 'flex';
    display.innerText = timeLeft;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        display.innerText = timeLeft;
        
        const offset = 226 - (timeLeft / totalTime) * 226;
        progress.style.strokeDashoffset = offset;
        
        if (timeLeft <= 0) {
            stopTimer();
            playSuccessChime();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    const overlay = document.getElementById('rest-timer-overlay');
    if (overlay) overlay.style.display = 'none';
    const progress = document.getElementById('timer-progress');
    if (progress) progress.style.strokeDashoffset = 0;
}

// Confetti Animation
function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particles = [];
    const colors = ['#6c5ce7', '#a29bfe', '#fab1a0', '#ff7675', '#fd79a8'];

    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: canvas.height + Math.random() * 100,
            radius: Math.random() * 5 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: Math.random() * 4 - 2,
            vy: -Math.random() * 15 - 10,
            gravity: 0.3
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            
            if (p.y < canvas.height) {
                alive = true;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            }
        });

        if (alive) requestAnimationFrame(animate);
    }
    animate();
}

async function shareProgress() {
    const shareBtn = document.getElementById('share-btn');
    const originalContent = shareBtn.innerHTML;
    shareBtn.innerText = "Generating Sticker...";
    shareBtn.disabled = true;

    setTimeout(async () => {
        try {
            let streak = 0;
            const tempDate = new Date();
            while (true) {
                const dateStr = getDateString(tempDate);
                if (activity[dateStr] && activity[dateStr] > 0) {
                    streak++;
                    tempDate.setDate(tempDate.getDate() - 1);
                } else {
                    break;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = 1920;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 30;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 75px Nunito, sans-serif'; 
            ctx.fillText('WORKOUT COMPLETE!', canvas.width / 2, 400);

            ctx.font = 'bold 110px Nunito, sans-serif'; 
            ctx.fillStyle = '#6c5ce7'; 
            ctx.fillText(`${streak} DAY STREAK`, canvas.width / 2, 550);

            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 70px Nunito, sans-serif';
            ctx.fillText('Routine Highlights:', 150, 800);

            ctx.font = '55px Nunito, sans-serif';
            let startY = 930;
            const workout = exerciseHistory[selectedDate] || [];
            workout.forEach((ex, index) => {
                if (index < 12) { 
                    const text = `* ${ex.name} (${ex.sets}×${ex.reps})`;
                    ctx.fillText(text, 150, startY + (index * 90));
                }
            });

            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("Canvas to Blob failed");
                const file = new File([blob], "workout-sticker.png", { type: "image/png" });
                
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'My Workout Progress',
                            text: `Just crushed my workout streak today! #WorkoutTracker #Streak`
                        });
                    } catch (shareErr) {
                        console.log("Share cancelled or failed:", shareErr);
                    }
                } else {
                    const link = document.createElement('a');
                    link.download = 'workout-sticker.png';
                    link.href = canvas.toDataURL("image/png");
                    link.click();
                    alert("Sharing not supported. Your transparent sticker was downloaded!");
                }
                
                shareBtn.innerHTML = originalContent;
                shareBtn.disabled = false;
            }, 'image/png');

        } catch (err) {
            console.error("Error generating image:", err);
            shareBtn.innerText = "Error! Try Again";
            setTimeout(() => {
                shareBtn.innerHTML = originalContent;
                shareBtn.disabled = false;
            }, 2000);
            alert("Failed to generate your sticker. Please try again.");
        }
    }, 800); 
}

function openEditModal(id) {
    playTactileClick('soft');
    const workout = exerciseHistory[selectedDate] || [];
    const exercise = workout.find(ex => ex.id === id);
    currentEditId = id;
    editNameInput.value = exercise.name;
    editSetsInput.value = exercise.sets;
    editRepsInput.value = exercise.reps;
    editModal.classList.add('show');
}

saveEditBtn.addEventListener('click', () => {
    playTactileClick('hard');
    const workout = exerciseHistory[selectedDate] || [];
    const exercise = workout.find(ex => ex.id === currentEditId);
    exercise.name = editNameInput.value;
    exercise.sets = parseInt(editSetsInput.value);
    exercise.reps = parseInt(editRepsInput.value);
    
    saveData();
    renderExercises();
    renderVolumeChart();
    updateQuickStats();
    editModal.classList.remove('show');
});

cancelEditBtn.addEventListener('click', () => {
    playTactileClick('soft');
    editModal.classList.remove('show');
});

// UI Rendering
function renderExercises() {
    exerciseList.innerHTML = '';
    const workout = exerciseHistory[selectedDate] || [];
    workout.forEach(ex => {
        const li = document.createElement('li');
        li.id = `exercise-${ex.id}`;
        const isNew = ex.id === lastAddedId;
        li.className = `exercise-item ${ex.completed ? 'done-state' : ''} ${isNew ? 'new-item' : ''}`;
        
        li.innerHTML = `
            <div class="custom-checkbox ${ex.completed ? 'checked' : ''}" onclick="toggleExercise(${ex.id})"></div>
            <div class="exercise-info ${ex.completed ? 'done' : ''}">
                <span class="exercise-name">${ex.name}</span>
                <span class="exercise-details">${ex.sets} sets × ${ex.reps} reps</span>
            </div>
            <div class="actions">
                <button class="btn-icon" onclick="openEditModal(${ex.id})" title="Edit">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteExercise(${ex.id})" title="Delete">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;
        exerciseList.appendChild(li);
    });
    lastAddedId = null; 
    checkAllDone();
}

// Activity Grid Logic
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateGrid(isInitial = false) {
    streakGrid.innerHTML = '';
    const now = new Date();
    const year = now.getFullYear();
    const startDate = new Date(year, 0, 1);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const tempDate = new Date(startDate);
    const todayStr = getTodayString();
    
    for (let i = 0; i < 371; i++) {
        const dateStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
        const count = activity[dateStr] || 0;
        
        const cell = document.createElement('div');
        cell.className = 'cell ' + getLevelClass(count);
        cell.title = `${dateStr}: ${count} repetitions`;
        
        if (isInitial) {
            cell.style.animationDelay = `${(i % 7) * 0.1 + Math.floor(i / 7) * 0.02}s`;
        } else {
            cell.style.animation = 'none'; 
        }
        
        if (dateStr === todayStr) {
            cell.id = 'today-cell';
        }
        
        streakGrid.appendChild(cell);
        tempDate.setDate(tempDate.getDate() + 1);
    }
}

function scrollToToday() {
    const todayCell = document.getElementById('today-cell');
    const gridWrapper = document.getElementById('grid-wrapper');
    if (todayCell && gridWrapper) {
        const wrapperRect = gridWrapper.getBoundingClientRect();
        const cellRect = todayCell.getBoundingClientRect();
        const scrollOffset = cellRect.left - wrapperRect.left - (wrapperRect.width / 2) + (cellRect.width / 2);
        gridWrapper.scrollLeft += scrollOffset;
    }
}

function pulseTodayGridCell() {
    const todayCell = document.getElementById('today-cell');
    if (todayCell) {
        todayCell.classList.remove('pulse');
        void todayCell.offsetWidth; 
        todayCell.classList.add('pulse');
    }
}

function getLevelClass(count) {
    if (count === 0) return 'level-0';
    if (count < 20) return 'level-1';
    if (count < 50) return 'level-2';
    if (count < 100) return 'level-3';
    return 'level-4';
}

// Global scope for onclick handlers
window.toggleExercise = toggleExercise;
window.openEditModal = openEditModal;
window.deleteExercise = deleteExercise;
window.shareProgress = shareProgress;
window.stopTimer = stopTimer;
window.switchScreen = switchScreen;

init();
