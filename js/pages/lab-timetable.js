// /js/pages/lab-timetable.js
(function () {
    const LabTimetable = {};

    let currentSemesterId = null;
    let currentSemester = null;
    let currentTeacherId = null;

    let classCounts = {}; // { 1: 5, 2: 6, 3: 5 } (Grade -> Count)
    let subjects = [];    // List of available subjects
    let allTeachers = []; // For import validation

    // Grid Configuration
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const DAY_LABELS = { 'Mon': '월', 'Tue': '화', 'Wed': '수', 'Thu': '목', 'Fri': '금', 'Sat': '토', 'Sun': '일' };

    // Rows (Updated with Times)
    const ROWS = [
        { id: 1, label: '1교시' },
        { id: 2, label: '2교시' },
        { id: 3, label: '3교시' },
        { id: 4, label: '4교시' },
        { id: 'LUNCH', label: '점심' },
        { id: 5, label: '5교시' },
        { id: 6, label: '6교시' },
        { id: 7, label: '7교시' },
        { id: 'AFTER', label: '방과후' }
    ];

    LabTimetable.init = async function () {
        console.log("📅 Teacher Timetable Mode Init");
        const supabase = App.supabase || window.supabaseClient;

        // Reset State (For SPA navigation)
        currentSemesterId = null;
        currentSemester = null;
        currentTeacherId = null;
        classCounts = {};
        subjects = [];
        allTeachers = [];

        // Elements
        const semSelect = document.getElementById('timetable-semester-select');
        const teacherSelect = document.getElementById('timetable-teacher-select');

        const btnSave = document.getElementById('btn-save-timetable');
        const btnCancel = document.getElementById('btn-cancel-timetable');
        const gridBody = document.getElementById('timetable-body');

        // Import elements
        const btnImport = document.getElementById('btn-import-excel');
        const fileInput = document.getElementById('file-upload-excel');
        const btnViewAll = document.getElementById('btn-view-all');

        // Init UI
        if (semSelect) semSelect.innerHTML = '<option value="">학년도 로딩 중...</option>';
        if (teacherSelect) teacherSelect.innerHTML = '<option value="">교사 선택</option>';
        renderEmptyGrid();

        await loadSemesters();

        // Listeners
        if (semSelect) {
            semSelect.addEventListener('change', async (e) => {
                currentSemesterId = e.target.value;
                currentTeacherId = null;
                renderEmptyGrid();
                if (!currentSemesterId) {
                    resetContext();
                    return;
                }
                await loadSemesterData(currentSemesterId);
            });
        }

        if (teacherSelect) {
            teacherSelect.addEventListener('change', async (e) => {
                currentTeacherId = e.target.value;
                if (currentSemesterId && currentTeacherId) {
                    await loadTeacherSchedule();
                } else {
                    renderEmptyGrid();
                }
            });
        }

        if (btnSave) {
            btnSave.addEventListener('click', saveSchedule);
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                window.history.back();
            });
        }

        // Import Handlers
        if (btnImport && fileInput) {
            btnImport.addEventListener('click', () => {
                if (!currentSemesterId) {
                    alert('학년도를 먼저 선택해주세요.');
                    return;
                }
                fileInput.click();
            });

            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                await handleExcelUpload(file);
                fileInput.value = '';
            });
        }

        if (btnViewAll) {
            btnViewAll.addEventListener('click', () => {
                if (!currentSemesterId) {
                    alert('학년도를 선택해주세요.');
                    return;
                }
                if (window.App && window.App.Router && window.App.Router.go) {
                    window.App.Router.go('labTimetableViewer', { semesterId: currentSemesterId });
                }
            });
        }

        async function loadSemesters() {
            const { data } = await supabase.from('lab_semesters').select('*').order('created_at', { ascending: false });
            if (semSelect && data) {
                semSelect.innerHTML = '<option value="">학년도 선택</option>';
                data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    semSelect.appendChild(opt);
                });
            }
        }

        async function loadSemesterData(semId) {
            const { data: semInfo } = await supabase.from('lab_semesters').select('*').eq('id', semId).single();
            currentSemester = semInfo;

            const { data: tData } = await supabase.from('lab_teachers').select('*').eq('semester_id', semId);
            allTeachers = tData || [];

            if (teacherSelect) {
                teacherSelect.innerHTML = '<option value="">교사 선택</option>';
                allTeachers.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = t.name;
                    teacherSelect.appendChild(opt);
                });
            }

            const { data: sData } = await supabase.from('lab_subjects').select('*').eq('semester_id', semId);
            subjects = sData || [];

            const { data: cData } = await supabase.from('lab_class_counts').select('*').eq('semester_id', semId);
            classCounts = { 1: 0, 2: 0, 3: 0 };
            if (cData) {
                cData.forEach(c => {
                    classCounts[c.grade] = c.class_count;
                });
            }
        }

        function resetContext() {
            currentTeacherId = null;
            if (teacherSelect) teacherSelect.innerHTML = '<option value="">교사 선택</option>';
            renderEmptyGrid();
        }

        function renderEmptyGrid() {
            if (!gridBody) return;
            gridBody.innerHTML = '';
            ROWS.forEach(rowInfo => {
                const tr = document.createElement('tr');
                if (rowInfo.id === 'LUNCH') tr.className = 'row-divider';
                if (rowInfo.id === 'AFTER') tr.className = 'row-afterschool';
                const th = document.createElement('td');
                th.textContent = rowInfo.label;
                th.className = 'timetable-header-cell';
                // Inline styles removed: fontWeight, backgroundColor, verticalAlign, textAlign, fontSize
                tr.appendChild(th);
                DAYS.forEach(day => {
                    const td = document.createElement('td');
                    td.className = 'grid-cell';
                    td.dataset.day = day;
                    td.dataset.rowId = rowInfo.id;
                    td.appendChild(createCellContent(day, rowInfo.id));
                    tr.appendChild(td);
                });
                gridBody.appendChild(tr);
            });
        }

        function createCellContent(day, rowId) {
            const container = document.createElement('div');
            container.className = 'cell-content';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'cell-checkbox';
            checkbox.addEventListener('change', (e) => toggleInputs(container, e.target.checked));
            container.appendChild(checkbox);
            const inputsDiv = document.createElement('div');
            inputsDiv.className = 'cell-inputs';
            const selGrade = document.createElement('select');
            selGrade.className = 'cell-select sel-grade';
            selGrade.innerHTML = '<option value="">학년</option><option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option>';
            selGrade.addEventListener('change', () => updateClassOptions(selGrade, selClass));
            const selClass = document.createElement('select');
            selClass.className = 'cell-select sel-class';
            selClass.innerHTML = '<option value="">반</option>';
            const selSubject = document.createElement('select');
            selSubject.className = 'cell-select sel-subject';
            selSubject.innerHTML = '<option value="">과목</option>';
            subjects.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub.id;
                opt.textContent = sub.name;
                selSubject.appendChild(opt);
            });
            inputsDiv.appendChild(selGrade);
            inputsDiv.appendChild(selClass);
            inputsDiv.appendChild(selSubject);
            container.appendChild(inputsDiv);
            return container;
        }

        function toggleInputs(container, isChecked) {
            const inputsDiv = container.querySelector('.cell-inputs');
            if (isChecked) inputsDiv.classList.add('active');
            else inputsDiv.classList.remove('active');
        }

        function updateClassOptions(gradeSelect, classSelect) {
            const grade = gradeSelect.value;
            classSelect.innerHTML = '<option value="">반</option>';
            if (!grade) return;
            const count = classCounts[grade] || 0;
            for (let i = 1; i <= count; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = `${i}반`;
                classSelect.appendChild(opt);
            }
        }

        async function loadTeacherSchedule() {
            renderEmptyGrid();
            if (!currentSemesterId || !currentTeacherId) return;
            const { data, error } = await supabase.from('lab_timetables').select('*').eq('semester_id', currentSemesterId).eq('teacher_id', currentTeacherId);
            if (error) { console.error(error); return; }
            if (!data || data.length === 0) return;
            data.forEach(item => {
                let rId = item.period;
                if (rId === 99) rId = 'LUNCH';
                if (rId === 100) rId = 'AFTER';
                const cell = gridBody.querySelector(`td[data-day="${item.day_of_week}"][data-row-id="${rId}"]`);
                if (cell) {
                    const cb = cell.querySelector('.cell-checkbox');
                    const inputsDiv = cell.querySelector('.cell-inputs');
                    const selGrade = cell.querySelector('.sel-grade');
                    const selClass = cell.querySelector('.sel-class');
                    const selSubject = cell.querySelector('.sel-subject');
                    cb.checked = true;
                    inputsDiv.classList.add('active');
                    if (item.grade) {
                        selGrade.value = item.grade;
                        updateClassOptions(selGrade, selClass);
                        if (item.class_number) selClass.value = item.class_number;
                    }
                    if (item.subject_id) selSubject.value = item.subject_id;
                }
            });
        }

        async function saveSchedule() {
            if (!currentSemesterId || !currentTeacherId) {
                alert('학년도와 교사를 선택해주세요.');
                return;
            }
            const cells = gridBody.querySelectorAll('.grid-cell');
            const newPayloads = [];
            for (const cell of cells) {
                const cb = cell.querySelector('.cell-checkbox');
                if (cb.checked) {
                    const day = cell.dataset.day;
                    const rowId = cell.dataset.rowId;
                    const selGrade = cell.querySelector('.sel-grade');
                    const selClass = cell.querySelector('.sel-class');
                    const selSubject = cell.querySelector('.sel-subject');
                    const g = selGrade.value;
                    const c = selClass.value;
                    const s = selSubject.value;
                    if (!g || !c || !s) {
                        alert(`[${DAY_LABELS[day]} ${getLabel(rowId)}] 정보가 누락되었습니다.\n학년, 반, 과목을 모두 선택해주세요.`);
                        return;
                    }
                    let dbPeriod = parseInt(rowId);
                    if (rowId === 'LUNCH') dbPeriod = 99;
                    if (rowId === 'AFTER') dbPeriod = 100;
                    newPayloads.push({
                        semester_id: Number(currentSemesterId),
                        teacher_id: Number(currentTeacherId),
                        day_of_week: day,
                        period: dbPeriod,
                        grade: Number(g),
                        class_number: Number(c),
                        subject_id: Number(s),
                        valid_from: currentSemester?.start_date || new Date().toISOString().split('T')[0],
                        valid_to: currentSemester?.end_date || '2099-12-31'
                    });
                }
            }
            try {
                const { error: delError } = await supabase.from('lab_timetables').delete().eq('semester_id', currentSemesterId).eq('teacher_id', currentTeacherId);
                if (delError) throw delError;
                if (newPayloads.length > 0) {
                    const { error: insError } = await supabase.from('lab_timetables').insert(newPayloads);
                    if (insError) throw insError;
                }
                alert('저장되었습니다.');
            } catch (err) {
                console.error(err);
                alert('저장 중 오류가 발생했습니다: ' + err.message);
            }
        }

        async function handleExcelUpload(file) {
            if (!App.TimetableImporter) {
                alert('가져오기 모듈이 로드되지 않았습니다.');
                return;
            }
            try {
                const btnIcon = btnImport.querySelector('span');
                const origIcon = btnIcon.textContent;
                btnIcon.textContent = 'hourglass_empty';
                const { map, report } = await App.TimetableImporter.processFile(file, currentSemesterId, allTeachers, subjects);
                btnIcon.textContent = origIcon;
                let msg = `[분석 결과]\n\n✅ 매칭 성공 교사: ${report.foundTeachers.length}명\n`;
                if (report.foundTeachers.length > 0) msg += `(${report.foundTeachers.join(', ')})\n`;
                if (report.foundTeachers.length === 0) {
                    alert('등록된 교사 이름과 일치하는 데이터가 파일에 없습니다.\n파일의 교사 이름이 시스템에 등록되어 있는지 확인해주세요.');
                    return;
                }
                msg += `\n❌ 매칭 실패(건너뜀): ${allTeachers.length - report.foundTeachers.length}명\n`;
                msg += `\n📊 유효 수업 셀: ${report.totalCells}개\n⚠️ 건너뛴 셀: ${report.skippedCells}개\n`;
                if (report.unknownSubjects && report.unknownSubjects.length > 0) {
                    msg += `\n❓ 매칭되지 않은 과목(자동 건너뜀): \n${report.unknownSubjects.join(', ')}\n(설정에서 해당 과목명(또는 유사어)을 확인하세요)\n`;
                }
                msg += `\n위 내용으로 시간표를 덮어쓰시겠습니까?\n(매칭된 교사의 기존 시간표는 삭제되고 새로 입력됩니다)`;
                if (!confirm(msg)) return;
                const teacherIds = Object.keys(map);
                for (const tid of teacherIds) {
                    const records = map[tid];
                    const payloads = records.map(r => ({
                        semester_id: Number(currentSemesterId),
                        teacher_id: Number(tid),
                        day_of_week: r.day,
                        period: Number(r.period),
                        grade: Number(r.grade),
                        class_number: Number(r.class_group),
                        subject_id: Number(r.subject_id),
                        valid_from: currentSemester?.start_date || new Date().toISOString().split('T')[0],
                        valid_to: currentSemester?.end_date || '2099-12-31'
                    }));
                    await supabase.from('lab_timetables').delete().eq('semester_id', currentSemesterId).eq('teacher_id', tid);
                    if (payloads.length > 0) await supabase.from('lab_timetables').insert(payloads);
                }
                alert('업로드 및 저장이 완료되었습니다.');
                if (currentTeacherId && map[currentTeacherId]) await loadTeacherSchedule();
            } catch (e) {
                console.error(e);
                alert('파일 처리 중 오류가 발생했습니다: ' + e.message);
                if (btnImport) btnImport.querySelector('span').textContent = 'upload_file';
            }
        }

        function getLabel(rid) {
            const r = ROWS.find(x => x.id == rid);
            return r ? r.label : rid;
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.LabTimetable = LabTimetable;
})();
