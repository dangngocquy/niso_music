const express = require("express");
const { connectDB } = require("../mongo");
const { ObjectId } = require("mongodb");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

module.exports = () => {
  const router = express.Router();

// Setup storage for uploads
const uploadDir = path.join(__dirname, "../uploads/list");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Upload middleware for playlist images
const uploadImage = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const imageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (imageMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh"));
    }
  }
});

// Get playlists by account ID (for user playback)
router.get("/account/:accountId", async (req, res) => {
  try {
    const collection = await connectDB("playlists");
    const { accountId } = req.params;
    
    // Validate accountId format
    if (!accountId || accountId.length < 24) {
      return res.status(400).json({ error: "Invalid account ID" });
    }
    
    // Get playlists for the specific account, sorted by day and startTime
    const playlists = await collection
      .find({ account: new ObjectId(accountId) })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log(`Fetched ${playlists.length} playlists for account ${accountId}`);
    
    // Populate songs data for each playlist
    const musicCollection = await connectDB("music");
    const populatedPlaylists = await Promise.all(
      playlists.map(async (playlist) => {
        const songs = await Promise.all(
          (playlist.songs || []).map(async (songId) => {
            const song = await musicCollection.findOne({ 
              _id: new ObjectId(songId) 
            });
            return song || { _id: songId, title: "Bài hát không tìm thấy" };
          })
        );
        // Sort songs by createdAt descending (newest first), then by title for consistent order
        console.log('Before sort - Songs:', songs.map(s => ({ title: s.title, createdAt: s.createdAt })));
        const sortedSongs = songs.sort((a, b) => {
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : -Infinity;
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : -Infinity;
          // If dates are same, sort by title
          if (aDate === bDate) {
            return (a.title || '').localeCompare(b.title || '');
          }
          return bDate - aDate;
        });
        console.log('After sort - Songs:', sortedSongs.map(s => ({ title: s.title, createdAt: s.createdAt })));
        return { ...playlist, songs: sortedSongs };
      })
    );

    res.json({ 
      success: "Lấy danh sách danh mục theo tài khoản thành công",
      data: populatedPlaylists
    });
  } catch (error) {
    console.error("Error fetching playlists by account:", error);
    res.status(500).json({ error: "Lỗi lấy danh sách danh mục" });
  }
});

// Get all playlists with search and pagination
router.get("/", async (req, res) => {
  try {
    const collection = await connectDB("playlists");
    
    // Get query parameters
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 5; // Get limit from query, default 5
    
    // Build search filter
    const searchFilter = search ? {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { day: { $regex: search, $options: "i" } }
      ]
    } : {};
    
    // Calculate skip for pagination
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await collection.countDocuments(searchFilter);
    
    // Fetch playlists with search, sorting by newest first, and pagination
    const playlists = await collection
      .find(searchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Populate songs data
    const musicCollection = await connectDB("music");
    const populatedPlaylists = await Promise.all(
      playlists.map(async (playlist) => {
        const songs = await Promise.all(
          (playlist.songs || []).map(async (songId) => {
            const song = await musicCollection.findOne({ 
              _id: new ObjectId(songId) 
            });
            return song || { _id: songId, title: "Bài hát không tìm thấy" };
          })
        );
        return { ...playlist, songs };
      })
    );

    res.json({ 
      success: "Lấy danh sách danh mục thành công",
      data: populatedPlaylists,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching playlists:", error);
    res.status(500).json({ error: "Lỗi lấy danh sách danh mục" });
  }
});

// Create playlist
router.post("/", async (req, res) => {
  try {
    let { name, songs } = req.body;

    // Normalize songs to array
    if (typeof songs === 'string') {
      songs = [songs];
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Vui lòng nhập tên danh mục" });
    }

    if (!Array.isArray(songs) || songs.length === 0) {
      return res.status(400).json({ error: "Vui lòng chọn ít nhất một bài hát" });
    }

    const collection = await connectDB("playlists");
    
    // Kiểm tra tên playlist đã tồn tại
    const existingPlaylist = await collection.findOne({ name: name.trim() });
    if (existingPlaylist) {
      return res.status(409).json({ error: "Tên playlist đã tồn tại" });
    }

    const playlistData = {
      name: name.trim(),
      songs: songs.map(songId => new ObjectId(songId)),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(playlistData);

    res.json({
      success: "Tạo danh mục thành công",
      data: { _id: result.insertedId, ...playlistData }
    });

    // Emit real-time update
    global.io.emit('playlist-updated');

    // Emit real-time update
    io.emit('playlist-updated');
  } catch (error) {
    console.error("Error creating playlist:", error);
    res.status(500).json({ error: "Lỗi tạo danh mục" });
  }
});

// Update playlist
router.put("/:id", async (req, res) => {
  try {
    let { name, songs } = req.body;

    // Normalize songs to array
    if (typeof songs === 'string') {
      songs = [songs];
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Vui lòng nhập tên danh mục" });
    }

    if (!Array.isArray(songs) || songs.length === 0) {
      return res.status(400).json({ error: "Vui lòng chọn ít nhất một bài hát" });
    }

    const collection = await connectDB("playlists");
    
    // Kiểm tra tên playlist đã tồn tại (trừ playlist hiện tại)
    const existingPlaylist = await collection.findOne({ 
      name: name.trim(),
      _id: { $ne: new ObjectId(req.params.id) }
    });
    if (existingPlaylist) {
      return res.status(409).json({ error: "Tên playlist đã tồn tại" });
    }

    const updateData = {
      name: name.trim(),
      songs: songs.map(songId => 
        songId instanceof ObjectId ? songId : new ObjectId(songId)
      ),
      updatedAt: new Date()
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy danh mục" });
    }

    res.json({ success: "Cập nhật danh mục thành công" });

    // Emit real-time update
    global.io.emit('playlist-updated');
  } catch (error) {
    console.error("Error updating playlist:", error);
    res.status(500).json({ error: "Lỗi cập nhật danh mục" });
  }
});

// Delete playlist
router.delete("/:id", async (req, res) => {
  try {
    const collection = await connectDB("playlists");
    const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy danh mục" });
    }

    res.json({ success: "Xóa danh mục thành công" });

    // Emit real-time update
    global.io.emit('playlist-updated');
  } catch (error) {
    console.error("Error deleting playlist:", error);
    res.status(500).json({ error: "Lỗi xóa danh mục" });
  }
});

// Delete song from all playlists (cascade delete)
router.delete("/song/:songId", async (req, res) => {
  try {
    const collection = await connectDB("playlists");
    const songId = req.params.songId;

    // Remove the song from all playlists
    const result = await collection.updateMany(
      { songs: new ObjectId(songId) },
      { $pull: { songs: new ObjectId(songId) } }
    );

    res.json({ 
      success: "Đã xóa bài hát khỏi tất cả danh mục",
      modifiedCount: result.modifiedCount
    });

    // Emit real-time update
    global.io.emit('playlist-updated');
  } catch (error) {
    console.error("Error deleting song from playlists:", error);
    res.status(500).json({ error: "Lỗi xóa bài hát khỏi danh mục" });
  }
});

// Upload image for playlist
router.post("/:id/image", uploadImage.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Vui lòng chọn file ảnh" });
    }

    const collection = await connectDB("playlists");
    const playlist = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!playlist) {
      return res.status(404).json({ error: "Không tìm thấy danh mục" });
    }

    // Delete old image if exists
    if (playlist.imagePath) {
      try {
        const oldImagePath = path.join(__dirname, "..", playlist.imagePath);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      } catch (err) {
        console.error("Error deleting old image:", err);
      }
    }

    const updateData = {
      imagePath: `/uploads/list/${req.file.filename}`,
      imageFilename: req.file.filename,
      updatedAt: new Date()
    };

    await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    const updatedPlaylist = await collection.findOne({ _id: new ObjectId(req.params.id) });
    res.json({
      success: "Tải ảnh lên thành công",
      data: updatedPlaylist
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Lỗi tải ảnh lên" });
  }
});

  return router;
};
