const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const BACKUP_URL = "https://script.google.com/macros/s/AKfycbwRNZez29szHhKaM7sHd11bIJCsl4VE58ijsvfznv2GrZxxTscA2EozBjOBFyy5EMJ9/exec"; 

const app = express();
const server = http.createServer(app);

// Tell Express to serve files from the 'public' folder
app.use(express.static('public'));

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// MEMORY STORAGE
let appData = {
    currentProfile: "Default",
    sortOrder: "earliest",
    lastModified: "Initial",
    profiles: { "Default": [] }
};

// --- DYNAMIC SOUND FINDER ---
function getAvailableSounds() {
    let sounds = [];
    
    // 1. Classic Google Sounds (Always available)
    sounds.push({ name: "Classic Beep", url: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg" });
    sounds.push({ name: "Digital Watch", url: "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg" });
    sounds.push({ name: "Military Bugle", url: "https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg" });
    sounds.push({ name: "Medium Bell Ringing", url: "https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.ogg" });

    // 2. Scan for custom MP3s
    const soundsDir = path.join(__dirname, 'public', 'sounds');
    try {
        if (fs.existsSync(soundsDir)) {
            const files = fs.readdirSync(soundsDir);
            files.forEach(file => {
                if (file.endsWith('.mp3') || file.endsWith('.ogg') || file.endsWith('.wav')) {
                    let cleanName = file.replace(/\.[^/.]+$/, "").replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    sounds.push({
                        name: `🎵 ${cleanName}`,
                        url: `https://alarm-socket-server.onrender.com/sounds/${file}`
                    });
                }
            });
        }
    } catch (err) {
        console.error("Error reading sounds directory:", err.message);
    }
    
    return sounds;
}

// 1. LOAD BACKUP ON STARTUP
async function loadFromBackup() {
    console.log("📥 Fetching backup from Google Sheets...");
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(BACKUP_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            if (data && data.profiles) {
                appData = data;
                console.log("✅ Data restored from backup!");
            }
        }
    } catch (error) {
        console.error("❌ Failed to load backup (Starting with empty/default data):", error.message);
    }
}

// 2. SAVE TO BACKUP (Background Task)
function saveToBackup() {
    console.log("📤 Saving to Google Sheets...");
    fetch(BACKUP_URL, {
        method: 'POST',
        body: JSON.stringify(appData),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
    }).catch(error => console.error("❌ Backup failed:", error.message));
}

// Helper route for UptimeRobot
app.get('/', (req, res) => {
    const profileCount = appData.profiles ? Object.keys(appData.profiles).length : 0;
    res.send(`
        <div style="font-family: monospace; padding: 20px;">
            <h1>⏰ Server is Running</h1>
            <p><strong>Status:</strong> Live</p>
            <p><strong>Profiles Loaded:</strong> ${profileCount}</p>
        </div>
    `);
});

// Initialize Data
loadFromBackup();

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    console.log('⚡ User connected:', socket.id);

    // Send current data and sound list immediately to new user
    socket.emit('init-data', appData);
    socket.emit('available-sounds', getAvailableSounds());

    socket.on('update-data', (newData) => {
        if(newData && newData.profiles) {
            appData = newData;
            io.emit('sync-update', appData);
            saveToBackup();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});