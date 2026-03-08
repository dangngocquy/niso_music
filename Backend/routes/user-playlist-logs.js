const express = require("express");
const { connectDB } = require("../mongo");
const router = express.Router();

// POST - Save user playlist selection log (upsert: update if exists, create if new)
router.post("/", async (req, res) => {
  try {
    const { 
      accountId, 
      playlistId, 
      playlistName, 
      isPlaying,
      timestamp,
      scheduleDay,
      scheduleStartTime,
      scheduleEndTime,
      currentSongId,
      currentSongTitle,
      currentSongArtist,
      currentSongIndex
    } = req.body;

    // Validate required fields
    if (!accountId || !playlistId || !playlistName) {
      return res.status(400).json({
        error: "Thiếu thông tin cần thiết (accountId, playlistId, playlistName)"
      });
    }

    const collection = await connectDB("user_playlist_logs");

    // Upsert: update if exists, create if doesn't exist
    const logData = {
      accountId,
      playlistId,
      playlistName,
      isPlaying: isPlaying || false,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      updatedAt: new Date()
    };

    // Add schedule info if provided
    if (scheduleDay && scheduleStartTime && scheduleEndTime) {
      logData.scheduleDay = scheduleDay;
      logData.scheduleStartTime = scheduleStartTime;
      logData.scheduleEndTime = scheduleEndTime;
    }

    // Add song info if provided
    if (currentSongId) {
      logData.currentSongId = currentSongId;
      logData.currentSongTitle = currentSongTitle || 'N/A';
      logData.currentSongArtist = currentSongArtist || 'N/A';
      logData.currentSongIndex = currentSongIndex || 0;
    }

    const result = await collection.updateOne(
      { accountId }, // Filter: find by accountId
      {
        $set: logData,
        $setOnInsert: { createdAt: new Date() } // Only set createdAt on insert
      },
      { upsert: true } // Create if doesn't exist
    );

    res.status(201).json({
      message: result.upsertedId 
        ? "Tạo mới lựa chọn playlist thành công" 
        : "Cập nhật lựa chọn playlist thành công",
      data: {
        accountId,
        playlistId,
        playlistName,
        schedule: scheduleDay ? {
          day: scheduleDay,
          startTime: scheduleStartTime,
          endTime: scheduleEndTime
        } : null,
        isPlaying: isPlaying || false,
        currentSong: currentSongId ? {
          id: currentSongId,
          title: currentSongTitle,
          artist: currentSongArtist,
          index: currentSongIndex
        } : null,
        isNew: !!result.upsertedId
      }
    });
  } catch (error) {
    console.error("Lỗi khi ghi log playlist:", error);
    res.status(500).json({
      error: "Không thể ghi lại lựa chọn playlist",
      details: error.message
    });
  }
});

// GET - Get last selected playlist for an account with full playlist details
router.get("/last-selected/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;
    const logsCollection = await connectDB("user_playlist_logs");
    const playlistsCollection = await connectDB("playlists");

    const lastSelected = await logsCollection.findOne(
      { accountId },
      { sort: { timestamp: -1 } }
    );

    if (!lastSelected) {
      return res.json({
        message: "Chưa có lịch sử chọn playlist",
        data: null
      });
    }

    // Get full playlist details including songs
    const playlistDetails = await playlistsCollection.findOne(
      { _id: lastSelected.playlistId }
    );

    res.json({
      message: "Lấy playlist được chọn gần nhất thành công",
      data: {
        ...lastSelected,
        playlistDetails: playlistDetails || null
      }
    });
  } catch (error) {
    console.error("Lỗi khi lấy last selected playlist:", error);
    res.status(500).json({
      error: "Không thể lấy last selected playlist",
      details: error.message
    });
  }
});

// GET - Get all logs for a specific account
router.get("/account/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;
    const collection = await connectDB("user_playlist_logs");

    const logs = await collection
      .find({ accountId })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    res.json({
      message: "Lấy lịch sử lựa chọn playlist thành công",
      data: logs,
      count: logs.length
    });
  } catch (error) {
    console.error("Lỗi khi lấy log playlist:", error);
    res.status(500).json({
      error: "Không thể lấy lịch sử lựa chọn",
      details: error.message
    });
  }
});

// GET - Get logs for a specific playlist
router.get("/playlist/:playlistId", async (req, res) => {
  try {
    const { playlistId } = req.params;
    const collection = await connectDB("user_playlist_logs");

    const logs = await collection
      .find({ playlistId })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    res.json({
      message: "Lấy lịch sử phát playlist thành công",
      data: logs,
      count: logs.length
    });
  } catch (error) {
    console.error("Lỗi khi lấy log playlist:", error);
    res.status(500).json({
      error: "Không thể lấy lịch sử phát",
      details: error.message
    });
  }
});

// GET - Get all logs (admin)
router.get("/", async (req, res) => {
  try {
    const collection = await connectDB("user_playlist_logs");

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const total = await collection.countDocuments();
    const logs = await collection
      .find({})
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({
      message: "Lấy tất cả logs thành công",
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Lỗi khi lấy logs:", error);
    res.status(500).json({
      error: "Không thể lấy logs",
      details: error.message
    });
  }
});

// GET - Get statistics for a playlist
router.get("/stats/playlist/:playlistId", async (req, res) => {
  try {
    const { playlistId } = req.params;
    const collection = await connectDB("user_playlist_logs");

    const stats = await collection.aggregate([
      { $match: { playlistId } },
      {
        $group: {
          _id: "$accountId",
          count: { $sum: 1 },
          lastUsed: { $max: "$timestamp" }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    res.json({
      message: "Lấy thống kê playlist thành công",
      playlistId,
      stats,
      totalSelections: stats.reduce((sum, item) => sum + item.count, 0)
    });
  } catch (error) {
    console.error("Lỗi khi lấy thống kê:", error);
    res.status(500).json({
      error: "Không thể lấy thống kê",
      details: error.message
    });
  }
});

// GET - Get statistics for an account
router.get("/stats/account/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;
    const collection = await connectDB("user_playlist_logs");

    const stats = await collection.aggregate([
      { $match: { accountId } },
      {
        $group: {
          _id: "$playlistId",
          playlistName: { $first: "$playlistName" },
          count: { $sum: 1 },
          lastUsed: { $max: "$timestamp" }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    res.json({
      message: "Lấy thống kê tài khoản thành công",
      accountId,
      stats,
      totalPlaylists: stats.length,
      totalSelections: stats.reduce((sum, item) => sum + item.count, 0)
    });
  } catch (error) {
    console.error("Lỗi khi lấy thống kê:", error);
    res.status(500).json({
      error: "Không thể lấy thống kê tài khoản",
      details: error.message
    });
  }
});

module.exports = router;
