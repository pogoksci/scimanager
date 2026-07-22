// /js/pages/lunch-lab-reserve.js
(function () {
    const LunchLabReserve = {};

    let allRooms = [];
    let allClubs = []; // Raw list of all clubs
    let allSemesters = []; // New: Store semesters
    let allTeachers = [];

    // State
    const PERIOD_LUNCH = '99'; // 점심시간 (API/DB 약속)
    const STATUS_PENDING = '신청중';

    LunchLabReserve.init = async function () {
        console.log("🍱 Lunch Lab Reserve Init");

        // 1. Load Initial Data
        await loadData();

        // 2. Set Default Date
        const dateInput = document.getElementById('lunch-date');
        const isTeacher = globalThis.App?.Auth?.isTeacher();

        if (dateInput) {
            const today = new Date();
            let targetDate = new Date(today);

            // Logic Change:
            // Teacher: No restriction (Default Today)
            // Student: +3 Days (Default Today+3)

            const daysToAdd = isTeacher ? 0 : 3;
            targetDate.setDate(today.getDate() + daysToAdd);

            // Weekend Check for Default Value (UX only)
            if (targetDate.getDay() === 0) { // Sunday
                targetDate.setDate(targetDate.getDate() + 1); // Mon
            } else if (targetDate.getDay() === 6) { // Saturday
                targetDate.setDate(targetDate.getDate() + 2); // Mon
            }

            const minStr = targetDate.toISOString().split('T')[0];
            dateInput.value = minStr;

            // Only set min for Students
            if (!isTeacher) {
                dateInput.min = minStr;
            } else {
                dateInput.removeAttribute('min');
            }
        }

        // 3. Bind Events
        bindEvents();
    };

    async function loadData() {
        const supabase = globalThis.App?.supabase;
        if (!supabase) return;

        try {
            const [rooms, clubs, teachers, semesters] = await Promise.all([
                supabase.from('lab_rooms').select('*').order('sort_order'),
                supabase.from('lab_clubs').select('*').order('name'),
                supabase.from('lab_teachers').select('*').order('name'),
                supabase.from('lab_semesters').select('*').order('start_date', { ascending: false }) // Fetch Semesters
            ]);

            allRooms = rooms.data || [];
            allClubs = clubs.data || [];
            allTeachers = teachers.data || [];
            allSemesters = semesters.data || []; // Store semesters

            // Populate Selects
            const roomSel = document.getElementById('lunch-room');

            if (roomSel) {
                roomSel.innerHTML = '<option value="">과학실을 선택하세요</option>' +
                    allRooms.map(r => `<option value="${r.id}">${r.room_name}</option>`).join('');
            }
        } catch (err) {
            console.error("❌ Failed to load initial data:", err);
            alert("데이터를 불러오는 중 오류가 발생했습니다.");
        }
    }

    // Helper: Get Semester ID for a given date string (YYYY-MM-DD)
    function getSemesterIdForDate(dateStr) {
        if (!dateStr || !allSemesters.length) return null;

        // Simple string comparison for dates works if format is YYYY-MM-DD
        const target = dateStr;

        // Find the matching semester
        const match = allSemesters.find(sem => {
            const start = sem.start_date;
            const end = sem.end_date;
            // Logical check: start <= target <= end
            // Note: If end_date is null, assume it goes to future (or handle as 'current')? 
            // Usually DB sets strict ranges. If end is null, maybe it is 'ongoing'.

            if (start && end) {
                return target >= start && target <= end;
            } else if (start && !end) {
                return target >= start;
            }
            return false;
        });

        return match ? match.id : null;
    }

    function bindEvents() {
        const typeSel = document.getElementById('lunch-activity-type');
        const dateInput = document.getElementById('lunch-date'); // Create ref
        const container = document.getElementById('dynamic-fields-container');
        const submitBtn = document.getElementById('btn-submit-reservation');

        // RBAC Check
        const isTeacher = globalThis.App?.Auth?.isTeacher();

        // Hide Student Fields if Teacher
        if (isTeacher) {
            const studentFields = ['applicant-number', 'applicant-name', 'applicant-phone'];
            studentFields.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.closest('.form-group').style.display = 'none';
            });
            // Show only Responsible Teacher logic (We reuse 'lunch-teacher-name' input)
            // Rename label for clarity? 
            const teacherLabel = document.querySelector('label[for="lunch-teacher-name"]');
            if (teacherLabel) teacherLabel.textContent = "나의 이름 (담당교사)";

            // Auto-fill? Not needed, just input

            // Update Header Text for Teacher
            const headerDesc = document.querySelector('.header-desc');
            if (headerDesc) {
                headerDesc.textContent = "점심시간 과학실 사용을 예약합니다.";
            }
        }

        // Helper to render club select
        const renderClubSelect = () => {
            if (!container) return;

            const dateVal = dateInput ? dateInput.value : null;
            const semesterId = getSemesterIdForDate(dateVal);

            let filteredClubs = [];
            if (semesterId) {
                filteredClubs = allClubs.filter(c => c.semester_id === semesterId);
            } else {
                // Determine fallback behavior if no semester matches (e.g. date is too far future or past)
                // Option A: Show nothing? 
                // Option B: Show all? (Causes duplicates)
                // Decision: Show empty with warning or just empty. 
                // Let's try to find 'current' semester if date is not in range? 
                // No, strict by date is better to avoid "Registering for next year but seeing this year's clubs".
                filteredClubs = [];
            }

            // Generate HTML
            let optionsHtml = '<option value="">동아리를 선택하세요</option>';
            if (filteredClubs.length > 0) {
                optionsHtml += filteredClubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            } else {
                if (!dateVal) {
                    optionsHtml = '<option value="">날짜를 먼저 선택해주세요</option>';
                } else if (!semesterId) {
                    optionsHtml = '<option value="">해당 날짜의 학기 정보를 찾을 수 없습니다</option>';
                } else {
                    optionsHtml = '<option value="">해당 학기에 등록된 동아리가 없습니다</option>';
                }
            }

            container.innerHTML = `
                <div class="form-group">
                    <label class="form-label required">동아리 선택</label>
                    <select id="lunch-club-select" class="form-select">
                        ${optionsHtml}
                    </select>
                </div>
            `;
        };

        // Date Change: Logic for Weekend Check & Club Re-render
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                const val = e.target.value;
                if (val) {
                    const d = new Date(val);
                    const day = d.getDay(); // 0=Sun, 6=Sat
                    if (day === 0 || day === 6) {
                        alert("주말(토, 일)은 예약할 수 없습니다.\n평일을 선택해주세요.");
                        e.target.value = ''; // Clear input
                        if (typeSel && typeSel.value === '동아리') {
                            // Re-render empty state
                            renderClubSelect();
                        }
                        return;
                    }
                }

                if (typeSel && typeSel.value === '동아리') {
                    renderClubSelect();
                }
            });
        }

        // Activity Type Change
        if (typeSel) {
            typeSel.onchange = (e) => {
                const type = e.target.value;
                container.innerHTML = ''; // Clear

                if (type === '동아리') {
                    renderClubSelect();
                } else if (type === '행사' || type === '기타') {
                    const label = type === '행사' ? '행사 내용 (구체적으로)' : '신청 사유';
                    container.innerHTML = `
                        <div class="form-group">
                            <label class="form-label required">${label}</label>
                            <input type="text" id="lunch-content-detail" class="form-input" placeholder="내용을 입력하세요">
                        </div>
                    `;
                }
            };
        }

        // Submit
        if (submitBtn) {
            submitBtn.onclick = submitReservation;
        }
    }

    async function submitReservation() {
        const supabase = globalThis.App?.supabase;
        const isTeacher = globalThis.App?.Auth?.isTeacher();

        // 1. Gather Inputs
        const date = document.getElementById('lunch-date').value;
        const roomId = document.getElementById('lunch-room').value;
        const type = document.getElementById('lunch-activity-type').value;
        const teacherName = document.getElementById('lunch-teacher-name').value.trim();
        const pCount = document.getElementById('participant-count').value;

        // Student Specific Inputs (may be hidden/empty for teacher)
        let appNum = document.getElementById('applicant-number').value.trim();
        let appName = document.getElementById('applicant-name').value.trim();
        let appPhone = document.getElementById('applicant-phone').value.trim();

        // 2. Validation
        // Common Required
        if (!date || !roomId || !type || !teacherName || !pCount) {
            alert("필수 항목을 입력해주세요.");
            return;
        }

        // Student Strict Validation
        if (!isTeacher) {
            if (!appNum || !appName || !appPhone) {
                alert("신청자(학생) 정보를 모두 입력해주세요.");
                return;
            }
        }

        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);

        // Weekend Check (Backend/Submit Validation)
        const dayOfWeek = selectedDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            alert("주말(토, 일)은 예약할 수 없습니다.");
            return;
        }

        // Restriction Check
        // Student: >= 3 days
        // Teacher: No restriction

        if (!isTeacher) {
            const diffTime = selectedDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 3) {
                alert("학생 예약은 최소 3일 전부터 가능합니다.\n(예: 오늘이 월요일이면 목요일부터 예약 가능)");
                return;
            }
        }

        // Dynamic Field Validation
        let contentDetail = '';
        let clubId = null;

        if (type === '동아리') {
            const clubSel = document.getElementById('lunch-club-select');
            if (!clubSel || !clubSel.value) {
                alert("동아리를 선택해주세요.");
                return;
            }
            clubId = clubSel.value;
            const clubName = allClubs.find(c => String(c.id) === String(clubId))?.name || '';
            contentDetail = `동아리: ${clubName}`;
        } else {
            const detailInput = document.getElementById('lunch-content-detail');
            if (!detailInput || !detailInput.value.trim()) {
                alert("내용을 입력해주세요.");
                return;
            }
            contentDetail = detailInput.value.trim();
        }

        // 3. Format Data
        let formattedContent = '';
        let remarks = STATUS_PENDING;

        if (isTeacher) {
            // Teacher Logic
            remarks = '승인'; // Auto-approve

            // Format Content: [교사신청: 김철수 / 인원: 5명] 내용...
            formattedContent = `[교사신청: ${teacherName} / 인원: ${pCount}명] ${contentDetail}`;

            // Set payload vars for DB columns
            appName = teacherName;
            appNum = '';
            appPhone = '';

        } else {
            // Student Logic
            // [신청자: 20101 홍길동 (010-1234-5678) / 인원: 5명 / 담당: 김교사] 내용...
            formattedContent = `[신청자: ${appNum} ${appName}`;
            if (appPhone) formattedContent += ` (${appPhone})`;
            formattedContent += ` / 인원: ${pCount}명`;
            formattedContent += ` / 담당: ${teacherName}]`;
            formattedContent += ` ${contentDetail}`;
        }

        const payload = {
            lab_room_id: roomId,
            usage_date: date,
            period: PERIOD_LUNCH,
            activity_type: type,
            content: formattedContent,
            remarks: remarks, // '신청중' or '승인'
            safety_education: '미실시',

            applicant_name: isTeacher ? `(교사) ${teacherName}` : `${appNum} ${appName}`,
            phone_number: appPhone,
            participant_count: parseInt(pCount),
            teacher_id: null
        };

        if (clubId) payload.club_id = clubId;

        // 4. Insert
        try {
            const submitBtn = document.getElementById('btn-submit-reservation');
            submitBtn.disabled = true;
            submitBtn.textContent = '신청 중...';

            // [DB 시퀀스 꼬임 방지 로직] 수동으로 가장 큰 ID를 찾아 +1 한 값을 부여
            const { data: maxIdData } = await supabase.from('lab_usage_log').select('id').order('id', { ascending: false }).limit(1);
            if (maxIdData && maxIdData.length > 0) {
                payload.id = parseInt(maxIdData[0].id) + 1;
            } else {
                payload.id = 1;
            }

            const { error } = await supabase.from('lab_usage_log').insert(payload);

            if (error) throw error;

            alert("✅ 예약 신청이 완료되었습니다.\n'런치랩 예약조회' 메뉴에서 결과를 확인하세요.");

            // Reset Form or Redirect?
            // Redirect to Inquiry page is better UX
            await App.Router.go('lunchLabInquiry');

        } catch (err) {
            console.error("Reservation failed:", err);
            alert("예약 신청에 실패했습니다: " + err.message);
            document.getElementById('btn-submit-reservation').disabled = false;
            document.getElementById('btn-submit-reservation').textContent = '예약 신청하기';
        }
    }


    globalThis.App = globalThis.App || {};
    globalThis.App.LunchLabReserve = LunchLabReserve;
})();
