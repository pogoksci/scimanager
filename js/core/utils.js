// ================================================================
// /js/core/utils.js — 공용 유틸리티 (Deno/브라우저 호환)
// ================================================================
(function () {
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function collectFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    new FormData(form).forEach((v, k) => (data[k] = v));
    return data;
  }

  function base64ToBlob(base64) {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  }

  function setupButtonGroup(groupId, onSelect) {
    const group = document.getElementById(groupId);
    if (!group) return;

    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.disabled) return;

      // 기존 active 표시 처리
      group.querySelectorAll(".active").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // ✅ 선택된 버튼을 App.State에 반영 (핵심 추가)
      if (groupId.includes("area")) {
        App.State.set("area_buttons", btn.textContent.trim());
        App.State.set("area_custom_name", null); // 기타 입력 값이 남아 우선 적용되는 것 방지
        console.log("🧭 area_buttons 업데이트:", btn.textContent.trim());
      } else if (groupId.includes("cabinet_name")) {
        App.State.set("cabinet_name_buttons", btn.textContent.trim());
      } else if (groupId.includes("door_vertical")) {
        App.State.set("door_vertical_split", btn.textContent.trim());
      } else if (groupId.includes("door_horizontal")) {
        App.State.set("door_horizontal_split", btn.textContent.trim());
      } else if (groupId.includes("shelf_height")) {
        App.State.set("shelf_height_buttons", btn.textContent.trim());
      } else if (groupId.includes("storage_columns")) {
        App.State.set("storage_columns_buttons", btn.textContent.trim());
      }

      // 기존 콜백(onSelect)
      if (typeof onSelect === "function") {
        onSelect(btn);
      }
    });
  }

  async function makePayload(state) {
    const verticalMap = { "상중하도어": 3, "상하도어": 2, "단일도어": 1, "단일도어(상하분리없음)": 1 };
    const horizontalMap = { "좌우분리도어": 2, "단일도어": 1 };

    // 1. 시약장 이름 결정
    // '기타' 입력값 > '등록' 시 클릭한 버튼 값 > '수정' 시 폼에 저장된 초기 이름 값
    const cabinetName = state.cabinet_custom_name || state.cabinet_name_buttons || state.cabinet_name;

    // 2. 장소 이름/ID 결정
    // forms.js에서 set("area_id", id)를 통해 ID를 우선 저장함.
    const areaId = state.area_id;
    // 하위 호환성/표시용 이름
    const areaName = state.area_buttons || state.area_custom_name || state.area_name;

    // 3. ⬇️ [수정됨] 폼 값을 DB 값으로 변환
    // '수정' 모드에서 클릭 안하면 state.door_vertical_split이 없으므로, state.door_vertical_count를 대신 사용
    const doorVertical = state.door_vertical_split
      ? verticalMap[state.door_vertical_split] // 1. 클릭한 값 (텍스트)
      : (state.door_vertical_count || null);   // 2. 'edit' 모드의 초기 값 (숫자)

    const doorHorizontal = state.door_horizontal_split
      ? horizontalMap[state.door_horizontal_split] // 1. 클릭한 값 (텍스트)
      : (state.door_horizontal_count || null); // 2. 'edit' 모드의 초기 값 (숫자)

    const shelfHeight = state.shelf_height_buttons
      ? parseInt(state.shelf_height_buttons, 10) // 1. 클릭한 값 (텍스트)
      : (state.shelf_height || null); // 2. 'edit' 모드의 초기 값 (숫자)

    const storageColumns = state.storage_columns_buttons
      ? parseInt(state.storage_columns_buttons, 10) // 1. 클릭한 값 (텍스트)
      : (state.storage_columns || null); // 2. 'edit' 모드의 초기 값 (숫자)

    console.log("🧪 makePayload() area pick =>", {
      area_id: areaId,
      area_buttons: state.area_buttons,
      area_name: areaName,
    });

    // ✅ user_id 추가 (명시적 소유권 할당)
    let userId = null;
    if (globalThis.App && globalThis.App.supabase && globalThis.App.supabase.auth) {
      try {
        // Note: This is async, but makePayload usage in forms.js is awaited.
        // So it IS safe to make it async.
        const { data: { user } } = await globalThis.App.supabase.auth.getUser();
        if (user) {
          userId = user.id;
        }
      } catch (error) {
        console.error("Error fetching user in makePayload:", error);
      }
    }

    // 3. 최종 반환 (Edge Function 입력 구조에 맞춤)
    return {
      cabinet_name: cabinetName,
      area_id: areaId, // ✅ area_name -> area_id (FK to lab_rooms)
      // area_name: areaName, // 제거 (DB에 컬럼 없음)

      // ✅ user_id 전달 (Backend가 Service Role일 경우 대비)
      // Note: We need to get it via async call or from session state if available synchronously.
      // Ideally, the Edge Function extracts it from the token.
      // But adding it here makes it explicit.
      user_id: userId,

      // ⬇️[수정됨] 위에서 계산된 최종 값을 사용
      door_vertical_count: doorVertical,
      door_horizontal_count: doorHorizontal,
      shelf_height: shelfHeight,
      storage_columns: storageColumns,

      // 사진 데이터 (새 사진이 없으면 기존 URL 유지)
      photo_320_base64: state.photo_320_base64 || null,
      photo_160_base64: state.photo_160_base64 || null,
      photo_url_320: state.mode === 'edit' && !state.photo_320_base64 ? state.photo_url_320 : null,
      photo_url_160: state.mode === 'edit' && !state.photo_160_base64 ? state.photo_url_160 : null,
    };
  }

  function computeConversions({ value, unit, molarMass, density }) {
    const v = Number(value);
    const mw = Number(molarMass);
    const dPure = Number(density) || 1; // Pure substance density from DB

    // Result object
    const result = { percent: null, molarity: null, molality: null };

    if (!Number.isFinite(v) || !Number.isFinite(mw) || mw <= 0) return null;

    // Helper: Estimate solution density (g/mL) using linear interpolation
    // solvent (water, d=1) <-> solute (d=dPure)
    const getDensity = (conc, type) => {
      if (dPure === 1) return 1;
      let fraction = 0; // 0 = water, 1 = pure solute
      if (type === "%") {
        fraction = conc / 100;
      } else if (type === "M") {
        const mPure = (dPure * 1000) / mw;
        if (mPure > 0) fraction = conc / mPure;
      }
      // d_soln = d_water + fraction * (d_solute - d_water)
      return 1 + (fraction * (dPure - 1));
    };

    if (unit === "%") {
      const rho = getDensity(v, "%");

      const massSolute = v;
      const totalMass = 100;
      const solutionVolumeL = (totalMass / rho) / 1000;
      const moles = massSolute / mw;

      result.molarity = solutionVolumeL > 0 ? moles / solutionVolumeL : null;

      const solventMassKg = (totalMass - massSolute) / 1000;
      result.molality = solventMassKg > 0 ? moles / solventMassKg : null;
      result.percent = v;

      // Debug info? console.log(`[Conv %] Val:${v}, dPure:${dPure} -> dSoln:${rho.toFixed(3)}, M:${result.molarity?.toFixed(3)}`);

    } else if (unit === "M" || unit === "N") {
      let effectiveM = v;
      // If Unit is N, Molarity = Normality / Valence
      if (unit === "N") {
        const valence = Number(arguments[0].valence) || 1;
        effectiveM = v / valence;
      }

      const rho = getDensity(effectiveM, "M");

      const solutionVolumeL = 1;
      const moles = effectiveM * solutionVolumeL;
      const soluteMassG = moles * mw;
      const solutionMassG = solutionVolumeL * 1000 * rho;

      result.percent = solutionMassG > 0 ? (soluteMassG / solutionMassG) * 100 : null;

      const solventMassKg = (solutionMassG - soluteMassG) / 1000;
      result.molality = solventMassKg > 0 ? moles / solventMassKg : null;
      result.molarity = effectiveM;

      // Debug info? console.log(`[Conv M] Val:${effectiveM}, dPure:${dPure} -> dSoln:${rho.toFixed(3)}, %:${result.percent?.toFixed(3)}`);
    }
    return result;
  }

  async function computeFileHash(file) {
    if (!file) return null;
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
  }

  function bindDateInput({ yearId, monthId, dayId, hiddenId, btnId, initialDate }) {
    const yearInput = document.getElementById(yearId);
    const monthInput = document.getElementById(monthId);
    const dayInput = document.getElementById(dayId);
    const hiddenDateInput = document.getElementById(hiddenId);
    const btnCalendar = document.getElementById(btnId);

    if (!yearInput || !monthInput || !dayInput || !hiddenDateInput) return;

    // 1. Initial Set
    if (initialDate) {
      let d = new Date(initialDate);
      if (!isNaN(d.getTime())) {
        yearInput.value = d.getFullYear();
        monthInput.value = String(d.getMonth() + 1).padStart(2, '0');
        dayInput.value = String(d.getDate()).padStart(2, '0');
        hiddenDateInput.value = initialDate; // Ensure YYYY-MM-DD format if passed correctly
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
        // Just text string match
        const [y, m, dstr] = initialDate.split('-');
        yearInput.value = y;
        monthInput.value = m;
        dayInput.value = dstr;
        hiddenDateInput.value = initialDate;
      }
    } else {
      // Default to Today if explicitly requested? Or leave empty?
      // Logic: Leave empty usually unless specified, but user might want 'Today'.
      // For now, respect passed initialDate only.
    }

    // 2. Sync to Hidden
    const syncToHidden = () => {
      const y = yearInput.value.trim();
      const m = monthInput.value.trim().padStart(2, '0');
      const d = dayInput.value.trim().padStart(2, '0');
      if (y.length === 4 && m.length === 2 && d.length === 2) {
        // Simple validation
        hiddenDateInput.value = `${y}-${m}-${d}`;
      }
    };

    // 3. Auto-focus Logic
    yearInput.addEventListener('focus', () => yearInput.select());
    monthInput.addEventListener('focus', () => monthInput.select());
    dayInput.addEventListener('focus', () => dayInput.select());

    yearInput.addEventListener('input', () => {
      if (yearInput.value.length === 4) monthInput.focus();
      syncToHidden();
    });
    monthInput.addEventListener('input', () => {
      if (monthInput.value.length === 2) dayInput.focus();
      syncToHidden();
    });
    dayInput.addEventListener('input', syncToHidden);

    // 4. Calendar Picker Logic
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

    return {
      getDateString: () => hiddenDateInput.value || null,
      setDate: (dateStr) => {
        if (!dateStr) return;
        const [y, m, d] = dateStr.split('-');
        yearInput.value = y;
        monthInput.value = m;
        dayInput.value = d;
        hiddenDateInput.value = dateStr;
      }
    };
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Utils = { sleep, collectFormData, setupButtonGroup, makePayload, base64ToBlob, computeConversions, computeFileHash, bindDateInput };
})();
