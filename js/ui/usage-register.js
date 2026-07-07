// ================================================================
// /js/ui/usage-register.js
// 사용량 등록 (목록 -> 상세 단일 흐름)
// ================================================================
(function () {
    console.log("🧪 UsageRegister 모듈 로드됨");

    let allInventory = [];
    let selectedItem = null;
    let currentSort = "category_name_kor"; // 기본 정렬

    // ------------------------------------------------------------
    // 1️⃣ 초기화
    // ------------------------------------------------------------
    async function init(params) {
        console.log("🚀 UsageRegister.init()", params);
        currentSort = "category_name_kor"; // 정렬 상태 초기화

        // 날짜 기본값: 오늘
        const now = new Date();
        const yearInput = document.getElementById("usage-date-year");
        const monthInput = document.getElementById("usage-date-month");
        const dayInput = document.getElementById("usage-date-day");
        const hiddenDateInput = document.getElementById("usage-date");

        if (yearInput && monthInput && dayInput && hiddenDateInput) {
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');

            yearInput.value = y;
            monthInput.value = m;
            dayInput.value = d;
            hiddenDateInput.value = `${y}-${m}-${d}`;
        }

        // 정렬 드롭다운 초기화
        if (App.SortDropdown && App.SortDropdown.init) {
            // Add new label mapping
            const labelMap = {
                category_name_kor: "한글명(분류)",
                category_name_eng: "영문명(분류)",
                name_kor: "한글명(전체)",
                name_eng: "영문명(전체)",
                id_asc: "전체(번호순)",
                formula: "화학식",
                storage_location: "위치",
                created_at_desc: "등록순서",
                exhausted: "소모완료약품",
                id_asc_all: "전체(전량소진포함)"
            };
            App.SortDropdown.init({
                onChange: (val) => {
                    currentSort = val;
                    // Fix: Ensure filters (search) are re-applied
                    // Just calling filterAndRenderList does filtering
                    filterAndRenderList(document.getElementById("usage-search-input")?.value || "");
                },
                onRefresh: () => {
                    loadInventoryList();
                },
                defaultLabel: labelMap[currentSort] || "한글명(분류)",
                defaultValue: currentSort
            });
        }

        // 이벤트 리스너 등록
        bindEvents();

        // 목록 로드
        await loadInventoryList();

        // ✅ 파라미터가 있으면 자동 선택
        if (params && params.inventoryId) {
            const targetId = Number(params.inventoryId);
            // allInventory is populated by loadInventoryList
            const targetItem = allInventory.find(item => item.id === targetId);
            if (targetItem) {
                // selectItem 함수 호출 (아래 정의됨)
                selectItem(targetId);
            } else {
                console.warn(`⚠️ 요청된 Inventory ID(${targetId})를 목록에서 찾을 수 없습니다.`);
            }
        }
    }

    function bindEvents() {
        // 날짜 입력 로직 바인딩
        bindDateEvents();

        // 검색
        const searchInput = document.getElementById("usage-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                filterAndRenderList(e.target.value);
            });
        }

        // 뒤로가기
        const backBtn = document.getElementById("btn-back-to-list");
        if (backBtn) {
            backBtn.addEventListener("click", goBackToList);
        }

        // 폼 제출
        const form = document.getElementById("usage-form");
        if (form) {
            form.addEventListener("submit", handleUsageSubmit);
        }
    }

    function bindDateEvents() {
        const yearInput = document.getElementById("usage-date-year");
        const monthInput = document.getElementById("usage-date-month");
        const dayInput = document.getElementById("usage-date-day");
        const hiddenDateInput = document.getElementById("usage-date");
        const btnCalendar = document.getElementById("btn-open-calendar");

        if (!yearInput || !monthInput || !dayInput || !hiddenDateInput) return;

        // 1. Auto-focus & Select-All
        [yearInput, monthInput, dayInput].forEach(input => {
            input.addEventListener('focus', () => input.select());
        });

        // 2. Auto-advance & Sync
        yearInput.addEventListener('input', () => {
            if (yearInput.value.length === 4) monthInput.focus();
            syncToHidden();
        });
        monthInput.addEventListener('input', () => {
            if (monthInput.value.length === 2) dayInput.focus();
            syncToHidden();
        });
        dayInput.addEventListener('input', syncToHidden);

        function syncToHidden() {
            const y = yearInput.value;
            const m = monthInput.value.padStart(2, '0');
            const d = dayInput.value.padStart(2, '0');
            if (y.length === 4 && m.length === 2 && d.length === 2) {
                hiddenDateInput.value = `${y}-${m}-${d}`;
            }
        }

        // 3. Calendar Picker
        if (btnCalendar) {
            btnCalendar.addEventListener('click', () => {
                if (hiddenDateInput.showPicker) {
                    hiddenDateInput.showPicker();
                } else {
                    hiddenDateInput.focus();
                    hiddenDateInput.click();
                }
            });
        }

        // 4. Hidden Input Change (Sync Back)
        hiddenDateInput.addEventListener('change', () => {
            if (hiddenDateInput.value) {
                const [y, m, d] = hiddenDateInput.value.split('-');
                yearInput.value = y;
                monthInput.value = m;
                dayInput.value = d;
                // Auto-hide previous results if date changes
                const resultContainer = document.getElementById("schedule-result-container");
                if (resultContainer) resultContainer.style.display = "none";
            }
        });

        // 5. Schedule Search
        const btnSearchSchedule = document.getElementById("btn-search-schedule");
        if (btnSearchSchedule) {
            btnSearchSchedule.addEventListener("click", fetchSchedule);
        }
    }

    async function fetchSchedule() {
        const dateVal = document.getElementById("usage-date").value;
        if (!dateVal) {
            alert("날짜를 먼저 선택해주세요.");
            return;
        }

        const supabase = App.supabase;
        const resultContainer = document.getElementById("schedule-result-container");
        const listContainer = document.getElementById("schedule-list");

        if (!resultContainer || !listContainer) return;

        resultContainer.style.display = "block";
        listContainer.innerHTML = '<span style="color:#666; font-size:12px;">일정을 조회 중입니다...</span>';

        try {
            // Fetch usage logs for the date
            // Join with subjects, clubs, teachers to get names
            const { data, error } = await supabase
                .from('lab_usage_log')
                .select(`
                    *,
                    lab_subjects ( name ),
                    lab_clubs ( name ),
                    lab_teachers ( name )
                `)
                .eq('usage_date', dateVal)
                .order('period', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                listContainer.innerHTML = '<span style="color:#888; font-size:12px;">해당 날짜에 등록된 일정이 없습니다.</span>';
                return;
            }

            listContainer.innerHTML = "";

            data.forEach(log => {
                // Determine Label
                let periodLabel = `${log.period}교시`;
                let periodVal = `${log.period}교시`;

                // Handle Special Periods
                if (String(log.period) === '99') {
                    periodLabel = '점심';
                    periodVal = '점심시간';
                } else if (String(log.period) === '88') {
                    periodLabel = '방과후';
                    periodVal = '방과후';
                }

                let displayStr = "";
                let applySubject = "";

                if (log.activity_type === '교과수업') {
                    const subjectName = log.lab_subjects?.name || log.subject || "과목미상";
                    const teacherName = log.lab_teachers?.name || "";
                    displayStr = `[${periodLabel}] ${subjectName} ${teacherName ? `(${teacherName})` : ''}`;
                    applySubject = subjectName;
                }
                else if (log.activity_type === '동아리') {
                    // 동아리의 경우 교시와 동아리명 표시
                    const clubName = log.lab_clubs?.name || "동아리";
                    displayStr = `[${periodLabel}] ${clubName}`;
                    applySubject = "동아리";
                }
                else {
                    // 행사, 기타 등: 교시와 내용(행사명) 표시
                    // Prioritize content field, then subject field
                    const content = log.content || log.subject || "활동";
                    displayStr = `[${periodLabel}] ${content}`;
                    applySubject = "기타";
                }

                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "btn-secondary-action usage-period-btn";
                // Inline styles removed
                btn.innerText = displayStr;
                btn.title = "클릭하여 적용";

                btn.onclick = () => {
                    applySchedule(periodVal, applySubject);
                };

                listContainer.appendChild(btn);
            });

        } catch (err) {
            console.error("일정 조회 실패:", err);
            listContainer.innerHTML = '<span style="color:red; font-size:12px;">일정 조회에 실패했습니다.</span>';
        }
    }

    function applySchedule(period, fullSubjectName) {
        const periodSelect = document.getElementById("usage-period");
        const subjectSelect = document.getElementById("usage-subject");

        if (periodSelect) periodSelect.value = period;

        if (subjectSelect) {
            // Try explicit match first
            let matched = false;
            for (let i = 0; i < subjectSelect.options.length; i++) {
                if (subjectSelect.options[i].value === fullSubjectName) {
                    subjectSelect.selectedIndex = i;
                    matched = true;
                    break;
                }
            }

            // Fallback logic
            if (!matched) {
                // If name contains '동아리', select '동아리'
                if (fullSubjectName.includes("동아리")) {
                    subjectSelect.value = "동아리";
                }
                // Check other standard subjects
                else if (fullSubjectName.includes("통합과학")) subjectSelect.value = "통합과학";
                else if (fullSubjectName.includes("탐구")) subjectSelect.value = "과학탐구실험";
                else if (fullSubjectName.includes("물리")) subjectSelect.value = "물리학";
                else if (fullSubjectName.includes("화학")) subjectSelect.value = "화학";
                else if (fullSubjectName.includes("생명")) subjectSelect.value = "생명과학";
                else if (fullSubjectName.includes("지구")) subjectSelect.value = "지구과학";
                else {
                    subjectSelect.value = "기타";
                }
            }
        }

        // Visual Feedback (Flash effect)
        const feedbackColor = "#e0f2f1"; // Light teal
        if (periodSelect) {
            periodSelect.style.backgroundColor = feedbackColor;
            setTimeout(() => periodSelect.style.backgroundColor = "", 500);
        }
        if (subjectSelect) {
            subjectSelect.style.backgroundColor = feedbackColor;
            setTimeout(() => subjectSelect.style.backgroundColor = "", 500);
        }
    }

    // ------------------------------------------------------------
    // 2️⃣ 목록 로드 (전량소진 제외)
    // ------------------------------------------------------------
    async function loadInventoryList() {
        const supabase = App.supabase;
        if (!supabase) return;

        const listContainer = document.getElementById("usage-inventory-list");
        if (listContainer) {
            listContainer.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">hourglass_empty</span>
                <p>목록을 불러오는 중...</p>
            </div>`;
        }

        // 필요한 필드 모두 조회 (classification 추가)
        const { data, error } = await supabase
            .from("Inventory")
            .select(`
        id, current_amount, unit, status, classification, created_at,
        concentration_value, concentration_unit,
        bottle_mass, edited_name_kor,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        photo_url_320, photo_url_160,
        Substance ( 
            substance_name, cas_rn, chem_name_kor, chem_name_kor_mod, molecular_formula, molecular_formula_mod, molecular_mass,
            Properties ( name, property )
        ),
        Cabinet ( cabinet_name, area_id:lab_rooms!fk_cabinet_lab_rooms ( id, room_name ) )
      `)
            .order("id", { ascending: true });

        if (error) {
            console.error("❌ 목록 로드 실패:", error);
            if (listContainer) listContainer.innerHTML = '<div class="error-msg">목록을 불러오지 못했습니다.</div>';
            return;
        }

        allInventory = data || [];
        filterAndRenderList("");
    }

    // ------------------------------------------------------------
    // 정렬 우선순위 상수 (inventory.js와 동일)
    // ------------------------------------------------------------
    const CLASSIFICATION_PRIORITY = {
        '강산': 1, '약산': 2, '강염기': 3, '약염기': 4,
        '알코올': 5, '유기화합물': 6, '산화염': 7, '수산화염': 8,
        '염화염': 9, '질산염': 10, '탄산염': 11, '황산염': 12,
        '황화염': 13, '무기화합물': 14, '금속': 15, '지시약': 16,
        '생명과학': 17, '식품류': 18, '오일류': 19, '화장품재료': 20,
        '세제류': 21, '기타': 22
    };

    function getPriority(classification) {
        return CLASSIFICATION_PRIORITY[classification] || 999;
    }

    // 정렬 함수
    function sortData(rows, key) {
        const collateKo = (a, b) => String(a || "").localeCompare(String(b || ""), "ko");
        const collateEn = (a, b) => String(a || "").localeCompare(String(b || ""), "en", { sensitivity: "base" });

        switch (key) {
            case "category_name_kor": // 한글명(분류) + 우선순위
                return rows.sort((a, b) => {
                    const pA = getPriority(a.classification);
                    const pB = getPriority(b.classification);
                    if (pA !== pB) return pA - pB;
                    return collateKo(a.classification, b.classification) || collateKo(a.edited_name_kor || a.Substance?.chem_name_kor, b.edited_name_kor || b.Substance?.chem_name_kor) || (a.id - b.id);
                });
            case "category_name_eng": // 영문명(분류) + 우선순위
                return rows.sort((a, b) => {
                    const pA = getPriority(a.classification);
                    const pB = getPriority(b.classification);
                    if (pA !== pB) return pA - pB;
                    return collateKo(a.classification, b.classification) || collateEn(a.Substance?.substance_name, b.Substance?.substance_name) || (a.id - b.id);
                });
            case "name_kor": // 한글명(전체)
                return rows.sort((a, b) => collateKo(a.edited_name_kor || a.Substance?.chem_name_kor, b.edited_name_kor || b.Substance?.chem_name_kor) || (a.id - b.id));
            case "name_eng": // 영문명(전체)
                return rows.sort((a, b) => collateEn(a.Substance?.substance_name, b.Substance?.substance_name) || (a.id - b.id));
            case "formula": // 화학식
                return rows.sort((a, b) => collateEn(a.Substance?.molecular_formula, b.Substance?.molecular_formula));
            case "id_asc": // 전체(번호순)
            case "id_asc_all": // 전체(전량소진포함)
                return rows.sort((a, b) => a.id - b.id);
            case "storage_location": // 위치
                return rows.sort((a, b) => {
                    const locA = (a.Cabinet?.area_id?.room_name || "") + (a.Cabinet?.cabinet_name || "");
                    const locB = (b.Cabinet?.area_id?.room_name || "") + (b.Cabinet?.cabinet_name || "");
                    return collateKo(locA, locB);
                });
            case "created_at_desc": // 등록순서
                return rows.sort((a, b) => b.id - a.id);
            default:
                return rows;
        }
    }

    // 그룹화 함수
    function groupData(rows, key) {
        if (key === "category_name_kor" || key === "category_name_eng") {
            const groups = {};
            rows.forEach(item => {
                const cls = item.classification || "미분류";
                if (!groups[cls]) groups[cls] = [];
                groups[cls].push(item);
            });
            // 키 정렬 (우선순위 적용)
            return Object.keys(groups).sort((a, b) => {
                const pA = getPriority(a);
                const pB = getPriority(b);
                if (pA !== pB) return pA - pB;
                return String(a).localeCompare(String(b), "ko");
            }).map(cls => [cls, groups[cls]]);
        }
        return [["", rows]]; // 그룹 없음
    }

    function filterAndRenderList(query) {
        const listContainer = document.getElementById("usage-inventory-list");
        if (!listContainer) return;

        const lowerQuery = query.toLowerCase().trim();

        let filtered = allInventory;

        // 1) 상태 필터링
        if (currentSort === "exhausted") {
            filtered = filtered.filter(item => item.status === "전량소진");
        } else if (currentSort === "id_asc_all") {
            // "전체(전량소진포함)"인 경우 필터링 없음 (전체 표시)
        } else {
            filtered = filtered.filter(item => item.status !== "전량소진");
        }

        // 2) 검색어 필터링
        filtered = filtered.filter(item => {
            const nameKor = item.Substance?.chem_name_kor || "";
            const nameKorMod = item.Substance?.chem_name_kor_mod || "";
            const nameEdited = item.edited_name_kor || "";
            const nameEng = item.Substance?.substance_name || "";
            const cas = item.Substance?.cas_rn || "";

            return nameKor.includes(lowerQuery) ||
                nameKorMod.includes(lowerQuery) ||
                nameEdited.includes(lowerQuery) ||
                nameEng.toLowerCase().includes(lowerQuery) ||
                cas.includes(lowerQuery);
        });

        if (filtered.length === 0) {
            if (query) {
                listContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">search_off</span>
                    <p>검색 결과가 없습니다.</p>
                </div>`;
            } else {
                listContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">edit_square</span>
                    <p>등록된 약품이 없습니다.</p>
                </div>`;
            }
            return;
        }

        // 정렬
        filtered = sortData(filtered, currentSort);

        // 그룹화 및 렌더링
        const grouped = groupData(filtered, currentSort);

        listContainer.innerHTML = grouped.map(([groupTitle, items]) => {
            let header = "";
            if (groupTitle) {
                header = `
            <div class="section-header-wrapper">
              <div class="inventory-section-header">
                <span class="section-title">${groupTitle}</span>
                <span class="section-count">${items.length}</span>
              </div>
            </div>`;
            }
            return `
            <div class="inventory-section-group">
                ${header}
                ${items.map(item => renderItemCard(item)).join("")}
            </div>
        `;
        }).join("");
    }

    // 아이템 카드 HTML 생성
    // - 목록(isDetail=false): 사진 없음, 2줄 요약 (기존 방식)
    // - 상세(isDetail=true): 사진 포함, 4줄 상세 (inventory.js 방식)
    function renderItemCard(item, isDetail = false) {
        const name = item.edited_name_kor || item.Substance?.chem_name_kor_mod || item.Substance?.chem_name_kor || "이름 없음";

        // 농도 텍스트
        let concStr = "-";
        if (item.concentration_value) {
            concStr = `${item.concentration_value}${item.concentration_unit || ""}`;
        }

        // 위치 텍스트
        const area = item.Cabinet?.area_id?.room_name || "";
        const cabinetName = item.Cabinet?.cabinet_name || "";
        const doorVertical = item.door_vertical || "";
        const doorHorizontal = item.door_horizontal || "";
        const shelfLevel = item.internal_shelf_level;
        const column = item.storage_column;

        let locationText = "";
        if (area) locationText += area + " ";
        if (cabinetName) locationText += `『${cabinetName}』 `;

        let doorPart = "";
        const doorHVal = String(doorHorizontal || "").trim();
        let doorHLabel = "";
        if (doorHVal === "1") doorHLabel = "왼쪽";
        else if (doorHVal === "2") doorHLabel = "오른쪽";
        else doorHLabel = doorHVal;

        if (doorVertical && doorHLabel) {
            doorPart = `${doorVertical}층 ${doorHLabel}문`;
        } else if (doorVertical) {
            doorPart = `${doorVertical}층문`;
        } else if (doorHLabel) {
            doorPart = `${doorHLabel}문`;
        }

        let shelfPart = "";
        if (shelfLevel && column) {
            shelfPart = `${shelfLevel}단 ${column}열`;
        } else {
            if (shelfLevel) shelfPart += `${shelfLevel}단`;
            if (column) shelfPart += (shelfPart ? " " : "") + `${column}열`;
        }

        const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
        if (detailParts) locationText += detailParts;
        locationText = locationText.trim() || "위치 정보 없음";

        // 클릭 이벤트
        const onClickAttr = isDetail ? "" : `onclick="App.UsageRegister.selectItem(${item.id})"`;

        // ✅ 상세 화면 (isDetail=true): 4줄 레이아웃 + 사진
        if (isDetail) {
            const imageSrc = item.photo_url_320 || item.photo_url_160 || "";
            const imageBlock = imageSrc
                ? `<div class="inventory-card__image">
                       <img src="${imageSrc}" alt="Inventory Image" />
                     </div>`
                : `<div class="inventory-card__image inventory-card__image--empty">
                       <span class="inventory-card__placeholder">사진 없음</span>
                     </div>`;

            const engName = item.Substance?.substance_name || "-";
            const formula = item.Substance?.molecular_formula_mod || item.Substance?.molecular_formula || "-";
            const casRn = item.Substance?.cas_rn || "";
            const molMass = item.Substance?.molecular_mass || "-";

            return `
              <div class="inventory-card" ${onClickAttr} style="cursor: default;">
                ${imageBlock}
                <div class="inventory-card__body">
                  <div class="inventory-card__left">
                    <div class="inventory-card__line1">
                      <span class="inventory-card__no">No.${item.id}</span>
                      ${casRn ? `<span class="cas-rn">${casRn}</span>` : ""}
                    </div>
                    <div class="inventory-card__line2 name-kor">${name}</div>
                    <div class="inventory-card__line3 name-eng">${engName}</div>
                    <div class="inventory-card__line4 inventory-card__location">${locationText}</div>
                  </div>
                  <div class="inventory-card__meta">
                    <div class="meta-line1">${formula}</div>
                    <div class="meta-line2">
                      <span class="meta-label">화학식량</span>
                      <span class="meta-value">${molMass}</span>
                    </div>
                    <div class="meta-line3">${concStr}</div>
                    <div class="meta-line4">${item.current_amount}${item.unit}</div>
                  </div>
                </div>
              </div>
            `;
        }

        // ✅ 목록 화면 (isDetail=false): 2줄 레이아웃 (사진 없음)
        return `
          <div class="inventory-card inventory-card-simple" ${onClickAttr}>
            <div class="inventory-card__body">
              <div class="inventory-card__left">
                <div class="inventory-card__line1 inventory-card-line1-flex">
                  <span class="inventory-card__no inventory-card-no-fixed">No.${item.id}</span>
                  <span class="name-kor inventory-card-name-bold">${name}</span>
                </div>
                <div class="inventory-card__line4 inventory-card__location inventory-card-loc-gray">${locationText}</div>
              </div>
              <div class="inventory-card__meta inventory-card-meta-right">
                <div class="meta-line3 inventory-card-meta-bold">${concStr}</div>
                <div class="meta-line4 inventory-card-stock-highlight">${item.current_amount}${item.unit}</div>
              </div>
            </div>
          </div>
        `;
    }

    // ------------------------------------------------------------
    // 3️⃣ 아이템 선택 (상세 화면 진입)
    // ------------------------------------------------------------
    async function selectItem(id) {
        selectedItem = allInventory.find(i => i.id === id);
        if (!selectedItem) return;

        // 1. 화면 전환
        document.getElementById("usage-list-section").style.display = "none";
        document.getElementById("usage-detail-section").style.display = "flex"; // CSS class controls flex

        // 2. 선택된 아이템 정보 렌더링
        const displayContainer = document.getElementById("selected-item-display");
        displayContainer.innerHTML = renderItemCard(selectedItem, true);

        // 3. 폼 단위 설정
        document.getElementById("usage-unit-display").textContent = selectedItem.unit;

        // 공병 예상 질량 표시
        const massDisplay = document.getElementById("estimated-bottle-mass");
        if (massDisplay) {
            const massVal = selectedItem.bottle_mass;
            if (massVal !== null && massVal !== undefined) {
                massDisplay.textContent = `※시약병의 공병 예상 질량: ${massVal}g`;
            } else {
                massDisplay.textContent = "※시약병의 공병 예상 질량: 정보없음";
            }
        }

        // 4. 스크롤 상단 이동
        window.scrollTo(0, 0);

        // 5. 사용 기록 로드
        await loadUsageHistory(id);
    }

    function goBackToList() {
        selectedItem = null;
        document.getElementById("usage-detail-section").style.display = "none";
        document.getElementById("usage-list-section").style.display = ""; // Restore CSS display (flex)

        // 폼 초기화
        document.getElementById("usage-amount").value = "";
        document.getElementById("usage-remaining-mass").value = ""; // Also clear remaining mass input
        const massDisplay = document.getElementById("estimated-bottle-mass");
        if (massDisplay) massDisplay.textContent = "※시약병의 공병 예상 질량: 정보없음";

        // 체크박스 초기화
        const exhaustCheck = document.getElementById("check-exhausted");
        if (exhaustCheck) exhaustCheck.checked = false;

        document.getElementById("usage-history-body").innerHTML = "";
    }

    // ------------------------------------------------------------
    // 4️⃣ 사용 기록 로드
    // ------------------------------------------------------------
    async function loadUsageHistory(inventoryId) {
        const supabase = App.supabase;
        const tbody = document.getElementById("usage-history-body");
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">로딩 중...</td></tr>';

        // Fetch ALL logs to calculate initial amount correctly
        const { data, error } = await supabase
            .from("UsageLog")
            .select("*")
            .eq("inventory_id", inventoryId)
            .order("usage_date", { ascending: true }) // Oldest first
            .order("created_at", { ascending: true });

        if (error) {
            console.error("❌ 사용 기록 로드 실패:", error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">기록을 불러오지 못했습니다.</td></tr>';
            return;
        }

        if (!selectedItem) return;

        // Calculate Total Usage: Sum(Logs excluding '최초 등록')
        let totalUsage = 0;
        if (data) {
            data.forEach(l => {
                if (l.subject !== '최초 등록') totalUsage += (l.amount || 0);
            });
        }

        // Handle floating point precision
        totalUsage = parseFloat(totalUsage.toFixed(2));

        // Check for real 'Initial Registration' log
        const realInitialLog = data ? data.find(l => l.subject === '최초 등록') : null;
        const otherLogs = data ? data.filter(l => l.subject !== '최초 등록') : [];

        let allLogs = [];
        if (realInitialLog) {
            // Use real log, set is_initial for styling
            realInitialLog.is_initial = true;
            allLogs = [realInitialLog, ...otherLogs];
        } else {
            // Create Virtual Initial Log
            const initialAmount = parseFloat((selectedItem.current_amount + totalUsage).toFixed(2));
            // Use purchase_date if available (from migration), else created_at
            const initialDate = selectedItem.purchase_date || (selectedItem.created_at ? selectedItem.created_at.split('T')[0] : (new Date().toISOString().split('T')[0]));

            const initialLog = {
                is_initial: true,
                usage_date: initialDate,
                subject: '최초 등록',
                period: '-',
                amount: initialAmount,
                unit: selectedItem.unit
            };
            allLogs = [initialLog, ...otherLogs];
        }

        if (allLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">기록이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = allLogs.map((log, index) => {
            const isLast = (index === allLogs.length - 1);
            // Display stock only on the very last row (most recent)
            const stockDisplay = isLast ? `${selectedItem.current_amount} ${selectedItem.unit}` : '';

            if (log.is_initial) {
                // For real logs (with id), allow edit/delete
                const btnHtml = log.id ? `
                    <button class="btn-mini btn-edit" onclick="App.UsageRegister.editLog(${log.id})">수정</button>
                    <button class="btn-mini btn-delete" onclick="App.UsageRegister.deleteLog(${log.id}, ${log.amount})">삭제</button>
                ` : '-';

                return `
                <tr class="initial-row" style="background:#fcfcfc; color:#555;">
                    <td class="col-date">${log.usage_date}</td>
                    <td class="col-subject" style="font-weight:bold;">${log.subject}</td>
                    <td class="col-period">${log.period || '-'}</td>
                    <td class="col-amount">${log.amount} ${log.unit}</td>
                    <td class="col-stock" style="font-weight:bold; color:#00a0b2;">${stockDisplay}</td>
                    <td>${btnHtml}</td>
                </tr>`;
            } else {
                return `
              <tr id="log-row-${log.id}">
                <td class="col-date">${log.usage_date}</td>
                <td class="col-subject">${log.subject}</td>
                <td class="col-period">${log.period}</td>
                <td class="col-amount">${log.amount} ${log.unit || ""}</td>
                <td class="col-stock" style="font-weight:bold; color:#00a0b2;">${stockDisplay}</td>
                <td>
                    <button class="btn-mini btn-edit" onclick="App.UsageRegister.editLog(${log.id})">수정</button>
                    <button class="btn-mini btn-delete" onclick="App.UsageRegister.deleteLog(${log.id}, ${log.amount})">삭제</button>
                </td>
              </tr>
            `;
            }
        }).join("");
    }

    // ------------------------------------------------------------
    // 4-1. 로그 삭제
    // ------------------------------------------------------------
    async function deleteLog(logId, amount) {
        const supabase = App.supabase;
        if (!confirm("정말 이 사용 기록을 삭제하시겠습니까?\n삭제된 사용량은 재고에 다시 합산됩니다.")) return;

        try {
            const { data, error: logError } = await supabase.functions.invoke('usage-manager', {
                body: {
                    action: 'delete_usage_log',
                    log_id: logId
                }
            });

            if (logError) {
                let errMsg = logError.message || "Unknown error";
                try {
                    const ctx = await logError.context.json();
                    if (ctx && ctx.error) errMsg = ctx.error;
                } catch (e) { }
                throw new Error(errMsg);
            }

            alert("✅ 기록이 삭제되었습니다.");

            // UI refresh
            if (selectedItem) {
                selectedItem.current_amount += amount;

                // Status Revert Logic
                if (selectedItem.current_amount > 0 && selectedItem.status === '전량소진') {
                    const { error: updateError } = await supabase
                        .from('Inventory')
                        .update({ status: '사용중' })
                        .eq('id', selectedItem.id);

                    if (!updateError) {
                        selectedItem.status = '사용중';
                        alert("상태가 '사용중'으로 변경되었습니다.");
                    }
                }

                // 백그라운드 목록 데이터도 갱신
                const itemInList = allInventory.find(i => i.id === selectedItem.id);
                if (itemInList) {
                    itemInList.current_amount = selectedItem.current_amount;
                    itemInList.status = selectedItem.status;
                }
            }
            refreshUI();

        } catch (err) {
            console.error("삭제 실패:", err);
            alert("삭제 중 오류가 발생했습니다: " + err.message);
        }
    }

    // ------------------------------------------------------------
    // 4-2. 로그 수정 (인라인 모드 전환)
    // ------------------------------------------------------------
    function editLog(logId) {
        const row = document.getElementById(`log-row-${logId}`);
        if (!row) return;

        // 기존 값 가져오기
        const date = row.querySelector(".col-date").textContent;
        const subject = row.querySelector(".col-subject").textContent;
        const period = row.querySelector(".col-period").textContent;
        const amountText = row.querySelector(".col-amount").textContent;
        const amount = parseFloat(amountText.split(" ")[0]); // "100 mL" -> 100

        // 인라인 입력창으로 변환
        row.innerHTML = `
            <td><input type="date" id="edit-date-${logId}" value="${date}" style="width:130px;"></td>
            <td>
                <select id="edit-subject-${logId}" style="width:120px;">
                    <option value="통합과학">통합과학</option>
                    <option value="과학탐구실험">과학탐구실험</option>
                    <option value="물리학">물리학</option>
                    <option value="화학">화학</option>
                    <option value="생명과학">생명과학</option>
                    <option value="지구과학">지구과학</option>
                    <option value="동아리">동아리</option>
                    <option value="기타">기타</option>
                </select>
            </td>
            <td>
                <select id="edit-period-${logId}" style="width:100px;">
                    <option value="1교시">1교시</option>
                    <option value="2교시">2교시</option>
                    <option value="3교시">3교시</option>
                    <option value="4교시">4교시</option>
                    <option value="5교시">5교시</option>
                    <option value="6교시">6교시</option>
                    <option value="7교시">7교시</option>
                    <option value="점심시간">점심시간</option>
                    <option value="방과후">방과후</option>
                </select>
            </td>
            <td><input type="number" id="edit-amount-${logId}" value="${amount}" step="0.01" style="width:80px;"></td>
            <td>-</td>
            <td>
                <button class="btn-mini btn-save" onclick="App.UsageRegister.saveLog(${logId}, ${amount})">저장</button>
                <button class="btn-mini btn-cancel" onclick="App.UsageRegister.cancelEdit(${selectedItem.id})">취소</button>
            </td>
        `;

        // Select 값 설정
        document.getElementById(`edit-subject-${logId}`).value = subject;
        document.getElementById(`edit-period-${logId}`).value = period;
    }

    // ------------------------------------------------------------
    // 4-3. 로그 저장
    // ------------------------------------------------------------
    async function saveLog(logId, oldAmount) {
        const newDate = document.getElementById(`edit-date-${logId}`).value;
        const newSubject = document.getElementById(`edit-subject-${logId}`).value;
        const newPeriod = document.getElementById(`edit-period-${logId}`).value;
        const newAmount = parseFloat(document.getElementById(`edit-amount-${logId}`).value);

        if (!newDate || !newSubject || !newPeriod || isNaN(newAmount) || newAmount <= 0) {
            alert("입력 값을 확인해주세요.");
            return;
        }

        const supabase = App.supabase;

        try {
            const { data, error } = await supabase.functions.invoke('usage-manager', {
                body: {
                    action: 'update_usage_log',
                    log_id: logId,
                    new_date: newDate,
                    new_subject: newSubject,
                    new_period: newPeriod,
                    new_amount: newAmount
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            alert("✅ 수정되었습니다.");

            // UI refresh: Reloading inventory to get sync state is safest, but we can approximate on client
            const diff = newAmount - oldAmount;
            if (selectedItem) {
                const calculatedNew = selectedItem.current_amount - diff;
                selectedItem.current_amount = Math.max(0, calculatedNew);

                // Status Revert Logic
                if (selectedItem.current_amount > 0 && selectedItem.status === '전량소진') {
                    const { error: updateError } = await supabase
                        .from('Inventory')
                        .update({ status: '사용중' })
                        .eq('id', selectedItem.id);

                    if (!updateError) {
                        selectedItem.status = '사용중';
                        alert("상태가 '사용중'으로 변경되었습니다.");
                    }
                }

                // 백그라운드 목록 데이터도 갱신
                const itemInList = allInventory.find(i => i.id === selectedItem.id);
                if (itemInList) {
                    itemInList.current_amount = selectedItem.current_amount;
                    itemInList.status = selectedItem.status;
                }
            }
            refreshUI();

        } catch (err) {
            console.error("수정 실패:", err);
            alert("수정 중 오류가 발생했습니다: " + err.message);
        }
    }

    function cancelEdit(inventoryId) {
        loadUsageHistory(inventoryId);
    }

    function refreshUI() {
        if (selectedItem) {
            // 상세 카드 갱신
            document.getElementById("selected-item-display").innerHTML = renderItemCard(selectedItem, true);
            // 목록 갱신
            loadUsageHistory(selectedItem.id);
        }
    }

    // ------------------------------------------------------------
    // 5️⃣ 사용량 등록
    // ------------------------------------------------------------
    async function handleUsageSubmit(e) {
        e.preventDefault();
        if (!selectedItem) return;

        const date = document.getElementById("usage-date").value;
        const subject = document.getElementById("usage-subject").value;
        const period = document.getElementById("usage-period").value;

        const usageInput = document.getElementById("usage-amount");
        const massInput = document.getElementById("usage-remaining-mass");

        const usageVal = usageInput.value && !isNaN(parseFloat(usageInput.value)) ? parseFloat(usageInput.value) : null;
        const massVal = massInput.value && !isNaN(parseFloat(massInput.value)) ? parseFloat(massInput.value) : null;
        let isExhausted = document.getElementById("check-exhausted")?.checked;
        let autoExhausted = false;

        // Auto-detect exhaustion if usage exceeds current amount
        if (!isExhausted && usageVal !== null && usageVal > selectedItem.current_amount) {
            if (confirm("입력된 사용량이 현재 잔여량보다 크므로, 전량소모 처리하겠습니다.")) {
                isExhausted = true;
                autoExhausted = true;
            } else {
                return;
            }
        }

        let finalUsageVal = usageVal;
        let finalMassVal = massVal;

        if (isExhausted) {
            if (!autoExhausted) {
                if (!confirm(`해당 약품을 '전량 소진' 처리하시겠습니까?\n남은 수량(${selectedItem.current_amount}${selectedItem.unit})이 모두 사용 처리됩니다.`)) return;
            }
            // 전량 소진 시 남은 양 전체를 사용량으로 간주
            finalUsageVal = selectedItem.current_amount;
            finalMassVal = null; // 질량 입력 무시
        } else {
            if ((usageVal !== null && massVal !== null) || (usageVal === null && massVal === null)) {
                alert("사용량과 사용 후 시약병 질량 중 하나만 입력해주세요.");
                return;
            }
            if (usageVal !== null && usageVal <= 0) return alert("올바른 사용량을 입력하세요.");
            if (massVal !== null && massVal < 0) return alert("질량은 음수일 수 없습니다.");

            if (!confirm(`사용량을 등록하시겠습니까?`)) return;
        }

        const supabase = App.supabase;
        if (!supabase) {
            alert("서버 연결에 실패했습니다 (Supabase Init Failed).");
            return;
        }

        try {
            const { data, error: invokeError } = await supabase.functions.invoke('usage-manager', {
                body: {
                    action: 'register_usage',
                    inventory_id: selectedItem.id,
                    usage_date: date,
                    subject,
                    period,
                    amount: finalUsageVal, // 수정된 변수 사용
                    remaining_mass: finalMassVal, // 수정된 변수 사용
                    unit: selectedItem.unit
                }
            });

            if (invokeError) {
                let errMsg = invokeError.message || "Unknown error";
                try {
                    const ctx = await invokeError.context.json();
                    if (ctx && ctx.error) errMsg = ctx.error;
                } catch (e) { }
                throw new Error(errMsg);
            }

            // Check for application-level error (200 OK but success: false)
            if (data && data.success === false) {
                throw new Error(data.error || "Unknown server error");
            }
            if (data?.error) throw new Error(data.error);

            alert("✅ 사용량이 등록되었습니다.");

            // 폼 초기화
            document.getElementById("usage-amount").value = "";
            document.getElementById("usage-remaining-mass").value = "";

            // UI 및 데이터 갱신
            // 서버에서 반환된 Inventory 정보를 활용
            const updatedInv = data.data;
            if (updatedInv) {
                selectedItem.current_amount = updatedInv.current_amount;
                selectedItem.status = updatedInv.status;

                // ✅ 전량 소진 체크 시 강제 업데이트 (서버 로직 보완)
                if (isExhausted) {
                    await supabase.from("Inventory").update({
                        status: "전량소진",
                        current_amount: 0
                    }).eq("id", selectedItem.id);

                    selectedItem.status = "전량소진";
                    selectedItem.current_amount = 0;
                }

                // 백그라운드 목록 데이터도 갱신
                const itemInList = allInventory.find(i => i.id === selectedItem.id);
                if (itemInList) {
                    itemInList.current_amount = selectedItem.current_amount;
                    itemInList.status = selectedItem.status;
                }
            }

            if (selectedItem.status === "전량소진") {
                alert("⚠️ 해당 약품이 전량 소진되었습니다.");
                await loadInventoryList();
                goBackToList();
            } else {
                refreshUI();
            }

        } catch (err) {
            console.error("❌ 등록 실패:", err);
            alert(`등록 중 오류가 발생했습니다: ${err.message}`);
        }
    }

    // ------------------------------------------------------------
    // 전역 등록
    // ------------------------------------------------------------
    globalThis.App = globalThis.App || {};
    globalThis.App.UsageRegister = {
        init,
        selectItem,
        deleteLog,
        editLog,
        saveLog,
        cancelEdit
    };
})();
