const express = require('express');
const Joi = require('joi');
const { db } = require('../config/firebase');

const router = express.Router();

const departmentSchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
});

router.get('/', async (req, res, next) => {
  try {
    const snapshot = await db.collection('departments').get();
    const departments = [];
    
    snapshot.forEach(doc => {
      departments.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(departments);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('departments').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    next(error);
  }
});


router.post('/', async (req, res, next) => {
  try {
    const { error, value } = departmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { name } = value;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const existingDoc = await db.collection('departments').doc(id).get();
    if (existingDoc.exists) {
      return res.status(409).json({ error: 'Department already exists' });
    }
    
    const departmentData = {
      id,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('departments').doc(id).set(departmentData);
    
    res.status(201).json(departmentData);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = departmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { name } = value;
    const departmentData = {
      name,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('departments').doc(id).update(departmentData);
    
    res.json({ id, ...departmentData });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if department exists
    const departmentDoc = await db.collection('departments').doc(id).get();
    if (!departmentDoc.exists) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    // Check if there are any teachers, subjects, or rooms in this department
    const [teachersSnapshot, subjectsSnapshot, roomsSnapshot] = await Promise.all([
      db.collection('teachers').where('department', '==', id).limit(1).get(),
      db.collection('subjects').where('department', '==', id).limit(1).get(),
      db.collection('rooms').where('department', '==', id).limit(1).get()
    ]);
    
    if (!teachersSnapshot.empty || !subjectsSnapshot.empty || !roomsSnapshot.empty) {
      return res.status(409).json({ 
        error: 'Cannot delete department. It contains teachers, subjects, or rooms.' 
      });
    }
    
    await db.collection('departments').doc(id).delete();
    
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
