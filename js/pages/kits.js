(function () {
    // const supabase = globalThis.App?.supabase || window.supabaseClient; // Removed to fix race condition
    let supabase = null; // Lazy load


    // State
    let catalog = []; // Full list from experiment_kit table
    let currentSort = 'name_class';
    let currentSearch = '';
    let currentFilteredData = []; // ✅ State for printing

    // Constants for MSDS
    const msdsTitles = [
        "1. 화학제품과 회사에 관한 정보", "2. 유해성·위험성", "3. 구성성분의 명칭 및 함유량", "4. 응급조치 요령",
        "5. 화재 시 조치방법", "6. 누출 시 조치방법", "7. 취급 및 저장방법", "8. 노출방지 및 개인보호구",
        "9. 물리화학적 특성", "10. 안정성 및 반응성", "11. 독성에 관한 정보", "12. 환경에 미치는 영향",
        "13. 폐기 시 주의사항", "14. 운송에 필요한 정보", "15. 법적 규제현황", "16. 그 밖의 참고사항"
    ];

    const ghsMapping = {
        "01": "폭발성(Explosive)\n· 불안정한 폭발물\n· 폭발물\n· 자기반응성 물질 및 혼합물\n· 유기과산화물",
        "02": "인화성(Flammable)\n· 인화성 가스\n· 가연성 에어로졸\n· 인화성 액체\n· 인화성 고체\n· 자기반응성 물질 및 혼합물\n· 발화성 액체\n· 발화성 고체\n· 가연성 고체\n· 가연성 액체\n· 자체 발열 물질 및 혼합물\n· 물과 접촉하여 가연성 가스를 방출하는 물질 및 혼합물\n· 유기 과산화물",
        "03": "산화성(Oxidizing)\n· 산화 가스\n· 산화성 액체\n· 산화성 고체",
        "04": "고압 가스(Compressed Gas)\n· 압축 가스\n· 액화 가스\n· 냉장 액화 가스\n· 용존 가스",
        "05": "부식성(Corrosive)\n· 금속 부식성\n· 폭발물\n· 인화성 가스\n· 자기 반응성물질 및 혼합물\n· 유기 과산화물\n· 피부부식\n· 심각한 눈 손상",
        "06": "유독성(Toxic)\n· 급성 독성",
        "07": "경고(Health Hazard, Hazardous to Ozone Layer)\n· 급성 독성\n· 피부 자극성\n· 눈 자극성\n· 피부 과민성\n· 특정 표적 장기 독성(호흡기 자극, 마약 효과)",
        "08": "건강 유해성(Serious Health hazard)\n· 호흡기 과민성\n· 생식세포 변이원성\n· 발암성\n· 생식독성\n· 특정표적장기 독성\n· 흡인 위험",
        "09": "수생 환경 유독성(Hazardous to the Environment)\n· 수생환경 유해성",
    };

    function formatLocation(val) {
        if (!val) return '위치 미지정';
        let loc = val;
        // Parse if JSON string
        if (typeof val === 'string' && val.trim().startsWith('{')) {
            try { loc = JSON.parse(val); } catch (e) { }
        }
        // If still string (not JSON), return as is
        if (typeof loc !== 'object') return loc;

        const parts = [];
        if (loc.area_name) parts.push(loc.area_name);
        if (loc.cabinet_name) parts.push(loc.cabinet_name);

        if (loc.door_vertical) parts.push(loc.door_vertical + '층');
        if (loc.door_horizontal) parts.push(loc.door_horizontal + '번');
        if (loc.internal_shelf_level) parts.push(loc.internal_shelf_level + '단');
        if (loc.storage_column) parts.push(loc.storage_column + '열');

        return parts.join(' > ') || '위치 미지정';
    }

    const Kits = {
        async init() {
            supabase = globalThis.App?.supabase || window.supabaseClient; // Init here
            console.log("📦 Kit Page Initialized");
            currentSort = 'name_class'; // 정렬 상태 초기화

            // 1. Setup FAB
            if (App.Fab) {
                App.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 새 키트 등록', () => {
                    if (this.openRegisterModal) {
                        this.openRegisterModal();
                    } else {
                        console.error("openRegisterModal is not defined");
                        alert("기능 초기화 중입니다. 잠시 후 다시 시도해주세요.");
                    }
                });
            }

            // 2. Setup Sort Dropdown
            if (App.SortDropdown) {
                App.SortDropdown.init({
                    toggleId: 'kit-sort-toggle',
                    menuId: 'kit-sort-menu',
                    labelId: 'kit-sort-label',
                    defaultLabel: '키트이름(분류)',
                    defaultValue: 'name_class',
                    onChange: (value) => {
                        currentSort = value;
                        this.loadUserKits();
                    }
                });
            }

            // 3. Setup Search
            const searchInput = document.getElementById('kit-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    // Remove all spaces for flexible search
                    currentSearch = e.target.value.replace(/\s+/g, '').toLowerCase();
                    this.loadUserKits();
                });
            }

            // 5. Setup Refresh
            const refreshBtn = document.getElementById('kit-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.loadUserKits();
                });
            }

            // 6. Setup Print
            const printBtn = document.getElementById('kit-print-btn');
            if (printBtn) {
                if (App.Auth && typeof App.Auth.canWrite === 'function' && !App.Auth.canWrite()) {
                    printBtn.style.display = 'none';
                } else {
                    printBtn.style.display = '';
                    printBtn.addEventListener('click', () => {
                        this.printReport();
                    });
                }
            }

            // 7. Load Data
            await loadCatalog();
            await this.loadUserKits();

            // 8. Setup Modals
            setupRegisterModal();
            setupStockModal();
        },

        async loadUserKits() {
            const listContainer = document.getElementById('kit-list');
            if (!listContainer) return;

            // Set Loading State
            listContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">hourglass_empty</span>
                    <p>목록을 불러오는 중...</p>
                </div>`;

            let query = supabase.from('user_kits').select('*');

            // Apply Sort
            if (currentSort === 'name_class') {
                query = query.order('kit_class', { ascending: true }).order('kit_name', { ascending: true });
            } else if (currentSort === 'name_all') {
                query = query.order('kit_name', { ascending: true });
            } else if (currentSort === 'location') {
                query = query.order('id', { ascending: true });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;

            if (error) {
                listContainer.innerHTML = `<p class="error">로드 실패: ${error.message}</p>`;
                return;
            }

            let filteredData = data;
            if (currentSearch) {
                filteredData = data.filter(kit => {
                    const name = kit.kit_name.replace(/\s+/g, '').toLowerCase();
                    const kClass = (kit.kit_class || '').replace(/\s+/g, '').toLowerCase();
                    return name.includes(currentSearch) || kClass.includes(currentSearch);
                });
            }
            currentFilteredData = filteredData; // ✅ State for printing

            if (!filteredData || filteredData.length === 0) {
                if (currentSearch) {
                    listContainer.innerHTML = `
                        <div class="empty-state">
                            <span class="material-symbols-outlined">search_off</span>
                            <p>검색 결과가 없습니다.</p>
                        </div>`;
                } else {
                    listContainer.innerHTML = `
                        <div class="empty-state">
                            <span class="material-symbols-outlined">inventory_2</span>
                            <p>등록된 키트가 없습니다.</p>
                        </div>`;
                }
                return;
            }

            listContainer.innerHTML = '';

            // Multi-Category Display Logic
            const shouldGroup = (currentSort === 'name_class');

            // 1. Determine items to iterate (Cats or Kits)
            // If grouping: Iterate Categories -> Render related kits
            // If NOT grouping: Iterate Kits (sorted by currentSort)

            let displayPlan = [];

            if (shouldGroup) {
                // Collect Unique Categories
                const categorySet = new Set();
                filteredData.forEach(kit => {
                    if (!kit.kit_class) {
                        categorySet.add('미분류');
                    } else {
                        // Split by comma, trim, avoid duplicates
                        const classes = kit.kit_class.split(',').map(s => s.trim()).filter(s => s);
                        if (classes.length === 0) categorySet.add('미분류');
                        else classes.forEach(c => categorySet.add(c));
                    }
                });

                // Sort Categories (Fixed order + Others)
                const fixedOrder = ['물리학', '화학', '생명과학', '지구과학', '융합과학', '기타', '미분류'];
                const sortedCats = Array.from(categorySet).sort((a, b) => {
                    const idxA = fixedOrder.indexOf(a);
                    const idxB = fixedOrder.indexOf(b);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return a.localeCompare(b);
                });

                // Build Display Plan: { type: 'header', value: 'CatName' } followed by { type: 'kit', data: Kit }
                sortedCats.forEach(cat => {
                    // Filter kits belonging to this category
                    const categoryKits = filteredData.filter(kit => {
                        if (cat === '미분류') return !kit.kit_class || kit.kit_class.trim() === '';
                        if (!kit.kit_class) return false;
                        const classes = kit.kit_class.split(',').map(s => s.trim());
                        return classes.includes(cat);
                    });

                    if (categoryKits.length > 0) {
                        // Add Header
                        displayPlan.push({ type: 'header', value: cat, count: categoryKits.length });
                        // Add Kits
                        categoryKits.forEach(kit => displayPlan.push({ type: 'kit', data: kit }));
                    }
                });

            } else {
                // No grouping, just list kits
                filteredData.forEach(kit => displayPlan.push({ type: 'kit', data: kit }));
            }

            // 2. Render from Display Plan
            displayPlan.forEach(item => {
                if (item.type === 'header') {
                    const wrapper = document.createElement("div");
                    wrapper.className = "section-header-wrapper";
                    const header = document.createElement("div");
                    header.className = "inventory-section-header";
                    header.innerHTML = `
                         <span class="section-title">${item.value}</span>
                         <span class="section-count">${item.count}</span>
                    `;
                    wrapper.appendChild(header);
                    listContainer.appendChild(wrapper);
                    return;
                }

                const kit = item.data;
                const card = document.createElement('div');
                card.className = 'inventory-card tool-card';
                card.dataset.id = kit.id;

                // Image block
                let imageBlock = '';
                if (kit.image_url) {
                    imageBlock = `
                        <div class="inv-card-img">
                            <img src="${kit.image_url}" alt="${kit.kit_name}" loading="lazy" class="kit-list-img">
                        </div>`;
                } else {
                    imageBlock = `
                        <div class="inv-card-img empty kit-list-img-empty">
                             <span>사진 없음</span>
                        </div>`;
                }

                const locStr = formatLocation(kit.location);

                card.innerHTML = `
                    ${imageBlock}
                    <div class="inv-card-content kit-card-content">
                        <div class="inv-card-left kit-card-left">
                             <div>
                                <span class="kit-tag kit-tag-refactored">${kit.kit_class || '미분류'}</span>
                             </div>
                             <div class="inv-name kit-name-text">
                                ${kit.kit_name}
                             </div>
                             <div class="inv-location kit-location-text">
                                ${locStr}
                             </div>
                        </div>

                        <div class="inv-card-right kit-card-right">
                            <div style="height: 20px;"></div>
                            <div style="display: flex; align-items: center; justify-content: flex-end; flex: 1;">
                                ${kit.kit_person ? `<span class="kit-person-count">(${kit.kit_person}인용)</span>` : ''}
                            </div>
                            <div class="inv-quantity kit-quantity-text">
                                수량: ${kit.quantity}개
                            </div>
                        </div>
                    </div>
                `;

                card.addEventListener('click', () => {
                    App.Router.go('kitDetail', { id: kit.id });
                });

                listContainer.appendChild(card);
            });
        },

        async loadDetail(id) {
            console.log("📦 Kit Detail Loading for ID:", id);

            // Ensure catalog is loaded (might be needed for chemical mapping)
            if (catalog.length === 0) await loadCatalog();

            // 1. Fetch Kit Data
            const { data: kit, error } = await supabase
                .from('user_kits')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !kit) {
                console.error("Kit not found:", error);
                const container = document.getElementById('kit-detail-page-container');
                if (container) container.innerHTML = '<p class="error">키트 정보를 찾을 수 없습니다.</p>';
                return;
            }

            // 2. Populate Header & Info
            // 2. Populate Header & Info
            const nameEl = document.getElementById('detail-kit-name');
            nameEl.textContent = kit.kit_name;

            // Add 'Back to List' button if not exists
            const headerContainer = nameEl.parentElement;
            if (headerContainer && !headerContainer.querySelector('.btn-back-list')) {
                // Ensure header is flex for alignment
                headerContainer.style.display = 'flex';
                headerContainer.style.alignItems = 'center';

                // Create Spacer to push button to right
                const spacer = document.createElement('div');
                spacer.style.flex = '1';
                headerContainer.appendChild(spacer);

                const btnBack = document.createElement('button');
                // Removed btn-secondary-action to avoid block styling
                btnBack.className = 'btn-back-list';
                // Explicit inline styles removed, class used instead

                btnBack.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; margin-right:4px;">list</span>목록으로';

                // Hover effect handled by CSS


                btnBack.onclick = () => App.Router.go('kits');

                headerContainer.appendChild(btnBack);
            }

            document.getElementById('detail-kit-class').textContent = kit.kit_class || '-';

            // Photo
            const photoBox = document.getElementById('detail-kit-photo');
            if (kit.image_url) {
                photoBox.innerHTML = `<img src="${kit.image_url}" alt="키트 사진" style="width: 100%; height: 100%; object-fit: cover; object-position: center;">`;
            } else {
                photoBox.innerHTML = '<div class="kit-detail-photo-wrapper">사진 없음</div>';
            }

            // 3. Render 7-Row Layout
            const detailRight = document.querySelector('.detail-right');
            detailRight.innerHTML = `
                <div class="kit-info">
                    <div class="kit-info-row">
                        <span class="label">수량</span>
                        <span class="value" id="detail-kit-quantity">${kit.quantity}</span>
                    </div>
                    <div class="kit-info-row">
                        <span class="label">보관 위치</span>
                        <span class="value" id="detail-kit-location">${formatLocation(kit.location)}</span>
                    </div>
                    <div class="kit-info-row" id="kit-row-3">
                        <span class="label">구성 약품</span>
                        <span class="value"></span>
                    </div>
                    <div class="kit-info-row" id="kit-row-4"><span class="label"></span><span class="value"></span></div>
                    <div class="kit-info-row" id="kit-row-5"><span class="label"></span><span class="value"></span></div>
                    <div class="kit-info-row" id="kit-row-6"><span class="label"></span><span class="value"></span></div>
                    <div class="kit-info-row" id="kit-row-7"><span class="label"></span><span class="value"></span></div>
                </div>
            `;

            // 4. Load Chemicals & Logs
            await loadChemicals(kit);
            await loadUsageLogs(kit);
            await loadUsageLogs(kit);
            setupDetailFab(kit);
        },

        printReport() {
            if (!currentFilteredData || currentFilteredData.length === 0) {
                alert("출력할 데이터가 없습니다.");
                return;
            }

            const printWindow = window.open("", "_blank");
            if (!printWindow) {
                alert("팝업 차단을 해제해주세요.");
                return;
            }

            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

            let rowsHtml = "";
            currentFilteredData.forEach((kit, index) => {
                const name = kit.kit_name || "-";
                const kClass = kit.kit_class || "-";
                const loc = formatLocation(kit.location) || "-";
                const qty = kit.quantity || 0;

                rowsHtml += `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td style="text-align: center;">${kClass}</td>
                    <td>${name}</td>
                    <td>${loc}</td>
                    <td style="text-align: center;">${qty}</td>
                </tr>
                `;
            });

            const htmlContent = `
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <title>실험 키트 목록</title>
                <style>
                    body { font-family: "Noto Sans KR", sans-serif; padding: 20px; }
                    h1 { text-align: center; margin-bottom: 10px; font-size: 24px; }
                    .meta { text-align: right; margin-bottom: 20px; font-size: 14px; color: #555; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: middle; }
                    th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
                    @media print {
                        @page { margin: 15mm; }
                        body { padding: 0; }
                        th { background-color: #eee !important; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <h1>실험 키트 목록</h1>
                <div class="meta">
                    출력일: ${dateStr} | 총 ${currentFilteredData.length}건
                </div>
                <table>
                    <thead>
                        <tr>
                            <th width="5%">No.</th>
                            <th width="15%">분류</th>
                            <th width="35%">키트명</th>
                            <th width="35%">보관 장소</th>
                            <th width="10%">수량</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
            `;

            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();
        }
    };

    // ---- Data Loading Helpers ----
    async function loadCatalog() {
        const { data, error } = await supabase.from('experiment_kit').select('*').order('kit_name');
        if (error) {
            console.error('Failed to load catalog:', error);
            return [];
        }
        catalog = data;
        return data;
    }

    async function deleteKit(id) {
        try {
            const { error } = await supabase.from('user_kits').delete().eq('id', id);
            if (error) throw error;
            // If on list page, reload list. If on detail page, router handles it.
            if (document.getElementById('kit-list')) {
                Kits.loadUserKits();
            }
        } catch (e) {
            alert('삭제 실패: ' + e.message);
        }
    }

    async function loadChemicals(kit) {
        // Clear previous content in rows 3-7
        for (let i = 3; i <= 7; i++) {
            const row = document.getElementById(`kit-row-${i}`);
            if (row) {
                row.querySelector('.value').innerHTML = '';
                if (i > 3) row.querySelector('.label').textContent = '';
            }
        }

        const catalogItem = catalog.find(c => c.kit_name === kit.kit_name);
        if (!catalogItem || !catalogItem.kit_cas) {
            document.querySelector('#kit-row-3 .value').textContent = '-';
            return;
        }

        const casList = catalogItem.kit_cas.split(',').map(s => s.trim().replace(/"/g, '')).filter(s => s);

        // Fetch data for each CAS individually to ensure loose matching works for everyone
        // This bypasses potential issues with .in() strict matching or array formatting
        const results = await Promise.all(casList.map(async (cas) => {
            // 1. Try kit_chemicals with loose match
            const { data: kitData } = await supabase
                .from('kit_chemicals')
                .select('cas_no, name_ko, name_en, msds_data, formula, molecular_weight')
                .ilike('cas_no', `%${cas}%`)
                .limit(1);

            if (kitData && kitData.length > 0) {
                return { requestCas: cas, ...kitData[0] };
            }

            // 2. Fallback check (optional, but requested to focus on kit_chemicals ko name)
            return { requestCas: cas, name_ko: null };
        }));

        const map = new Map();
        results.forEach(res => {
            if (res.name_ko || res.name_en) {
                map.set(res.requestCas, res);
            }
        });

        // Create buttons
        const buttons = casList.map(cas => {
            const btn = document.createElement('div');
            btn.className = 'kit-component-btn';
            const chem = map.get(cas);

            // Priority: name_ko -> name_en -> CAS
            const displayName = chem ? (chem.name_ko || chem.name_en || cas) : cas;

            btn.textContent = displayName;
            btn.title = cas;
            btn.onclick = () => renderInlineChemInfo(cas, chem);
            return btn;
        });

        // Distribute buttons across rows 3-7
        const rows = [
            document.querySelector('#kit-row-3 .value'),
            document.querySelector('#kit-row-4 .value'),
            document.querySelector('#kit-row-5 .value'),
            document.querySelector('#kit-row-6 .value'),
            document.querySelector('#kit-row-7 .value')
        ];

        const totalItems = buttons.length;
        const totalRows = 5;

        if (totalItems === 0) {
            rows[0].textContent = '-';
        } else if (totalItems <= totalRows) {
            // If items <= rows, put one per row (or fill from top)
            // User request: "If 1 item, row 3. If 2 items, row 3 and 4."
            buttons.forEach((btn, index) => {
                if (index < totalRows) rows[index].appendChild(btn);
            });
        } else {
            // Distribute evenly or fill max 3 per row
            // User example: 13 -> 3, 3, 3, 2, 2

            // Simple distribution logic:
            // Calculate items per row
            const baseCount = Math.floor(totalItems / totalRows);
            const remainder = totalItems % totalRows;

            let currentIndex = 0;
            for (let i = 0; i < totalRows; i++) {
                // Distribute remainder to first few rows
                const count = baseCount + (i < remainder ? 1 : 0);
                for (let j = 0; j < count; j++) {
                    if (currentIndex < totalItems) {
                        rows[i].appendChild(buttons[currentIndex]);
                        currentIndex++;
                    }
                }
            }
        }
    }

    async function loadUsageLogs(kit) {
        const tbody = document.getElementById('kit-usage-logs-body');
        if (!tbody) return;

        // Update Header
        // Update Header
        const thead = document.querySelector('.kit-log-table thead tr');
        if (thead) {
            thead.innerHTML = `
                <th>날짜</th>
                <th>유형</th>
                <th>변동</th>
                <th>수량</th>
                <th style="width: 100px;">수정/삭제</th>
            `;
        }

        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">기록 로딩 중...</td></tr>';

        try {
            const { data: usageLogs, error } = await supabase
                .from('kit_usage_log')
                .select('*')
                .eq('user_kit_id', kit.id)
                .order('log_date', { ascending: true }); // Oldest first

            if (error) throw error;

            // Calculate Initial Quantity: Current - Sum(Logs)
            let totalChangeFromLogs = 0;
            if (usageLogs) {
                usageLogs.forEach(log => {
                    totalChangeFromLogs += (log.change_amount || 0);
                });
            }
            const initialQuantity = kit.quantity - totalChangeFromLogs;

            const initialLog = {
                id: 'initial',
                log_date: kit.purchase_date,
                log_type: '구입 (초기)',
                change_amount: initialQuantity,
                is_initial: true
            };

            let allLogs = [];
            // Always show initial log to allow setting/editing it
            allLogs.push(initialLog);
            if (usageLogs) allLogs = [...allLogs, ...usageLogs];

            // Sort by date ascending (Oldest first)
            allLogs.sort((a, b) => new Date(a.log_date || '1970-01-01') - new Date(b.log_date || '1970-01-01'));

            if (allLogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">기록이 없습니다.</td></tr>';
            } else {
                tbody.innerHTML = '';
                let currentQuantity = 0;

                allLogs.forEach(log => {
                    const tr = document.createElement('tr');
                    const rowId = log.is_initial ? 'kit-log-row-initial' : `kit-log-row-${log.id}`;
                    tr.id = rowId;

                    let typeText = log.log_type === 'usage' ? '사용' : (log.log_type === 'purchase' ? '구입' : log.log_type);
                    if (log.is_initial) typeText = '최초 등록';

                    let change = 0;
                    if (log.is_initial) {
                        change = log.change_amount;
                        currentQuantity = change;
                    } else {
                        change = log.change_amount;
                        currentQuantity += change;
                    }

                    const changeText = change > 0 ? `+${change}` : `${change}`;

                    // Color formatting
                    let changeColor = 'black';
                    if (change > 0) changeColor = 'blue';
                    if (change < 0) changeColor = 'red';

                    // Buttons
                    let btnHtml = '';
                    // Permission Check: Hide for Guest/Student
                    const userRole = (App.Auth && App.Auth.user && App.Auth.user.role) ? App.Auth.user.role : 'guest';
                    const isRestricted = ['guest', 'student'].includes(userRole);

                    if (!isRestricted) {
                        if (log.is_initial) {
                            // For initial, pass current change (initial quantity) to delete
                            btnHtml = `
                                <button class="btn-mini btn-edit" style="background:#ffdd57; border:none; padding:4px 8px; cursor:pointer; margin-right:4px; border-radius:4px; font-size:11px;" onclick="App.Kits.editKitInitial(${kit.id}, '${log.log_date || ''}', ${change})">수정</button>
                                <button class="btn-mini btn-delete" style="background:#ff3860; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;" onclick="App.Kits.deleteKitInitial(${kit.id}, ${change})">삭제</button>
                            `;
                        } else {
                            const logTypeKey = log.log_type === 'usage' ? 'usage' : (log.log_type === 'purchase' ? 'purchase' : 'usage'); // Default to usage if unknown
                            btnHtml = `
                                <button class="btn-mini btn-edit" style="background:#ffdd57; border:none; padding:4px 8px; cursor:pointer; margin-right:4px; border-radius:4px; font-size:11px;" onclick="App.Kits.editKitLog(${kit.id}, ${log.id}, '${log.log_date || ''}', '${logTypeKey}', ${change})">수정</button>
                                <button class="btn-mini btn-delete" style="background:#ff3860; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;" onclick="App.Kits.deleteKitLog(${kit.id}, ${log.id}, ${change})">삭제</button>
                             `;
                        }
                    }

                    tr.innerHTML = `
                        <td class="col-date">${log.log_date || '-'}</td>
                        <td class="col-type">${typeText}</td>
                        <td><span style="color:${changeColor}; font-weight:bold;">${changeText}</span></td>
                        <td>${currentQuantity}</td>
                        <td style="text-align:center;">${btnHtml}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch (e) {
            console.error("Log fetch error:", e);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">기록을 불러오지 못했습니다.</td></tr>';
        }
    }

    function setupDetailFab(kit) {
        if (!App.Fab) return;

        App.Fab.setMenu([
            {
                icon: "inventory",
                label: "사용 등록",
                color: "#4caf50", // Green
                onClick: () => {
                    if (window.openStockModal) window.openStockModal(kit);
                }
            },
            {
                icon: "edit",
                label: "정보 수정",
                color: "#2196f3", // Blue
                onClick: () => {
                    if (window.openEditKitModal) window.openEditKitModal(kit);
                }
            },
            {
                icon: "delete",
                label: "키트 삭제",
                color: "#999", // Grey
                onClick: async () => {
                    if (confirm('정말 삭제하시겠습니까?')) {
                        await deleteKit(kit.id);
                        App.Router.go("kits");
                    }
                }
            }
        ]);
        App.Fab.setVisibility(true);
    }

    async function renderInlineChemInfo(casInput, kitChemData = null) {
        const cas = casInput ? casInput.trim() : '';
        const container = document.getElementById('kit-chem-detail-container');
        const title = document.getElementById('kit-chem-detail-title');
        const content = document.getElementById('kit-chem-detail-content');

        if (!container || !title || !content) return;

        container.style.display = 'block';
        title.textContent = `${cas} 상세 정보 로딩 중...`;
        content.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">데이터를 불러오는 중입니다...</div>';

        try {
            let substanceData = null;
            let error = null;

            // 1. Try searching by CAS in Substance table
            if (cas) {
                const result = await supabase
                    .from('Substance')
                    .select(`
                        id, substance_name, cas_rn, molecular_formula, molecular_mass, chem_name_kor,
                        Properties ( name, property ),
                        MSDS ( section_number, content )
                    `)
                    .ilike('cas_rn', `%${cas}%`) // Use ilike for robustness
                    .limit(1);

                if (result.data && result.data.length > 0) {
                    substanceData = result.data[0];
                }
                // Don't throw error yet, try fallbacks
            }

            // 1.5. If kitChemData is missing (not passed), try fetching directly from kit_chemicals
            if (!substanceData && !kitChemData) {
                const { data: directKitChem } = await supabase
                    .from('kit_chemicals')
                    .select('cas_no, name_ko, name_en, msds_data, formula, molecular_weight')
                    .eq('cas_no', cas)
                    .maybeSingle();

                if (directKitChem) {
                    console.log(`Fetched kit_chemicals direct for ${cas}`);
                    kitChemData = directKitChem;
                }
            }

            // 2. Fallback: Use kit_chemicals data if Substance query failed or returned no data
            if (!substanceData && kitChemData) {
                console.log(`Using kit_chemicals data for ${cas}`);

                let msdsPayload = kitChemData.msds_data || [];
                if (typeof msdsPayload === 'string') {
                    try { msdsPayload = JSON.parse(msdsPayload); } catch (e) {
                        console.warn('Failed to parse MSDS JSON', e);
                        msdsPayload = [];
                    }
                }

                let msdsSections = [];
                let experimentalProps = [];

                if (msdsPayload && typeof msdsPayload === 'object' && !Array.isArray(msdsPayload)) {
                    // New structure: { sections: [], experimental_properties: [] }
                    msdsSections = msdsPayload.sections || [];
                    experimentalProps = msdsPayload.experimental_properties || [];
                } else {
                    // Old structure: []
                    msdsSections = Array.isArray(msdsPayload) ? msdsPayload : [];
                }

                substanceData = {
                    cas_rn: kitChemData.cas_no || cas,
                    chem_name_kor: kitChemData.name_ko,
                    substance_name: kitChemData.name_en,
                    molecular_formula: kitChemData.formula,
                    molecular_mass: kitChemData.molecular_weight,
                    MSDS: msdsSections,
                    Properties: experimentalProps.map(p => ({
                        name: p.name,
                        property: p.property
                    }))
                };
            }

            // 3. Fallback: Try searching by Name in Substance table
            if (!substanceData && kitChemData) {
                const nameKo = kitChemData.name_ko;
                const nameEn = kitChemData.name_en;

                if (nameKo || nameEn) {
                    console.log(`CAS lookup failed for ${cas}. Trying name lookup: ${nameKo || nameEn}`);
                    const query = supabase
                        .from('Substance')
                        .select(`
                            id, substance_name, cas_rn, molecular_formula, molecular_mass, chem_name_kor,
                            Properties ( name, property ),
                            MSDS ( section_number, content )
                        `)
                        .limit(1);

                    if (nameKo) {
                        query.ilike('chem_name_kor', `%${nameKo}%`);
                    } else if (nameEn) {
                        query.ilike('substance_name', `%${nameEn}%`);
                    }

                    const result = await query;
                    if (result.data && result.data.length > 0) {
                        substanceData = result.data[0];
                    }
                }
            }

            if (error) {
                throw error;
            }

            const substance = substanceData;

            if (!substance) {
                content.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">해당 물질의 상세 정보(MSDS)가 데이터베이스에 없습니다.</div>';
                title.textContent = `${cas} (정보 없음)`;
                return;
            }

            const korName = substance.chem_name_kor || substance.substance_name || cas;
            title.textContent = `${korName} (${cas})`;

            const formatWithUnit = (val, unit = "") => {
                if (val === null || val === undefined || val === "" || val === "-") return "-";
                const n = Number(val);
                if (!Number.isFinite(n)) return String(val);
                return `${n}${unit}`;
            };
            const formatTemp = (val) => formatWithUnit(val, " C");
            const formatDensity = (val) => {
                if (val === null || val === undefined || val === "" || val === "-") return "-";
                const raw = String(val).trim();
                if (!raw) return "-";
                if (raw.includes("@")) {
                    const [valuePart, ...rest] = raw.split("@");
                    const value = valuePart.trim();
                    const temp = rest.join("@").trim();
                    return temp ? `${value} <span style="font-size: 10px;">@ ${temp}</span>` : value || "-";
                }
                const n = Number(raw);
                if (Number.isFinite(n)) return `${n} g/mL`;
                return raw;
            };

            const propsList = substance.Properties || [];
            const getPropVal = (nameKey) => {
                const found = propsList.find((p) => p.name && p.name.toLowerCase().includes(nameKey.toLowerCase()));
                return found ? found.property : '-';
            };

            let html = `
                <div style="margin-bottom: 20px; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                    <h5 style="margin: 0; padding: 10px; background: #f9f9f9; font-size: 15px; color: #333; border-bottom: 1px solid #eee;">기본 특성</h5>
                    
                    <div class="msds-row">
                        <div class="msds-header">화학식</div>
                        <div class="msds-content">${substance.molecular_formula || '-'}</div>
                        <div class="msds-header">화학식량</div>
                        <div class="msds-content">${substance.molecular_mass || '-'}</div>
                    </div>
                    
                    <div class="msds-row">
                        <div class="msds-header">끓는점</div>
                        <div class="msds-content">${formatTemp(getPropVal('Boiling Point'))}</div>
                        <div class="msds-header">녹는점</div>
                        <div class="msds-content">${formatTemp(getPropVal('Melting Point'))}</div>
                    </div>

                    <div class="msds-row">
                        <div class="msds-header">밀도</div>
                        <div class="msds-content">${formatDensity(getPropVal('Density'))}</div>
                    </div>
                </div>
            `;

            html += `<h5 style="margin: 0 0 10px 0; font-size: 15px; color: #333;">MSDS 정보</h5>`;
            html += `<div class="accordion" id="inline-msds-accordion">`;

            const msdsData = substance.MSDS || [];

            html += msdsTitles.map((title, index) => {
                const sectionNum = index + 1;
                const sectionData = msdsData.find(d => d.section_number === sectionNum);
                let contentHtml = '<p class="text-gray-500 italic p-4">내용 없음</p>';

                if (sectionData && sectionData.content) {
                    if (sectionNum === 2 && sectionData.content.includes("|||그림문자|||")) {
                        const rows = sectionData.content.split(";;;");
                        const rowsHtml = rows.map(row => {
                            const parts = row.split("|||");
                            if (parts.length >= 3) {
                                const [no, name, detail] = parts;

                                if (name.trim() === "그림문자") {
                                    const ghsCodes = detail.trim().split(/\s+/).filter(s => s.endsWith(".gif"));
                                    if (ghsCodes.length > 0) {
                                        const ghsTableRows = ghsCodes.map(code => {
                                            const match = code.match(/GHS(\d+)\.gif/i);
                                            if (match) {
                                                const num = match[1];
                                                const imgUrl = `https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${num}.gif`;
                                                const fullDesc = ghsMapping[num] || "분류 정보 없음";
                                                const lines = fullDesc.split("\n");
                                                const titleLine = lines[0];
                                                const detailLines = lines.slice(1).join("<br>");

                                                let korName = titleLine;
                                                let engName = "";
                                                const matchTitle = titleLine.match(/^(.*)\((.*)\)$/);
                                                if (matchTitle) {
                                                    korName = matchTitle[1].trim();
                                                    engName = matchTitle[2].trim();
                                                }

                                                return `<tr class="ghs-row"><td class="ghs-cell-image"><img src="${imgUrl}" alt="${code}" class="ghs-image"><div class="ghs-name-kor">${korName}</div><div class="ghs-name-eng">${engName}</div></td><td class="ghs-cell-desc">${detailLines}</td></tr>`;
                                            }
                                            return "";
                                        }).join("");

                                        return `
                                            <div class="msds-row">
                                                <div class="msds-header">${no} ${name}</div>
                                                <div class="msds-content msds-no-padding"><table class="ghs-table">${ghsTableRows}</table></div>
                                            </div>
                                        `;
                                    }
                                }

                                return `
                                    <div class="msds-row">
                                        <div class="msds-header">${no} ${name}</div>
                                        <div class="msds-content">${detail}</div>
                                    </div>
                                `;
                            } else {
                                return `<div class="msds-simple-content">${row}</div>`;
                            }
                        }).join("");
                        contentHtml = `<div class="msds-table-container">${rowsHtml}</div>`;
                    } else if (sectionData.content.includes("|||")) {
                        const rows = sectionData.content.split(";;;");
                        const rowsHtml = rows.map(row => {
                            const parts = row.split("|||");
                            if (parts.length >= 3) {
                                const [no, name, detail] = parts;
                                return `
                                    <div class="msds-row">
                                        <div class="msds-header">${no} ${name}</div>
                                        <div class="msds-content">${detail}</div>
                                    </div>
                                `;
                            } else {
                                return `<div class="msds-simple-content">${row}</div>`;
                            }
                        }).join("");
                        contentHtml = `<div class="msds-table-container">${rowsHtml}</div>`;
                    } else {
                        contentHtml = `<div class="msds-simple-content" style="padding: 10px; white-space: pre-wrap;">${sectionData.content.replace(/;;;/g, '\n').replace(/\|\|\|/g, ': ')}</div>`;
                    }
                }

                return `
                    <div class="accordion-item">
                        <button class="accordion-header" onclick="this.parentElement.classList.toggle('active')">
                            ${title}
                        </button>
                        <div class="accordion-content">
                            ${contentHtml}
                        </div>
                    </div>
                `;
            }).join('');

            html += `</div>`;

            content.innerHTML = html;
        } catch (e) {
            console.error(`Error loading chemical info for ${cas}:`, e);
            content.innerHTML = `<div style="color: red; padding: 20px;">정보를 불러오는 중 오류가 발생했습니다.<br><small>${e.message}</small></div>`;
        }
    }

    // ---- Register/Edit Modal (Deprecated) ----
    function setupRegisterModal() {
        // Modal removed. Replaced by Page.
    }

    // Redirects to Page
    Kits.openRegisterModal = () => {
        App.Router.go("kitForm");
    };

    window.openEditKitModal = (kit) => {
        App.Router.go("kitForm", { id: kit.id });
    };

    // ---- Stock Modal ----
    function setupStockModal() {
        if (document.getElementById('modal-kit-stock')) return;

        const modalHtml = `
            <div id="modal-kit-stock" class="modal-overlay" style="display: none; z-index: 1200;">
                <div class="modal-content stock-modal-content">
                    <h3 id="stock-kit-name" class="modal-title" style="text-align: center; margin: 0 0 15px 0; padding-bottom: 15px; border-bottom: 1px solid #eee;"></h3>

                    <form id="form-kit-stock">
                        <!-- Hidden Input for Type -->
                        <input type="hidden" id="stock-type" value="usage">

                        <div class="form-group">
                            <label style="margin-bottom:8px; display:block; color:#666; font-size:13px;">등록 유형</label>
                            <div class="stock-toggle-group" style="display:flex; gap:0; border:1px solid #ddd; border-radius:6px; overflow:hidden;">
                                <button type="button" class="stock-toggle-btn active" data-type="usage" style="flex:1; padding:12px; border:none; background:#ffebee; cursor:pointer; font-weight:bold; color:#c62828; transition:all 0.2s;">사용 (차감)</button>
                                <button type="button" class="stock-toggle-btn" data-type="purchase" style="flex:1; padding:12px; border:none; background:#f9f9f9; cursor:pointer; font-weight:bold; color:#aaa; border-left:1px solid #ddd; transition:all 0.2s;">구입 (추가)</button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="stock-amount" id="label-stock-amount" style="color:#c62828;">사용 수량 (몇 개를 썼나요?)</label>
                            <input type="number" id="stock-amount" class="form-input" min="1" value="1" required style="font-size:16px; padding:12px;">
                        </div>

                        <div class="form-group">
                            <label for="stock-date">날짜</label>
                            <input type="date" id="stock-date" class="form-input" required>
                        </div>

                        <div class="modal-actions" style="margin-top:20px; display:flex; gap:10px;">
                            <button type="button" id="btn-cancel-stock" class="btn-cancel" style="flex:1;">취소</button>
                            <button type="submit" id="btn-save-stock" class="btn-primary" style="flex:1;">저장</button>
                        </div>
                    </form>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('modal-kit-stock');
        const form = document.getElementById('form-kit-stock');
        const btnCancel = document.getElementById('btn-cancel-stock');
        const hiddenType = document.getElementById('stock-type');
        const toggleBtns = modal.querySelectorAll('.stock-toggle-btn');
        const amountLabel = document.getElementById('label-stock-amount');
        let currentKit = null;

        // Toggle Logic
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                updateToggleState(type);
            });
        });

        function updateToggleState(type) {
            hiddenType.value = type;

            toggleBtns.forEach(btn => {
                const btnType = btn.dataset.type;
                if (btnType === type) {
                    btn.classList.add('active');
                    // Active Styles
                    if (type === 'usage') {
                        btn.style.background = '#ffebee'; // Light Red
                        btn.style.color = '#c62828';
                        amountLabel.textContent = "사용 수량 (몇 개를 썼나요?)";
                        amountLabel.style.color = '#c62828';
                    } else {
                        btn.style.background = '#e3f2fd'; // Light Blue
                        btn.style.color = '#1565c0';
                        amountLabel.textContent = "구입 수량 (몇 개를 샀나요?)";
                        amountLabel.style.color = '#1565c0';
                    }
                } else {
                    btn.classList.remove('active');
                    // Inactive Styles
                    btn.style.background = '#f9f9f9';
                    btn.style.color = '#aaa';
                }
            });
        }

        btnCancel.addEventListener('click', () => {
            modal.style.display = 'none';
            if (App.Fab && typeof App.Fab.show === 'function') App.Fab.show(); // Restore FAB if needed
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentKit) return;

            const type = hiddenType.value;
            const amount = parseInt(document.getElementById('stock-amount').value, 10);
            const date = document.getElementById('stock-date').value;

            await handleStockChange(currentKit, type, amount, date);
            modal.style.display = 'none';
        });

        window.openStockModal = (kit) => {
            currentKit = kit;
            document.getElementById('stock-kit-name').textContent = kit.kit_name;

            // Reset to Usage default
            hiddenType.value = 'usage';
            document.getElementById('stock-amount').value = 1;
            document.getElementById('stock-date').valueAsDate = new Date();

            // Trigger click on Usage button to reset styles
            const usageBtn = modal.querySelector('.stock-toggle-btn[data-type="usage"]');
            if (usageBtn) usageBtn.click();

            modal.style.display = 'flex';
        };
    }

    async function handleStockChange(kit, type, amount, date) {
        let change = 0;
        if (type === 'usage') {
            change = -amount;
        } else {
            change = amount;
        }

        const newQuantity = kit.quantity + change;

        if (newQuantity < 0) {
            alert('재고가 부족합니다.');
            return;
        }

        const { data: result, error: logError } = await supabase.functions.invoke('usage-manager', {
            body: {
                action: 'register_kit_usage',
                user_kit_id: kit.id,
                user_id: App.Auth.user.id,
                amount: amount,
                date: date,
                type: type
            }
        });

        if (logError) {
            console.error('Failed to register usage via Edge Function:', logError);
            let errMsg = logError.message;
            if (logError.context && logError.context.error) errMsg = logError.context.error;
            alert('재고 수정 및 로그 저장에 실패했습니다: ' + errMsg);
            return;
        }

        alert('저장되었습니다.');

        // Refresh
        if (document.getElementById('kit-detail-page-container')) {
            // Update local kit object and reload
            kit.quantity = newQuantity;
            Kits.loadDetail(kit.id);
        } else {
            Kits.loadUserKits();
        }
        if (newQuantity === 0) {
            await checkAndCleanupChemicals(kit.kit_name);
        }
    }

    function isCasNo(str) {
        return /^\d{2,7}-\d{2}-\d$/.test(str);
    }

    async function processKitChemicals(kitName) {
        const item = catalog.find(c => c.kit_name === kitName);
        if (!item || !item.kit_cas) return;

        const casList = item.kit_cas.split(',').map(s => s.trim().replace(/"/g, ''));

        for (const cas of casList) {
            const { data } = await supabase
                .from('kit_chemicals')
                .select('cas_no')
                .eq('cas_no', cas)
                .single();

            if (!data) {
                if (isCasNo(cas)) {
                    console.log(`Fetching info for ${cas}...`);
                    try {
                        await supabase.functions.invoke('kit-casimport', {
                            body: { cas_rn: cas }
                        });
                    } catch (e) {
                        console.error(`Failed to import ${cas}: `, e);
                    }
                } else {
                    console.log(`Inserting manual entry for ${cas}...`);
                    try {
                        await supabase.from('kit_chemicals').insert({
                            cas_no: cas,
                            name_ko: cas,
                            name_en: null,
                            msds_data: null
                        });
                    } catch (e) {
                        console.error(`Failed to insert manual entry ${cas}: `, e);
                    }
                }
            }
        }
    }

    async function checkAndCleanupChemicals(kitName) {
        const item = catalog.find(c => c.kit_name === kitName);
        if (!item || !item.kit_cas) return;
        const targetCasList = item.kit_cas.split(',').map(s => s.trim().replace(/"/g, ''));

        const { data: activeKits } = await supabase
            .from('user_kits')
            .select('kit_name')
            .gt('quantity', 0);

        if (!activeKits) return;

        const activeCasSet = new Set();
        activeKits.forEach(k => {
            const catItem = catalog.find(c => c.kit_name === k.kit_name);
            if (catItem && catItem.kit_cas) {
                catItem.kit_cas.split(',').forEach(cas => activeCasSet.add(cas.trim().replace(/"/g, '')));
            }
        });

        const toRemove = targetCasList.filter(cas => !activeCasSet.has(cas));

        if (toRemove.length > 0) {
            console.log(`Cleaning up unused chemicals: ${toRemove.join(', ')} `);
            await supabase
                .from('kit_chemicals')
                .delete()
                .in('cas_no', toRemove);
        }
    }


    // ================================================================
    // 🪵 Log Management (Edit / Delete)
    // ================================================================

    // --- Normal Logs ---
    Kits.editKitLog = function (kitId, logId, date, type, change) { // change is signed
        const tr = document.getElementById(`kit-log-row-${logId}`);
        if (!tr) return;

        const absChange = Math.abs(change);

        tr.innerHTML = `
            <td><input type="date" id="edit-log-date-${logId}" value="${date}" style="width:110px;"></td>
            <td>
                <select id="edit-log-type-${logId}" style="width:80px;">
                    <option value="usage" ${type === 'usage' ? 'selected' : ''}>사용</option>
                    <option value="purchase" ${type === 'purchase' ? 'selected' : ''}>구입</option>
                </select>
            </td>
            <td>
                 <!-- Edit Absolute Amount -->
                 <input type="number" id="edit-log-amount-${logId}" value="${absChange}" min="1" style="width:60px;">
            </td>
            <td>-</td> <!-- Current Qty is irrelevant during edit -->
            <td style="white-space:nowrap;">
                <button class="btn-mini btn-save" style="background:#4caf50; color:white; border:none; padding:4px 8px; cursor:pointer; margin-right:4px; border-radius:4px; font-size:11px;" onclick="App.Kits.saveKitLog(${kitId}, ${logId}, ${change})">저장</button>
                <button class="btn-mini btn-cancel" style="background:#ccc; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;" onclick="App.Kits.cancelKitEdit(${kitId})">취소</button>
            </td>
        `;
    };

    Kits.saveKitLog = async function (userKitId, logId, oldChangeAmount) {
        const dateInput = document.getElementById(`edit-log-date-${logId}`);
        const typeSelect = document.getElementById(`edit-log-type-${logId}`);
        const amountInput = document.getElementById(`edit-log-amount-${logId}`);

        if (!dateInput || !typeSelect || !amountInput) return;

        const newDate = dateInput.value;
        const type = typeSelect.value;
        const newAmount = parseInt(amountInput.value);

        if (!newDate || isNaN(newAmount) || newAmount <= 0) {
            alert('값을 확인하세요.');
            return;
        }

        try {
            const { data, error: logError } = await App.supabase.functions.invoke('usage-manager', {
                body: {
                    action: 'update_kit_log',
                    log_id: logId,
                    user_kit_id: userKitId,
                    user_id: App.Auth.user.id,
                    amount: newAmount,
                    date: new Date(newDate).toISOString(),
                    type: type
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

            alert('수정되었습니다.');
            Kits.loadDetail(kitId);

        } catch (e) {
            console.error(e);
            alert('수정 실패: ' + e.message);
        }
    };

    Kits.deleteKitLog = async function (userKitId, logId) {
        if (!confirm('정말 삭제하시겠습니까? 재고가 원복됩니다.')) return;

        try {
            const { data, error: logError } = await App.supabase.functions.invoke('usage-manager', {
                body: {
                    action: 'delete_kit_log',
                    log_id: logId,
                    user_kit_id: userKitId
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

            alert('삭제되었습니다.');
            Kits.loadDetail(userKitId);
        } catch (e) {
            console.error(e);
            alert('삭제 실패: ' + e.message);
        }
    };

    // --- Initial Registration ---
    Kits.editKitInitial = function (kitId, date, currentInitialAmount) {
        const tr = document.getElementById('kit-log-row-initial');
        if (!tr) return;

        tr.innerHTML = `
            <td><input type="date" id="edit-initial-date" value="${date}" style="width:110px;"></td>
            <td>최초 등록 (고정)</td>
            <td>
                 <!-- Edit Absolute Amount -->
                 <input type="number" id="edit-initial-amount" value="${currentInitialAmount}" min="0" style="width:60px;">
            </td>
            <td>-</td>
            <td style="white-space:nowrap;">
                <button class="btn-mini btn-save" style="background:#4caf50; color:white; border:none; padding:4px 8px; cursor:pointer; margin-right:4px; border-radius:4px; font-size:11px;" onclick="App.Kits.saveKitInitial(${kitId}, ${currentInitialAmount})">저장</button>
                <button class="btn-mini btn-cancel" style="background:#ccc; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;" onclick="App.Kits.cancelKitEdit(${kitId})">취소</button>
            </td>
        `;
    };

    Kits.saveKitInitial = async function (kitId, oldInitialAmount) {
        const dateInput = document.getElementById('edit-initial-date');
        const amountInput = document.getElementById('edit-initial-amount');
        if (!dateInput || !amountInput) return;

        const newDate = dateInput.value;
        const newAmount = parseInt(amountInput.value);

        if (!newDate || isNaN(newAmount) || newAmount < 0) {
            alert('값을 확인하세요.');
            return;
        }

        // Change in initial amount affects Total Quantity directly
        // Diff = 10 - 5 = +5. Total increases by 5.
        const diff = newAmount - oldInitialAmount;

        try {
            const { data: kit, error: kitError } = await supabase.from('user_kits').select('quantity').eq('id', kitId).single();
            if (kitError) throw kitError;

            const newTotalQty = kit.quantity + diff;
            if (newTotalQty < 0) {
                alert('변경 시 총 수량이 0보다 작아집니다.');
                return;
            }

            const { error: updateError } = await supabase
                .from('user_kits')
                .update({
                    purchase_date: newDate,
                    quantity: newTotalQty
                })
                .eq('id', kitId);

            if (updateError) throw updateError;

            alert('최초 등록 정보가 수정되었습니다.');
            Kits.loadDetail(kitId);

        } catch (e) {
            console.error(e);
            alert('삭제 실패: ' + e.message);
        }
    };

    Kits.deleteKitInitial = async function (kitId, oldInitialAmount) {
        // Deleting initial -> Amount becomes 0? Or resets purchase date?
        // Usually, removing initial means setting quantity to 0, or just re-setting it.
        // Let's assume it sets quantity to 0 + (usage). Actually if we delete 'Initial', we might be deleting the kit.
        // But here, let's just say we set it to 0.
        if (!confirm('최초 등록 내역을 삭제하면 초기 수량이 0이 됩니다. 계속하시겠습니까?')) return;

        try {
            const { data: kit, error: kitError } = await supabase.from('user_kits').select('quantity').eq('id', kitId).single();
            if (kitError) throw kitError;

            // New Qty = Current - Initial
            const newTotalQty = kit.quantity - oldInitialAmount;
            if (newTotalQty < 0) {
                alert('삭제 시 총 수량이 0보다 작아져서 불가능합니다.');
                return;
            }

            const { error: updateError } = await supabase
                .from('user_kits')
                .update({
                    quantity: newTotalQty
                    // purchase_date? maybe keep it
                })
                .eq('id', kitId);

            if (updateError) throw updateError;
            alert('초기 수량이 삭제(0) 되었습니다.');
            Kits.loadDetail(kitId);

        } catch (e) {
            console.error(e);
            alert('삭제 실패: ' + e.message);
        }
    };

    Kits.cancelKitEdit = function (kitId) {
        Kits.loadDetail(kitId); // Just reload to reset view
    };


    // Export
    window.App = window.App || {};
    window.App.Kits = Kits;

    // Auto Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Kits.init());
    } else {
        Kits.init();
    }
})();
