const express = require('express');
const Joi = require('joi');
const { db } = require('../config/firebase');
const { generateSchedule } = require('../utils/scheduling');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { department } = req.query;
    
    let query = db.collection('schedules');
    if (department) {
      query = query.where('department', '==', department);
    }
    
    const snapshot = await query.get();
    const schedules = [];
    
    snapshot.forEach(doc => {
      schedules.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(schedules);
  } catch (error) {
    next(error);
  }
});

router.get('/teacher/:teacherId', async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const { department } = req.query;
    
    let query = db.collection('schedules').where('teacherId', '==', teacherId);
    if (department) {
      query = query.where('department', '==', department);
    }
    
    const snapshot = await query.get();
    const schedules = [];
    
    snapshot.forEach(doc => {
      schedules.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(schedules);
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const { department } = req.body;
    
    if (!department) {
      return res.status(400).json({ error: 'Department is required' });
    }

    const [teachersSnapshot, subjectsSnapshot, roomsSnapshot] = await Promise.all([
      db.collection('teachers').where('department', '==', department).get(),
      db.collection('subjects').where('department', '==', department).get(),
      db.collection('rooms').where('department', '==', department).get()
    ]);
    
    const teachers = [];
    const subjects = [];
    const rooms = [];
    
    teachersSnapshot.forEach(doc => {
      teachers.push({ id: doc.id, ...doc.data() });
    });
    
    subjectsSnapshot.forEach(doc => {
      subjects.push({ id: doc.id, ...doc.data() });
    });
    
    roomsSnapshot.forEach(doc => {
      rooms.push({ id: doc.id, ...doc.data() });
    });
    
    if (teachers.length === 0 || subjects.length === 0) {
      return res.status(400).json({ 
        error: 'Cannot generate schedule. Need at least one teacher and one subject.' 
      });
    }

    const allocations = generateSchedule(subjects, teachers, rooms, department);

    await persistSchedulesToFirestore(allocations, subjects, teachers, rooms, department);

    res.json({
      message: 'Schedule generated successfully',
      allocations,
      summary: {
        totalAllocations: allocations.length,
        unscheduled: allocations.filter(a => a.unscheduled).length,
        scheduled: allocations.filter(a => !a.unscheduled).length
      }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    const { department } = req.query;
    
    if (!department) {
      return res.status(400).json({ error: 'Department is required' });
    }
    
    const snapshot = await db.collection('schedules')
      .where('department', '==', department)
      .get();
    
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    res.json({ 
      message: `Deleted ${snapshot.size} schedule(s) for department: ${department}` 
    });
  } catch (error) {
    next(error);
  }
});

async function persistSchedulesToFirestore(allocations, subjects, teachers, rooms, department) {
  const schedulesCol = db.collection('schedules');
  const byTeacher = new Map();
  
  allocations.forEach(a => {
    if (a.unscheduled || !a.day) return;
    
    const subj = subjects.find(s => s.id === a.subjectId);
    const teach = teachers.find(t => t.id === a.teacherId);
    const room = rooms.find(r => r.id === a.roomId);
    
    if (!byTeacher.has(a.teacherId)) byTeacher.set(a.teacherId, []);
    byTeacher.get(a.teacherId).push({
      ...a,
      subjectName: subj ? subj.name : '',
      section: subj ? (subj.section || '') : '',
      teacherName: teach ? teach.name : '',
      roomName: room ? room.name : '',
      department: department
    });
  });
  
  const batch = db.batch();

  const existingSchedules = await schedulesCol.where('department', '==', department).get();
  existingSchedules.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  byTeacher.forEach((items, teacherId) => {
    if (!teacherId) return;
    const docId = `${department}__${teacherId}`;
    const scheduleRef = schedulesCol.doc(docId);
    batch.set(scheduleRef, {
      teacherId,
      department,
      items,
      updatedAt: new Date().toISOString()
    });
  });
  
  await batch.commit();
}

module.exports = router;
