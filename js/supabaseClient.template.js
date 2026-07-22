// ================================================================
// /js/supabaseClient.js (Template)
// ================================================================
(function () {
  const SUPABASE_URL = "%%SUPABASE_URL%%";
  const SUPABASE_ANON_KEY = "%%SUPABASE_ANON_KEY%%";

  const APP_CONFIG = {
    APPNAME: "SciManager",
    SCHOOL: "GOE학교",
    VERSION: "v0.12.24",
  };

  globalThis.App = globalThis.App || {};

  if (globalThis.App.supabase) {
    return;
  }

  if (typeof supabase === "undefined" || !supabase.createClient) {
    console.error("❌ Supabase SDK Not Found");
    return;
  }

  // ------------------------------------------------------------
  // 🔐 Deployment Verification
  // ------------------------------------------------------------
  /* Check removed to avoid false positives during substitution */


  if (!SUPABASE_URL || SUPABASE_URL.trim() === "" || !SUPABASE_URL.startsWith("http")) {
    console.error("❌ FATAL: SUPABASE_URL is Missing or Invalid! (Value is empty or not a URL)");
    console.error("ℹ️ Current Value (First 5 chars):", SUPABASE_URL.substring(0, 5));
    console.error("ℹ️ Check GitHub Secrets > SUPABASE_URL");
    return;
  }

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.trim() === "") {
    console.error("❌ FATAL: SUPABASE_ANON_KEY is Missing!");
    console.error("ℹ️ Check GitHub Secrets > SUPABASE_ANON_KEY");
    return;
  }

  try {
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    globalThis.App.supabase = client;
    globalThis.App.supabaseUrl = SUPABASE_URL;
    globalThis.App.supabaseAnonKey = SUPABASE_ANON_KEY;
    globalThis.App.projectFunctionsBaseUrl = `${SUPABASE_URL}/functions/v1`;

    console.log("✅ Supabase Client Initialized (Template)");
  } catch (err) {
    console.error("❌ Supabase Init Error:", err);
  }

  if (typeof globalThis !== "undefined") {
    globalThis.supabaseClient = globalThis.App.supabase;
    globalThis.APP_CONFIG = APP_CONFIG;
    globalThis.App.APP_CONFIG = globalThis.APP_CONFIG; // Reference for consistency
  }

  globalThis.App.loadGlobalSettings = async function () {
    if (!globalThis.App.supabase) return;
    try {
      const { data, error } = await globalThis.App.supabase
        .from('global_settings')
        .select('key, value');

      if (data) {
        const settings = {};
        data.forEach(item => settings[item.key] = item.value);

        if (settings['SCHOOL_NAME']) {
          APP_CONFIG.SCHOOL = settings['SCHOOL_NAME'];
        }

        APP_CONFIG.API_EXP_CAS = settings['API_EXP_CAS'];
        APP_CONFIG.API_EXP_KOSHA = settings['API_EXP_KOSHA'];
        APP_CONFIG.API_EXP_KREACH = settings['API_EXP_KREACH'];
      }
    } catch (e) {
      console.warn("⚠️ Settings load failed:", e);
    }
  };
})();
