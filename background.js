// State management
let sessionActive = false;
let lastActivityTime = Date.now();
let blockedSites = ['facebook.com', 'instagram.com', 'twitter.com', 'youtube.com', 'reddit.com'];

// Load blocked sites from storage
chrome.storage.local.get(['blockedSites'], (result) => {
  if (result.blockedSites) {
    blockedSites = result.blockedSites;
  }
});

// Monitor user activity
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "idle" && sessionActive) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "FocusBuddy Alert",
      message: "You've been idle during a focus session!",
      priority: 2
    });
  }
});

// Block distracting sites during focus sessions
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!sessionActive) return;
  
  const url = new URL(details.url);
  const isBlocked = blockedSites.some(site => url.hostname.includes(site));
  
  if (isBlocked) {
    chrome.tabs.update(details.tabId, {url: "blocked.html"});
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "FocusBuddy Blocked",
      message: "This site is blocked during focus sessions",
      priority: 2
    });
  }
});

// Session management
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "startSession":
      sessionActive = true;
      lastActivityTime = Date.now();
      break;
    case "endSession":
      sessionActive = false;
      break;
    case "getSessionStatus":
      sendResponse({ active: sessionActive });
      break;
    case "getTimerState":
      sendResponse({ timer: request.timer, isFocus: request.isFocus });
      break;
    case "updateBlockedSites":
      blockedSites = request.sites;
      chrome.storage.local.set({ blockedSites });
      break;
  }
});

// Daily reminder
chrome.alarms.create("dailyReminder", {
  when: getNext8AM(),
  periodInMinutes: 1440 // 24 hours
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyReminder") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Daily Focus Check-in",
      message: "Ready to crush your goals today? Start a focus session!",
      priority: 2
    });
  }
});

function getNext8AM() {
  const now = new Date();
  const next8AM = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    8, 0, 0
  );
  if (now > next8AM) {
    next8AM.setDate(next8AM.getDate() + 1);
  }
  return next8AM.getTime();
}