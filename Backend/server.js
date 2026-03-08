const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
require('dotenv').config({ path: '../.env.local' });
const { connectDB, closeConnection } = require("./mongo");
const loginRoutes = require("./routes/login");
const accountsRoutes = require("./routes/accounts");
const musicRoutes = require("./routes/music");
const playlistsRoutes = require("./routes/playlists")();
const schedulesRoutes = require("./routes/schedules")();
const albumsRoutes = require("./routes/albums")();
const userPlaylistLogsRoutes = require("./routes/user-playlist-logs");
const loginLogsRoutes = require("./routes/login-logs");
const permissionsRoutes = require("./routes/permissions");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false          // must be false when using "*"
  },
  pingTimeout: 120000,          // increased to 2 minutes for better stability
  pingInterval: 50000,          // increased to 50 seconds
  maxHttpBufferSize: 1e8,       // 100MB - helps with larger messages
  transports: ["websocket", "polling"], // prefer websocket but fallback ok
  // Important for reducing resource pressure on dev machines
  allowEIO3: false,             // disable legacy engine
  connectionStateRecovery: {
    // Enable connection state recovery
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
  // Optional caps (uncomment if still hitting limits)
  // maxHttpConnections: 200,
  // perMessageDeflate: false,  // disable compression if memory is very tight
});

global.io = io;

const playingStatuses = new Map();
global.playingStatuses = playingStatuses;

const PORT = 4004;

// Middleware
app.use(cors()); // or cors({ origin: "*" }) if you prefer explicit

app.use(express.json({ limit: "800mb" }));
app.use(express.urlencoded({ extended: true, limit: "800mb" }));

app.use("/uploads", express.static("uploads"));

// Basic Auth middleware for admin routes
const basicAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Thiếu header Authorization" });
  }

  const base64Credentials = authHeader.split(" ")[1];
  if (!base64Credentials) {
    return res.status(401).json({ error: "Định dạng Authorization sai" });
  }

  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const [username, password] = credentials.split(":");

  if (username === "ps123" && password === "ps123") {
    next();
  } else {
    return res.status(401).json({ error: "Username hoặc password không đúng" });
  }
};

// Public routes
app.use("/api", loginRoutes);
app.use("/api/playlists", playlistsRoutes);
app.use("/api/permissions", permissionsRoutes);

// Admin routes (protected)
app.use("/api/admin/accounts", basicAuth, accountsRoutes);
app.use("/api/admin/music", basicAuth, musicRoutes);
app.use("/api/admin/playlists", basicAuth, playlistsRoutes);
app.use("/api/admin/schedules", basicAuth, schedulesRoutes);
app.use("/api/admin/albums", basicAuth, albumsRoutes);
app.use("/api/admin/user-playlist-logs", basicAuth, userPlaylistLogsRoutes);
app.use("/api/admin/login-logs", basicAuth, loginLogsRoutes);
app.use("/api/admin/permissions", basicAuth, permissionsRoutes);

// Health check endpoint (useful for debugging connections)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server đang chạy",
    port: PORT,
    time: new Date().toISOString(),
    uptime: process.uptime(),
    activeSockets: io.engine.clientsCount || 0,
  });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id} | total: ${io.engine.clientsCount}`);

  // Handle connection errors
  socket.on("connect_error", (error) => {
    console.error(`Connection error for ${socket.id}:`, error);
  });

  // Handle ping/pong for debugging
  socket.on("ping", () => {
    console.log(`Ping received from ${socket.id}`);
  });

  socket.on("pong", () => {
    console.log(`Pong received from ${socket.id}`);
  });

  socket.on("test-notification", () => {
    console.log("Test notification received from", socket.id);
    io.emit("test-notification");
  });

  socket.on("remote-logout", (data) => {
    console.log("Remote logout received from", socket.id, "for account", data.accountId);
    io.emit("remote-logout", data);
  });

  socket.on("remote-play-pause", (data) => {
    console.log("Remote play/pause received from", socket.id, "for account", data.accountId);
    io.emit("remote-play-pause", data);
  });

  socket.on("remote-select-song", (data) => {
    console.log("Remote select song received from", socket.id, "for account", data.accountId, "song", data.songId);
    io.emit("remote-select-song", data);
  });

  socket.on("user-online", (data) => {
    console.log("User online:", data.accountId);
    
    // Check for existing connections with the same accountId and logout them
    io.sockets.sockets.forEach((sock) => {
      if (sock.accountId === data.accountId && sock.id !== socket.id) {
        console.log(`Logging out existing session for account ${data.accountId} on socket ${sock.id}`);
        io.to(sock.id).emit("remote-logout", { accountId: data.accountId });
      }
    });
    
    socket.accountId = data.accountId; // Store accountId on socket
    io.emit("user-status-update", { ...data, status: 'online' });
  });

  socket.on("user-offline", (data) => {
    console.log("User offline:", data.accountId);
    io.emit("user-status-update", { ...data, status: 'offline' });
  });

  socket.on("playing-status", (data) => {
    console.log("Playing status from", data.accountId, ":", data);
    playingStatuses.set(data.accountId, data);
    io.emit("playing-status-update", data);
  });

  socket.on("check-playing-status", async (data) => {
    const { userId } = data;
    console.log("Checking playing status for", userId);

    try {
      const db = await connectDB();
      const schedules = await db.collection('schedules').find({ 
        accounts: { $in: [userId] } 
      }).toArray();

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const currentDay = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][now.getDay()];

      let hasActiveSchedule = false;
      for (const schedule of schedules) {
        if (schedule.recurrence === 'weekly' && schedule.day === currentDay) {
          const [startH, startM] = schedule.startTime.split(':').map(Number);
          const [endH, endM] = schedule.endTime.split(':').map(Number);
          const startMin = startH * 60 + startM;
          const endMin = endH * 60 + endM;
          if (currentTime >= startMin && currentTime <= endMin) {
            hasActiveSchedule = true;
            break;
          }
        } else if (schedule.recurrence === 'one-time') {
          const scheduleDate = new Date(schedule.date);
          if (scheduleDate.toDateString() === now.toDateString()) {
            const [startH, startM] = schedule.startTime.split(':').map(Number);
            const [endH, endM] = schedule.endTime.split(':').map(Number);
            const startMin = startH * 60 + startM;
            const endMin = endH * 60 + endM;
            if (currentTime >= startMin && currentTime <= endMin) {
              hasActiveSchedule = true;
              break;
            }
          }
        }
      }

      const playing = playingStatuses.get(userId);
      let message, type;
      if (hasActiveSchedule && (!playing || !playing.isPlaying)) {
        message = 'Bạn có lịch phát nhạc trong khung giờ này nhưng đang tạm dừng phát.';
        type = 'warning';
      } else if (hasActiveSchedule && playing && playing.isPlaying) {
        message = 'Trạng thái phát nhạc bình thường.';
        type = 'success';
      } else {
        message = 'Không có lịch phát nhạc trong khung giờ này.';
        type = 'info';
      }

      const timestamp = new Date().toISOString();
      
      // Lưu thông báo vào MongoDB
      const notificationsCollection = await connectDB('notifications');
      await notificationsCollection.deleteMany({ userId });
      await notificationsCollection.insertOne({
        userId,
        message,
        type,
        timestamp
      });
      
      // Gửi thông báo đến client
      io.to(socket.id).emit('notification', { 
        message,
        type,
        timestamp
      });
    } catch (error) {
      console.error('Error checking playing status:', error);
      io.to(socket.id).emit('notification', { 
        message: 'Lỗi khi kiểm tra trạng thái phát nhạc.',
        type: 'error',
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on("request-online-statuses", () => {
    // Send current online statuses to the requester
    const onlineUsers = [];
    io.sockets.sockets.forEach((sock) => {
      if (sock.accountId) {
        onlineUsers.push({
          accountId: sock.accountId,
          status: 'online'
        });
      }
    });
    socket.emit("online-statuses-batch", onlineUsers);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Disconnected: ${socket.id} | reason: ${reason} | remaining: ${io.engine.clientsCount}`);
    if (socket.accountId) {
      io.emit("user-status-update", {
        accountId: socket.accountId,
        status: 'offline'
      });
    }
  });
});

// Start server
const serverInstance = server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server đang chạy trên port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Socket endpoint: ws://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`${signal} received. Đóng server...`);
  serverInstance.close(async () => {
    console.log("HTTP + WebSocket server đã đóng.");
    await closeConnection();
    console.log("Đóng kết nối MongoDB.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Optional: print active connection count and memory usage every 30s (dev only)
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log(`Active socket connections: ${io.engine.clientsCount} | Memory: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
}, 30000);
