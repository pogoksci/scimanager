// ================================================================
// /js/index.js — 홈 로고 유지 + 비동기 모듈 로딩 최적화
// ================================================================
(async function () {
  console.log("🚀 App index.js 시작 — 모듈 비동기 로딩 중...");

  // ✅ 홈(로고) 화면 표시 + 스크롤 비활성화
  document.body.classList.add("home-active");

  // ------------------------------------------------------------
  // 1️⃣ 모듈 경로 정의
  // ------------------------------------------------------------
  const baseModules = [
    "./js/supabaseClient.js?v=" + new Date().getTime(), // Cache Busting
    "./js/app-bootstrap.js", // includeHTML 정의
  ];
  const coreModules = [
    "./js/core/utils.js",
    "./js/core/state.js",
    "./js/core/api.js",    // 🔄 복구
    "./js/core/camera.js?v=4", // 🔄 복구
    "./js/core/fab.js",
    "./js/ui/auth.js",     // ✅ 인증 모듈 추가
  ];
  const uiModules = [
    "./js/ui/cabinet.js",
    "./js/ui/equipment-cabinet.js",
    "./js/ui/storage-selector.js",
    "./js/ui/forms.js?v=8",
    "./js/ui/inventory.js",
    "./js/ui/inventory-detail.js",
    "./js/ui/navbar.js",
    "./js/ui/data-sync.js",
    "./js/ui/usage-register.js?v=4",
    "./js/ui/waste.js",
    "./js/pages/kits.js",
    "./js/pages/teaching-tools.js",
    "./js/pages/tools-form.js?v=8",
    "./js/pages/kit-form.js?v=8",
    "./js/ui/export-page.js",
    "./js/pages/lab-settings.js",
    "./data/subject-config.js", // ✅ 과목 설정 데이터
    "./js/utils/subject-aliases.js", // ✅ 과목 별칭 (timetable-import보다 먼저 로드)
    "./js/utils/timetable-import.js",

    "./js/pages/lab-timetable.js",
    "./js/pages/lab-timetable-viewer.js",
    "./js/pages/lab-usage-log.js",
    "./js/pages/lab-usage-view.js",
    "./js/pages/lunch-lab-reserve.js",
    "./js/pages/lunch-lab-view.js",
    "./js/pages/safety-edu.js?v=20251227",
    "./js/pages/lab-manual.js?v=20251227",
    "./js/pages/emergency-manual.js?v=20251227",
    "./js/ui/chatbot.js",
  ];
  const componentModules = [
    "./js/components/sort-dropdown.js", // 🔹 여기 추가됨
    "./js/utils/kit-sync.js", // ✅ 키트 동기화 유틸
  ];

  const routerModules = ["./js/router/router.js"];

  // ------------------------------------------------------------
  // 2️⃣ 스크립트 로드 유틸리티
  // ------------------------------------------------------------
  function loadScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = path;
      script.defer = true;
      script.onload = () => {
        console.log(`✅ ${path} 로드 완료`);
        resolve();
      };
      script.onerror = () => reject(`❌ ${path} 로드 실패`);
      document.head.appendChild(script);
    });
  }

  async function loadModulesSequentially(list, label) {
    console.log(`📦 ${label} 모듈 로딩 시작`);
    for (const mod of list) {
      try {
        await loadScript(mod);
      } catch (err) {
        console.error(`❌ ${mod} 로드 실패:`, err);
        throw err;
      }
    }
  }

  // ------------------------------------------------------------
  // 3️⃣ 초기화 함수
  // ------------------------------------------------------------
  async function initApp() {
    console.log("📦 initApp() — 초기화 시작");

    if (typeof App.includeHTML !== "function") {
      console.error("❌ App.includeHTML이 정의되지 않음");
      return;
    }

    // Navbar 로드
    await App.includeHTML("pages/navbar.html", "navbar-container");
    if (App.Navbar?.setup) App.Navbar.setup();

    // ✅ 인증 초기화 (세션 확인)
    if (App.Auth?.init) {
      await App.Auth.init();
    }

    // ✅ 학교 설정 로드 (DB에서 학교명 가져오기)
    if (App.loadGlobalSettings) {
      await App.loadGlobalSettings();
    }

    // ---------------------------------------------------
    // ✅ Navbar 로드 후, 스플래시 텍스트를 최종 상태(학교명)로 변경
    // ---------------------------------------------------
    const { APPNAME, SCHOOL } = globalThis.APP_CONFIG || {};
    const titleEl = document.getElementById("app-title");
    const schoolEl = document.getElementById("school-name");

    if (titleEl && APPNAME) titleEl.textContent = APPNAME;
    if (schoolEl && SCHOOL) schoolEl.textContent = SCHOOL;
    console.log("🔄 Splash 화면 텍스트 업데이트 완료 (학교명)");

    // Main 화면 로드 (로그인 여부와 상관없이 메인 로드)
    await App.includeHTML("pages/main.html", "form-container");
    console.log("🔓 게스트/로그인 모드 진입");

    // FAB 숨김
    App.Fab?.setVisibility(false);

    // ------------------------------------------------------------
    // ⚠️ Check API Expiration
    // ------------------------------------------------------------
    const checkApiExp = () => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        const warnings = [];
        const check = (key, name) => {
            const dateStr = globalThis.APP_CONFIG?.[key];
            if (!dateStr) return;
            
            const expDate = new Date(dateStr);
            const diffTime = expDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 7 && diffDays >= 0) {
                warnings.push(`[${name}] API 만료 <b>${diffDays}일 전</b> (${dateStr})`);
            } else if (diffDays < 0) {
                warnings.push(`[${name}] API <b>기간 만료</b> (${dateStr})`);
            }
        };

        check('API_EXP_CAS', 'CAS');
        check('API_EXP_KOSHA', '한국산업안전보건공단');
        check('API_EXP_KREACH', '한국환경공단');

        if (warnings.length > 0) {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                let warnBox = document.getElementById('api-warn-box');
                if (!warnBox) {
                    warnBox = document.createElement('div');
                    warnBox.id = 'api-warn-box';
                    warnBox.style.marginTop = '20px';
                    warnBox.style.padding = '10px';
                    warnBox.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                    warnBox.style.color = '#d32f2f';
                    warnBox.style.borderRadius = '8px';
                    warnBox.style.fontSize = '14px';
                    warnBox.style.textAlign = 'center';
                    warnBox.style.fontWeight = 'bold';
                    splash.appendChild(warnBox);
                }
                warnBox.innerHTML = warnings.join('<br>');
            }
        }
    };
    checkApiExp();

    // 🤖 챗봇 초기화
    if (App.Chatbot && typeof App.Chatbot.init === "function") {
      App.Chatbot.init();
    }

    console.log("✅ 초기화 완료 — App 실행 중");

    // 🚫 더 이상 splash를 숨기지 않음 (홈 로고로 계속 유지)
    console.log("🏠 홈 로고 화면 유지 중 (home-active 상태 지속)");
  }

  // ---------------------------------------------------
  // Splash 화면 텍스트 즉시 반영 (index.html 기반)
  // ---------------------------------------------------
  function updateSplashScreenText() {
    const { APPNAME, VERSION, SCHOOL } = globalThis.APP_CONFIG || {};

    const titleEl = document.getElementById("app-title");
    const verEl = document.getElementById("app-version");
    const schoolEl = document.getElementById("school-name");

    if (titleEl) titleEl.textContent = APPNAME || "";
    if (verEl) verEl.textContent = VERSION || "";
    if (schoolEl) schoolEl.textContent = SCHOOL || "";

    console.log("🔄 Splash 화면 텍스트 업데이트 완료");
  }

  // DOMContentLoaded 또는 initApp에서 실행
  document.addEventListener("DOMContentLoaded", () => {
    // updateSplashScreenText(); // 🚫 초기 로딩 시 텍스트 덮어쓰기 방지 (HTML 하드코딩 사용)
  });

  // ------------------------------------------------------------
  // 4️⃣ 실행 순서
  // ------------------------------------------------------------
  try {
    await loadModulesSequentially(baseModules, "Base");
    await loadModulesSequentially(coreModules, "Core");
    await loadModulesSequentially(componentModules, "Components"); // ✅ UI보다 먼저 로드
    await loadModulesSequentially(uiModules, "UI");
    await loadModulesSequentially(routerModules, "Router");
    console.log("🧩 모든 모듈 로드 완료!");

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initApp);
    } else {
      await initApp();
    }
  } catch (err) {
    console.error("❌ 전체 모듈 로드 실패:", err);
    alert("필수 스크립트를 불러오지 못했습니다.");
  }
})();
