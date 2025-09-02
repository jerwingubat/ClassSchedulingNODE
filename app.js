const state = {
	teachers: [],
	subjects: [],
	departments: [],
	selectedDepartment: "",
	rooms: [],
};

const uid = () => Math.random().toString(36).slice(2, 10);

function expandSectionRange(sectionInput) {
	const raw = (sectionInput || "").trim();
	if (!raw) return [];
	const m = raw.match(/^(.*?)([A-Za-z])\s*-\s*([A-Za-z])$/);
	if (!m) return [raw];
	const base = m[1].trim();
	const start = m[2].toUpperCase().charCodeAt(0);
	const end = m[3].toUpperCase().charCodeAt(0);
	const from = Math.min(start, end);
	const to = Math.max(start, end);
	const out = [];
	for (let c = from; c <= to; c++) {
		out.push(`${base}${String.fromCharCode(c)}`);
	}
	return out;
}

function expandRoomRange(roomInput) {
	const raw = (roomInput || "").trim();
	if (!raw) return [];
	const m = raw.match(/^(.*?)(\d+)\s*-\s*(\d+)$/);
	if (!m) return [raw];
	const base = m[1].trim();
	const start = parseInt(m[2], 10);
	const end = parseInt(m[3], 10);
	const from = Math.min(start, end);
	const to = Math.max(start, end);
	const out = [];
	for (let i = from; i <= to; i++) {
		out.push(`${base} ${i}`);
	}
	return out;
}

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

function computeTeacherWeeklyHours(teacherId) {
	let total = 0;
	state.subjects.filter(s => s.teacherId === teacherId).forEach(s => {
		const blocks = getRequiredBlocksForSubject(s);
		blocks.forEach(b => { total += b.hours; });
	});
	return total;
}

function getRoomsForType(type) {
	const wantType = type === "laboratory" ? "laboratory" : "lecture";
	const dept = state.selectedDepartment || "General";
	return (state.rooms || []).filter(r => (r.department === dept) && (r.type === wantType));
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

function assignRoomForAllocation(allocation, allocations) {
	const rooms = getRoomsForType(allocation.type);
	for (const r of rooms) {
		if (isRoomAvailableForAllocation(r.id, allocation, allocations)) {
			allocation.roomId = r.id;
			return;
		}
	}
	allocation.roomId = "";
}

function saveAll() {
	localStorage.setItem("css_teachers", JSON.stringify(state.teachers));
	localStorage.setItem("css_subjects", JSON.stringify(state.subjects));
	localStorage.setItem("css_departments", JSON.stringify(state.departments));
	localStorage.setItem("css_selected_department", state.selectedDepartment || "");
	localStorage.setItem("css_rooms", JSON.stringify(state.rooms));
	if (db) {
		const batch = db.batch();
		const teachersCol = db.collection("teachers");
		const subjectsCol = db.collection("subjects");
		const departmentsCol = db.collection("departments");
		const roomsCol = db.collection("rooms");
		const currentDept = state.selectedDepartment || "General";
		teachersCol.where("department", "==", currentDept).get().then(snap => {
			snap.forEach(doc => batch.delete(doc.ref));
			state.teachers.forEach(t => batch.set(teachersCol.doc(t.id), { ...t, department: t.department || currentDept }));
			return subjectsCol.where("department", "==", currentDept).get();
		}).then(snap2 => {
			snap2.forEach(doc => batch.delete(doc.ref));
			state.subjects.forEach(s => {
				const teacher = state.teachers.find(t => t.id === s.teacherId);
				const subjectDoc = {
					id: s.id,
					name: s.name,
					section: s.section || "",
					units: s.units,
					teacherId: s.teacherId || "",
					teacherName: teacher ? teacher.name : "",
					department: s.department || (teacher && teacher.department) || currentDept,
				};
				batch.set(subjectsCol.doc(s.id), subjectDoc);
			});
			return roomsCol.where("department", "==", currentDept).get();
		}).then(snapRooms => {
			snapRooms.forEach(doc => batch.delete(doc.ref));
			state.rooms.forEach(r => batch.set(roomsCol.doc(r.id), { ...r, department: r.department || currentDept }));
			return departmentsCol.get();
		}).then(snap3 => {
			snap3.forEach(doc => batch.delete(doc.ref));
			state.departments.forEach(d => batch.set(departmentsCol.doc(d.id), d));
			return batch.commit();
		}).catch(err => console.warn("Firestore save skipped:", err));
	}
}

function loadAll() {
	try {
		state.teachers = JSON.parse(localStorage.getItem("css_teachers") || "[]");
		state.subjects = JSON.parse(localStorage.getItem("css_subjects") || "[]");
		state.departments = JSON.parse(localStorage.getItem("css_departments") || "[]");
		state.selectedDepartment = localStorage.getItem("css_selected_department") || "";
		state.rooms = JSON.parse(localStorage.getItem("css_rooms") || "[]");
	} catch (e) {
		console.error("Failed to load", e);
	}
	if (db) {
		Promise.all([
			db.collection("departments").get(),
			db.collection("teachers").get(),
			db.collection("subjects").get(),
			db.collection("rooms").get()
		]).then(([dSnap, tSnap, sSnap, rSnap]) => {
			const departments = []; dSnap.forEach(d => departments.push(d.data()));
			const teachers = []; tSnap.forEach(d => teachers.push(d.data()));
			const subjects = []; sSnap.forEach(d => subjects.push(d.data()));
			const rooms = []; rSnap.forEach(d => rooms.push(d.data()));
			if (departments.length) state.departments = departments;
			if (teachers.length || subjects.length) {
				state.teachers = teachers;
				state.subjects = subjects;
			}
			if (rooms.length) state.rooms = rooms;
			if (!state.selectedDepartment) {
				state.selectedDepartment = (state.departments[0] && state.departments[0].id) || "General";
			}
			renderAll();
		}).catch(err => console.warn("Firestore load skipped:", err));
	}
}

const departmentSelect = document.getElementById("departmentSelect");
const newDepartment = document.getElementById("newDepartment");
const addDepartmentBtn = document.getElementById("addDepartmentBtn");
const teacherForm = document.getElementById("teacherForm");
const teacherName = document.getElementById("teacherName");
const teacherList = document.getElementById("teacherList");

const subjectForm = document.getElementById("subjectForm");
const subjectName = document.getElementById("subjectName");
const subjectUnits = document.getElementById("subjectUnits");
const subjectTeacher = document.getElementById("subjectTeacher");
const subjectSection = document.getElementById("subjectSection");
const subjectList = document.getElementById("subjectList");

const roomForm = document.getElementById("roomForm");
const roomName = document.getElementById("roomName");
const roomType = document.getElementById("roomType");
const roomList = document.getElementById("roomList");

const viewMode = document.getElementById("viewMode");
const viewFilter = document.getElementById("viewFilter");
const generateBtn = document.getElementById("generateBtn");
const timetable = document.getElementById("timetable");

const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const printBtn = document.getElementById("printBtn");
const printModal = document.getElementById("printModal");
const printTeacherSelect = document.getElementById("printTeacherSelect");
const printCancelBtn = document.getElementById("printCancelBtn");
const printConfirmBtn = document.getElementById("printConfirmBtn");

const firebaseConfig = {
	apiKey: "AIzaSyC-mxu18I7-XLI_c1TBHuM5kN5RU2d7Hho",
	authDomain: "classscheduling-76744.firebaseapp.com",
	projectId: "classscheduling-76744",
	storageBucket: "classscheduling-76744.firebasestorage.app",
	messagingSenderId: "999286398771",
	appId: "1:999286398771:web:14dac1253415fcf10fa846",
	measurementId: "G-CN5YEYVT7S"
};

let db = null;
try {
	if (window.firebase && !firebase.apps.length) {
		firebase.initializeApp(firebaseConfig);
		db = firebase.firestore();
	}
} catch (e) { console.warn("Firebase init skipped:", e); }

let latestRemoteAllocations = [];
let schedulesUnsubscribe = null;
let teachersUnsubscribe = null;
let subjectsUnsubscribe = null;
let departmentsUnsubscribe = null;
let roomsUnsubscribe = null;

function startSchedulesListener() {
	if (!db) return;
	if (schedulesUnsubscribe) return; // already listening
	let query = db.collection("schedules");
	if (state.selectedDepartment) query = query.where("department", "==", state.selectedDepartment);
	schedulesUnsubscribe = query.onSnapshot(snap => {
		const allocations = [];
		snap.forEach(doc => {
			const data = doc.data();
			const items = Array.isArray(data.items) ? data.items : [];
			items.forEach(it => allocations.push({ ...it }));
		});
		latestRemoteAllocations = allocations;
		// Render immediately using current view/filter
		renderTimetable(latestRemoteAllocations);
	}, err => console.warn("Schedules listener error:", err));
}

function startDataListeners() {
	if (!db) return;
	if (!departmentsUnsubscribe) {
		departmentsUnsubscribe = db.collection("departments").onSnapshot(snap => {
			const departments = [];
			snap.forEach(d => departments.push(d.data()));
			state.departments = departments;
			renderAll();
		}, err => console.warn("Departments listener error:", err));
	}
	if (!teachersUnsubscribe) {
		let query = db.collection("teachers");
		if (state.selectedDepartment) query = query.where("department", "==", state.selectedDepartment);
		teachersUnsubscribe = query.onSnapshot(snap => {
			const teachers = [];
			snap.forEach(d => teachers.push(d.data()));
			state.teachers = teachers;
			renderAll();
		}, err => console.warn("Teachers listener error:", err));
	}
	if (!subjectsUnsubscribe) {
		let query = db.collection("subjects");
		if (state.selectedDepartment) query = query.where("department", "==", state.selectedDepartment);
		subjectsUnsubscribe = query.onSnapshot(snap => {
			const subjects = [];
			snap.forEach(d => subjects.push(d.data()));
			state.subjects = subjects;
			renderAll();
		}, err => console.warn("Subjects listener error:", err));
	}
	if (!roomsUnsubscribe) {
		let query = db.collection("rooms");
		if (state.selectedDepartment) query = query.where("department", "==", state.selectedDepartment);
		roomsUnsubscribe = query.onSnapshot(snap => {
			const rooms = [];
			snap.forEach(d => rooms.push(d.data()));
			state.rooms = rooms;
			renderAll();
		}, err => console.warn("Rooms listener error:", err));
	}
}

const bulkInput = document.getElementById("bulkInput");
const bulkImportBtn = document.getElementById("bulkImportBtn");
const bulkClearBtn = document.getElementById("bulkClearBtn");

function renderTeachers() {
	teacherList.innerHTML = "";
	if (departmentSelect) {
		departmentSelect.innerHTML = `<option value="" disabled ${state.selectedDepartment ? "" : "selected"}>Select Department</option>`;
		state.departments.forEach(d => {
			const opt = document.createElement("option");
			opt.value = d.id; opt.textContent = d.name; if (state.selectedDepartment === d.id) opt.selected = true; departmentSelect.appendChild(opt);
		});
	}
	state.teachers.forEach(t => {
		const weekly = computeTeacherWeeklyHours(t.id);
		const li = document.createElement("li");
		li.innerHTML = `
			<div class="teacher-row">
				<div class="left"><span class="caret">▶</span><span class="teacher-name">${t.name}</span><span class="badge">Total Contact Hours: ${weekly}hrs/week</span></div>
				<button data-id="${t.id}" class="danger">Remove</button>
			</div>
			<div class="teacher-subjects">
				<form class="sub-form">
					<input type="text" name="name" placeholder="Subject name" required>
					<input type="text" name="section" placeholder="Section (e.g., BSCS-1A)">
					<select name="units" required>
						<option value="" disabled selected>Units</option>
						<option value="1">1 unit lab (3h laboratory)</option>
						<option value="3">2 units lecture + 1 unit lab (2h lec + 3h lab)</option>
						<option value="4">3 units lecture (3h lecture)</option>
					</select>
					<button type="submit">Add Subject</button>
				</form>
				<ul class="sub-list"></ul>
			</div>
		`;

		li.querySelector('.teacher-row').addEventListener('click', (ev) => {
			if (ev.target && (ev.target.closest('button.danger'))) return;
			li.classList.toggle('open');
		});
		li.querySelector("button.danger").addEventListener("click", () => {
			state.teachers = state.teachers.filter(x => x.id !== t.id);
			// Remove assignment from subjects
			state.subjects = state.subjects.map(s => s.teacherId === t.id ? { ...s, teacherId: "" } : s);
			saveAll();
			renderAll();
		});

		const form = li.querySelector("form.sub-form");
		form.addEventListener("submit", e => {
			e.preventDefault();
			const formData = new FormData(form);
			const name = String(formData.get("name") || "").trim();
			const sectionInput = String(formData.get("section") || "").trim();
			const units = Number(formData.get("units"));
			if (!name || !units) return;
			const sections = expandSectionRange(sectionInput);
			if (sections.length === 0) sections.push("");
			sections.forEach(sec => {
				state.subjects.push({ id: uid(), name, section: sec, units, teacherId: t.id, department: t.department || state.selectedDepartment || "General" });
			});
			saveAll();
			form.reset();
			renderAll();
		});

		const ul = li.querySelector(".sub-list");
		state.subjects.filter(s => s.teacherId === t.id).forEach(s => {
			const item = document.createElement("li");
			const sectionBadge = s.section ? `<span class=\"badge\">${s.section}</span>` : "";
			item.innerHTML = `<span>${s.name} ${sectionBadge} <span class=\"badge\">${s.units}u</span></span><button data-subid=\"${s.id}\" class=\"danger\">Remove</button>`;
			item.querySelector("button.danger").addEventListener("click", () => {
				state.subjects = state.subjects.filter(x => x.id !== s.id);
				saveAll();
				renderAll();
			});
			ul.appendChild(item);
		});

		teacherList.appendChild(li);
	});

	subjectTeacher.innerHTML = `<option value="" disabled ${state.teachers.length ? "" : "selected"}>Assign teacher</option>`;
	state.teachers.forEach(t => {
		const opt = document.createElement("option");
		opt.value = t.id; opt.textContent = t.name;
		subjectTeacher.appendChild(opt);
	});

	updateViewFilterOptions();
}

function renderSubjects() {
	subjectList.innerHTML = "";
	state.subjects.forEach(s => {
		const li = document.createElement("li");
		const teacher = state.teachers.find(t => t.id === s.teacherId);
		const teacherNameTxt = teacher ? teacher.name : "Unassigned";
		const sectionBadge = s.section ? `<span class=\"badge\">${s.section}</span>` : "";
		li.innerHTML = `<span>${s.name} ${sectionBadge} <span class=\"badge\">${s.units}u</span> <span class=\"badge\">${teacherNameTxt}</span></span><button data-id=\"${s.id}\">Remove</button>`;
		li.querySelector("button").addEventListener("click", () => {
			state.subjects = state.subjects.filter(x => x.id !== s.id);
			renderAll();
		});
		subjectList.appendChild(li);
	});

	updateViewFilterOptions();
}

function updateViewFilterOptions() {
	const mode = viewMode.value;
	viewFilter.disabled = mode === "all";
	viewFilter.innerHTML = `<option value="">Select filter</option>`;
	if (mode === "by-teacher") {
		state.teachers.forEach(t => {
			const opt = document.createElement("option");
			opt.value = t.id; opt.textContent = t.name; viewFilter.appendChild(opt);
		});
	}
	if (mode === "by-subject") {
		state.subjects.forEach(s => {
			const opt = document.createElement("option");
			opt.value = s.id; opt.textContent = s.name; viewFilter.appendChild(opt);
		});
	}
}

function generateSchedule() {
	const seed = greedyInitialSchedule();
	const optimized = optimizeWithGeneticAlgorithm(seed);
	return optimized;
}


function placeBlock(subject, block, teacherBusy, subjectDayUsed) {
	const teacherId = subject.teacherId || "";
	
	// Calculate teacher's weekly hours to determine if they should be morning-only
	const teacherWeeklyHours = computeTeacherWeeklyHours(teacherId);
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

function greedyInitialSchedule() {
	const teacherBusy = new Map();
	state.teachers.forEach(t => {
		const dayMap = new Map();
		DAYS.forEach(d => dayMap.set(d, new Set()));
		teacherBusy.set(t.id, dayMap);
	});

	const subjectDayUsed = new Map();
	const subjectsOrdered = [...state.subjects].sort((a, b) => b.units - a.units);
	const allocations = [];
	for (const subject of subjectsOrdered) {
		const blocks = getRequiredBlocksForSubject(subject);
		for (const block of blocks) {
			const placed = placeBlock(subject, block, teacherBusy, subjectDayUsed);
			if (!placed) {
				allocations.push({ subjectId: subject.id, teacherId: subject.teacherId || "", type: block.type, day: "", startHour: -1, duration: block.hours, unscheduled: true, roomId: "" });
			} else {
				assignRoomForAllocation(placed, allocations);
				allocations.push(placed);
			}
		}
	}
	return allocations;
}

function optimizeWithSimulatedAnnealing(initialAllocations) {
	let current = cloneAllocations(initialAllocations);
	let currentCost = evaluateCost(current);
	let best = cloneAllocations(current);
	let bestCost = currentCost;

	let temperature = 5.0;
	const coolingRate = 0.995;
	const minTemperature = 0.01;
	const maxIterations = 5000;

	for (let iter = 0; iter < maxIterations && temperature > minTemperature; iter++) {
		const neighbor = proposeNeighbor(current);
		const neighborCost = evaluateCost(neighbor);
		const accept = neighborCost < currentCost || Math.random() < Math.exp((currentCost - neighborCost) / temperature);
		if (accept) {
			current = neighbor;
			currentCost = neighborCost;
			if (neighborCost < bestCost) {
				best = cloneAllocations(neighbor);
				bestCost = neighborCost;
				if (bestCost === 0) break;
			}
		}
		temperature *= coolingRate;
	}

	return best;
}

function optimizeWithGeneticAlgorithm(seedAllocations) {
	const populationSize = 50;
	const generations = 200;
	const mutationRate = 0.2;
	const crossoverRate = 0.9;

	let population = [];
	population.push(cloneAllocations(seedAllocations));
	for (let i = 1; i < populationSize; i++) {
		population.push(randomizeAllocations(seedAllocations));
	}

	let best = null;
	let bestCost = Infinity;

	for (let gen = 0; gen < generations; gen++) {
		const spinner = document.getElementById('loadingSpinner');
		if (spinner && spinner.style.display !== 'none') {
			const progressText = spinner.querySelector('p');
			if (progressText) {
				progressText.textContent = `Generating optimal schedule... (${Math.round((gen / generations) * 100)}%)`;
			}
		}

		const scored = population.map(ind => ({ ind, cost: evaluateCost(ind) }))
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
			if (Math.random() < mutationRate) child1 = mutateAllocations(child1);
			if (Math.random() < mutationRate) child2 = mutateAllocations(child2);
			nextPop.push(child1);
			if (nextPop.length < populationSize) nextPop.push(child2);
		}

		population = nextPop;
	}

	return best || seedAllocations;
}

function tournamentSelect(scored, k) {
	let best = null;
	for (let i = 0; i < k; i++) {
		const pick = scored[Math.floor(Math.random() * scored.length)].ind;
		if (!best || evaluateCost(pick) < evaluateCost(best)) best = pick;
	}
	return best;
}

function onePointCrossover(a, b) {
	const point = Math.floor(Math.random() * a.length);
	const c1 = a.slice(0, point).concat(b.slice(point)).map(x => ({ ...x }));
	const c2 = b.slice(0, point).concat(a.slice(point)).map(x => ({ ...x }));
	return [c1, c2];
}

function mutateAllocations(ind) {
	const out = cloneAllocations(ind);
	const n = 1 + Math.floor(Math.random() * 3);
	for (let i = 0; i < n; i++) {
		const idx = Math.floor(Math.random() * out.length);
		const gene = out[idx];
		if (gene.unscheduled) continue;
		
		// Calculate teacher's weekly hours to determine if they should be morning-only
		const teacherWeeklyHours = computeTeacherWeeklyHours(gene.teacherId);
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
		assignRoomForAllocation(gene, out);
	}
	return out;
}

function randomizeAllocations(base) {
	return base.map(a => {
		const copy = { ...a };
		if (copy.unscheduled || !copy.day || copy.startHour < 0) {
			// Calculate teacher's weekly hours to determine if they should be morning-only
			const teacherWeeklyHours = computeTeacherWeeklyHours(copy.teacherId);
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
		assignRoomForAllocation(copy, base);
		return copy;
	});
}

function cloneAllocations(arr) {
	return arr.map(a => ({ ...a }));
}

function evaluateCost(allocations) {
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
		const subj = state.subjects.find(s => s.id === a.subjectId);
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

	state.subjects.forEach(s => {
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
	state.subjects.forEach(subject => {
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

function proposeNeighbor(allocations) {
	const next = cloneAllocations(allocations);
	const movable = next.filter(a => !a.unscheduled);
	if (movable.length === 0) return next;
	const idx = Math.floor(Math.random() * movable.length);
	const target = movable[idx];

	if (Math.random() < 0.5) {
		target.day = DAYS[Math.floor(Math.random() * DAYS.length)];
	}
	const latestStart = HOURS[HOURS.length - 1] - (target.duration - 1);
	const possibleStarts = HOURS.filter(h => h <= latestStart);
	target.startHour = possibleStarts[Math.floor(Math.random() * possibleStarts.length)];

	if (Math.random() < 0.2) {
		const unsched = next.filter(a => a.unscheduled);
		if (unsched.length) {
			const u = unsched[Math.floor(Math.random() * unsched.length)];
			u.day = DAYS[Math.floor(Math.random() * DAYS.length)];
			const latest = HOURS[HOURS.length - 1] - (u.duration - 1);
			const starts = HOURS.filter(h => h <= latest);
			u.startHour = starts[Math.floor(Math.random() * starts.length)];
			delete u.unscheduled;
		}
	}

	return next;
}

function renderTimetable(allocations) {
	const mode = viewMode.value;
	const filterId = viewFilter.value;

	timetable.innerHTML = "";
	if (mode === "teachers-all") {
		state.teachers.forEach(t => {
			const teacherAlloc = allocations.filter(a => a.teacherId === t.id);
			const section = document.createElement("section");
			section.className = "panel";
			const headerBar = document.createElement("div");
			headerBar.className = "table-header";
			const h = document.createElement("h2");
			const weekly = computeTeacherWeeklyHours(t.id);
			h.textContent = `Schedule: ${t.name}`;
			const meta = document.createElement("div");
			meta.className = "table-meta";
			meta.textContent = `Total Contact Hours: ${weekly}hrs/week`;
			headerBar.appendChild(h);
			headerBar.appendChild(meta);
			section.appendChild(headerBar);
			section.appendChild(buildGridTable(teacherAlloc));
			timetable.appendChild(section);
		});
	} else {
		const filtered = allocations.filter(a => {
			if (mode === "by-teacher" && filterId) return a.teacherId === filterId;
			if (mode === "by-subject" && filterId) return a.subjectId === filterId;
			return true;
		});
		timetable.appendChild(buildGridTable(filtered));
	}

	const unscheduled = allocations.filter(a => a.unscheduled);
	if (unscheduled.length) {
		const box = document.createElement("div");
		box.style.marginTop = "8px";
		box.innerHTML = `<span class="badge">Unscheduled: ${unscheduled.length}</span>`;
		unscheduled.forEach(u => {
			const { label, extra } = describeBlock(u);
			const div = document.createElement("div");
			div.className = `slot ${u.type}`;
			div.innerHTML = `<strong>${label}</strong> <span class="meta">${extra} - needs manual placement</span>`;
			box.appendChild(div);
		});
		timetable.appendChild(box);
	}
}

function buildGridTable(allocations) {
	const headerCols = ["Time", ...DAYS];
	const table = document.createElement("table");
	table.className = "grid";
	table.innerHTML = `<thead><tr>${headerCols.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;
	const tbody = document.createElement("tbody");

	const grid = new Array(HOURS.length);
	for (let i = 0; i < HOURS.length; i++) {
		grid[i] = new Array(DAYS.length);
		for (let j = 0; j < DAYS.length; j++) {
			grid[i][j] = { used: false, rowspan: 0, colspan: 0 };
		}
	}

	for (const allocation of allocations) {
		if (allocation.unscheduled || !allocation.day || allocation.duration <= 1) continue;

		const dayIndex = DAYS.indexOf(allocation.day);
		const hourIndex = HOURS.indexOf(allocation.startHour);

		if (dayIndex === -1 || hourIndex === -1) continue;

		grid[hourIndex][dayIndex] = {
			used: true,
			rowspan: Math.min(allocation.duration, HOURS.length - hourIndex),
			colspan: 1,
			allocation: allocation
		};

		for (let i = 1; i < allocation.duration && (hourIndex + i) < HOURS.length; i++) {
			grid[hourIndex + i][dayIndex] = {
				used: true,
				rowspan: 0,
				colspan: 0,
				merged: true
			};
		}
	}

	for (let i = 0; i < HOURS.length; i++) {
		const row = document.createElement("tr");
		const hour = HOURS[i];
		const timeCell = document.createElement("td");
		timeCell.textContent = `${formatHour(hour)} - ${formatHour(hour + 1)}`;
		row.appendChild(timeCell);

		for (let j = 0; j < DAYS.length; j++) {
			const day = DAYS[j];
			const cellInfo = grid[i][j];

			if (cellInfo.merged) {
				continue;
			}

			const cell = document.createElement("td");

			if (cellInfo.used && cellInfo.allocation) {
				const { label, extra } = describeBlock(cellInfo.allocation);
				const div = document.createElement("div");
				div.className = `slot ${cellInfo.allocation.type}`;
				div.innerHTML = `<strong>${label}</strong> <span class="meta">${extra}</span>`;
				cell.appendChild(div);

				if (cellInfo.rowspan > 1) {
					cell.rowSpan = cellInfo.rowspan;
				}
			} else {
				const blocks = allocations.filter(a =>
					a.day === day &&
					a.startHour === hour &&
					!a.unscheduled &&
					a.duration === 1
				);

				if (blocks.length > 0) {
					const block = blocks[0];
					const { label, extra } = describeBlock(block);
					const div = document.createElement("div");
					div.className = `slot ${block.type}`;
					div.innerHTML = `<strong>${label}</strong> <span class="meta">${extra}</span>`;
					cell.appendChild(div);
				} else {
					cell.innerHTML = "&nbsp;";
				}
			}

			row.appendChild(cell);
		}
		tbody.appendChild(row);
	}

	table.appendChild(tbody);
	return table;
}

function describeBlock(b) {
	const subject = state.subjects.find(s => s.id === b.subjectId);
	const teacher = state.teachers.find(t => t.id === b.teacherId);
	const subjectName = b.subjectName || (subject ? subject.name : "Subject");
	const subjectSection = b.section || (subject ? subject.section : "");
	const label = `${subjectName}${subjectSection ? ` @ ${subjectSection}` : ""}`;
	const teacherName = b.teacherName || (teacher ? teacher.name : "Unassigned");
	const room = (state.rooms || []).find(r => r.id === b.roomId);
	const roomName = b.roomName || (room ? room.name : "No room");
	const extra = `${b.type === "laboratory" ? "Lab" : "Lecture"} • ${teacherName} • ${b.duration}h • ${roomName}`;
	return { label, extra };
}

function formatHour(h) {
	const suffix = h >= 12 ? "PM" : "AM";
	const hour12 = ((h + 11) % 12) + 1;
	return `${hour12}:00 ${suffix}`;
}

// Event wiring
teacherForm.addEventListener("submit", e => {
	e.preventDefault();
	const name = teacherName.value.trim();
	if (!name) return;
	state.teachers.push({ id: uid(), name });
	teacherName.value = "";
	saveAll();
	renderAll();
});

subjectForm.addEventListener("submit", e => {
	e.preventDefault();
	const name = subjectName.value.trim();
	const section = (subjectSection?.value || "").trim();
	const units = Number(subjectUnits.value);
	const teacherId = subjectTeacher.value || "";
	if (!name || !units) return;
	const teacher = state.teachers.find(t => t.id === teacherId);
	state.subjects.push({ id: uid(), name, section, units, teacherId, department: (teacher && teacher.department) || state.selectedDepartment || "General" });
	subjectName.value = ""; if (subjectSection) subjectSection.value = ""; subjectUnits.value = ""; subjectTeacher.value = "";
	saveAll();
	renderAll();
});

viewMode.addEventListener("change", () => {
	updateViewFilterOptions();
	renderScheduleOnly();
});

viewFilter.addEventListener("change", () => {
	renderScheduleOnly();
});

generateBtn.addEventListener("click", async () => {
	const spinner = document.getElementById('loadingSpinner');
	const generateButton = document.getElementById('generateBtn');

	if (!spinner) {
		console.error('Loading spinner element not found!');
		return;
	}

	spinner.style.display = 'flex';
	generateButton.disabled = true;
	generateButton.textContent = 'Generating...';

	try {
		await new Promise(resolve => setTimeout(resolve, 100));

		const allocations = generateSchedule();
		await persistSchedulesToFirestore(allocations);
		const fbAllocations = await fetchFirestoreSchedules();

		if (viewMode.value !== "teachers-all") {
			viewMode.value = "teachers-all";
			updateViewFilterOptions();
		}
		renderTimetable(fbAllocations || allocations);
	} catch (error) {
		const allocations = generateSchedule();
		renderTimetable(allocations);
	} finally {
		spinner.style.display = 'none';
		generateButton.disabled = false;
		generateButton.textContent = 'Generate Schedule';
	}
});

if (saveBtn) {
	saveBtn.addEventListener("click", () => { saveAll(); alert("Saved to browser"); });
}
if (loadBtn) {
	loadBtn.addEventListener("click", () => { loadAll(); renderAll(); alert("Loaded from browser"); });
}
if (clearBtn) {
	clearBtn.addEventListener("click", () => { if (confirm("Clear all data?")) { state.teachers = []; state.subjects = []; saveAll(); renderAll(); } });
}
function openPrintModal() {
	if (!printModal || !printTeacherSelect) return;
	printTeacherSelect.innerHTML = `<option value="" disabled selected>Select a teacher</option>`;
	(state.teachers || []).forEach(t => {
		const opt = document.createElement("option");
		opt.value = t.id; opt.textContent = t.name;
		printTeacherSelect.appendChild(opt);
	});
	printModal.classList.add("show");
}

function closePrintModal() {
	if (printModal) printModal.classList.remove("show");
}

if (printBtn) {
	printBtn.addEventListener("click", () => {
		if (!state.teachers || !state.teachers.length) { alert("No teachers available in this department."); return; }
		openPrintModal();
	});
}

if (printCancelBtn) {
	printCancelBtn.addEventListener("click", () => closePrintModal());
}

if (printConfirmBtn) {
	printConfirmBtn.addEventListener("click", async () => {
		const teacherId = printTeacherSelect && printTeacherSelect.value;
		if (!teacherId) return;
		const teacher = state.teachers.find(t => t.id === teacherId);
		closePrintModal();
		let allocations = (latestRemoteAllocations || []).filter(a => a.teacherId === teacherId);
		if ((!allocations || !allocations.length) && db) {
			try {
				const all = await fetchFirestoreSchedules();
				allocations = all.filter(a => a.teacherId === teacherId);
			} catch (e) { }
		}
		const table = buildGridTable(allocations || []);
		/* state.teachers.forEach(t => {
			const weekly = computeTeacherWeeklyHours(t.id);
		}); */
		const title = `Schedule: ${teacher ? teacher.name : "Teacher"} `;
		const weeklyHours = computeTeacherWeeklyHours(teacherId);
		const weeklyHoursText = `Total Contact Hours: ${weeklyHours}hrs/week`;
		const win = window.open("", "_blank");
		if (!win) { alert("Popup blocked. Please allow popups to print."); return; }
		const doc = win.document;
		doc.open();
		const inlineCss = 
		`@page {
			size: A4 landscape;
			margin: 12mm;
		}

		body {
			background: #fff;
			margin: 0;
			padding: 0;
			color: #000;
			font-family: Inter, Arial, sans-serif;
		}

		h2 {
			margin: 0 0 8px;
			font-size: 18px;
		}

		.grid {
			width: 100%;
			border-collapse: collapse;
			table-layout: fixed;
		}

		.grid th,
		.grid td {
			border: 1px solid #000;
			padding: 8px;
			text-align: left;
			vertical-align: top;
		}

		.grid thead th:first-child,
		.grid tbody td:first-child {
			width: 140px;
		}

		.slot {
			display: block;
			padding: 4px 6px;
			border: 1px solid #888;
			border-radius: 6px;
			margin: 2px;
		}

		.slot .meta {
			color: #333;
		}
		
		/* Hide print controls when printing */
		@media print {
			button, .print-controls {
				display: none !important;
			}
			
			/* Ensure clean print layout */
			body {
				margin: 0;
				padding: 0;
			}
			
			section {
				margin: 0;
				padding: 0;
			}
		}
		`
		doc.write(`
			<!doctype html>
			<html>
			<head>
			  <meta charset="utf-8">
			  <meta name="viewport" content="width=device-width, initial-scale=1">
			  <title>${title}</title>
			  <style>
				${inlineCss}
			  </style>
			</head>
			<body>
			  <section>
				<h2>${title}</h2>
				<span><h2>${weeklyHoursText}</h2></span>
				${table.outerHTML}
			  </section>
			  
			  <!-- Print controls -->
			  <div class="print-controls" style="margin-top: 20px; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
				<h3 style="margin: 0 0 15px 0; color: #333;">Print Options</h3>
				<button id="printBtn" style="padding: 12px 24px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">
					🖨️ Print Schedule
				</button>
				<button id="closeBtn" style="padding: 12px 24px; font-size: 16px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
					❌ Close Window
				</button>
				<div style="margin-top: 15px; font-size: 14px; color: #666;">
					<p><strong>Alternative:</strong> Press <kbd>Ctrl+P</kbd> (Windows) or <kbd>Cmd+P</kbd> (Mac) to print</p>
					<p><strong>Note:</strong> The buttons above will be hidden when printing</p>
				</div>
			  </div>
			
			  <script>
				// Simple approach: just focus the window and show manual buttons
				window.addEventListener('load', function() {
					try {
						window.focus();
					} catch (e) {
						console.error('Focus failed:', e);
					}
				});
				
				// Function to handle manual print
				function manualPrint() {
					try {
						window.print();
					} catch (e) {
						console.error('Print failed:', e);
						alert('Print failed. Please try using Ctrl+P or right-click and select Print.');
					}
				}
				
				// Function to close window
				function closeWindow() {
					try {
						window.close();
					} catch (e) {
						console.error('Close failed:', e);
						alert('Please close this window manually.');
					}
				}
				
				// Make functions globally available immediately
				window.manualPrint = manualPrint;
				window.closeWindow = closeWindow;
				
				// Also attach event listeners directly to buttons for better compatibility
				document.addEventListener('DOMContentLoaded', function() {
					const printBtn = document.getElementById('printBtn');
					const closeBtn = document.getElementById('closeBtn');
					
					if (printBtn) {
						printBtn.addEventListener('click', manualPrint);
					}
					if (closeBtn) {
						closeBtn.addEventListener('click', closeWindow);
					}
				});
			  </script>
			</body>
			</html>
			`);
		doc.close();
	});
}

function renderScheduleOnly() {
	if (db) {
		if (latestRemoteAllocations && latestRemoteAllocations.length) {
			renderTimetable(latestRemoteAllocations);
		} else {
			fetchFirestoreSchedules().then(fbAllocations => {
				latestRemoteAllocations = fbAllocations || [];
				renderTimetable(latestRemoteAllocations);
			}).catch(() => {
				renderTimetable([]);
			});
		}
		return;
	}
	const allocations = generateSchedule();
	renderTimetable(allocations);
}

function persistSchedulesToFirestore(allocations) {
	if (!db) return;
	const schedulesCol = db.collection("schedules");
	const byTeacher = new Map();
	allocations.forEach(a => {
		if (a.unscheduled || !a.day) return;
		const subj = state.subjects.find(s => s.id === a.subjectId);
		const teach = state.teachers.find(t => t.id === a.teacherId);
		if (!byTeacher.has(a.teacherId)) byTeacher.set(a.teacherId, []);
		byTeacher.get(a.teacherId).push({
			...a,
			subjectName: subj ? subj.name : "",
			section: subj ? (subj.section || "") : "",
			teacherName: teach ? teach.name : "",
			department: (subj && subj.department) || (teach && teach.department) || state.selectedDepartment || "General",
			roomId: a.roomId || "",
			roomName: ((state.rooms || []).find(r => r.id === a.roomId)?.name) || "",
		});
	});
	byTeacher.forEach((items, teacherId) => {
		if (!teacherId) return;
		const department = (state.teachers.find(t => t.id === teacherId)?.department) || state.selectedDepartment || "General";
		const docId = `${department}__${teacherId}`;
		schedulesCol.doc(docId).set({ teacherId, department, items, updatedAt: Date.now() }).catch(() => { });
	});
}

function fetchFirestoreSchedules() {
	if (!db) return Promise.resolve([]);
	let query = db.collection("schedules");
	if (state.selectedDepartment) query = query.where("department", "==", state.selectedDepartment);
	return query.get().then(snap => {
		const allocations = [];
		snap.forEach(doc => {
			const data = doc.data();
			const items = Array.isArray(data.items) ? data.items : [];
			items.forEach(it => allocations.push({ ...it }));
		});
		return allocations;
	});
}

function renderAll() {
	renderTeachers();
	renderSubjects();
	renderRooms();
}

function renderRooms() {
	if (!roomList) return;
	roomList.innerHTML = "";
	state.rooms.filter(r => !state.selectedDepartment || r.department === state.selectedDepartment).forEach(r => {
		const li = document.createElement("li");
		li.innerHTML = `<span class="room-name">${r.name}</span> <span class="badge">${r.type}</span><button data-id="${r.id}" class="danger">Remove</button>`;
		li.querySelector("button.danger").addEventListener("click", () => {
			state.rooms = state.rooms.filter(x => x.id !== r.id);
			saveAll();
			renderAll();
		});
		roomList.appendChild(li);
	});
}

if (roomForm) {
	roomForm.addEventListener("submit", e => {
		e.preventDefault();
		const name = (roomName.value || "").trim();
		const type = roomType.value;
		if (!name || !type) return;
		const roomNames = expandRoomRange(name);
		roomNames.forEach(roomNameVal => {
			const id = uid();
			state.rooms.push({ id, name: roomNameVal, type, department: state.selectedDepartment || "General" });
		});
		roomName.value = ""; roomType.value = "";
		saveAll();
		renderAll();
	});
}

loadAll();
renderAll();
startSchedulesListener();
startDataListeners();

function addOrGetTeacherIdByName(name) {
	const trimmed = name.trim();
	if (!trimmed) return "";
	let t = state.teachers.find(x => x.name.toLowerCase() === trimmed.toLowerCase());
	if (t) return t.id;
	const id = uid();
	state.teachers.push({ id, name: trimmed });
	return id;
}

function parseBulkInput(text) {
	const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
	const results = [];
	for (const line of lines) {
		const [teacherPart, subjectsPart] = line.split(":");
		if (!teacherPart || !subjectsPart) continue;
		const teacherNameVal = teacherPart.trim();
		const teacherId = addOrGetTeacherIdByName(teacherNameVal);
		const subjectTokens = subjectsPart.split(";").map(s => s.trim()).filter(Boolean);
		for (const token of subjectTokens) {
			const pieces = token.split("-").map(p => p.trim());
			let nameAndSection = pieces[0] || "";
			let subjName = nameAndSection;
			let section = "";
			const atIdx = nameAndSection.indexOf("@");
			if (atIdx !== -1) {
				subjName = nameAndSection.slice(0, atIdx).trim();
				section = nameAndSection.slice(atIdx + 1).trim();
			}
			const unitPiece = (pieces[1] || "").toLowerCase();
			const studentsPiece = pieces[2] || "";
			let units = 0;
			if (unitPiece.includes("1u")) units = 1;
			if (unitPiece.includes("3u")) units = 3;
			let students = parseInt(studentsPiece, 10);
			if (Number.isNaN(students) || students <= 0) students = 30;
			if (!subjName || (units !== 1 && units !== 3)) continue;
			results.push({ name: subjName, section, units, teacherId, students });
		}
	}
	return results;
}

if (bulkImportBtn && bulkInput) {
	bulkImportBtn.addEventListener("click", () => {
		const text = bulkInput.value || "";
		const subjectsToAdd = parseBulkInput(text);
		for (const s of subjectsToAdd) {
			const exists = state.subjects.some(x => x.name.toLowerCase() === s.name.toLowerCase() && x.teacherId === s.teacherId && x.units === s.units);
			if (!exists) state.subjects.push({ id: uid(), ...s, department: state.selectedDepartment || "General" });
		}
		saveAll();
		renderAll();
		alert(`Imported ${subjectsToAdd.length} subject(s).`);
	});
}

if (bulkClearBtn && bulkInput) {
	bulkClearBtn.addEventListener("click", () => { bulkInput.value = ""; });
}

if (departmentSelect && addDepartmentBtn && newDepartment) {
	addDepartmentBtn.addEventListener("click", () => {
		const name = (newDepartment.value || "").trim();
		console.log("AddDepartment clicked", { name });
		if (!name) return;
		const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		if (!state.departments.find(d => d.id === id)) {
			state.departments.push({ id, name });
		}
		state.selectedDepartment = id;
		newDepartment.value = "";
		// Optimistic UI update
		renderAll();
		if (departmentSelect) {
			departmentSelect.value = id;
		}
		// Write directly to Firestore
		if (db) {
			console.log("Writing department to Firestore", { id, name });
			db.collection("departments").doc(id).set({ id, name })
				.then(() => {
					console.log("Department saved to Firestore");
					localStorage.setItem("css_departments", JSON.stringify(state.departments));
					localStorage.setItem("css_selected_department", state.selectedDepartment);
					restartRealtimeListeners();
				})
				.catch(err => {
					console.warn("Department save failed:", err);
					alert("Failed to save department. Check your network or Firestore rules.");
				});
		} else {
			// Persist locally if no db
			localStorage.setItem("css_departments", JSON.stringify(state.departments));
			localStorage.setItem("css_selected_department", state.selectedDepartment);
		}
	});
	departmentSelect.addEventListener("change", () => {
		state.selectedDepartment = departmentSelect.value;
		localStorage.setItem("css_selected_department", state.selectedDepartment);
		renderAll();
		restartRealtimeListeners();
	});
}

function restartRealtimeListeners() {
	if (!db) return;
	if (teachersUnsubscribe) { teachersUnsubscribe(); teachersUnsubscribe = null; }
	if (subjectsUnsubscribe) { subjectsUnsubscribe(); subjectsUnsubscribe = null; }
	if (schedulesUnsubscribe) { schedulesUnsubscribe(); schedulesUnsubscribe = null; }
	if (roomsUnsubscribe) { roomsUnsubscribe(); roomsUnsubscribe = null; }
	startDataListeners();
	startSchedulesListener();
}

