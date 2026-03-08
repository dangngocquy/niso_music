const express = require('express');
const router = express.Router();
const { connectDB } = require('../mongo');

// POST - Record login/logout event
router.post('/', async (req, res) => {
  try {
    const { accountId, status, username, restaurantName, ipAddress, location } = req.body;

    const collection = await connectDB('login_logs');

    // Upsert - update existing account record with latest login/logout info
    const result = await collection.updateOne(
      { accountId },
      {
        $set: {
          accountId,
          username,
          restaurantName,
          status, // 'online', 'offline'
          ipAddress: ipAddress || null,
          location: location || null,
          lastStatusChange: new Date(),
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Status recorded',
      data: result
    });
  } catch (err) {
    console.error('Error recording login status:', err);
    res.status(500).json({
      error: 'Failed to record status',
      details: err.message
    });
  }
});

// GET - Get current login status for all accounts
router.get('/', async (req, res) => {
  try {
    const collection = await connectDB('login_logs');

    const logs = await collection.find({}).sort({ lastStatusChange: -1 }).toArray();

    res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    console.error('Error fetching login logs:', err);
    res.status(500).json({
      error: 'Failed to fetch login logs',
      details: err.message
    });
  }
});

// GET - Get login status for specific account
router.get('/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const collection = await connectDB('login_logs');

    const log = await collection.findOne({ accountId });

    res.json({
      success: true,
      data: log || null
    });
  } catch (err) {
    console.error('Error fetching login status:', err);
    res.status(500).json({
      error: 'Failed to fetch login status',
      details: err.message
    });
  }
});

module.exports = router;
