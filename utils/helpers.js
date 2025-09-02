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

function formatHour(h) {
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:00 ${suffix}`;
}

function describeBlock(b, subjects, teachers, rooms) {
  const subject = subjects.find(s => s.id === b.subjectId);
  const teacher = teachers.find(t => t.id === b.teacherId);
  const subjectName = b.subjectName || (subject ? subject.name : "Subject");
  const subjectSection = b.section || (subject ? subject.section : "");
  const label = `${subjectName}${subjectSection ? ` @ ${subjectSection}` : ""}`;
  const teacherName = b.teacherName || (teacher ? teacher.name : "Unassigned");
  const room = (rooms || []).find(r => r.id === b.roomId);
  const roomName = b.roomName || (room ? room.name : "No room");
  const extra = `${b.type === "laboratory" ? "Lab" : "Lecture"} • ${teacherName} • ${b.duration}h • ${roomName}`;
  return { label, extra };
}

function parseBulkInput(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];
  for (const line of lines) {
    const [teacherPart, subjectsPart] = line.split(":");
    if (!teacherPart || !subjectsPart) continue;
    const teacherNameVal = teacherPart.trim();
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
      results.push({ name: subjName, section, units, teacherName: teacherNameVal, students });
    }
  }
  return results;
}

module.exports = {
  uid,
  expandSectionRange,
  expandRoomRange,
  formatHour,
  describeBlock,
  parseBulkInput
};
