(function () {
    const TimetableImporter = {};

    // --- Configuration ---
    // Subject Aliases: Map from Excel Name -> DB Subject Name (Exact or Base)
    // --- Configuration ---
    // Subject Aliases: Map from Excel Name -> DB Subject Name (Exact or Base)
    // Now loaded from js/utils/subject-aliases.js
    const getSubjectAliases = () => globalThis.App?.SubjectAliases || {};

    // --- Main Import Function ---
    TimetableImporter.processFile = async function (file, semesterId, existingTeachers, existingSubjects) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array of Arrays

                    const result = analyzeTimetableData(json, existingTeachers, existingSubjects);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };

    function analyzeTimetableData(rows, dbTeachers, dbSubjects) {
        const teacherScheduleMap = {};
        const report = {
            foundTeachers: [],
            missingTeachers: [],
            totalCells: 0,
            skippedCells: 0,
            unknownSubjects: new Set() // Track unknown subject names
        };

        const currentDbTeachers = dbTeachers || [];
        const teacherNameMap = {};
        currentDbTeachers.forEach(t => teacherNameMap[t.name] = t.id);

        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const cellVal = (rows[r][c] || '').toString().trim();

                if (cellVal in teacherNameMap) {
                    const teacherName = cellVal;
                    const teacherId = teacherNameMap[teacherName];

                    if (report.foundTeachers.includes(teacherName)) continue;
                    report.foundTeachers.push(teacherName);

                    parseTeacherBlock(rows, r, c, teacherId, teacherScheduleMap, report, dbSubjects, currentDbTeachers);
                }
            }
        }

        // Convert Set to Array for easier display
        report.unknownSubjects = Array.from(report.unknownSubjects);
        return { map: teacherScheduleMap, report: report };
    }

    function parseTeacherBlock(rows, startRow, startCol, teacherId, scheduleMap, report, dbSubjects, dbTeachers) {
        const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const currentDbTeachers = dbTeachers || [];

        for (let i = 0; i < 7; i++) { // 1 to 7 periods
            const currentRow = startRow + 1 + i;
            if (currentRow >= rows.length) break;

            for (let d = 0; d < 5; d++) {
                const col = startCol + 1 + d;
                const cellContent = (rows[currentRow][col] || '').toString().trim();

                if (cellContent) {
                    report.totalCells++;
                    // Pass currentDbTeachers to allow inference
                    const { parsed, errorReason, rawSubject } = parseCellContent(cellContent, dbSubjects, teacherId, currentDbTeachers);

                    if (parsed) {
                        if (!scheduleMap[teacherId]) scheduleMap[teacherId] = [];

                        scheduleMap[teacherId].push({
                            day: DAYS[d],
                            period: i + 1,
                            grade: parsed.grade,
                            class_group: parsed.class_group,
                            subject_id: parsed.subject_id
                        });
                    } else {
                        report.skippedCells++;
                        if (errorReason === 'unknown_subject' && rawSubject) {
                            report.unknownSubjects.add(rawSubject);
                        }
                    }
                }
            }
        }
    }

    function parseCellContent(text, dbSubjects, teacherId = null, dbTeachers = []) {
        // Preprocess: Replace newline/tab with space, then trim
        const cleanText = text.replace(/[\r\n\t]+/g, ' ').trim();

        // Regex: Start with Digit (Grade) -> Digit(s) (Class) -> Optional Separator -> Rest (Subject)
        // Supports: 305물리, 305 물리, 35물리, 305
        const match = cleanText.match(/^(\d)(\d{1,2})[\/\-\s]*(.*)$/);

        if (!match) {
            return { parsed: null, errorReason: 'format_mismatch' };
        }

        const grade = parseInt(match[1]);
        const classNum = parseInt(match[2]);
        let rawSubject = match[3].trim();

        // If subject part is empty, try to find a teacher-based subject
        let subjectId = findSubjectId(rawSubject, dbSubjects);

        // Fallback: If no subject found, and we have teacher info, try to infer from teacher name
        if (!subjectId && teacherId && dbTeachers) {
            const teacher = dbTeachers.find(t => t.id == teacherId);
            if (teacher) {
                // Try to find a subject that matches a prefix of the teacher's name (e.g., "Chem" -> "화학")
                // Or if rawSubject contains the teacher's initials/name, ignore it and look for subject
                // If rawSubject is empty, we definitely use inference
                subjectId = inferSubjectFromTeacher(teacher, dbSubjects, grade);
            }
        }

        if (!subjectId) {
            return { parsed: null, errorReason: 'unknown_subject', rawSubject: rawSubject || '(공백)' };
        }

        const classGroup = classNum.toString();

        return {
            parsed: {
                grade,
                class_group: classGroup,
                subject_id: subjectId
            },
            errorReason: null
        };
    }

    function findSubjectId(rawName, dbSubjects) {
        if (!rawName) return null;

        // 1. Normalize input name
        const normalize = globalThis.App?.normalizeSubject || (n => n.toString().replace(/\s+/g, ''));
        let normInput = normalize(rawName);

        // Remove numeric suffixes like "과탐1" or "물리A" if they don't help
        // But keep I, II, 1, 2 if they are part of level mapping
        const normInputWithoutSuffix = normInput.replace(/[0-9ABC]$/, '');

        // 2. Try to find match in DB by normalizing both sides
        // If normInput is "통화1", normalize(normInput) might be "통합과학I" (if alias exists)
        // We compare normalized DB names with normalized input
        let found = dbSubjects.find(s => normalize(s.name) === normInput) || 
                    dbSubjects.find(s => normalize(s.name) === normalize(normInputWithoutSuffix));
        
        if (found) return found.id;

        // 3. StartsWith (fallback)
        const starts = dbSubjects.find(s => normalize(s.name).startsWith(normInput)) ||
                       dbSubjects.find(s => normalize(s.name).startsWith(normalize(normInputWithoutSuffix)));
        if (starts) return starts.id;

        return null;
    }

    function inferSubjectFromTeacher(teacher, dbSubjects, grade) {
        const teacherName = teacher.name || '';
        
        // 1. Special case for Grade 1: 
        // Regardless of teacher's base subject, 1st grade should be Tonghap-Gwahak or GwaTamSil
        if (grade === 1) {
            const prefers = ['통합과학', '과학탐구실험'];
            const found = dbSubjects.find(s => prefers.some(p => s.name.includes(p)));
            if (found) return found.id;
        }

        // 2. Mapping based on teacher name prefixes (for Grad 2 & 3)
        const mappings = [
            { key: '화', subjects: ['화학', '물질', '화반'] },
            { key: 'Chem', subjects: ['화학', '물질', '화반'] },
            { key: '물', subjects: ['물리', '역학', '전자'] },
            { key: 'Phys', subjects: ['물리', '역학', '전자'] },
            { key: '생', subjects: ['생명', '세포', '유전'] },
            { key: 'Bio', subjects: ['생명', '세포', '유전'] },
            { key: '지', subjects: ['지구', '지구시스템', '행성'] },
            { key: 'Earth', subjects: ['지구', '지구시스템', '행성'] },
            { key: '과', subjects: ['통합과학', '과학탐구실험'] }
        ];

        const match = mappings.find(m => teacherName.toLowerCase().startsWith(m.key.toLowerCase()));
        if (!match) return null;

        // Try to find a subject that matches one of the candidates and given grade
        const candidates = dbSubjects.filter(s => match.subjects.some(name => s.name.includes(name)));

        if (candidates.length === 0) return null;

        // Grade-based preferences for Level I/II (Grade 2/3)
        if (grade === 2) {
            const level1 = candidates.find(s => s.name.includes('I') && !s.name.includes('II'));
            if (level1) return level1.id;
        } else if (grade === 3) {
            const level2 = candidates.find(s => s.name.includes('II'));
            if (level2) return level2.id;
        }

        // Default: return the first one from candidates
        return candidates[0].id;
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.TimetableImporter = TimetableImporter;
})();
