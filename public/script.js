const SERVER_URL = "https://alarm-socket-server.onrender.com"; 
const socket = io(SERVER_URL);

let localPrefs = { currentProfile: "Default", sortOrder: "earliest", cardSize: 1, followMode: false };
let cloudData = { profiles: { "Default": [] }, lastModified: "Never" };

let currentServerVersion = null;
let editingAlarmId = null;
let ringTimeout = null;
let currentNextAlarmId = null;
let fadeInterval = null;
let emergencyBeepInterval = null;

// --- DYNAMIC VISUALIZER STATE ---
let visualizerActive = false;
let particleCanvas, ctx, animationFrameId;
let currentVizInstance = null;
let currentVizName = 'tetris_effect'; 

// --- SOCKET INITIALIZATION ---
socket.on('connect', () => console.log("Connected to cloud!"));

socket.on('server-version', (version) => {
    if (currentServerVersion === null) {
        currentServerVersion = version;
    } else if (currentServerVersion !== version) {
        document.getElementById('syncStatus').innerHTML = "Sync: <span style='color:var(--warning)'>UPDATING...</span>";
        setTimeout(() => window.location.reload(true), 1000); 
    }
});

socket.on('init-data', (serverData) => {
    document.getElementById('syncStatus').innerHTML = "Sync: <span style='color:var(--success)'>⚡ LIVE</span>";
    if (serverData.profiles) { cloudData = serverData; refreshUI(); }
});

socket.on('sync-update', (serverData) => {
    const header = document.getElementById('mainHeader');
    header.style.backgroundColor = '#334155';
    setTimeout(() => header.style.backgroundColor = '', 300);
    if (serverData.profiles) { cloudData = serverData; refreshUI(); }
});

socket.on('available-sounds', (sounds) => {
    const select = document.getElementById('alarmSound');
    const currentVal = select.value; 
    select.innerHTML = ''; 
    sounds.forEach(sound => {
        const opt = document.createElement('option');
        opt.value = sound.url; opt.textContent = sound.name;
        select.appendChild(opt);
    });
    if (currentVal && sounds.find(s => s.url === currentVal)) select.value = currentVal;
});

socket.on('disconnect', () => {
    document.getElementById('syncStatus').innerHTML = "Sync: <span style='color:var(--danger)'>OFFLINE</span>";
});

function init() {
    startClock();
    const savedPrefs = localStorage.getItem('alarm_local_prefs');
    if (savedPrefs) {
        localPrefs = JSON.parse(savedPrefs);
        if (localPrefs.cardSize > 3) localPrefs.cardSize = 3; 
    }

    document.getElementById('sortOrder').value = localPrefs.sortOrder;
    document.getElementById('sizeSlider').value = localPrefs.cardSize;
    updateGridSize(localPrefs.cardSize);
    updateFollowUI();

    document.body.addEventListener('click', enableMobileAudio, { once: true });
    document.body.addEventListener('touchstart', enableMobileAudio, { once: true });

    window.addEventListener('wheel', disableFollowOnInteraction);
    window.addEventListener('touchmove', disableFollowOnInteraction);
    window.addEventListener('keydown', (e) => { if(e.key.startsWith('Arrow')) disableFollowOnInteraction(); });
    
    const header = document.querySelector('.sticky-header');
    const observer = new IntersectionObserver(([e]) => e.target.classList.toggle('is-sticky', e.intersectionRatio < 1), { threshold: [1] });
    observer.observe(header);
    
    particleCanvas = document.getElementById('particleCanvas');
    ctx = particleCanvas.getContext('2d');
    window.addEventListener('resize', resizeCanvas);
}

function enableMobileAudio() {
    const audio = document.getElementById('mainAlarmAudio');
    audio.src = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'; 
    audio.volume = 0;
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.volume = 1; }).catch(e => console.log("Audio unlock failed"));
}

function refreshUI() {
    if (!cloudData.profiles[localPrefs.currentProfile]) {
        localPrefs.currentProfile = "Default";
        if (!cloudData.profiles["Default"]) cloudData.profiles["Default"] = [];
        saveLocalPrefs();
    }
    renderAlarms();
    updateProfileDropdown();
    if(!document.getElementById('managerOverlay').classList.contains('hidden')) {
        renderManagerList();
    }
    
    if (window.twemoji) {
        twemoji.parse(document.body);
    }
}

function syncToCloud() { cloudData.lastModified = new Date().toLocaleString(); socket.emit('update-data', cloudData); }
function saveLocalPrefs() { localStorage.setItem('alarm_local_prefs', JSON.stringify(localPrefs)); }

window.toggleFollow = function() {
    localPrefs.followMode = !localPrefs.followMode;
    saveLocalPrefs(); updateFollowUI();
    if(localPrefs.followMode) { currentNextAlarmId = null; updateCountdown(new Date()); }
}

function updateFollowUI() {
    const btn = document.getElementById('followBtn');
    if (localPrefs.followMode) { btn.classList.add('active'); btn.textContent = "Follow ON"; } 
    else { btn.classList.remove('active'); btn.textContent = "Follow"; }
}

function disableFollowOnInteraction() {
    if (localPrefs.followMode) { localPrefs.followMode = false; saveLocalPrefs(); updateFollowUI(); }
}

function scrollToAlarm(id) {
    const el = document.getElementById(`alarm-card-${id}`);
    if (el) {
        const headerOffset = document.getElementById('mainHeader').offsetHeight;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - headerOffset - 20, behavior: 'smooth' });
    }
}

window.openCreator = function() {
    if (localPrefs.followMode) { localPrefs.followMode = false; saveLocalPrefs(); updateFollowUI(); }
    document.getElementById('creatorOverlay').classList.remove('hidden');
}
window.closeCreator = function() { cancelEdit(); }

function populateCopyTargets() {
    const sel = document.getElementById('copyTargetProfile'); sel.innerHTML = '';
    let keys = Object.keys(cloudData.profiles).sort((a, b) => a.localeCompare(b));
    if (keys.length > 1 && keys.includes("Default")) keys = keys.filter(k => k !== "Default");
    keys.forEach(p => {
        const opt = document.createElement('option'); opt.value = p; opt.textContent = p;
        if (p === localPrefs.currentProfile) opt.selected = true;
        sel.appendChild(opt);
    });
}

window.openManager = function() { renderManagerList(); document.getElementById('managerOverlay').classList.remove('hidden'); }
window.closeManager = function() { document.getElementById('managerOverlay').classList.add('hidden'); }

function renderManagerList() {
    const list = document.getElementById('managerList'); list.innerHTML = '';
    let keys = Object.keys(cloudData.profiles).sort((a, b) => a.localeCompare(b));
    if (keys.length === 1 && keys[0] === "Default") {} else { keys = keys.filter(k => k !== "Default"); }
    
    keys.forEach(name => {
        const row = document.createElement('div'); row.className = 'profile-row';
        const isActive = name === localPrefs.currentProfile ? " (Active)" : "";
        const nameStyle = name === localPrefs.currentProfile ? "color: var(--accent)" : "";
        const count = cloudData.profiles[name] ? cloudData.profiles[name].length : 0;
        row.innerHTML = `
            <div class="profile-info"><div class="profile-name" style="${nameStyle}">${name}${isActive}</div><div class="profile-count">${count} ${count === 1 ? "Alarm" : "Alarms"}</div></div>
            <div class="profile-actions"><button class="btn-icon" title="Rename" onclick="renameProfile('${name}')">✏️</button><button class="btn-icon" style="color:var(--danger)" title="Delete" onclick="deleteProfile('${name}')">❌</button></div>
        `;
        list.appendChild(row);
    });
}

window.createNewProfile = function() {
    const name = prompt("Enter new profile name:");
    if (name) {
        if (cloudData.profiles[name]) return alert("Profile already exists!");
        cloudData.profiles[name] = []; localPrefs.currentProfile = name; saveLocalPrefs(); syncToCloud(); refreshUI(); 
    }
}

window.renameProfile = function(oldName) {
    if (oldName === "Default") return alert("Cannot rename Default profile.");
    const newName = prompt(`Rename "${oldName}" to:`, oldName);
    if (newName && newName !== oldName) {
        if (cloudData.profiles[newName]) return alert("Name already exists!");
        cloudData.profiles[newName] = cloudData.profiles[oldName]; delete cloudData.profiles[oldName];
        if (localPrefs.currentProfile === oldName) { localPrefs.currentProfile = newName; saveLocalPrefs(); }
        syncToCloud(); refreshUI();
    }
}

window.deleteProfile = function(name) {
    if (name === "Default") return alert("Cannot delete Default profile.");
    if (confirm(`Delete "${name}"?`)) {
        delete cloudData.profiles[name];
        if (localPrefs.currentProfile === name) { localPrefs.currentProfile = "Default"; saveLocalPrefs(); }
        syncToCloud(); refreshUI();
    }
}

window.handleSubmit = function() {
    let time = document.getElementById('alarmTime').value;
    if (!time) return alert("Select a time.");
    if (time.length === 5) time += ":00";
    
    const alarmData = {
        id: editingAlarmId || Date.now(), time,
        label: document.getElementById('alarmLabel').value || "",
        sound: document.getElementById('alarmSound').value,
        soundName: document.getElementById('alarmSound').options[document.getElementById('alarmSound').selectedIndex].text,
        days: Array.from(document.querySelectorAll('#daysPicker input:checked')).map(cb => parseInt(cb.value)), enabled: true
    };

    const isCopyMode = document.getElementById('creatorSection').classList.contains('copy-mode');
    let targetProfile = isCopyMode ? document.getElementById('copyTargetProfile').value : localPrefs.currentProfile;
    if (isCopyMode) alarmData.id = Date.now(); 

    if (!cloudData.profiles[targetProfile]) return alert("Target profile does not exist!");
    const profile = cloudData.profiles[targetProfile];

    if (profile.find(a => a.time === alarmData.time && a.id !== alarmData.id) && !confirm(`⚠️ Conflict Detected!\nSave anyway?`)) return;

    if (editingAlarmId && !isCopyMode) { const idx = profile.findIndex(a => a.id === editingAlarmId); if (idx !== -1) profile[idx] = alarmData; } 
    else { profile.push(alarmData); }

    syncToCloud();
    if (targetProfile !== localPrefs.currentProfile) alert(`✅ Alarm sent to "${targetProfile}" profile.`);
    cancelEdit(); 
}

function renderAlarms() {
    const grid = document.getElementById('alarmGrid'); grid.innerHTML = '';
    const alarms = cloudData.profiles[localPrefs.currentProfile] || [];
    alarms.sort((a, b) => localPrefs.sortOrder === 'earliest' ? a.time.localeCompare(b.time) : b.time.localeCompare(a.time));

    alarms.forEach(alarm => {
        const card = document.createElement('div');
        card.id = `alarm-card-${alarm.id}`; card.className = `alarm-card ${alarm.enabled ? '' : 'inactive'}`;
        card.innerHTML = `
            <input type="checkbox" class="card-toggle" ${alarm.enabled ? 'checked' : ''} onchange="toggleAlarm(${alarm.id})">
            <span class="card-time">${alarm.time.length === 5 ? alarm.time + ":00" : alarm.time}</span>
            <div class="card-info"><div class="card-label">${alarm.label || 'Alarm'}</div><div class="card-days">${alarm.days.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(', ') || 'Once'}</div><div class="sound-tag">🔉 ${alarm.soundName}</div></div>
            <div class="card-actions"><button class="edit-btn" onclick="editAlarm(${alarm.id})">EDIT</button><button class="copy-btn" onclick="copyAlarm(${alarm.id})">COPY</button><button class="delete-btn" onclick="deleteAlarm(${alarm.id})">DELETE</button></div>
        `;
        grid.appendChild(card);
    });
}

window.updateGridSize = function(val) {
    localPrefs.cardSize = val; saveLocalPrefs();
    const root = document.documentElement;
    if (val == 1) { root.style.setProperty('--card-width', '240px'); root.style.setProperty('--font-size', '2.2rem'); root.style.setProperty('--label-size', '1rem'); root.style.setProperty('--meta-size', '0.75rem'); } 
    else if (val == 2) { root.style.setProperty('--card-width', '320px'); root.style.setProperty('--font-size', '3.5rem'); root.style.setProperty('--label-size', '1.2rem'); root.style.setProperty('--meta-size', '0.9rem'); } 
    else { root.style.setProperty('--card-width', '450px'); root.style.setProperty('--font-size', '5.5rem'); root.style.setProperty('--label-size', '1.6rem'); root.style.setProperty('--meta-size', '1.1rem'); }
}

window.updateSort = function(val) { localPrefs.sortOrder = val; saveLocalPrefs(); renderAlarms(); }

window.copyAlarm = function(id) {
    const alarm = cloudData.profiles[localPrefs.currentProfile].find(a => a.id === id); if (!alarm) return;
    document.getElementById('alarmTime').value = alarm.time.length === 5 ? alarm.time + ":00" : alarm.time;
    document.getElementById('alarmLabel').value = alarm.label + " (Copy)"; document.getElementById('alarmSound').value = alarm.sound;
    document.querySelectorAll('#daysPicker input').forEach(cb => cb.checked = alarm.days.includes(parseInt(cb.value)));
    
    populateCopyTargets(); document.getElementById('copyTargetWrapper').classList.remove('hidden');
    editingAlarmId = id; document.getElementById('formTitle').textContent = "COPYING ALARM";
    document.getElementById('submitBtn').textContent = "Save Duplicate"; document.getElementById('submitBtn').classList.add('copy-confirm-btn');
    document.getElementById('creatorSection').classList.add('copy-mode'); document.getElementById('cancelEditBtn').classList.remove('hidden');
    openCreator();
}

window.editAlarm = function(id) {
    const alarm = cloudData.profiles[localPrefs.currentProfile].find(a => a.id === id); editingAlarmId = id;
    document.getElementById('alarmTime').value = alarm.time.length === 5 ? alarm.time + ":00" : alarm.time;
    document.getElementById('alarmLabel').value = alarm.label; document.getElementById('alarmSound').value = alarm.sound;
    document.querySelectorAll('#daysPicker input').forEach(cb => cb.checked = alarm.days.includes(parseInt(cb.value)));
    
    document.getElementById('formTitle').textContent = "EDIT ALARM"; document.getElementById('submitBtn').textContent = "Update Alarm";
    document.getElementById('submitBtn').classList.add('update-btn'); document.getElementById('creatorSection').classList.add('editing-mode');
    document.getElementById('cancelEditBtn').classList.remove('hidden'); openCreator();
}

function cancelEdit() {
    editingAlarmId = null; document.getElementById('alarmTime').value = ''; document.getElementById('alarmLabel').value = '';
    document.querySelectorAll('#daysPicker input').forEach(cb => cb.checked = false);
    document.getElementById('formTitle').textContent = "CREATE NEW ALARM"; document.getElementById('submitBtn').textContent = "Add Alarm";
    document.getElementById('submitBtn').className = 'add-btn'; document.getElementById('creatorSection').className = 'alarm-creator'; 
    document.getElementById('cancelEditBtn').classList.add('hidden'); document.getElementById('copyTargetWrapper').classList.add('hidden');
    document.getElementById('creatorOverlay').classList.add('hidden');
}

window.toggleAlarm = function(id) { const alarm = cloudData.profiles[localPrefs.currentProfile].find(a => a.id === id); alarm.enabled = !alarm.enabled; syncToCloud(); }
window.deleteAlarm = function(id) {
    const profile = cloudData.profiles[localPrefs.currentProfile]; const alarmToDelete = profile.find(a => a.id === id); if (!alarmToDelete) return;
    if (confirm(`Delete permanently?`)) { cloudData.profiles[localPrefs.currentProfile] = profile.filter(a => a.id !== id); syncToCloud(); }
}
window.switchProfile = function(val) { cancelEdit(); localPrefs.currentProfile = val; saveLocalPrefs(); refreshUI(); }
function updateProfileDropdown() {
    const sel = document.getElementById('profileSelect'); sel.innerHTML = ''; if (!cloudData.profiles) return;
    let keys = Object.keys(cloudData.profiles).sort((a, b) => a.localeCompare(b));
    if (keys.length > 1 && keys.includes("Default")) keys = keys.filter(k => k !== "Default");
    keys.forEach(p => { const opt = document.createElement('option'); opt.value = p; opt.textContent = p; if (p === localPrefs.currentProfile) opt.selected = true; sel.appendChild(opt); });
}
window.setDays = function(type) { document.querySelectorAll('#daysPicker input').forEach(cb => { const val = parseInt(cb.value); cb.checked = (type === 'all') || (type === 'weekdays' && val >= 1 && val <= 5) || (type === 'weekends' && (val === 0 || val === 6)); }); }

// --- MODULAR VISUALIZER ENGINE ---
function resizeCanvas() { if (!particleCanvas) return; particleCanvas.width = window.innerWidth; particleCanvas.height = window.innerHeight; }

async function loadVisualizerModule(name) {
    try {
        const module = await import(`./visualizers/${name}.js?t=${Date.now()}`);
        currentVizInstance = new module.default(particleCanvas, ctx);
        currentVizInstance.init();
    } catch (err) { console.error("Failed to load visualizer:", err); }
}

window.changeVisualizer = async function(name) {
    if (currentVizInstance && typeof currentVizInstance.destroy === 'function') {
        currentVizInstance.destroy();
    }
    
    currentVizName = name;
    
    if (visualizerActive) {
        await loadVisualizerModule(name);
    }
}

window.toggleVisualizer = async function() {
    visualizerActive = !visualizerActive;
    const visLayer = document.getElementById('visualizerMode');
    
    if (visualizerActive) {
        visLayer.classList.remove('hidden');
        particleCanvas = document.getElementById('particleCanvas');
        ctx = particleCanvas.getContext('2d');
        resizeCanvas();
        
        await loadVisualizerModule(currentVizName);
        vizLoop();
    } else {
        visLayer.classList.add('hidden');
        cancelAnimationFrame(animationFrameId);
        
        if (currentVizInstance && typeof currentVizInstance.destroy === 'function') {
            currentVizInstance.destroy();
        }
    }
}

function vizLoop() {
    if (!visualizerActive) return; 
    if (currentVizInstance) currentVizInstance.render(new Date());
    animationFrameId = requestAnimationFrame(vizLoop);
}

// --- CLOCK CONTROLLER ---
function startClock() {
    let lastTickTime = "";
    
    function tick() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`; 
        
        if (currentTime !== lastTickTime) {
            lastTickTime = currentTime;
            document.getElementById('liveClock').textContent = currentTime;
            
            const visClock = document.getElementById('visClock'); 
            if (visClock) visClock.textContent = currentTime;
            
            if (cloudData.profiles && cloudData.profiles[localPrefs.currentProfile]) {
                cloudData.profiles[localPrefs.currentProfile].forEach(alarm => {
                    if (alarm.enabled && (alarm.time.length === 5 ? alarm.time + ":00" : alarm.time) === currentTime && (alarm.days.length === 0 || alarm.days.includes(now.getDay()))) {
                        triggerAlarm(alarm);
                    }
                });
                updateCountdown(now);
            }
        }
        
        requestAnimationFrame(tick);
    }
    
    requestAnimationFrame(tick);
}

function updateCountdown(now) {
    if (!cloudData.profiles || !cloudData.profiles[localPrefs.currentProfile]) return;
    const alarms = cloudData.profiles[localPrefs.currentProfile].filter(a => a.enabled);
    const display = document.getElementById('nextAlarmDisplay');
    const followingDisplay = document.getElementById('followingAlarmDisplay');
    
    if (alarms.length === 0) { 
        display.textContent = "NO ALARMS ACTIVE"; followingDisplay.textContent = "";
        if (visualizerActive && currentVizInstance && currentVizInstance.updateAlarms) currentVizInstance.updateAlarms([]);
        return; 
    }

    let nextOccurrences = [];
    alarms.forEach(alarm => {
        const parts = alarm.time.split(':').map(Number);
        if (alarm.days.length > 0) {
            alarm.days.forEach(day => {
                let date = new Date(now); date.setHours(parts[0], parts[1], parts[2] || 0, 0);
                let daysUntil = (day - now.getDay() + 7) % 7;
                if (daysUntil === 0 && date <= now) daysUntil = 7;
                date.setDate(date.getDate() + daysUntil);
                nextOccurrences.push({ date, alarm });
            });
        } else {
            let date = new Date(now); date.setHours(parts[0], parts[1], parts[2] || 0, 0);
            if (date <= now) date.setDate(date.getDate() + 1);
            nextOccurrences.push({ date, alarm });
        }
    });

    nextOccurrences.sort((a, b) => a.date - b.date);
    const next = nextOccurrences[0]; const diff = next.date - now;
    display.textContent = `NEXT [${next.alarm.label || "ALARM"}] ${Math.floor(diff / 3600000).toString().padStart(2, '0')}:${Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')}:${Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')}`;

    if (nextOccurrences.length > 1) {
        const d2 = nextOccurrences[1].date - now;
        followingDisplay.textContent = `THEN: [${nextOccurrences[1].alarm.label || "ALARM"}] ${Math.floor(d2 / 3600000).toString().padStart(2, '0')}:${Math.floor((d2 % 3600000) / 60000).toString().padStart(2, '0')}:${Math.floor((d2 % 60000) / 1000).toString().padStart(2, '0')}`;
    } else { followingDisplay.textContent = ""; }

    document.querySelectorAll('.alarm-card').forEach(el => el.classList.remove('next-alarm-highlight'));
    const nCard = document.getElementById(`alarm-card-${next.alarm.id}`); if (nCard) nCard.classList.add('next-alarm-highlight');
    if (localPrefs.followMode && next.alarm.id !== currentNextAlarmId) { currentNextAlarmId = next.alarm.id; scrollToAlarm(currentNextAlarmId); }
    
    if (visualizerActive && currentVizInstance && currentVizInstance.updateAlarms) currentVizInstance.updateAlarms(nextOccurrences);
}

function playEmergencyBeep() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    emergencyBeepInterval = setInterval(() => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(880, ctx.currentTime); g.gain.setValueAtTime(0.5, ctx.currentTime);
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.15); 
    }, 500); 
}

window.previewSound = function() { const p = document.getElementById('audioPreview'); p.src = document.getElementById('alarmSound').value; p.play(); setTimeout(() => p.pause(), 2500); }

// --- UPDATED ALARM OVERRIDE LOGIC ---
function triggerAlarm(alarm) {
    stopAlarm(); 
    
    // If we are in visualizer mode, and the visualizer knows how to handle ringing, let it!
    if (visualizerActive && currentVizInstance && typeof currentVizInstance.handleRing === 'function') {
        currentVizInstance.handleRing(alarm);
        
        // Still play the audio, but bypass the default DOM popup completely
        const p = document.getElementById('mainAlarmAudio'); p.onerror = () => playEmergencyBeep();
        p.src = alarm.sound; p.volume = 0; p.play().catch(e => console.log("Audio Blocked"));
        if (fadeInterval) clearInterval(fadeInterval);
        fadeInterval = setInterval(() => { if (p.volume < 1) p.volume = Math.min(1, p.volume + 0.05); else clearInterval(fadeInterval); }, 200);
        ringTimeout = setTimeout(() => stopAlarm(), 300000); // Auto shutoff in 5 mins
    } else {
        // Standard Behavior (No visualizer active)
        document.getElementById('ringingTime').textContent = alarm.time; document.getElementById('ringingLabel').textContent = alarm.label || "ALARM";
        document.getElementById('visualizerMode').classList.add('hidden'); if (animationFrameId) cancelAnimationFrame(animationFrameId);
        document.getElementById('alarmOverlay').classList.remove('hidden');
        const p = document.getElementById('mainAlarmAudio'); p.onerror = () => playEmergencyBeep();
        p.src = alarm.sound; p.volume = 0; p.play().catch(e => console.log("Audio Blocked"));
        if (fadeInterval) clearInterval(fadeInterval);
        fadeInterval = setInterval(() => { if (p.volume < 1) p.volume = Math.min(1, p.volume + 0.05); else clearInterval(fadeInterval); }, 200);
        ringTimeout = setTimeout(() => stopAlarm(), 300000);
    }
}

// --- UPDATED ALARM STOP LOGIC ---
window.stopAlarm = function() {
    const p = document.getElementById('mainAlarmAudio'); p.pause(); p.currentTime = 0; p.onerror = null; 
    if (emergencyBeepInterval) clearInterval(emergencyBeepInterval); if (ringTimeout) clearTimeout(ringTimeout); if (fadeInterval) clearInterval(fadeInterval);
    
    document.getElementById('alarmOverlay').classList.add('hidden');
    
    // Tell the visualizer to stop the custom animation
    if (visualizerActive) { 
        document.getElementById('visualizerMode').classList.remove('hidden');
        if (currentVizInstance && typeof currentVizInstance.stopRing === 'function') currentVizInstance.stopRing();
        vizLoop(); 
    }
}

init();