// ================================================================
// /js/router/router.js — 완전 안정화 버전 (2프레임 대기 + 중복 제거)
// ================================================================
(function () {
  const routes = {
    login: "pages/login.html",
    main: "pages/main.html",
    cabinets: "pages/location-list.html",
    addCabinet: "pages/cabinet-form.html",
    inventory: "pages/inventory-list.html",
    addInventory: "pages/inventory-form.html",
    inventoryDetail: "pages/inventory-detail.html",
    usageRegister: "pages/usage-register.html",
    dataSync: "pages/data-sync.html",
    wasteList: "pages/waste-list.html",
    wasteForm: "pages/waste-form.html",
    kits: "pages/kits.html",
    kitDetail: "pages/kit-detail.html",
    teachingTools: "pages/teaching-tools.html",
    teachingToolsDetail: "pages/teaching-tools-detail.html",
    toolsForm: "pages/tools-form.html",
    kitForm: "pages/kit-form.html",
    equipmentCabinets: "pages/equipment-cabinet-list.html",
    labSettings: "pages/lab-settings.html",
    labTimetable: "pages/lab-timetable.html",
    labTimetableViewer: "pages/lab-timetable-viewer.html",
    labUsageLog: "pages/lab-usage-log.html",
    labUsageViewer: "pages/lab-usage-log.html", // Reuse layout
    labUsageView: "pages/lab-usage-view.html",
    lunchLabReserve: "pages/lunch-lab-reserve.html",
    lunchLabInquiry: "pages/lunch-lab-view.html",
    export: "pages/export.html",
    safetyEdu: "pages/safety-edu.html",
    labManual: "pages/lab-manual.html",
    emergencyManual: "pages/emergency-manual.html",
  };

  let currentState = null;

  async function go(pageKey, params = {}, options = {}) {
    const file = routes[pageKey];
    if (!file) {
      console.warn(`❌ Router: ${pageKey} 라우트 없음`);
      return;
    }

    console.log(`🧭 Router → ${pageKey}`, params);

    // Toggle body classes based on route to hide/show splash screen
    if (pageKey === "main") {
      document.body.classList.add("home-active");
      document.body.classList.remove("loaded");
    } else {
      document.body.classList.remove("home-active");
      document.body.classList.add("loaded");
    }

    // 1. History Push
    if (!options.skipPush) {
      // Clean URL Mode: Don't change the address bar URL, but push state for back-button support
      history.pushState({ pageKey, params }, "", null);
    }
    currentState = { pageKey, params };

    // 2. Load Content
    // Inventory handles its own loading via showListPage, others use generic includeHTML
    if (pageKey === "inventory" && App.Inventory?.showListPage) {
      await App.Inventory.showListPage();
    } else {
      await App.includeHTML(file, "form-container");
    }

    // 3. Post-load initialization (Switch case)
    switch (pageKey) {
      case "labSettings":
        if (App?.LabSettings?.init) await App.LabSettings.init();
        break;
      case "safetyEdu":
        if (App?.SafetyEdu?.init) await App.SafetyEdu.init();
        break;
      case "labManual":
        if (App?.LabManual?.init) await App.LabManual.init();
        break;
      case "emergencyManual":
        if (App?.EmergencyManual?.init) await App.EmergencyManual.init();
        break;
      case "labTimetable":
        if (App?.LabTimetable?.init) await App.LabTimetable.init();
        break;
      case "labTimetableViewer":
        if (App?.TimetableViewer?.init) await App.TimetableViewer.init();
        break;
      case "labUsageLog":
        if (App?.LabUsageLog?.init) await App.LabUsageLog.init({ readOnly: false });
        break;
      case "labUsageViewer":
        if (App?.LabUsageLog?.init) await App.LabUsageLog.init({ readOnly: true });
        break;
      case "labUsageView":
        if (App?.LabUsageView?.init) await App.LabUsageView.init();
        break;
      case "lunchLabReserve":
        if (App?.LunchLabReserve?.init) await App.LunchLabReserve.init();
        break;
      case "lunchLabInquiry":
        if (App?.LunchLabView?.init) await App.LunchLabView.init();
        break;
      case "wasteList":
        if (App.Waste?.bindListPage) App.Waste.bindListPage();
        break;
      case "wasteForm":
        if (App.Waste?.initForm) App.Waste.initForm(params.mode || "create", params.id || null);
        break;
      case "kits":
        if (App.Kits?.init) await App.Kits.init();
        break;
      case "kitDetail":
        if (App.Kits?.loadDetail && params.id) await App.Kits.loadDetail(params.id);
        break;
      case "teachingTools":
        if (App.TeachingTools?.init) await App.TeachingTools.init();
        break;
      case "teachingToolsDetail":
        if (App.TeachingTools?.loadDetail && params.id) await App.TeachingTools.loadDetail(params.id);
        break;
      case "toolsForm":
        if (App.ToolsForm?.init) App.ToolsForm.init(params.id);
        break;
      case "kitForm":
        if (App.KitForm?.init) App.KitForm.init(params.id);
        break;
      case "login":
        if (App?.Auth?.bindLoginForm) App.Auth.bindLoginForm();
        break;
      case "main":
        document.body.classList.add("home-active");
        document.body.classList.remove("loaded");
        break;
      case "inventoryDetail":
        if (App.Inventory?.loadDetail && params.id) await App.Inventory.loadDetail(params.id);
        break;
      case "addInventory":
        if (App.Forms?.initInventoryForm) await App.Forms.initInventoryForm(params.mode, params.detail);
        break;
      case "usageRegister":
        if (App.UsageRegister?.init) App.UsageRegister.init(params);
        break;
      case "cabinets":
        if (App.Cabinet?.loadList) App.Cabinet.loadList();
        break;
      case "equipmentCabinets":
        if (App.EquipmentCabinet?.loadList) App.EquipmentCabinet.loadList();
        break;
      case "dataSync":
        if (App.DataSync?.init) App.DataSync.init();
        break;
      case "export":
        if (App.ExportPage?.init) App.ExportPage.init();
        break;
    }

    // 4. Navbar Sync
    const navMapping = {
      inventory: "nav-inventory",
      inventoryDetail: "nav-inventory",
      usageRegister: "nav-usage",
      cabinets: "menu-location",
      dataSync: "menu-datasync",
      wasteList: "nav-waste",
      wasteForm: "nav-waste",
      kits: "nav-kit",
      kitDetail: "nav-kit",
      teachingTools: "nav-teaching-tools",
      teachingToolsDetail: "nav-teaching-tools",
      export: "menu-export",
      main: "menu-home",
      equipmentCabinets: "menu-equipment-cabinet"
    };

    const navId = navMapping[pageKey];
    if (navId && App.Navbar?.setActive) {
      App.Navbar.setActive(navId);
    }

    globalThis.scrollTo(0, 0);
  }

  globalThis.addEventListener("popstate", (event) => {
    const state = event.state;
    if (state && state.pageKey) {
      go(state.pageKey, state.params, { skipPush: true });
    } else {
      go("main", {}, { skipPush: true });
    }
  });

  globalThis.App = globalThis.App || {};
  globalThis.App.Router = { go, routes, getCurrentState: () => currentState };
})();
