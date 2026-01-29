const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

let users = {};
let userCredentials = {}; 
let filesMetadata = [];

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // Gestion de l'inscription
  socket.on("register", (data) => {
    if (userCredentials[data.username]) {
      socket.emit("auth_error", "L'utilisateur existe déjà ! Essayez de vous connecter.");
      return;
    }

    userCredentials[data.username] = data.password;
    console.log(`Nouvel utilisateur enregistré : ${data.username}`);
    
    socket.emit("auth_success", "Inscription réussie ! Veuillez vous connecter.");
  });

  // Gestion de la connexion
  socket.on("login", (data) => {
    if (!userCredentials[data.username]) {
      socket.emit("auth_error", "Utilisateur introuvable. Veuillez vous inscrire.");
      return;
    }

    if (userCredentials[data.username] !== data.password) {
      socket.emit("auth_error", "Mot de passe incorrect !");
      return;
    }

    users[socket.id] = data.username;
    console.log(`Utilisateur connecté : ${data.username} (${socket.id})`);
    
    socket.emit("login_success", { 
        message: "Connexion réussie", 
        username: data.username,
        socketId: socket.id 
    });
  });

  // Publication des fichiers
  socket.on("publish_files", (newFiles) => {
    const username = users[socket.id];
    if (!username) return;

    const filesWithOwner = newFiles.map(file => ({
        ...file,
        ownerId: socket.id,
        username: username
    }));

    // Évite les doublons : supprime les anciens fichiers de cet utilisateur avant d'ajouter les nouveaux
    filesMetadata = filesMetadata.filter(f => f.ownerId !== socket.id);
    filesMetadata.push(...filesWithOwner);
    
    console.log(`${username} a mis à jour ses fichiers. Total : ${filesMetadata.length}`);
  });

  // Recherche de fichiers
  socket.on("search", (query) => {
    const results = filesMetadata.filter(file => 
        file.fileName.toLowerCase().includes(query.toLowerCase())
    );
    socket.emit("search_results", results);
  });

  // Signalisation WebRTC
  socket.on("offer", (payload) => {
      io.to(payload.target).emit("offer", {
          sdp: payload.sdp,
          callerId: socket.id
      });
  });

  socket.on("answer", (payload) => {
      io.to(payload.target).emit("answer", {
          sdp: payload.sdp,
          responderId: socket.id
      });
  });

  socket.on("ice-candidate", (payload) => {
      io.to(payload.target).emit("ice-candidate", {
          candidate: payload.candidate,
          senderId: socket.id
      });
  });

  // Déconnexion
  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
    delete users[socket.id];
    filesMetadata = filesMetadata.filter(f => f.ownerId !== socket.id);
  });
});

server.listen(3001, () => {
  console.log("SERVEUR EN LIGNE SUR LE PORT 3001");
});