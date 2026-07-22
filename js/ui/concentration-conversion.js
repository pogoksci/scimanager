// ================================================================
// /js/ui/concentration-conversion.js
// 스마트 농도 변환 레시피 모듈
// ================================================================

(function () {
    console.log("🧪 App.ConcentrationConversion Module Loaded");

    const getApp = () => globalThis.App || {};
    const getSupabase = () => getApp().supabase;

    const ConcentrationConversion = {
        // State
        currentInventory: null, // 현재 보고 있는 재고 데이터
        modalElement: null,

        // ----------------------------------------------------------------
        // 1. Initialize & UI
        // ----------------------------------------------------------------
        openModal: function (inventoryData) {
            this.currentInventory = inventoryData;
            this.createModalIfNotExists();
            this.renderModalContent();
            this.modalElement.style.display = "flex";

            // 초기 포커스
            setTimeout(() => {
                document.getElementById("calc-target-vol").focus();
            }, 100);
        },

        closeModal: function () {
            if (this.modalElement) {
                this.modalElement.style.display = "none";
            }
        },

        createModalIfNotExists: function () {
            const existing = document.getElementById("modal-conc-conversion");
            if (existing) {
                this.modalElement = existing;
                return;
            }

            const modalHtml = `
            <div id="modal-conc-conversion" class="modal-overlay" style="display:none; z-index: 9999;">
                <div class="conc-modal-container">
                    <div class="modal-header">
                        <h3>🧪 농도 변환 레시피</h3>
                        <!-- <button id="btn-close-conc" class="close-btn">&times;</button> -->
                    </div>
                    <div class="modal-body" id="conc-modal-body" style="overflow-y: auto;">
                        <!-- Content Injected Here -->
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: center; gap: 10px; padding-top: 15px; flex-shrink: 0;">
                        <button class="btn-secondary" id="btn-conc-cancel">닫기</button>
                        <button class="btn-primary" id="btn-conc-calc">계산하기</button>
                    </div>
                </div>
            </div>
            `;

            document.body.insertAdjacentHTML("beforeend", modalHtml);
            this.modalElement = document.getElementById("modal-conc-conversion");

            // Event Bindings
            // document.getElementById("btn-close-conc").onclick = () => this.closeModal();
            document.getElementById("btn-conc-cancel").onclick = () => this.closeModal();

            this.modalElement.addEventListener("click", (e) => {
                if (e.target === this.modalElement) this.closeModal();
            });
        },

        renderModalContent: function () {
            const body = document.getElementById("conc-modal-body");
            if (!body) return;

            // 현재 물질 정보 요약
            const name = this.currentInventory.edited_name_kor || this.currentInventory.Substance?.chem_name_kor_mod || "알 수 없는 물질";
            const currentConc = this.currentInventory.concentration_value || "-";
            const currentUnit = this.currentInventory.concentration_unit || "";
            const density = this.extractDensity(this.currentInventory) || "정보 없음";
            const mw = this.currentInventory.Substance?.molecular_mass || "정보 없음";

            body.innerHTML = `
                <div class="conc-info-summary">
                    <strong>현재 물질:</strong> ${name}<br>
                    <strong>현재 농도/순도:</strong> ${currentConc} ${currentUnit}<br>
                    <span style="color: #666;">(MW: ${mw}, 밀도: ${density})</span>
                </div>

                <div class="conc-input-row">
                    <div style="flex: 1;">
                        <label class="conc-label">만들고자 하는 부피 (mL)</label>
                        <input type="number" id="calc-target-vol" class="form-input" placeholder="예: 500" style="width: 100%;">
                    </div>
                </div>

                <div class="conc-input-group">
                    <div style="flex: 1;">
                        <label class="conc-label">목표 농도 값</label>
                        <input type="number" step="any" id="calc-target-conc" class="form-input" placeholder="예: 0.1" style="width: 100%;">
                    </div>
                    <div style="flex: 1;">
                        <label class="conc-label">단위</label>
                        <select id="calc-target-unit" class="form-select" style="width: 100%;">
                            <option value="M">M (몰농도)</option>
                            <option value="%">% (퍼센트)</option>
                            <option value="mM">mM</option>
                            <option value="N">N (노르말)</option>
                        </select>
                    </div>
                </div>

                <div class="conc-input-row" style="margin-top: 10px;">
                    <div style="flex: 1;">
                        <label class="conc-label">제조자 이름 (직접 입력)</label>
                        <input type="text" id="calc-maker-name" class="form-input" placeholder="예: 홍길동 (미입력 시 직접 수정 가능)" style="width: 100%;">
                    </div>
                </div>

                <!-- Density Input (Hidden by default, shown if needed) -->
                <div id="conc-density-input-area" class="conc-density-area">
                    <label class="conc-density-label">⚠️ 밀도 정보 필요</label>
                    <p class="conc-density-desc">정확한 변환을 위해 밀도(g/mL) 값이 필요합니다.</p>
                    <input type="number" step="any" id="calc-density-manual" class="form-input" placeholder="예: 1.0" value="1.0">
                </div>

                <div id="conc-result-area" class="conc-result-area">
                    <!-- Result will be rendered here -->
                </div>
            `;

            // 바인딩
            document.getElementById("btn-conc-calc").onclick = async () => await this.calculate();

            // 엔터키 트리거
            const inputs = body.querySelectorAll("input");
            inputs.forEach(input => {
                input.addEventListener("keyup", (e) => {
                    if (e.key === "Enter") this.calculate();
                });
            });
        },

        // ----------------------------------------------------------------
        // 2. Logic Core
        // ----------------------------------------------------------------
        extractDensity: function (data) {
            // Properties에서 Density 찾기
            const props = data.Substance?.Properties || [];
            const densityProp = props.find(p => p.name && p.name.toLowerCase().includes("density"));
            if (!densityProp) return null;

            // "1.18 g/mL at 25 C" 같은 문자열에서 숫자 추출
            const match = densityProp.property.match(/([0-9.]+)\s*g\/cm3|([0-9.]+)\s*g\/mL|([0-9.]+)/i);
            if (match) {
                return parseFloat(match[1] || match[2] || match[3]);
            }
            return null;
        },

        calculate: async function () {
            const resultArea = document.getElementById("conc-result-area");
            resultArea.style.display = "block";
            resultArea.innerHTML = '<div style="text-align: center;"><span class="loader"></span> 계산 중...</div>';

            const targetVol = parseFloat(document.getElementById("calc-target-vol").value);
            const targetConc = parseFloat(document.getElementById("calc-target-conc").value);
            const targetUnit = document.getElementById("calc-target-unit").value;
            const makerInputVal = document.getElementById("calc-maker-name")?.value?.trim();
            let densityManual = parseFloat(document.getElementById("calc-density-manual")?.value);

            if (!targetVol || !targetConc) {
                resultArea.innerHTML = '<p class="text-red-500">부피와 농도 값을 모두 입력해주세요.</p>';
                return;
            }

            // 1. Prepare Data
            const inventory = this.currentInventory;
            const mw = parseFloat(inventory.Substance?.molecular_mass) || 0;
            const currentConcVal = parseFloat(inventory.concentration_value) || 0;
            const currentUnit = inventory.concentration_unit; // e.g., 'M', '%', 'N'
            let density = this.extractDensity(inventory);

            // Unit Handling
            // We standardize everything to:
            // - Molarity (M) for liquids calculation if possible
            // - Mass (g) for solid calculation

            // Determine Source Type
            const state = (inventory.state || "").trim();
            const isSolid = ["고체", "파우더", "가루", "Solid", "Powder"].some(s => state.includes(s));

            let plan = null; // { type: 'dilution' | 'solid' | 'purchase', details:... }

            // ---------------------------------------------------
            // Case A: Solid Source -> Liquid Target
            // ---------------------------------------------------
            if (isSolid) {
                // Formula: Mass = Vol(L) * Molarity(mol/L) * MW(g/mol)
                // If Target is %, Mass = Vol(mL) * Density(sol) * %/100  (approx, assuming density of water ~1 for dilute, or user needs final mass)

                // Purity Correction
                // If solid has concentration_value (e.g. 98%), treat it as purity.
                // If null, assume 100% or warn? Assume 100 if unit is missing, or interpret % properly.
                let purity = 1.0;
                if (currentUnit === "%" && currentConcVal) {
                    purity = currentConcVal / 100;
                }

                if (targetUnit === "M" || targetUnit === "mM" || targetUnit === "N") {
                    if (!mw) {
                        resultArea.innerHTML = '<p class="text-red-500">분자량(MW) 정보가 없어 몰농도 계산을 할 수 없습니다.</p>';
                        return;
                    }

                    let targetM = targetConc;
                    if (targetUnit === "mM") targetM = targetConc / 1000;
                    if (targetUnit === "N") {
                        const valence = inventory.valence || 1; // Default 1 if unknown, usually requires human input but simplified here
                        targetM = targetConc / valence;
                    }

                    const volL = targetVol / 1000;
                    const requiredMoles = targetM * volL;
                    let requiredMass = requiredMoles * mw;

                    // Apply Purity
                    requiredMass = requiredMass / purity;

                    plan = {
                        type: 'solid',
                        reqMass: requiredMass,
                        solvent: '증류수', // Default
                        targetVol: targetVol
                    };

                } else if (targetUnit === "%") {
                    // Target: Make 500mL of 10% solution.
                    // Approx: 10g solute in 100mL solution? Or 10g in 90g water?
                    // Standard Lab Recipe usually: w/v % or w/w %? 
                    // School level usually assumes w/w but makes it by adding water to total volume or mass.
                    // Let's assume w/v for simplicity in "making X mL", OR w/w if density is known.
                    // Simplest School Recipe: "Dissolve X g to make Y mL solution" -> w/v

                    const requiredMass = (targetVol * (targetConc / 100)) / purity;
                    plan = {
                        type: 'solid',
                        reqMass: requiredMass,
                        solvent: '증류수',
                        targetVol: targetVol
                    };
                }
            }
            // ---------------------------------------------------
            // Case B: Liquid Source -> Dilution
            // ---------------------------------------------------
            else {
                // Need to convert Source and Target to same unit (Molarity usually best)

                // Density Check
                if (!density && !densityManual) {
                    // Check if we need density
                    const needsDensity = (currentUnit === "%" && targetUnit.includes("M")) ||
                        (currentUnit.includes("M") && targetUnit === "%");

                    if (needsDensity) {
                        document.getElementById("conc-density-input-area").style.display = "block";
                        resultArea.style.display = "none";
                        return; // Wait for user input
                    }
                }
                const usedDensity = density || densityManual || 1.0;

                // Normalize Source to Molarity
                let sourceM = 0;
                if (currentUnit === "%") {
                    if (!mw) { resultArea.innerHTML = '<p class="text-red-500">분자량 오류.</p>'; return; }
                    // M = (% * 10 * d) / MW
                    sourceM = (currentConcVal * 10 * usedDensity) / mw;
                } else if (currentUnit === "M") {
                    sourceM = currentConcVal;
                } else if (currentUnit === "N") {
                    const valence = inventory.valence || 1;
                    sourceM = currentConcVal / valence;
                }

                // Normalize Target to Molarity
                let destM = 0;
                if (targetUnit === "%") {
                    // M = (% * 10 * d) / MW  (Target density assumed approx same as water or linear? Use standard approximation)
                    // Using water density(1.0) for dilute target is safer, or iterate. 
                    // Let's use Source Density for conversion if high conc, but Target is likely dilute.
                    // Better: Convert Source % to M, and Target % to M (assuming d=1 for target if low, or just calculate dilution formula via Mass balance if both %)

                    if (currentUnit === "%") {
                        // % -> % : C1V1 = C2V2 (if density changes are ignored, v. approx)
                        // Mass balance: M1(mass) * C1(%) = M2(mass) * C2(%)
                        // V1*d1 * C1 = V2*d2 * C2
                        // V1 = (V2 * d2 * C2) / (d1 * C1)
                        // If dilute target, d2 ~ 1.0. 
                        const targetDensity = 1.0;
                        const reqSourceVol = (targetVol * targetDensity * targetConc) / (usedDensity * currentConcVal);

                        plan = {
                            type: 'dilution',
                            reqVol: reqSourceVol,
                            sourceConc: `${currentConcVal}%`,
                            targetVol: targetVol,
                            solvent: '증류수'
                        };
                        this.renderRecipe(plan, targetVol, targetConc, targetUnit); // Direct render for specific path
                        return;
                    }
                    else {
                        // N/M -> %
                        // Convert Target % to M -> need target density. Assume 1.0 for ease.
                        destM = (targetConc * 10 * 1.0) / mw;
                    }

                } else if (targetUnit === "M") {
                    destM = targetConc;
                } else if (targetUnit === "mM") {
                    destM = targetConc / 1000;
                }

                // Compare
                if (sourceM < destM) {
                    // Concentration too low! Need High Concentration Stock OR Solid
                    await this.suggestAlternativeStock(inventory.Substance?.id, destM, targetVol, targetUnit);
                    return;
                }

                // Dilution Formula: M1 * V1 = M2 * V2
                const reqSourceVol = (destM * targetVol) / sourceM;

                plan = {
                    type: 'dilution',
                    reqVol: reqSourceVol,
                    sourceConc: `${currentConcVal}${currentUnit}`,
                    targetVol: targetVol,
                    solvent: '증류수'
                };
            }

            this.renderRecipe(plan, targetVol, targetConc, targetUnit);

        },

        suggestAlternativeStock: async function (substanceId, targetM, targetVol, targetUnit) {
            const resultArea = document.getElementById("conc-result-area");

            // Search DB
            const { data: alternatives } = await getSupabase()
                .from("Inventory")
                .select("id, concentration_value, concentration_unit, state, current_amount, unit")
                .eq("substance_id", substanceId)
                .neq("id", this.currentInventory.id); // Exclude self

            if (!alternatives || alternatives.length === 0) {
                resultArea.innerHTML = `
                    <div class="alert alert-danger">
                        <h4>⚠️ 농도가 너무 낮습니다</h4>
                        <p>현재 보유한 용액(${this.currentInventory.concentration_value}${this.currentInventory.concentration_unit})으로는<br>
                        목표 농도(${targetM.toFixed(3)}M 상당)를 만들 수 없습니다.</p>
                        <hr>
                        <p><strong>[구입요청 필요]</strong> 더 진한 용액이나 고체 시약의 재고가 없습니다.</p>
                    </div>
                 `;
                return;
            }

            // Simple Logic: just show list of candidates
            // Filter Logic: Exclude self AND items that are identical (same conc/unit) or less useful
            const usefulAlternatives = alternatives.filter(item => {
                // 1. Strict exclusion of self
                if (item.id === this.currentInventory.id) return false;

                // 2. Always keep Solids
                const isSolid = (item.state || "").includes("고체") || (item.state || "").includes("가루") || (item.state || "").includes("Solid") || (item.state || "").includes("Powder");
                if (isSolid) return true;

                // 3. For Liquids:
                const itemVal = parseFloat(item.concentration_value) || 0;
                const currentVal = parseFloat(this.currentInventory.concentration_value) || 0;

                // If units match, compare values
                if (item.concentration_unit === this.currentInventory.concentration_unit) {
                    // Exclude if candidate is less than or equal to current (we need HIGHER concentration)
                    if (itemVal <= currentVal) return false;
                }

                // If units are different, we keep it just in case (unless we implement full conversion)
                return true;
            });

            if (usefulAlternatives.length === 0) {
                resultArea.innerHTML = `
                    <div class="alert alert-danger">
                        <h4>⚠️ 농도가 너무 낮습니다</h4>
                        <p>현재 보유한 용액(${this.currentInventory.concentration_value}${this.currentInventory.concentration_unit})으로는<br>
                        목표 농도(${targetM.toFixed(3)}M 상당)를 만들 수 없습니다.</p>
                        <hr>
                        <p><strong>[구입요청 필요]</strong> 더 진한 용액이나 고체 시약의 재고가 없습니다.</p>
                    </div>
                 `;
                return;
            }

            const candidates = usefulAlternatives.map(item => {
                return `<li>No.${item.id}: ${item.state} (${item.concentration_value || '-'}${item.concentration_unit || ''}) / 재고: ${item.current_amount}${item.unit}</li>`;
            }).join("");

            resultArea.innerHTML = `
                <div class="alert alert-warning">
                    <h4>⚠️ 농도가 너무 낮습니다</h4>
                    <p>현재 선택한 용액으로는 만들 수 없습니다.<br>
                    보유 중인 다른 재고를 확인해보세요:</p>
                    <ul style="text-align: left; margin-top: 10px; font-size: 0.9em;">
                        ${candidates}
                    </ul>
                    <p>재고 목록에서 위 번호를 선택하여 다시 시도하세요.</p>
                </div>
            `;
        },

        renderRecipe: function (plan, targetVol, targetConc, targetUnit) {
            const resultArea = document.getElementById("conc-result-area");
            const inventory = this.currentInventory;
            const chemName = inventory.edited_name_kor || inventory.Substance?.chem_name_kor_mod;
            const today = new Date().toISOString().split('T')[0];
            const isAcid = (inventory.classification || "").includes("산") || (chemName || "").includes("산");

            let stepsHtml = "";
            let prepHtml = "";

            if (plan.type === 'solid') {
                const mass = plan.reqMass.toFixed(2);
                prepHtml = `
                    <li><strong>준비물:</strong> 전자저울, 약포지, 약숟가락, ${targetVol}mL 부피 플라스크, 씻기병(증류수)</li>
                    <li><strong>필요 시약:</strong> ${chemName} 고체 <strong>${mass}g</strong></li>
                `;
                stepsHtml = `
                    <ol class="recipe-steps">
                        <li>전자저울에 약포지를 올리고 영점을 맞춥니다.</li>
                        <li><strong>${chemName} ${mass}g</strong>을 정확히 잰 뒤, 비커에 넣습니다.</li>
                        <li>증류수를 적당량(약 ${Math.floor(targetVol / 2)}mL) 넣어 잘 녹입니다. ${isAcid ? "<br><strong class='text-danger'>※ 주의: 발열 반응이 있을 수 있으니 주의하세요.</strong>" : ""}</li>
                        <li>녹인 용액을 <strong>${targetVol}mL 부피 플라스크</strong>에 옮겨 담습니다.</li>
                        <li>비커를 증류수로 2~3회 헹구어 플라스크에 모두 넣습니다.</li>
                        <li>부피 플라스크의 표시선까지 증류수를 채우고 마개를 닫아 잘 섞습니다.</li>
                    </ol>
                `;
            } else if (plan.type === 'dilution') {
                const reqVol = plan.reqVol.toFixed(2);
                const waterVol = (targetVol - reqVol).toFixed(2);

                prepHtml = `
                    <li><strong>준비물:</strong> 피펫, 피펫 펌프, ${targetVol}mL 부피 플라스크, 증류수</li>
                    <li><strong>필요 시약:</strong> ${chemName} (${plan.sourceConc}) <strong>${reqVol}mL</strong></li>
                `;

                if (isAcid) {
                    stepsHtml = `
                        <ol class="recipe-steps">
                            <li><strong>${targetVol}mL 부피 플라스크</strong>에 증류수를 미리 약 ${(targetVol / 3).toFixed(0)}mL 정도 채웁니다. <br><strong class='text-danger'>(중요: 산을 다룰 때는 항상 물에 산을 넣어야 합니다!)</strong></li>
                            <li>피펫을 사용하여 <strong>${chemName} 원액 ${reqVol}mL</strong>를 취합니다.</li>
                            <li>플라스크 벽면을 따라 천천히 원액을 흘려 넣습니다.</li>
                            <li>부피 플라스크의 표시선까지 나머지 증류수를 조심스럽게 채웁니다.</li>
                            <li>마개를 닫고 위아래로 뒤집으며 잘 섞어줍니다.</li>
                        </ol>
                    `;
                } else {
                    stepsHtml = `
                        <ol class="recipe-steps">
                            <li><strong>${targetVol}mL 부피 플라스크</strong>에 <strong>${chemName} 원액 ${reqVol}mL</strong>를 넣습니다.</li>
                            <li>표시선까지 증류수를 채웁니다. (약 ${waterVol}mL 소요됨)</li>
                            <li>마개를 닫고 위아래로 뒤집으며 잘 섞어줍니다.</li>
                        </ol>
                    `;
                }
            }

            // Stock Usage Warning
            let warningHtml = "";
            const currentStock = parseFloat(inventory.current_amount) || 0;
            const reqStock = (plan.type === 'solid') ? plan.reqMass : plan.reqVol;
            const percentUsed = (reqStock / currentStock) * 100;

            if (percentUsed >= 50) {
                warningHtml = `
                 <div class="alert alert-warning" style="margin-top:10px;">
                    <strong>[재고 경고]</strong> 이 레시피는 현재 보유량(${currentStock})의 <strong>${percentUsed.toFixed(1)}%</strong>를 소모합니다.
                 </div>`;
            } else if (reqStock > currentStock) {
                warningHtml = `
                 <div class="alert alert-danger" style="margin-top:10px;">
                    <strong>[재고 부족]</strong> 현재 보유량(${currentStock})보다 많은 양(${reqStock.toFixed(2)})이 필요합니다.
                 </div>`;
            }

            const makerInputVal = document.getElementById("calc-maker-name")?.value?.trim();
            const defaultUser = getApp().Auth?.user;
            const defaultMaker = defaultUser?.name || defaultUser?.user_metadata?.full_name || defaultUser?.email?.split('@')[0] || "";
            const makerName = makerInputVal || defaultMaker || "";

            // Label Preview
            const labelHtml = `
                <div style="display:flex; flex-direction:column; align-items:center;">
                    <div id="label-capture-area" class="label-preview-card" style="background:white; padding:15px; border:2px dashed #333; width:200px; text-align:center;">
                        <h3 style="margin: 5px 0 10px; border-bottom: 2px solid #000; padding-bottom: 5px;">${chemName}</h3>
                        <div style="font-size: 1.4em; font-weight: bold; margin-bottom: 15px;">
                            ${targetConc}${targetUnit}
                        </div>
                        <div style="font-size: 0.85em; margin-bottom: 5px; text-align: left; padding-left: 10px;">
                            <strong>조제일:</strong> ${today}<br>
                            <strong>제조자:</strong> <span contenteditable="true" id="label-maker-name" style="border-bottom: 1px dashed #74c0fc; padding: 0 4px; outline: none; min-width: 60px; display: inline-block; cursor: text; color: #0056b3; font-weight: bold;" title="클릭하여 제조자 이름을 직접 입력/수정하세요">${makerName || '이름 입력'}</span>
                        </div>
                        ${isAcid ? '<div style="background:orange; color:white; font-weight:bold; margin-top:10px; padding:2px; font-size:0.8em;">산성 / 부식성 주의</div>' : ''}
                    </div>

                    <div style="margin-top: 10px; display:flex; gap: 8px;">
                        <button id="btn-export-png" class="btn-sm" style="font-size:12px; padding:4px 8px; cursor:pointer; background:#fff; border:1px solid #ccc; border-radius:4px;">PNG 저장</button>
                        <button id="btn-export-pdf" class="btn-sm" style="font-size:12px; padding:4px 8px; cursor:pointer; background:#fff; border:1px solid #ccc; border-radius:4px;">PDF 저장</button>
                    </div>

                    <p style="font-size: 0.8em; color: #666; margin-top: 8px;">▲ 클릭하여 제조자 이름을 직접 수정할 수 있습니다.</p>
                </div>
            `;

            resultArea.innerHTML = `
                <div class="recipe-container">
                    <h4 style="border-bottom: 2px solid #00A0B2; padding-bottom: 5px; margin-bottom: 15px; color: #00A0B2;">📋 제조 레시피</h4>
                    
                    ${warningHtml}

                    <div style="background: #f1f3f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
                            ${prepHtml}
                        </ul>
                    </div>

                    ${stepsHtml}

                    <div style="display: flex; justify-content: center;">
                        ${labelHtml}
                    </div>
                </div>
            `;

            // Bind Export Events
            setTimeout(() => {
                const btnPng = document.getElementById("btn-export-png");
                const btnPdf = document.getElementById("btn-export-pdf");

                if (btnPng) btnPng.onclick = () => this.downloadLabelAsPNG(chemName);
                if (btnPdf) btnPdf.onclick = () => this.downloadLabelAsPDF(chemName);
            }, 100);
        },

        downloadLabelAsPNG: function (filename) {
            const element = document.getElementById("label-capture-area");
            if (!element || !window.html2canvas) return;

            html2canvas(element, {
                scale: 2,
                onclone: (clonedDoc) => {
                    const span = clonedDoc.getElementById("label-maker-name");
                    if (span) {
                        span.style.borderBottom = "none";
                        span.style.color = "#000";
                    }
                }
            }).then(canvas => {
                const link = document.createElement("a");
                link.download = `${filename}_Vial_Label.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
            });
        },

        downloadLabelAsPDF: function (filename) {
            const element = document.getElementById("label-capture-area");
            if (!element || !window.html2canvas || !window.jspdf) return;

            html2canvas(element, {
                scale: 2,
                onclone: (clonedDoc) => {
                    const span = clonedDoc.getElementById("label-maker-name");
                    if (span) {
                        span.style.borderBottom = "none";
                        span.style.color = "#000";
                    }
                }
            }).then(canvas => {
                const imgData = canvas.toDataURL("image/png");
                const { jsPDF } = window.jspdf;

                // 60mm x 60mm PDF
                const pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'mm',
                    format: [60, 60]
                });

                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                pdf.save(`${filename}_Vial_Label.pdf`);
            });
        }


    };

    // Export
    getApp().ConcentrationConversion = ConcentrationConversion;

})();
