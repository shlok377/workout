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
    const captureArea = document.getElementById('capture-area');
    const shareBtn = document.getElementById('share-btn');
    
    // Visual feedback on button
    shareBtn.innerText = "Generating Image... ⏳";
    shareBtn.disabled = true;

    try {
        // Use html2canvas to capture the UI
        const canvas = await html2canvas(captureArea, {
            backgroundColor: "#e0e5ec", // Match bg-color
            scale: 2, // Higher quality
            logging: false,
            useCORS: true
        });

        canvas.toBlob(async (blob) => {
            const file = new File([blob], "workout-progress.png", { type: "image/png" });
            
            // Check if Web Share API is available and supports files
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'My Workout Progress',
                    text: 'Check out my workout streak today! 🔥'
                });
            } else {
                // Fallback: Download the image
                const link = document.createElement('a');
                link.download = 'my-workout-progress.png';
                link.href = canvas.toDataURL("image/png");
                link.click();
                alert("Sharing not supported on this browser. Image downloaded instead! 📸");
            }
            
            shareBtn.innerText = "Share Progress 📸";
            shareBtn.disabled = false;
        }, 'image/png');

    } catch (err) {
        console.error("Error generating image:", err);
        shareBtn.innerText = "Error! Try Again ❌";
        shareBtn.disabled = false;
    }
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
