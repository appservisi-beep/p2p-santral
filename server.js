const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');

// Firebase Admin SDK'yı başlat
const serviceAccount = require('./firebase-admin.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Kullanıcıların Socket ID'lerini ve FCM Token'larını tutacağımız listeler
let onlineUsers = {}; 
let userFcmTokens = {}; // { "ahmet@gmail.com": "fcm_token_xyz..." }

io.on('connection', (socket) => {
    console.log(`Yeni cihaz bağlandı: ${socket.id}`);
    
    // Cihaz bağlandığında hem mailini hem de FCM Token'ını gönderir
    socket.on('register', (data) => {
        onlineUsers[data.userId] = socket.id;
        if (data.fcmToken) {
            userFcmTokens[data.userId] = data.fcmToken;
        }
        console.log(`${data.userId} kayıt oldu. Token alındı.`);
        io.emit('online_users', Object.keys(onlineUsers));
    });

    // ANDROID'DEN GELEN "HERKESİ UYANDIR" EMRİ
    socket.on('wake_up_all', async (data) => {
        const senderId = data.senderId;
        const recordType = data.type; // SEYYAR veya ESNAF
        
        console.log(`${senderId}, herkesi uyandırma emri verdi!`);

        // Sistemdeki tüm FCM tokenlerini topla (Gönderen hariç)
        const tokensToWakeUp = [];
        for (const [userId, token] of Object.entries(userFcmTokens)) {
            if (userId !== senderId && token) {
                tokensToWakeUp.push(token);
            }
        }

        if (tokensToWakeUp.length > 0) {
            // Görünmez (Sessiz) Data Mesajı Hazırla
            const message = {
                data: {
                    action: "WAKE_UP_P2P",
                    type: recordType,
                    sender: senderId
                },
                tokens: tokensToWakeUp
            };

            try {
                const response = await admin.messaging().sendMulticast(message);
                console.log(`Uyandırma sinyali gönderildi. Başarılı: ${response.successCount}, Hatalı: ${response.failureCount}`);
            } catch (error) {
                console.log('FCM Gönderim Hatası:', error);
            }
        }
    });

    // WebRTC Sinyalleşme Kodları (Eskisiyle aynı)
    socket.on('offer', (data) => {
        const targetSocket = onlineUsers[data.targetUserId];
        if (targetSocket) io.to(targetSocket).emit('offer', data);
    });

    socket.on('answer', (data) => {
        const targetSocket = onlineUsers[data.targetUserId];
        if (targetSocket) io.to(targetSocket).emit('answer', data);
    });

    socket.on('ice_candidate', (data) => {
        const targetSocket = onlineUsers[data.targetUserId];
        if (targetSocket) io.to(targetSocket).emit('ice_candidate', data);
    });

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
server.listen(PORT, '0.0.0.0', () => {
    console.log(`FCM Destekli Sinyalleşme Sunucusu ${PORT} portunda çalışıyor...`);
});
