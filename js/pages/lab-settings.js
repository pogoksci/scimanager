
(function () {
    const LabSettings = {};

    let currentSemesterId = null;

    LabSettings.init = async function () {
        console.log("🛠️ LabSettings.init()");

        // Check Supabase Connection
        const supabase = App.supabase || window.supabaseClient;
        if (!supabase) {
            console.error('Supabase client not initialized.');
            alert('데이터베이스 연결에 실패했습니다.');
            return;
        }

        // --- DOM Elements ---
        const tabs = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        const semesterSelect = document.getElementById('semester-select');
        const semesterDetailsContainer = document.getElementById('semester-details-container');

        // --- Initialization calls moved to bottom ---


        // --- Tab Logic ---
        function initTabs() {
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.dataset.tab;

                    // Update Tab Buttons
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');

                    // Update Content
                    tabContents.forEach(content => {
                        content.id === targetId ? content.classList.add('active') : content.classList.remove('active');
                    });

                    if (targetId === 'chatbot-settings') {
                        loadUnansweredQueries();
                    }
                });
            });
            updateTabStatus();
        }

        async function updateTabStatus() {
            // Check Lab Rooms
            const { data: rooms } = await supabase.from('lab_rooms').select('count');
            const labTab = document.getElementById('tab-btn-lab');
            if (labTab) {
                if (!rooms || rooms.length === 0) {
                    labTab.classList.add('unconfigured');
                } else {
                    labTab.classList.remove('unconfigured');
                }
            }

            // Check Semesters (User Settings)
            const { data: config } = await supabase.from('lab_semesters').select('id');
            const userTab = document.getElementById('tab-btn-user');
            if (userTab) {
                if (!config || config.length === 0) {
                    userTab.classList.add('unconfigured');
                } else {
                    userTab.classList.remove('unconfigured');
                }
            }
        }


        // ==========================================
        // Tab 0: School Info Settings Logic
        // ==========================================
        const btnSaveSchoolInfo = document.getElementById('btn-save-school-info');

        function toggleChatbotFields() {
            const providerSelect = document.getElementById('chatbot-provider-select');
            const keyLabel = document.getElementById('chatbot-key-label');
            const urlGroup = document.getElementById('chatbot-api-url-group');
            const modelGroup = document.getElementById('chatbot-model-group');

            if (!providerSelect) return;
            const val = providerSelect.value;

            if (val === 'gemini') {
                if (keyLabel) keyLabel.textContent = 'Gemini API Key';
                if (urlGroup) urlGroup.style.display = 'none';
                if (modelGroup) modelGroup.style.display = 'none';
            } else if (val === 'openai') {
                if (keyLabel) keyLabel.textContent = 'OpenAI API Key';
                if (urlGroup) urlGroup.style.display = 'none';
                if (modelGroup) modelGroup.style.display = 'block';
            } else if (val === 'custom') {
                if (keyLabel) keyLabel.textContent = 'API Key (또는 토큰)';
                if (urlGroup) urlGroup.style.display = 'block';
                if (modelGroup) modelGroup.style.display = 'block';
            }
        }

        // Load School Info
        async function loadSchoolInfo() {
            // Load Chatbot settings
            const providerSelect = document.getElementById('chatbot-provider-select');
            const apiKeyInput = document.getElementById('chatbot-api-key-input');
            const apiUrlInput = document.getElementById('chatbot-api-url-input');
            const modelInput = document.getElementById('chatbot-model-input');

            if (providerSelect) {
                providerSelect.value = localStorage.getItem('chatbot_provider') || 'gemini';
                providerSelect.onchange = toggleChatbotFields;
            }
            if (apiKeyInput) apiKeyInput.value = localStorage.getItem('chatbot_api_key') || '';
            if (apiUrlInput) apiUrlInput.value = localStorage.getItem('chatbot_api_url') || '';
            if (modelInput) modelInput.value = localStorage.getItem('chatbot_model') || '';

            toggleChatbotFields();

            const { data, error } = await supabase
                .from('global_settings')
                .select('key, value');

            if (error) {
                console.warn("School info load failed:", error);
                return;
            }

            const settings = {};
            if (data) {
                data.forEach(item => settings[item.key] = item.value);
            }

            // Populate Fields
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val || '';
            };

            setVal('school-name-input', settings['SCHOOL_NAME']);

            setVal('sc-grade-1-classes', settings['GRADE_1_CLASSES']);
            setVal('sc-grade-2-classes', settings['GRADE_2_CLASSES']);
            setVal('sc-grade-3-classes', settings['GRADE_3_CLASSES']);

            setVal('sc-grade-1-students', settings['GRADE_1_STUDENTS']);
            setVal('sc-grade-2-students', settings['GRADE_2_STUDENTS']);
            setVal('sc-grade-3-students', settings['GRADE_3_STUDENTS']);
        }

        // Save School Info
        if (btnSaveSchoolInfo) {
            btnSaveSchoolInfo.addEventListener('click', async () => {
                const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

                const updates = [
                    { key: 'SCHOOL_NAME', value: getVal('school-name-input') },
                    { key: 'GRADE_1_CLASSES', value: getVal('sc-grade-1-classes') },
                    { key: 'GRADE_2_CLASSES', value: getVal('sc-grade-2-classes') },
                    { key: 'GRADE_3_CLASSES', value: getVal('sc-grade-3-classes') },
                    { key: 'GRADE_1_STUDENTS', value: getVal('sc-grade-1-students') },
                    { key: 'GRADE_2_STUDENTS', value: getVal('sc-grade-2-students') },
                    { key: 'GRADE_3_STUDENTS', value: getVal('sc-grade-3-students') },
                ];

                // Upsert all
                const { error } = await supabase
                    .from('global_settings')
                    .upsert(updates);

                if (error) {
                    alert('저장 실패: ' + error.message);
                } else {
                    // Update global config immediately
                    const newName = getVal('school-name-input');
                    if (newName) {
                        window.APP_CONFIG.SCHOOL = newName;
                    }
                    alert('학교 정보가 저장되었습니다.');
                }
            });
        }

        // Save Chatbot Settings (Multi-Provider Support)
        const btnSaveChatbotSettings = document.getElementById('btn-save-chatbot-settings');
        if (btnSaveChatbotSettings) {
            btnSaveChatbotSettings.addEventListener('click', () => {
                const providerSelect = document.getElementById('chatbot-provider-select');
                const apiKeyInput = document.getElementById('chatbot-api-key-input');
                const apiUrlInput = document.getElementById('chatbot-api-url-input');
                const modelInput = document.getElementById('chatbot-model-input');

                const provider = providerSelect ? providerSelect.value : 'gemini';
                const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
                const apiUrl = apiUrlInput ? apiUrlInput.value.trim() : '';
                const model = modelInput ? modelInput.value.trim() : '';

                if (apiKey) {
                    localStorage.setItem('chatbot_provider', provider);
                    localStorage.setItem('chatbot_api_key', apiKey);
                    localStorage.setItem('chatbot_api_url', apiUrl);
                    localStorage.setItem('chatbot_model', model);

                    if (globalThis.App.Chatbot) {
                        globalThis.App.Chatbot.provider = provider;
                        globalThis.App.Chatbot.apiKey = apiKey;
                        globalThis.App.Chatbot.apiUrl = apiUrl;
                        globalThis.App.Chatbot.model = model;
                        globalThis.App.Chatbot.updateStatus();
                    }
                    alert('AI 비서 설정이 저장되었습니다.');
                } else {
                    localStorage.removeItem('chatbot_provider');
                    localStorage.removeItem('chatbot_api_key');
                    localStorage.removeItem('chatbot_api_url');
                    localStorage.removeItem('chatbot_model');

                    if (globalThis.App.Chatbot) {
                        globalThis.App.Chatbot.provider = 'gemini';
                        globalThis.App.Chatbot.apiKey = null;
                        globalThis.App.Chatbot.apiUrl = '';
                        globalThis.App.Chatbot.model = '';
                        globalThis.App.Chatbot.updateStatus();
                    }
                    alert('API 설정이 삭제되었습니다. DB 검색 모드로 복원됩니다.');
                }
            });
        }

        // Load Unanswered Queries (AI Chatbot)
        async function loadUnansweredQueries() {
            const container = document.getElementById('unanswered-list-container');
            if (!container) return;

            const { data, error } = await supabase
                .from('chatbot_unanswered')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Failed to load unanswered queries:", error);
                container.innerHTML = `<p style="padding: 15px; text-align: center; color: #d9534f; font-size: 13px;">불러오기 실패: ${error.message}</p>`;
                return;
            }

            if (!data || data.length === 0) {
                container.innerHTML = `<p style="padding: 15px; text-align: center; color: #777; font-size: 13px;">등록된 미답변 질문이나 요청이 없습니다. 깨끗합니다!</p>`;
                return;
            }

            let html = `<table style="width: 100%; border-collapse: collapse; font-size: 12.5px; text-align: left;">
                <thead>
                    <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa; font-weight: bold; color: #495057;">
                        <th style="padding: 8px 10px; width: 110px;">등록 시간</th>
                        <th style="padding: 8px 10px;">질문 내용</th>
                        <th style="padding: 8px 10px; width: 60px; text-align: center;">관리</th>
                    </tr>
                </thead>
                <tbody>`;

            data.forEach(item => {
                const dateObj = new Date(item.created_at);
                const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                
                html += `<tr style="border-bottom: 1px solid #dee2e6; background: white;">
                    <td style="padding: 8px 10px; color: #666; font-size: 11.5px;">${dateStr}</td>
                    <td style="padding: 8px 10px; color: #222; word-break: break-all; line-height: 1.4;">${item.query}</td>
                    <td style="padding: 8px 10px; text-align: center;">
                        <button class="btn-restore" data-id="${item.id}" style="margin: 0; padding: 2px 6px; font-size: 10.5px; background: #e03131; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">삭제</button>
                    </td>
                </tr>`;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;

            // Bind Delete Buttons
            container.querySelectorAll('button[data-id]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    if (confirm("이 질문 기록을 삭제하시겠습니까?")) {
                        const { error: delErr } = await supabase
                            .from('chatbot_unanswered')
                            .delete()
                            .eq('id', id);

                        if (delErr) {
                            alert("삭제 실패: " + delErr.message);
                        } else {
                            loadUnansweredQueries();
                        }
                    }
                });
            });
        }

        const btnRefreshUnanswered = document.getElementById('btn-refresh-unanswered');
        if (btnRefreshUnanswered) {
            btnRefreshUnanswered.addEventListener('click', loadUnansweredQueries);
        }


        // ==========================================
        // Tab 1: Lab Management Logic
        // ==========================================

        const labCountInput = document.getElementById('lab-count');
        const btnSetLabCount = document.getElementById('btn-set-lab-count');
        const labRoomsContainer = document.getElementById('lab-rooms-container');
        const labRoomsList = document.getElementById('lab-rooms-list');
        const btnSaveLabs = document.getElementById('btn-save-labs');

        // Load existing rooms
        async function loadLabRooms() {
            const { data: rooms, error } = await supabase
                .from('lab_rooms')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error loading rooms:', error);
                return;
            }

            if (rooms && rooms.length > 0 && labCountInput) {
                labCountInput.value = rooms.length;
                renderRoomInputs(rooms.length, rooms);
                if (labRoomsContainer) labRoomsContainer.style.display = 'block';
            }
        }

        // Set Count Button
        if (btnSetLabCount) {
            btnSetLabCount.addEventListener('click', () => {
                const count = parseInt(labCountInput.value);
                if (count < 1 || count > 20) {
                    alert('1~20 사이의 숫자를 입력해주세요.');
                    return;
                }
                renderRoomInputs(count);
                labRoomsContainer.style.display = 'block';
            });
        }

        // Render Room Inputs
        function renderRoomInputs(count, existingData = []) {
            if (!labRoomsList) return;
            labRoomsList.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const div = document.createElement('div');
                div.className = 'dynamic-item';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'room-name-input';
                input.placeholder = `과학실 ${i + 1} 이름`;
                // Set value: existing data or default
                if (existingData[i]) {
                    input.value = existingData[i].room_name;
                    input.dataset.id = existingData[i].id; // Store ID for updates
                } else {
                    input.value = `과학교과실${i + 1}`;
                }

                div.appendChild(input);
                labRoomsList.appendChild(div);
            }
        }

        // Save Labs
        if (btnSaveLabs) {
            btnSaveLabs.addEventListener('click', async () => {
                const inputs = document.querySelectorAll('.room-name-input');
                const upsertData = [];
                const inputNames = [];
                const duplicateInInput = new Set();

                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    const userId = user?.id;

                    console.log("💾 Saving Labs. User:", userId);

                    // 1. Collect data and check for internal duplicates
                    inputs.forEach((input, index) => {
                        const roomName = input.value.trim();
                        if (!roomName) return;

                        if (inputNames.includes(roomName)) {
                            duplicateInInput.add(roomName);
                        }
                        inputNames.push(roomName);

                        const room = {
                            room_name: roomName,
                            sort_order: index + 1,
                            user_id: userId // ✅ Add user_id
                        };
                        if (input.dataset.id) {
                            room.id = parseInt(input.dataset.id);
                        }
                        upsertData.push(room);
                    });

                    console.log("💾 Upsert Candidates:", upsertData);

                    if (upsertData.length === 0) {
                        alert('저장할 과학실 정보가 없습니다.');
                        return;
                    }

                    if (duplicateInInput.size > 0) {
                        alert(`입력된 과학실 이름 중 중복이 있습니다: ${Array.from(duplicateInInput).join(', ')}\n중복된 이름은 저장되지 않습니다.`);
                    }

                    // 2. Check for duplicates in DB
                    const { data: existingRooms, error: fetchError } = await supabase
                        .from('lab_rooms')
                        .select('id, room_name');

                    if (fetchError) throw fetchError;

                    console.log("💾 Existing Rooms:", existingRooms);

                    const itemsToInsert = [];
                    const itemsToUpdate = [];
                    const skippedNames = [];

                    upsertData.forEach(newItem => {
                        const normalizedNewName = newItem.room_name.normalize('NFC').trim();

                        // Check for duplicates in DB (Name exists but ID is different)
                        const match = existingRooms.find(existing => {
                            const normalizedExistingName = existing.room_name.normalize('NFC').trim();
                            return normalizedExistingName === normalizedNewName && existing.id !== newItem.id;
                        });

                        if (match || duplicateInInput.has(newItem.room_name)) {
                            skippedNames.push(newItem.room_name);
                        } else {
                            // Logic Update: If ID exists, check if it truly exists in DB
                            if (newItem.id) {
                                const original = existingRooms.find(r => r.id === newItem.id);
                                if (original) {
                                    // It exists, check for changes
                                    if (original.room_name !== newItem.room_name) {
                                        itemsToUpdate.push(newItem);
                                    }
                                } else {
                                    // ⚠️ Key Fix: ID exists in Input but NOT in DB (Stale ID). Treat as NEW Insert.
                                    // Remove the ID so Supabase assigns a new one
                                    const { id, ...newItemWithoutId } = newItem;
                                    itemsToInsert.push(newItemWithoutId);
                                    console.log("⚠️ Stale ID detected. Treating as new insert:", newItem.room_name);
                                }
                            } else {
                                // No ID, standard insert
                                itemsToInsert.push(newItem);
                            }
                        }
                    });

                    console.log("💾 Action Plan - Insert:", itemsToInsert.length, "Update:", itemsToUpdate.length);

                    // Execute Inserts
                    if (itemsToInsert.length > 0) {
                        const { error: insertError } = await supabase
                            .from('lab_rooms')
                            .insert(itemsToInsert);
                        if (insertError) throw insertError;
                    }

                    // Execute Updates
                    if (itemsToUpdate.length > 0) {
                        const updatePromises = itemsToUpdate.map(item => {
                            const { id, ...updateFields } = item;
                            return supabase
                                .from('lab_rooms')
                                .update(updateFields)
                                .eq('id', id);
                        });
                        await Promise.all(updatePromises);
                    }

                    // Construct Message
                    let message = '';
                    const savedCount = itemsToInsert.length + itemsToUpdate.length;

                    if (savedCount > 0) {
                        message += '과학실 정보가 저장되었습니다.';
                    }

                    if (skippedNames.length > 0) {
                        const skippedMsg = `\n\n[이미 등록된 이름 제외]\n${skippedNames.join(', ')}은(는) 이미 존재하여 저장되지 않았습니다.`;
                        message += skippedMsg;
                    }

                    if (savedCount === 0 && skippedNames.length === 0) {
                        message = '변경사항이 없습니다.';
                    } else if (savedCount === 0 && skippedNames.length > 0) {
                        if (!message) message = '저장된 내용이 없습니다.';
                    }

                    alert(message);
                    await loadLabRooms();
                    updateTabStatus();

                } catch (err) {
                    console.error('Error saving labs:', err);
                    alert('과학실 저장 중 오류가 발생했습니다: ' + err.message);
                }
            });
        }


        // ==========================================
        // Tab 2: User Settings Logic
        // ==========================================

        const btnAddSemester = document.getElementById('btn-add-semester');
        const newSemesterForm = document.getElementById('new-semester-form');
        const btnSaveSemester = document.getElementById('btn-save-semester');
        const btnCancelSemester = document.getElementById('btn-cancel-semester');
        const btnSaveUserSettings = document.getElementById('btn-save-user-settings');

        // Helper: Calculate Academic Year
        function getAcademicYear() {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth() + 1; // 0-indexed
            // If Month is 1 or 2, it's the previous year's academic year
            if (month < 3) {
                return year - 1;
            }
            return year;
        }

        // Helper: Populate Dropdown
        function populateSemesterDropdown() {
            const select = document.getElementById('new-semester-name');
            if (!select) return;

            // Should prompt only once or every time? Every time is safer to ensure default is set.
            select.innerHTML = '';
            const startYear = 2015;
            const endYear = 2050;
            const currentAcademicYear = getAcademicYear();

            for (let y = startYear; y <= endYear; y++) {
                const option = document.createElement('option');
                option.value = `${y}학년도`; // Format: "2025학년도"
                option.textContent = `${y}학년도`;
                if (y === currentAcademicYear) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        }

        // UI Toggles
        if (btnAddSemester) {
            btnAddSemester.addEventListener('click', () => {
                newSemesterForm.style.display = 'block';
                populateSemesterDropdown();
            });
        }
        if (btnCancelSemester) {
            btnCancelSemester.addEventListener('click', () => {
                newSemesterForm.style.display = 'none';
            });
        }

        // Save New Semester
        if (btnSaveSemester) {
            btnSaveSemester.addEventListener('click', async () => {
                // Use value from select
                const name = document.getElementById('new-semester-name').value;
                if (!name) { alert('학년도를 선택하세요.'); return; }

                // Check for duplicates (Exact match OR Base match)
                // e.g., if user selects "2025학년도", check if "2025학년도" or "2025학년도_..." exists.
                const { data: existing, error: checkError } = await supabase
                    .from('lab_semesters')
                    .select('name')
                    .ilike('name', `${name}%`);

                if (checkError) {
                    alert('중복 확인 중 오류가 발생했습니다: ' + checkError.message);
                    return;
                }

                const isDuplicate = existing.some(item =>
                    item.name === name || item.name.startsWith(name + '_')
                );

                if (isDuplicate) {
                    alert('동일 학년도가 이미 등록되어 있어 추가할 수 없습니다.\n해당 학년도를 선택하여 수정하세요.');
                    return;
                }

                const { data, error } = await supabase
                    .from('lab_semesters')
                    .insert([{ name: name }])
                    .select();

                if (error) {
                    alert('학년도 추가 실패: ' + error.message);
                } else {
                    alert('추가되었습니다.');
                    document.getElementById('new-semester-name').value = '';
                    newSemesterForm.style.display = 'none';
                    await loadSemesters(data[0].id); // Reload and select new
                }
            });
        }

        // Load Semesters to Dropdown
        async function loadSemesters(selectId = null) {
            const { data, error } = await supabase
                .from('lab_semesters')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) { console.error(error); return; }

            if (semesterSelect) semesterSelect.innerHTML = '<option value="">학년도를 선택하세요</option>';
            data.forEach(sem => {
                const option = document.createElement('option');
                option.value = sem.id;
                option.textContent = sem.name;
                if (semesterSelect) semesterSelect.appendChild(option);
            });

            if (selectId && semesterSelect) {
                semesterSelect.value = selectId;
                handleSemesterChange(selectId);
            }
        }

        if (semesterSelect) {
            semesterSelect.addEventListener('change', (e) => {
                handleSemesterChange(e.target.value);
            });
        }

        async function handleSemesterChange(id) {
            if (!id) {
                if (semesterDetailsContainer) semesterDetailsContainer.style.display = 'none';
                currentSemesterId = null;
                return;
            }
            currentSemesterId = id;
            if (semesterDetailsContainer) semesterDetailsContainer.style.display = 'block';

            await loadClassCounts(id);
            await loadDynamicList('lab_teachers', 'teachers-list');
            await loadDynamicList('lab_subjects', 'subjects-list');
            await loadDynamicList('lab_clubs', 'clubs-list');
        }

        // Class Counts
        async function loadClassCounts(semesterId) {
            const { data, error } = await supabase
                .from('lab_class_counts')
                .select('*')
                .eq('semester_id', semesterId);

            // Reset inputs
            const g1 = document.getElementById('count-grade-1'); if (g1) g1.value = '';
            const g2 = document.getElementById('count-grade-2'); if (g2) g2.value = '';
            const g3 = document.getElementById('count-grade-3'); if (g3) g3.value = '';

            if (data) {
                data.forEach(item => {
                    const input = document.getElementById(`count-grade-${item.grade}`);
                    if (input) {
                        // Display value only if > 0, otherwise empty (placeholder '0' handles the hint)
                        input.value = item.class_count > 0 ? item.class_count : '';
                    }
                });
            }
        }

        // Generic Load List Helper
        async function loadDynamicList(tableName, containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = ''; // Clear

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('semester_id', currentSemesterId)
                .order('id', { ascending: true });

            let initialCount = 12;
            let existingCount = data ? data.length : 0;
            let totalCount = Math.max(initialCount, existingCount);

            for (let i = 0; i < totalCount; i++) {
                const item = data && data[i] ? data[i] : null;
                createDynamicInput(container, item ? item.name : '', item ? item.id : null);
            }
        }

        // Helper to create input row
        function createDynamicInput(container, value = '', id = null) {
            const div = document.createElement('div');
            div.className = 'dynamic-item';

            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            if (id) input.dataset.id = id;

            // Option to remove if needed (for now just clearing value)
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove';
            removeBtn.innerHTML = '<span class="material-symbols-outlined btn-remove-icon">remove</span>';
            removeBtn.tabIndex = -1;
            removeBtn.addEventListener('click', async () => {
                div.remove();
            });

            div.appendChild(input);
            // container.appendChild(div); // Add remove button if desired, but user wants simple lists
            container.appendChild(div);
        }

        // Add Button Handlers
        ['teachers', 'subjects', 'clubs'].forEach(type => {
            const btn = document.getElementById(`btn-add-${type.slice(0, -1)}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    const list = document.getElementById(`${type}-list`);
                    if (list) createDynamicInput(list);
                });
            }
        });

        // Save User Settings
        if (btnSaveUserSettings) {
            btnSaveUserSettings.addEventListener('click', async () => {
                if (!currentSemesterId) { alert('학년도를 선택하세요.'); return; }

                // --- 1. Collect Valid Data from UI ---
                const uiTeachers = Array.from(document.querySelectorAll('#teachers-list input')).map(i => i.value.trim()).filter(v => v);
                const uiSubjects = Array.from(document.querySelectorAll('#subjects-list input')).map(i => i.value.trim()).filter(v => v);
                const uiClubs = Array.from(document.querySelectorAll('#clubs-list input')).map(i => i.value.trim()).filter(v => v);

                const c1 = document.getElementById('count-grade-1');
                const c2 = document.getElementById('count-grade-2');
                const c3 = document.getElementById('count-grade-3');

                // Parsing with fallback to 0
                const numC1 = parseInt(c1 ? c1.value : 0) || 0;
                const numC2 = parseInt(c2 ? c2.value : 0) || 0;
                const numC3 = parseInt(c3 ? c3.value : 0) || 0;

                const uiCounts = [
                    { grade: 1, count: numC1 },
                    { grade: 2, count: numC2 },
                    { grade: 3, count: numC3 }
                ];

                // --- 2. Check Strict Validation Rules (All Mmust have at least one entry) ---
                const hasValidCounts = (numC1 > 0) || (numC2 > 0) || (numC3 > 0); // At least one grade > 0
                const hasTeachers = uiTeachers.length > 0;
                const hasSubjects = uiSubjects.length > 0;
                const hasClubs = uiClubs.length > 0;

                const validationErrors = [];
                if (!hasValidCounts) validationErrors.push('- 학급 수 (적어도 한 학년은 입력해야 합니다)');
                if (!hasTeachers) validationErrors.push('- 과학과 교사 (최소 1명 이상)');
                if (!hasSubjects) validationErrors.push('- 운영 과목 (최소 1개 이상)');
                if (!hasClubs) validationErrors.push('- 동아리 (최소 1개 이상)');

                if (validationErrors.length > 0) {
                    alert('다음 항목을 모두 입력해야 저장할 수 있습니다:\n\n' + validationErrors.join('\n'));
                    return;
                }

                // --- 3. Check for Changes (UI vs DB) & Determine Initial State ---
                async function fetchCurrentData() {
                    const [t, s, cl, co, sem] = await Promise.all([
                        supabase.from('lab_teachers').select('name').eq('semester_id', currentSemesterId).order('id'),
                        supabase.from('lab_subjects').select('name').eq('semester_id', currentSemesterId).order('id'),
                        supabase.from('lab_clubs').select('name').eq('semester_id', currentSemesterId).order('id'),
                        supabase.from('lab_class_counts').select('*').eq('semester_id', currentSemesterId),
                        supabase.from('lab_semesters').select('*').eq('id', currentSemesterId).single()
                    ]);

                    // Determine if DB is empty
                    const isEmpty = (t.data.length === 0) && (s.data.length === 0) && (cl.data.length === 0) &&
                        (co.data.length === 0 || co.data.every(x => x.class_count === 0));

                    return {
                        teachers: t.data.map(i => i.name),
                        subjects: s.data.map(i => i.name),
                        clubs: cl.data.map(i => i.name),
                        counts: co.data || [],
                        semester: sem.data,
                        isInitialState: isEmpty
                    };
                }

                const dbData = await fetchCurrentData();

                // Comparators
                const isListDifferent = (arr1, arr2) => {
                    if (arr1.length !== arr2.length) return true;
                    // Strict index comparison as inputs are list based.
                    return arr1.some((val, idx) => val !== arr2[idx]);
                }
                const isCountDifferent = (ui, db) => {
                    return ui.some(u => {
                        const d = db.find(x => x.grade === u.grade);
                        return u.count !== (d ? d.class_count : 0);
                    });
                }

                const criticalChanged = isListDifferent(uiTeachers, dbData.teachers) ||
                    isListDifferent(uiSubjects, dbData.subjects) ||
                    isCountDifferent(uiCounts, dbData.counts);

                const clubChanged = isListDifferent(uiClubs, dbData.clubs);
                const hasChanged = criticalChanged || clubChanged;


                if (!hasChanged) {
                    alert('변경사항이 없습니다.');
                    return;
                }

                // --- 4. Logic Branch: Direct Save vs Version Update ---

                // Helper: Direct Save Transaction (Reusable)
                async function executeDirectSave(successMessage) {
                    try {
                        // Counts (Delete & Re-insert strategy to avoid constraint 400 errors)
                        const countUpserts = uiCounts.map(c => ({
                            semester_id: currentSemesterId,
                            grade: c.grade,
                            class_count: c.count
                        }));
                        await supabase.from('lab_class_counts').delete().eq('semester_id', currentSemesterId);
                        const { error: cntErr } = await supabase.from('lab_class_counts').insert(countUpserts);
                        if (cntErr) throw cntErr;

                        // Lists (Sync)
                        await saveDynamicList('lab_teachers', 'teachers-list');
                        await saveDynamicList('lab_subjects', 'subjects-list');
                        await saveDynamicList('lab_clubs', 'clubs-list');

                        alert(successMessage);
                        await loadSemesters(currentSemesterId);
                    } catch (err) {
                        console.error('Direct save error:', err);
                        alert('저장 중 오류가 발생했습니다: ' + err.message);
                    }
                }

                // A. Initial Save (Database Empty)
                // B. Club-Only Change (Minor) - REMOVED BY REQUEST (All changes trigger prompt)
                /* 
                const isDirectSave = !criticalChanged && clubChanged;
                if (isDirectSave) {
                     await executeDirectSave('동아리/부서 설정이 업데이트되었습니다.');
                     return;
                }
                */

                // C. Check if this is a "New Creation" Scenario - REVERTED (Handled by isInitialState)

                // D. Critical Changes -> Prompt User (New Version vs Overwrite)
                // Default: New Version (flow continues downward). 
                // Option: Overwrite (call executeDirectSave and return).

                // --- Helper: Custom Modal Logic ---
                function showVersionChoiceModal() {
                    return new Promise((resolve) => {
                        const modal = document.getElementById('version-choice-modal');
                        const btnNew = document.getElementById('btn-choice-new');
                        const btnOverwrite = document.getElementById('btn-choice-overwrite');
                        const btnCancel = document.getElementById('btn-choice-cancel');

                        if (!modal || !btnNew || !btnOverwrite) {
                            // Fallback if modal elements missing
                            const fallback = confirm('중요 설정이 변경되었습니다.\n[확인] 새 기간 생성\n[취소] 현재 기간 덮어쓰기');
                            resolve(fallback);
                            return;
                        }

                        modal.style.display = 'flex';

                        // Cleanup helper
                        const cleanup = () => {
                            modal.style.display = 'none';
                            btnNew.replaceWith(btnNew.cloneNode(true));
                            btnOverwrite.replaceWith(btnOverwrite.cloneNode(true));
                            btnCancel.replaceWith(btnCancel.cloneNode(true));
                        };

                        // Handlers
                        btnNew.onclick = () => { cleanup(); resolve(true); }; // True = New Version
                        btnOverwrite.onclick = () => { cleanup(); resolve(false); }; // False = Overwrite
                        btnCancel.onclick = () => { cleanup(); resolve(null); }; // Null = Cancel action
                    });
                }

                // C. Critical Changes -> Prompt User (New Version vs Overwrite)
                // Use Custom Modal instead of confirm()

                const choice = await showVersionChoiceModal();

                if (choice === null) {
                    return; // User cancelled the action entirely
                }

                if (choice === false) {
                    // User chose "Overwrite" (Keep Current Period)
                    await executeDirectSave('현재 기간 설정이 수정되었습니다.');
                    return;
                }

                // choice === true -> Proceed to Versioning (below)

                // CASE D: Versioning Required (User chose OK)
                const modificationContainer = document.getElementById('modification-date-container');
                const modificationInput = document.getElementById('modification-date');

                // If not visible yet, show it and stop
                if (modificationContainer.style.display === 'none') {
                    modificationContainer.style.display = 'block';
                    alert('수정 기준 날짜를 입력해주세요.\n(입력란은 저장 버튼 위에 있습니다)');
                    modificationInput.focus();
                    return;
                }

                const modDate = modificationInput.value;
                if (!modDate) {
                    alert('수정 기준 날짜를 선택해주세요.');
                    return;
                }

                if (!confirm(`기준 날짜 [${modDate}]로 새로운 설정 버전을 생성하시겠습니까?\n\n- 기존 설정은 [${modDate}] 전날까지로 보존됩니다.`)) {
                    return;
                }

                // --- 5. TRANSACTION: Versioning ---
                try {
                    // Start of Logic
                    const oldSemester = dbData.semester;
                    const oldEnd = new Date(modDate);
                    oldEnd.setDate(oldEnd.getDate() - 1);
                    const oldEndDateStr = oldEnd.toISOString().split('T')[0];

                    // --- Naming Logic Modification ---
                    // Goal: Old -> "Base_N기간", New -> "Base_현재"

                    // 1. Determine "Base Name" (e.g., "2025학년도")
                    let baseName = oldSemester.name;
                    // Remove existing suffix if present
                    baseName = baseName.replace(/_현재$/, '');
                    baseName = baseName.replace(/_\d+기간$/, '');

                    // 2. Find next sequence number (N)
                    // Query for all names starting with BaseName + "_"
                    const { data: existingSimilar, error: searchError } = await supabase
                        .from('lab_semesters')
                        .select('name')
                        .ilike('name', `${baseName}_%`);

                    if (searchError) throw searchError;

                    let maxSeq = 0;
                    existingSimilar.forEach(item => {
                        const match = item.name.match(/_(\d+)기간$/);
                        if (match) {
                            const seq = parseInt(match[1]);
                            if (seq > maxSeq) maxSeq = seq;
                        }
                    });

                    const nextSeq = maxSeq + 1;

                    // 3. Define Names
                    const oldNameFinal = `${baseName}_${nextSeq}기간`;
                    const newNameFinal = `${baseName}_현재`;


                    // A. Update Old Semester (Rename to _N기간 & EndDate)
                    const { error: updateError } = await supabase
                        .from('lab_semesters')
                        .update({
                            name: oldNameFinal,
                            end_date: oldEndDateStr
                        })
                        .eq('id', currentSemesterId);

                    if (updateError) throw updateError;


                    // B. Create New Semester (Name as _현재 & StartDate)
                    const { data: newSemData, error: insertError } = await supabase
                        .from('lab_semesters')
                        .insert([{
                            name: newNameFinal,
                            start_date: modDate
                        }])
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    const newSemesterId = newSemData.id;


                    // C. Duplicate/Save Data to NEW Semester ID

                    // Counts
                    const countInserts = uiCounts.map(c => ({
                        semester_id: newSemesterId,
                        grade: c.grade,
                        class_count: c.count
                    }));
                    if (countInserts.length) await supabase.from('lab_class_counts').insert(countInserts);

                    // Dynamic Lists (Teachers, Subjects, Clubs) -> Insert UI values as NEW items
                    const insertList = async (list, table) => {
                        if (!list.length) return;
                        const rows = list.map(name => ({
                            semester_id: newSemesterId,
                            name: name
                        }));
                        await supabase.from(table).insert(rows);
                    };

                    await insertList(uiTeachers, 'lab_teachers');
                    await insertList(uiSubjects, 'lab_subjects');
                    await insertList(uiClubs, 'lab_clubs');


                    // Finalize
                    alert(`저장되었습니다.\n\n이전 기록 보존: ${oldNameFinal} (종료: ${oldEndDateStr})\n현재 설정 적용: ${newNameFinal} (시작: ${modDate})`);

                    // Reset UI
                    modificationInput.value = '';
                    modificationContainer.style.display = 'none';

                    // Reload Global State
                    await loadSemesters(newSemesterId);

                } catch (err) {
                    console.error('Error in versioning transaction:', err);
                    alert('저장 중 오류가 발생했습니다: ' + err.message);
                }
            });
        }

        async function saveDynamicList(tableName, containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            const inputs = container.querySelectorAll('input');

            const { data: dbItems } = await supabase
                .from(tableName)
                .select('id')
                .eq('semester_id', currentSemesterId);
            const dbIds = new Set((dbItems || []).map(i => i.id));
            const uiIds = new Set();

            const itemsToInsert = [];
            const itemsToUpdate = [];

            inputs.forEach(input => {
                const val = input.value.trim();
                const id = input.dataset.id ? parseInt(input.dataset.id) : null;

                if (val) {
                    const row = { name: val, semester_id: currentSemesterId };
                    if (id) {
                        row.id = id;
                        uiIds.add(id);
                        itemsToUpdate.push(row);
                    } else {
                        itemsToInsert.push(row);
                    }
                }
            });

            // Execute Insert
            if (itemsToInsert.length > 0) {
                const { error } = await supabase.from(tableName).insert(itemsToInsert);
                if (error) throw error;
            }

            // Execute Update
            if (itemsToUpdate.length > 0) {
                const updatePromises = itemsToUpdate.map(item => {
                    const { id, ...fields } = item;
                    return supabase.from(tableName).update(fields).eq('id', id);
                });
                await Promise.all(updatePromises);
            }

            const toDelete = [...dbIds].filter(x => !uiIds.has(x));
            if (toDelete.length > 0) {
                await supabase.from(tableName).delete().in('id', toDelete);
            }

            await loadDynamicList(tableName, containerId);
        }
        // Initialize after all declarations
        // ==========================================
        // Tab 3: DB Backup/Restore Logic
        // ==========================================

        const btnExportDB = document.getElementById('btn-export-db');
        const btnTriggerImport = document.getElementById('btn-trigger-import');
        const importInput = document.getElementById('import-file-input');
        const restoreStatus = document.querySelector('#restore-status div');
        const restoreStatusContainer = document.getElementById('restore-status');

        function setRestoreStatus(msg, type = 'info') {
            restoreStatusContainer.style.display = 'block';
            restoreStatus.textContent = msg;
            if (type === 'error') {
                restoreStatus.style.backgroundColor = '#ffebee';
                restoreStatus.style.color = '#c62828';
            } else if (type === 'success') {
                restoreStatus.style.backgroundColor = '#e8f5e9';
                restoreStatus.style.color = '#2e7d32';
            } else {
                restoreStatus.style.backgroundColor = '#e3f2fd';
                restoreStatus.style.color = '#1565c0';
            }
        }

        // --- Export Logic ---
        if (btnExportDB) {
            btnExportDB.addEventListener('click', async () => {
                try {
                    btnExportDB.disabled = true;
                    btnExportDB.innerHTML = '<span class="material-symbols-outlined spin">sync</span> 데이터 수집 중...';

                    // Fetch all data
                    const [rooms, semesters, counts, teachers, subjects, clubs] = await Promise.all([
                        supabase.from('lab_rooms').select('*').order('id'),
                        supabase.from('lab_semesters').select('*').order('id'),
                        supabase.from('lab_class_counts').select('*').order('id'),
                        supabase.from('lab_teachers').select('*').order('id'),
                        supabase.from('lab_subjects').select('*').order('id'),
                        supabase.from('lab_clubs').select('*').order('id')
                    ]);

                    // Check errors
                    if (rooms.error) throw rooms.error;
                    if (semesters.error) throw semesters.error;

                    const payload = {
                        version: "1.0",
                        exported_at: new Date().toISOString(),
                        lab_rooms: rooms.data,
                        lab_semesters: semesters.data,
                        lab_class_counts: counts.data,
                        lab_teachers: teachers.data,
                        lab_subjects: subjects.data,
                        lab_clubs: clubs.data
                    };

                    const fileName = `과학실설정_백업_${new Date().toISOString().slice(0, 10)}.json`;
                    downloadJSON(payload, fileName);

                } catch (err) {
                    console.error('Export failed:', err);
                    alert('데이터 내보내기 실패: ' + err.message);
                } finally {
                    btnExportDB.disabled = false;
                    btnExportDB.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: bottom; margin-right: 5px;">download</span> 데이터 내보내기';
                }
            });
        }

        function downloadJSON(data, filename) {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // --- Import Logic ---
        if (btnTriggerImport && importInput) {
            btnTriggerImport.addEventListener('click', () => {
                importInput.value = ''; // Reset
                importInput.click();
            });

            importInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (!confirm(`[주의] 복원을 진행하면 현재의 과학실 설정, 학년도, 교사 등 모든 기초 데이터가 삭제되고 덮어씌워집니다.\n\n정말 복원하시겠습니까?`)) {
                    return;
                }

                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try {
                        const json = JSON.parse(ev.target.result);
                        await handleRestore(json);
                    } catch (err) {
                        console.error('JSON Parse Error:', err);
                        setRestoreStatus('파일 형식이 올바르지 않거나 손상된 JSON 파일입니다.', 'error');
                    }
                };
                reader.readAsText(file);
            });
        }

        async function handleRestore(payload) {
            try {
                setRestoreStatus('데이터 복원 중... 잠시만 기다려주세요.', 'info');

                // Basic Validation
                if (!payload.lab_rooms || !Array.isArray(payload.lab_rooms)) {
                    throw new Error('유효하지 않은 백업 파일입니다 (lab_rooms missing).');
                }

                // Call RPC
                const { error } = await supabase.rpc('restore_lab_settings', { payload: payload });

                if (error) throw error;

                setRestoreStatus('✅ 복원이 완료되었습니다. 페이지를 새로고침하여 확인하세요.', 'success');
                alert('복원이 성공적으로 완료되었습니다.');

                // Optional: Reload Current Tab
                await loadLabRooms();
                await updateTabStatus();
                // If current tab is user settings, reload that too?
                await loadSemesters();

            } catch (err) {
                console.error('Restore failed:', err);
                setRestoreStatus('복원 실패: ' + err.message, 'error');

                if (err.message.includes('foreign key constraint') || err.code === '23503') {
                    alert('복원 실패: 다른 데이터(재고 등)가 이 설정을 참조하고 있어 삭제할 수 없습니다.\n관련 데이터를 먼저 정리해야 합니다.');
                }
            }
        }

        // --- Initialization Calls ---
        // (Moved from dispersed locations to here)
        loadSchoolInfo();
        loadUnansweredQueries();
        loadLabRooms();
        loadSemesters(); // Load semesters -> which loads lists via change handler

        // Initial Tab setup
        initTabs();

    }; // End init

    globalThis.App = globalThis.App || {};
    globalThis.App.LabSettings = LabSettings;
})();
