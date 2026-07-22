(function () {
    let VIDEO_LIST = [];
    let MANUAL_LIST_GROUPED = [];
    let QUIZ_STATE = {
        currentStep: 0,
        score: 0,
        studentNo: "",
        userName: "",
        questions: []
    };

    const GHS_DATA = [
        { id: "01", name: "폭발성", desc: "불안정한 폭발물, 자기반응성 물질, 유기과산화물 등" },
        { id: "02", name: "인화성", desc: "인화성 가스, 액체, 고체, 에어로졸 등" },
        { id: "03", name: "산화성", desc: "산화성 가스, 액체, 고체" },
        { id: "04", name: "고압가스", desc: "압축가스, 액화가스, 냉동액화가스, 용해가스" },
        { id: "05", name: "부식성", desc: "금속부식성 물질, 피부 부식성, 심한 안구 손상" },
        { id: "06", name: "독성", desc: "급성 독성 (경구, 경피, 흡입)" },
        { id: "07", name: "감탄사", desc: "피부 자극성, 호흡기 자극성, 마취 효과" },
        { id: "08", name: "건강유해성", desc: "발암성, 생식독성, 호흡기 과민성, 흡인 위험" },
        { id: "09", name: "환경유해성", desc: "수생환경 유해성 (급성/만성)" }
    ];

    const SafetyEdu = {};

    SafetyEdu.init = async function () {
        try {
            console.log("🛡️ Safety Education Init - Logic Executing");
            const mainContent = document.getElementById('safety-edu-container');
            if (!mainContent) return;

            // 1. Force UI Transition (Hide Splash)
            document.body.classList.remove("home-active");

            // Show Loading State
            mainContent.innerHTML = '<div style="padding:40px; text-align:center;">데이터를 불러오는 중입니다...</div>';

            if (!App.supabase) throw new Error("Supabase Client is not initialized.");

            // 2. Fetch Data
            await fetchContentFromDB();

            // 3. Render Initial Structure
            renderBaseLayout(mainContent);

            // 4. Bind Events
            bindEvents(mainContent);

            // 5. Initial Tab
            switchTab('video-section');

            // 6. Role Check (Admin only can sync)
            checkAdminRole();

        } catch (err) {
            console.error("SafetyEdu Init Error:", err);
            document.getElementById('safety-edu-container').innerHTML = `<div style="padding:20px; color:red;">오류: ${err.message}</div>`;
        }
    };

    function renderBaseLayout(container) {
        const isTeacher = App.Auth && typeof App.Auth.canWrite === 'function' && App.Auth.canWrite();
        const enableSafetyStats = false; // 임시 블라인드 처리 (추후 true 변경 시 재활성화)

        container.innerHTML = `
            <div class="safety-main-container">
                <div class="safety-header-row">
                    <h1 class="safety-section-title">🧯 과학실 안전 교육</h1>
                    <button id="btn-sync-content" class="safety-sync-btn">🔄 최신 콘텐츠 동기화</button>
                </div>
                
                <div class="safety-tabs-container">
                    <button class="nav-tab active" data-target="video-section">영상 교육</button>
                    <button class="nav-tab" data-target="manual-section">매뉴얼/서식</button>
                    <button class="nav-tab" data-target="ghs-section">GHS 기호</button>
                    <button class="nav-tab" data-target="quiz-section">안전 퀴즈 & 인증</button>
                    ${(isTeacher && enableSafetyStats) ? '<button class="nav-tab" data-target="stats-section">안전 통계 분석</button>' : ''}
                </div>

                <div class="safety-content-scroll-area">
                    <div id="video-section" class="tab-content" style="display:none;">
                        <div class="safety-video-grid">${renderVideos()}</div>
                    </div>

                    <div id="manual-section" class="tab-content" style="display:none;">
                        ${renderManuals()}
                    </div>

                    <div id="ghs-section" class="tab-content" style="display:none;">
                        <div class="ghs-grid">${renderGhsGrid()}</div>
                    </div>

                    <div id="quiz-section" class="tab-content" style="display:none;">
                        <div id="quiz-root"></div>
                        <div id="certificate-area" class="certificate-preview"></div>
                    </div>

                    ${(isTeacher && enableSafetyStats) ? `
                    <div id="stats-section" class="tab-content" style="display:none;">
                        <div class="settings-section" style="padding: 10px 0;">
                            <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <h3 style="margin:0; font-size:1.4rem;">안전 퀴즈 통계 및 학술 분석</h3>
                                <div style="display: flex; gap: 8px;">
                                    <button id="btn-export-stats-csv" class="safety-sync-btn" style="display:inline-block; float:none; margin:0; padding: 8px 16px; font-size: 13px; display: flex; align-items: center; gap: 4px;">
                                        <span class="material-symbols-outlined" style="font-size:16px;">download</span> CSV 데이터 다운로드
                                    </button>
                                </div>
                            </div>

                            <!-- Filters -->
                            <div class="stats-filter-bar" style="display: flex; gap: 15px; margin: 15px 0; background: #f9f9f9; padding: 12px 15px; border-radius: 8px; border: 1px solid #eee; flex-wrap: wrap; text-align: left;">
                                <div class="form-group" style="margin: 0; min-width: 150px;">
                                    <label for="stats-semester-select" style="font-size: 13px; font-weight: 600; color: #555; display:block; margin-bottom:4px;">학년도 필터</label>
                                    <select id="stats-semester-select" style="width: 100%; height: 34px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px;">
                                        <option value="">학년도를 선택하세요</option>
                                    </select>
                                </div>
                                <div class="form-group" style="margin: 0; min-width: 150px;">
                                    <label for="stats-class-select" style="font-size: 13px; font-weight: 600; color: #555; display:block; margin-bottom:4px;">학급 필터 (반)</label>
                                    <select id="stats-class-select" style="width: 100%; height: 34px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px;">
                                        <option value="all">전체 학급</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Academic Report (t-test table) -->
                            <div class="stats-section-box" style="margin-top: 25px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #ffffff; text-align: left;">
                                <h4 style="margin: 0 0 12px 0; color: #333; font-size: 1.1rem; font-weight: 600; border-bottom: 2px solid #3498db; padding-bottom: 6px; display: inline-block;">
                                    📊 학술용 독립표본 t-검정 (사전 vs 사후)
                                </h4>
                                <p style="font-size: 12.5px; color: #666; margin: 0 0 15px 0; line-height: 1.4;">
                                    * <strong>사전 집단</strong>: 1회차 시도 성적 / <strong>사후 집단</strong>: 2회차 이상 시도한 결과 중 최종 성적.<br>
                                    * 유의확률(p-value)이 0.05 미만인 경우($p < .05$) 통계적으로 유의미한 향상이 일어났음을 뜻합니다.
                                </p>
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 13.5px; border: 1px solid #e8e8e8;">
                                        <thead>
                                            <tr style="background: #f5f6fa; border-bottom: 2px solid #ddd; font-weight: 600;">
                                                <th style="padding: 10px; border: 1px solid #e8e8e8;">구분 (집단)</th>
                                                <th style="padding: 10px; border: 1px solid #e8e8e8;">사례수 (N)</th>
                                                <th style="padding: 10px; border: 1px solid #e8e8e8;">평균 (M)</th>
                                                <th style="padding: 10px; border: 1px solid #e8e8e8;">표준편차 (SD)</th>
                                                <th style="padding: 10px; border: 1px solid #e8e8e8;">t값 (t-value)</th>
                                                <th style="padding: 10px; border: 1px solid #e8e8e8;">자유도 (df)</th>
                                                <th style="padding: 10px; border: 1px solid #e8e8e8;">유의확률 (p-value, 양측)</th>
                                            </tr>
                                        </thead>
                                        <tbody id="stats-ttest-body">
                                            <tr>
                                                <td colspan="7" style="padding: 20px; color: #999;">데이터를 불러오는 중입니다...</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Charts Grid -->
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 25px; text-align: left;">
                                <!-- Line Chart -->
                                <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #ffffff;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                        <h4 style="margin: 0; color: #333; font-size: 1.05rem; font-weight: 600;">📈 시도 회차별 평균 성취도 추이 (상황인식)</h4>
                                        <button id="btn-save-chart-line" class="safety-sync-btn" style="float:none; margin:0; padding: 4px 8px; font-size: 11px; border-radius: 4px; display: flex; align-items: center; gap: 2px;">
                                            <span class="material-symbols-outlined" style="font-size:12px;">image</span> 저장
                                        </button>
                                    </div>
                                    <div style="position: relative; height:280px; width:100%;">
                                        <canvas id="chart-stats-line"></canvas>
                                    </div>
                                </div>

                                <!-- Bar Chart -->
                                <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #ffffff;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                        <h4 style="margin: 0; color: #333; font-size: 1.05rem; font-weight: 600;">📊 사전 vs 사후 성적 분포 비교 (위기대처)</h4>
                                        <button id="btn-save-chart-bar" class="safety-sync-btn" style="float:none; margin:0; padding: 4px 8px; font-size: 11px; border-radius: 4px; display: flex; align-items: center; gap: 2px;">
                                            <span class="material-symbols-outlined" style="font-size:12px;">image</span> 저장
                                        </button>
                                    </div>
                                    <div style="position: relative; height:280px; width:100%;">
                                        <canvas id="chart-stats-bar"></canvas>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function renderVideos() {
        return VIDEO_LIST.map(v => `
            <div class="video-card">
                <div class="safety-video-wrapper">
                    <iframe class="safety-video-iframe" src="https://www.youtube.com/embed/${v.id}" title="${v.title}" frameborder="0" allowfullscreen></iframe>
                </div>
                <div class="safety-video-info">
                    <h3 class="safety-video-title">${v.title}</h3>
                </div>
            </div>
        `).join('');
    }

    function renderGhsGrid() {
        return GHS_DATA.map(item => `
            <div class="ghs-card" onclick="alert('${item.name}: ${item.desc}')">
                <img src="https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${item.id}.gif" alt="${item.name}">
                <div class="ghs-card-title">GHS${item.id} ${item.name}</div>
            </div>
        `).join('');
    }

    function switchTab(targetId) {
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        document.querySelectorAll('.nav-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.target === targetId);
        });
        const target = document.getElementById(targetId);
        if (target) target.style.display = 'block';

        if (targetId === 'quiz-section') initQuiz();
        if (targetId === 'stats-section') initSafetyStats();
    }

    function bindEvents(container) {
        container.querySelectorAll('.nav-tab').forEach(tab => {
            tab.onclick = () => switchTab(tab.dataset.target);
        });
        bindManualButtons();
    }

    // --- Quiz Logic ---
    function initQuiz() {
        const root = document.getElementById('quiz-root');
        if (QUIZ_STATE.questions.length > 0) return; // Already started

        root.innerHTML = `
            <div class="quiz-container">
                <div class="quiz-header">
                    <h2>스마트 과학실 안전 퀴즈</h2>
                    <p>우리 학교의 데이터를 활용한 퀴즈입니다. 80점 이상 인증서 발급!</p>
                </div>
                <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 12px; margin: 0 auto 24px auto; max-width: 480px; text-align: left; font-size: 13.5px; line-height: 1.6; color: #1e40af;">
                    💡 <strong>탐험하며 정답 찾기:</strong><br>
                    퀴즈를 풀다가 잘 모르는 문제가 나오면, SciManager 사이트 내의 다른 메뉴(영상 교육, 매뉴얼/서식, GHS 기호, 시약/교구 검색 등)를 자유롭게 탐험하며 정답을 찾아 답해 보세요!
                </div>
                <div style="text-align:center; margin-top:20px; display:flex; flex-direction:column; align-items:center; gap:12px;">
                    <input type="text" id="quiz-student-no" placeholder="학번을 입력하세요 (예: 10133)" style="padding:10px; border-radius:8px; border:1px solid #ddd; width:220px; font-size:14px;"><br>
                    <input type="text" id="quiz-user-name" placeholder="이름을 입력하세요" style="padding:10px; border-radius:8px; border:1px solid #ddd; width:220px; font-size:14px; margin-top:-10px;"><br>
                    <button class="btn-primary" onclick="App.SafetyEdu.startQuiz()" style="margin-top:-5px; width:120px;">시작하기</button>
                </div>
            </div>
        `;
    }

    SafetyEdu.startQuiz = async function () {
        const studentNoEl = document.getElementById('quiz-student-no');
        const userNameEl = document.getElementById('quiz-user-name');
        const studentNo = studentNoEl ? studentNoEl.value.trim() : "";
        const name = userNameEl ? userNameEl.value.trim() : "";

        if (!studentNo) { alert("학번을 입력해주세요."); return; }
        if (!name) { alert("이름을 입력해주세요."); return; }

        QUIZ_STATE.studentNo = studentNo;
        QUIZ_STATE.userName = name;
        QUIZ_STATE.currentStep = 0;
        QUIZ_STATE.score = 0;

        // Load Quiz Bank
        QUIZ_STATE.questions = await generateHybridQuestions();
        renderNextQuestion();
    };

    async function generateHybridQuestions() {
        if (!App.SafetyQuizData) {
            console.error("SafetyQuizData not loaded!");
            return [];
        }

        const SECTIONS = [
            "실험실 기본 안전 및 보호구",
            "화학물질 취급 및 폐기물 처리",
            "응급 대처 및 화재 예방",
            "GHS 및 MSDS의 이해",
            "스마트 과학실 화학물질 식별"
        ];
        
        const finalQuestions = [];
        const dynamicQuestions = [];

        // 1. Try to get Dynamic Questions
        try {
            const { data: invData } = await App.supabase
                .from('Inventory')
                .select(`
                    id, 
                    door_vertical,
                    door_horizontal,
                    internal_shelf_level,
                    storage_column,
                    substance (
                        chem_name_kor,
                        substance_name,
                        molecular_formula, 
                        cas_rn, 
                        molecular_mass,
                        school_hazardous_chemical_standard,
                        toxic_substance_standard,
                        permitted_substance_standard,
                        restricted_substance_standard,
                        prohibited_substance_standard
                    ),
                    Cabinet (
                        id,
                        cabinet_name,
                        door_horizontal_count,
                        area_id:lab_rooms!fk_cabinet_lab_rooms (
                            id,
                            room_name
                        )
                    )
                `)
                .limit(50); // Fetch enough to pick randomly

            if (invData && invData.length > 0) {
                const invCopy = [...invData];
                
                const massQ = App.SafetyQuizData.getMassComparisonQuestion(invCopy);
                if (massQ) {
                    dynamicQuestions.push(massQ);
                }

                while (dynamicQuestions.length < 5 && invCopy.length > 0) {
                    const idx = Math.floor(Math.random() * invCopy.length);
                    const item = invCopy.splice(idx, 1)[0];
                    const types = App.SafetyQuizData.getDynamicTemplates(item, invData);
                    if (types.length > 0) {
                        const qData = types[Math.floor(Math.random() * types.length)];
                        dynamicQuestions.push(qData);
                    }
                }
            }
        } catch (e) {
            console.error("Dynamic question fetch failed, falling back to fixed pool", e);
        }

        // Fill dynamic if not 5
        if (dynamicQuestions.length < 5) {
            const fallbacks = App.SafetyQuizData.getFallbackDynamicQuestions();
            while (dynamicQuestions.length < 5 && fallbacks.length > 0) {
                dynamicQuestions.push(fallbacks.pop());
            }
        }
        
        const sectionQuestions = {
            "스마트 과학실 화학물질 식별": dynamicQuestions.slice(0, 5)
        };

        const fixedBySection = {
            "실험실 기본 안전 및 보호구": [],
            "화학물질 취급 및 폐기물 처리": [],
            "응급 대처 및 화재 예방": [],
            "GHS 및 MSDS의 이해": []
        };
        
        App.SafetyQuizData.FIXED_POOL.forEach(q => {
            if (fixedBySection[q.section]) {
                fixedBySection[q.section].push(q);
            } else {
                fixedBySection["실험실 기본 안전 및 보호구"].push(q);
            }
        });

        SECTIONS.slice(0, 4).forEach(sec => {
            const pool = [...fixedBySection[sec]];
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            
            const picked = pool.slice(0, 5).map(q => App.SafetyQuizData.randomizeFixedQuestion(q));
            sectionQuestions[sec] = picked;
        });

        // Merge all into finalQuestions sequentially
        SECTIONS.forEach(sec => {
            finalQuestions.push(...sectionQuestions[sec]);
        });

        return finalQuestions;
    }

    function renderNextQuestion() {
        const step = QUIZ_STATE.currentStep;
        const total = QUIZ_STATE.questions.length;
        const root = document.getElementById('quiz-root');

        if (step >= total) {
            showResult();
            return;
        }

        const q = QUIZ_STATE.questions[step];
        const sectionIndex = Math.floor(step / 5) + 1;
        
        root.innerHTML = `
            <div class="quiz-container">
                <div class="quiz-progress"><div class="quiz-progress-inner" style="width:${(step / total) * 100}%"></div></div>
                <div class="quiz-section-badge" style="display:inline-block; padding:4px 12px; background:#e0f2fe; color:#0284c7; border-radius:12px; font-size:13px; font-weight:bold; margin-bottom:12px;">
                    [Section ${sectionIndex}/5] ${q.section || '스마트 과학실 안전 퀴즈'}
                </div>
                <div class="quiz-question-box">
                    <div class="quiz-question-text">${step + 1}. ${q.q}</div>
                    <div class="quiz-options">
                        ${q.options.map((opt, idx) => `
                            <div class="quiz-option" onclick="App.SafetyEdu.checkAnswer(${idx})">${opt}</div>
                        `).join('')}
                    </div>
                </div>
                <div style="margin-top: 25px; text-align: center; font-size: 0.85rem; color: #64748b; line-height: 1.5; background-color: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    💡 잘 모르는 문제는 SciManager의 AI챗봇을 이용하거나 메뉴를 탐험하며 정답을 찾아보세요!
                </div>
            </div>
        `;
    }

    SafetyEdu.checkAnswer = function (idx) {
        const step = QUIZ_STATE.currentStep;
        if (idx === QUIZ_STATE.questions[step].correct) {
            QUIZ_STATE.score += 100 / QUIZ_STATE.questions.length;
        }
        QUIZ_STATE.currentStep++;
        renderNextQuestion();
    };

    async function showResult() {
        const score = Math.round(QUIZ_STATE.score);
        const root = document.getElementById('quiz-root');
        const pass = score >= 80;

        // 로딩 상태 임시 노출
        root.innerHTML = `
            <div class="quiz-container" style="text-align:center; padding:40px;">
                <h2 style="font-size:1.25rem; margin-bottom:20px;">결과를 저장하고 있습니다...</h2>
                <div style="margin:20px auto; width:40px; height:40px; border:4px solid #f3f3f3; border-top:4px solid #3498db; border-radius:50%; animation:spin 1s linear infinite;"></div>
            </div>
        `;

        let attemptCount = 1;
        let semesterId = null;

        try {
            // 1. 현재 학년도 조회 (가장 최근에 생성된 학년도)
            const { data: semData, error: semErr } = await App.supabase
                .from('lab_semesters')
                .select('id')
                .order('created_at', { ascending: false })
                .limit(1);

            if (semErr) throw semErr;

            if (semData && semData.length > 0) {
                semesterId = semData[0].id;
            }

            if (semesterId) {
                // 2. 동일 학년도 내에서 이 학번 + 이름의 기존 기록 조회하여 시도 회차 계산
                const { data: existingRecords, error: countErr } = await App.supabase
                    .from('safety_quiz_results')
                    .select('id')
                    .eq('semester_id', semesterId)
                    .eq('student_no', QUIZ_STATE.studentNo)
                    .eq('student_name', QUIZ_STATE.userName);

                if (countErr) throw countErr;
                attemptCount = (existingRecords ? existingRecords.length : 0) + 1;

                // 3. 결과 저장
                const { error: insertErr } = await App.supabase
                    .from('safety_quiz_results')
                    .insert([{
                        semester_id: semesterId,
                        student_no: QUIZ_STATE.studentNo,
                        student_name: QUIZ_STATE.userName,
                        score: score,
                        attempt_count: attemptCount
                    }]);

                if (insertErr) throw insertErr;
            } else {
                console.warn("등록된 학년도(Semester) 정보가 없어 퀴즈 결과가 로컬 환경에서 저장되지 못했습니다. 관리자 설정에서 학년도를 먼저 등록해 주세요.");
            }
        } catch (err) {
            console.error("퀴즈 결과 저장 중 오류 발생:", err);
        }

        root.innerHTML = `
            <div class="quiz-container" style="text-align:center;">
                <h2 style="font-size:1.5rem; margin-bottom:20px;">결과: ${score}점</h2>
                <p>${pass ? `🎉 축하합니다! 과학실 안전교육을 성실히 이수하셨습니다. (시도 회차: ${attemptCount}회)` : `😅 아깝네요. 다시 한 번 도전해 보세요! (시도 회차: ${attemptCount}회)`}</p>
                <div style="margin-top:30px;">
                    ${pass ? `<button class="btn-primary" onclick="App.SafetyEdu.showCertificate()">인증서 발급하기</button>` : `<button class="btn-cancel" onclick="location.reload()">다시 하기</button>`}
                </div>
            </div>
        `;
    }

    SafetyEdu.showCertificate = function () {
        const area = document.getElementById('certificate-area');
        area.style.display = 'block';

        // Use global school name or fallback
        const schoolName = globalThis.APP_CONFIG?.SCHOOL || '과학실';

        // Date-time based Serial: YYYYMMDD-HHmmSS
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
        const serialNum = `${year}${month}${day}-${hour}${min}${sec}`;

        const dateStr = `${year}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;

        area.innerHTML = `
            <div id="print-zone" class="cert-container">
                <div class="cert-header">
                    <div class="cert-title-top">CERTIFICATE OF COMPLETION</div>
                    <h1 class="cert-main-title">안전 교육 이수증</h1>
                </div>
                <div class="cert-body">
                    <div class="cert-student-box">
                        <div class="cert-label">학번 및 성명</div>
                        <div class="cert-name">${QUIZ_STATE.studentNo} ${QUIZ_STATE.userName}</div>
                    </div>
                    <div class="cert-text">
                        위 학생은 SciManager를 통한<br>
                        <strong>[스마트 과학실 안전 교육]</strong> 과정을<br>
                        우수한 성적으로 이수하였으므로 이 증서를 수여합니다.
                    </div>
                    <div class="cert-date">${dateStr}</div>
                </div>
                <div class="cert-footer">
                    <div class="cert-school-name">${schoolName}</div>
                    <div class="cert-seal">
                        SciManager<br>인증인
                    </div>
                </div>
                <div class="cert-serial">[SciManager Safety Certificate #${serialNum}]</div>
            </div>
            <div style="text-align:center; margin-top:30px;">
                <button class="btn-primary" onclick="window.print()" style="padding: 15px 40px; font-size: 1.1rem; border-radius: 30px;">프린트 하기</button>
            </div>
        `;
        area.scrollIntoView({ behavior: 'smooth' });
    };

    // --- Fetch Logic ---
    async function fetchContentFromDB() {
        const { data, error } = await App.supabase.from('safety_content').select('*').order('display_order', { ascending: true });
        if (error) throw error;
        VIDEO_LIST = data.filter(item => item.content_type === 'video').map(item => ({ category: item.category, title: item.title, id: item.external_id }));
        const manuals = data.filter(item => item.content_type === 'pdf');
        const groups = {};
        manuals.forEach(m => { if (!groups[m.category]) groups[m.category] = []; groups[m.category].push({ title: m.title, fileId: m.external_id }); });
        MANUAL_LIST_GROUPED = Object.keys(groups).map(key => ({ category: key, items: groups[key] }));
    }

    function renderManuals() {
        return MANUAL_LIST_GROUPED.map((cat, idx) => `
            <div class="safety-manual-section">
                <h3 class="safety-manual-category">${cat.category}</h3>
                <div class="manual-pdf-container">
                    ${cat.items.map(item => `<button class="manual-btn" data-file="${item.fileId}"><span class="material-symbols-outlined" style="font-size:18px;">picture_as_pdf</span> ${item.title}</button>`).join('')}
                </div>
                <div class="pdf-viewer-box safety-pdf-viewer"></div>
            </div>
        `).join('');
    }

    function bindManualButtons() {
        document.querySelectorAll('.manual-btn').forEach(btn => {
            btn.onclick = () => {
                const viewerBox = btn.closest('div').nextElementSibling;
                const fileId = btn.dataset.file;
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    viewerBox.style.height = '0';
                    viewerBox.innerHTML = '';
                    return;
                }
                btn.closest('.safety-manual-section').querySelectorAll('.manual-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                viewerBox.innerHTML = `<iframe src="https://drive.google.com/file/d/${fileId}/preview" width="100%" height="600" style="border:none;"></iframe>`;
                viewerBox.style.height = '600px';
                viewerBox.style.marginTop = '10px';
                viewerBox.style.border = '1px solid #ddd';
            };
        });
    }

    function checkAdminRole() {
        if (App.Auth && App.Auth.isAdmin && App.Auth.isAdmin()) {
            const btn = document.getElementById('btn-sync-content');
            if (btn) {
                btn.style.display = 'block';
                btn.onclick = triggerContentSync;
            }
        }
    }

    async function triggerContentSync() {
        if (!confirm("구글 사이트(원본)의 최신 내용으로 동기화하시겠습니까?")) return;
        const btn = document.getElementById('btn-sync-content');
        btn.disabled = true;
        btn.textContent = "동기화 중...";
        const { data, error } = await App.supabase.functions.invoke('sync-content', { body: { target: 'safety' } });
        if (error) { alert("동기화 실패: " + error.message); btn.textContent = "🔄 최신 콘텐츠 동기화"; btn.disabled = false; }
        else { alert(data.message || "동기화 완료!"); location.reload(); }
    }

    // ==========================================
    // 안전 퀴즈 통계 분석 및 시각화 엔진 (교사 전용)
    // ==========================================
    let lineChartInstance = null;
    let barChartInstance = null;
    let statsData = []; // 로드된 퀴즈 결과

    async function initSafetyStats() {
        console.log("📊 initSafetyStats() 실행");
        const statsSemesterSelect = document.getElementById('stats-semester-select');
        const statsClassSelect = document.getElementById('stats-class-select');
        const btnExportCsv = document.getElementById('btn-export-stats-csv');
        const btnSaveLine = document.getElementById('btn-save-chart-line');
        const btnSaveBar = document.getElementById('btn-save-chart-bar');

        if (!statsSemesterSelect) return;

        // 1. 학년도 목록 로드 및 드롭다운 채우기 (최초 1회)
        if (statsSemesterSelect.options.length <= 1) {
            statsSemesterSelect.innerHTML = '<option value="">학년도를 선택하세요</option>';
            const { data: semesters, error } = await App.supabase
                .from('lab_semesters')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("학년도 로드 실패:", error);
                return;
            }

            semesters.forEach(sem => {
                const opt = document.createElement('option');
                opt.value = sem.id;
                opt.textContent = sem.name;
                statsSemesterSelect.appendChild(opt);
            });

            // 가장 최신 학년도 기본 선택
            if (semesters.length > 0) {
                statsSemesterSelect.value = semesters[0].id;
            }

            // 이벤트 바인딩
            statsSemesterSelect.onchange = () => loadAndRenderStats();
            statsClassSelect.onchange = () => renderStatsChartsAndTable();

            if (btnExportCsv) btnExportCsv.onclick = () => exportStatsToCSV();
            if (btnSaveLine) btnSaveLine.onclick = () => saveChartImage('chart-stats-line', '시도회차별_평균성취도_추이.png');
            if (btnSaveBar) btnSaveBar.onclick = () => saveChartImage('chart-stats-bar', '사전_사후_성적분포_비교.png');
        }

        // 2. 데이터 불러오기 및 통계 화면 그리기
        await loadAndRenderStats();
    }

    async function loadAndRenderStats() {
        const statsSemesterSelect = document.getElementById('stats-semester-select');
        const statsClassSelect = document.getElementById('stats-class-select');
        const semesterId = statsSemesterSelect.value;

        if (!semesterId) {
            document.getElementById('stats-ttest-body').innerHTML = '<tr><td colspan="7" style="padding: 20px; color: #999;">학년도를 선택해 주세요.</td></tr>';
            return;
        }

        // Supabase 데이터 가져오기
        const { data, error } = await App.supabase
            .from('safety_quiz_results')
            .select('*')
            .eq('semester_id', semesterId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("통계 데이터 로드 실패:", error);
            alert("통계 데이터를 불러오는데 실패했습니다: " + error.message);
            return;
        }

        statsData = data || [];

        // 학급 필터링 옵션 동적 구성 (학번 앞자리 파싱)
        const classSet = new Set();
        statsData.forEach(row => {
            const no = String(row.student_no).trim();
            if (no.length >= 3) {
                const gradeClass = no.substring(0, 3);
                classSet.add(gradeClass);
            }
        });

        // 학급 필터 셀렉트 박스 채우기
        const currentSelectedClass = statsClassSelect.value;
        statsClassSelect.innerHTML = '<option value="all">전체 학급</option>';
        Array.from(classSet).sort().forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls;
            const grade = cls.substring(0, 1);
            const clsNo = parseInt(cls.substring(1, 3));
            opt.textContent = `${grade}학년 ${clsNo}반`;
            statsClassSelect.appendChild(opt);
        });

        // 기존 선택 유지
        if (Array.from(classSet).includes(currentSelectedClass)) {
            statsClassSelect.value = currentSelectedClass;
        } else {
            statsClassSelect.value = 'all';
        }

        // 차트 및 표 렌더링
        renderStatsChartsAndTable();
    }

    function renderStatsChartsAndTable() {
        const statsClassSelect = document.getElementById('stats-class-select');
        const classFilter = statsClassSelect.value;

        // 데이터 필터링 (학급 필터 적용)
        let filtered = statsData;
        if (classFilter !== 'all') {
            filtered = statsData.filter(row => String(row.student_no).startsWith(classFilter));
        }

        // 1. 회차별 평균 정답률 추이 (Line Chart) 데이터 계산
        const attemptScores = {};
        filtered.forEach(row => {
            const att = row.attempt_count;
            if (!attemptScores[att]) {
                attemptScores[att] = { sum: 0, count: 0 };
            }
            attemptScores[att].sum += row.score;
            attemptScores[att].count += 1;
        });

        const attempts = Object.keys(attemptScores).map(Number).sort((a, b) => a - b);
        const lineLabels = attempts.map(att => `${att}회차`);
        const lineDataPoints = attempts.map(att => Math.round(attemptScores[att].sum / attemptScores[att].count * 10) / 10);

        // 2. 사전 vs 사후 성적 분포 비교 (Bar Chart) 데이터 계산
        const studentLatest = {};
        filtered.forEach(row => {
            const key = `${row.student_no}_${row.student_name}`;
            if (!studentLatest[key] || studentLatest[key].attempt_count < row.attempt_count) {
                studentLatest[key] = row;
            }
        });

        const preScores = [];
        const postScores = [];

        filtered.forEach(row => {
            if (row.attempt_count === 1) {
                preScores.push(row.score);
            }
        });

        Object.values(studentLatest).forEach(row => {
            if (row.attempt_count >= 2) {
                postScores.push(row.score);
            }
        });

        const getDistribution = (scores) => {
            const dist = [0, 0, 0, 0, 0];
            scores.forEach(s => {
                if (s <= 20) dist[0]++;
                else if (s <= 40) dist[1]++;
                else if (s <= 60) dist[2]++;
                else if (s <= 80) dist[3]++;
                else dist[4]++;
            });
            return dist;
        };

        const preDist = getDistribution(preScores);
        const postDist = getDistribution(postScores);
        const barLabels = ["0-20점", "21-40점", "41-60점", "61-80점", "81-100점"];

        // --- 3. 독립표본 t-검정 계산 ---
        const ttestBody = document.getElementById('stats-ttest-body');

        if (preScores.length === 0 || postScores.length === 0) {
            ttestBody.innerHTML = '<tr><td colspan="7" style="padding: 20px; color: #999;">t-검정을 수행할 사전/사후 집단 데이터가 부족합니다.<br>(사전(1회차) 데이터와 2회차 이상 응답자가 모두 존재해야 분석이 가능합니다)</td></tr>';
        } else {
            const n1 = preScores.length;
            const n2 = postScores.length;

            const m1 = preScores.reduce((a, b) => a + b, 0) / n1;
            const m2 = postScores.reduce((a, b) => a + b, 0) / n2;

            const getSD = (arr, mean) => {
                if (arr.length <= 1) return 0;
                const sumSq = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
                return Math.sqrt(sumSq / (arr.length - 1));
            };

            const sd1 = getSD(preScores, m1);
            const sd2 = getSD(postScores, m2);

            const df = n1 + n2 - 2;
            let tValue = 0;
            let pValue = 1;

            if (df > 0) {
                const var1 = Math.pow(sd1, 2);
                const var2 = Math.pow(sd2, 2);
                const spSquared = ((n1 - 1) * var1 + (n2 - 1) * var2) / df;

                if (spSquared > 0) {
                    const standardError = Math.sqrt(spSquared * (1 / n1 + 1 / n2));
                    tValue = (m2 - m1) / standardError;
                    pValue = calculateStudentTPValue(tValue, df);
                }
            }

            ttestBody.innerHTML = `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px; font-weight:600; background:#fafafa; border: 1px solid #e8e8e8;">사전 집단 (Pre-test)</td>
                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${n1}명</td>
                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${m1.toFixed(2)}점</td>
                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${sd1.toFixed(2)}</td>
                    <td rowspan="2" style="padding: 12px; font-weight:600; background:#f9f9f9; border: 1px solid #e8e8e8; vertical-align:middle;">
                        ${tValue.toFixed(4)}
                    </td>
                    <td rowspan="2" style="padding: 12px; border: 1px solid #e8e8e8; vertical-align:middle;">
                        ${df}
                    </td>
                    <td rowspan="2" style="padding: 12px; font-weight:600; color:${pValue < 0.05 ? '#27ae60' : '#c0392b'}; border: 1px solid #e8e8e8; vertical-align:middle;">
                        ${pValue < 0.001 ? '&lt; 0.001 (대단히 유의)' : pValue.toFixed(4) + (pValue < 0.05 ? ' *' : '')}
                    </td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px; font-weight:600; background:#fafafa; border: 1px solid #e8e8e8;">사후 집단 (Post-test)</td>
                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${n2}명</td>
                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${m2.toFixed(2)}점</td>
                    <td style="padding: 12px; border: 1px solid #e8e8e8;">${sd2.toFixed(2)}</td>
                </tr>
            `;
        }

        renderLineChart(lineLabels, lineDataPoints);
        renderBarChart(barLabels, preDist, postDist);
    }

    function calculateStudentTPValue(t, df) {
        t = Math.abs(t);
        const x = df / (df + t * t);
        let p = 0;
        if (df % 2 === 0) {
            let term = 1;
            let sum = 1;
            const limit = df / 2 - 1;
            for (let i = 1; i <= limit; i++) {
                term = term * (1 - x) * (2 * i - 1) / (2 * i);
                sum += term;
            }
            p = 1 - Math.sqrt(1 - x) * sum;
        } else {
            let term = Math.sqrt(x);
            let sum = term;
            const limit = (df - 1) / 2;
            for (let i = 1; i <= limit; i++) {
                term = term * x * (2 * i) / (2 * i + 1);
                sum += term;
            }
            p = 1 - (2 / Math.PI) * (Math.atan(t / Math.sqrt(df)) + Math.sqrt(1 - x) * sum / Math.sqrt(x));
        }
        return Math.min(1, Math.max(0, p));
    }

    function renderLineChart(labels, dataPoints) {
        const canvas = document.getElementById('chart-stats-line');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (lineChartInstance) {
            lineChartInstance.destroy();
        }

        if (labels.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        lineChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '평균 점수',
                    data: dataPoints,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#2980b9',
                    pointRadius: 5,
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: { stepSize: 20 }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    function renderBarChart(labels, preDist, postDist) {
        const canvas = document.getElementById('chart-stats-bar');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (barChartInstance) {
            barChartInstance.destroy();
        }

        if (preDist.every(v => v === 0) && postDist.every(v => v === 0)) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        barChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '사전 (1회차)',
                        data: preDist,
                        backgroundColor: '#e74c3c',
                        borderColor: '#c0392b',
                        borderWidth: 1
                    },
                    {
                        label: '사후 (최종)',
                        data: postDist,
                        backgroundColor: '#2ecc71',
                        borderColor: '#27ae60',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    }
                }
            }
        });
    }

    function saveChartImage(canvasId, filename) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function exportStatsToCSV() {
        const statsSemesterSelect = document.getElementById('stats-semester-select');
        const semesterText = statsSemesterSelect.options[statsSemesterSelect.selectedIndex].text;

        if (statsData.length === 0) {
            alert("내보낼 통계 데이터가 없습니다.");
            return;
        }

        let csvContent = "\ufeff학년도,학번,이름,퀴즈 점수,시도 회차,제출 일시\n";

        statsData.forEach(row => {
            const date = new Date(row.created_at).toLocaleString();
            csvContent += `"${semesterText}","${row.student_no}","${row.student_name}",${row.score},${row.attempt_count},"${date}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `스마트과학실_퀴즈통계_${semesterText.replace(/\s+/g, '_')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.SafetyEdu = SafetyEdu;
})();
