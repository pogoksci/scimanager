// js/core/api.js
(function () {
  const SUPABASE_URL = "https://pkjautwtgmmdtgawvmhh.supabase.co";
  const SUPABASE_ANON_KEY =
    globalThis.App?.supabaseAnonKey || "YOUR_NEW_ANON_KEY_HERE";

  const EDGE = {
    CASIMPORT: `${SUPABASE_URL}/functions/v1/casimport`,
    CABINET: `${SUPABASE_URL}/functions/v1/cabinet-register`,
    INVENTORY: `${SUPABASE_URL}/functions/v1/inventory`,
    DELETEAREA: `${SUPABASE_URL}/functions/v1/delete-area`,
  };

  /**
   * 공통 fetch (Edge Function 호출용)
   * @param {string} url
   * @param {object} options
   */
  async function callEdge(url, { method = "GET", token = SUPABASE_ANON_KEY, body } = {}) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // ✅ 서버 응답(JSON 파싱)
      let data = {};
      try {
        data = await res.json();
      } catch {
        console.warn("⚠️ callEdge: JSON 파싱 실패 (서버가 비JSON 응답)");
      }

      // ✅ 상세 로그 추가
      console.log(`📡 [${method}] ${url}`);
      console.log("📦 요청 body:", body);
      console.log("📩 응답 data:", data);
      console.log("📩 응답 상태:", res.status);

      // ✅ 실패 처리 강화 — 에러 객체를 안전하게 문자열화
      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ||
              JSON.stringify(data.error || data, null, 2) ||
              `HTTP ${res.status}`;
        console.error("❌ callEdge 실패 응답:", data);
        throw new Error(message);
      }

      return data;
    } catch (err) {
      console.error("💥 callEdge 예외:", err);
      throw err;
    }
  }

  globalThis.App = globalThis.App || {};
  App.API = { EDGE, callEdge, SUPABASE_URL, SUPABASE_ANON_KEY };
})();

