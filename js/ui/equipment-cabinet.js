// ================================================================
// /js/ui/equipment-cabinet.js — 교구·물품장 관리 (DB: EquipmentCabinet)
// ================================================================
(function () {
    const getApp = () => globalThis.App || {};
    const getSupabase = () => getApp().supabase || {};
    const getAPI = () => getApp().API || {};

    // ------------------------------------------------------------
    // 1️⃣ 목록 로드
    // ------------------------------------------------------------
    async function loadList(retryCount = 0) {
        const supabase = getSupabase();
        const container = document.getElementById("equipment-cabinet-list-container");

        if (!container) {
            if (retryCount < 5) { // Increased retries
                setTimeout(() => loadList(retryCount + 1), 200); // Increased delay
                return;
            }
            console.error("DOM Elements for Equipment Cabinet List not found.");
            return;
        }

        // ✅ FAB 버튼 활성화
        if (App.Fab && App.Fab.setVisibility) {
            App.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 새 교구·물품장 등록', () => {
                createForm();
            });
        }

        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">hourglass_empty</span>
                <p>등록된 교구·물품장을 불러오는 중...</p>
            </div>`;

        try {
            const { data, error } = await supabase
                .from("EquipmentCabinet")
                .select("id,cabinet_name,area_id:lab_rooms!fk_equipment_lab_rooms(id,room_name),door_vertical_count,photo_url_320,photo_url_160")
                .order("id", { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="material-symbols-outlined">inventory</span>
                        <p>등록된 교구·물품장이 없습니다.</p>
                    </div>`;
                return;
            }

            renderCards(data);

        } catch (err) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">error</span>
                    <p>목록을 불러올 수 없습니다.</p>
                </div>`;
            console.error(err);
        }
    }

    // ------------------------------------------------------------
    // 2️⃣ 카드 렌더링
    // ------------------------------------------------------------
    function renderCards(list) {
        const container = document.getElementById("equipment-cabinet-list-container");
        if (!container) return;

        container.innerHTML = list.map((item) => {
            const photo = item.photo_url_320 || item.photo_url_160 || null;
            // ✅ Area -> lab_rooms
            const areaName = item.area_id?.room_name || "위치 없음";
            return `
      <div class="cabinet-card">
        <div class="card-info">
          <h3>${item.cabinet_name} <small class="area-name">${areaName}</small></h3>
        </div>
        <div class="card-image-placeholder">
          ${photo ? `<img src="${photo}" alt="${item.cabinet_name}" class="card-image">` : `<span class="no-photo-text">사진 없음</span>`}
        </div>
        <div class="card-actions">
          <button class="edit-btn" data-id="${item.id}">수정</button>
          <button class="delete-btn" data-id="${item.id}">삭제</button>
        </div>
      </div>`;
        }).join("");

        container.querySelectorAll(".edit-btn").forEach((btn) =>
            btn.addEventListener("click", () => editCabinet(btn.dataset.id))
        );
        container.querySelectorAll(".delete-btn").forEach((btn) =>
            btn.addEventListener("click", () => deleteCabinet(btn.dataset.id))
        );
    }

    // ------------------------------------------------------------
    // 3️⃣ 수정
    // ------------------------------------------------------------
    async function editCabinet(id) {
        const supabase = getSupabase();
        try {
            const { data: detail, error } = await supabase
                .from("EquipmentCabinet")
                .select("*")
                .eq("id", id)
                .maybeSingle();

            if (error || !detail) throw error || new Error("데이터 없음");

            if (App.Forms && typeof App.Forms.initEquipmentCabinetForm === "function") {
                App.Forms.initEquipmentCabinetForm("edit", detail);
            }
        } catch (err) {
            console.error(err);
            alert("정보를 불러올 수 없습니다.");
        }
    }

    // ------------------------------------------------------------
    // 4️⃣ 생성/수정/삭제 (Edge Function 호출)
    // ------------------------------------------------------------
    async function createCabinet(payload) {
        const supabase = getSupabase(); // Use supabase directly
        // Edge Function 'equipment-cabinet' 호출
        const { data, error } = await supabase.functions.invoke('equipment-cabinet', {
            body: {
                method: 'POST',
                ...payload
            }
        });

        if (error) throw error;
        return data;
    }

    async function updateCabinet(id, payload) {
        const supabase = getSupabase();
        const patchPayload = {
            ...payload,
            cabinet_id: id
        };
        const { data, error } = await supabase.functions.invoke('equipment-cabinet', {
            body: {
                method: 'PATCH',
                ...patchPayload
            }
        });

        if (error) throw error;
        return data;
    }

    async function deleteCabinet(id) {
        const API = getAPI();
        if (!confirm("정말 삭제하시겠습니까?")) return;

        try {
            // API.callEdge 삭제 기능을 supabase.functions.invoke로 대체
            const supabase = getSupabase();
            const { error } = await supabase.functions.invoke('equipment-cabinet', {
                body: { method: 'DELETE', cabinet_id: id }
            });

            if (error) throw error;

            alert("✅ 삭제되었습니다.");
            await App.includeHTML("pages/equipment-cabinet-list.html");
            requestAnimationFrame(() => loadList());
        } catch (err) {
            console.error(err);
            // Fallback: 직접 삭제
            const supabase = getSupabase();
            const { error } = await supabase.from("EquipmentCabinet").delete().eq("id", id);
            if (error) {
                alert("삭제 실패: " + error.message);
            } else {
                alert("✅ 삭제되었습니다.");
                await App.includeHTML("pages/equipment-cabinet-list.html");
                requestAnimationFrame(() => loadList());
            }
        }
    }

    // ------------------------------------------------------------
    // 5️⃣ 폼 호출
    // ------------------------------------------------------------
    function createForm() {
        if (App.Forms && typeof App.Forms.initEquipmentCabinetForm === "function") {
            App.Forms.initEquipmentCabinetForm("create", null);
        }
    }

    // ------------------------------------------------------------
    // Global Export
    // ------------------------------------------------------------
    globalThis.App = globalThis.App || {};
    globalThis.App.EquipmentCabinet = {
        loadList,
        createForm,
        createCabinet,
        updateCabinet,
        delete: deleteCabinet
    };

})();
