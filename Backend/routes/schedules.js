const express = require("express");
const { connectDB } = require("../mongo");
const { ObjectId } = require("mongodb");

module.exports = () => {
  const router = express.Router();

// Helper function to validate time format (HH:MM)
const isValidTimeFormat = (time) => {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

// Helper function to compare times
const compareTime = (time1, time2) => {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  const t1 = h1 * 60 + m1;
  const t2 = h2 * 60 + m2;
  return t1 - t2;
};

// ===== CREATE - Tạo lịch phát mới =====
router.post("/", async (req, res) => {
  try {
    const collection = await connectDB("schedules");
    const { playlists, accounts, day, startTime, endTime, date, recurrence } = req.body;

    // Validation
    if (!playlists || !accounts || !day || !startTime || !endTime) {
      return res.status(400).json({
        error: "Vui lòng cung cấp đầy đủ thông tin: playlists, accounts, day, startTime, endTime"
      });
    }

    if (!recurrence || !['one-time', 'weekly'].includes(recurrence)) {
      return res.status(400).json({
        error: "Vui lòng chọn kiểu lặp lại hợp lệ: one-time hoặc weekly"
      });
    }

    if (recurrence === 'one-time' && !date) {
      return res.status(400).json({
        error: "Vui lòng cung cấp date cho lịch phát một lần"
      });
    }

    // Validate time format
    if (!isValidTimeFormat(startTime)) {
      return res.status(400).json({
        error: "Định dạng thời gian bắt đầu không hợp lệ. Sử dụng định dạng HH:MM"
      });
    }

    if (!isValidTimeFormat(endTime)) {
      return res.status(400).json({
        error: "Định dạng thời gian kết thúc không hợp lệ. Sử dụng định dạng HH:MM"
      });
    }

    // Validate that times are different
    if (startTime === endTime) {
      return res.status(400).json({
        error: "Thời gian bắt đầu và kết thúc phải khác nhau"
      });
    }

    // Ensure playlists is array
    const playlistsArray = Array.isArray(playlists) ? playlists : [playlists];
    const accountsArray = Array.isArray(accounts) ? accounts : [accounts];
    
    if (playlistsArray.length === 0) {
      return res.status(400).json({
        error: "Vui lòng chọn ít nhất một danh mục phát"
      });
    }

    if (accountsArray.length === 0) {
      return res.status(400).json({
        error: "Vui lòng chọn ít nhất một tài khoản"
      });
    }

    // Validate all playlist and account IDs
    for (let pId of playlistsArray) {
      if (!ObjectId.isValid(pId)) {
        return res.status(400).json({
          error: "Invalid playlist ID: " + pId
        });
      }
    }

    for (let aId of accountsArray) {
      if (!ObjectId.isValid(aId)) {
        return res.status(400).json({
          error: "Invalid account ID: " + aId
        });
      }
    }

    const newSchedule = {
      playlists: playlistsArray.map(p => new ObjectId(p)),
      accounts: accountsArray.map(a => new ObjectId(a)),
      day,
      date: date || null,
      startTime,
      endTime,
      recurrence,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(newSchedule);

    res.status(201).json({
      success: "Tạo lịch phát thành công",
      data: {
        _id: result.insertedId,
        ...newSchedule
      }
    });

    // Emit real-time update
    global.io.emit('schedule-updated');
  } catch (err) {
    console.error("Error creating schedule:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== READ - Lấy danh sách lịch phát =====
router.get("/", async (req, res) => {
  try {
    const collection = await connectDB("schedules");
    const { search = "", page = 1, limit = 10 } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    // Build search filter
    const searchFilter = search
      ? {
          $or: [
            { day: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    // Get total count for pagination
    const total = await collection.countDocuments(searchFilter);
    const totalPages = Math.ceil(total / limitNum);

    // Get schedules with population
    const schedules = await collection
      .aggregate([
        { $match: searchFilter },
        {
          $lookup: {
            from: "playlists",
            localField: "playlists",
            foreignField: "_id",
            as: "playlists"
          }
        },
        {
          $lookup: {
            from: "accounts",
            localField: "accounts",
            foreignField: "_id",
            as: "accounts"
          }
        },
        {
          $project: {
            _id: 1,
            day: 1,
            date: 1,
            startTime: 1,
            endTime: 1,
            recurrence: 1,
            playlists: 1,
            accounts: 1,
            createdAt: 1,
            updatedAt: 1
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum }
      ])
      .toArray();

    res.json({
      success: "Lấy danh sách lịch phát thành công",
      data: schedules,
      pagination: {
        total,
        totalPages,
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (err) {
    console.error("Error fetching schedules:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== GET - Lấy lịch phát theo tài khoản =====
router.get("/account/:accountId", async (req, res) => {
  try {
    const collection = await connectDB("schedules");
    const { accountId } = req.params;

    if (!ObjectId.isValid(accountId)) {
      return res.status(400).json({ error: "Invalid account ID" });
    }

    const schedules = await collection
      .aggregate([
        { $match: { accounts: new ObjectId(accountId) } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "playlists",
            localField: "playlists",
            foreignField: "_id",
            as: "playlists"
          }
        },
        {
          $unwind: {
            path: "$playlists",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "music",
            localField: "playlists.songs",
            foreignField: "_id",
            as: "playlists.songs"
          }
        },
        {
          $group: {
            _id: "$_id",
            day: { $first: "$day" },
            date: { $first: "$date" },
            startTime: { $first: "$startTime" },
            endTime: { $first: "$endTime" },
            recurrence: { $first: "$recurrence" },
            createdAt: { $first: "$createdAt" },
            updatedAt: { $first: "$updatedAt" },
            playlists: { $push: "$playlists" },
            accounts: { $first: "$accounts" },
            originalCreatedAt: { $first: "$createdAt" }
          }
        },
        {
          $lookup: {
            from: "accounts",
            localField: "accounts",
            foreignField: "_id",
            as: "accounts"
          }
        },
        { $sort: { createdAt: -1 } }
      ])
      .toArray();

    res.json({
      success: "Lấy danh sách lịch phát theo tài khoản thành công",
      data: schedules
    });
  } catch (err) {
    console.error("Error fetching schedules by account:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== READ - Lấy lịch phát theo ID =====
router.get("/:id", async (req, res) => {
  try {
    const collection = await connectDB("schedules");
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid schedule ID" });
    }

    const schedule = await collection.findOne({ _id: new ObjectId(id) });

    if (!schedule) {
      return res.status(404).json({ error: "Không tìm thấy lịch phát" });
    }

    res.json({
      success: "Lấy thông tin lịch phát thành công",
      data: schedule
    });
  } catch (err) {
    console.error("Error fetching schedule:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== UPDATE - Cập nhật lịch phát =====
router.put("/:id", async (req, res) => {
  try {
    const collection = await connectDB("schedules");
    const { id } = req.params;
    const { playlists, accounts, day, startTime, endTime, date, recurrence } = req.body;

    console.log('=== UPDATE SCHEDULE ===');
    console.log('Schedule ID:', id);
    console.log('ID is valid ObjectId:', ObjectId.isValid(id));
    console.log('Request body:', { playlists, accounts, day, startTime, endTime, date });

    if (!ObjectId.isValid(id)) {
      console.log('Invalid ObjectId format');
      return res.status(400).json({ error: "Invalid schedule ID format" });
    }

    // Check if schedule exists first
    const existingSchedule = await collection.findOne({ _id: new ObjectId(id) });
    console.log('Existing schedule found:', !!existingSchedule);
    
    if (!existingSchedule) {
      console.log('Schedule not found in database');
      return res.status(404).json({ error: "Không tìm thấy lịch phát với ID: " + id });
    }

    // Validate time format if provided
    if (startTime && !isValidTimeFormat(startTime)) {
      return res.status(400).json({ error: "Invalid start time format (HH:mm)" });
    }
    if (endTime && !isValidTimeFormat(endTime)) {
      return res.status(400).json({ error: "Invalid end time format (HH:mm)" });
    }

    if (recurrence && !['one-time', 'weekly'].includes(recurrence)) {
      return res.status(400).json({
        error: "Vui lòng chọn kiểu lặp lại hợp lệ: one-time hoặc weekly"
      });
    }

    const updateData = {};
    if (playlists) {
      const playlistsArray = Array.isArray(playlists) ? playlists : [playlists];
      updateData.playlists = playlistsArray.map(p => new ObjectId(p));
    }
    if (accounts) {
      const accountsArray = Array.isArray(accounts) ? accounts : [accounts];
      updateData.accounts = accountsArray.map(a => new ObjectId(a));
    }
    if (day) updateData.day = day;
    if (date) updateData.date = date;
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (recurrence) updateData.recurrence = recurrence;

    updateData.updatedAt = new Date();

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: "after" }
    );

    res.json({
      success: "Schedule updated successfully",
      data: result.value
    });

    // Emit real-time update
    global.io.emit('schedule-updated');
  } catch (err) {
    console.error("Error updating schedule:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== DELETE - Xóa lịch phát =====
router.delete("/:id", async (req, res) => {
  try {
    const collection = await connectDB("schedules");
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid schedule ID" });
    }

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy lịch phát" });
    }

    res.json({
      success: "Xóa lịch phát thành công",
      deletedId: id
    });

    // Emit real-time update
    global.io.emit('schedule-updated');
  } catch (err) {
    console.error("Error deleting schedule:", err);
    res.status(500).json({ error: err.message });
  }
});

  return router;
};
