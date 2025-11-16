// Socket.io server for employee presence and auto punch-out
const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const activeUsers = {};

io.on('connection', (socket) => {
  socket.on('employee-online', ({ userId }) => {
    activeUsers[userId] = {
      socketId: socket.id,
      lastPing: Date.now()
    };
  });

  socket.on('heartbeat', ({ userId }) => {
    if (activeUsers[userId]) {
      activeUsers[userId].lastPing = Date.now();
    }
  });

  socket.on('disconnect', () => {
    for (const userId in activeUsers) {
      if (activeUsers[userId].socketId === socket.id) {
        autoPunchOut(userId);
        delete activeUsers[userId];
        io.to(socket.id).emit('auto-punched-out');
      }
    }
  });
});

// Cron checker for stale heartbeats
setInterval(() => {
  const now = Date.now();
  for (const userId in activeUsers) {
    const user = activeUsers[userId];
    if (now - user.lastPing > 20000) {
      autoPunchOut(userId);
      io.to(user.socketId).emit('auto-punched-out');
      delete activeUsers[userId];
    }
  }
}, 30000);

// Replace with your DB update logic
async function autoPunchOut(userId) {
  console.log(`[auto-punch-out] Punching out user ${userId}`);
  // TODO: Update attendance DB for userId
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
