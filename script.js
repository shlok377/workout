// State Management
let exercises = JSON.parse(localStorage.getItem('exercises')) || [];
let activity = JSON.parse(localStorage.getItem('activity')) || {};
let theme = localStorage.getItem('theme') || 'light';
let currentEditId = null;
let lastAddedId = null;
let victoryTimeout = null;
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

// Initialize
function init() {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggleBtn.innerText = theme === 'light' ? '🌙' : '☀️';
    
    renderExercises();
    generateGrid(true); // true for initial staggered animation
    renderVolumeChart();
    
    // Auto-scroll to the today cell after slower animations
    setTimeout(scrollToToday, 1500);
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
    themeToggleBtn.innerText = theme === 'light' ? '🌙' : '☀️';
    localStorage.setItem('theme', theme);
    playTactileClick('hard');
});

// Data Persistence
function saveData() {
    localStorage.setItem('exercises', JSON.stringify(exercises));
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

    lastAddedId = newExercise.id;
    exercises.push(newExercise);
    saveData();
    renderExercises();
    exerciseForm.reset();
});

function deleteExercise(id) {
    playTactileClick('soft');
    const item = document.getElementById(`exercise-${id}`);
    if (item) {
        item.classList.add('removing');
        setTimeout(() => {
            exercises = exercises.filter(ex => ex.id !== id);
            saveData();
            renderExercises();
            renderVolumeChart();
        }, 600); 
    } else {
        exercises = exercises.filter(ex => ex.id !== id);
        saveData();
        renderExercises();
        renderVolumeChart();
    }
}

function toggleExercise(id) {
    const exercise = exercises.find(ex => ex.id === id);
    const today = getTodayString();
    const previousActivity = activity[today] || 0;
    
    playTactileClick(exercise.completed ? 'soft' : 'hard');

    if (!exercise.completed) {
        exercise.completed = true;
        activity[today] = previousActivity + (exercise.sets * exercise.reps);
        startTimer();
    } else {
        exercise.completed = false;
        activity[today] = Math.max(0, previousActivity - (exercise.sets * exercise.reps));
        stopTimer();
    }
    
    saveData();
    updateExerciseDOM(id);
    
    // Update grid & Chart
    generateGrid(false);
    renderVolumeChart();

    if (activity[today] > previousActivity) {
        pulseTodayGridCell();
    }

    // Victory check
    checkAllDone();
}

function updateExerciseDOM(id) {
    const exercise = exercises.find(ex => ex.id === id);
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
    const allDone = exercises.length > 0 && exercises.every(ex => ex.completed);
    const addSection = document.getElementById('add-exercise-section');
    const shareContainer = document.getElementById('share-container');
    
    if (allDone) {
        if (!addSection.classList.contains('screenshot-hide')) {
            triggerConfetti();
            playSuccessChime();
        }
        addSection.classList.add('screenshot-hide');
        shareContainer.classList.add('show');
        
        if (victoryTimeout) clearTimeout(victoryTimeout);
        
        victoryTimeout = setTimeout(() => {
            if (exercises.length > 0 && exercises.every(ex => ex.completed)) {
                addSection.classList.remove('screenshot-hide');
                shareContainer.classList.remove('show');
            }
        }, 20000);
    } else {
        addSection.classList.remove('screenshot-hide');
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
    shareBtn.innerText = "Generating Sticker... ⏳";
    shareBtn.disabled = true;

    // Small delay to ensure all bouncy animations (like the share button appearing) are settled
    setTimeout(async () => {
        try {
            // Calculate current streak (consecutive days including today)
            let streak = 0;
            const tempDate = new Date();
            while (true) {
                const dateStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
                if (activity[dateStr] && activity[dateStr] > 0) {
                    streak++;
                    tempDate.setDate(tempDate.getDate() - 1);
                } else {
                    break;
                }
            }

            // Create an off-screen canvas (1080x1920 is standard story ratio)
            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = 1920;
            const ctx = canvas.getContext('2d');

            // 1. Transparent background
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 2. Setup styles
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 30;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;

            // 3. Draw Header
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 75px Nunito, sans-serif'; // Shrunk from 90px
            ctx.fillText('WORKOUT COMPLETE! 🔥', canvas.width / 2, 400);

            // 4. Draw Streak
            ctx.font = 'bold 110px Nunito, sans-serif'; // Shrunk from 130px
            ctx.fillStyle = '#6c5ce7'; // Primary color
            ctx.fillText(`${streak} DAY STREAK`, canvas.width / 2, 550);

            // 5. Draw Routine List
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 70px Nunito, sans-serif';
            ctx.fillText('Routine Highlights:', 150, 800);

            ctx.font = '55px Nunito, sans-serif';
            let startY = 930;
            exercises.forEach((ex, index) => {
                if (index < 12) { // Slightly more space now
                    const text = `✅ ${ex.name} (${ex.sets}×${ex.reps})`;
                    ctx.fillText(text, 150, startY + (index * 90));
                }
            });

            // Convert to Blob and Share
            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error("Canvas to Blob failed");
                const file = new File([blob], "workout-sticker.png", { type: "image/png" });
                
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'My Workout Progress',
                            text: `Just crushed my workout streak today! 🔥 #WorkoutTracker #Streak`
                        });
                    } catch (shareErr) {
                        console.log("Share cancelled or failed:", shareErr);
                    }
                } else {
                    const link = document.createElement('a');
                    link.download = 'workout-sticker.png';
                    link.href = canvas.toDataURL("image/png");
                    link.click();
                    alert("Sharing not supported. Your transparent sticker was downloaded! 📸");
                }
                
                shareBtn.innerText = "Share Progress 📸";
                shareBtn.disabled = false;
            }, 'image/png');

        } catch (err) {
            console.error("Error generating image:", err);
            shareBtn.innerText = "Error! Try Again ❌";
            shareBtn.disabled = false;
            alert("Failed to generate your sticker. Please try again.");
        }
    }, 800); 
}

function openEditModal(id) {
    playTactileClick('soft');
    const exercise = exercises.find(ex => ex.id === id);
    currentEditId = id;
    editNameInput.value = exercise.name;
    editSetsInput.value = exercise.sets;
    editRepsInput.value = exercise.reps;
    editModal.classList.add('show');
}

saveEditBtn.addEventListener('click', () => {
    playTactileClick('hard');
    const exercise = exercises.find(ex => ex.id === currentEditId);
    exercise.name = editNameInput.value;
    exercise.sets = parseInt(editSetsInput.value);
    exercise.reps = parseInt(editRepsInput.value);
    
    saveData();
    renderExercises();
    renderVolumeChart();
    editModal.classList.remove('show');
});

cancelEditBtn.addEventListener('click', () => {
    playTactileClick('soft');
    editModal.classList.remove('show');
});

// UI Rendering
function renderExercises() {
    exerciseList.innerHTML = '';
    exercises.forEach(ex => {
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
                <button class="btn-icon" onclick="openEditModal(${ex.id})">✎</button>
                <button class="btn-icon btn-delete" onclick="deleteExercise(${ex.id})">🗑</button>
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

init();
