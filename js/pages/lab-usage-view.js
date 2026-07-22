// /js/pages/lab-usage-view.js
(function () {
    const LabUsageView = {};

    let subjectMap = {};
    let teacherMap = {};
    let roomMap = {};
    let clubMap = {}; // ✅ Club Map added
    let allSubjects = [];
    let allTeachers = [];
    let allRooms = [];
    let allClubs = []; // ✅ Club List added
    let lastSearchResult = [];

    // Pagination State
    let currentPage = 1;
    let pageSize = 30; // Default
    let isDescSort = true; // Default: Descending (Latest first)

    function sortData(list) {
        if (!list) return;
        list.sort((a, b) => {
            // Sort by Date -> Period -> Room Name
            if (a.usage_date !== b.usage_date) {
                return isDescSort
                    ? b.usage_date.localeCompare(a.usage_date)
                    : a.usage_date.localeCompare(b.usage_date);
            }
            if (a.period !== b.period) {
                // Period can be string '1', '2' or '99', '88'
                return isDescSort
                    ? String(b.period).localeCompare(String(a.period))
                    : String(a.period).localeCompare(String(b.period));
            }
            // Room Name Map check
            const roomA = roomMap[a.lab_room_id] || '';
            const roomB = roomMap[b.lab_room_id] || '';
            return isDescSort
                ? roomB.localeCompare(roomA)
                : roomA.localeCompare(roomB);
        });
    }

    LabUsageView.init = async function () {
        console.log("🔍 Lab Usage View Init");
        const supabase = globalThis.App?.supabase;
        if (!supabase) return;

        // 1. Default Dates: School Year (Mar 1st ~ Feb End)
        try {
            const now = new Date();
            let schoolYear = now.getFullYear();
            if (now.getMonth() < 2) schoolYear--; // If Jan or Feb, school year is previous year

            const firstDay = new Date(schoolYear, 2, 1); // March 1st
            const lastDay = new Date(schoolYear + 1, 2, 0); // Last day of Feb (handles leap years)

            const startEl = document.getElementById('filter-start-date');
            const endEl = document.getElementById('filter-end-date');
            if (startEl) startEl.value = formatDate(firstDay);
            if (endEl) endEl.value = formatDate(lastDay);
        } catch (e) {
            console.error("❌ Failed to set default dates:", e);
        }

        // 2. Initial Data Loading (Dropdowns, etc)
        await loadInitialData();
        setupFilters();

        // 3. Initial Search (Auto-run)
        await search();

        // 4. Bind Export & Print
        const btnExport = document.getElementById('btn-export-excel');
        if (btnExport) btnExport.onclick = exportToExcel;

        const btnPrint = document.getElementById('btn-print-report');
        if (btnPrint) btnPrint.onclick = printReport;
    };

    async function loadInitialData() {
        const supabase = globalThis.App?.supabase;

        const [rooms, subjects, teachers, clubs] = await Promise.all([
            supabase.from('lab_rooms').select('*').order('sort_order'),
            supabase.from('lab_subjects').select('*').order('name'),
            supabase.from('lab_teachers').select('*').order('name'),
            supabase.from('lab_clubs').select('*').order('name') // ✅ Fetch Clubs
        ]);

        allRooms = rooms.data || [];
        allSubjects = subjects.data || [];
        allTeachers = teachers.data || [];
        allClubs = clubs.data || [];

        allRooms.forEach(r => roomMap[r.id] = r.room_name);
        allSubjects.forEach(s => subjectMap[s.id] = s.name);
        allTeachers.forEach(t => teacherMap[t.id] = t.name);
        allClubs.forEach(c => clubMap[c.id] = c.name); // ✅ Populate Club Map

        // Update Dropdowns
        const selRoom = document.getElementById('filter-room');
        const selSubj = document.getElementById('filter-subject');
        const selTech = document.getElementById('filter-teacher');

        if (selRoom) {
            selRoom.innerHTML = '<option value="">전체</option>' +
                allRooms.map(r => `<option value="${r.id}">${r.room_name}</option>`).join('');
        }
        if (selSubj) {
            const uniqueSub = [];
            const seenSub = new Set();
            allSubjects.forEach(s => {
                if (!seenSub.has(s.name)) {
                    seenSub.add(s.name);
                    uniqueSub.push(s);
                }
            });
            selSubj.innerHTML = '<option value="">전체</option>' +
                uniqueSub.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
        if (selTech) {
            const uniqueTech = [];
            const seenTech = new Set();
            allTeachers.forEach(t => {
                if (!seenTech.has(t.name)) {
                    seenTech.add(t.name);
                    uniqueTech.push(t);
                }
            });
            selTech.innerHTML = '<option value="">전체</option>' +
                uniqueTech.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }
    }

    function setupFilters() {
        const btnSearch = document.getElementById('btn-apply-filters');
        if (btnSearch) {
            btnSearch.onclick = async () => {
                btnSearch.disabled = true;
                btnSearch.textContent = "조회 중...";
                await search();
                btnSearch.disabled = false;
                btnSearch.textContent = "조회하기";
            };
        }

        const selPageSize = document.getElementById('filter-page-size');
        if (selPageSize) {
            selPageSize.value = "30";
            selPageSize.onchange = () => {
                pageSize = selPageSize.value === 'all' ? 999999 : parseInt(selPageSize.value);
                currentPage = 1;
                renderTable(lastSearchResult);
            };
        }

        const btnSort = document.getElementById('btn-toggle-sort');
        if (btnSort) {
            btnSort.onclick = () => {
                isDescSort = !isDescSort;
                const icon = btnSort.querySelector('.material-symbols-outlined');
                if (icon) icon.textContent = isDescSort ? 'sort' : 'sort_by_alpha';

                sortData(lastSearchResult);
                currentPage = 1;
                renderTable(lastSearchResult);
            };
        }

        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');
        if (btnPrev) btnPrev.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable(lastSearchResult);
            }
        };
        if (btnNext) btnNext.onclick = () => {
            const maxPage = Math.ceil(lastSearchResult.length / pageSize);
            if (currentPage < maxPage) {
                currentPage++;
                renderTable(lastSearchResult);
            }
        };
    }

    async function search() {
        const supabase = globalThis.App?.supabase;
        const startDate = document.getElementById('filter-start-date').value;
        const endDate = document.getElementById('filter-end-date').value;
        const roomId = document.getElementById('filter-room').value;
        const grade = document.getElementById('filter-grade').value;
        const subjectId = document.getElementById('filter-subject').value;
        const teacherId = document.getElementById('filter-teacher').value;

        // ✅ Add club_id to select
        // Explicitly select columns to avoid errors
        let query = supabase.from('lab_usage_log')
            .select('id, lab_room_id, usage_date, period, grade, class_number, subject_id, teacher_id, activity_type, content, safety_education, remarks, semester_id, club_id');

        console.log("Values for search:", { startDate, endDate, roomId, grade, subjectId, teacherId });

        if (startDate) query = query.gte('usage_date', startDate);
        if (endDate) query = query.lte('usage_date', endDate);
        if (roomId) query = query.eq('lab_room_id', roomId);
        if (grade) query = query.eq('grade', grade);
        if (subjectId) query = query.eq('subject_id', subjectId);
        if (teacherId) query = query.eq('teacher_id', teacherId);

        const { data, error } = await query.order('usage_date', { ascending: false }).order('period', { ascending: true });

        if (error) {
            console.error("❌ Search failed:", error);
            return;
        }

        // Post-filter: Only show '승인' or empty (legacy)
        const rawData = data || [];
        const filteredData = rawData.filter(item => !item.remarks || item.remarks === '승인');

        lastSearchResult = filteredData;

        // Initial Sort
        sortData(lastSearchResult);

        currentPage = 1; // Reset to first page on search
        renderTable(lastSearchResult);
    }

    function renderTable(data) {
        const body = document.getElementById('usage-view-body');
        const empty = document.getElementById('usage-view-empty');
        const countTxt = document.getElementById('result-count');
        const pageInfo = document.getElementById('page-info');

        if (!body) return;
        body.innerHTML = '';
        countTxt.textContent = `조회 결과: ${data ? data.length : 0}건`;

        if (!data || data.length === 0) {
            empty.style.display = 'flex';
            if (pageInfo) pageInfo.textContent = "0 / 0";
            return;
        }
        empty.style.display = 'none';

        // Pagination Logic
        const total = data.length;
        const maxPage = Math.ceil(total / pageSize);
        if (currentPage > maxPage && maxPage > 0) currentPage = maxPage;

        if (pageInfo) pageInfo.textContent = `${currentPage} / ${maxPage || 1}`;

        const startIdx = (currentPage - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const pagedData = data.slice(startIdx, endIdx);

        const role = globalThis.App?.Auth?.user?.role;
        const canEdit = ['admin', 'teacher'].includes(role);

        pagedData.forEach(item => {
            const tr = document.createElement('tr');

            const periodLabel = item.period === '99' ? '점심' : (item.period === '88' ? '방과후' : `${item.period}교시`);
            
            const isOtherSubject = item.activity_type === '기타' || (item.subject_id && subjectMap[item.subject_id] === '기타');
            const displaySafety = isOtherSubject ? '-' : (item.safety_education || '미실시');
            const safetyClass = displaySafety === '실시' ? 'complete' : (displaySafety === '-' ? '' : 'pending');
            const badgeStyle = displaySafety === '-' ? 'background-color: #f5f5f5; color: #666;' : '';

            // ✅ Logic to display Club Name or Content
            let displayContent = item.content || '';
            if (item.activity_type === '동아리' && item.club_id) {
                displayContent = clubMap[item.club_id] || displayContent;
            }

            tr.innerHTML = `
                <td class="usage-view-cell-date">${item.usage_date}</td>
                <td>${periodLabel}</td>
                <td class="usage-view-cell-room">${roomMap[item.lab_room_id] || '-'}</td>
                <td>${item.grade ? `${item.grade}학년-${item.class_number}반` : '-'}</td>
                <td>${subjectMap[item.subject_id] || item.activity_type}</td>
                <td>${teacherMap[item.teacher_id] || '-'}</td>
                <td class="cell-content" 
                    contenteditable="${canEdit}" 
                    style="${canEdit ? 'outline: 1px dashed transparent;' : ''}"
                    title="${canEdit ? '클릭하여 내용 수정 (입력 후 포커스를 옮기면 저장됩니다)' : ''}">${displayContent}</td>
                <td class="usage-view-cell-center">
                    <span class="badge-safety ${safetyClass}" 
                          style="${badgeStyle} ${canEdit && !isOtherSubject ? 'cursor:pointer;' : ''}"
                          title="${canEdit && !isOtherSubject ? '클릭하여 상태 변경' : ''}">${displaySafety}</span>
                </td>
            `;

            if (canEdit) {
                const badge = tr.querySelector('.badge-safety');
                badge.onclick = () => toggleSafetyStatus(item, badge);

                const contentCell = tr.querySelector('.cell-content');
                contentCell.onfocus = () => contentCell.style.outlineColor = '#00A0B2';
                contentCell.onblur = async () => {
                    contentCell.style.outlineColor = 'transparent';
                    const newText = contentCell.textContent.trim();
                    if (newText !== (item.content || '')) {
                        await updateContent(item, newText, contentCell);
                    }
                };
                contentCell.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        contentCell.blur();
                    }
                };
            }

            body.appendChild(tr);
        });
    }

    async function toggleSafetyStatus(item, badgeEl) {
        // If the activity_type or subject is '기타', it is always '-' and clicking shouldn't change it
        if (item.activity_type === '기타' || (item.subject_id && subjectMap[item.subject_id] === '기타')) {
            return;
        }

        const supabase = globalThis.App?.supabase;
        if (!supabase) return;

        const newStatus = item.safety_education === '실시' ? '미실시' : '실시';

        // Optimistic UI update
        badgeEl.textContent = "Updating...";
        badgeEl.style.opacity = '0.5';

        try {
            const { error } = await supabase
                .from('lab_usage_log')
                .update({ safety_education: newStatus })
                .eq('id', item.id);

            if (error) throw error;

            // Success
            item.safety_education = newStatus;
            const newClass = newStatus === '실시' ? 'complete' : 'pending';
            badgeEl.className = `badge-safety ${newClass}`;
            badgeEl.textContent = newStatus;
        } catch (err) {
            console.error("❌ Failed to update safety status:", err);
            alert("상태 변경에 실패했습니다: " + err.message);
            // Revert UI
            const oldClass = item.safety_education === '실시' ? 'complete' : 'pending';
            badgeEl.className = `badge-safety ${oldClass}`;
            badgeEl.textContent = item.safety_education;
        } finally {
            badgeEl.style.opacity = '1';
        }
    }

    async function updateContent(item, newText, cellEl) {
        const supabase = globalThis.App?.supabase;
        if (!supabase) return;

        cellEl.style.opacity = '0.5';

        try {
            const { error } = await supabase
                .from('lab_usage_log')
                .update({ content: newText })
                .eq('id', item.id);

            if (error) throw error;

            item.content = newText;
            console.log("✅ Content updated successfully");
        } catch (err) {
            console.error("❌ Failed to update content:", err);
            alert("내용 저장에 실패했습니다: " + err.message);
            cellEl.textContent = item.content || '';
        } finally {
            cellEl.style.opacity = '1';
        }
    }

    async function exportToExcel() {
        if (!lastSearchResult || lastSearchResult.length === 0) {
            alert("내보낼 데이터가 없습니다. 먼저 조회를 해주세요.");
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert("엑셀 내보내기 라이브러리가 로드되지 않았습니다.");
            return;
        }

        // 1. Format Data for Excel
        const excelData = lastSearchResult.map(item => {
            const periodLabel = item.period === '99' ? '점심' : (item.period === '88' ? '방과후' : `${item.period}교시`);
            const isOtherSubject = item.activity_type === '기타' || (item.subject_id && subjectMap[item.subject_id] === '기타');
            const displaySafety = isOtherSubject ? '-' : (item.safety_education || '미실시');
            return {
                "날짜": item.usage_date,
                "교시": periodLabel,
                "과학실": roomMap[item.lab_room_id] || '-',
                "학년": item.grade ? `${item.grade}학년` : '-',
                "반": item.class_number ? `${item.class_number}반` : '-',
                "과목": subjectMap[item.subject_id] || item.activity_type,
                "담당교사": teacherMap[item.teacher_id] || '-',
                "활동내용": item.content || '',
                "안전교육": displaySafety
            };
        });

        // 2. Create Sheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // 3. Set Column Widths
        const wscols = [
            { wch: 12 }, // 날짜
            { wch: 8 },  // 교시
            { wch: 15 }, // 과학실
            { wch: 8 },  // 학년
            { wch: 8 },  // 반
            { wch: 18 }, // 과목
            { wch: 12 }, // 담당교사
            { wch: 40 }, // 활동내용
            { wch: 10 }  // 안전교육
        ];
        worksheet['!cols'] = wscols;

        // 4. Create Workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "사용기록");

        // 5. Save File
        const dateStr = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `과학실_사용기록_${dateStr}.xlsx`);
    }

    function printReport() {
        if (!lastSearchResult || lastSearchResult.length === 0) {
            alert("인쇄할 데이터가 없습니다.");
            return;
        }

        // 1. Determine Title
        const roomId = document.getElementById('filter-room').value;
        let title = "과학실 사용기록";
        if (roomId && roomMap[roomId]) {
            title = `${roomMap[roomId]} 사용기록`;
        }
        const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

        // 2. Build HTML Content
        const rows = lastSearchResult.map((item, index) => {
            const periodLabel = item.period === '99' ? '점심' : (item.period === '88' ? '방과후' : `${item.period}교시`);

            // ✅ Display Content Logic (Same as renderTable)
            let displayContent = item.content || '';
            if (item.activity_type === '동아리' && item.club_id) {
                displayContent = clubMap[item.club_id] || displayContent;
            }

            const isOtherSubject = item.activity_type === '기타' || (item.subject_id && subjectMap[item.subject_id] === '기타');
            const displaySafety = isOtherSubject ? '-' : (item.safety_education || '미실시');

            return `
                <tr>
                    <td class="center">${index + 1}</td>
                    <td class="center">${item.usage_date}</td>
                    <td class="center">${periodLabel}</td>
                    <td class="center">${roomMap[item.lab_room_id] || '-'}</td>
                    <td class="center">${item.grade ? `${item.grade}-${item.class_number}` : '-'}</td>
                    <td class="center">${subjectMap[item.subject_id] || item.activity_type}</td>
                    <td class="left">${displayContent}</td>
                    <td class="center">${displaySafety}</td>
                </tr>
            `;
        }).join('');

        const printWindow = window.open('', '_blank', 'width=1000,height=800');
        if (!printWindow) {
            alert("팝업 차단을 해제해주세요.");
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <link rel="stylesheet" href="/css/styles.css">
                <style>
                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    body { font-family: "Malgun Gothic", sans-serif; padding: 20px; }
                    h1 { text-align: center; margin-bottom: 10px; font-size: 24px; }
                    .meta { text-align: right; margin-bottom: 20px; font-size: 14px; color: #555; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                    th, td { border: 1px solid #000; padding: 8px; vertical-align: middle; }
                    th { background-color: #f2f2f2; text-align: center; font-weight: bold; white-space: nowrap; }
                    th:nth-child(7) { white-space: normal; }
                    .center { text-align: center; white-space: nowrap; }
                    .left { text-align: left; }
                    @media print {
                        body { padding: 0; }
                        th { background-color: #eee !important; -webkit-print-color-adjust: exact; }
                        body * { visibility: visible !important; }
                    }
                </style>
            </head>
            <body class="usage-print-body">
                <h1 class="usage-print-title">${title}</h1>
                <div class="meta usage-print-meta">출력일자: ${today}</div>
                <table class="usage-print-table">
                    <colgroup>
                        <col style="width: 40px;">
                        <col style="width: 100px;">
                        <col style="width: 60px;">
                        <col style="width: 110px;">
                        <col style="width: 60px;">
                        <col style="width: 90px;">
                        <col style="width: auto;">
                        <col style="width: 60px;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>날짜</th>
                            <th>교시</th>
                            <th>장소</th>
                            <th>학급</th>
                            <th>과목</th>
                            <th>활동 내용</th>
                            <th>안전교육</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                        window.close();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Expose to App
    globalThis.App = globalThis.App || {};
    globalThis.App.LabUsageView = LabUsageView;
})();
