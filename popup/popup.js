// Enhanced timer with Pomodoro technique
const settings = {
  focusDuration: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
  sessionsBeforeLongBreak: 4,
  blockedSites: ['facebook.com', 'instagram.com', 'twitter.com', 'youtube.com', 'reddit.com']
};

let state = {
  timer: settings.focusDuration,
  isRunning: false,
  isFocus: true,
  sessionCount: 0,
  totalSessions: 0,
  interval: null,
  darkMode: false
};

// DOM Elements
const elements = {
  timer: document.getElementById("timer"),
  startBtn: document.getElementById("startBtn"),
  status: document.getElementById("status"),
  progress: document.getElementById("progressCircle"),
  streak: document.getElementById("streak"),
  badge: document.getElementById("badge"),
  sessionCount: document.getElementById("sessionCount"),
  themeToggle: document.getElementById("themeToggle")
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadState();
  updateUI();
  initSounds();
  initChart();
  displayNotes();
  loadTasks();
  updateMotivationalQuote();
  checkThemePreference();
});

// Timer functions
function startTimer() {
  if (state.interval) clearInterval(state.interval);
  
  state.isRunning = true;
  state.interval = setInterval(() => {
    state.timer--;
    updateUI();
    
    if (state.timer <= 0) {
      handleSessionEnd();
    }
    
    saveState();
  }, 1000);
  
  chrome.runtime.sendMessage({ action: "startSession" });
  elements.startBtn.textContent = "Pause";
}

function pauseTimer() {
  clearInterval(state.interval);
  state.isRunning = false;
  state.interval = null;
  elements.startBtn.textContent = "Resume";
  chrome.runtime.sendMessage({ action: "endSession" });
}

function resetTimer() {
  clearInterval(state.interval);
  state.isRunning = false;
  state.interval = null;
  state.timer = state.isFocus ? settings.focusDuration : 
                (state.sessionCount % settings.sessionsBeforeLongBreak === 0 ? 
                 settings.longBreak : settings.shortBreak);
  updateUI();
  elements.startBtn.textContent = "Start";
  chrome.runtime.sendMessage({ action: "endSession" });
}

function handleSessionEnd() {
  clearInterval(state.interval);
  state.isRunning = false;
  
  if (state.isFocus) {
    state.totalSessions++;
    state.sessionCount++;
    updateStreak();
    updateBadge();
    playSound('success');
    showNotification("Focus session complete!", "Time for a break");
  } else {
    playSound('alert');
    showNotification("Break over!", "Ready for another focus session?");
  }
  
  state.isFocus = !state.isFocus;
  state.timer = state.isFocus ? settings.focusDuration : 
               (state.sessionCount % settings.sessionsBeforeLongBreak === 0 ? 
                settings.longBreak : settings.shortBreak);
  
  saveState();
  updateUI();
}

// UI Updates
function updateUI() {
  const minutes = Math.floor(state.timer / 60);
  const seconds = state.timer % 60;
  elements.timer.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  
  elements.status.textContent = state.isFocus ? 
    `Focus Session (${state.sessionCount % settings.sessionsBeforeLongBreak + 1}/${settings.sessionsBeforeLongBreak})` : 
    "Break Time";
  
  updateProgressCircle();
}

function updateProgressCircle() {
  const totalTime = state.isFocus ? settings.focusDuration : 
                   (state.sessionCount % settings.sessionsBeforeLongBreak === 0 ? 
                    settings.longBreak : settings.shortBreak);
  const percentage = (1 - state.timer / totalTime) * 100;
  elements.progress.style.background = `conic-gradient(var(--primary) ${percentage}%, var(--border-color) ${percentage}%)`;
}

// State management
function saveState() {
  chrome.storage.local.set({
    timerState: {
      ...state,
      timestamp: Date.now()
    },
    totalSessions: state.totalSessions,
    sessionCount: state.sessionCount
  });
}

function loadState() {
  chrome.storage.local.get(['timerState', 'totalSessions', 'sessionCount', 'darkMode'], (result) => {
    if (result.timerState) {
      const savedState = result.timerState;
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - savedState.timestamp) / 1000);
      
      state = {
        ...savedState,
        timer: Math.max(savedState.timer - elapsedSeconds, 0),
        interval: null,
        isRunning: false
      };
      
      if (state.timer <= 0) {
        handleSessionEnd();
      }
    }
    
    if (result.totalSessions) state.totalSessions = result.totalSessions;
    if (result.sessionCount) state.sessionCount = result.sessionCount;
    if (result.darkMode !== undefined) {
      state.darkMode = result.darkMode;
      toggleTheme(state.darkMode);
    }
    
    updateUI();
    updateStreakDisplay();
    updateBadgeDisplay();
  });
}

// Settings management
function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      Object.assign(settings, result.settings);
      document.getElementById("focusDuration").value = settings.focusDuration / 60;
      document.getElementById("shortBreak").value = settings.shortBreak / 60;
      document.getElementById("longBreak").value = settings.longBreak / 60;
      document.getElementById("sessionsBeforeLongBreak").value = settings.sessionsBeforeLongBreak;
      document.getElementById("blockedSites").value = settings.blockedSites.join(', ');
    }
  });
}

function saveSettings() {
  settings.focusDuration = parseInt(document.getElementById("focusDuration").value) * 60;
  settings.shortBreak = parseInt(document.getElementById("shortBreak").value) * 60;
  settings.longBreak = parseInt(document.getElementById("longBreak").value) * 60;
  settings.sessionsBeforeLongBreak = parseInt(document.getElementById("sessionsBeforeLongBreak").value);
  settings.blockedSites = document.getElementById("blockedSites").value
    .split(',')
    .map(site => site.trim())
    .filter(site => site.length > 0);
  
  chrome.storage.local.set({ settings });
  chrome.runtime.sendMessage({ 
    action: "updateBlockedSites", 
    sites: settings.blockedSites 
  });
  
  if (!state.isRunning) {
    state.timer = state.isFocus ? settings.focusDuration : 
                 (state.sessionCount % settings.sessionsBeforeLongBreak === 0 ? 
                  settings.longBreak : settings.shortBreak);
    updateUI();
  }
}

// Theme management
function checkThemePreference() {
  chrome.storage.local.get(['darkMode'], (result) => {
    if (result.darkMode !== undefined) {
      state.darkMode = result.darkMode;
      toggleTheme(state.darkMode);
    } else {
      // Default to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      toggleTheme(prefersDark);
    }
  });
}

function toggleTheme(enableDark) {
  state.darkMode = enableDark;
  document.body.classList.toggle('dark-mode', enableDark);
  elements.themeToggle.textContent = enableDark ? '☀️' : '🌙';
  chrome.storage.local.set({ darkMode: enableDark });
}

// Enhanced streak system
function updateStreak() {
  const today = new Date().toDateString();
  
  chrome.storage.local.get(['streak'], (result) => {
    let streak = result.streak || { lastDate: null, count: 0, longest: 0 };
    
    if (streak.lastDate === today) return;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    if (streak.lastDate === yesterdayStr) {
      streak.count++;
    } else if (!streak.lastDate) {
      streak.count = 1;
    } else {
      streak.count = 1;
    }
    
    streak.longest = Math.max(streak.longest, streak.count);
    streak.lastDate = today;
    
    chrome.storage.local.set({ streak }, () => {
      updateStreakDisplay();
    });
  });
}

function updateStreakDisplay() {
  chrome.storage.local.get(['streak'], (result) => {
    const streak = result.streak || { count: 0, longest: 0 };
    elements.streak.innerHTML = `
      <div>🔥 Current Streak: ${streak.count} days</div>
      <div>🏆 Longest Streak: ${streak.longest} days</div>
    `;
  });
}

// Enhanced badge system
function updateBadge() {
  chrome.storage.local.get(['badges'], (result) => {
    const badges = result.badges || {
      focusSessions: 0,
      level: "Newbie",
      achievements: []
    };
    
    badges.focusSessions = state.totalSessions;
    
    // Achievement system
    const newAchievements = [];
    if (badges.focusSessions >= 100 && !badges.achievements.includes("Centurion")) {
      newAchievements.push("Centurion");
    }
    if (badges.focusSessions >= 50 && !badges.achievements.includes("Half Century")) {
      newAchievements.push("Half Century");
    }
    if (badges.focusSessions >= 10 && !badges.achievements.includes("Decathlete")) {
      newAchievements.push("Decathlete");
    }
    
    if (newAchievements.length > 0) {
      badges.achievements = [...badges.achievements, ...newAchievements];
      showNotification("Achievement Unlocked!", `You earned: ${newAchievements.join(", ")}`);
    }
    
    // Level system
    if (badges.focusSessions >= 30) badges.level = "Focus Master";
    else if (badges.focusSessions >= 10) badges.level = "Achiever";
    else if (badges.focusSessions >= 1) badges.level = "Starter";
    
    chrome.storage.local.set({ badges }, () => {
      updateBadgeDisplay();
    });
  });
}

function updateBadgeDisplay() {
  chrome.storage.local.get(['badges'], (result) => {
    const badges = result.badges || {
      focusSessions: 0,
      level: "Newbie",
      achievements: []
    };
    
    elements.badge.innerHTML = `
      <div>🏅 Level: ${badges.level}</div>
      <div>📊 Sessions: ${badges.focusSessions}</div>
      ${badges.achievements.length > 0 ? 
       `<div>🏆 Achievements: ${badges.achievements.join(", ")}</div>` : ''}
    `;
    
    elements.sessionCount.textContent = badges.focusSessions;
  });
}

// Motivational quotes
function updateMotivationalQuote() {
  const quotes = [
    "The secret of getting ahead is getting started.",
    "Focus on being productive instead of busy.",
    "You don't have to be great to start, but you have to start to be great.",
    "Concentrate all your thoughts upon the work at hand.",
    "The successful warrior is the average man, with laser-like focus.",
    "Productivity is never an accident. It's always the result of commitment to excellence.",
    "The way to get started is to quit talking and begin doing.",
    "Your focus determines your reality.",
    "The more you use your brain, the more brain you will have to use.",
    "The future depends on what you do today."
  ];
  
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  document.getElementById("quote").textContent = `"${randomQuote}"`;
}

// Notification helper
function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title,
    message,
    priority: 2
  });
}

// Sound system
function initSounds() {
  const sounds = {
    rain: "https://www.soundjay.com/nature/rain-01.mp3",
    white: "https://www.soundjay.com/white-noise/white-noise-1.mp3",
    calm: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    success: "https://www.soundjay.com/buttons/sounds/button-09.mp3",
    alert: "https://www.soundjay.com/buttons/sounds/button-10.mp3"
  };
  
  window.sounds = {};
  Object.keys(sounds).forEach(key => {
    window.sounds[key] = new Audio(sounds[key]);
    window.sounds[key].load();
  });
}

function playSound(type) {
  if (window.sounds && window.sounds[type]) {
    window.sounds[type].currentTime = 0;
    window.sounds[type].play().catch(e => console.error("Error playing sound:", e));
  }
}

// Task system
function loadTasks() {
  chrome.storage.local.get(['tasks'], (result) => {
    const tasks = result.tasks || [];
    const taskList = document.getElementById("taskList");
    taskList.innerHTML = "";
    
    tasks.forEach((task, index) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <input type="checkbox" ${task.completed ? 'checked' : ''} data-id="${index}">
        <span class="${task.completed ? 'completed' : ''}">${task.text}</span>
        <button class="delete-task" data-id="${index}">Delete</button>
      `;
      taskList.appendChild(li);
    });
    
    // Add event listeners
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', toggleTaskComplete);
    });
    
    document.querySelectorAll('.delete-task').forEach(button => {
      button.addEventListener('click', deleteTask);
    });
  });
}

function addTask() {
  const input = document.getElementById("taskInput");
  const text = input.value.trim();
  
  if (text) {
    chrome.storage.local.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      tasks.push({ text, completed: false });
      chrome.storage.local.set({ tasks }, loadTasks);
    });
    input.value = "";
  }
}

function toggleTaskComplete(e) {
  const id = e.target.getAttribute('data-id');
  chrome.storage.local.get(['tasks'], (result) => {
    const tasks = result.tasks || [];
    tasks[id].completed = !tasks[id].completed;
    chrome.storage.local.set({ tasks }, loadTasks);
  });
}

function deleteTask(e) {
  const id = e.target.getAttribute('data-id');
  chrome.storage.local.get(['tasks'], (result) => {
    const tasks = result.tasks || [];
    tasks.splice(id, 1);
    chrome.storage.local.set({ tasks }, loadTasks);
  });
}

// Note system
function saveNote() {
  const textarea = document.getElementById("noteInput");
  const text = textarea.value.trim();
  
  if (text) {
    chrome.storage.local.get(['notes'], (result) => {
      const notes = result.notes || [];
      notes.push({ 
        text, 
        time: new Date().toLocaleString(),
        session: state.totalSessions + 1
      });
      chrome.storage.local.set({ notes }, displayNotes);
    });
    textarea.value = "";
  }
}

function displayNotes() {
  chrome.storage.local.get(['notes'], (result) => {
    const notes = result.notes || [];
    const notesList = document.getElementById("notesList");
    notesList.innerHTML = "";
    
    notes.slice().reverse().forEach((note, index) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="note-time">Session #${note.session} - ${note.time}</div>
        <div class="note-text">${note.text}</div>
        <button class="delete-note" data-id="${notes.length - 1 - index}">Delete</button>
      `;
      notesList.appendChild(li);
    });
    
    document.querySelectorAll('.delete-note').forEach(button => {
      button.addEventListener('click', deleteNote);
    });
  });
}

function deleteNote(e) {
  const id = e.target.getAttribute('data-id');
  chrome.storage.local.get(['notes'], (result) => {
    const notes = result.notes || [];
    notes.splice(id, 1);
    chrome.storage.local.set({ notes }, displayNotes);
  });
}

// Productivity chart
function initChart() {
  chrome.storage.local.get(['productivityData'], (result) => {
    const data = result.productivityData || generateSampleData();
    renderChart(data);
  });
}

function generateSampleData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = days.map(day => ({
    day,
    sessions: Math.floor(Math.random() * 10) + 1,
    minutes: Math.floor(Math.random() * 300) + 60
  }));
  
  chrome.storage.local.set({ productivityData: data });
  return data;
}

function renderChart(data) {
  const ctx = document.getElementById('productivityChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(item => item.day),
      datasets: [
        {
          label: 'Sessions',
          data: data.map(item => item.sessions),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        },
        {
          label: 'Minutes',
          data: data.map(item => item.minutes),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          type: 'line',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Sessions'
          }
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          title: {
            display: true,
            text: 'Minutes'
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    }
  });
}

// Event listeners
elements.startBtn.addEventListener('click', () => {
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

document.getElementById("resetBtn").addEventListener('click', resetTimer);
document.getElementById("addTask").addEventListener('click', addTask);
document.getElementById("saveNote").addEventListener('click', saveNote);
document.getElementById("playSound").addEventListener('click', () => {
  const type = document.getElementById("soundSelect").value;
  if (type !== 'none') playSound(type);
});
document.getElementById("stopSound").addEventListener('click', () => {
  Object.values(window.sounds).forEach(sound => sound.pause());
});

// Theme toggle
elements.themeToggle.addEventListener('click', () => {
  toggleTheme(!state.darkMode);
});

// Settings modal
document.getElementById("settingsBtn").addEventListener('click', () => {
  document.getElementById("settingsModal").style.display = "block";
});

document.getElementById("closeSettings").addEventListener('click', () => {
  document.getElementById("settingsModal").style.display = "none";
});

document.getElementById("saveSettings").addEventListener('click', () => {
  saveSettings();
  document.getElementById("settingsModal").style.display = "none";
});