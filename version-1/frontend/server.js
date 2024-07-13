const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join', (room) => {
    socket.join(room);
    socket.broadcast.to(room).emit('user-connected', socket.id);

    socket.on('disconnect', () => {
      socket.broadcast.to(room).emit('user-disconnected', socket.id);
    });

    socket.on('offer', (offer, roomId) => {
      socket.broadcast.to(roomId).emit('offer', offer, socket.id);
    });

    socket.on('answer', (answer, roomId) => {
      socket.broadcast.to(roomId).emit('answer', answer, socket.id);
    });

    socket.on('candidate', (candidate, roomId) => {
      socket.broadcast.to(roomId).emit('candidate', candidate, socket.id);
    });

    socket.on('end-call', (roomId) => {
      socket.broadcast.to(roomId).emit('end-call');
    });

    socket.on('message', (message, roomId) => {
      socket.to(roomId).emit('message', message);  // Send to the room
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
