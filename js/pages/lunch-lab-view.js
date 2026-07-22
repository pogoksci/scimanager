// /js/pages/lunch-lab-view.js
(function () {
    const LunchLabView = {};

    // State
    let selectedDate = new Date();
    let weekDates = [];
    let currentRoomId = ""; // "" means ALL rooms
    let allRooms = [];
    let roomMap = {};

    const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

    LunchLabView.init = async function () {
        console.log("🍱 Lunch Lab View Init (Calendar Mode)");

        // 1. Reset State
        selectedDate = new Date();
        weekDates = []; // reset

        // 2. Bind Elements & Setup UI FIRST (Always render UI)
        try {
            const monthSel = document.getElementById('lunch-month-select');

            // Listeners
            if (monthSel) monthSel.onchange = (e) => {
                const m = parseInt(e.target.value);
                const y = selectedDate.getFullYear();
                selectedDate = new Date(y, m - 1, 1);
                updateWeekLabel();
                refresh();
            };

            const btnPrev = document.getElementById('btn-prev-week');
            if (btnPrev) btnPrev.onclick = () => { selectedDate.setDate(selectedDate.getDate() - 7); updateWeekLabel(); refresh(); };

            const btnNext = document.getElementById('btn-next-week');
            if (btnNext) btnNext.onclick = () => { selectedDate.setDate(selectedDate.getDate() + 7); updateWeekLabel(); refresh(); };

            const btnToday = document.getElementById('btn-today');
            if (btnToday) btnToday.onclick = () => { selectedDate = new Date(); updateWeekLabel(); refresh(); };

            // Initial UI Logic
            initMonthSelect();
            updateWeekLabel(); // Determines weekDates

            // Render Empty Grid first (so headers appear)
            // We'll call refresh() which does header rendering, but safely
            await refresh();

        } catch (e) {
            console.error("UI Setup failed:", e);
        }

        // 3. Load Dependencies (Supabase) & Data
        const supabase = globalThis.App?.supabase;
        if (!supabase) {
            console.warn("Supabase not found. UI initialized without data.");
            return;
        }

        // 4. Load Data (Parallel)
        try {
            // refresh() was called above, but maybe called again with data? 
            // actually refresh() usually fetches data. 
            // Let's just load rooms here. refresh() inside will check supabase.
            await loadRooms();
            // Re-fetch with rooms populated
            await refresh();
        } catch (err) {
            console.error("Data load failed:", err);
        }
    };

    async function loadRooms() {
        const supabase = globalThis.App?.supabase;
        const { data } = await supabase.from('lab_rooms').select('*').order('sort_order');
        allRooms = data || [];
        roomMap = {};
        allRooms.forEach(r => roomMap[r.id] = r.room_name);

        const sel = document.getElementById('lunch-room-select');
        if (sel) {
            sel.innerHTML = '<option value="">전체 과학실</option>' +
                allRooms.map(r => `<option value="${r.id}">${r.room_name}</option>`).join('');
        }
    }

    function initMonthSelect() {
        const sel = document.getElementById('lunch-month-select');
        if (!sel) return;
        const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        // Sort for school year? 3,4...1,2. But simple 1-12 is fine for now or match user pref.
        // Let's stick to 1-12 or similar to lab-usage-log if requested. Lab usage log does 3..2.
        // For simplicity here, let's do 1..12 unless user specified school year order.
        // Let's follow lab-usage-log style: 3..12, 1, 2
        const schoolMonths = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
        sel.innerHTML = schoolMonths.map(m => `<option value="${m}">${m}월</option>`).join('');
        sel.value = selectedDate.getMonth() + 1;
    }

    function updateWeekLabel() {
        const label = document.getElementById('current-week-label');
        const day = selectedDate.getDay();
        const diffToMon = (day === 0 ? -6 : 1 - day);
        const mon = new Date(selectedDate);
        mon.setDate(selectedDate.getDate() + diffToMon);

        weekDates = [];
        // User requested Mon-Fri only
        for (let i = 0; i < 5; i++) {
            const d = new Date(mon);
            d.setDate(mon.getDate() + i);
            weekDates.push(d);
        }

        if (label) {
            const fmt = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
            // Show Mon ~ Fri
            label.textContent = `${fmt(weekDates[0])} ~ ${fmt(weekDates[4])}`;
        }
    }

    async function refresh() {
        const supabase = globalThis.App?.supabase;

        // Safety Check
        if (!weekDates || weekDates.length === 0) {
            console.warn("Refresh called but weekDates is empty. Skipping.");
            return;
        }

        // Render Header Dates
        const headRow = document.getElementById('usage-grid-header');
        if (headRow) {
            headRow.innerHTML = '<th class="lunch-header-cell">과학실</th>';
            weekDates.forEach(d => {
                const day = d.getDay();

                const isToday = d.toDateString() === new Date().toDateString();
                const th = document.createElement('th');
                if (isToday) th.classList.add('is-today');
                th.innerHTML = `<span class="date-num">${d.getDate()}</span><span class="day-text">${DAY_LABELS[day]}요일</span>`;
                headRow.appendChild(th);
            });
        }

        // Fetch Data
        const start = weekDates[0].toISOString().split('T')[0];
        const end = weekDates[weekDates.length - 1].toISOString().split('T')[0];

        let query = supabase.from('lab_usage_log')
            .select('*')
            .eq('period', '99') // Lunch
            .gte('usage_date', start)
            .lte('usage_date', end);

        // Remove Room Filter Logic (Show all rooms)

        const { data, error } = await query;
        if (error) {
            console.error(error);
            // Even on error, render empty body to show grid structure
            renderBody([]);
            return;
        }

        renderBody(data || []);
    }

    function renderBody(logs) {
        const body = document.getElementById('usage-grid-body');
        if (!body) return;
        body.innerHTML = '';
        const isTeacher = globalThis.App?.Auth?.isTeacher();
        const userId = globalThis.App?.Auth?.user?.id;

        // Iterate over ALL ROOMS to create rows
        allRooms.forEach(room => {
            const tr = document.createElement('tr');

            // Room Name Column
            const tdRoom = document.createElement('td');
            tdRoom.className = 'period-col'; // Reuse style for simplicity
            tdRoom.textContent = room.room_name;
            tr.appendChild(tdRoom);

            weekDates.forEach(date => {
                const dateStr = date.toISOString().split('T')[0];
                const td = document.createElement('td');

                // Filter logs for this Room AND this Date
                const cellLogs = logs.filter(l => l.usage_date === dateStr && l.lab_room_id === room.id);

                const container = document.createElement('div');
                container.className = 'activity-container';

                cellLogs.forEach(log => {
                    const item = document.createElement('div');

                    // Status mapping
                    const remarks = log.remarks || '신청중';
                    let statusClass = 'status-pending';
                    if (remarks.startsWith('승인')) statusClass = 'status-approved';
                    if (remarks.startsWith('거절')) statusClass = 'status-rejected';

                    item.className = `activity-item ${statusClass}`;

                    // Buttons (Only for Teachers when Pending or Hold)
                    let buttonsHtml = '';
                    if (isTeacher && (remarks === '신청중' || remarks.startsWith('보류'))) {
                        buttonsHtml = `
                            <div class="teacher-actions lunch-teacher-actions">
                                <button class="btn-xs btn-approve" data-id="${log.id}">승인</button>
                                <button class="btn-xs btn-hold" data-id="${log.id}">보류</button>
                                <button class="btn-xs btn-reject" data-id="${log.id}">거절</button>
                            </div>
                        `;
                    }

                    item.innerHTML = `
                        <div class="act-content" title="${log.content || ''}" style="margin-top:0;">
                             ${log.content || (log.activity_type + ' 활동')}
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:4px; align-items:center;">
                            <span class="badge-status lunch-status-badge-base ${remarks.startsWith('승인') ? 'lunch-status-approved' :
                            (remarks.startsWith('거절') ? 'lunch-status-rejected' : 'lunch-status-pending')
                        }">${remarks}</span>
                        </div>
                        ${buttonsHtml}
                    `;

                    // Click logic: Alert detail unless button clicked
                    item.onclick = (e) => {
                        if (e.target.tagName === 'BUTTON') return; // Let buttons handle specific actions
                        alertDetail(log);
                    };

                    container.appendChild(item);
                });

                td.appendChild(container);
                tr.appendChild(td);
            });

            body.appendChild(tr);
        });

        // Bind Button Events (Delegation or Direct)
        // Since we re-render often, let's just bind to body delegation if performance was an issue, but here direct is fine.
        // Actually, innerHTML wipes, so need to bind again.
        bindActionButtons();

        // Reuse existing 'isTeacher' from top of scope
        if (!isTeacher) {
            document.querySelectorAll('.act-content').forEach(el => {
                el.textContent = maskPersonalInformation(el.textContent);
            });
            document.querySelectorAll('.act-content').forEach(el => {
                el.title = maskPersonalInformation(el.title);
            });
        }
    }

    // Privacy Masking Helper
    function maskPersonalInformation(text) {
        if (!text) return '';
        let safeText = text;
        // 1. Remove Phone Number
        safeText = safeText.replace(/\s*\(?010-\d{3,4}-\d{4}\)?/g, '');
        // 2. Mask ID & Name
        safeText = safeText.replace(/신청자:\s*(\d{3})(\d{2})\s+([가-힣])([가-힣]*)/g, (match, idPre, idSuf, lastName, firstName) => {
            const maskedName = lastName + '○'.repeat(firstName.length || 1);
            return `신청자: ${idPre}○○ ${maskedName}`;
        });
        return safeText;
    }

    function bindActionButtons() {
        document.querySelectorAll('.btn-approve').forEach(btn => {
            btn.onclick = () => handleStatusChange(btn.dataset.id, 'approve');
        });
        document.querySelectorAll('.btn-hold').forEach(btn => {
            btn.onclick = () => handleStatusChange(btn.dataset.id, 'hold');
        });
        document.querySelectorAll('.btn-reject').forEach(btn => {
            btn.onclick = () => handleStatusChange(btn.dataset.id, 'reject');
        });
    }

    async function handleStatusChange(logId, action) {
        const supabase = globalThis.App?.supabase;
        let newStatus = '';

        if (action === 'approve') {
            const name = prompt("담당 교사(승인자) 이름을 입력해주세요:");
            if (!name) return; // Cancel or empty
            newStatus = `승인:${name}`;
        } else if (action === 'hold') {
            const reason = prompt("보류 사유를 입력해주세요:");
            if (!reason) return;
            newStatus = `보류:${reason}`;
        } else if (action === 'reject') {
            const reason = prompt("거절 사유를 입력해주세요:");
            if (!reason) return;
            newStatus = `거절:${reason}`;
        }

        if (!newStatus) return;

        // Optimistic Update? No, ensure DB consistency
        try {
            const { error } = await supabase
                .from('lab_usage_log')
                .update({ remarks: newStatus })
                .eq('id', logId);

            if (error) throw error;

            // Refresh
            await refresh();

        } catch (err) {
            console.error(err);
            alert("상태 변경 실패: " + err.message);
        }
    }

    function getStatusColor(status) {
        if (status.startsWith('승인')) return '#4caf50'; // Green
        if (status.startsWith('거절')) return '#f44336'; // Red
        return '#ff9800'; // Orange (Pending) or '보류'
    }

    function alertDetail(log) {
        const isTeacher = globalThis.App?.Auth?.isTeacher();
        const roomName = roomMap[log.lab_room_id] || '-';

        let displayContent = log.content || '';
        if (!isTeacher) {
            displayContent = maskPersonalInformation(displayContent);
        }

        alert(`[${roomName}] ${log.usage_date}\n\n상태: ${log.remarks}\n\n내용:\n${displayContent}`);
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.LunchLabView = LunchLabView;
})();
