const { uid } = require('./helpers');

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]; // 8:00 - 18:00

function getRequiredBlocksForSubject(subject) {
  if (subject.units === 1) {
    return [{ type: "laboratory", hours: 3 }];
  }
  if (subject.units === 3) {
    return [
      { type: "laboratory", hours: 3 },
      { type: "lecture", hours: 2 },
    ];
  }
  if (subject.units === 4) {
    return [{ type: "lecture", hours: 3 }];
  }
  return [];
}

function computeTeacherWeeklyHours(teacherId, subjects) {
  let total = 0;
  subjects.filter(s => s.teacherId === teacherId).forEach(s => {
    const blocks = getRequiredBlocksForSubject(s);
    blocks.forEach(b => { total += b.hours; });
  });
  return total;
}

function getRoomsForType(type, rooms, selectedDepartment) {
  const wantType = type === "laboratory" ? "laboratory" : "lecture";
  const dept = selectedDepartment || "General";
  return (rooms || []).filter(r => (r.department === dept) && (r.type === wantType));
}

function rangesOverlap(dayA, startA, durA, dayB, startB, durB) {
  if (!dayA || !dayB || dayA !== dayB) return false;
  const endA = startA + durA;
  const endB = startB + durB;
  return !(endA <= startB || endB <= startA);
}

function isRoomAvailableForAllocation(roomId, allocation, allocations) {
  if (!roomId) return false;
  for (const a of allocations) {
    if (a === allocation) continue;
    if (a.unscheduled || !a.day) continue;
    if (a.roomId !== roomId) continue;
    if (rangesOverlap(a.day, a.startHour, a.duration, allocation.day, allocation.startHour, allocation.duration)) {
      return false;
    }
  }
  return true;
}

function assignRoomForAllocation(allocation, allocations, rooms, selectedDepartment) {
  const availableRooms = getRoomsForType(allocation.type, rooms, selectedDepartment);
  for (const r of availableRooms) {
    if (isRoomAvailableForAllocation(r.id, allocation, allocations)) {
      allocation.roomId = r.id;
      return;
    }
  }
  allocation.roomId = "";
}

function placeBlock(subject, block, teacherBusy, subjectDayUsed, subjects, teachers) {
  const teacherId = subject.teacherId || "";
  
  // Calculate teacher's weekly hours to determine if they should be morning-only
  const teacherWeeklyHours = computeTeacherWeeklyHours(teacherId, subjects);
  const isMorningOnly = teacherWeeklyHours <= 16;
  
  // Define morning hours (7am-11am) and afternoon hours (12pm onwards)
  const MORNING_HOURS = [7, 8, 9, 10, 11]; // 7am-11am
  const AFTERNOON_HOURS = [12, 13, 14, 15, 16, 17, 18, 19]; // 12pm-7pm
  
  // Determine which hours to use based on teacher's weekly hours
  const availableHours = isMorningOnly ? MORNING_HOURS : HOURS;
  
  for (const day of DAYS) {
    if (subjectDayUsed && subjectDayUsed.get(subject.id)?.has(day)) continue;
    
    // Filter available hours based on teacher's weekly hours constraint
    const validStartHours = availableHours.filter(h => h <= availableHours[availableHours.length - 1] - block.hours + 1);
    
    for (const start of validStartHours) {
      const hours = Array.from({ length: block.hours }, (_, k) => start + k);
      
      // Check if all hours fall within the allowed time range
      const allHoursValid = hours.every(h => availableHours.includes(h));
      if (!allHoursValid) continue;
      
      if (teacherId) {
        const busyMap = teacherBusy.get(teacherId);
        const busySet = busyMap.get(day);
        const conflict = hours.some(h => busySet.has(h));
        if (conflict) continue;
        hours.forEach(h => busySet.add(h));
      }
      if (subjectDayUsed) {
        if (!subjectDayUsed.has(subject.id)) subjectDayUsed.set(subject.id, new Set());
        subjectDayUsed.get(subject.id).add(day);
      }
      const allocation = { subjectId: subject.id, teacherId, type: block.type, day, startHour: start, duration: block.hours };
      return allocation;
    }
  }
  return null;
}

function greedyInitialSchedule(subjects, teachers, rooms, selectedDepartment) {
  const teacherBusy = new Map();
  teachers.forEach(t => {
    const dayMap = new Map();
    DAYS.forEach(d => dayMap.set(d, new Set()));
    teacherBusy.set(t.id, dayMap);
  });

  const subjectDayUsed = new Map();
  const subjectsOrdered = [...subjects].sort((a, b) => b.units - a.units);
  const allocations = [];
  for (const subject of subjectsOrdered) {
    const blocks = getRequiredBlocksForSubject(subject);
    for (const block of blocks) {
      const placed = placeBlock(subject, block, teacherBusy, subjectDayUsed, subjects, teachers);
      if (!placed) {
        allocations.push({ subjectId: subject.id, teacherId: subject.teacherId || "", type: block.type, day: "", startHour: -1, duration: block.hours, unscheduled: true, roomId: "" });
      } else {
        assignRoomForAllocation(placed, allocations, rooms, selectedDepartment);
        allocations.push(placed);
      }
    }
  }
  return allocations;
}

function cloneAllocations(arr) {
  return arr.map(a => ({ ...a }));
}

function evaluateCost(allocations, subjects, teachers, rooms) {
  let cost = 0;
  const teacherDayHour = new Map();
  const subjectDayCount = new Map();
  const subjectSectionToTeachers = new Map();
  const subjectBlockTypesPerDay = new Map();
  const roomDayHour = new Map();

  for (const a of allocations) {
    if (a.unscheduled || !a.day) {
      cost += 2000;
      continue;
    }
    const hours = Array.from({ length: a.duration }, (_, k) => a.startHour + k);
    if (a.teacherId) {
      if (!teacherDayHour.has(a.teacherId)) teacherDayHour.set(a.teacherId, new Map());
      const dayMap = teacherDayHour.get(a.teacherId);
      if (!dayMap.has(a.day)) dayMap.set(a.day, new Map());
      const hourMap = dayMap.get(a.day);
      for (const h of hours) {
        const c = (hourMap.get(h) || 0) + 1;
        hourMap.set(h, c);
        if (c > 1) cost += 1000;
      }
    }
    if (a.roomId) {
      if (!roomDayHour.has(a.roomId)) roomDayHour.set(a.roomId, new Map());
      const rDay = roomDayHour.get(a.roomId);
      if (!rDay.has(a.day)) rDay.set(a.day, new Map());
      const rHours = rDay.get(a.day);
      for (const h of hours) {
        const c = (rHours.get(h) || 0) + 1;
        rHours.set(h, c);
        if (c > 1) cost += 1200; // room conflict penalty
      }
    } else {
      cost += 1500; // missing room assignment
    }
    const subj = subjects.find(s => s.id === a.subjectId);
    if (subj) {
      const key = `${(subj.name || '').toLowerCase()}|${(subj.section || '').toLowerCase()}`;
      if (!subjectSectionToTeachers.has(key)) subjectSectionToTeachers.set(key, new Set());
      subjectSectionToTeachers.get(key).add(a.teacherId || "");
    }
    if (!subjectDayCount.has(a.subjectId)) subjectDayCount.set(a.subjectId, new Map());
    const sDay = subjectDayCount.get(a.subjectId);
    sDay.set(a.day, (sDay.get(a.day) || 0) + 1);

    if (!subjectBlockTypesPerDay.has(a.subjectId)) subjectBlockTypesPerDay.set(a.subjectId, new Map());
    const typeMap = subjectBlockTypesPerDay.get(a.subjectId);
    if (!typeMap.has(a.day)) typeMap.set(a.day, new Set());
    typeMap.get(a.day).add(a.type);
  }

  subjectDayCount.forEach(dayMap => {
    dayMap.forEach(count => {
      if (count > 1) cost += (count - 1) * 800;
    });
  });

  subjectSectionToTeachers.forEach(set => {
    if (set.size > 1) cost += (set.size - 1) * 3000;
  });

  subjects.forEach(s => {
    if (s.units === 3) {
      const map = subjectBlockTypesPerDay.get(s.id);
      if (!map) return;
      map.forEach(set => {
        if (set.has("lecture") && set.has("laboratory")) cost += 1500;
      });
    }
  });

  teacherDayHour.forEach((dayMap, teacherId) => {
    dayMap.forEach((hourMap, day) => {
      const windowStarts = [10, 11, 12, 13, 14];
      const occupied = windowStarts.map(h => (hourMap.get(h) || 0) > 0);
      let maxGap = 0; let cur = 0;
      for (let i = 0; i < occupied.length; i++) {
        if (!occupied[i]) { cur++; maxGap = Math.max(maxGap, cur); } else { cur = 0; }
      }
      if (maxGap < 2) cost += 800;
      if (maxGap > 3) cost += (maxGap - 3) * 200;
    });
  });

  for (const a of allocations) {
    if (a.unscheduled || !a.day) continue;
    cost += (a.startHour - 8) * 2;
  }

  const dayLoads = new Map();
  DAYS.forEach(day => dayLoads.set(day, 0));

  for (const a of allocations) {
    if (a.unscheduled || !a.day) continue;
    dayLoads.set(a.day, dayLoads.get(a.day) + a.duration);
  }

  const loads = Array.from(dayLoads.values());
  const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;

  loads.forEach(load => {
    const deviation = Math.abs(load - avgLoad);
    cost += deviation * 50;
  });

  teacherDayHour.forEach((dayMap, teacherId) => {
    let totalWeeklyHours = 0;
    const dailyHours = new Map();

    dayMap.forEach((hourMap, day) => {
      const totalHours = Array.from(hourMap.values()).reduce((sum, count) => sum + count, 0);
      dailyHours.set(day, totalHours);
      totalWeeklyHours += totalHours;

      if (totalHours < 6) {
        cost += (6 - totalHours) * 300;
      } else if (totalHours > 9) {
        cost += (totalHours - 9) * 500;
      }
    });

    if (totalWeeklyHours >= 6 && totalWeeklyHours <= 15) {
      const fridayHours = dailyHours.get('Fri') || 0;
      if (fridayHours > 0) {
        cost += fridayHours * 5000;
      }

      const expectedHoursPerDay = totalWeeklyHours / 4;

      ['Mon', 'Tue', 'Wed', 'Thu'].forEach(day => {
        const hours = dailyHours.get(day) || 0;
        const deviation = Math.abs(hours - expectedHoursPerDay);
        cost += deviation * 2000;

        if (hours === totalWeeklyHours) {
          cost += 10000;
        }
      });
    }
  });

  const teacherSubjectCounts = new Map();
  subjects.forEach(subject => {
    if (subject.teacherId) {
      teacherSubjectCounts.set(subject.teacherId, (teacherSubjectCounts.get(subject.teacherId) || 0) + 1);
    }
  });

  if (teacherSubjectCounts.size > 1) {
    const counts = Array.from(teacherSubjectCounts.values());
    const avgCount = counts.reduce((sum, count) => sum + count, 0) / counts.length;

    counts.forEach(count => {
      const deviation = Math.abs(count - avgCount);
      cost += deviation * 200;
    });
  }

  return cost;
}

function tournamentSelect(scored, k) {
  let best = null;
  for (let i = 0; i < k; i++) {
    const pick = scored[Math.floor(Math.random() * scored.length)].ind;
    if (!best || evaluateCost(pick, [], [], []) < evaluateCost(best, [], [], [])) best = pick;
  }
  return best;
}

function onePointCrossover(a, b) {
  const point = Math.floor(Math.random() * a.length);
  const c1 = a.slice(0, point).concat(b.slice(point)).map(x => ({ ...x }));
  const c2 = b.slice(0, point).concat(a.slice(point)).map(x => ({ ...x }));
  return [c1, c2];
}

function mutateAllocations(ind, subjects, rooms, selectedDepartment) {
  const out = cloneAllocations(ind);
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * out.length);
    const gene = out[idx];
    if (gene.unscheduled) continue;
    
    // Calculate teacher's weekly hours to determine if they should be morning-only
    const teacherWeeklyHours = computeTeacherWeeklyHours(gene.teacherId, subjects);
    const isMorningOnly = teacherWeeklyHours <= 16;
    
    // Define morning hours (7am-11am) and afternoon hours (12pm onwards)
    const MORNING_HOURS = [7, 8, 9, 10, 11]; // 7am-11am
    const AFTERNOON_HOURS = [12, 13, 14, 15, 16, 17, 18, 19]; // 12pm-7pm
    
    // Determine which hours to use based on teacher's weekly hours
    const availableHours = isMorningOnly ? MORNING_HOURS : HOURS;
    
    if (Math.random() < 0.5) gene.day = DAYS[Math.floor(Math.random() * DAYS.length)];
    const latestStart = availableHours[availableHours.length - 1] - (gene.duration - 1);
    const starts = availableHours.filter(h => h <= latestStart);
    gene.startHour = starts[Math.floor(Math.random() * starts.length)];
    assignRoomForAllocation(gene, out, rooms, selectedDepartment);
  }
  return out;
}

function randomizeAllocations(base, subjects, rooms, selectedDepartment) {
  return base.map(a => {
    const copy = { ...a };
    if (copy.unscheduled || !copy.day || copy.startHour < 0) {
      // Calculate teacher's weekly hours to determine if they should be morning-only
      const teacherWeeklyHours = computeTeacherWeeklyHours(copy.teacherId, subjects);
      const isMorningOnly = teacherWeeklyHours <= 16;
      
      // Define morning hours (7am-11am) and afternoon hours (12pm onwards)
      const MORNING_HOURS = [7, 8, 9, 10, 11]; // 7am-11am
      const AFTERNOON_HOURS = [12, 13, 14, 15, 16, 17, 18, 19]; // 12pm-7pm
      
      // Determine which hours to use based on teacher's weekly hours
      const availableHours = isMorningOnly ? MORNING_HOURS : HOURS;
      
      const latest = availableHours[availableHours.length - 1] - (copy.duration - 1);
      const starts = availableHours.filter(h => h <= latest);
      copy.day = DAYS[Math.floor(Math.random() * DAYS.length)];
      copy.startHour = starts[Math.floor(Math.random() * starts.length)];
    }
    assignRoomForAllocation(copy, base, rooms, selectedDepartment);
    return copy;
  });
}

function optimizeWithGeneticAlgorithm(seedAllocations, subjects, teachers, rooms, selectedDepartment) {
  const populationSize = 50;
  const generations = 200;
  const mutationRate = 0.2;
  const crossoverRate = 0.9;

  let population = [];
  population.push(cloneAllocations(seedAllocations));
  for (let i = 1; i < populationSize; i++) {
    population.push(randomizeAllocations(seedAllocations, subjects, rooms, selectedDepartment));
  }

  let best = null;
  let bestCost = Infinity;

  for (let gen = 0; gen < generations; gen++) {
    const scored = population.map(ind => ({ ind, cost: evaluateCost(ind, subjects, teachers, rooms) }))
      .sort((a, b) => a.cost - b.cost);
    if (scored[0].cost < bestCost) {
      best = cloneAllocations(scored[0].ind);
      bestCost = scored[0].cost;
      if (bestCost === 0) break;
    }

    const nextPop = [cloneAllocations(scored[0].ind), cloneAllocations(scored[1].ind)];

    while (nextPop.length < populationSize) {
      const parentA = tournamentSelect(scored, 4);
      const parentB = tournamentSelect(scored, 4);
      let child1 = cloneAllocations(parentA);
      let child2 = cloneAllocations(parentB);
      if (Math.random() < crossoverRate) {
        const [c1, c2] = onePointCrossover(parentA, parentB);
        child1 = c1; child2 = c2;
      }
      if (Math.random() < mutationRate) child1 = mutateAllocations(child1, subjects, rooms, selectedDepartment);
      if (Math.random() < mutationRate) child2 = mutateAllocations(child2, subjects, rooms, selectedDepartment);
      nextPop.push(child1);
      if (nextPop.length < populationSize) nextPop.push(child2);
    }

    population = nextPop;
  }

  return best || seedAllocations;
}

function generateSchedule(subjects, teachers, rooms, selectedDepartment) {
  const seed = greedyInitialSchedule(subjects, teachers, rooms, selectedDepartment);
  const optimized = optimizeWithGeneticAlgorithm(seed, subjects, teachers, rooms, selectedDepartment);
  return optimized;
}

module.exports = {
  generateSchedule,
  computeTeacherWeeklyHours,
  getRequiredBlocksForSubject,
  DAYS,
  HOURS
};
