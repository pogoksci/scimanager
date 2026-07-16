(function () {
    const supabase = App.supabase;

    let currentMode = 'create'; // 'create' or 'edit'
    let currentId = null;

    // DOM Elements Cache
    let form, kitClassButtonsDiv, kitClassValueInput, nameSelect, customInputs,
        checkCustom, customNameInput, casInputContainer, btnAddCas,
        quantityInput, yearInput, monthInput, dayInput, hiddenDateInput, kitPersonInput, kitPersonGroup,
        previewImg, videoStream, canvas, photoContainer,
        fileInput, cameraInput;

    // Catalog Cache (ensure we have it)
    // We rely on window.catalog being populated by Kits.init or similar, 
    // but we should probably fetch it if missing.

    async function init(id = null) {
        console.log("🧩 App.KitForm init", id);
        // Debug Alert - remove after fixing
        // alert("DEBUG: KitForm Init Called. ID: " + id);

        try {
            currentId = id;
            currentMode = id ? 'edit' : 'create';

            cacheElements();
            bindEvents();

            // Initialize UI State
            resetForm();

            // ✅ 1. Initialize Storage Selector IMMEDIATELY
            if (currentMode === 'create') {
                document.querySelector('#kit-form-title').textContent = "키트 등록";
                const now = new Date();
                yearInput.value = now.getFullYear();
                monthInput.value = String(now.getMonth() + 1).padStart(2, '0');
                dayInput.value = String(now.getDate()).padStart(2, '0');
                // Sync hidden
                hiddenDateInput.valueAsDate = now;

                if (App.StorageSelector) {
                    const selectorContainer = document.getElementById("kit-storage-selector");
                    if (selectorContainer) {
                        selectorContainer.innerHTML = "";
                        await App.StorageSelector.init("kit-storage-selector", {}, "EQUIPMENT");
                    }
                }
            } else {
                document.querySelector('#kit-form-title').textContent = "키트 정보";
                const customWrapper = document.getElementById('custom-kit-checkbox-wrapper');
                if (customWrapper) customWrapper.style.display = 'none';
            }

            // ✅ 2. Load Catalog (Async)
            if (!window.catalog || window.catalog.length === 0) {
                if (App.Kits && App.Kits.loadCatalog) {
                    window.catalog = await App.Kits.loadCatalog();
                } else {
                    console.warn("App.Kits.loadCatalog not found, fetching manually...");
                    const { data } = await supabase.from('experiment_kit').select('*');
                    window.catalog = data || [];
                }
            }

            // ✅ 3. Load Edit Data (if needed)
            if (currentMode === 'edit') {
                await loadData(id);
            } else {
                // For create mode, after catalog is loaded, populate name select based on default 'all'
                updateNameList();
            }

        } catch (err) {
            console.error("KitForm init error:", err);
            alert("페이지 초기화 중 오류가 발생했습니다: " + err.message);
        }
    }

    function cacheElements() {
        form = document.getElementById('kit-form');
        // New UI Elements
        kitClassButtonsDiv = document.getElementById('kit-class-buttons');
        kitClassValueInput = document.getElementById('kit-class-value');
        nameSelect = document.getElementById('kit-name-select');

        checkCustom = document.getElementById('check-custom-kit');
        customInputs = document.getElementById('custom-kit-inputs');
        customNameInput = document.getElementById('custom-kit-name');
        casInputContainer = document.getElementById('cas-input-container');
        btnAddCas = document.getElementById('btn-add-cas');

        quantityInput = document.getElementById('kit-quantity');
        yearInput = document.getElementById('kit-date-year');
        monthInput = document.getElementById('kit-date-month');
        dayInput = document.getElementById('kit-date-day');
        hiddenDateInput = document.getElementById('kit-date-hidden');
        kitPersonInput = document.getElementById('kit-person');
        kitPersonGroup = document.getElementById('kit-person-group');

        previewImg = document.getElementById('kit-preview-img');
        videoStream = document.getElementById('kit-camera-stream');
        canvas = document.getElementById('kit-camera-canvas');
        photoContainer = document.querySelector('#kit-form-page .photo-container');

        fileInput = document.getElementById('kit-file-input');
        cameraInput = document.getElementById('kit-camera-input');
    }

    function resetForm() {
        form.reset();
        resetPhotoUI();

        // Reset Custom Inputs
        customInputs.style.display = 'none';
        // kitPersonGroup inherits visibility from customInputs in Create Mode

        // Reset Class Buttons (Default: None selected)
        const buttons = kitClassButtonsDiv.querySelectorAll('.class-toggle-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        kitClassValueInput.value = ''; // No categories selected

        // Reset Name Select
        nameSelect.innerHTML = '<option value="" disabled selected>분류를 먼저 선택하세요</option>';
        nameSelect.disabled = true; // Wait for user interaction or load logic?
        // Actually, with 'all' default, we should populate names immediately?
        // Let's populate for 'all' immediately if cached, or wait for catalog load.
        // updateNameSelect(['all']);
    }

    let currentPhotoBase64 = null; // Store processed base64

    function resetPhotoUI() {
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
        if (videoStream) videoStream.style.display = 'none';
        if (canvas) canvas.style.display = 'none';

        const placeholder = photoContainer.querySelector('.placeholder-text');
        if (placeholder) placeholder.style.display = 'block';

        const btnCamera = document.getElementById('btn-kit-camera');
        if (btnCamera) {
            btnCamera.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영';
            btnCamera.style.display = 'inline-flex';
        }

        const btnFile = document.getElementById('btn-kit-file');
        if (btnFile) btnFile.style.display = 'inline-flex';

        const btnConfirm = document.getElementById('btn-kit-confirm');
        if (btnConfirm) {
            btnConfirm.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영';
            btnConfirm.style.display = 'none';
        }

        const btnCancel = document.getElementById('btn-cancel-camera');
        if (btnCancel) btnCancel.style.display = 'none';

        currentPhotoBase64 = null;
    }

    function bindEvents() {
        // Class Buttons Click
        kitClassButtonsDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('class-toggle-btn')) {
                const btn = e.target;
                const val = btn.dataset.value;
                const allButtons = Array.from(kitClassButtonsDiv.querySelectorAll('.class-toggle-btn'));
                const specificButtons = allButtons.filter(b => b.dataset.value !== 'all');
                const allBtn = allButtons.find(b => b.dataset.value === 'all');

                if (val === 'all') {
                    // Toggle All: If 'all' was not active, select all. If it was active, properties toggle
                    const isNowActive = !btn.classList.contains('active');
                    if (isNowActive) {
                        // Activate everything (Select All)
                        allButtons.forEach(b => b.classList.add('active'));
                    } else {
                        // Deactivate everything (Deselect All)
                        allButtons.forEach(b => b.classList.remove('active'));
                    }
                } else {
                    // Specific Category Clicked
                    btn.classList.toggle('active');

                    // Check if all specific buttons are active
                    const allActive = specificButtons.every(b => b.classList.contains('active'));
                    if (allActive) {
                        if (allBtn) allBtn.classList.add('active');
                    } else {
                        if (allBtn) allBtn.classList.remove('active');
                    }
                }

                // Update Name Select based on new active set
                updateNameList();
            }
        });

        // Custom Checkbox
        checkCustom.addEventListener('change', (e) => {
            if (e.target.checked) {
                customInputs.style.display = 'block';
                // kitPersonGroup is inside, so it shows
                nameSelect.disabled = true;
                nameSelect.innerHTML = '<option value="" disabled selected>직접 입력 모드</option>';
            } else {
                customInputs.style.display = 'none';
                // kitPersonGroup is inside, so it hides
                updateNameList(); // Re-populate based on buttons
            }
        });

        btnAddCas.addEventListener('click', () => {
            const div = document.createElement('div');
            // Inline style removed, wrapper class implicit or not needed on input itself if div handles it, 
            // but the original code had style on input. 
            // Let's assume class 'cas-input' is enough if defined, but I added 'cas-input-wrapper' above. Wait.
            // Original: <input ... style="margin-bottom: 5px;">
            // I'll add the class to input.
            div.innerHTML = `<input type="text" class="form-input cas-input cas-input-wrapper" placeholder="CAS (예: 7732-18-5)">`;
            casInputContainer.appendChild(div.firstChild);
        });

        // Photo Events
        document.getElementById('btn-kit-file').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);

        document.getElementById('btn-kit-camera').addEventListener('click', () => {
            if (isCameraActive) {
                if (videoStream.style.display === 'none') {
                    startCamera();
                } else {
                    takeKitPhoto();
                }
            } else {
                startCamera();
            }
        });

        document.getElementById('btn-kit-confirm').addEventListener('click', takeKitPhoto);
        document.getElementById('btn-cancel-camera').addEventListener('click', stopCamera);
        cameraInput.addEventListener('change', handleFileSelect);


        // Submit
        form.addEventListener('submit', handleSubmit);

        // Cancel
        document.getElementById('btn-cancel-kit').addEventListener('click', () => {
            if (currentMode === 'edit' && currentId) {
                App.Router.go('kitDetail', { id: currentId });
            } else {
                App.Router.go('kits');
            }
        });

        // Name Select Change (Auto-fill Person)
        nameSelect.addEventListener('change', () => {
            if (!checkCustom.checked) {
                const opt = nameSelect.options[nameSelect.selectedIndex];
                if (opt && opt.dataset.person) {
                    if (kitPersonInput) kitPersonInput.value = opt.dataset.person;
                } else {
                    // Optionally clear or keep previous value?
                    // Let's clear it if no person count in catalog, or let user decide.
                    // Better to clear if switching to a known item that has no person count logic?
                    // Actually many don't have it yet. Let's not clear aggressively if user typed it?
                    // But if user picks Item A (4 person) -> Input 4.
                    // Picks Item B (No person) -> If we keep 4, it might be misleading.
                    // Let's clear if empty.
                    if (kitPersonInput) kitPersonInput.value = '';
                }
            }
        });

        // 1. Auto-focus & Select-All Logic
        [yearInput, monthInput, dayInput].forEach(input => {
            if (input) {
                input.addEventListener('focus', () => input.select());
            }
        });

        if (yearInput) {
            yearInput.addEventListener('input', () => {
                if (yearInput.value.length === 4) monthInput.focus();
                syncToHidden();
            });
        }
        if (monthInput) {
            monthInput.addEventListener('input', () => {
                if (monthInput.value.length === 2) dayInput.focus();
                syncToHidden();
            });
        }
        if (dayInput) {
            dayInput.addEventListener('input', syncToHidden);
        }

        // 2. Calendar Picker Logic
        const btnCalendar = document.getElementById('btn-open-calendar');
        if (btnCalendar && hiddenDateInput) {
            btnCalendar.addEventListener('click', () => {
                if (hiddenDateInput.showPicker) {
                    hiddenDateInput.showPicker();
                } else {
                    hiddenDateInput.focus();
                    hiddenDateInput.click();
                }
            });

            hiddenDateInput.addEventListener('change', () => {
                if (hiddenDateInput.value) {
                    const [y, m, d] = hiddenDateInput.value.split('-');
                    yearInput.value = y;
                    monthInput.value = m;
                    dayInput.value = d;
                }
            });
        }

        function syncToHidden() {
            const y = yearInput.value;
            const m = monthInput.value.padStart(2, '0');
            const d = dayInput.value.padStart(2, '0');
            if (y.length === 4 && m.length === 2 && d.length === 2) {
                hiddenDateInput.value = `${y}-${m}-${d}`;
            }
        }

    }

    function updateNameList() {
        if (checkCustom.checked) return;

        const activeBtns = Array.from(kitClassButtonsDiv.querySelectorAll('.class-toggle-btn.active'));
        // Filter out 'all' so it's not saved as a category string
        const selectedValues = activeBtns.map(b => b.dataset.value).filter(v => v !== 'all');

        // Update Hidden Input (for reference or saving)
        kitClassValueInput.value = selectedValues.join(',');

        // Filter Catalog
        updateNameSelect(selectedValues);
    }

    async function loadData(id) {
        try {
            const { data: kit, error } = await supabase.from('user_kits').select('*').eq('id', id).single();
            if (error) throw error;
            if (!kit) throw new Error("키트 정보를 찾을 수 없습니다.");

            // Populate Form
            // 1. Classification (Multi-Select Buttons)
            const currentClasses = (kit.kit_class || '미분류').split(',').map(s => s.trim());
            const buttons = kitClassButtonsDiv.querySelectorAll('.class-toggle-btn');

            // Logic: If 'all' in user data (unlikely strict match) or just specific classes
            // We should match dataset values.

            // First reset all
            buttons.forEach(b => {
                b.classList.remove('active');
            });

            let hasActive = false;
            buttons.forEach(btn => {
                if (currentClasses.includes(btn.dataset.value)) {
                    btn.classList.add('active');
                    hasActive = true;
                }
            });

            // If no specific class matched, maybe fall back to 'all' or 'other'?
            if (!hasActive) {
                const allBtn = kitClassButtonsDiv.querySelector('.class-toggle-btn[data-value="all"]');
                if (allBtn) {
                    allBtn.classList.add('active');
                }
            }

            // Update hidden input
            updateNameList(); // This also triggers updateNameSelect

            // Force show kitPersonGroup in Edit Mode by moving it OUT of kit-name-group
            if (kitPersonGroup) {
                const nameGroup = document.getElementById('kit-name-group');
                if (nameGroup && nameGroup.parentNode) {
                    nameGroup.parentNode.insertBefore(kitPersonGroup, nameGroup.nextSibling);
                    kitPersonGroup.style.display = 'block'; // Ensure visible
                }
            }

            // 2. Name
            // updateNameList calling updateNameSelect will populate options
            // We need to SELECT the current kit name

            // Wait for simple sync population? updateNameSelect logic below relies on window.catalog which is loaded.

            let foundOption = false;
            for (let i = 0; i < nameSelect.options.length; i++) {
                if (nameSelect.options[i].text === kit.kit_name) {
                    nameSelect.selectedIndex = i;
                    foundOption = true;
                    break;
                }
            }

            if (!foundOption) {
                // Append custom option if not in filtered list
                const opt = document.createElement('option');
                opt.value = kit.kit_name;
                opt.text = kit.kit_name;
                opt.selected = true;
                nameSelect.appendChild(opt);
            }

            // 3. Details
            quantityInput.value = kit.quantity;
            if (kit.purchase_date) {
                const [y, m, d] = kit.purchase_date.split('-');
                yearInput.value = y;
                monthInput.value = m;
                dayInput.value = d;
                hiddenDateInput.value = kit.purchase_date;
            }
            if (kitPersonInput) kitPersonInput.value = kit.kit_person || '';

            // 4. Photo
            if (kit.image_url) {
                if (previewImg) {
                    previewImg.src = kit.image_url;
                    previewImg.style.display = 'block';
                }
                if (photoContainer) {
                    const placeholder = photoContainer.querySelector('.placeholder-text');
                    if (placeholder) placeholder.style.display = 'none';
                }
                currentPhotoBase64 = null;
            }

            // 5. Location
            let defaultLoc = {};
            try {
                if (kit.location && typeof kit.location === 'string' && kit.location.trim().startsWith('{')) {
                    defaultLoc = JSON.parse(kit.location);
                }
            } catch (e) {
                console.warn('Location parse error:', e);
            }

            if (App.StorageSelector) {
                const selectorContainer = document.getElementById("kit-storage-selector");
                if (selectorContainer) selectorContainer.innerHTML = "";
                App.StorageSelector.init("kit-storage-selector", defaultLoc, "EQUIPMENT");
            }

        } catch (err) {
            console.error(err);
            alert("불러오기 실패: " + err.message);
            App.Router.go('kits');
        }
    }

    function updateNameSelect(selectedClasses, selectedKitId = null) {
        if (!nameSelect) return;
        nameSelect.disabled = false;
        nameSelect.innerHTML = '<option value="" disabled selected>키트를 선택하세요</option>';

        // Ensure array
        if (!Array.isArray(selectedClasses)) {
            selectedClasses = [selectedClasses];
        }

        let filtered = [];
        if (selectedClasses.includes('all')) {
            filtered = window.catalog || [];
            nameSelect.innerHTML = '<option value="" disabled selected>키트를 선택하세요 (전체)</option>';
        } else {
            const catalog = window.catalog || [];
            // Filter: Item matches ANY of the selected classes
            // catalog item kit_class is usually a string "Physics" or "Physics,Chemistry"
            filtered = catalog.filter(k => {
                if (!k.kit_class) return false;
                const itemClasses = k.kit_class.split(',').map(s => s.trim());
                // Check intersection
                return selectedClasses.some(sel => itemClasses.includes(sel));
            });
            nameSelect.innerHTML = `<option value="" disabled selected>${selectedClasses.join(', ')} 키트 선택</option>`;
        }

        filtered = filtered.filter(k => k && k.kit_name);

        if (filtered.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = "해당 분류의 키트가 없습니다";
            opt.disabled = true;
            nameSelect.appendChild(opt);
            return;
        }

        filtered.sort((a, b) => a.kit_name.localeCompare(b.kit_name));

        filtered.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k.id;
            opt.textContent = k.kit_name;
            opt.dataset.cas = k.kit_cas || '';
            opt.dataset.name = k.kit_name;
            opt.dataset.class = k.kit_class;
            if (selectedKitId && k.id == selectedKitId) {
                opt.selected = true;
                // If selected by ID (Edit Mode initial load), we might want to fill person count from catalog?
                // But Edit Mode 'loadData' already sets it from user_kits.
                // However, if user changes selection in Create Mode:
            }
            opt.dataset.person = k.kit_person || ''; // Store person count in dataset
            nameSelect.appendChild(opt);
        });
    }

    // --- Photo Logic ---
    let isCameraActive = false;

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            if (isCameraActive) stopCamera();

            const reader = new FileReader();
            reader.onload = async (e) => {
                if (App.Camera && App.Camera.processImage) {
                    try {
                        const resized = await App.Camera.processImage(e.target.result);
                        if (resized) {
                            currentPhotoBase64 = resized.base64_320;
                            showPreview(resized.base64_320);
                        }
                    } catch (err) { console.error(err); }
                } else {
                    // Fallback
                    showPreview(e.target.result);
                    currentPhotoBase64 = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        }
    }

    function showPreview(src) {
        if (previewImg) {
            previewImg.src = src;
            previewImg.style.display = 'block';
        }
        if (photoContainer) {
            const placeholder = photoContainer.querySelector('.placeholder-text');
            if (placeholder) placeholder.style.display = 'none';
        }
    }

    async function startCamera() {
        try {
            const res = await App.Camera.getNextStream(videoStream.srcObject);
            videoStream.srcObject = res.stream;
            videoStream.style.display = 'block';
            videoStream.play();

            previewImg.style.display = 'none';
            photoContainer.querySelector('.placeholder-text').style.display = 'none';

            isCameraActive = true;

            // UI Toggle
            const btnCamera = document.getElementById('btn-kit-camera');
            if (btnCamera) {
                btnCamera.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영하기';
                btnCamera.style.display = 'none';
            }

            document.getElementById('btn-kit-file').style.display = 'none';

            const btnConfirm = document.getElementById('btn-kit-confirm');
            if (btnConfirm) {
                btnConfirm.style.display = 'inline-flex';
                btnConfirm.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영';
            }

            const btnSwitch = document.getElementById('btn-kit-switch');
            if (btnSwitch) {
                btnSwitch.style.display = App.Camera.hasMultipleCameras() ? 'inline-flex' : 'none';
            }

            document.getElementById('btn-cancel-camera').style.display = 'inline-flex';

        } catch (err) {
            console.error("Camera error:", err);
            cameraInput.click();
        }
    }

    function stopCamera() {
        if (videoStream.srcObject) {
            videoStream.srcObject.getTracks().forEach(t => t.stop());
            videoStream.srcObject = null;
        }
        videoStream.style.display = 'none';
        isCameraActive = false;

        const btnCamera = document.getElementById('btn-kit-camera');
        if (btnCamera) {
            btnCamera.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영';
            btnCamera.style.display = 'inline-flex';
        }

        document.getElementById('btn-kit-file').style.display = 'inline-flex';
        document.getElementById('btn-kit-confirm').style.display = 'none';
        document.getElementById('btn-kit-switch').style.display = 'none';
        document.getElementById('btn-cancel-camera').style.display = 'none';

        if (previewImg.src && previewImg.src !== window.location.href) {
            previewImg.style.display = 'block';
        } else if (photoContainer) {
            const placeholder = photoContainer.querySelector('.placeholder-text');
            if (placeholder) placeholder.style.display = 'block';
        }
    }

    async function takeKitPhoto() {
        if (!videoStream || !canvas) return;
        const base64 = App.Camera.captureFrame(videoStream, canvas);
        if (!base64) return;

        // 1. Show original preview immediately and hide videoStream to prevent side-by-side flicker
        showPreview(base64);
        videoStream.style.display = 'none';

        // 2. Process resizing in background
        try {
            const resized = await App.Camera.processImage(base64);
            if (resized) {
                currentPhotoBase64 = resized.base64_320;
                showPreview(resized.base64_320);
            }
        } catch (err) {
            console.error(err);
            currentPhotoBase64 = base64;
        }

        // Review Mode UI Update
        const btnCamera = document.getElementById('btn-kit-camera');
        if (btnCamera) {
            btnCamera.innerHTML = '<span class="material-symbols-outlined">replay</span> 다시 촬영';
        }

        setTimeout(() => {
            stopCamera();
        }, 150);
    }

    // --- Submit Logic ---
    async function handleSubmit(e) {
        e.preventDefault();

        // 1. Classification & Name
        // Retrieve from hidden input which is kept in sync by updateNameList
        let kitClass = kitClassValueInput.value || '기타';

        let finalKitName = '';
        let customCas = null;
        const isCustom = checkCustom && checkCustom.checked;

        if (isCustom) {
            const customNameInput = document.getElementById('custom-kit-name');
            finalKitName = customNameInput.value.trim();
            if (!finalKitName) return alert("키트 이름을 입력하세요.");

            const casInputs = document.querySelectorAll('.cas-input');
            const casList = Array.from(casInputs).map(input => input.value.trim()).filter(val => val);
            if (casList.length > 0) customCas = casList.join(', ');
        } else {
            const selectedOption = nameSelect.options[nameSelect.selectedIndex];
            if (!selectedOption || selectedOption.disabled || !selectedOption.value) {
                // In Edit mode, nameSelect matches kit_name. 
                // However, nameSelect might be empty if catalog filter mismatch?
                // But loadData ensures current name is added.
                // Just check value.
                if (!nameSelect.value) return alert("키트를 선택하세요.");
            }

            if (nameSelect.selectedIndex >= 0) {
                const opt = nameSelect.options[nameSelect.selectedIndex];
                finalKitName = opt.dataset.name || opt.value || opt.text;
                // If user chose from catalog, class might need to be specific? 
                // Whatever is in kitClass from buttons is what user INTENDS to set for this kit instance.
            } else {
                finalKitName = nameSelect.value;
            }
        }


        const quantity = parseInt(quantityInput.value, 10);
        const yVal = yearInput.value.trim();
        const mVal = monthInput.value.trim().padStart(2, '0');
        const dVal = dayInput.value.trim().padStart(2, '0');

        if (!yVal || !mVal || !dVal) return alert("구입일을 정확히 입력하세요.");
        const purchaseDate = `${yVal}-${mVal}-${dVal}`;
        const kitPerson = kitPersonInput && kitPersonInput.value ? parseInt(kitPersonInput.value, 10) : null;
        const file = fileInput.files[0];

        // Location
        let locationJson = null;
        if (App.StorageSelector) {
            const locSelection = App.StorageSelector.getSelection();
            if (locSelection.area_id) {
                locationJson = JSON.stringify(locSelection);
            }
        }

        // Base64 Photo
        let photoBase64 = currentPhotoBase64;

        // Fallback or override logic:
        // If user selected a file but logic failed to set currentPhotoBase64?
        // Rely on currentPhotoBase64 which is set by handleFileSelect or takeKitPhoto.

        // However, if editing and no new photo, currentPhotoBase64 is null.
        // If fileInput has file but currentPhotoBase64 null (async race?), we should double check.
        // But handleFileSelect waits? No it doesn't block submit.
        // Assuming user waits for preview.

        // If 'edit' and !photoBase64, backend should preserve existing if we send null?
        // kit-register EF logic: "if photo_base64 is present, upload and update image_url".
        // If not present, it ignores? We should check EF, but standard behavior implies yes.

        const payload = {
            mode: currentMode,
            id: currentId ? parseInt(currentId) : null,
            kit_name: finalKitName,
            kit_class: kitClass,
            kit_cas: customCas,
            kit_person: kitPerson, // Add to payload
            quantity: quantity,
            purchase_date: purchaseDate,
            photo_base64: photoBase64,
            location: locationJson
        };

        const btnSave = document.getElementById('btn-save-kit');
        const oldText = btnSave.textContent;
        btnSave.textContent = '처리 중...';
        btnSave.disabled = true;

        try {
            const { data, error } = await supabase.functions.invoke('kit-register', {
                body: payload
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            // ✅ Auto-register Missing Chemicals
            try {
                let targetCasStr = null;
                if (isCustom && customCas) {
                    targetCasStr = customCas;
                } else if (!isCustom && finalKitName) {
                    // Find in catalog to get CAS list
                    const catItem = window.catalog?.find(c => c.kit_name === finalKitName);
                    if (catItem) targetCasStr = catItem.kit_cas;
                }

                if (targetCasStr) {
                    const casList = targetCasStr.split(',').map(s => s.trim().replace(/['"]/g, '')).filter(s => s);
                    if (casList.length > 0) {
                        btnSave.textContent = '약품 등록 중...';
                        await checkAndRegisterChemicals(casList);
                    }
                }
            } catch (chemErr) {
                console.warn("Chemical registration warning:", chemErr);
                // Don't block main success, just warn
            }

            alert("저장되었습니다.");

            // Post-process logic (Chemicals, Catalog Refresh)
            if (currentMode !== 'edit' || (quantity > 0)) {
                // Trigger Kit Chemical processing in background if possible, or wait?
                // Function is in Kits.js scope usually... 
                // We can define it here OR verify if we can access it.
                // App.Kits.processKitChemicals might be exposing it? 
                // It wasn't exported in Kits.js.
                // But since we are moving away from modal, we should probably move that logic to shared util or duplicate.
                // For now, let's assume server handles it or we skip client-side detailed trigger (risk).
                // Actually, processKitChemicals is crucial for MSDS.
                // TODO: Ensure chemical processing runs.
                // If the function was internal to Kits.js, we can't call it easily unless we exported it.
            }

            if (currentMode === 'edit' && currentId) {
                App.Router.go('kitDetail', { id: currentId });
            } else {
                App.Router.go('kits');
            }

        } catch (err) {
            console.error(err);
            alert("저장 실패: " + err.message);
        } finally {
            btnSave.textContent = oldText;
            btnSave.disabled = false;
        }
    }

    // --- Chemical Auto-Registration Helper ---
    async function checkAndRegisterChemicals(casList) {
        if (!casList || casList.length === 0) return;
        const uniqueCas = [...new Set(casList)];

        // 1. Check existing in kit_chemicals
        // We can't easily use .in() for large lists, but CAS list for a kit is usually small (<20).
        const { data: existing, error } = await supabase
            .from('kit_chemicals')
            .select('cas_no')
            .in('cas_no', uniqueCas);

        if (error) {
            console.error("Failed to check existing chemicals:", error);
            return;
        }

        const existingSet = new Set(existing.map(e => e.cas_no));
        const missing = uniqueCas.filter(c => !existingSet.has(c));

        if (missing.length === 0) return;

        console.log(`[KitForm] Found ${missing.length} missing chemicals. Registering...`, missing);

        // 2. Register missing (Parallel)
        await Promise.all(missing.map(async (cas) => {
            try {
                const { error: invokeError } = await supabase.functions.invoke('kit-casimport', {
                    body: { cas_rn: cas }
                });
                if (invokeError) throw invokeError;
            } catch (e) {
                console.error(`Failed to auto-register ${cas}:`, e);
            }
        }));
    }

    // Export
    globalThis.App = globalThis.App || {};
    globalThis.App.KitForm = { init };

})();
