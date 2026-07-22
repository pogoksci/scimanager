// ================================================================
// /js/app-bootstrap.js — HTML 동적 로드 & 초기화 지원 유틸
// ================================================================
(function () {
  console.log("⚙️ AppBootstrap 모듈 로드됨");

  /** HTML 파일을 비동기 로드하여 target 요소에 삽입 */
  async function includeHTML(file, targetId = "form-container") {
    const container = document.getElementById(targetId);
    if (!container) {
      console.warn(`❌ includeHTML: #${targetId} 요소를 찾을 수 없습니다.`);
      return false;
    }

    console.log(`📥 includeHTML 시작 → ${file}`);

    try {
      // Cache busting: append timestamp
      const url = `${file}?v=${new Date().getTime()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} (${res.statusText})`);
      const html = await res.text();

      // ✅ innerHTML로 삽입
      container.innerHTML = html;
      console.log(`✅ includeHTML 완료 → ${file}`);

      // ✅ 브라우저 렌더링 완료 보장 (2프레임 대기)
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

      // ✅ innerHTML로 삽입된 <script> 수동 실행 (필요 시)
      const scripts = container.querySelectorAll("script");
      for (const old of scripts) {
        const s = document.createElement("script");
        if (old.type) s.type = old.type;
        if (old.src) {
          s.src = old.src;
        } else {
          s.textContent = old.textContent || "";
        }
        old.parentNode.replaceChild(s, old);
      }

      // ✅ 폐수 관리 모듈 동적 로드 (Removed - now loaded in index.js and inited in router.js)

      // -------------------------------------------------
      // 페이지별 후처리
      // -------------------------------------------------
      App.Fab?.setVisibility(false); // 모든 페이지에서 기본 비활성화

      if (file.includes("navbar.html")) {
        console.log("🧭 Navbar HTML 로드 완료");

      } else if (file.includes("main.html")) {
        console.log("🏠 Main 화면 HTML 로드 완료");
        App.Fab?.setVisibility(false);

        // ✅ 렌더링 완료 후 실행 (1프레임 대기)
        requestAnimationFrame(() => {
          const appTitle = document.getElementById("app-title");
          const appVersion = document.getElementById("app-version");
          //  const schoolName = document.getElementById("school-name");

          if (appTitle)
            appTitle.textContent = APP_CONFIG?.APPNAME || "앱명 미정";

          if (appVersion)
            appVersion.textContent = APP_CONFIG?.VERSION || "버전 미정";

          //  if (schoolName)
          //    schoolName.textContent = APP_CONFIG?.SCHOOL || "학교명 미정";

          console.log("🪄 APP_CONFIG 적용 완료:", APP_CONFIG);
        });

      } else if (file.includes("location-list.html")) {
        console.log("📦 시약장 목록 HTML 로드 완료");
        // 중복 호출 방지: Router.js와 Cabinet.js에서 처리함
        // App.Cabinet?.loadList?.();
        // App.Fab?.setVisibility... (Cabinet.js에서 처리)


      } else if (file.includes("cabinet-form.html")) {
        console.log("🧩 시약장 등록 폼 HTML 로드 완료");

      } else if (file.includes("inventory-list.html")) {
        console.log("📦 재고 목록 HTML 로드 완료");

        if (!App.Inventory?.__manualMount) {
          App.Inventory?.bindListPage?.();
          // App.SortDropdown?.init call removed to avoid duplicate initialization
          App.Inventory?.loadList?.();
        } else {
          delete App.Inventory.__manualMount;
        }

        App.Fab?.setVisibility(false);

      } else if (file.includes("inventory-detail.html")) {
        console.log("🧬 재고 상세 HTML 로드 완료");
      } else if (file.includes("inventory-form.html")) {
        console.log("🧾 재고 등록 폼 HTML 로드 완료");
        //App.Forms?.initInventoryForm?.("create", null);
      }

      return true;
    } catch (err) {
      console.error(`❌ includeHTML 실패 (${file}):`, err);
      container.innerHTML = `
        <div style="text-align:center; color:#d33; padding:20px;">
          <p><strong>페이지를 불러오는 중 오류가 발생했습니다.</strong></p>
          <p style="font-size:13px;">(${file})</p>
        </div>`;
      return false;
    }
  }

  // -----------------------------------------------------
  // 2. 앱 시작점
  // -----------------------------------------------------
  async function bootstrap() {
    console.log("🚀 App bootstrap 시작");

    // ✅ 초기엔 splash가 보여야 하므로, home-active 유지 상태로 시작
    document.body.classList.add("home-active");

    // 네비게이션 로드
    const ok = await includeHTML("pages/navbar.html", "navbar-container");
    if (ok && App && App.Navbar && typeof App.Navbar.setup === "function") {
      App.Navbar.setup();
      console.log("✅ Navbar setup complete");
    }

    App.Fab?.setVisibility(false);

    // ✅ splash 해제
    setTimeout(() => {
      document.body.classList.remove("home-active");
      document.body.classList.add("loaded");
      console.log("✅ Bootstrap 완료 — Splash 숨김, 메인화면 전환");
    }, 1000);
  }

  // -----------------------------------------------------
  // 3. 전역 등록 및 실행
  // -----------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.includeHTML = includeHTML;
  globalThis.addEventListener("DOMContentLoaded", bootstrap);

  console.log("✅ AppBootstrap 초기화 완료 — includeHTML 전역 등록됨");
})();
