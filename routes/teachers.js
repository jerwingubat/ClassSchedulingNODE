const express = require('express');
const Joi = require('joi');
const { db } = require('../config/firebase');
const { uid } = require('../utils/helpers');
const { computeTeacherWeeklyHours } = require('../utils/scheduling');

const router = express.Router();

const teacherSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  department: Joi.string().max(50).optional()
});

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

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const teacherDoc = await db.collection('teachers').doc(id).get();
    if (!teacherDoc.exists) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    const subjectsSnapshot = await db.collection('subjects')
      .where('teacherId', '==', id)
      .get();
    
    const batch = db.batch();
    subjectsSnapshot.forEach(doc => {
      batch.update(doc.ref, { teacherId: '' });
    });
    
    batch.delete(db.collection('teachers').doc(id));
    
    await batch.commit();
    
    res.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/weekly-hours', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { department } = req.query;
    
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
