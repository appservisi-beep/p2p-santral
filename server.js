const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Render.com'da sorun yaşamamak için CORS ayarlarını ekliyoruz
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let onlineUsers = {};

io.on('connection', (socket) => {
    console.log(`Yeni bir cihaz bağlandı: ${socket.id}`);
    
    socket.on('register', (userId) => {
        onlineUsers[userId] = socket.id;
        console.log(`${userId} sisteme kayıt oldu. Socket ID: ${socket.id}`);
        io.emit('online_users', Object.keys(onlineUsers));
    });

    socket.on('offer', (data) => {
        const targetSocket = onlineUsers[data.targetUserId];
        if (targetSocket) {
            io.to(targetSocket).emit('offer', {
                callerId: data.callerId,
                sdp: data.sdp
            });
        }
    });

    socket.on('answer', (data) => {
        const targetSocket = onlineUsers[data.targetUserId];
        if (targetSocket) {
            io.to(targetSocket).emit('answer', {
                callerId: data.callerId,
                sdp: data.sdp
            });
        }
    });

    socket.on('ice_candidate', (data) => {
        const targetSocket = onlineUsers[data.targetUserId];
        if (targetSocket) {
            io.to(targetSocket).emit('ice_candidate', {
                callerId: data.callerId,
                candidate: data.candidate
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Cihaz koptu: ${socket.id}`);
        for (let userId in onlineUsers) {
            if (onlineUsers[userId] === socket.id) {
                delete onlineUsers[userId];
                io.emit('online_users', Object.keys(onlineUsers));
                break;
            }
        }
    });
});

// Render.com'un atayacağı portu dinle
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sinyalleşme Sunucusu ${PORT} portunda çalışıyor...`);
});