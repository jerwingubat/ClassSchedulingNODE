const express = require('express');
const Joi = require('joi');
const { db } = require('../config/firebase');
const { uid, expandSectionRange, parseBulkInput } = require('../utils/helpers');

const router = express.Router();

const subjectSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  section: Joi.string().max(20).optional().allow(''),
  units: Joi.number().valid(1, 3, 4).required(),
  teacherId: Joi.string().max(50).optional().allow(''),
  department: Joi.string().max(50).optional()
});

const bulkImportSchema = Joi.object({
  text: Joi.string().min(1).required(),
  department: Joi.string().max(50).optional()
});
router.get('/', async (req, res, next) => {
  try {
    const { department } = req.query;
    
    let query = db.collection('subjects');
    if (department) {
      query = query.where('department', '==', department);
    }
    
    const snapshot = await query.get();
    const subjects = [];
    
    snapshot.forEach(doc => {
      subjects.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(subjects);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('subjects').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = subjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { name, section, units, teacherId, department } = value;

    const sections = expandSectionRange(section);
    const createdSubjects = [];
    
    for (const sectionName of sections) {
      const id = uid();
      const subjectData = {
        id,
        name,
        section: sectionName,
        units,
        teacherId: teacherId || '',
        department: department || 'General',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('subjects').doc(id).set(subjectData);
      createdSubjects.push(subjectData);
    }
    
    res.status(201).json(createdSubjects);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = subjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { name, section, units, teacherId, department } = value;
    const subjectData = {
      name,
      section: section || '',
      units,
      teacherId: teacherId || '',
      department: department || 'General',
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('subjects').doc(id).update(subjectData);
    
    res.json({ id, ...subjectData });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const subjectDoc = await db.collection('subjects').doc(id).get();
    if (!subjectDoc.exists) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    await db.collection('subjects').doc(id).delete();
    
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/bulk-import', async (req, res, next) => {
  try {
    const { error, value } = bulkImportSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { text, department } = value;
    const subjectsToAdd = parseBulkInput(text);
    const createdSubjects = [];
    
    for (const subjectData of subjectsToAdd) {

      let teacherId = '';
      if (subjectData.teacherName) {
        const teacherSnapshot = await db.collection('teachers')
          .where('name', '==', subjectData.teacherName)
          .where('department', '==', department || 'General')
          .limit(1)
          .get();
        
        if (teacherSnapshot.empty) {

          const newTeacherId = uid();
          await db.collection('teachers').doc(newTeacherId).set({
            id: newTeacherId,
            name: subjectData.teacherName,
            department: department || 'General',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          teacherId = newTeacherId;
        } else {
          teacherId = teacherSnapshot.docs[0].id;
        }
      }
      
      const existingSubjectSnapshot = await db.collection('subjects')
        .where('name', '==', subjectData.name)
        .where('teacherId', '==', teacherId)
        .where('units', '==', subjectData.units)
        .where('department', '==', department || 'General')
        .limit(1)
        .get();
      
      if (existingSubjectSnapshot.empty) {
        const id = uid();
        const newSubjectData = {
          id,
          name: subjectData.name,
          section: subjectData.section || '',
          units: subjectData.units,
          teacherId,
          department: department || 'General',
          students: subjectData.students || 30,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await db.collection('subjects').doc(id).set(newSubjectData);
        createdSubjects.push(newSubjectData);
      }
    }
    
    res.status(201).json({
      message: `Imported ${createdSubjects.length} subject(s)`,
      subjects: createdSubjects
    });
  } catch (error) {
    next(error);
  }
});

router.get('/teacher/:teacherId', async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const { department } = req.query;
    
    let query = db.collection('subjects').where('teacherId', '==', teacherId);
    if (department) {
      query = query.where('department', '==', department);
    }
    
    const snapshot = await query.get();
    const subjects = [];
    
    snapshot.forEach(doc => {
      subjects.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(subjects);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
