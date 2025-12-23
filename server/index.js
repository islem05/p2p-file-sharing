const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt'); // For password security [cite: 15]

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Allow the React Client to connect
        methods: ["GET", "POST"]
    }
});

// --- IN-MEMORY DATABASE ---
// In a real app, use PostgreSQL/MongoDB. For this project, variables are fine.
// Structure: { username: "hashed_password" }
const registeredUsers = {}; 

// Structure: { socketId: { username: "alice", files: [] } }
const activePeers = {}; 

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // --- REQUIREMENT: AUTHENTICATION [cite: 13, 34] ---
    socket.on('register', async ({ username, password }) => {
        if (registeredUsers[username]) {
            socket.emit('auth_error', 'User already exists');
            return;
        }
        // Hash password so it's not stored in clear text [cite: 16, 33]
        const hashedPassword = await bcrypt.hash(password, 10);
        registeredUsers[username] = hashedPassword;
        
        socket.emit('auth_success', 'Registration successful! Please login.');
    });

    socket.on('login', async ({ username, password }) => {
        const storedHash = registeredUsers[username];
        
        if (!storedHash) {
            socket.emit('auth_error', 'User not found');
            return;
        }

        const isMatch = await bcrypt.compare(password, storedHash);
        
        if (isMatch) {
            // Save this user as "Active"
            activePeers[socket.id] = { username, files: [] };
            socket.emit('login_success', { username });
            console.log(`${username} logged in.`);
        } else {
            socket.emit('auth_error', 'Incorrect password');
        }
    });

    // --- REQUIREMENT: PUBLISH SHARED FILES [cite: 9, 39] ---
    // User sends their list of files to the server
    socket.on('publish_files', (fileList) => {
        if (activePeers[socket.id]) {
            activePeers[socket.id].files = fileList;
            console.log(`User ${activePeers[socket.id].username} shared ${fileList.length} files.`);
            
            // Optional: Broadcast to everyone that new files are available
            io.emit('new_files_available'); 
        }
    });

    // --- REQUIREMENT: SEARCH [cite: 11, 26] ---
    socket.on('search', (keyword) => {
        const results = [];
        
        // Loop through all active peers to find matches
        for (const [peerId, peerData] of Object.entries(activePeers)) {
            // Don't search the user's own files
            if (peerId === socket.id) continue;

            const userFiles = peerData.files || [];
            
            // Check if any file matches the keyword
            const matches = userFiles.filter(file => 
                file.fileName.toLowerCase().includes(keyword.toLowerCase()) || 
                file.description.toLowerCase().includes(keyword.toLowerCase())
            );

            if (matches.length > 0) {
                results.push({
                    username: peerData.username,
                    peerId: peerId, // We need this ID to connect P2P later
                    files: matches
                });
            }
        }
        
        socket.emit('search_results', results);
    });

    // --- REQUIREMENT: HANDLING DISCONNECTS  ---
    // If a user disconnects, remove their files from the search index
    socket.on('disconnect', () => {
        if (activePeers[socket.id]) {
            console.log(`${activePeers[socket.id].username} disconnected.`);
            delete activePeers[socket.id];
        }
    });
});

server.listen(3000, () => {
    console.log('CENTRAL SERVER running on port 3000');
});