const express = require("express");
const { connectDB } = require("../mongo");
const { ObjectId } = require("mongodb");

const router = express.Router();

// GET all accounts with search and pagination
router.get("/", async (req, res) => {
  try {
    const accountsCollection = await connectDB("accounts");
    
    // Get query parameters
    const search = req.query.search || "";
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const onlineFilter = req.query.onlineFilter || "all";
    const playingFilter = req.query.playingFilter || "all";
    const limit = req.query.limit ? parseInt(req.query.limit) : 5; // Get limit from query, default 5
    
    // Build search filter
    const searchFilter = search ? {
      $or: [
        { username: { $regex: search, $options: "i" } },
        { restaurantName: { $regex: search, $options: "i" } }
      ]
    } : {};
    
    // Get all matching accounts first (before pagination)
    let allAccounts = await accountsCollection
      .find(searchFilter)
      .sort({ createdAt: -1 })
      .toArray();
    
    // Get online users from socket.io
    const onlineUsers = new Set();
    const io = require("../server");
    if (global.io) {
      global.io.sockets.sockets.forEach((sock) => {
        if (sock.accountId) {
          onlineUsers.add(sock.accountId);
        }
      });
    }
    
    // Get playing statuses
    const playingStatuses = new Map();
    if (global.playingStatuses) {
      global.playingStatuses.forEach((status, accountId) => {
        playingStatuses.set(accountId, status);
      });
    }
    
    // Apply online/offline filter
    if (onlineFilter !== 'all') {
      allAccounts = allAccounts.filter(account => {
        const isOnline = onlineUsers.has(account._id.toString());
        return onlineFilter === 'online' ? isOnline : !isOnline;
      });
    }
    
    // Apply playing/not playing filter
    if (playingFilter !== 'all') {
      allAccounts = allAccounts.filter(account => {
        const playingStatus = playingStatuses.get(account._id.toString());
        const isPlaying = playingStatus && playingStatus.isPlaying;
        return playingFilter === 'playing' ? isPlaying : !isPlaying;
      });
    }
    
    // Now apply pagination to filtered results
    const total = allAccounts.length;
    const skip = (page - 1) * limit;
    const accounts = allAccounts.slice(skip, skip + limit);
    
    const pagination = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
    
    res.json({ 
      success: "Lấy danh sách tài khoản", 
      data: accounts,
      pagination
    });
  } catch (error) {
    console.error("Lỗi lấy accounts:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// CREATE account
router.post("/", async (req, res) => {
  try {
    const { username, password, restaurantName, permission } = req.body;

    if (!username || !password || !restaurantName) {
      return res.status(400).json({ 
        error: "Vui lòng điền đầy đủ thông tin" 
      });
    }

    const accountsCollection = await connectDB("accounts");
    
    // Kiểm tra username đã tồn tại
    const existingUser = await accountsCollection.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ 
        error: "Username đã tồn tại" 
      });
    }

    // Kiểm tra tên tài khoản đã tồn tại
    const existingRestaurant = await accountsCollection.findOne({ restaurantName });
    if (existingRestaurant) {
      return res.status(409).json({ 
        error: "Tên tài khoản đã tồn tại" 
      });
    }

    const newAccount = {
      username,
      password, // Trong production nên mã hóa password
      restaurantName,
      permission: permission === true || permission === "true",
      createdAt: new Date()
    };

    const result = await accountsCollection.insertOne(newAccount);
    res.status(201).json({ 
      success: "Tạo tài khoản thành công",
      data: { _id: result.insertedId, ...newAccount }
    });
  } catch (error) {
    console.error("Lỗi tạo account:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// UPDATE account
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, restaurantName, permission, freePlayAllowed, currentPlaylist } = req.body;

    const accountsCollection = await connectDB("accounts");
    
    // Kiểm tra tên tài khoản đã tồn tại (nếu có thay đổi)
    if (restaurantName) {
      const existingRestaurant = await accountsCollection.findOne({ 
        restaurantName,
        _id: { $ne: ObjectId.isValid(id) ? new ObjectId(id) : id }
      });
      if (existingRestaurant) {
        return res.status(409).json({ 
          error: "Tên tài khoản đã tồn tại" 
        });
      }
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (password) updateData.password = password;
    if (restaurantName) updateData.restaurantName = restaurantName;
    if (permission !== undefined) updateData.permission = permission === true || permission === "true";
    if (freePlayAllowed !== undefined) updateData.freePlayAllowed = freePlayAllowed;
    if (currentPlaylist !== undefined) updateData.currentPlaylist = currentPlaylist;
    updateData.updatedAt = new Date();

    // Handle both ObjectId and string IDs
    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }

    const result = await accountsCollection.updateOne(
      query,
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        error: "Tài khoản không tồn tại" 
      });
    }

    res.json({ 
      success: "Cập nhật tài khoản thành công",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Lỗi cập nhật account:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// DELETE account
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const accountsCollection = await connectDB("accounts");
    
    // Handle both ObjectId and string IDs
    let query;
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { _id: id };
    }
    
    const result = await accountsCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        error: "Tài khoản không tồn tại" 
      });
    }

    res.json({ 
      success: "Xóa tài khoản thành công"
    });
  } catch (error) {
    console.error("Lỗi xóa account:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// RESET free play permissions for all accounts
router.put("/reset-free-play", async (req, res) => {
  try {
    const accountsCollection = await connectDB("accounts");
    
    const result = await accountsCollection.updateMany(
      {},
      { $set: { freePlayAllowed: false, updatedAt: new Date() } }
    );

    res.json({ 
      success: "Đã reset quyền phát tự do cho tất cả tài khoản",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Lỗi reset free play:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// GET play mode for a specific account
router.get("/:accountId/playmode", async (req, res) => {
  try {
    const accountsCollection = await connectDB("accounts");
    const { accountId } = req.params;

    const account = await accountsCollection.findOne({ _id: new ObjectId(accountId) });
    
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json({ 
      playMode: account.playMode || 'schedule' // Default to 'schedule' if not set
    });
  } catch (error) {
    console.error("Lỗi lấy play mode:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// SET play mode for a specific account
router.post("/:accountId/playmode", async (req, res) => {
  try {
    const accountsCollection = await connectDB("accounts");
    const { accountId } = req.params;
    const { playMode } = req.body;

    // Validate playMode
    if (!playMode || !['schedule', 'freeplay'].includes(playMode)) {
      return res.status(400).json({ error: "Invalid playMode. Must be 'schedule' or 'freeplay'" });
    }

    const result = await accountsCollection.updateOne(
      { _id: new ObjectId(accountId) },
      { 
        $set: { 
          playMode: playMode,
          updatedAt: new Date() 
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json({ 
      success: true,
      message: "Play mode updated successfully",
      playMode: playMode
    });
  } catch (error) {
    console.error("Lỗi cập nhật play mode:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

module.exports = router;
