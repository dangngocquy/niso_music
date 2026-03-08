const express = require("express");
const { connectDB } = require("../mongo");
const { ObjectId } = require("mongodb");

module.exports = () => {
  const router = express.Router();

// GET all albums
router.get("/", async (req, res) => {
  try {
    const collection = await connectDB("albums");

    const albums = await collection
      .aggregate([
        {
          $lookup: {
            from: "music",
            let: { songIds: "$songs" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $in: ["$_id", "$$songIds"] },
                      { $in: [{ $toString: "$_id" }, "$$songIds"] }
                    ]
                  }
                }
              }
            ],
            as: "songs"
          }
        },
        {
          $sort: { createdAt: -1 }
        }
      ])
      .toArray();

    res.json({
      success: "Lấy danh sách albums thành công",
      data: albums
    });
  } catch (error) {
    console.error("Lỗi lấy albums:", error);
    res.status(500).json({
      error: "Lỗi server"
    });
  }
});

// POST create new album
router.post("/", async (req, res) => {
  try {
    const collection = await connectDB("albums");

    // Kiểm tra tên album đã tồn tại
    if (req.body.name) {
      const existingAlbum = await collection.findOne({ name: req.body.name.trim() });
      if (existingAlbum) {
        return res.status(409).json({ error: "Tên album đã tồn tại" });
      }
    }

    const albumData = {
      ...req.body,
      name: req.body.name ? req.body.name.trim() : req.body.name,
      songs: req.body.songs ? req.body.songs.map(id => new ObjectId(id)) : [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(albumData);

    res.json({
      success: "Tạo album thành công",
      data: { ...albumData, _id: result.insertedId }
    });

    // Emit real-time update
    global.io.emit('album-updated');
  } catch (error) {
    console.error("Lỗi tạo album:", error);
    res.status(500).json({
      error: "Lỗi server"
    });
  }
});

// PUT update album
router.put("/:id", async (req, res) => {
  try {
    const collection = await connectDB("albums");

    const albumId = req.params.id;
    
    // Kiểm tra tên album đã tồn tại (nếu có thay đổi)
    if (req.body.name) {
      const existingAlbum = await collection.findOne({ 
        name: req.body.name.trim(),
        _id: { $ne: ObjectId.isValid(albumId) ? new ObjectId(albumId) : albumId }
      });
      if (existingAlbum) {
        return res.status(409).json({ error: "Tên album đã tồn tại" });
      }
    }

    const updateData = {
      ...req.body,
      name: req.body.name ? req.body.name.trim() : req.body.name,
      songs: req.body.songs ? req.body.songs.map(id => new ObjectId(id)) : [],
      updatedAt: new Date()
    };

    // Handle both ObjectId and string IDs
    let query;
    if (ObjectId.isValid(albumId)) {
      query = { _id: new ObjectId(albumId) };
    } else {
      query = { _id: albumId };
    }

    const result = await collection.updateOne(
      query,
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: "Không tìm thấy album"
      });
    }

    res.json({
      success: "Cập nhật album thành công"
    });

    // Emit real-time update
    global.io.emit('album-updated');
  } catch (error) {
    console.error("Lỗi cập nhật album:", error);
    res.status(500).json({
      error: "Lỗi server"
    });
  }
});

// DELETE album
router.delete("/:id", async (req, res) => {
  try {
    const collection = await connectDB("albums");

    const albumId = req.params.id;

    // Handle both ObjectId and string IDs
    let query;
    if (ObjectId.isValid(albumId)) {
      query = { _id: new ObjectId(albumId) };
    } else {
      query = { _id: albumId };
    }

    const result = await collection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: "Không tìm thấy album"
      });
    }

    res.json({
      success: "Xóa album thành công"
    });

    // Emit real-time update
    global.io.emit('album-updated');
  } catch (error) {
    console.error("Lỗi xóa album:", error);
    res.status(500).json({
      error: "Lỗi server"
    });
  }
});

  return router;
};