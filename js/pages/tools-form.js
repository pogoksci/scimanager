(function () {
    const supabase = App.supabase;

    let currentMode = 'create'; // 'create' or 'edit'
    let currentId = null;
    let photoFiles = { file: null, blob: null }; // To store selected/captured photo

    // DOM Elements Cache
    let form, sectionBtns, periodBtns, categoryGroup, codeInput, nameInput,
        noInput, dateInput, usingClassGroup, recommendedGroup, outStandardGroup,
        stdBaseInput, stdUnitSelect, stdTargetInput, reqInput, stockInput, propInput,
        previewImg, videoStream, canvas, photoContainer;

    let datePickerInterface = null; // ✅ Date Picker Interface

    const CATEGORIES_AID = [
        '물리학', '화학', '생명과학', '지구과학',
        '공통(기자재)', '공통-일반교구', '공통-측정교구', '안전장구'
    ];
    const CATEGORIES_FACILITY = [
        '안전설비', '일반설비'
    ];

    async function init(id = null) {
        console.log("ToolsForm init", id);
        currentId = id;
        currentMode = id ? 'edit' : 'create';

        cacheElements();
        bindEvents();

        // Initialize UI State
        resetForm();

        if (currentMode === 'edit') {
            document.querySelector('#tools-form-title').textContent = "교구/설비 정보";
            await loadData(id);
        } else {
            // New Registration: Auto Generate No
            await generateAutoNo();
            await generateAutoNo();
            document.querySelector('#tools-form-title').textContent = "교구/설비 등록";
            // dateInput.valueAsDate = new Date(); // Handled by bindDateInput default or manually below if needed
            // Default to today for Create mode?
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (datePickerInterface) datePickerInterface.setDate(todayStr);

            // Storage Selector Init (Create Mode)
            if (App.StorageSelector) {
                const selectorContainer = document.getElementById("tools-storage-selector");
                if (selectorContainer) selectorContainer.innerHTML = "";
                App.StorageSelector.init("tools-storage-selector", {}, "EQUIPMENT");
            }
        }
    }

    function cacheElements() {
        form = document.getElementById('tools-form');
        sectionBtns = document.getElementById('tools-section-group');
        periodBtns = document.getElementById('stock-period-group');
        categoryGroup = document.getElementById('tools-category-group');
        codeInput = document.getElementById('tools_code');
        nameInput = document.getElementById('tools_name');
        noInput = document.getElementById('tools_no');
        dateInput = document.getElementById('purchase_date');
        usingClassGroup = document.getElementById('using-class-group');
        recommendedGroup = document.getElementById('recommended-group');
        outStandardGroup = document.getElementById('out-of-standard-group');

        stdBaseInput = document.getElementById('std_base_count');
        stdUnitSelect = document.getElementById('std_unit');
        stdTargetInput = document.getElementById('std_target_count');
        reqInput = document.getElementById('requirement');
        stockInput = document.getElementById('stock');
        propInput = document.getElementById('proportion');

        previewImg = document.getElementById('tools-preview-img');
        videoStream = document.getElementById('tools-camera-stream');
        canvas = document.getElementById('tools-camera-canvas');
        photoContainer = document.querySelector('#tools-form-page .photo-container');
    }

    function resetForm() {
        form.reset();
        photoFiles = { file: null, blob: null };
        resetPhotoUI();

        // Default Selections
        setActiveBtn(sectionBtns, '교구'); // Default to Teaching Aid
        updateUIForSection('교구');

        setActiveBtn(periodBtns, '과학(2025)');
        setActiveBtn(usingClassGroup, '전학년'); // Can be multi? Code logic handles toggle
        setActiveBtn(recommendedGroup, '필수');
        setActiveBtn(outStandardGroup, '기준내');

        // Reset Category to first default? Or none?
        // Let's render categories for '교구'
        renderCategories('교구');
    }

    function bindEvents() {
        // Date Picker Binding
        if (App.Utils && App.Utils.bindDateInput) {
            // Initial date will be set by loadData or create logic
            datePickerInterface = App.Utils.bindDateInput({
                yearId: "tool-date-year",
                monthId: "tool-date-month",
                dayId: "tool-date-day",
                hiddenId: "purchase_date",
                btnId: "btn-open-calendar-tool",
                initialDate: null // Will be set later
            });
        }

        // Button Group Click Delegation
        setupBtnGroup(sectionBtns, (val) => updateUIForSection(val));
        setupBtnGroup(periodBtns);
        setupBtnGroup(recommendedGroup);
        setupBtnGroup(outStandardGroup);

        // Using Class (Multi-select)
        usingClassGroup.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                e.preventDefault();
                // Toggle logic
                e.target.classList.toggle('active');
                // Ensure at least one? Or allow empty?
            }
        });

        // Category Group Delegation (Single select)
        categoryGroup.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                e.preventDefault();
                Array.from(categoryGroup.children).forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }
        });

        // Calculation Events
        reqInput.addEventListener('input', calculateProportion);
        stockInput.addEventListener('input', calculateProportion);

        // Photo Events
        document.getElementById('tools-photo-btn').addEventListener('click', () => document.getElementById('tools-photo-input').click());
        document.getElementById('tools-photo-input').addEventListener('change', handleFileSelect);

        document.getElementById('tools-camera-btn').addEventListener('click', startCamera);
        document.getElementById('tools-camera-confirm-btn').addEventListener('click', takePhoto);
        document.getElementById('tools-camera-cancel-btn').addEventListener('click', stopCamera);
        document.getElementById('tools-camera-input').addEventListener('change', handleFileSelect);


        // Submit
        form.addEventListener('submit', handleSubmit);

        // Cancel
        document.getElementById('btn-cancel-tools').addEventListener('click', () => {
            if (currentMode === 'edit' && currentId) {
                App.Router.go('teachingToolsDetail', { id: currentId });
            } else {
                App.Router.go('teachingTools');
            }
        });
    }

    function setupBtnGroup(group, callback) {
        group.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                e.preventDefault();
                setActiveBtn(group, e.target.getAttribute('data-value'));
                if (callback) callback(e.target.getAttribute('data-value'));
            }
        });
    }

    function setActiveBtn(group, value) {
        Array.from(group.children).forEach(btn => {
            if (btn.getAttribute('data-value') === value) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    function getActiveBtnValue(group) {
        const active = group.querySelector('.active');
        return active ? active.getAttribute('data-value') : null;
    }

    function getMultiActiveBtnValues(group) {
        return Array.from(group.querySelectorAll('.active')).map(b => b.getAttribute('data-value')).join(',');
    }

    function calculateProportion() {
        const req = parseFloat(reqInput.value) || 0;
        const stock = parseFloat(stockInput.value) || 0;
        if (req === 0) {
            propInput.value = '0.0';
            return;
        }
        const p = stock / req;
        propInput.value = p.toFixed(3); // Display as ratio with 3 decimals
    }

    // --- Dynamic UI Logic ---
    function updateUIForSection(section) {
        // 1. Labels
        if (section === '교구') {
            document.getElementById('label-tools-code').textContent = '교구코드';
            document.getElementById('label-tools-name').textContent = '교구명 *';
            document.getElementById('label-requirement').textContent = '기준량';
        } else {
            document.getElementById('label-tools-code').textContent = '종목코드';
            document.getElementById('label-tools-name').textContent = '설비종목명';
            document.getElementById('label-requirement').textContent = '소요수량';
        }

        // 2. Categories
        renderCategories(section);

        // 3. Auto No Regenerate if Create Mode? 
        // No relies on Max(tools_no). Usually unique across table, but user might want gapless within section?
        // User said: " 순번(no)은 db에 등록되어 있는 순번을 검색해서 숫자가 가장큰 것의 다음 숫자로 자동 입력해줘."
        // Doesn't specify per section. I'll assume global tools_no max + 1.
        if (currentMode === 'create') generateAutoNo();
    }

    function renderCategories(section) {
        categoryGroup.innerHTML = '';
        const list = section === '교구' ? CATEGORIES_AID : CATEGORIES_FACILITY;

        categoryGroup.style.gridTemplateColumns = section === '교구' ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)';

        list.forEach(cat => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = cat;
            btn.setAttribute('data-value', cat);
            // Default first one? or none.
            categoryGroup.appendChild(btn);
        });
    }

    async function generateAutoNo() {
        const { data, error } = await supabase
            .from('tools')
            .select('tools_no')
            .order('tools_no', { ascending: false })
            .limit(1);

        if (error) {
            console.error("AutoNo Error", error);
            noInput.value = 1;
            return;
        }
        const max = data && data.length > 0 ? data[0].tools_no : 0;
        noInput.value = max + 1;
    }

    // --- Standard Amount Parsing ---
    function parseStandardAmount(str) {
        // Format: "4 학생(명)당 1"
        // Regex: /^(\d+)\s+(.+?)당\s+(\d+)$/
        if (!str) return;
        const match = str.match(/^(\d+)\s+(.+?)당?\s+(\d+)$/);
        if (match) {
            stdBaseInput.value = match[1];
            stdUnitSelect.value = match[2]; // "학생(명)" or "실험(실)"
            stdTargetInput.value = match[3];
        }
    }

    function buildStandardAmount() {
        const base = stdBaseInput.value;
        const unit = stdUnitSelect.value;
        const target = stdTargetInput.value;
        if (base && unit && target) {
            return `${base} ${unit}당 ${target}`;
        }
        return null;
    }

    // --- Photo Logic ---
    function dataURLtoBlob(dataurl) {
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const resized = await App.Camera.processImage(ev.target.result);
                const blob = App.Utils.base64ToBlob(resized.base64_320);
                
                photoFiles.blob = blob;
                photoFiles.file = null;

                previewImg.src = resized.base64_320;
                previewImg.style.display = 'block';
                if (photoContainer) {
                    const ph = photoContainer.querySelector('.placeholder-text');
                    if (ph) ph.style.display = 'none';
                }
            } catch (err) {
                console.error("Failed to process selected file:", err);
                alert("이미지 처리 중 오류가 발생했습니다.");
            }
        };
        reader.readAsDataURL(file);
    }

    let streamObj = null;
    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("이 브라우저에서는 카메라를 사용할 수 없습니다. (보안 연결 HTTPS 필요)");
            document.getElementById('tools-camera-input').click();
            return;
        }

        try {
            const res = await App.Camera.getNextStream(streamObj);
            streamObj = res.stream;
        } catch (err) {
            console.warn("Camera init failed:", err);

            // Analyze the error
            let msg = "카메라를 실행할 수 없습니다.\n파일 선택창을 엽니다.";

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg = "카메라 접근 권한이 거부되었습니다.\n브라우저 설정에서 카메라 권한을 허용해주세요.";
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                // Double check with enumerateDevices (optional but helps confirm)
                const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
                const hasVideo = devices.some(d => d.kind === 'videoinput');
                if (!hasVideo) {
                    msg = "연결된 카메라를 찾을 수 없습니다.\n하드웨어 연결을 확인해주세요.";
                } else {
                    msg = "카메라 장치를 찾았으나 접근할 수 없습니다.\n다른 앱이 사용 중인지 확인해주세요.";
                }
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                msg = "카메라를 읽을 수 없습니다.\n다른 프로그램(Zoom 등)에서 사용 중일 수 있습니다.";
            }

            alert(msg);

            // Finally fallback
            document.getElementById('tools-camera-input').click();
            return;
        }

        // Success
        previewImg.style.display = 'none';
        videoStream.srcObject = streamObj;
        videoStream.style.display = 'block';

        togglePhotoButtons(true);
    }

    function stopCamera() {
        if (streamObj) {
            streamObj.getTracks().forEach(track => track.stop());
            streamObj = null;
        }
        videoStream.style.display = 'none';
        togglePhotoButtons(false);
        // Restore preview if exists
        if (previewImg.src && previewImg.src !== window.location.href) {
            previewImg.style.display = 'block';
        }
    }
    async function takePhoto() {
        if (!streamObj) return;
        const base64 = App.Camera.captureFrame(videoStream, canvas);
        if (!base64) return;

        // 1. Show original preview immediately and hide videoStream to prevent side-by-side flicker
        previewImg.src = base64;
        previewImg.style.display = 'block';
        if (photoContainer) {
            const ph = photoContainer.querySelector('.placeholder-text');
            if (ph) ph.style.display = 'none';
        }
        videoStream.style.display = 'none';

        // 2. Process resizing in background
        try {
            const resized = await App.Camera.processImage(base64);
            const blob = App.Utils.base64ToBlob(resized.base64_320);
            
            photoFiles.blob = blob;
            photoFiles.file = null;

            previewImg.src = resized.base64_320;
        } catch (err) {
            console.error("Failed to process captured photo:", err);
            // Fallback to original
            try {
                const blob = App.Utils.base64ToBlob(base64);
                photoFiles.blob = blob;
                photoFiles.file = null;
            } catch (blobErr) {
                console.error(blobErr);
            }
        }

        setTimeout(() => {
            stopCamera();
        }, 150);
    }

    function togglePhotoButtons(isCameraOn) {
        document.getElementById('tools-photo-btn').style.display = isCameraOn ? 'none' : 'inline-flex';
        document.getElementById('tools-camera-btn').style.display = isCameraOn ? 'none' : 'inline-flex';
        document.getElementById('tools-camera-confirm-btn').style.display = isCameraOn ? 'inline-flex' : 'none';
        document.getElementById('tools-camera-cancel-btn').style.display = isCameraOn ? 'inline-flex' : 'none';

        const switchBtn = document.getElementById('tools-camera-switch-btn');
        if (switchBtn) {
            switchBtn.style.display = (isCameraOn && App.Camera.hasMultipleCameras()) ? 'inline-flex' : 'none';
        }
    }

    function resetPhotoUI() {
        previewImg.src = '';
        previewImg.style.display = 'none';

        // Find placeholder text (might be hidden if previously image was there)
        const placeholder = photoContainer.querySelector('.placeholder-text');
        if (placeholder) placeholder.style.display = 'block';

        togglePhotoButtons(false);
    }


    // --- Load Data (Edit Mode) ---
    async function loadData(id) {
        document.querySelector('#tools-form-title').textContent = "교구/설비 정보";

        try {
            const { data, error } = await supabase.from('tools').select('*').eq('id', id).single();
            if (error) throw error;

            // Populate Fields
            setActiveBtn(sectionBtns, data.tools_section || '교구');
            updateUIForSection(data.tools_section || '교구'); // Render categories

            setActiveBtn(periodBtns, data.stock_period);
            setActiveBtn(categoryGroup, data.tools_category);

            codeInput.value = data.tools_code || '';
            nameInput.value = data.tools_name || '';
            document.getElementById('specification').value = data.specification || '';
            noInput.value = data.tools_no;
            // dateInput.value = data.purchase_date;
            if (datePickerInterface && data.purchase_date) {
                datePickerInterface.setDate(data.purchase_date);
            }

            // Multi-select Using Class
            if (data.using_class) {
                const classes = data.using_class.split(',');
                Array.from(usingClassGroup.children).forEach(btn => {
                    if (classes.includes(btn.getAttribute('data-value'))) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
            }

            parseStandardAmount(data.standard_amount);
            reqInput.value = data.requirement;
            stockInput.value = data.stock;
            calculateProportion();

            setActiveBtn(recommendedGroup, data.recommended);
            setActiveBtn(outStandardGroup, data.out_of_standard);

            // Location
            // Location
            if (App.StorageSelector) {
                App.StorageSelector.init("tools-storage-selector", data.location || {}, "EQUIPMENT");
            }

            // Photo
            if (data.image_url) {
                previewImg.src = data.image_url;
                previewImg.style.display = 'block';
                if (photoContainer) {
                    const ph = photoContainer.querySelector('.placeholder-text');
                    if (ph) ph.style.display = 'none';
                }
            }

        } catch (err) {
            console.error("Load Error", err);
            alert("데이터를 불러오는 중 오류가 발생했습니다.");
        }
    }


    // --- Submit ---
    async function handleSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById('btn-save-tools');
        btn.disabled = true;
        btn.textContent = "저장 중...";

        try {
            // Validation
            const section = getActiveBtnValue(sectionBtns);
            const period = getActiveBtnValue(periodBtns);
            const name = nameInput.value.trim();
            const category = getActiveBtnValue(categoryGroup);

            if (!section || !period || !name) {
                throw new Error("필수 항목(구분, 과목, 교구명)을 모두 입력해주세요.");
            }
            // Category might strictly be required? User didn't specify, but good practice.
            // "교구 등록 모달에서 필수로 입력을 받아야 하는 것은, 3가지(구분, 과목, 교구명)" -> OK.

            // Build Data
            const stdAmt = buildStandardAmount();
            const usingClass = getMultiActiveBtnValues(usingClassGroup);

            let richLocation = null;
            if (App.StorageSelector) {
                const locState = App.StorageSelector.getSelection();
                if (locState && locState.area_id && locState.cabinet_id) {
                    richLocation = locState; // Save as object (jsonb)
                }
            }

            // Photo Upload
            let imageUrl = null;
            const fileToUpload = photoFiles.file || photoFiles.blob;

            // If new file exists
            if (fileToUpload) {
                const fileExt = 'jpg'; // Default to jpg for simplicity or extract
                const fileName = `tool_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('tools-photo')
                    .upload(fileName, fileToUpload, { contentType: 'image/jpeg', upsert: true });

                if (uploadError) throw uploadError;

                const { data: publicData } = supabase.storage
                    .from('tools-photo')
                    .getPublicUrl(fileName);
                imageUrl = publicData.publicUrl;
            } else if (currentMode === 'edit') {
                // Keep existing
                if (previewImg.src && previewImg.src.startsWith('http')) {
                    imageUrl = previewImg.src;
                }
            }

            const payload = {
                tools_section: section,
                stock_period: period,
                tools_category: category,
                tools_name: name,
                tools_code: codeInput.value,
                specification: document.getElementById('specification').value,
                tools_no: parseInt(noInput.value) || 0,
                purchase_date: datePickerInterface ? datePickerInterface.getDateString() : dateInput.value,
                location: richLocation, // JSONB
                image_url: imageUrl,
                using_class: usingClass,
                standard_amount: stdAmt,
                requirement: parseFloat(reqInput.value) || 0,
                stock: parseFloat(stockInput.value) || 0,
                proportion: parseFloat(propInput.value) || 0,
                recommended: getActiveBtnValue(recommendedGroup),
                out_of_standard: getActiveBtnValue(outStandardGroup),
                updated_at: new Date()
            };

            if (currentMode === 'create') {
                const { error } = await supabase.from('tools').insert(payload);
                if (error) throw error;
                alert("등록되었습니다.");
            } else {
                const { error } = await supabase.from('tools').update(payload).eq('id', currentId);
                if (error) throw error;
                alert("수정되었습니다.");
            }

            // Go back to list
            App.Router.go('teachingTools');

        } catch (err) {
            console.error("Submit Error", err);
            alert("저장 실패: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "저장";
        }
    }

    // Export
    globalThis.App = globalThis.App || {};
    globalThis.App.ToolsForm = { init };

})();
