const express = require('express');
const router = express.Router();
const { connectDB } = require('../mongo');

// Get free play permissions (public)
router.get('/freeplay', async (req, res) => {
  try {
    const collection = await connectDB('permissions');
    const doc = await collection.findOne({ type: 'freeplay' });
    const permissions = doc ? doc.accountIds : [];
    res.json({ success: true, permissions });
  } catch (err) {
    console.error('Error fetching permissions:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Save free play permissions (admin only)
router.post('/freeplay', async (req, res) => {
  try {
    const { accountIds } = req.body;
    const collection = await connectDB('permissions');
    await collection.replaceOne(
      { type: 'freeplay' },
      { type: 'freeplay', accountIds },
      { upsert: true }
    );
    res.json({ success: true, message: 'Permissions saved' });
  } catch (err) {
    console.error('Error saving permissions:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;