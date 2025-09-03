const express = require('express');
const router = express.Router();
const pylonService = require('../services/pylonService');
const { cache } = require('../middleware/cache');

// Get all users
router.get('/', async (req, res) => {
  try {
    const cacheKey = 'users:all';
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const response = await pylonService.getUsers();
    const users = response.data || [];
    
    const result = {
      users: users.filter(user => user.status === 'active'), // Only active users
      count: users.filter(user => user.status === 'active').length,
      total: users.length
    };

    await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    res.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const cacheKey = `users:${userId}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const response = await pylonService.getUsers();
    const users = response.data || [];
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await cache.set(cacheKey, user, 60); // Cache for 60 seconds
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
