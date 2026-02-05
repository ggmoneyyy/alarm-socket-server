const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// --- CONFIGURATION ---
// Your Google Script URL is now hardcoded here
const BACKUP_URL = "https://script.google.com/macros/s/AKfycbwRNZez29szHhKaM7sHd11bIJCsl4VE58ijsvfznv2GrZxxTscA2EozBjOBFyy5EMJ9/exec"; 

const app = express();
const server = http.createServer(app);

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

// 1. LOAD BACKUP ON STARTUP
async function loadFromBackup() {
    console.log("📥 Fetching backup from Google Sheets...");
    try {
        // We use a small timeout logic to prevent hanging if Google is slow
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(BACKUP_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            // Basic validation to ensure we don't load garbage
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
    // Fire and forget - don't await, don't block the socket
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
            <p><strong>Last Backup System:</strong> Active</p>
        </div>
    `);
});

// Initialize Data
loadFromBackup();

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    console.log('⚡ User connected:', socket.id);

    // 1. Send current data immediately to new user
    socket.emit('init-data', appData);

    // 2. Listen for updates
    socket.on('update-data', (newData) => {
        if(newData && newData.profiles) {
            // Update RAM (Instant)
            appData = newData;
            
            // Broadcast to everyone (Instant)
            io.emit('sync-update', appData);
            
            // Save to Google (Background)
            saveToBackup();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});