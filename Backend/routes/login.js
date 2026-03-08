const express = require("express");
const { connectDB } = require("../mongo");

const router = express.Router();

// POST /api/login
router.post("/login", async (req, res) => {
  try {
    const { username, password, ipAddress, location } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: "Vui lòng nhập username và password" 
      });
    }

    const accountsCollection = await connectDB("accounts");
    const user = await accountsCollection.findOne({ username });

    if (!user) {
      return res.status(401).json({ 
        error: "Tài khoản không tồn tại" 
      });
    }

    // Kiểm tra password (trong production dùng bcrypt)
    if (user.password !== password) {
      return res.status(401).json({ 
        error: "Password sai" 
      });
    }

    // Đăng nhập thành công, trả về user object với permission
    return res.status(200).json({ 
      success: "Đăng nhập thành công",
      user: {
        _id: user._id.toString(),
        username: user.username,
        restaurantName: user.restaurantName,
        permission: user.permission,
        role: user.role || 'user'
      },
      ipAddress: ipAddress || null,
      location: location || null
    });
  } catch (error) {
    console.error("Lỗi login:", error);
    res.status(500).json({ 
      error: "Lỗi server" 
    });
  }
});

module.exports = router;
