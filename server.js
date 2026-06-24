const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');

const serviceAccount = require('./firebase-admin.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

let onlineUsers = {}; 

io.on('connection', (socket) => {
    socket.on('register', (data) => {
        onlineUsers[data.userId] = socket.id;
        io.emit('online_users', Object.keys(onlineUsers));
    });

    // 1. TOKEN TAKASI (Cihazlar birbirine tokenlerini gönderir)
    socket.on('exchange_token', (data) => {
        const targetSocket = onlineUsers[data.targetUserId];
        if (targetSocket) {
            io.to(targetSocket).emit('exchange_token', {
                senderEmail: data.senderEmail,
                token: data.token
            });
        }
    });

    // 2. HEDEFE YÖNELİK UYANDIRMA (SQLite'tan gelen tokenlere bildirim atar)
    socket.on('wake_up_specific', async (data) => {
        const tokens = data.tokens; // Android'in SQLite'ından gelen token listesi
        if (tokens && tokens.length > 0) {
            const message = {
                data: { action: "WAKE_UP_P2P", type: data.type, sender: data.senderId },
                tokens: tokens
            };
            try {
                await admin.messaging().sendMulticast(message);
                console.log(`${data.senderId} tarafindan ${tokens.length} cihaza bildirim atildi.`);
            } catch (error) { console.log('FCM Hatasi:', error); }
        }
    });

    // WebRTC Sinyalleşme
    socket.on('offer', (data) => { const t = onlineUsers[data.targetUserId]; if(t) io.to(t).emit('offer', data); });
    socket.on('answer', (data) => { const t = onlineUsers[data.targetUserId]; if(t) io.to(t).emit('answer', data); });
    socket.on('ice_candidate', (data) => { const t = onlineUsers[data.targetUserId]; if(t) io.to(t).emit('ice_candidate', data); });
    socket.on('disconnect', () => {
        for (let userId in onlineUsers) {
            if (onlineUsers[userId] === socket.id) {
                delete onlineUsers[userId];
                io.emit('online_users', Object.keys(onlineUsers));
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Sunucu ${PORT} portunda calisiyor...`));
