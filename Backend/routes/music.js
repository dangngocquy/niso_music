const express = require("express");
const router = express.Router();
const { connectDB } = require("../mongo");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { ObjectId } = require("mongodb");
const axios = require("axios");

// We will import music-metadata dynamically inside the route that needs it

// Setup storage for uploads
const uploadDir = path.join(__dirname, "../uploads");
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

// Separate upload middleware for audio files
const uploadAudio = multer({
  storage: storage,
  limits: { fileSize: 800 * 1024 * 1024 }, // 800MB
  fileFilter: (req, file, cb) => {
    const audioMimes = [
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
      "audio/x-m4a",
      "audio/aac"
    ];
    if (audioMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file audio"));
    }
  }
});

// Separate upload middleware for image files
const uploadImage = multer({
  storage: storage,
  limits: { fileSize: 800 * 1024 * 1024 }, // 800MB
  fileFilter: (req, file, cb) => {
    const imageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (imageMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh"));
    }
  }
});

// Get all music files with search and pagination
router.get("/", async (req, res) => {
  try {
    const collection = await connectDB("music");
   
    // Get query parameters
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 5; // Get limit from query, default 5
   
    // Build search filter
    const searchFilter = search ? {
      $or: [
        { title: { $regex: search, $options: "i" } },
        { artist: { $regex: search, $options: "i" } }
      ]
    } : {};
   
    // Calculate skip for pagination
    const skip = (page - 1) * limit;
   
    // Get total count for pagination
    const total = await collection.countDocuments(searchFilter);
   
    // Fetch music with search, sorting by newest first, and pagination
    const music = await collection
      .find(searchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
   
    res.json({
      success: "Lấy danh sách nhạc thành công",
      data: music,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching music:", error);
    res.status(500).json({ error: "Lỗi lấy danh sách nhạc" });
  }
});

// Load track by SoundCloud URL using oEmbed (no auth required)
router.get("/search-soundcloud", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "Vui lòng cung cấp URL SoundCloud" });
    }

    // Use oEmbed to get track metadata
    const response = await axios.get("https://soundcloud.com/oembed", {
      params: {
        format: "json",
        url: url
      }
    });

    const d = response.data;
    
    // Log response để debug
    console.log("SoundCloud oEmbed response:", {
      title: d.title,
      author_name: d.author_name,
      thumbnail_url: d.thumbnail_url,
      fields: Object.keys(d)
    });

    const track = {
      id: Date.now(),
      title: d.title || "Unknown",
      artist: d.author_name || "Unknown",
      duration: 0,
      artwork_url: d.thumbnail_url || null,
      thumbnail_url: d.thumbnail_url || null,
      permalink_url: url,
      created_at: new Date().toISOString()
    };

    res.json({
      success: "Tải dữ liệu thành công",
      data: [track]
    });
  } catch (error) {
    console.error("SoundCloud oEmbed error:", error.message);
    res.status(500).json({ error: "URL không hợp lệ hoặc không tìm thấy track" });
  }
});

// Import SoundCloud track metadata
router.post("/import-soundcloud", async (req, res) => {
  try {
    const { title, artist, duration, imagePath, externalUrl } = req.body;

    if (!title || !artist) {
      return res.status(400).json({ error: "Vui lòng nhập tên bài hát và ca sĩ" });
    }

    const musicData = {
      title,
      artist,
      duration: duration || 0,
      imagePath: imagePath || null,
      externalUrl,
      source: "soundcloud",
      createdAt: new Date()
    };

    const collection = await connectDB("music");
    const result = await collection.insertOne(musicData);

    res.json({
      success: "Thêm bài hát từ SoundCloud thành công",
      data: { _id: result.insertedId, ...musicData }
    });
  } catch (error) {
    console.error("Error importing SoundCloud track:", error);
    res.status(500).json({ error: "Lỗi thêm bài hát từ SoundCloud" });
  }
});

// Upload music file
router.post("/upload", uploadAudio.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Vui lòng chọn file" });
    }

    let duration = 0;
    try {
      const filePath = path.join(uploadDir, req.file.filename);

      // Dynamic import music-metadata (fixes ERR_PACKAGE_PATH_NOT_EXPORTED)
      const { parseFile } = await import("music-metadata");

      const metadata = await parseFile(filePath);
      
      // Try to get duration from format
      if (metadata.format && metadata.format.duration) {
        duration = metadata.format.duration;
        console.log(`✓ Extracted duration for ${req.file.originalname}: ${duration} seconds (${Math.floor(duration/60)}:${Math.floor(duration%60).toString().padStart(2, '0')})`);
      } else {
        console.warn(`⚠ No duration found in metadata for ${req.file.originalname}`);
      }
    } catch (metadataError) {
      console.warn(`⚠ Could not extract duration for ${req.file.originalname}:`, metadataError.message);
      // duration remains 0 - frontend will show 0:00
    }

    const musicData = {
      title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ""),
      artist: req.body.artist || "Không rõ",
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      duration: Math.round(duration),
      path: `/uploads/${req.file.filename}`,
      source: "uploaded",
      createdAt: new Date()
    };

    const collection = await connectDB("music");
    const result = await collection.insertOne(musicData);

    res.json({
      success: "Tải nhạc lên thành công",
      data: { _id: result.insertedId, ...musicData }
    });
  } catch (error) {
    console.error("Error uploading music:", error);
    res.status(500).json({ error: "Lỗi tải nhạc lên" });
  }
});

// Upload image for music
router.post("/:id/image", uploadImage.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Vui lòng chọn file ảnh" });
    }

    const collection = await connectDB("music");
    const music = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!music) {
      // Delete uploaded file if music doesn't exist
      const filePath = path.join(uploadDir, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(404).json({ error: "Không tìm thấy bài hát" });
    }

    // Delete old image if exists
    if (music.imagePath) {
      const oldImagePath = path.join(uploadDir, path.basename(music.imagePath));
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    const updateData = {
      imagePath: `/uploads/${req.file.filename}`,
      imageFilename: req.file.filename,
      updatedAt: new Date()
    };

    await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    const updatedMusic = await collection.findOne({ _id: new ObjectId(req.params.id) });

    res.json({
      success: "Tải ảnh lên thành công",
      data: updatedMusic
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Lỗi tải ảnh lên" });
  }
});

// Update music file (metadata only)
router.put("/:id", async (req, res) => {
  try {
    const collection = await connectDB("music");
    const music = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!music) {
      return res.status(404).json({ error: "Không tìm thấy bài hát" });
    }

    const updateData = {
      title: req.body.title || music.title,
      artist: req.body.artist || music.artist,
      updatedAt: new Date()
    };

    await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    const updatedMusic = await collection.findOne({ _id: new ObjectId(req.params.id) });

    res.json({
      success: "Cập nhật bài hát thành công",
      data: updatedMusic
    });
  } catch (error) {
    console.error("Error updating music:", error);
    res.status(500).json({ error: "Lỗi cập nhật bài hát" });
  }
});

// Delete music file
router.delete("/:id", async (req, res) => {
  try {
    const collection = await connectDB("music");
    const music = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!music) {
      return res.status(404).json({ error: "Không tìm thấy bài hát" });
    }

    // Delete audio file from server
    const filePath = path.join(uploadDir, music.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete image file if exists
    if (music.imageFilename) {
      const imagePath = path.join(uploadDir, music.imageFilename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete from database
    await collection.deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({ success: "Xóa bài hát thành công" });
  } catch (error) {
    console.error("Error deleting music:", error);
    res.status(500).json({ error: "Lỗi xóa bài hát" });
  }
});

module.exports = router;