// ================================================================
// /js/ui/cabinet.js — DB CRUD / 목록 관리 (재시도 포함 안정 버전)
// ================================================================
(function () {
  // ✅ 전역 App 안전하게 가져오기
  const getApp = () => globalThis.App || {};

  // ✅ supabase 접근용 헬퍼
  const getSupabase = () => getApp().supabase || {};
  const getAPI = () => getApp().API || {};

  // ------------------------------------------------------------
  // 📦 1️⃣ 시약장 목록 로드 (자동 재시도 포함)
  // ------------------------------------------------------------
  async function loadList(retryCount = 0) {
    const supabase = getSupabase();
    const container = document.getElementById("cabinet-list-container");

    if (!container) {
      if (retryCount < 3) {
        console.warn(
          `⚠️ loadList(): DOM 요소를 찾지 못했습니다. ${retryCount + 1}/3 재시도 중...`
        );
        setTimeout(() => loadList(retryCount + 1), 100);
        return;
      }
      console.error("❌ loadList(): DOM 탐색 실패 — 포기");
      return;
    }

    // ✅ FAB 버튼 활성화 (아이콘 추가)
    if (App.Fab && App.Fab.setVisibility) {
      App.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 새 시약장 등록', () => {
        createForm();
      });
    }

    console.log("✅ loadList(): DOM 탐색 성공 — 시약장 목록 불러오기 시작");
    container.innerHTML = `
        <div class="empty-state">
            <span class="material-symbols-outlined">hourglass_empty</span>
            <p>등록된 시약장을 불러오는 중...</p>
        </div>`;

    try {
      console.log("🔍 loadList(): Supabase Query Start...");

      // 1. Auth Check
      const { data: { user } } = await supabase.auth.getUser();
      console.log("👤 loadList(): Current User:", user);

      const { data, error } = await supabase
        .from("Cabinet")
        .select(
          "id,cabinet_name,area_id:lab_rooms!fk_cabinet_lab_rooms(id,room_name),door_vertical_count,door_horizontal_count,shelf_height,storage_columns,photo_url_320,photo_url_160"
        )
        .order("id", { ascending: true });

      console.log("🔍 loadList(): Query Result:", { data, error });

      if (error) throw error;
      if (!data?.length) {
        console.warn("⚠️ loadList(): Data is empty array.");
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">science</span>
                <p>등록된 시약장이 없습니다.</p>
            </div>`;
        return;
      }

      renderCabinetCards(data);

    } catch (err) {
      container.innerHTML = `
          <div class="empty-state">
              <span class="material-symbols-outlined">error</span>
              <p>시약장 목록을 불러올 수 없습니다.</p>
          </div>`;
      console.error("❌ loadList() 오류:", err);
    }
  }

  // ------------------------------------------------------------
  // 🎨 2️⃣ 목록 렌더링
  // ------------------------------------------------------------
  function renderCabinetCards(cabinets) {
    const container = document.getElementById("cabinet-list-container");
    if (!container) {
      console.error("❌ renderCabinetCards: Container not found!");
      return;
    }

    console.log(`🎨 Rendering ${cabinets.length} cabinets...`);

    container.innerHTML = cabinets.map((cab) => {
      const photo = cab.photo_url_320 || cab.photo_url_160 || null;
      // ✅ [수정됨] area_id(Area) -> area_id(lab_rooms)로 변경되면서 속성명도 room_name으로 변경
      const areaName = cab.area_id?.room_name || "위치 없음";
      return `
          <div class="cabinet-card">
            <div class="card-info">
              <h3>${cab.cabinet_name} <small class="area-name">${areaName}</small></h3>
            </div>
            <div class="card-image-placeholder">
              ${photo ? `<img src="${photo}" alt="${cab.cabinet_name}" class="card-image cabinet-card-img-style">` : `<span class="no-photo-text">사진 없음</span>`}
            </div>
            <div class="card-actions">
              <button class="edit-btn" data-id="${cab.id}">수정</button>
              <button class="delete-btn" data-id="${cab.id}">삭제</button>
            </div>
          </div>`;
    }).join("");

    container
      .querySelectorAll(".edit-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          editCabinet(id); // editCabinet 함수 호출
        })
      );

    container
      .querySelectorAll(".delete-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          deleteCabinet(id); // deleteCabinet 함수 호출
        })
      );
  }

  // ------------------------------------------------------------
  // ✏️ 2️⃣ 시약장 수정: 수정 버튼 클릭 시 수정할 시약장의 정보를 불러와서 폼에 표시
  // ------------------------------------------------------------
  async function editCabinet(id) {
    const supabase = getSupabase();
    try {
      const { data: detail, error } = await supabase
        .from("Cabinet")
        .select(
          "id,cabinet_name,area_id:lab_rooms(id,room_name),photo_url_320,photo_url_160,door_vertical_count,door_horizontal_count,shelf_height,storage_columns"
        )
        .eq("id", id)
        .maybeSingle();

      if (error || !detail) throw error || new Error("시약장 없음");

      // ⬇️ [수정됨] HTML 로드 코드를 제거하고 initCabinetForm만 호출합니다.
      if (App.Forms && typeof App.Forms.initCabinetForm === "function") {
        App.Forms.initCabinetForm("edit", detail);
      }
    } catch (err) {
      console.error("❌ 시약장 불러오기 오류:", err);
      alert("시약장 정보를 불러올 수 없습니다.");
    }
  }

  // ------------------------------------------------------------
  // ➕ 4️⃣ 시약장 등록 / 수정 / 삭제 (Edge Function 호출로 수정됨)
  // ------------------------------------------------------------
  async function createCabinet(payload) {
    const API = getAPI();
    const supabase = getSupabase();

    // ✅ 토큰 확보 (RLS를 위해 필수)
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || API.SUPABASE_ANON_KEY;

    // ⬇️ [수정됨] DB 직접 insert 대신 Edge Function 호출
    await API.callEdge(API.EDGE.CABINET, {
      method: 'POST',
      token, // ✅ User Token 전달
      body: payload
    });
  }
  // 사용자가 폼을 수정하고 저장 클릭 시, DB에 수정사항 반영 (editCabinet과 역할이 다름)
  async function updateCabinet(id, payload) {
    const API = getAPI();
    const supabase = getSupabase();

    // ✅ 토큰 확보
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || API.SUPABASE_ANON_KEY;

    // ⬇️ [수정됨] DB 직접 update 대신 Edge Function 호출
    const patchPayload = {
      ...payload,
      cabinet_id: id
    };
    await API.callEdge(API.EDGE.CABINET, {
      method: 'PATCH',
      token, // ✅ User Token 전달
      body: patchPayload
    });
  }

  async function deleteCabinet(id) {
    const API = getAPI();

    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      // ✅ 공용 delete-area Edge Function 호출
      await API.callEdge(`${API.EDGE.DELETEAREA}?id=${id}&table=Cabinet`, {
        method: "DELETE",
      });

      alert("✅ 시약장이 삭제되었습니다.");

      // ✅ 목록 화면 먼저 로드
      await App.includeHTML("pages/location-list.html");
      // ✅ HTML이 완전히 로드된 뒤에 목록 불러오기 실행
      requestAnimationFrame(() => {
        App.Cabinet?.loadList?.();
      });
    } catch (err) {
      console.error("❌ 시약장 삭제 중 오류:", err);
      alert(err?.message || "삭제 중 오류가 발생했습니다.");
    }
  }

  // ------------------------------------------------------------
  // 🆕 5️⃣ 신규 등록 폼 표시
  // ------------------------------------------------------------
  function createForm() {
    // ⬇️ [수정됨] edit 함수와 동일하게 initCabinetForm만 호출합니다.
    if (App.Forms && typeof App.Forms.initCabinetForm === "function") {
      App.Forms.initCabinetForm("create", null);
    }
  }

  // ------------------------------------------------------------
  // 🌍 4️⃣ 전역 등록
  // ------------------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.Cabinet = {
    loadList,
    editCabinet,
    createCabinet,
    updateCabinet,
    delete: deleteCabinet,
    createForm, // ⬅️ '새 시약장 등록' 버튼이 호출할 함수
  };

  // ✅ 페이지 로드 완료 후 자동 실행 (Router에서 처리하므로 중복 제거)
  // document.addEventListener("DOMContentLoaded", () => {
  //   App.Cabinet?.loadList?.();
  // });

  console.log("✅ App.Cabinet 모듈 로드 완료");
})();
