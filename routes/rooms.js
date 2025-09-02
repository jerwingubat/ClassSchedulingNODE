const express = require('express');
const Joi = require('joi');
const { db } = require('../config/firebase');
const { uid, expandRoomRange } = require('../utils/helpers');

const router = express.Router();

// Validation schema
const roomSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  type: Joi.string().valid('lecture', 'laboratory').required(),
  department: Joi.string().max(50).optional()
});

// Get all rooms for a department
router.get('/', async (req, res, next) => {
  try {
    const { department } = req.query;
    
    let query = db.collection('rooms');
    if (department) {
      query = query.where('department', '==', department);
    }
    
    const snapshot = await query.get();
    const rooms = [];
    
    snapshot.forEach(doc => {
      rooms.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(rooms);
  } catch (error) {
    next(error);
  }
});

// Get a specific room
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('rooms').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    next(error);
  }
});

// Create a new room
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = roomSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { name, type, department } = value;
    
    // Expand room range if provided
    const roomNames = expandRoomRange(name);
    const createdRooms = [];
    
    for (const roomName of roomNames) {
      const id = uid();
      const roomData = {
        id,
        name: roomName,
        type,
        department: department || 'General',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('rooms').doc(id).set(roomData);
      createdRooms.push(roomData);
    }
    
    res.status(201).json(createdRooms);
  } catch (error) {
    next(error);
  }
});

// Update a room
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = roomSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { name, type, department } = value;
    const roomData = {
      name,
      type,
      department: department || 'General',
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('rooms').doc(id).update(roomData);
    
    res.json({ id, ...roomData });
  } catch (error) {
    next(error);
  }
});

// Delete a room
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if room exists
    const roomDoc = await db.collection('rooms').doc(id).get();
    if (!roomDoc.exists) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    await db.collection('rooms').doc(id).delete();
    
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get rooms by type
router.get('/type/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { department } = req.query;
    
    if (!['lecture', 'laboratory'].includes(type)) {
      return res.status(400).json({ error: 'Invalid room type. Must be "lecture" or "laboratory"' });
    }
    
    let query = db.collection('rooms').where('type', '==', type);
    if (department) {
      query = query.where('department', '==', department);
    }
    
    const snapshot = await query.get();
    const rooms = [];
    
    snapshot.forEach(doc => {
      rooms.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(rooms);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
