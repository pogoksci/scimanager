// ================================================================
// /js/ui/storage-selector.js — Cabinet 구조 기반 보관위치 선택기 (공용)
// ================================================================
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  // 내부 상태 관리
  const state = {
    mode: "INVENTORY", // "INVENTORY" (Cabinet) or "EQUIPMENT" (equipment_cabinet)
    area_id: null,
    cabinet_id: null,

    door_vertical_total: null,
    door_horizontal_total: null,
    shelf_level_total: null,
    storage_column_total: null,

    door_vertical: null,
    door_horizontal: null,
    internal_shelf_level: null,
    storage_column: null,
  };

  const LABELS = {
    INVENTORY: {
      step1: "1. 약품실",
      step2: "2. 수납함",
      step3: "3. 수납위치_도어_상중하",
      step4: "4. 수납위치_도어_좌우",
      step5: "5. 수납위치_도어내부_단",
      step6: "6. 수납위치_도어내부_보관열"
    },
    EQUIPMENT: {
      step1: "1. 장소",
      step2: "2. 교구·물품장",
      step3: "3. 수납위치_도어_상중하",
      step4: "4. 수납위치_도어_좌우",
      step5: "5. 수납위치_도어내부_단",
      step6: "6. 수납위치_도어내부_보관열"
    }
  };

  // -------------------------------------------------------------
  // 🔹 공용 UI 생성 헬퍼
  // -------------------------------------------------------------
  function createButtonGroup(options, onClick, activeValue = null) {
    const group = document.createElement("div");
    group.className = "button-group";

    // Dynamic Grid Columns: 항목 수에 맞춰 그리드 컬럼 수 자동 조정
    if (options.length > 0 && options.length <= 12) {
      group.style.display = "grid";
      group.style.gridTemplateColumns = `repeat(${options.length}, 1fr)`;
      group.style.gap = "12px"; // CSS gap match
      // 모바일(좁은 화면) 대응을 위해 items가 많으면 줄바꿈이 일어날 수 있도록 예외처리 가능하나
      // 현재 CSS 구조상 grid가 유리.
    }

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.className = "btn-location";

      if (String(opt.value) === String(activeValue)) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", (e) => {
        // Remove active class from siblings
        group.querySelectorAll('.btn-location').forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        e.currentTarget.classList.add('active');
        onClick(opt.value);
      });

      group.appendChild(btn);
    });

    return group;
  }

  function createStep(title) {
    const step = document.createElement("div");
    step.className = "location-step";

    const label = document.createElement("label");
    label.textContent = title;

    step.appendChild(label);
    return step;
  }

  function clearNextSteps(container, startIndex) {
    const steps = container.querySelectorAll(".location-step");
    for (let i = startIndex; i < steps.length; i++) {
      steps[i].remove();
    }
  }

  // -------------------------------------------------------------
  // 🔹 0. Cabinet 구조(DB) 읽기
  // -------------------------------------------------------------
  async function loadCabinetStructure(cabinetId) {
    const supabase = getSupabase();

    let tableName = "Cabinet";
    // 컬럼 매핑: 내부 state 이름 -> DB 컬럼 이름
    let colMap = {
      vert: "door_vertical_count",
      horiz: "door_horizontal_count",
      shelf: "shelf_height",
      col: "storage_columns"
    };

    if (state.mode === "EQUIPMENT") {
      tableName = "EquipmentCabinet";
      colMap = {
        vert: "door_vertical_count",
        horiz: "door_horizontal_count",
        shelf: "shelf_height",
        col: "storage_columns"
      };
    }

    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", cabinetId)
      .maybeSingle();

    if (error || !data) {
      console.error(`❌ ${tableName} 구조 조회 실패:`, error);
      return null;
    }

    console.log(`📦 ${tableName} 구조:`, data);

    // 정규화하여 반환
    return {
      door_vertical: data[colMap.vert],
      door_horizontal: data[colMap.horiz],
      internal_shelf_level: data[colMap.shelf],
      storage_column: data[colMap.col]
    };
  }

  // -------------------------------------------------------------
  // 🔹 1. Area 선택 (드롭다운)
  // -------------------------------------------------------------
  async function loadAreas(container, initTimestamp) {
    const supabase = getSupabase();
    let cabinetTable = "Cabinet";
    if (state.mode === "EQUIPMENT") cabinetTable = "EquipmentCabinet";

    let cabinetRelation = `${cabinetTable}!inner(id)`;
    // 🚑 Cabinet 테이블인 경우, 중복 관계 오류(PGRST201)를 방지하기 위해 명시적 FK 지정
    if (cabinetTable === "Cabinet") {
      cabinetRelation = `Cabinet!fk_cabinet_lab_rooms!inner(id)`;
    } else if (cabinetTable === "EquipmentCabinet") {
      cabinetRelation = `EquipmentCabinet!fk_equipment_lab_rooms!inner(id)`;
    }

    // Cabinet이 하나라도 있는 Area만 조회 (!inner join)
    const { data, error } = await supabase
      .from("lab_rooms") // ✅ Area -> lab_rooms
      .select(`id, area_name:room_name, ${cabinetRelation}`) // ✅ room_name -> area_name (alias)
      .order("room_name"); // Order by room_name

    // console.log("StorageSelector: loadAreas called. Data:", data, "Error:", error);

    // Race Condition Check: If a new init started, abort
    if (state.initTimestamp !== initTimestamp) {
      console.warn("StorageSelector: Init aborted due to new request.");
      return;
    }

    if (error) {
      console.error("❌ Area 불러오기 실패:", error);
      return;
    }

    const step = createStep(LABELS[state.mode].step1);

    // Dropdown 생성
    const select = document.createElement("select");
    select.className = "form-input"; // Use global input style
    select.innerHTML = '<option value="" disabled selected>-- 장소를 선택하세요 --</option>';

    // 중복 제거 (Area 하나에 여러 Cabinet이 있을 수 있음)
    const uniqueAreas = [];
    const seenIds = new Set();
    data.forEach(d => {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        uniqueAreas.push(d);
      }
    });

    uniqueAreas.forEach(area => {
      const opt = document.createElement("option");
      opt.value = area.id;
      opt.textContent = area.area_name;
      if (state.area_id && Number(state.area_id) === area.id) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", async (e) => {
      const areaId = Number(e.target.value);
      state.area_id = areaId;
      state.area_name = data.find(d => d.id == areaId)?.area_name || "";

      // 초기화
      state.cabinet_id = state.cabinet_name = null;
      state.door_vertical = state.door_horizontal = state.internal_shelf_level = state.storage_column = null;
      state.door_vertical_total = state.door_horizontal_total = state.shelf_level_total = state.storage_column_total = null;

      clearNextSteps(container, 1);
      await loadCabinets(container, areaId);
    });

    step.appendChild(select);
    container.appendChild(step);
  }

  // ... (Skipping to init function) ...

  // -------------------------------------------------------------
  // 🔹 초기화 (inventory-form / kits-modal 에서 호출)
  // -------------------------------------------------------------
  async function init(containerId, defaultValue = {}, mode = "INVENTORY") {
    const container = document.getElementById(containerId);
    if (!container) return console.error("❌ StorageSelector: container not found");

    container.innerHTML = "";

    // 모드 설정
    state.mode = mode;
    state.initTimestamp = Date.now(); // Set new timestamp
    const currentTimestamp = state.initTimestamp;

    Object.assign(state, {
      area_id: defaultValue.area_id || null,
      area_name: defaultValue.area_name || null, // ✅ 이름 복원
      cabinet_id: defaultValue.cabinet_id || null,
      cabinet_name: defaultValue.cabinet_name || null, // ✅ 이름 복원

      door_vertical: defaultValue.door_vertical || null,
      door_horizontal: defaultValue.door_horizontal || null,
      internal_shelf_level: defaultValue.internal_shelf_level || null,
      storage_column: defaultValue.storage_column || null,
    });

    await loadAreas(container, currentTimestamp);

    // Check again before proceeding to dependent cabinets
    if (state.initTimestamp !== currentTimestamp) return;

    // 기본값 자동 오픈 (순차적)
    if (state.area_id) await loadCabinets(container, state.area_id);
    if (state.cabinet_id) {
      // ... (rest of logic same as before, no race condition risk as loadCabinets is sequential here or handled by user interaction later, 
      // strictly speaking loadCabinets is also async, but let's assume loadAreas was the main duplication culprit due to initial load race)

      // However, for consistency, if I could pass timestamp to loadCabinets too that would be better, but loadCabinets is also used by event listener which doesn't have initTimestamp. 
      // Since loadAreas is the entry point for the duplication, checking there is most critical.

      const structure = await loadCabinetStructure(state.cabinet_id);
      if (structure) {
        state.door_vertical_total = structure.door_vertical;
        state.door_horizontal_total = structure.door_horizontal;
        state.shelf_level_total = structure.internal_shelf_level;
        state.storage_column_total = structure.storage_column;
      } else {
        // Fallback defaults
        state.door_vertical_total = 1;
        state.door_horizontal_total = 1;
        state.shelf_level_total = 1;
        state.storage_column_total = 1;
      }

      // 그 후 UI 그리기
      loadDoorVertical(container);
      if (state.mode !== "EQUIPMENT") {
        loadDoorHorizontal(container);
        loadShelfLevels(container);
        loadColumns(container);
      }
    }
  }

  // -------------------------------------------------------------
  // 🔹 2. Cabinet 선택
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // 🔹 2. Cabinet 선택 (드롭다운)
  // -------------------------------------------------------------
  async function loadCabinets(container, areaId) {
    const supabase = getSupabase();
    let tableName = "Cabinet";
    if (state.mode === "EQUIPMENT") {
      tableName = "EquipmentCabinet";
    }

    const { data, error } = await supabase
      .from(tableName)
      .select("id, cabinet_name")
      .eq("area_id", areaId)
      .order("cabinet_name");

    if (error) {
      console.error(`❌ ${tableName} 불러오기 실패:`, error);
      return;
    }

    const stepText = LABELS[state.mode].step2;
    const step = createStep(stepText);

    if (!data.length) {
      step.append("등록된 시약/교구장이 없습니다.");
      container.appendChild(step);
      return;
    }

    // Dropdown 생성
    const select = document.createElement("select");
    select.className = "form-input";
    select.innerHTML = '<option value="" disabled selected>-- 수납함을 선택하세요 --</option>';

    data.forEach(cab => {
      const opt = document.createElement("option");
      opt.value = cab.id;
      opt.textContent = cab.cabinet_name;
      if (state.cabinet_id && Number(state.cabinet_id) === cab.id) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", async (e) => {
      const cabId = Number(e.target.value);
      state.cabinet_id = cabId;
      state.cabinet_name = data.find(c => c.id == cabId)?.cabinet_name || "";

      // Cabinet 구조 읽기
      const structure = await loadCabinetStructure(state.cabinet_id);
      if (structure) {
        state.door_vertical_total = structure.door_vertical;
        state.door_horizontal_total = structure.door_horizontal;
        state.shelf_level_total = structure.internal_shelf_level;
        state.storage_column_total = structure.storage_column;
      } else {
        state.door_vertical_total = 1;
        state.door_horizontal_total = 1;
        state.shelf_level_total = 1;
        state.storage_column_total = 1;
      }

      // 초기화
      state.door_vertical = state.door_horizontal = state.internal_shelf_level = state.storage_column = null;

      clearNextSteps(container, 2);
      loadDoorVertical(container);

      // 🌟 단순 구조(1x1x1) 자동 처리
      const isSimple =
        (Number(state.door_horizontal_total) || 1) <= 1 &&
        (Number(state.shelf_level_total) || 1) <= 1 &&
        (Number(state.storage_column_total) || 1) <= 1;

      if (isSimple && state.mode !== "EQUIPMENT") {
        console.log("⚡ Simple Cabinet Detected. Auto-filling steps 4,5,6.");
        // Auto-Select 1 for hidden fields
        state.door_horizontal = 1;
        state.internal_shelf_level = 1;
        state.storage_column = 1;
        // Do not render steps 4, 5, 6
      }
    });

    step.appendChild(select);
    container.appendChild(step);
  }


  // 🔹 3. 문 상/중/하 선택
  // -------------------------------------------------------------
  function loadDoorVertical(container) {
    const step = createStep("3. 문 상/중/하 선택");

    const count = Number(state.door_vertical_total) || 1;
    // 상/중/하 이름 매핑은 개수에 따라 다를 수 있으나, 여기선 단순히 번호(1번, 2번...) 혹은 상/하
    // 기존 로직: 1,2,3 -> "1번", "2번"...
    // 교구장도 동일한 로직을 사용하겠습니다.

    const options = Array.from({ length: count }, (_, i) => {
      let label = `${i + 1}층`;
      if (count === 1) {
        label = "단일도어";
      }
      return {
        label: label,
        value: i + 1,
      };
    });

    const group = createButtonGroup(
      options,
      (val) => {
        state.door_vertical = Number(val);
        clearNextSteps(container, 3);
        if (state.mode === "EQUIPMENT") return; // Stop here for Equipment
        loadDoorHorizontal(container);
      },
      state.door_vertical
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 4. 문 좌/우 선택
  // -------------------------------------------------------------
  function loadDoorHorizontal(container) {
    const step = createStep("4. 문 좌/우 선택");
    const count = Number(state.door_horizontal_total) || 1;

    const options = Array.from({ length: count }, (_, i) => {
      let label = `${i + 1}번`;
      if (count === 1) {
        label = "문";
      } else if (count === 2) {
        label = i === 0 ? "왼쪽" : "오른쪽";
      }
      return {
        label: label,
        value: i + 1,
      };
    });

    const group = createButtonGroup(
      options,
      (val) => {
        state.door_horizontal = Number(val);
        clearNextSteps(container, 4);
        loadShelfLevels(container);
      },
      state.door_horizontal
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 5. 내부 선반 선택
  // -------------------------------------------------------------
  function loadShelfLevels(container) {
    const step = createStep("5. 내부 선반 선택");
    const count = Number(state.shelf_level_total) || 1;

    const options = Array.from({ length: count }, (_, i) => ({
      label: `${i + 1}단`,
      value: i + 1,
    })).reverse(); // 역순 정렬 (3단, 2단, 1단)

    const group = createButtonGroup(
      options,
      (val) => {
        state.internal_shelf_level = Number(val);
        clearNextSteps(container, 5);
        loadColumns(container);
      },
      state.internal_shelf_level
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 6. 칸(열) 선택
  // -------------------------------------------------------------
  function loadColumns(container) {
    const step = createStep("6. 칸(열) 선택");
    const count = Number(state.storage_column_total) || 1;

    const options = Array.from({ length: count }, (_, i) => ({
      label: `${i + 1}열`,
      value: i + 1,
    }));

    const group = createButtonGroup(
      options,
      (val) => {
        state.storage_column = Number(val);
        console.log("🎯 최종 선택:", { ...state });
      },
      state.storage_column
    );

    step.appendChild(group);
    container.appendChild(step);
  }

  // -------------------------------------------------------------
  // 🔹 초기화 (inventory-form / kits-modal 에서 호출)
  // -------------------------------------------------------------
  async function init(containerId, defaultValue = {}, mode = "INVENTORY") {
    const container = document.getElementById(containerId);
    if (!container) return console.error("❌ StorageSelector: container not found");

    container.innerHTML = "";

    // 모드 설정
    state.mode = mode;

    Object.assign(state, {
      area_id: defaultValue.area_id || null,
      area_name: defaultValue.area_name || null, // ✅ 이름 복원
      cabinet_id: defaultValue.cabinet_id || null,
      cabinet_name: defaultValue.cabinet_name || null, // ✅ 이름 복원

      door_vertical: defaultValue.door_vertical || null,
      door_horizontal: defaultValue.door_horizontal || null,
      internal_shelf_level: defaultValue.internal_shelf_level || null,
      storage_column: defaultValue.storage_column || null,
    });

    await loadAreas(container);

    // 기본값 자동 오픈 (순차적)
    if (state.area_id) await loadCabinets(container, state.area_id);
    if (state.cabinet_id) {
      // 🟢 Fix: Explicitly load structure for the selected cabinet
      const structure = await loadCabinetStructure(state.cabinet_id);
      if (structure) {
        state.door_vertical_total = structure.door_vertical;
        state.door_horizontal_total = structure.door_horizontal;
        state.shelf_level_total = structure.internal_shelf_level;
        state.storage_column_total = structure.storage_column;
      } else {
        // Fallback defaults
        state.door_vertical_total = 1;
        state.door_horizontal_total = 1;
        state.shelf_level_total = 1;
        state.storage_column_total = 1;
      }

      // 그 후 UI 그리기
      loadDoorVertical(container);

      const isSimple =
        (Number(state.door_horizontal_total) || 1) <= 1 &&
        (Number(state.shelf_level_total) || 1) <= 1 &&
        (Number(state.storage_column_total) || 1) <= 1;

      if (state.mode !== "EQUIPMENT") {
        if (isSimple) {
          console.log("⚡ Simple Cabinet Restore. Auto-filling steps 4,5,6.");
          if (!state.door_horizontal) state.door_horizontal = 1;
          if (!state.internal_shelf_level) state.internal_shelf_level = 1;
          if (!state.storage_column) state.storage_column = 1;
        } else {
          loadDoorHorizontal(container);
          loadShelfLevels(container);
          loadColumns(container);
        }
      }
    }
  }

  function getSelection() {
    return { ...state };
  }

  // 전역 등록
  globalThis.App = getApp();
  globalThis.App.StorageSelector = { init, getSelection };
})();
