const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// SETUP SOCKETS WITH CORS ALLOWED
const io = new Server(server, {
    cors: {
        origin: "*", // 🔓 ALLOWS CONNECTION FROM ANYWHERE (Desktop, Phone, Localhost)
        methods: ["GET", "POST"]
    }
});

// A simple message so you know it's running if you visit the URL
app.get('/', (req, res) => {
    res.send('<h1>⏰ Alarm Socket Server is Running!</h1>');
});

// MEMORY STORAGE (Resets if Railway restarts)
let appData = {
    currentProfile: "Default",
    sortOrder: "earliest",
    lastModified: "Initial",
    profiles: { "Default": [] }
};

io.on('connection', (socket) => {
    console.log('⚡ User connected:', socket.id);

    // Send current data immediately
    socket.emit('init-data', appData);

    // Listen for updates
    socket.on('update-data', (newData) => {
        // Basic validation to prevent crashing
        if(newData && newData.profiles) {
            appData = newData;
            // Broadcast to everyone ELSE (and the sender, to confirm sync)
            io.emit('sync-update', appData);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});