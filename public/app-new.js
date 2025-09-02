// Updated frontend application using API endpoints
const state = {
	teachers: [],
	subjects: [],
	departments: [],
	selectedDepartment: "",
	rooms: [],
};

// DOM elements
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

const bulkInput = document.getElementById("bulkInput");
const bulkImportBtn = document.getElementById("bulkImportBtn");
const bulkClearBtn = document.getElementById("bulkClearBtn");

let latestRemoteAllocations = [];

// Utility functions
function showError(message) {
	alert(`Error: ${message}`);
}

function showSuccess(message) {
	alert(`Success: ${message}`);
}

function showLoading(element, text = 'Loading...') {
	if (element) {
		element.disabled = true;
		element.textContent = text;
	}
}

function hideLoading(element, originalText) {
	if (element) {
		element.disabled = false;
		element.textContent = originalText;
	}
}

// Load all data from API
async function loadAll() {
	try {
		// Load departments
		const departments = await apiClient.getDepartments();
		state.departments = departments;
		
		// Set default department if none selected
		if (!state.selectedDepartment && departments.length > 0) {
			state.selectedDepartment = departments[0].id;
		}
		
		// Load data for selected department
		await loadDepartmentData();
		
		renderAll();
	} catch (error) {
		console.error('Failed to load data:', error);
		showError('Failed to load data from server');
	}
}

// Load data for the selected department
async function loadDepartmentData() {
	if (!state.selectedDepartment) return;
	
	try {
		const [teachers, subjects, rooms, schedules] = await Promise.all([
			apiClient.getTeachers(state.selectedDepartment),
			apiClient.getSubjects(state.selectedDepartment),
			apiClient.getRooms(state.selectedDepartment),
			apiClient.getSchedules(state.selectedDepartment)
		]);
		
		state.teachers = teachers;
		state.subjects = subjects;
		state.rooms = rooms;
		
		// Process schedules
		latestRemoteAllocations = [];
		schedules.forEach(schedule => {
			if (schedule.items && Array.isArray(schedule.items)) {
				latestRemoteAllocations.push(...schedule.items);
			}
		});
		
	} catch (error) {
		console.error('Failed to load department data:', error);
		showError('Failed to load department data');
	}
}

// Render functions
function renderTeachers() {
	if (!teacherList) return;
	
	teacherList.innerHTML = "";
	
	// Update department select
	if (departmentSelect) {
		departmentSelect.innerHTML = `<option value="" disabled ${state.selectedDepartment ? "" : "selected"}>Select Department</option>`;
		state.departments.forEach(d => {
			const opt = document.createElement("option");
			opt.value = d.id;
			opt.textContent = d.name;
			if (state.selectedDepartment === d.id) opt.selected = true;
			departmentSelect.appendChild(opt);
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
		
		li.querySelector("button.danger").addEventListener("click", async () => {
			try {
				await apiClient.deleteTeacher(t.id);
				await loadDepartmentData();
				renderAll();
				showSuccess('Teacher deleted successfully');
			} catch (error) {
				showError('Failed to delete teacher');
			}
		});

		const form = li.querySelector("form.sub-form");
		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			const formData = new FormData(form);
			const name = String(formData.get("name") || "").trim();
			const sectionInput = String(formData.get("section") || "").trim();
			const units = Number(formData.get("units"));
			
			if (!name || !units) return;
			
			try {
				await apiClient.createSubject({
					name,
					section: sectionInput,
					units,
					teacherId: t.id,
					department: state.selectedDepartment
				});
				
				await loadDepartmentData();
				form.reset();
				renderAll();
				showSuccess('Subject added successfully');
			} catch (error) {
				showError('Failed to add subject');
			}
		});

		const ul = li.querySelector(".sub-list");
		state.subjects.filter(s => s.teacherId === t.id).forEach(s => {
			const item = document.createElement("li");
			const sectionBadge = s.section ? `<span class="badge">${s.section}</span>` : "";
			item.innerHTML = `<span>${s.name} ${sectionBadge} <span class="badge">${s.units}u</span></span><button data-subid="${s.id}" class="danger">Remove</button>`;
			item.querySelector("button.danger").addEventListener("click", async () => {
				try {
					await apiClient.deleteSubject(s.id);
					await loadDepartmentData();
					renderAll();
					showSuccess('Subject deleted successfully');
				} catch (error) {
					showError('Failed to delete subject');
				}
			});
			ul.appendChild(item);
		});

		teacherList.appendChild(li);
	});

	// Update subject teacher dropdown
	if (subjectTeacher) {
		subjectTeacher.innerHTML = `<option value="" disabled ${state.teachers.length ? "" : "selected"}>Assign teacher</option>`;
		state.teachers.forEach(t => {
			const opt = document.createElement("option");
			opt.value = t.id;
			opt.textContent = t.name;
			subjectTeacher.appendChild(opt);
		});
	}

	updateViewFilterOptions();
}

function renderSubjects() {
	if (!subjectList) return;
	
	subjectList.innerHTML = "";
	state.subjects.forEach(s => {
		const li = document.createElement("li");
		const teacher = state.teachers.find(t => t.id === s.teacherId);
		const teacherNameTxt = teacher ? teacher.name : "Unassigned";
		const sectionBadge = s.section ? `<span class="badge">${s.section}</span>` : "";
		li.innerHTML = `<span>${s.name} ${sectionBadge} <span class="badge">${s.units}u</span> <span class="badge">${teacherNameTxt}</span></span><button data-id="${s.id}">Remove</button>`;
		li.querySelector("button").addEventListener("click", async () => {
			try {
				await apiClient.deleteSubject(s.id);
				await loadDepartmentData();
				renderAll();
				showSuccess('Subject deleted successfully');
			} catch (error) {
				showError('Failed to delete subject');
			}
		});
		subjectList.appendChild(li);
	});

	updateViewFilterOptions();
}

function renderRooms() {
	if (!roomList) return;
	
	roomList.innerHTML = "";
	state.rooms.forEach(r => {
		const li = document.createElement("li");
		li.innerHTML = `<span class="room-name">${r.name}</span> <span class="badge">${r.type}</span><button data-id="${r.id}" class="danger">Remove</button>`;
		li.querySelector("button.danger").addEventListener("click", async () => {
			try {
				await apiClient.deleteRoom(r.id);
				await loadDepartmentData();
				renderAll();
				showSuccess('Room deleted successfully');
			} catch (error) {
				showError('Failed to delete room');
			}
		});
		roomList.appendChild(li);
	});
}

function updateViewFilterOptions() {
	if (!viewMode || !viewFilter) return;
	
	const mode = viewMode.value;
	viewFilter.disabled = mode === "all";
	viewFilter.innerHTML = `<option value="">Select filter</option>`;
	
	if (mode === "by-teacher") {
		state.teachers.forEach(t => {
			const opt = document.createElement("option");
			opt.value = t.id;
			opt.textContent = t.name;
			viewFilter.appendChild(opt);
		});
	}
	if (mode === "by-subject") {
		state.subjects.forEach(s => {
			const opt = document.createElement("option");
			opt.value = s.id;
			opt.textContent = s.name;
			viewFilter.appendChild(opt);
		});
	}
}

function renderAll() {
	renderTeachers();
	renderSubjects();
	renderRooms();
}

// Import scheduling functions from the original app
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

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

function formatHour(h) {
	const suffix = h >= 12 ? "PM" : "AM";
	const hour12 = ((h + 11) % 12) + 1;
	return `${hour12}:00 ${suffix}`;
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

function renderTimetable(allocations) {
	if (!timetable) return;
	
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

// Event listeners
if (teacherForm) {
	teacherForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const name = teacherName.value.trim();
		if (!name) return;
		
		try {
			showLoading(teacherForm.querySelector('button[type="submit"]'), 'Adding...');
			await apiClient.createTeacher({
				name,
				department: state.selectedDepartment
			});
			
			teacherName.value = "";
			await loadDepartmentData();
			renderAll();
			showSuccess('Teacher added successfully');
		} catch (error) {
			showError('Failed to add teacher');
		} finally {
			hideLoading(teacherForm.querySelector('button[type="submit"]'), 'Add Teacher');
		}
	});
}

if (subjectForm) {
	subjectForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const name = subjectName.value.trim();
		const section = (subjectSection?.value || "").trim();
		const units = Number(subjectUnits.value);
		const teacherId = subjectTeacher.value || "";
		
		if (!name || !units) return;
		
		try {
			showLoading(subjectForm.querySelector('button[type="submit"]'), 'Adding...');
			await apiClient.createSubject({
				name,
				section,
				units,
				teacherId,
				department: state.selectedDepartment
			});
			
			subjectName.value = "";
			if (subjectSection) subjectSection.value = "";
			subjectUnits.value = "";
			subjectTeacher.value = "";
			
			await loadDepartmentData();
			renderAll();
			showSuccess('Subject added successfully');
		} catch (error) {
			showError('Failed to add subject');
		} finally {
			hideLoading(subjectForm.querySelector('button[type="submit"]'), 'Add Subject');
		}
	});
}

if (roomForm) {
	roomForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const name = (roomName.value || "").trim();
		const type = roomType.value;
		
		if (!name || !type) return;
		
		try {
			showLoading(roomForm.querySelector('button[type="submit"]'), 'Adding...');
			await apiClient.createRoom({
				name,
				type,
				department: state.selectedDepartment
			});
			
			roomName.value = "";
			roomType.value = "";
			
			await loadDepartmentData();
			renderAll();
			showSuccess('Room added successfully');
		} catch (error) {
			showError('Failed to add room');
		} finally {
			hideLoading(roomForm.querySelector('button[type="submit"]'), 'Add Room');
		}
	});
}

if (viewMode) {
	viewMode.addEventListener("change", () => {
		updateViewFilterOptions();
		renderScheduleOnly();
	});
}

if (viewFilter) {
	viewFilter.addEventListener("change", () => {
		renderScheduleOnly();
	});
}

if (generateBtn) {
	generateBtn.addEventListener("click", async () => {
		if (!state.selectedDepartment) {
			showError('Please select a department first');
			return;
		}
		
		try {
			showLoading(generateBtn, 'Generating...');
			
			const result = await apiClient.generateSchedule(state.selectedDepartment);
			
			// Update local allocations
			latestRemoteAllocations = result.allocations;
			
			if (viewMode.value !== "teachers-all") {
				viewMode.value = "teachers-all";
				updateViewFilterOptions();
			}
			
			renderTimetable(latestRemoteAllocations);
			showSuccess(`Schedule generated successfully! ${result.summary.scheduled} scheduled, ${result.summary.unscheduled} unscheduled`);
		} catch (error) {
			showError('Failed to generate schedule');
		} finally {
			hideLoading(generateBtn, 'Generate Schedule');
		}
	});
}

if (addDepartmentBtn && newDepartment) {
	addDepartmentBtn.addEventListener("click", async () => {
		const name = (newDepartment.value || "").trim();
		if (!name) return;
		
		try {
			showLoading(addDepartmentBtn, 'Adding...');
			await apiClient.createDepartment({ name });
			
			state.selectedDepartment = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
			newDepartment.value = "";
			
			await loadAll();
			showSuccess('Department added successfully');
		} catch (error) {
			showError('Failed to add department');
		} finally {
			hideLoading(addDepartmentBtn, 'Add Department');
		}
	});
}

if (departmentSelect) {
	departmentSelect.addEventListener("change", async () => {
		state.selectedDepartment = departmentSelect.value;
		await loadDepartmentData();
		renderAll();
	});
}

if (bulkImportBtn && bulkInput) {
	bulkImportBtn.addEventListener("click", async () => {
		const text = bulkInput.value || "";
		if (!text.trim()) {
			showError('Please enter bulk import data');
			return;
		}
		
		try {
			showLoading(bulkImportBtn, 'Importing...');
			const result = await apiClient.bulkImportSubjects(text, state.selectedDepartment);
			
			await loadDepartmentData();
			renderAll();
			showSuccess(result.message);
		} catch (error) {
			showError('Failed to import subjects');
		} finally {
			hideLoading(bulkImportBtn, 'Import');
		}
	});
}

if (bulkClearBtn && bulkInput) {
	bulkClearBtn.addEventListener("click", () => {
		bulkInput.value = "";
	});
}

function renderScheduleOnly() {
	if (latestRemoteAllocations && latestRemoteAllocations.length) {
		renderTimetable(latestRemoteAllocations);
	} else {
		renderTimetable([]);
	}
}

// Print functionality
function openPrintModal() {
	if (!printModal || !printTeacherSelect) return;
	printTeacherSelect.innerHTML = `<option value="" disabled selected>Select a teacher</option>`;
	(state.teachers || []).forEach(t => {
		const opt = document.createElement("option");
		opt.value = t.id;
		opt.textContent = t.name;
		printTeacherSelect.appendChild(opt);
	});
	printModal.classList.add("show");
}

function closePrintModal() {
	if (printModal) printModal.classList.remove("show");
}

if (printBtn) {
	printBtn.addEventListener("click", () => {
		if (!state.teachers || !state.teachers.length) {
			showError("No teachers available in this department.");
			return;
		}
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
		
		let allocations = latestRemoteAllocations.filter(a => a.teacherId === teacherId);
		const table = buildGridTable(allocations || []);
		const title = `Schedule: ${teacher ? teacher.name : "Teacher"}`;
		const weeklyHours = computeTeacherWeeklyHours(teacherId);
		const weeklyHoursText = `Total Contact Hours: ${weeklyHours}hrs/week`;
		
		const win = window.open("", "_blank");
		if (!win) {
			showError("Popup blocked. Please allow popups to print.");
			return;
		}
		
		const doc = win.document;
		doc.open();
		const inlineCss = `
		@page {
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
		`;
		
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

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
	loadAll();
});
