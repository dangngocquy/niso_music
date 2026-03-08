import io from 'socket.io-client';

// const socket = io('http://localhost:4004/', {
//   transports: ['websocket', 'polling'],
//   timeout: 20000,
//   reconnection: true,
//   reconnectionAttempts: 5,
//   reconnectionDelay: 1000,
//   reconnectionDelayMax: 5000,
//   randomizationFactor: 0.5,
// });


const socket = io('https://music.niso.com.vn/', {
  transports: ['websocket', 'polling'],
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
});

export default socket;