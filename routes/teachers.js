const express = require('express');
const Joi = require('joi');
const { db } = require('../config/firebase');
const { uid } = require('../utils/helpers');
const { computeTeacherWeeklyHours } = require('../utils/scheduling');

const router = express.Router();

// Validation schemas
const teacherSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  department: Joi.string().max(50).optional()
});

// Get all teachers for a department
router.get('/', async (req, res, next) => {
  try {
    const { department } = req.query;
    
    let query = db.collection('teachers');
    if (department) {
      query = query.where('department', '==', department);
    }
    
    const snapshot = await query.get();
    const teachers = [];
    
    snapshot.forEach(doc => {
      teachers.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(teachers);
  } catch (error) {
    next(error);
  }
});

// Get a specific teacher
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('teachers').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    next(error);
  }
});

// Create a new teacher
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = teacherSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { name, department } = value;
    const id = uid();
    const teacherData = {
      id,
      name,
      department: department || 'General',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('teachers').doc(id).set(teacherData);
    
    res.status(201).json(teacherData);
  } catch (error) {
    next(error);
  }
});

// Update a teacher
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = teacherSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { name, department } = value;
    const teacherData = {
      name,
      department: department || 'General',
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('teachers').doc(id).update(teacherData);
    
    res.json({ id, ...teacherData });
  } catch (error) {
    next(error);
  }
});

// Delete a teacher
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if teacher exists
    const teacherDoc = await db.collection('teachers').doc(id).get();
    if (!teacherDoc.exists) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // Remove teacher assignments from subjects
    const subjectsSnapshot = await db.collection('subjects')
      .where('teacherId', '==', id)
      .get();
    
    const batch = db.batch();
    subjectsSnapshot.forEach(doc => {
      batch.update(doc.ref, { teacherId: '' });
    });
    
    // Delete the teacher
    batch.delete(db.collection('teachers').doc(id));
    
    await batch.commit();
    
    res.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get teacher's weekly hours
router.get('/:id/weekly-hours', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { department } = req.query;
    
    // Get all subjects for this teacher
    let subjectsQuery = db.collection('subjects').where('teacherId', '==', id);
    if (department) {
      subjectsQuery = subjectsQuery.where('department', '==', department);
    }
    
    const subjectsSnapshot = await subjectsQuery.get();
    const subjects = [];
    subjectsSnapshot.forEach(doc => {
      subjects.push({ id: doc.id, ...doc.data() });
    });
    
    const weeklyHours = computeTeacherWeeklyHours(id, subjects);
    
    res.json({ teacherId: id, weeklyHours });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
