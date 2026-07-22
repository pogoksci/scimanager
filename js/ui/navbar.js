// ================================================================
// /js/ui/navbar.js — 네비게이션 & Start 메뉴 제어 (ID 정확 매칭, 단일 바인딩)
// ================================================================
(function () {
  console.log("🧭 App.Navbar 모듈 로드됨");

  // ---- 공통: 페이지 로드 헬퍼 ----
  async function loadPage(htmlPath, after) {
    if (typeof includeHTML === "function") {
      await includeHTML(htmlPath, "form-container");
    } else if (typeof App?.includeHTML === "function") {
      await App.includeHTML(htmlPath, "form-container");
    } else {
      console.warn("⚠️ includeHTML 함수가 없습니다.");
    }
    if (typeof after === "function") after();
  }

  // ---- Start 메뉴 열기/닫기 ----
  function setupStartMenuToggle() {
    const toggleBtn = document.getElementById("menu-toggle-btn");
    const startMenu = document.getElementById("start-menu");
    if (!toggleBtn || !startMenu) {
      console.warn("⚠️ Navbar: 메뉴 토글 요소를 찾을 수 없습니다.");
      return;
    }
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startMenu.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!startMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
        startMenu.classList.remove("open");
      }
    });
  }

  function closeStartMenu() {
    const startMenu = document.getElementById("start-menu");
    if (startMenu) startMenu.classList.remove("open");
  }

  function setActive(id) {
    document.querySelectorAll(".nav-item, .menu-item").forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
  }

  // ---- 단일 바인딩: 정확한 ID들만 연결 ----
  function setupExactIdLinks() {
    // 0) 설정 토글 (Settings Toggle)
    const settingsToggle = document.getElementById("menu-settings-toggle");
    const submenuSettings = document.getElementById("submenu-settings");
    if (settingsToggle && submenuSettings) {
      settingsToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = settingsToggle.classList.contains("expanded");
        submenuSettings.style.display = isOpen ? "none" : "block";
        settingsToggle.classList.toggle("expanded", !isOpen);
      });
    }

    // 0-1) 과학실 안전 토글 (Safety Toggle)
    const safetyToggle = document.getElementById("menu-safety-toggle");
    const submenuSafety = document.getElementById("submenu-safety");
    if (safetyToggle && submenuSafety) {
      safetyToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = safetyToggle.classList.contains("expanded");
        submenuSafety.style.display = isOpen ? "none" : "block";
        safetyToggle.classList.toggle("expanded", !isOpen);
      });
    }

    // 1-1) Navbar 모드 전환 (Merged Mode)
    function switchMode(mode) {
      // Toggle Navbar Items
      const managementItems = document.querySelectorAll('.mode-management');

      if (mode === 'MANAGEMENT') {
        managementItems.forEach(el => {
          // 🔒 수불(이력) 메뉴는 Admin만 접근 가능
          if (el.id === 'nav-usage') {
            const user = App.Auth?.user;
            if (user?.role !== 'admin') {
              el.style.display = 'none';
              return;
            }
          }
          el.style.display = 'flex';
        });
      } else {
        // If other modes existed, we would toggle them here.
        managementItems.forEach(el => el.style.display = 'none');
      }
    }

    // 1) Start 메뉴 안의 버튼들
    const menuManagement = document.getElementById("menu-management-btn");
    if (menuManagement) {
      menuManagement.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        switchMode('MANAGEMENT'); // Switch Navbar
        await App.Router.go("inventory"); // Default to inventory
        closeStartMenu();
        setActive("nav-inventory");
      });
    }

    // 3. New 'Science Lab Usage' Group logic handles this now (see below)

    // New Lab Settings Menu
    const menuLabSettings = document.getElementById("menu-lab-settings");
    if (menuLabSettings) {
      menuLabSettings.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("labSettings");
        closeStartMenu();
      });
    }

    const menuLabTimetable = document.getElementById("menu-lab-timetable");
    if (menuLabTimetable) {
      menuLabTimetable.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("labTimetable");
        closeStartMenu();
      });
    }

    // --- 설정 서브메뉴 항목들 ---
    const menuLocation = document.getElementById("menu-location");
    if (menuLocation) {
      menuLocation.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("cabinets");
        closeStartMenu();
        setActive("menu-location");
      });
    }

    const menuEquipCabinet = document.getElementById("menu-equipment-cabinet");
    if (menuEquipCabinet) {
      menuEquipCabinet.addEventListener("click", async (e) => {
        e.preventDefault();
        // ✅ 교구·물품장 설정 페이지 연결 (Router 사용)
        document.body.classList.remove("home-active");

        await App.Router.go("equipmentCabinets");

        closeStartMenu();
        setActive("menu-equipment-cabinet");
      });
    }

    const menuDataSync = document.getElementById("menu-datasync");
    if (menuDataSync) {
      menuDataSync.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("dataSync");
        closeStartMenu();
        setActive("menu-datasync");
      });
    }

    const menuDbReset = document.getElementById("menu-dbreset");
    if (menuDbReset) {
      menuDbReset.addEventListener("click", async (e) => {
        e.preventDefault();

        // 🚨 3-Step Confirmation
        if (!confirm("⚠️ 경고 (1/3)\n\n정말로 모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
        if (!confirm("⚠️ 경고 (2/3)\n\n확실합니까?\n모든 재고, MSDS 파일, 설정된 시약장 정보가 영구적으로 삭제됩니다.")) return;
        if (!confirm("⚠️ 마지막 경고 (3/3)\n\n정말로 초기화하시겠습니까?\n삭제 후에는 절대 복구할 수 없습니다.\n\n진행하려면 [확인]을 누르세요.")) return;

        // 🗑️ Execute Reset
        try {
          const supabase = globalThis.App?.supabase;
          if (!supabase) throw new Error("Supabase client not found");

          console.log("🔥 DB Reset Started (Server-side)...");

          // 🔥 RPC 호출 (관리자 권한 함수 실행)
          const { error } = await supabase.rpc('reset_all_data');

          if (error) throw error;

          console.log(`🗑️ Reset Complete.`);
          alert("✅ DB 초기화가 완료되었습니다.");
          location.reload();

        } catch (err) {
          console.error("❌ DB Reset Failed:", err);
          alert(`초기화 중 오류가 발생했습니다:\n${err.message}`);
        }

      });
    }

    const menuExport = document.getElementById("menu-export");
    if (menuExport) {
      menuExport.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("export");
        closeStartMenu();
      });
    }

    // 3. 과학실 사용 (Lab Usage) Group
    const labUsageToggle = document.getElementById("menu-lab-usage-toggle");
    const submenuLabUsage = document.getElementById("submenu-lab-usage");
    if (labUsageToggle && submenuLabUsage) {
      labUsageToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = labUsageToggle.classList.contains("expanded");
        submenuLabUsage.style.display = isOpen ? "none" : "block";
        labUsageToggle.classList.toggle("expanded", !isOpen);
      });
    }

    const menuLablog = document.getElementById("menu-lablog-btn");
    if (menuLablog) {
      menuLablog.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("labUsageLog");
        closeStartMenu();
      });
    }

    const menuLablogViewer = document.getElementById("menu-lablog-viewer-btn");
    if (menuLablogViewer) {
      menuLablogViewer.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("labUsageView");
        closeStartMenu();
      });
    }

    const menuLunchLabReserve = document.getElementById("menu-lunchlab-reserve-btn");
    if (menuLunchLabReserve) {
      menuLunchLabReserve.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("lunchLabReserve");
        closeStartMenu();
      });
    }

    const menuLunchLabInquiry = document.getElementById("menu-lunchlab-inquiry-btn");
    if (menuLunchLabInquiry) {
      menuLunchLabInquiry.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("lunchLabInquiry");
        closeStartMenu();
      });
    }

    // New Safety & Manual Pages
    const menuSafetyEdu = document.getElementById("menu-safety-edu");
    if (menuSafetyEdu) {
      menuSafetyEdu.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("safetyEdu");
        closeStartMenu();
      });
    }

    const menuLabManual = document.getElementById("menu-lab-manual");
    if (menuLabManual) {
      menuLabManual.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("labManual");
        closeStartMenu();
      });
    }

    const menuEmergency = document.getElementById("menu-emergency");
    if (menuEmergency) {
      menuEmergency.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("emergencyManual");
        closeStartMenu();
      });
    }

    const menuHome = document.getElementById("menu-home");
    if (menuHome) {
      menuHome.addEventListener("click", (e) => {
        e.preventDefault();
        // 홈으로 갈 때도 history push
        App.Router.go("main");

        document.body.classList.add("home-active"); // 로고 화면
        document.body.classList.remove("loaded");

        // 2️⃣ form-container 비우기
        const container = document.getElementById("form-container");
        if (container) container.innerHTML = "";

        App.Fab?.setVisibility(false);
        closeStartMenu();
        setActive("menu-home");

        // 🔥 school-name, app-title, version 갱신
        const { APPNAME, VERSION, SCHOOL } = globalThis.APP_CONFIG || {};
        const titleEl = document.getElementById("app-title");
        const verEl = document.getElementById("app-version");
        const schoolEl = document.getElementById("school-name");

        if (titleEl) titleEl.textContent = APPNAME;
        if (verEl) verEl.textContent = VERSION;
        if (schoolEl) schoolEl.textContent = SCHOOL;
      });
    }

    // 2) 상단 Navbar 영역(정확 ID) - 기존 유지
    const navInventory = document.getElementById("nav-inventory");
    if (navInventory) {
      navInventory.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("inventory");
        closeStartMenu();
        setActive("nav-inventory");
      });
    }

    const navUsage = document.getElementById("nav-usage");
    if (navUsage) {
      navUsage.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("usageRegister"); // ✅ 사용량 등록 페이지 연결
        closeStartMenu();
        setActive("nav-usage");
      });
    }

    const navWaste = document.getElementById("nav-waste");
    if (navWaste) {
      navWaste.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("wasteList");
        closeStartMenu();
        setActive("nav-waste");
      });
    }

    const navKit = document.getElementById("nav-kit");
    if (navKit) {
      navKit.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("kits"); // ✅ 키트 페이지 연결
        closeStartMenu();
        setActive("nav-kit");
      });
    }

    const navTeachingTools = document.getElementById("nav-teaching-tools");
    if (navTeachingTools) {
      navTeachingTools.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("teachingTools");
        closeStartMenu();
        setActive("nav-teaching-tools");
      });
    }



    const navFacilities = document.getElementById("nav-facilities");
    if (navFacilities) {
      navFacilities.addEventListener("click", (e) => {
        e.preventDefault();
        alert("설비 관리 페이지는 준비 중입니다.");
        setActive("nav-facilities");
      });
    }
  }

  // ---- 인증 상태에 따른 UI 업데이트 ----
  function updateAuthUI(user) {
    const role = user?.role || 'guest';

    // 디버그: 실제 권한 확인
    // alert(`현재 권한: ${role}`); 

    const startMenu = document.getElementById("start-menu");
    if (!startMenu) return;

    // 1. 설정 메뉴 (Settings Toggle): Admin, Teacher만 보임
    const settingsToggle = document.getElementById("menu-settings-toggle");
    const settingsSubmenu = document.getElementById("submenu-settings");

    if (settingsToggle) {
      // Teacher or Admin
      if (['admin', 'teacher'].includes(role)) {
        settingsToggle.style.display = 'flex'; // block -> flex for alignment
        // 서브메뉴 상태는 유지하거나 닫음 (여기서는 유지, 사용자가 닫아야 함)
      } else {
        settingsToggle.style.display = 'none';
        // 권한 없으면 서브메뉴도 강제로 닫기
        if (settingsSubmenu) settingsSubmenu.style.display = 'none';
      }
    }

    // 2. DB 초기화 (Reset) & 데이터 동기화 (Data Sync): Admin만 보임
    const dbResetBtn = document.getElementById("menu-dbreset");
    const menuDataSync = document.getElementById("menu-datasync");

    if (dbResetBtn) {
      dbResetBtn.style.display = (role === 'admin') ? 'flex' : 'none'; // flex for correct alignment
    }
    if (menuDataSync) {
      menuDataSync.style.display = ['admin', 'teacher'].includes(role) ? 'flex' : 'none'; // Admin, Teacher 모두 표시
    }

    // 3. 기록 및 예약 (Lablog): Admin, Teacher만 보임
    //    -> Replaced by new Logic below

    // 3-1. 기록 조회 (Lablog Viewer): 모두에게 보임
    //    -> Replaced by new Logic below

    // [New Logic] 3. 과학실 사용 메뉴 그룹 (Lab Usage Group)
    const labUsageToggle = document.getElementById("menu-lab-usage-toggle");
    const submenuLabUsage = document.getElementById("submenu-lab-usage");

    const menuLablog = document.getElementById("menu-lablog-btn");
    const menuLablogViewer = document.getElementById("menu-lablog-viewer-btn");
    const menuLunchLabReserve = document.getElementById("menu-lunchlab-reserve-btn");
    const menuLunchLabInquiry = document.getElementById("menu-lunchlab-inquiry-btn");
    const menuSafetyEdu = document.getElementById("menu-safety-edu");
    const menuLabManual = document.getElementById("menu-lab-manual");

    if (labUsageToggle) {
      if (user) { // Any logged in user
        labUsageToggle.style.display = 'flex';

        const isTeacherOrAdmin = ['admin', 'teacher'].includes(role);

        // 3-1, 3-2 (기존 메뉴): Teacher, Admin Only
        if (menuLablog) menuLablog.style.display = isTeacherOrAdmin ? 'flex' : 'none';
        if (menuLablogViewer) menuLablogViewer.style.display = isTeacherOrAdmin ? 'flex' : 'none';

        // 3-3, 3-4 (런치랩): All Logged In Users
        if (menuLunchLabReserve) menuLunchLabReserve.style.display = 'flex';
        if (menuLunchLabInquiry) menuLunchLabInquiry.style.display = 'flex';

      } else {
        // Guest: Hide all
        labUsageToggle.style.display = 'none';
        if (submenuLabUsage) submenuLabUsage.style.display = 'none';
      }
    }

    // 🔒 3-2. 수불(Usage) 메뉴 (Navbar): Admin만 보임
    const navUsage = document.getElementById("nav-usage");
    if (navUsage) {
      // Navbar가 보이는 상태(Management Mode)인 경우에만 제어하도록 주의
      // 하지만 updateAuthUI는 상시 체크하므로 display 상태를 강제할 수 있음.
      // 단, switchMode가 display:none을 건 상태라면 여기서 flex로 켜면 안됨.
      // 따라서, 현재 display가 none이 아닐 때(=활성 모드일때)만 간섭하거나,
      // 혹은 단순히 role check 후 hide만 수행 (show는 switchMode에 위임)
      if (role !== 'admin') {
        navUsage.style.display = 'none';
      } else {
        // Admin이면 원래대로 보여야 하는데, 현재 모드가 Management인지 알 수 없음.
        // 안전하게: switchMode가 제어하므로 여기서는 '권한 없어서 숨김'만 처리.
        // 하지만 '로그인' 직후에는 switchMode가 호출되지 않을 수도 있으므로 명시적 처리 필요?
        // 일단 숨김 처리는 확실히 함.
      }
    }

    // 4. 유저 ID 및 Auth Footer 표시 업데이트
    // 기존 버튼 방식 제거하고 Footer 영역 자체를 활용
    const footer = document.getElementById("menu-footer-container");
    const userIdEl = footer?.querySelector(".user-id");
    const actionIcon = document.getElementById("auth-action-icon");

    // 이전에 생성된 버튼이 있다면 삭제 (구버전 호환)
    const oldBtn = document.getElementById("menu-auth-btn");
    if (oldBtn) oldBtn.remove();

    if (footer && userIdEl && actionIcon) {
      if (user) {
        // 로그인 상태
        const name = user.email ? user.email.split('@')[0] : 'User';
        const roleLabel = role === 'teacher' ? '교사' : (role === 'admin' ? '관리자' : (role === 'student' ? '학생' : ''));
        userIdEl.innerHTML = `<span style="font-weight: bold; color: #333; white-space: nowrap;">${name}</span> ${roleLabel ? `<span style="font-size: 11px; background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 10px; margin-left: 4px; font-weight: 500; white-space: nowrap;">${roleLabel}</span>` : ''}`;

        actionIcon.innerHTML = `
          <div class="auth-btn-pill auth-btn-logout">
            <span>로그아웃</span>
            <span class="material-symbols-outlined" style="font-size: 15px;">logout</span>
          </div>
        `;

        // 카드 전체 클릭 동작: 로그아웃 확인
        footer.onclick = (e) => {
          e.preventDefault();
          if (confirm(`${name}님, 로그아웃 하시겠습니까?`)) {
            App.Auth.logout();
            closeStartMenu();
          }
        };
        footer.style.cursor = 'pointer';
        footer.title = "클릭하여 로그아웃";
      } else {
        // 게스트 상태 (로그인 전)
        userIdEl.innerHTML = `<span style="font-weight: 600; color: #444; white-space: nowrap;">Guest</span>`;

        actionIcon.innerHTML = `
          <div class="auth-btn-pill auth-btn-login">
            <span>로그인</span>
            <span class="material-symbols-outlined" style="font-size: 15px;">login</span>
          </div>
        `;

        // 카드 전체 클릭 동작: 카드의 어느 곳을 눌러도 로그인 페이지로 이동!
        footer.onclick = (e) => {
          e.preventDefault();

          // ✅ 현재 페이지 정보 저장 (로그인 후 복귀를 위해)
          const current = App.Router.getCurrentState ? App.Router.getCurrentState() : null;
          if (current && current.pageKey !== 'login') {
            sessionStorage.setItem("login_return_route", JSON.stringify(current));
          }

          // ✅ Splash 화면(Home Active) 해제
          document.body.classList.remove("home-active");

          if (App.Router && App.Router.go) {
            App.Router.go("login");
          } else {
            alert("오류: 페이지 이동 기능(Router)이 로드되지 않았습니다.");
          }
          closeStartMenu();
        };
        footer.style.cursor = 'pointer';
        footer.title = "클릭하여 로그인하기";
      }
    }

  }

  // ---- 초기화 ----
  function setup() {
    setupStartMenuToggle();
    setupExactIdLinks(); // ✅ 단일 바인딩 (정확 ID)
    console.log("✅ Navbar.setup() 완료 — 정확 ID 바인딩/Start 메뉴 토글");

    // ✅ Navbar 로드 시점에 UI 초기화 (User가 없으면 Guest 모드로 적용됨)
    // 기존에는 user가 있을 때만 호출해서 Guest일 때 기본 Visible 상태가 유지되는 버그가 있었음.
    if (App.Auth && typeof App.Auth === 'object') {
      updateAuthUI(App.Auth.user);
    } else {
      // Auth 모듈이 아직 로드 안 됐을 수도 있지만, 일단 Guest로 초기화 시도
      updateAuthUI(null);
    }
  }

  // ---- 전역 등록 ----
  globalThis.App = globalThis.App || {};
  globalThis.App.Navbar = { setup, setActive, closeStartMenu, updateAuthUI };

  document.addEventListener("DOMContentLoaded", setup);
})();
