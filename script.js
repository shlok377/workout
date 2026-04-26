// State Management
let exercises = JSON.parse(localStorage.getItem('exercises')) || [];
let activity = JSON.parse(localStorage.getItem('activity')) || {};
let currentEditId = null;
let lastAddedId = null;
let victoryTimeout = null;

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

// Initialize
function init() {
    renderExercises();
    generateGrid(true); // true for initial staggered animation
    
    // Auto-scroll to the today cell after slower animations
    setTimeout(scrollToToday, 1500);
}

// Data Persistence
function saveData() {
    localStorage.setItem('exercises', JSON.stringify(exercises));
    localStorage.setItem('activity', JSON.stringify(activity));
}

// Exercise Operations
exerciseForm.addEventListener('submit', (e) => {
    e.preventDefault();
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
    const item = document.getElementById(`exercise-${id}`);
    if (item) {
        item.classList.add('removing');
        setTimeout(() => {
            exercises = exercises.filter(ex => ex.id !== id);
            saveData();
            renderExercises();
        }, 600); 
    } else {
        exercises = exercises.filter(ex => ex.id !== id);
        saveData();
        renderExercises();
    }
}

function toggleExercise(id) {
    const exercise = exercises.find(ex => ex.id === id);
    const today = getTodayString();
    const previousActivity = activity[today] || 0;
    
    if (!exercise.completed) {
        exercise.completed = true;
        activity[today] = previousActivity + (exercise.sets * exercise.reps);
    } else {
        exercise.completed = false;
        activity[today] = Math.max(0, previousActivity - (exercise.sets * exercise.reps));
    }
    
    saveData();
    updateExerciseDOM(id);
    
    // Update grid
    generateGrid(false);
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
        addSection.classList.add('screenshot-hide');
        shareContainer.classList.add('show');
        
        // Clear existing timeout if user unchecks/rechecks quickly
        if (victoryTimeout) clearTimeout(victoryTimeout);
        
        victoryTimeout = setTimeout(() => {
            // Only bring back if still all done
            if (exercises.length > 0 && exercises.every(ex => ex.completed)) {
                addSection.classList.remove('screenshot-hide');
                shareContainer.classList.remove('show');
            }
        }, 20000); // Increased to 20 seconds
    } else {
        addSection.classList.remove('screenshot-hide');
        shareContainer.classList.remove('show');
    }
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
    const exercise = exercises.find(ex => ex.id === id);
    currentEditId = id;
    editNameInput.value = exercise.name;
    editSetsInput.value = exercise.sets;
    editRepsInput.value = exercise.reps;
    editModal.classList.add('show');
}

saveEditBtn.addEventListener('click', () => {
    const exercise = exercises.find(ex => ex.id === currentEditId);
    exercise.name = editNameInput.value;
    exercise.sets = parseInt(editSetsInput.value);
    exercise.reps = parseInt(editRepsInput.value);
    
    saveData();
    renderExercises();
    editModal.classList.remove('show');
});

cancelEditBtn.addEventListener('click', () => {
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

init();
