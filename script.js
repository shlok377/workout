// State Management
let exerciseHistory = JSON.parse(localStorage.getItem('exerciseHistory')) || {};
let activity = JSON.parse(localStorage.getItem('activity')) || {};
let templates = JSON.parse(localStorage.getItem('templates')) || [];
let theme = localStorage.getItem('theme') || 'light';
let selectedDate = getTodayString();
let currentEditId = null;
let lastAddedId = null;
let timerInterval = null;
let audioCtx = null;
let currentEditingTemplateId = null;
let weeklyGoal = parseInt(localStorage.getItem('weeklyGoal')) || 4;

// Gesture State
let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;
let currentSwipeItem = null;
let longPressTimer = null;
const SWIPE_THRESHOLD_PAUSE = 0.35;
const SWIPE_THRESHOLD_ACTION = 0.65;

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

const templateModal = document.getElementById('template-modal');
const loadTemplateModal = document.getElementById('load-template-modal');
const templateNameInput = document.getElementById('template-name');
const templateExList = document.getElementById('template-exercises-list');
const templatesListUI = document.getElementById('templates-list');
const loadTemplatesListUI = document.getElementById('load-templates-list');
// Initial load theme
document.documentElement.setAttribute('data-theme', theme);

// Theme Selection Logic
function toggleThemeMenu(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('theme-dropdown');
    dropdown.classList.toggle('show');
    playTactileClick('soft');
}

function setTheme(themeName) {
    theme = themeName;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update UI
    const dropdown = document.getElementById('theme-dropdown');
    dropdown.classList.remove('show');

    // Highlight active option
    document.querySelectorAll('.theme-option').forEach(opt => {
        // Get name from text content, lowercase and replace spaces with hyphens to match data-theme values
        const optName = opt.querySelector('.theme-name').innerText.trim().toLowerCase().replace(/\s+/g, '-');
        if (optName === themeName) opt.classList.add('active');
        else opt.classList.remove('active');
    });

    playTactileClick('hard');

    // Refresh components that might need re-rendering for theme colors (like the chart)
    if (currentScreen === 'stats') {
        renderVolumeChart();
        generateGrid(false);
    }
}

// Close dropdown on outside click
window.addEventListener('click', () => {
    const dropdown = document.getElementById('theme-dropdown');
    if (dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
    }
});

// Remove old theme toggle listener and add to global exposure
window.toggleThemeMenu = toggleThemeMenu;
window.setTheme = setTheme;

function init() {
    // Correct active state on initial load
    setTheme(theme);

    cleanupOldData();
    renderDatePicker(true);
    renderExercises();
    generateGrid(true);
    renderVolumeChart();
    updateQuickStats();
    updateWeeklyProgress();
    initGestures();
    initDockGestures();

    setTimeout(scrollToToday, 1500);
}

// Data Persistence
function saveData() {
    localStorage.setItem('exerciseHistory', JSON.stringify(exerciseHistory));
    localStorage.setItem('activity', JSON.stringify(activity));
    localStorage.setItem('templates', JSON.stringify(templates));
    localStorage.setItem('weeklyGoal', weeklyGoal);
}

function cleanupOldData() {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() - 30);
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
    const today = new Date();
    
    // Check if we need to create or update
    const existingItems = datePicker.querySelectorAll('.date-item');
    const needsCreation = existingItems.length === 0;

    for (let i = 0; i < 15; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = getDateString(d);
        
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = d.getDate();
        
        if (needsCreation) {
            const dateItem = document.createElement('div');
            dateItem.className = `date-item ${dateStr === selectedDate ? 'active' : ''}`;
            dateItem.innerHTML = `
                <span class="date-day">${dayName}</span>
                <span class="date-num">${dayNum}</span>
            `;
            dateItem.onclick = () => selectDate(dateStr);
            datePicker.appendChild(dateItem);
        } else {
            const dateItem = existingItems[i];
            dateItem.className = `date-item ${dateStr === selectedDate ? 'active' : ''}`;
            dateItem.querySelector('.date-day').innerText = dayName;
            dateItem.querySelector('.date-num').innerText = dayNum;
            dateItem.onclick = () => selectDate(dateStr);
        }
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

// Navigation Logic
let currentScreen = 'stats';
const screensList = ['stats', 'workout', 'templates'];

function switchScreen(screen) {
    currentScreen = screen;
    const container = document.getElementById('screens-container');
    const tabs = document.querySelectorAll('.tab-item');
    const screenStats = document.getElementById('screen-stats');
    const screenWorkout = document.getElementById('screen-workout');
    const screenTemplates = document.getElementById('screen-templates');
    
    playTactileClick('soft');

    tabs.forEach(tab => tab.classList.remove('active'));
    [screenStats, screenWorkout, screenTemplates].forEach(s => s.classList.remove('active'));

    if (screen === 'stats') {
        tabs[0].classList.add('active');
        screenStats.classList.add('active');
        
        // Re-trigger animations
        generateGrid(true);
        renderVolumeChart();
        updateQuickStats();
    } else if (screen === 'workout') {
        tabs[1].classList.add('active');
        screenWorkout.classList.add('active');
        
        // Re-trigger animations
        renderDatePicker(true);
        renderExercises(true);
    } else if (screen === 'templates') {
        tabs[2].classList.add('active');
        screenTemplates.classList.add('active');
        
        // Re-trigger animations
        renderTemplates();
    }
}

// Gesture Navigation for the Dock (Horizontal Only)
function initDockGestures() {
    const tabBar = document.querySelector('.tab-bar');
    let touchStartX = 0;
    let touchStartY = 0;
    const threshold = 50; 

    tabBar.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        tabBar.style.transition = 'none'; 
    }, { passive: true });

    tabBar.addEventListener('touchmove', (e) => {
        const touchCurrentX = e.changedTouches[0].screenX;
        const touchCurrentY = e.changedTouches[0].screenY;
        
        const deltaX = touchCurrentX - touchStartX;
        const deltaY = touchCurrentY - touchStartY;
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            const dampedDeltaX = deltaX * 0.1;
            tabBar.style.transform = `translateX(calc(-50% + ${dampedDeltaX}px))`;
        }
    }, { passive: true });

    tabBar.addEventListener('touchend', (e) => {
        tabBar.style.transition = ''; 
        tabBar.style.transform = ''; 

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
            const currentIndex = screensList.indexOf(currentScreen);
            
            if (deltaX > 0) {
                if (currentIndex > 0) switchScreen(screensList[currentIndex - 1]);
            } else {
                if (currentIndex < screensList.length - 1) switchScreen(screensList[currentIndex + 1]);
            }
        }
    }, { passive: true });
}

// Quick Stats Calculation
function updateQuickStats() {
    const today = getTodayString();
    
    let currentStreak = 0;
    const tempDate = new Date();
    while (true) {
        const dateStr = getDateString(tempDate);
        if (activity[dateStr] && activity[dateStr] > 0) {
            currentStreak++;
            tempDate.setDate(tempDate.getDate() - 1);
        } else {
            if (dateStr === today && currentStreak === 0) {
                tempDate.setDate(tempDate.getDate() - 1);
                const yesterdayStr = getDateString(tempDate);
                if (!(activity[yesterdayStr] > 0)) break;
                else continue; 
            }
            break;
        }
    }

    const lifetimeVolume = Object.values(activity).reduce((a, b) => a + b, 0);
    const prVolume = Math.max(...Object.values(activity), 0);

    const last30Days = [];
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getDateString(d);
        if (activity[dateStr]) last30Days.push(activity[dateStr]);
    }
    const avgVolume = last30Days.length > 0 
        ? Math.round(last30Days.reduce((a, b) => a + b, 0) / 30) 
        : 0;

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

// Standardized Gesture Engine Implementation
function initGestures() {
    [exerciseList, templatesListUI].forEach(list => {
        list.addEventListener('touchstart', handleTouchStart, { passive: true });
        list.addEventListener('touchmove', handleTouchMove, { passive: false });
        list.addEventListener('touchend', handleTouchEnd);
    });
}

function handleTouchStart(e) {
    const item = e.target.closest('.exercise-item, .template-item');
    if (!item) return;
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    currentSwipeItem = item;
    isSwiping = false;

    item.querySelectorAll('.swipe-bg').forEach(bg => bg.classList.remove('active'));

    longPressTimer = setTimeout(() => {
        if (!isSwiping) {
            const id = parseInt(item.id.split('-').pop());
            if (item.classList.contains('exercise-item')) openEditModal(id);
            else openTemplateModal(id);
            playTactileClick('hard');
        }
    }, 600);
}

function handleTouchMove(e) {
    if (!currentSwipeItem) return;

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchX - touchStartX;
    const deltaY = touchY - touchStartY;

    if (!isSwiping && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        isSwiping = true;
        clearTimeout(longPressTimer);
    }

    if (isSwiping) {
        e.preventDefault();
        const screenWidth = window.innerWidth;
        const progress = deltaX / screenWidth;
        let translateX = deltaX;
        
        if (Math.abs(progress) > SWIPE_THRESHOLD_PAUSE && Math.abs(progress) < SWIPE_THRESHOLD_ACTION) {
            const sign = deltaX > 0 ? 1 : -1;
            const extra = Math.abs(deltaX) - (SWIPE_THRESHOLD_PAUSE * screenWidth);
            translateX = sign * (SWIPE_THRESHOLD_PAUSE * screenWidth + extra * 0.25);
        } else if (Math.abs(progress) >= SWIPE_THRESHOLD_ACTION) {
            const sign = deltaX > 0 ? 1 : -1;
            const baseAction = SWIPE_THRESHOLD_ACTION * screenWidth;
            const extra = Math.abs(deltaX) - baseAction;
            translateX = sign * (baseAction + extra * 0.1);
        }

        const content = currentSwipeItem.querySelector('.exercise-content, .template-content');
        content.style.transform = `translateX(${translateX}px)`;
        content.style.transition = 'none';

        const bgComplete = currentSwipeItem.querySelector('.swipe-bg-complete');
        const bgDelete = currentSwipeItem.querySelector('.swipe-bg-delete');

        if (deltaX > 0) {
            bgComplete.classList.add('active');
            bgDelete.classList.remove('active');
        } else {
            bgDelete.classList.add('active');
            bgComplete.classList.remove('active');
        }

        if (Math.abs(progress) >= SWIPE_THRESHOLD_ACTION) {
            if (!currentSwipeItem.classList.contains('swipe-ready')) {
                playTactileClick('hard');
                currentSwipeItem.classList.add('swipe-ready');
            }
        } else {
            currentSwipeItem.classList.remove('swipe-ready');
        }
    }
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (!currentSwipeItem || !isSwiping) {
        currentSwipeItem = null;
        return;
    }

    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const screenWidth = window.innerWidth;
    const progress = deltaX / screenWidth;
    const id = parseInt(currentSwipeItem.id.split('-').pop());
    const isExercise = currentSwipeItem.classList.contains('exercise-item');

    const content = currentSwipeItem.querySelector('.exercise-content, .template-content');
    content.style.transition = '';

    if (progress > SWIPE_THRESHOLD_ACTION) {
        if (isExercise) toggleExercise(id);
        else loadTemplateIntoRoutine(id); // Standardized Swipe Right for Template
    } else if (progress < -SWIPE_THRESHOLD_ACTION) {
        if (isExercise) deleteExercise(id);
        else deleteTemplate(id);
    }

    content.style.transform = '';
    currentSwipeItem.classList.remove('swipe-ready');
    
    const tempItem = currentSwipeItem;
    setTimeout(() => {
        if (tempItem) {
            tempItem.querySelectorAll('.swipe-bg').forEach(bg => bg.classList.remove('active'));
        }
    }, 400);

    currentSwipeItem = null;
    isSwiping = false;
}

// Exercise Operations
exerciseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    playTactileClick('hard');
    const nameInput = document.getElementById('exercise-name');
    const setsInput = document.getElementById('sets');
    const repsInput = document.getElementById('reps');
    
    const newExercise = {
        id: Date.now(),
        name: nameInput.value,
        sets: parseInt(setsInput.value),
        reps: parseInt(repsInput.value),
        completed: false
    };

    if (!exerciseHistory[selectedDate]) exerciseHistory[selectedDate] = [];
    lastAddedId = newExercise.id;
    exerciseHistory[selectedDate].push(newExercise);
    saveData();
    renderExercises();
    updateWeeklyProgress();
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
            updateWeeklyProgress();
        }, 600);
    } else {
        exerciseHistory[selectedDate] = workout.filter(ex => ex.id !== id);
        saveData();
        renderExercises();
        renderVolumeChart();
        updateQuickStats();
        updateWeeklyProgress();
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
    generateGrid(false);
    renderVolumeChart();
    updateQuickStats();
    updateWeeklyProgress();

    if (activity[activityDate] > previousActivity) pulseTodayGridCell();
    checkAllDone();
}

function updateExerciseDOM(id) {
    const workout = exerciseHistory[selectedDate] || [];
    const exercise = workout.find(ex => ex.id === id);
    const li = document.getElementById(`exercise-${id}`);
    if (li) {
        li.className = `exercise-item ${exercise.completed ? 'done-state' : ''}`;
        const info = li.querySelector('.exercise-info');
        if (exercise.completed) info.classList.add('done');
        else info.classList.remove('done');
    }
}

function renderExercises(isFocus = false) {
    const workout = exerciseHistory[selectedDate] || [];
    const container = exerciseList;
    
    if (workout.length === 0) {
        container.innerHTML = `<li style="text-align:center; padding: 2rem; color: var(--text-light); opacity: 0.5;">No exercises for this day</li>`;
        checkAllDone();
        return;
    }

    // Remove any non-exercise items (like the "No exercises" message)
    if (container.querySelector('li:not([id^="exercise-"])')) {
        container.innerHTML = '';
    }

    const currentIds = workout.map(ex => `exercise-${ex.id}`);
    
    // Remove items that are no longer in the list
    Array.from(container.children).forEach(child => {
        if (child.id && !currentIds.includes(child.id)) {
            child.remove();
        }
    });

    // Reset animations in one pass to avoid layout thrashing
    if (isFocus || lastAddedId) {
        workout.forEach(ex => {
            const li = document.getElementById(`exercise-${ex.id}`);
            if (li) li.style.animation = 'none';
        });
        void container.offsetHeight; // Force single reflow
    }

    workout.forEach((ex, index) => {
        const id = `exercise-${ex.id}`;
        let li = document.getElementById(id);
        const isNew = ex.id === lastAddedId;

        if (!li) {
            li = document.createElement('li');
            li.id = id;
            container.appendChild(li);
        }
        
        // Apply animations
        if (isFocus || isNew) {
            li.style.animation = '';
            li.style.animationDelay = isNew ? '0s' : `${index * 0.05}s`;
        } else if (!lastAddedId) {
            li.style.animationDelay = `${index * 0.05}s`;
        }
        
        li.className = `exercise-item ${ex.completed ? 'done-state' : ''} ${isNew ? 'new-item' : ''}`;
        
        const contentHtml = `
            <div class="swipe-bg swipe-bg-complete"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
            <div class="swipe-bg swipe-bg-delete"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg></div>
            <div class="exercise-content">
                <div class="exercise-info ${ex.completed ? 'done' : ''}">
                    <span class="exercise-name">${ex.name}</span>
                    <span class="exercise-details">${ex.sets} sets × ${ex.reps} reps</span>
                </div>
            </div>
        `;
        
        if (li.innerHTML !== contentHtml) {
            li.innerHTML = contentHtml;
        }

        // Maintain order
        if (container.children[index] !== li) {
            container.insertBefore(li, container.children[index]);
        }
    });

    lastAddedId = null; 
    checkAllDone();
}

// Template Management Logic
function openTemplateModal(templateId = null) {
    currentEditingTemplateId = templateId;
    templateExList.innerHTML = '';
    
    if (templateId) {
        const t = templates.find(temp => temp.id === templateId);
        templateNameInput.value = t.name;
        t.exercises.forEach(ex => addExerciseToTemplate(ex.name, ex.sets, ex.reps));
        document.getElementById('template-modal-title').innerText = 'Edit Template';
    } else {
        templateNameInput.value = '';
        addExerciseToTemplate(); 
        document.getElementById('template-modal-title').innerText = 'Create Template';
    }
    
    templateModal.classList.add('show');
    toggleDock(false);
    playTactileClick('soft');
}

function closeTemplateModal() {
    templateModal.classList.remove('show');
    toggleDock(true);
}

function addExerciseToTemplate(name = '', sets = '', reps = '') {
    const row = document.createElement('div');
    row.className = 'template-exercise-row';
    row.innerHTML = `
        <div class="neu-input-wrapper" style="flex: 3;">
            <input type="text" placeholder="Exercise" value="${name}" class="t-ex-name">
        </div>
        <div class="neu-input-wrapper" style="flex: 1;">
            <input type="number" placeholder="S" value="${sets}" class="t-ex-sets">
        </div>
        <div class="neu-input-wrapper" style="flex: 1;">
            <input type="number" placeholder="R" value="${reps}" class="t-ex-reps">
        </div>
        <button class="btn-icon" onclick="this.parentElement.remove()" style="box-shadow: none; color: var(--danger-color);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;
    templateExList.appendChild(row);
}

function saveTemplate() {
    const name = templateNameInput.value.trim();
    if (!name) return alert('Please enter a template name');
    const exRows = templateExList.querySelectorAll('.template-exercise-row');
    const exercises = [];
    exRows.forEach(row => {
        const exName = row.querySelector('.t-ex-name').value.trim();
        const exSets = parseInt(row.querySelector('.t-ex-sets').value);
        const exReps = parseInt(row.querySelector('.t-ex-reps').value);
        if (exName && exSets && exReps) {
            exercises.push({ name: exName, sets: exSets, reps: exReps });
        }
    });
    if (exercises.length === 0) return alert('Add at least one exercise');
    if (currentEditingTemplateId) {
        const index = templates.findIndex(t => t.id === currentEditingTemplateId);
        templates[index] = { ...templates[index], name, exercises };
    } else {
        templates.push({ id: Date.now(), name, exercises });
    }
    saveData(); renderTemplates(); closeTemplateModal(); playSuccessChime();
}

function deleteTemplate(id) {
    playTactileClick('soft');
    templates = templates.filter(t => t.id !== id);
    saveData();
    renderTemplates();
}

function renderTemplates() {
    templatesListUI.innerHTML = '';
    if (templates.length === 0) {
        templatesListUI.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-light); opacity: 0.5;">No templates created yet.</div>`;
        return;
    }

    templates.forEach((t, index) => {
        const div = document.createElement('div');
        div.className = 'template-item';
        div.id = `template-${t.id}`;
        div.style.animationDelay = `${index * 0.05}s`;
        div.innerHTML = `
            <div class="template-card-wrapper" style="position: relative; width: 100%;">
                <div class="swipe-bg swipe-bg-complete"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div>
                <div class="swipe-bg swipe-bg-delete"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg></div>
                <div class="template-content" onclick="toggleTemplatePreview(${t.id}, this)">
                    <div class="template-info">
                        <span class="template-name">${t.name}</span>
                        <span class="template-meta">${t.exercises.length} Exercises</span>
                    </div>
                </div>
            </div>
            <div class="template-preview" id="preview-${t.id}"></div>
        `;
        templatesListUI.appendChild(div);
    });
}

function toggleTemplatePreview(id, element) {
    if (isSwiping) return; // Don't toggle if we were swiping
    playTactileClick('soft');
    const preview = document.getElementById(`preview-${id}`);
    const isShowing = preview.classList.contains('show');
    
    // Close others
    document.querySelectorAll('.template-preview.show').forEach(p => p.classList.remove('show'));
    
    if (!isShowing) {
        const t = templates.find(temp => temp.id === id);
        preview.innerHTML = t.exercises.map(ex => `
            <div class="preview-ex-item">
                <span class="preview-ex-name">${ex.name}</span>
                <span class="preview-ex-details">${ex.sets}s × ${ex.reps}r</span>
            </div>
        `).join('');
        preview.classList.add('show');
    }
}

// Workout Screen Template Actions
function saveCurrentAsTemplate() {
    const workout = exerciseHistory[selectedDate] || [];
    if (workout.length === 0) return alert('Nothing to save. Add some exercises first!');
    const name = prompt('Enter a name for this template:', `Template ${new Date().toLocaleDateString()}`);
    if (!name) return;
    templates.push({
        id: Date.now(),
        name: name,
        exercises: workout.map(ex => ({ name: ex.name, sets: ex.sets, reps: ex.reps }))
    });
    saveData(); playSuccessChime();
}

function openLoadTemplateModal() {
    loadTemplatesListUI.innerHTML = '';
    if (templates.length === 0) {
        loadTemplatesListUI.innerHTML = `<p style="text-align:center; padding: 1rem;">No templates found.</p>`;
    } else {
        templates.forEach(t => {
            const card = document.createElement('div');
            card.className = 'load-template-card';
            card.innerHTML = `<div><strong>${t.name}</strong><small style="display:block;color:var(--text-light);">${t.exercises.length} Exercises</small></div><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            card.onclick = () => loadTemplateIntoRoutine(t.id);
            loadTemplatesListUI.appendChild(card);
        });
    }
    loadTemplateModal.classList.add('show');
    toggleDock(false);
    playTactileClick('soft');
}

function closeLoadTemplateModal() { 
    loadTemplateModal.classList.remove('show'); 
    toggleDock(true);
}

function loadTemplateIntoRoutine(templateId) {
    const t = templates.find(temp => temp.id === templateId);
    if (!exerciseHistory[selectedDate]) exerciseHistory[selectedDate] = [];

    // Use a timestamp based seed and increment it for each exercise to ensure uniqueness and delete-ability
    const baseId = Date.now();
    t.exercises.forEach((ex, index) => {
        exerciseHistory[selectedDate].push({
            id: baseId + index, // Sequential IDs starting from now
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            completed: false
        });
    });

    saveData();
    renderExercises();
    closeLoadTemplateModal();
    playSuccessChime();

    // Reset swipe state if triggered via swipe
    if (currentSwipeItem && currentSwipeItem.classList.contains('template-item')) {
        const content = currentSwipeItem.querySelector('.template-content');
        content.style.transform = '';
    }
}

// Visuals & Helpers
function checkAllDone() {
    const workout = exerciseHistory[selectedDate] || [];
    const allDone = workout.length > 0 && workout.every(ex => ex.completed);
    const shareContainer = document.getElementById('share-container');
    const workoutScreen = document.getElementById('screen-workout');
    if (allDone) {
        if (selectedDate === getTodayString() && !workoutScreen.classList.contains('victory-achieved')) {
            triggerConfetti(); playSuccessChime(); workoutScreen.classList.add('victory-achieved');
        }
        shareContainer.classList.add('show');
    } else {
        workoutScreen.classList.remove('victory-achieved');
        shareContainer.classList.remove('show');
    }
}

function renderVolumeChart() {
    const container = document.getElementById('volume-chart');
    if (!container) return;
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateStr = getDateString(d);
        last7Days.push({ date: dateStr, label: d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0), volume: activity[dateStr] || 0 });
    }
    const maxVolume = Math.max(...last7Days.map(d => d.volume), 100);
    
    const existingBars = container.querySelectorAll('.chart-bar-wrapper');
    const needsCreation = existingBars.length === 0;

    // Reset bars first to avoid layout thrashing
    if (!needsCreation) {
        existingBars.forEach(wrapper => {
            const bar = wrapper.querySelector('.chart-bar');
            bar.style.transition = 'none';
            bar.style.height = '0%';
        });
        // Force a single reflow
        void container.offsetHeight;
    }

    last7Days.forEach((day, i) => {
        const heightPercent = (day.volume / maxVolume) * 100;
        let bar;

        if (needsCreation) {
            const wrapper = document.createElement('div');
            wrapper.className = 'chart-bar-wrapper';
            bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = '0%';
            const label = document.createElement('div');
            label.className = 'chart-label'; label.innerText = day.label;
            wrapper.appendChild(bar); wrapper.appendChild(label); container.appendChild(wrapper);
        } else {
            bar = existingBars[i].querySelector('.chart-bar');
            bar.style.transition = '';
        }

        bar.title = `${day.date}: ${day.volume} reps`;
        // Use requestAnimationFrame for smoother timing
        requestAnimationFrame(() => {
            bar.style.height = `${Math.max(heightPercent, 5)}%`;
        });
    });
}

function generateGrid(isInitial = false) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const tempDate = new Date(startDate);
    
    // Check if grid already has cells
    const existingCells = streakGrid.querySelectorAll('.cell');
    const needsCreation = existingCells.length === 0;

    for (let i = 0; i < 371; i++) {
        const dateStr = getDateString(tempDate);
        const count = activity[dateStr] || 0;
        
        if (needsCreation) {
            const cell = document.createElement('div');
            cell.className = 'cell ' + getLevelClass(count);
            if (dateStr === getTodayString()) cell.id = 'today-cell';
            streakGrid.appendChild(cell);
        } else {
            const cell = existingCells[i];
            cell.className = 'cell ' + getLevelClass(count);
            if (dateStr === getTodayString()) cell.id = 'today-cell';
        }
        tempDate.setDate(tempDate.getDate() + 1);
    }
}

function getLevelClass(count) {
    if (count === 0) return 'level-0';
    if (count < 20) return 'level-1';
    if (count < 50) return 'level-2';
    if (count < 100) return 'level-3';
    return 'level-4';
}

function scrollToToday() {
    const todayCell = document.getElementById('today-cell');
    const gridWrapper = document.getElementById('grid-wrapper');
    if (todayCell && gridWrapper) {
        const rect = todayCell.getBoundingClientRect();
        const wrapperRect = gridWrapper.getBoundingClientRect();
        gridWrapper.scrollLeft += (rect.left - wrapperRect.left) - (wrapperRect.width / 2);
    }
}

function pulseTodayGridCell() {
    const cell = document.getElementById('today-cell');
    if (cell) { cell.classList.remove('pulse'); void cell.offsetWidth; cell.classList.add('pulse'); }
}

function startTimer() {
    const overlay = document.getElementById('rest-timer-overlay');
    const display = document.getElementById('timer-display');
    const progress = document.getElementById('timer-progress');
    let timeLeft = 60;
    stopTimer();
    overlay.style.display = 'flex';
    display.innerText = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--; display.innerText = timeLeft;
        progress.style.strokeDashoffset = 226 - (timeLeft / 60) * 226;
        if (timeLeft <= 0) { stopTimer(); playSuccessChime(); }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    const overlay = document.getElementById('rest-timer-overlay');
    if (overlay) overlay.style.display = 'none';
}

function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    let particles = [];
    const colors = ['#6c5ce7', '#a29bfe', '#fab1a0', '#ff7675', '#fd79a8'];
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width, y: canvas.height + 50, radius: Math.random() * 5 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: Math.random() * 4 - 2, vy: -Math.random() * 15 - 10, gravity: 0.3
        });
    }
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
            if (p.y < canvas.height) {
                alive = true; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color; ctx.fill();
            }
        });
        if (alive) requestAnimationFrame(animate);
    }
    animate();
}

async function shareProgress() {
    const btn = document.getElementById('share-btn');
    const originalText = btn.innerHTML;
    btn.innerText = "Generating Sticker...";
    btn.disabled = true;

    // Recalculate streak for accuracy
    const today = getTodayString();
    let currentStreak = 0;
    const streakTempDate = new Date();
    while (true) {
        const dateStr = getDateString(streakTempDate);
        if (activity[dateStr] && activity[dateStr] > 0) {
            currentStreak++;
            streakTempDate.setDate(streakTempDate.getDate() - 1);
        } else {
            if (dateStr === today && currentStreak === 0) {
                streakTempDate.setDate(streakTempDate.getDate() - 1);
                const yesterdayStr = getDateString(streakTempDate);
                if (!(activity[yesterdayStr] > 0)) break;
                else continue; 
            }
            break;
        }
    }

    // Populate Template
    const todayFullDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    document.getElementById('sticker-date').innerText = todayFullDate;
    document.getElementById('sticker-streak').innerText = currentStreak;
    document.getElementById('sticker-volume').innerText = (activity[today] || 0).toLocaleString();

    const stickerExList = document.getElementById('sticker-exercises');
    stickerExList.innerHTML = '';
    const workout = exerciseHistory[today] || [];
    
    if (workout.length === 0) {
        stickerExList.innerHTML = '<li class="sticker-ex-item" style="justify-content:center; opacity:0.5;">No exercises logged today</li>';
    } else {
        workout.forEach(ex => {
            const li = document.createElement('li');
            li.className = 'sticker-ex-item';
            li.innerHTML = `
                <span class="sticker-ex-name">${ex.name}</span>
                <span class="sticker-ex-sets">${ex.sets} × ${ex.reps}</span>
            `;
            stickerExList.appendChild(li);
        });
    }

    // Capture using html2canvas
    setTimeout(async () => {
        try {
            const template = document.getElementById('sticker-template');
            const canvas = await html2canvas(template, {
                backgroundColor: null,
                scale: 2, // High resolution
                logging: false,
                useCORS: true
            });

            const dataUrl = canvas.toDataURL('image/png');
            const fileName = `workout-receipt-${today}.png`;

            // Try direct sharing via Web Share API
            if (navigator.canShare && navigator.share) {
                try {
                    const blob = await (await fetch(dataUrl)).blob();
                    const file = new File([blob], fileName, { type: 'image/png' });

                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'FitLogr Receipt',
                            text: 'Check out my routine today!'
                        });
                        // If share succeeds, we don't necessarily need to download
                    } else {
                        throw new Error('Share not supported for this file');
                    }
                } catch (shareErr) {
                    console.warn('Direct share failed, falling back to download:', shareErr);
                    const link = document.createElement('a');
                    link.download = fileName;
                    link.href = dataUrl;
                    link.click();
                }
            } else {
                // Standard fallback for desktop/unsupported browsers
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
            }

            btn.innerHTML = originalText;
            btn.disabled = false;
            triggerConfetti();
            playSuccessChime();
        } catch (e) {
            console.error('Sticker Generation Error:', e);
            btn.innerText = "Error!";
            setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000);
        }
    }, 100);
}

function openEditModal(id) {
    const workout = exerciseHistory[selectedDate] || [];
    const ex = workout.find(e => e.id === id);
    currentEditId = id;
    editNameInput.value = ex.name;
    editSetsInput.value = ex.sets;
    editRepsInput.value = ex.reps;
    editModal.classList.add('show');
    toggleDock(false);
}

saveEditBtn.onclick = () => {
    const workout = exerciseHistory[selectedDate] || [];
    const ex = workout.find(e => e.id === currentEditId);
    ex.name = editNameInput.value;
    ex.sets = parseInt(editSetsInput.value);
    ex.reps = parseInt(editRepsInput.value);
    saveData(); renderExercises(); renderVolumeChart(); updateQuickStats();
    editModal.classList.remove('show');
    toggleDock(true);
    playTactileClick('hard');
};

cancelEditBtn.onclick = () => {
    editModal.classList.remove('show');
    toggleDock(true);
};

// Global Exposure
window.switchScreen = switchScreen;
window.toggleExercise = toggleExercise;
window.deleteExercise = deleteExercise;
window.openEditModal = openEditModal;
window.openTemplateModal = openTemplateModal;
window.closeTemplateModal = closeTemplateModal;
window.addExerciseToTemplate = addExerciseToTemplate;
window.saveTemplate = saveTemplate;
window.deleteTemplate = deleteTemplate;
window.saveCurrentAsTemplate = saveCurrentAsTemplate;
window.openLoadTemplateModal = openLoadTemplateModal;
window.closeLoadTemplateModal = closeLoadTemplateModal;
window.shareProgress = shareProgress;
window.stopTimer = stopTimer;
window.toggleTemplatePreview = toggleTemplatePreview;

function toggleDock(visible) {
    const tabBar = document.querySelector('.tab-bar');
    if (visible) tabBar.classList.remove('dock-hidden');
    else tabBar.classList.add('dock-hidden');
}

function showStatInfo(type) {
    const modal = document.getElementById('stat-info-modal');
    const title = document.getElementById('stat-info-title');
    const text = document.getElementById('stat-info-text');

    const info = {
        streak: {
            title: 'Day Streak',
            text: 'The number of consecutive days you have logged at least one exercise. Rest days will break the streak!'
        },
        lifetime: {
            title: 'Total Reps',
            text: 'Your lifetime cumulative total of all repetitions across all exercises logged in the app.'
        },
        pr: {
            title: 'Personal Best',
            text: 'The maximum total volume (total reps) you have ever completed in a single day.'
        },
        avg: {
            title: 'Daily Avg',
            text: 'Your average daily volume (reps) calculated over the last 30 days, including any rest days.'
        }
    };

    if (info[type]) {
        title.innerText = info[type].title;
        text.innerText = info[type].text;
        modal.classList.add('show');
        toggleDock(false);
        playTactileClick('soft');
    }
}

function closeStatInfo() {
    document.getElementById('stat-info-modal').classList.remove('show');
    toggleDock(true);
    playTactileClick('soft');
}

function openWeeklyGoalModal() {
    const modal = document.getElementById('weekly-goal-modal');
    document.getElementById('weekly-goal-display').innerText = weeklyGoal;
    modal.classList.add('show');
    toggleDock(false);
    playTactileClick('soft');
}

function closeWeeklyGoalModal() {
    document.getElementById('weekly-goal-modal').classList.remove('show');
    toggleDock(true);
    playTactileClick('soft');
    saveData();
    updateWeeklyProgress();
}

function adjustWeeklyGoal(amount) {
    weeklyGoal = Math.max(1, Math.min(7, weeklyGoal + amount));
    document.getElementById('weekly-goal-display').innerText = weeklyGoal;
    playTactileClick('soft');
}

function updateWeeklyProgress() {
    const now = new Date();
    const day = now.getDay(); 
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    let workoutsThisWeek = 0;
    Object.keys(activity).forEach(dateStr => {
        // Date string is YYYY-MM-DD
        const parts = dateStr.split('-');
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        if (d >= monday && activity[dateStr] > 0) {
            workoutsThisWeek++;
        }
    });

    const progress = Math.min((workoutsThisWeek / weeklyGoal) * 100, 100);

    // Update the Stats screen badge
    const badgeText = document.getElementById('weekly-progress-text');
    if (badgeText) {
        badgeText.innerText = `${workoutsThisWeek} / ${weeklyGoal}`;
    }
}

window.showStatInfo = showStatInfo;
window.closeStatInfo = closeStatInfo;
window.adjustWeeklyGoal = adjustWeeklyGoal;
window.closeWeeklyGoalModal = closeWeeklyGoalModal;

init();
