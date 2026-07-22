// ================================================================
// /js/ui/chatbot.js — 하이브리드 과학실 챗봇 엔진 (DB + AI Fallback)
// ================================================================
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  const Chatbot = {
    isOpen: false,
    isTyping: false,
    provider: "gemini",
    apiKey: null,
    apiUrl: "",
    model: "",
    selectedSubstance: null, // Track currently selected substance
    lastDateRange: null, // 저장된 마지막 폐수 조회 기간

    formatToolLocation: function (loc) {
      if (!loc) return "위치 미지정";
      if (typeof loc === 'string') return loc;

      const parts = [];
      if (loc.area_name) parts.push(loc.area_name);
      if (loc.cabinet_name) parts.push(loc.cabinet_name);
      if (loc.door_vertical) parts.push(`${loc.door_vertical}층`);
      if (loc.door_horizontal) parts.push(`${loc.door_horizontal}번`);
      if (loc.internal_shelf_level) parts.push(`${loc.internal_shelf_level}단`);
      if (loc.storage_column) parts.push(`${loc.storage_column}열`);

      return parts.join(" > ") || "위치 미지정";
    },

    // ------------------------------------------------------------
    // 1️⃣ 초기화 및 UI 생성
    // ------------------------------------------------------------
    init: function () {
      if (document.getElementById("chatbot-float-container")) {
        return; // 이미 생성됨
      }

      // API 설정 로드
      this.provider = localStorage.getItem("chatbot_provider") || "gemini";
      this.apiKey = localStorage.getItem("chatbot_api_key") || globalThis.APP_CONFIG?.GEMINI_API_KEY || null;
      this.apiUrl = localStorage.getItem("chatbot_api_url") || "";
      this.model = localStorage.getItem("chatbot_model") || "";
      this.selectedSubstance = null;

      // 챗봇 HTML 구조 동적 삽입
      const container = document.createElement("div");
      container.id = "chatbot-float-container";
      container.innerHTML = `
        <button id="chatbot-toggle-btn" title="AI 과학실 챗봇">
          <span class="material-symbols-outlined chatbot-icon">smart_toy</span>
          <span class="chatbot-badge">AI</span>
        </button>
        <div id="chatbot-panel" class="chatbot-panel-hidden">
          <div class="chatbot-header">
            <div class="chatbot-title-area">
              <span class="material-symbols-outlined header-icon">smart_toy</span>
              <div>
                <div class="chatbot-name">AI 과학실 챗봇</div>
                <div class="chatbot-status" id="chatbot-status-text">하이브리드 모드</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button id="chatbot-reset-btn" title="AI 챗봇 대화 내용 및 검색 상태 초기화" style="background: rgba(255, 255, 255, 0.8); border: 1px solid rgba(0, 0, 0, 0.15); color: #333; cursor: pointer; display: flex; align-items: center; gap: 3px; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; transition: all 0.2s;">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #00a0b2;">restart_alt</span>
                초기화
              </button>
              <button id="chatbot-close-btn" title="닫기">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>
          <div class="chatbot-messages" id="chatbot-messages-container"></div>
          <div class="chatbot-input-area">
            <input type="text" id="chatbot-input" placeholder="무엇을 도와드릴까요?" autocomplete="off">
            <button id="chatbot-send-btn" title="보내기">
              <span class="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(container);

      // 이벤트 바인딩
      document.getElementById("chatbot-toggle-btn").onclick = () => this.togglePanel();
      document.getElementById("chatbot-close-btn").onclick = () => this.togglePanel(false);
      document.getElementById("chatbot-reset-btn").onclick = () => this.resetChat();
      document.getElementById("chatbot-send-btn").onclick = () => this.handleSend();

      const input = document.getElementById("chatbot-input");
      input.onkeydown = (e) => {
        if (e.key === "Enter" && !e.isComposing) {
          this.handleSend();
        }
      };

      // 초기 안내 메시지 렌더링
      this.renderWelcome();
      this.updateStatus();
    },

    resetChat: function () {
      this.selectedSubstance = null;
      this.lastDateRange = null;

      const container = document.getElementById("chatbot-messages-container");
      if (container) {
        container.innerHTML = "";
      }

      const input = document.getElementById("chatbot-input");
      if (input) {
        input.value = "";
        input.placeholder = "무엇을 도와드릴까요?";
      }

      this.renderWelcome();
    },

    // ------------------------------------------------------------
    // 2️⃣ UI 제어
    // ------------------------------------------------------------
    togglePanel: function (forceState) {
      const panel = document.getElementById("chatbot-panel");
      if (!panel) return;

      this.isOpen = (forceState !== undefined) ? forceState : !this.isOpen;
      panel.classList.toggle("chatbot-panel-hidden", !this.isOpen);

      if (this.isOpen) {
        document.getElementById("chatbot-input").focus();
        this.scrollToBottom();
        // API 설정이 변경되었을 수 있으므로 다시 체크
        this.provider = localStorage.getItem("chatbot_provider") || "gemini";
        this.apiKey = localStorage.getItem("chatbot_api_key") || globalThis.APP_CONFIG?.GEMINI_API_KEY || null;
        this.apiUrl = localStorage.getItem("chatbot_api_url") || "";
        this.model = localStorage.getItem("chatbot_model") || "";
        this.updateStatus();
      }
    },

    updateStatus: function () {
      const statusEl = document.getElementById("chatbot-status-text");
      if (!statusEl) return;

      if (this.apiKey) {
        statusEl.textContent = `AI 비서 활성화됨 (${this.provider.toUpperCase()})`;
        statusEl.style.color = "";
      } else {
        statusEl.textContent = "DB 검색 모드 (AI 대기)";
        statusEl.style.color = "#888";
      }
    },

    scrollToBottom: function () {
      const container = document.getElementById("chatbot-messages-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    // ------------------------------------------------------------
    // 3️⃣ 메시지 렌더링
    // ------------------------------------------------------------
    renderWelcome: function () {
      const container = document.getElementById("chatbot-messages-container");
      if (!container) return;

      const welcomeHtml = `
        <div class="chatbot-msg-row msg-bot">
          <div class="chatbot-bubble">
            안녕하세요! 🧪 <b>AI 과학실 챗봇</b>입니다.<br>
            과학실 시약, 교구, 설비의 보관 위치나 MSDS 안전 정보를 언제든 물어보세요. 무엇을 도와드릴까요?
          </div>
        </div>
      `;
      container.innerHTML = welcomeHtml;
    },

    askPreset: function (text) {
      const input = document.getElementById("chatbot-input");
      if (input) {
        input.value = text;
        this.handleSend();
      }
    },

    appendMessage: function (text, sender) {
      const container = document.getElementById("chatbot-messages-container");
      if (!container) return;

      const row = document.createElement("div");
      row.className = `chatbot-msg-row msg-${sender}`;

      const bubble = document.createElement("div");
      bubble.className = "chatbot-bubble";
      bubble.innerHTML = text.replace(/\n/g, "<br>");

      row.appendChild(bubble);
      container.appendChild(row);
      this.scrollToBottom();
    },

    showTyping: function () {
      if (this.isTyping) return;
      this.isTyping = true;

      const container = document.getElementById("chatbot-messages-container");
      if (!container) return;

      const row = document.createElement("div");
      row.className = "chatbot-msg-row msg-bot";
      row.id = "chatbot-typing-row";

      const bubble = document.createElement("div");
      bubble.className = "chatbot-bubble";
      bubble.style.color = "#777";
      bubble.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; animation: spin 2s linear infinite;">sync</span>
        정보를 찾는 중입니다...
      `;

      row.appendChild(bubble);
      container.appendChild(row);
      this.scrollToBottom();
    },

    hideTyping: function () {
      const typingRow = document.getElementById("chatbot-typing-row");
      if (typingRow) {
        typingRow.remove();
      }
      this.isTyping = false;
    },

    // ------------------------------------------------------------
    // 4️⃣ 메시지 전송 및 하이브리드 엔진 동작
    // ------------------------------------------------------------
    handleSend: async function () {
      const input = document.getElementById("chatbot-input");
      if (!input || !input.value.trim() || this.isTyping) return;

      const text = input.value.trim();
      input.value = "";

      // 1. 사용자 메시지 추가
      this.appendMessage(text, "user");

      // 2. 타이핑 시작
      this.showTyping();

      try {
        // 3. 하이브리드 라우팅 및 답변 생성
        const answer = await this.routeQuery(text);
        this.hideTyping();
        this.appendMessage(answer, "bot");
      } catch (err) {
        console.error("Chatbot Error:", err);
        this.hideTyping();
        this.appendMessage("❌ 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "bot");
      }
    },

    // ------------------------------------------------------------
    // 5️⃣ 하이브리드 검색 및 AI Fallback 라우팅
    // ------------------------------------------------------------
    routeQuery: async function (query) {
      const supabase = getSupabase();
      if (!supabase) {
        return "❌ 데이터베이스가 연결되어 있지 않습니다.";
      }

      // 문장을 토큰화하고 클렌징하여 유의미한 키워드 추출
      const cleanText = query.replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ").trim();
      const tokens = cleanText.split(/\s+/).filter(t => t.length >= 1);

      // 의도 분석 키워드 정의
      const mwKeywords = ["분자량", "무게", "mw", "질량", "mass", "weight", "mw"];
      const msdsKeywords = ["위험", "유해", "위험성", "유해성", "안전", "msds", "경고", "독성", "조치", "주의사항", "대비"];
      const propKeywords = ["특성", "성질", "성격", "녹는점", "끓는점", "밀도", "비중", "외관", "물리", "bp", "mp"];
      const resetKeywords = ["다른 시약", "다른시약", "뒤로", "목록", "초기화", "reset", "다른 시약 검색", "새로운 시약", "새시약"];
      const matchingKeywords = ["실험", "준비물", "준비", "키트"];
      const emergencyKeywords = ["사고", "화상", "눈에", "피부에", "응급", "대처", "조치", "안전", "흡입", "마셨", "유출", "깨졌"];
      const wasteKeywords = ["폐액", "폐기", "버려", "버리"];
      const locationKeywords = ["위치", "어디", "보관", "어딨", "있어", "있니", "있나요", "찾아", "찾기", "장소", "위치해"];
 
      const isMwQuery = tokens.some(t => mwKeywords.some(k => t.includes(k)));
      const isMsdsQuery = tokens.some(t => msdsKeywords.some(k => t.includes(k)));
      const isPropQuery = tokens.some(t => propKeywords.some(k => t.includes(k)));
      const isResetQuery = tokens.some(t => resetKeywords.some(k => t.includes(k)));
      const isMatchingQuery = tokens.some(t => matchingKeywords.some(k => t.includes(k)));
      const isEmergencyQuery = tokens.some(t => emergencyKeywords.some(k => t.includes(k)));
      const isWasteQuery = tokens.some(t => wasteKeywords.some(k => t.includes(k)));
      const isLocationQuery = tokens.some(t => locationKeywords.some(k => t.includes(k)));

      const lowStockKeywords = ["구입", "구매", "소모", "부족", "주문", "살 거", "구입요청"];
      const isLowStockQuery = tokens.some(t => lowStockKeywords.some(k => t.includes(k)));

      // 🆕 1. 대화형 농도/몰농도 계산 키워드 감지 (예: "염산 1M 1L", "0.1M 수산화나트륨 500mL")
      const concMatchCheck = query.match(/(\d+(?:\.\d+)?)\s*(?:M|몰|%|mM|N)/i);
      const volMatchCheck = query.match(/(\d+(?:\.\d+)?)\s*(?:mL|L|밀리리터|리터)/i);
      const concCalcKeywords = ["농도", "몰농도", "만들", "제조", "희석", "녹여", "녹이", "용액", "molar", "몰"];
      const isConcCalcQuery = (concMatchCheck && volMatchCheck) || (concMatchCheck && concCalcKeywords.some(k => query.includes(k))) || (volMatchCheck && (query.includes("만들") || query.includes("제조") || query.includes("희석")));

      // 🆕 2. 교구/설비 점검 & 세척/유지보수 매뉴얼 감지
      const maintKeywords = ["점검", "청소", "세척", "주기", "매뉴얼", "유지보수", "고장", "보관법", "관리법", "관리", "수평", "필터"];
      const equipNames = ["현미경", "흄후드", "전자저울", "저울", "mbl", "기주공명", "알코올램프", "알코올 램프", "하치장", "피펫"];
      const isMaintenanceQuery = maintKeywords.some(k => query.includes(k)) || (equipNames.some(e => query.toLowerCase().includes(e)) && (query.includes("어떻게") || query.includes("방법") || query.includes("주기") || query.includes("점검") || query.includes("청소") || query.includes("관리")));

      // 🆕 3. 교육과정 / 단원별 키트 및 시약 매칭 감지
      const curriKeywords = ["교육과정", "단원", "중1", "중2", "중3", "고등", "통합과학", "물리학", "화학", "생명과학", "지구과학", "융합과학", "교과서"];
      const isCurriculumQuery = curriKeywords.some(k => query.includes(k)) && (query.includes("실험") || query.includes("목록") || query.includes("시약") || query.includes("키트") || query.includes("단원") || query.includes("과정"));

      // 폐수 통계용 날짜 패턴 매칭
      const dateMatches = [];
      const regex1 = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일?/g;
      const regex2 = /(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/g;
      
      let match;
      regex1.lastIndex = 0;
      regex2.lastIndex = 0;
      while ((match = regex1.exec(query)) !== null) {
        const y = match[1];
        const m = String(match[2]).padStart(2, "0");
        const d = String(match[3]).padStart(2, "0");
        dateMatches.push(`${y}-${m}-${d}`);
      }
      while ((match = regex2.exec(query)) !== null) {
        const y = match[1];
        const m = String(match[2]).padStart(2, "0");
        const d = String(match[3]).padStart(2, "0");
        dateMatches.push(`${y}-${m}-${d}`);
      }

      // 폐수 통계 의도 판별
      const isWasteStatsQuery = (query.includes("폐수") || query.includes("폐액") || query.includes("버린")) && 
                                (query.includes("발생") || query.includes("통계") || query.includes("얼마나") || query.includes("양") || dateMatches.length > 0 || query.includes("기간"));

      // 챗봇 대화 및 검색 상태 초기화 요청 시
      if (isResetQuery) {
        this.resetChat();
        return null;
      }

      // 🆕 농도/몰농도 대화형 계산기 실행
      if (isConcCalcQuery) {
        const concAns = await this.handleConcCalcQuery(query);
        if (concAns) return concAns;
      }

      // 🆕 교구/설비 점검 및 유지보수 매뉴얼 실행
      if (isMaintenanceQuery) {
        const maintAns = await this.handleMaintenanceQuery(query);
        if (maintAns) return maintAns;
      }

      // 🆕 교육과정/실험 교구·키트 매칭 실행
      if (isCurriculumQuery) {
        const curriAns = await this.handleCurriculumQuery(query);
        if (curriAns) return curriAns;
      }

      // --- 폐수 통계 질의 처리 ---
      if (isWasteStatsQuery) {
        let startDate = null;
        let endDate = null;

        if (dateMatches.length >= 2) {
          startDate = dateMatches[0];
          endDate = dateMatches[1];
          this.lastDateRange = { startDate, endDate };
        } else if (dateMatches.length === 1) {
          startDate = dateMatches[0];
          endDate = new Date().toISOString().split('T')[0];
          this.lastDateRange = { startDate, endDate };
        } else if (query.includes("같은 기간") || query.includes("동일 기간")) {
          if (this.lastDateRange) {
            startDate = this.lastDateRange.startDate;
            endDate = this.lastDateRange.endDate;
          }
        }

        if (!startDate || !endDate) {
          const now = new Date();
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          startDate = oneYearAgo.toISOString().split('T')[0];
          endDate = now.toISOString().split('T')[0];
          this.lastDateRange = { startDate, endDate };
        }

        const { data: wasteLogs, error: logErr } = await supabase
          .from("WasteLog")
          .select("*")
          .gte("date", startDate)
          .lte("date", endDate);

        if (logErr) {
          console.error("WasteLog fetch error:", logErr);
          return "❌ 폐수 정보를 불러오는 중 오류가 발생했습니다.";
        }

        if (!wasteLogs || wasteLogs.length === 0) {
          return `📊 **폐수 발생량 통계 결과**
- **조회 기간:** ${startDate} ~ ${endDate}

해당 기간 내에 등록된 폐수 배출 기록이 존재하지 않습니다.`;
        }

        let targetClass = null;
        if (query.includes("산") || query.includes("산성")) targetClass = "산";
        else if (query.includes("알칼리") || query.includes("알칼리성") || query.includes("염기") || query.includes("염기성")) targetClass = "알칼리";
        else if (query.includes("유기물") || query.includes("유기용제") || query.includes("유기")) targetClass = "유기물";
        else if (query.includes("무기물") || query.includes("무기산") || query.includes("무기")) targetClass = "무기물";
        else if (query.includes("기타")) targetClass = "기타";

        if (targetClass) {
          const filtered = wasteLogs.filter(log => log.classification === targetClass);
          const sum = filtered.reduce((acc, log) => acc + Number(log.amount || 0), 0);

          return `📊 **폐수 발생량 통계 결과**
- **조회 기간:** ${startDate} ~ ${endDate}
- **폐수 종류:** ${targetClass}
- **총 발생량:** <b>${sum.toLocaleString()} g</b> (${(sum / 1000).toFixed(2)} kg)`.replace(/\n\s*/g, "");
        } else {
          const sums = { "산": 0, "알칼리": 0, "유기물": 0, "무기물": 0, "기타": 0 };
          let totalSum = 0;

          wasteLogs.forEach(log => {
            const cls = log.classification || "기타";
            const amt = Number(log.amount || 0);
            if (sums[cls] !== undefined) {
              sums[cls] += amt;
            } else {
              sums["기타"] += amt;
            }
            totalSum += amt;
          });

          let tableRows = "";
          Object.keys(sums).forEach(cls => {
            const amt = sums[cls];
            tableRows += `
              <tr style="border-bottom: 1px solid #dee2e6; background: white;">
                <td style="padding: 6px 8px; font-weight: bold; color: #333; text-align: left;">${cls}</td>
                <td style="padding: 6px 8px; text-align: right; color: #495057;">${amt.toLocaleString()} g</td>
                <td style="padding: 6px 8px; text-align: right; color: #495057;">${(amt / 1000).toFixed(2)} kg</td>
              </tr>
            `.replace(/\n\s*/g, "");
          });

          tableRows += `
            <tr style="border-bottom: 1px solid #dee2e6; background: #f8f9fa; font-weight: bold;">
              <td style="padding: 6px 8px; color: #111; text-align: left;">합계</td>
              <td style="padding: 6px 8px; text-align: right; color: #007bff;">${totalSum.toLocaleString()} g</td>
              <td style="padding: 6px 8px; text-align: right; color: #007bff;">${(totalSum / 1000).toFixed(2)} kg</td>
            </tr>
          `.replace(/\n\s*/g, "");

          return `📊 **기간 내 종류별 폐수 발생량 결과**
- **조회 기간:** ${startDate} ~ ${endDate}
` + `
<table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; border: 1px solid #dee2e6; table-layout: auto;">
  <thead>
    <tr style="border-bottom: 2px solid #dee2e6; text-align: left; background: #f1f3f5; font-weight: bold; color: #495057;">
      <th style="padding: 6px 8px; text-align: left;">폐수 종류</th>
      <th style="padding: 6px 8px; text-align: right;">발생량 (g)</th>
      <th style="padding: 6px 8px; text-align: right;">발생량 (kg)</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>`.replace(/\n\s*/g, "");
        }
      }

      // --- 소모 임박 / 구입 필요 시약 질의 처리 ---
      if (isLowStockQuery) {
        const { data: activeItems, error: activeErr } = await supabase
          .from("Inventory")
          .select(`
            id, current_amount, initial_amount, unit, edited_name_kor,
            Substance ( chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod ),
            Cabinet ( cabinet_name, area_id:lab_rooms!fk_cabinet_lab_rooms ( room_name ) )
          `)
          .gt("current_amount", 0);

        if (activeErr) {
          console.error("Inventory active fetch error:", activeErr);
          return "❌ 재고 정보를 불러오는 중 오류가 발생했습니다.";
        }

        const lowStockItems = (activeItems || []).filter(item => {
          const initial = Number(item.initial_amount || 0);
          const current = Number(item.current_amount || 0);
          return initial > 0 && current <= (initial * 0.2);
        });

        if (lowStockItems.length === 0) {
          return `🎉 **구입 필요 시약 분석 결과**
현재 과학실 내에 잔여량이 20% 이하로 떨어진 소모 임박 시약이 없습니다. 재고 상태가 안전합니다!`;
        }

        let tableRows = "";
        lowStockItems.forEach(item => {
          const chemName = item.edited_name_kor || item.Substance?.chem_name_kor_mod || item.Substance?.chem_name_kor || item.Substance?.substance_name_mod || item.Substance?.substance_name || "이름 없음";
          const area = item.Cabinet?.area_id?.room_name || "";
          const cabinetName = item.Cabinet?.cabinet_name || "";
          const locMain = `${area} 『${cabinetName}』`.trim() || "미지정";
          const initial = Number(item.initial_amount || 0);
          const current = Number(item.current_amount || 0);
          const percent = Math.round((current / initial) * 100);

          tableRows += `
            <tr style="border-bottom: 1px solid #dee2e6; background: white;">
              <td style="padding: 6px 4px; text-align: left; font-weight: bold; font-size: 11px;">
                <a href="#" style="color: #007bff; text-decoration: none;" onclick="App.Chatbot.goToInventoryDetail(${item.id}); return false;">${chemName}</a>
              </td>
              <td style="padding: 6px 4px; text-align: right; font-size: 11px; color: #d6336c; font-weight: bold;">
                ${current}${item.unit || ''} (${percent}%)
              </td>
              <td style="padding: 6px 4px; text-align: left; font-size: 10.5px; color: #666; max-width: 90px; word-break: break-all;">
                ${locMain}
              </td>
            </tr>
          `.replace(/\n\s*/g, "");
        });

        return `⚠️ **구입 권장 시약 리스트 (잔여량 20% 이하)**
` + `
<table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; border: 1px solid #dee2e6; table-layout: auto;">
  <thead>
    <tr style="border-bottom: 2px solid #dee2e6; text-align: left; background: #fff0f6; font-weight: bold; color: #d6336c;">
      <th style="padding: 6px 4px; text-align: left;">시약명</th>
      <th style="padding: 6px 4px; text-align: right; width: 85px;">남은 양 (%)</th>
      <th style="padding: 6px 4px; text-align: left; width: 90px;">보관 위치</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>`.replace(/\n\s*/g, "");
      }

      // --- 실험 준비물 매칭 (아이디어 2) ---
      if (isMatchingQuery) {
        // 교구/실험 검색 키워드 추출
        let cleanSubject = query;
        const removeWords = ["실험", "준비물", "준비", "키트", "알려줘", "보여줘", "알려주세요", "보여주세요", "있어?", "있나요?", "체크", "조회"];
        removeWords.forEach(w => {
          cleanSubject = cleanSubject.replace(new RegExp(w, "g"), "");
        });
        cleanSubject = cleanSubject.replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ").trim();

        if (cleanSubject.length >= 2) {
          const { data: matchedKits, error: kitErr } = await supabase
            .from('experiment_kit')
            .select('*')
            .ilike('kit_name', `%${cleanSubject}%`)
            .limit(1);

          if (!kitErr && matchedKits && matchedKits.length > 0) {
            const kit = matchedKits[0];
            const casList = (kit.kit_cas || "").split(',').map(s => s.trim().replace(/"/g, '')).filter(s => s);

            // Fetch inventory items to match
            const { data: invItems, error: invErr } = await supabase
              .from('Inventory')
              .select(`
                id, current_amount, unit, edited_name_kor,
                Substance ( id, chem_name_kor, chem_name_kor_mod, cas_rn ),
                Cabinet ( cabinet_name, area_id:lab_rooms!fk_cabinet_lab_rooms ( room_name ) )
              `);

            if (!invErr && invItems) {
              const matchingInventories = invItems.filter(item => {
                const itemCas = item.Substance?.cas_rn;
                if (!itemCas) return false;
                return casList.some(cas => itemCas.includes(cas) || cas.includes(itemCas));
              });

              let reportHtml = `🧪 <b>${kit.kit_name}</b> 실험 준비물 매칭 결과입니다.
              <div class="chatbot-matching-card">
                <div class="chatbot-matching-header">
                  <div class="chatbot-matching-title">${kit.kit_name}</div>
                  <span class="matching-badge badge-instock">${casList.length}종 약품</span>
                </div>
                <div class="chatbot-matching-grid">`;

              for (const cas of casList) {
                const items = matchingInventories.filter(item => item.Substance?.cas_rn?.includes(cas) || cas.includes(item.Substance?.cas_rn));
                const isAvailable = items.length > 0;

                // Fetch name from substance or default
                let displayName = cas;
                if (isAvailable) {
                  displayName = items[0].edited_name_kor || items[0].Substance?.chem_name_kor_mod || items[0].Substance?.chem_name_kor || cas;
                } else {
                  // Attempt a fallback lookup in kit_chemicals to get the Korean name
                  const { data: directKitChem } = await supabase
                    .from('kit_chemicals')
                    .select('name_ko')
                    .eq('cas_no', cas)
                    .maybeSingle();
                  if (directKitChem && directKitChem.name_ko) {
                    displayName = directKitChem.name_ko;
                  }
                }

                if (isAvailable) {
                  const totalQty = items.reduce((acc, curr) => acc + (curr.current_amount || 0), 0);
                  const unit = items[0].unit || "개";
                  const loc = items[0].Cabinet ? `${items[0].Cabinet.area_id?.room_name || ""} 『${items[0].Cabinet.cabinet_name}』` : "위치 미확인";
                  reportHtml += `
                  <div class="chatbot-matching-item">
                    <span class="chatbot-matching-name">🧪 ${displayName}</span>
                    <div class="chatbot-matching-status">
                      <span style="font-size:11px; color:#666;">${loc} (${totalQty}${unit})</span>
                      <span class="matching-badge badge-instock">보유</span>
                    </div>
                  </div>`;
                } else {
                  reportHtml += `
                  <div class="chatbot-matching-item">
                    <span class="chatbot-matching-name" style="color:#888;">🧪 ${displayName}</span>
                    <div class="chatbot-matching-status">
                      <span class="matching-badge badge-outofstock">재고없음</span>
                    </div>
                  </div>`;
                }
              }

              return reportHtml;
            }
          }
        }

        // Fallback: If no matching kit found
        return `🔍 입력하신 실험 키트 <${cleanSubject || query}> 에 대한 준비물 정보를 찾을 수 없습니다.
        
💡 <b>실험명 예시:</b>
- <화학정원 만들기> (또는 <화학정원>)
- <앙금 생성 반응> (또는 <앙금>)
- <기체 발생 장치>
- <달고나 만들기>
<div class="chatbot-chips-container" style="margin-top: 10px;">
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('화학정원 실험')">🧪 화학정원 실험</button>
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('앙금 생성 실험')">🧪 앙금 생성 실험</button>
</div>`;
      }

      // 1. DB에서 가장 적합한 화학물질 매칭 찾기
      let foundSubstance = null;

      const formulaMap = {
        "naoh": "수산화나트륨",
        "hcl": "염산",
        "h2so4": "황산",
        "hno3": "질산",
        "ch3cooh": "아세트산",
        "nacl": "염화나트륨",
        "kmno4": "과망간산칼륨",
        "h2o2": "과산화수소",
        "cuso4": "황산구리",
        "agno3": "질산은",
        "nahco3": "탄산수소나트륨",
        "na2co3": "탄산나트륨",
        "caco3": "탄산칼슘",
        "ca(oh)2": "수산화칼슘",
        "koh": "수산화칼륨",
        "nh4oh": "수산화암모늄",
        "nh3": "암모니아"
      };

      const buildSearchTerms = (token) => {
        const terms = [token];
        const noSpace = token.replace(/\s+/g, "");
        if (noSpace.length >= 2 && !terms.includes(noSpace)) {
          terms.push(noSpace);
        }
        const lower = token.toLowerCase();
        if (formulaMap[lower] && !terms.includes(formulaMap[lower])) {
          terms.push(formulaMap[lower]);
        }
        return terms;
      };

      const fetchCandidateSubstance = async (st) => {
        const noSpace = st.replace(/\s+/g, "");

        // A. 정확히 일치하는 화학물질 (.eq 및 _mod 컬럼 공백 제거 일치) 최우선
        const { data: exactList } = await supabase
          .from("Substance")
          .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
          .or(`chem_name_kor.eq.${st},chem_name_kor_mod.eq.${noSpace},substance_name.eq.${st},substance_name_mod.eq.${noSpace},molecular_formula.eq.${st},molecular_formula_mod.eq.${st}`)
          .limit(1);

        if (exactList && exactList.length > 0) return exactList[0];

        // B. 단어 시작 일치 (`st%` 및 `_mod` 컬럼 공백 제거 시작 일치)
        const { data: prefixList } = await supabase
          .from("Substance")
          .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
          .or(`chem_name_kor.ilike.${st}%,chem_name_kor_mod.ilike.${noSpace}%,substance_name.ilike.${st}%,substance_name_mod.ilike.${noSpace}%`)
          .limit(10);

        if (prefixList && prefixList.length > 0) {
          prefixList.sort((a, b) => {
            const nameA = a.chem_name_kor_mod || a.chem_name_kor || "";
            const nameB = b.chem_name_kor_mod || b.chem_name_kor || "";
            return nameA.length - nameB.length;
          });
          return prefixList[0];
        }

        // C. 부분 일치 (`%st%` 및 `_mod` 최단 이름 정렬)
        const { data: partialList } = await supabase
          .from("Substance")
          .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
          .or(`chem_name_kor.ilike.%${st}%,chem_name_kor_mod.ilike.%${noSpace}%,substance_name.ilike.%${st}%,substance_name_mod.ilike.%${noSpace}%,molecular_formula.ilike.%${st}%,molecular_formula_mod.ilike.%${st}%`)
          .limit(10);

        if (partialList && partialList.length > 0) {
          partialList.sort((a, b) => {
            const nameA = a.chem_name_kor_mod || a.chem_name_kor || "";
            const nameB = b.chem_name_kor_mod || b.chem_name_kor || "";
            return nameA.length - nameB.length;
          });
          return partialList[0];
        }

        return null;
      };

      // 1단계: 원본 토큰 및 띄어쓰기/화학식 변형 검색
      for (const token of tokens) {
        if (token.length < 2) continue; // 1글자는 스킵

        const searchTerms = buildSearchTerms(token);

        for (const st of searchTerms) {
          foundSubstance = await fetchCandidateSubstance(st);
          if (foundSubstance) break;
        }
        if (foundSubstance) break;
      }

      // 2단계: 1단계 실패 시 한국어 조사/접사 제거 후 검색
      if (!foundSubstance) {
        for (const token of tokens) {
          if (token.length < 2) continue;

          const stripped = token.replace(/(의|은|는|이|가|을|를|과|와|도|으로|로|에|에서|이란|이란것|란|학교에|학교에서|과학실에)$/, "");
          if (stripped.length < 2 || stripped === token) continue;

          const searchTerms = buildSearchTerms(stripped);

          for (const st of searchTerms) {
            foundSubstance = await fetchCandidateSubstance(st);
            if (foundSubstance) break;
          }
          if (foundSubstance) break;
        }
      }

      // 3단계: Substance에서 못 찾았을 경우 Inventory 직접 검색 (사용자가 수동 등록한 시약명 대응)
      if (!foundSubstance) {
        for (const token of tokens) {
          if (token.length < 2) continue;
          const stripped = token.replace(/(의|은|는|이|가|을|를|과|와|도|으로|로|에|에서|이란|이란것|란|학교에|학교에서|과학실에)$/, "");
          const searchTerms = buildSearchTerms(stripped.length >= 2 ? stripped : token);

          for (const st of searchTerms) {
            const { data: invMatches } = await supabase
              .from("Inventory")
              .select("id, substance_id, edited_name_kor, Substance ( id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass )")
              .ilike("edited_name_kor", `%${st}%`)
              .limit(1);

            if (invMatches && invMatches.length > 0) {
              foundSubstance = invMatches[0].Substance || {
                id: invMatches[0].substance_id,
                chem_name_kor: invMatches[0].edited_name_kor,
                substance_name: invMatches[0].edited_name_kor
              };
              break;
            }
          }
          if (foundSubstance) break;
        }
      }

      // 시약 매칭 성공 시 컨텍스트 업데이트, 실패하고 맥락 참조 단어 또는 속성 질의가 없으면 이전 컨텍스트 초기화
      const isContextQuery = isMwQuery || isMsdsQuery || isPropQuery || query.includes("이 시약") || query.includes("이 물질") || query.includes("해당 시약") || query.includes("이거") || query.includes("그거");
      if (foundSubstance) {
        this.selectedSubstance = foundSubstance;
      } else if (!isContextQuery) {
        this.selectedSubstance = null;
      }

      const substance = this.selectedSubstance;

      // 시약이 선택되지 않은 상태에서 속성 버튼(분자량/위험성/특성) 클릭 시 안내
      if (!substance && (isMwQuery || isMsdsQuery || isPropQuery)) {
        return `💡 시약이 먼저 선택되어야 합니다. 궁금하신 시약의 이름(예: **염산**, **수산화나트륨**, **에탄올**)을 먼저 입력해 주세요.`;
      }

      // --- 농도 변환 레시피 질의 처리 ---
      const concMatch = query.match(/([0-9.]+)\s*(M|mM|%|N)/i);
      const volMatch = query.match(/([0-9.]+)\s*(mL|L|l)/i);
      const makeKeywords = ["만들", "필요", "조제", "희석", "제조", "배합", "레시피"];
      const isMakeQuery = tokens.some(t => makeKeywords.some(k => t.includes(k))) || (concMatch && volMatch);

      if (isMakeQuery && (concMatch || volMatch)) {
        return await this.handleConcCalcQuery(query);
      }


      // 1.5. DB에서 교구/설비 매칭 찾기 (화학물질 매칭 실패 시)
      let foundTools = null;
      if (!substance) {
        for (const token of tokens) {
          if (token.length < 2) continue;
          const { data } = await supabase
            .from("tools")
            .select("*")
            .or(`tools_name.ilike.%${token}%,tools_category.ilike.%${token}%`)
            .limit(5);

          if (data && data.length > 0) {
            foundTools = data;
            break;
          }
        }

        if (!foundTools) {
          for (const token of tokens) {
            if (token.length < 2) continue;
            const stripped = token.replace(/(의|은|는|이|가|을|를|과|와|도|으로|로|에|에서|이란|이란것|란)$/, "");
            if (stripped.length < 2 || stripped === token) continue;

            const { data } = await supabase
              .from("tools")
              .select("*")
              .or(`tools_name.ilike.%${stripped}%,tools_category.ilike.%${stripped}%`)
              .limit(5);

            if (data && data.length > 0) {
              foundTools = data;
              break;
            }
          }
        }
      }
 
      // 2. 물질 매칭 실패 시 -> 긴급/폐기 일반 대처 혹은 AI Fallback
      if (!substance) {
        if (foundTools) {
          let toolListHtml = "";
          foundTools.forEach(t => {
            const locStr = this.formatToolLocation(t.location);
            const displayNo = t.tools_no ? `No.${t.tools_no}` : '';
            const categoryText = t.tools_category ? ` - ${t.tools_category}` : '';

            toolListHtml += `
              <div class="chatbot-matching-item" style="padding: 8px 0; border-bottom: 1px dashed #eee; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span class="chatbot-matching-name" style="font-weight: bold; color: #111;">🧩 [${t.tools_section || '교구'}${categoryText}] ${t.tools_name}</span>
                  <div style="font-size: 12px; color: #555; margin-top: 4px; line-height: 1.4;">
                    📍 <b>위치:</b> ${locStr}<br>
                    📦 <b>보유 수량:</b> ${t.stock || 0}개
                  </div>
                </div>
                <span style="font-size: 11px; color: #888; white-space: nowrap; margin-left: 8px;">${displayNo}</span>
              </div>
            `;
          });

          return `🔍 <b>교구/설비</b> 검색 결과입니다.
          <div class="chatbot-matching-card" style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px; margin-top: 8px;">
            <div class="chatbot-matching-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; margin-bottom: 8px;">
              <div class="chatbot-matching-title" style="font-weight: bold; color: #495057;">교구/설비 보관 위치</div>
              <span class="matching-badge badge-instock" style="background: #e9ecef; color: #495057; font-size: 11px; padding: 2px 6px; border-radius: 4px;">${foundTools.length}건 매칭</span>
            </div>
            <div class="chatbot-matching-grid" style="display: flex; flex-direction: column;">
              ${toolListHtml}
            </div>
          </div>
`;
        }

        if (isLocationQuery) {
          const targetToken = tokens.find(t => {
            const clean = t.replace(/(의|은|는|이|가|을|를|과|와|도|으로|로|에|에서|이란|이란것|란|학교에|학교에서|과학실에)$/, "");
            return !locationKeywords.some(k => k.includes(clean) || clean.includes(k)) && clean.length >= 2;
          });

          if (targetToken) {
            const cleanTarget = targetToken.replace(/(의|은|는|이|가|을|를|과|와|도|으로|로|에|에서|이란|이란것|란|학교에|학교에서|과학실에)$/, "");
            return `❌ **[${cleanTarget}]** 약품, 교구 또는 설비 정보를 과학실 DB(재고)에서 찾을 수 없습니다.

💡 <b>확인 사항:</b>
- 시약/교구명이 올바르게 입력되었는지 확인해 주세요.
- 과학실 재고 목록에 해당 품목이 등록되어 있는지 확인해 주세요.`;
          }

          return `🔍 <b>보관 위치 조회 가이드</b>
          <div style="font-size:12.5px; color:#495057; line-height:1.5; padding:8px 0;">
            찾고자 하는 **약품, 교구, 또는 설비의 이름**을 함께 입력해 주세요.<br>
            예를 들어 다음과 같이 물어볼 수 있습니다:<br><br>
            - *"수산화 나트륨 어디 있어?"* (약품 위치)<br>
            - *"현미경 위치 알려줘"* (교구 위치)<br>
            - *"흄후드 어딨어?"* (설비 위치)
          </div>
          <div class="chatbot-chips-container" style="margin-top: 10px; display: flex; gap: 5px;">
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('수산화 나트륨 위치')">🧪 수산화 나트륨 위치</button>
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('현미경')">🧩 현미경</button>
          </div>`;
        }

        if (isEmergencyQuery) {
          return `🚨 <b>과학실 긴급 상황 대처 요령</b>
          <div class="chatbot-emergency-card">
            <div class="chatbot-emergency-header">
              <span class="material-symbols-outlined" style="color:#e03131; font-size:18px;">emergency</span>
              <span class="chatbot-emergency-title">비상시 기본 행동 강령</span>
            </div>
            <div class="chatbot-emergency-desc">
              1. <b>피부/눈 노출</b>: 약품이 묻거나 튀었을 경우 즉시 세안기/눈 세척기에서 15분 이상 흐르는 물로 씻어내고 교사에게 알립니다.<br>
              2. <b>화재 발생</b>: 대피 경보를 울리고 소화기로 초기 진압을 시도하되, 불길이 크면 지체 없이 대피로를 따라 대피합니다.<br>
              3. <b>약품 유출/유리 파손</b>: 맨손으로 만지지 말고 빗자루와 쓰레받기를 사용해 수거하며, 유기용제 유출 시 즉시 창문을 열어 환기합니다.
            </div>
          </div>
          <div class="chatbot-chips-container" style="margin-top: 10px;">
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('수산화 나트륨')">🧪 수산화 나트륨</button>
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('염산')">🧪 염산</button>
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('에탄올')">🧪 에탄올</button>
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('아세톤')">🧪 아세톤</button>
          </div>`;
        }

        if (isWasteQuery) {
          return `🗑️ <b>과학실 화학 폐기물 처리 요령</b>
          <div class="chatbot-chemical-card">
            <div class="chatbot-chem-header">
              <span class="chatbot-chem-title">폐액 분리 배출 기본 원칙</span>
            </div>
            <div style="font-size:12.5px; color:#495057; line-height:1.5; padding:8px 0;">
              1. <b>분리 수거</b>: 산성, 알칼리성, 유기용제, 무기폐수 등 액성에 맞춰 지정된 폐액통에 분리 배출합니다.<br>
              2. <b>혼합 금지</b>: 서로 반응성이 있는 물질(예: 산성과 염기성, 유기용제와 무기산)을 대량으로 섞으면 열과 독성 가스가 발생하므로 절대 혼합하지 않습니다.<br>
              3. <b>안전 장비</b>: 배출 시에는 반드시 보안경과 내화학성 장갑을 착용합니다.
            </div>
          </div>
          <div class="chatbot-chips-container" style="margin-top: 10px;">
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('수산화 나트륨')">🧪 수산화 나트륨</button>
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('염산')">🧪 염산</button>
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('에탄올')">🧪 에탄올</button>
          </div>`;
        }

        if (this.apiKey) {
          return await this.callAI(query);
        } else {
          // DB에 미답변 질문 저장
          const supabase = getSupabase();
          if (supabase) {
            supabase.from("chatbot_unanswered")
              .insert([{ query: query }])
              .then(({ error }) => {
                if (error) console.error("Failed to save unanswered query:", error);
              });
          }
          return `죄송합니다. 현재는 답변드릴 수 없습니다. 질문하신 내용을 검토하여 추후 답변 가능하도록 기능개선을 위해 노력하겠습니다.`;
        }
      }

      // 3. 물질 매칭 성공 -> 의도별 분기 처리 및 2단계 질문 유도
      const chemName = substance.chem_name_kor_mod || substance.chem_name_kor || substance.substance_name_mod || substance.substance_name;
      const casRn = substance.cas_rn || "CAS없음";
      const formula = substance.molecular_formula_mod || substance.molecular_formula || "-";
      const molMass = substance.molecular_mass ? `${substance.molecular_mass} g/mol` : "-";

      // 입력창 placeholder 업데이트
      const inputEl = document.getElementById("chatbot-input");
      if (inputEl) {
        inputEl.placeholder = "무엇을 도와드릴까요?";
      }

      // --- 긴급 SOS 및 폐액 가이드 분기 처리 (아이디어 4) ---
      if (isEmergencyQuery) {
        const { data: msdsData } = await supabase
          .from("MSDS")
          .select("content")
          .eq("substance_id", substance.id)
          .eq("section_number", 4)
          .maybeSingle();

        let msds4Text = msdsData?.content || "등록된 MSDS 4번(응급조치 요령) 정보가 없습니다.";
        msds4Text = msds4Text.replace(/;;;/g, "\n").replace(/\|\|\|/g, " - ");

        return `🚨 <b>${chemName}</b> 긴급 응급조치 가이드입니다.
        <div class="chatbot-emergency-card">
          <div class="chatbot-emergency-header">
            <span class="material-symbols-outlined" style="color:#e03131; font-size:18px;">emergency</span>
            <span class="chatbot-emergency-title">MSDS 제4항. 응급조치 요령</span>
          </div>
          <div class="chatbot-emergency-desc">
            ${msds4Text.replace(/\n/g, "<br>")}
          </div>
        </div>
        <div class="chatbot-chips-container" style="margin-top: 10px;">
          <button class="chatbot-chip" onclick="App.Chatbot.askPreset('위험성')">⚠️ 일반 위험성(MSDS)</button>
          <button class="chatbot-chip chip-filled" onclick="App.Chatbot.goToDetail(${substance.id})">상세 이동</button>
          <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 시약 검색</button>
        </div>`;
      }

      if (isWasteQuery) {
        const { data: msdsData } = await supabase
          .from("MSDS")
          .select("content")
          .eq("substance_id", substance.id)
          .eq("section_number", 13)
          .maybeSingle();

        let msds13Text = msdsData?.content || "등록된 MSDS 13번(폐기 시 주의사항) 정보가 없습니다.";
        msds13Text = msds13Text.replace(/;;;/g, "\n").replace(/\|\|\|/g, " - ");

        return `🗑️ <b>${chemName}</b> 안전 폐기 가이드입니다.
        <div class="chatbot-chemical-card">
          <div class="chatbot-chem-header">
            <span class="chatbot-chem-title">MSDS 제13항. 폐기 시 주의사항</span>
          </div>
          <div style="font-size:12.5px; color:#495057; line-height:1.5; padding:8px 0;">
            ${msds13Text.replace(/\n/g, "<br>")}
          </div>
        </div>
        <div class="chatbot-chips-container" style="margin-top: 10px;">
          <button class="chatbot-chip" onclick="App.Chatbot.askPreset('분자량')">⚖️ 분자량</button>
          <button class="chatbot-chip chip-filled" onclick="App.Chatbot.goToDetail(${substance.id})">상세 이동</button>
          <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 시약 검색</button>
        </div>`;
      }

      // 3-0. 위치(Location) 의도
      if (isLocationQuery) {
        const { data: invItems, error: invErr } = await supabase
          .from("Inventory")
          .select(`
            id, current_amount, unit, door_vertical, door_horizontal, internal_shelf_level, storage_column,
            Cabinet ( cabinet_name, door_horizontal_count, area_id:lab_rooms!fk_cabinet_lab_rooms ( room_name ) )
          `)
          .eq("substance_id", substance.id)
          .gt("current_amount", 0); // 재고가 0보다 큰 것만 가져옴

        if (!invErr && invItems && invItems.length > 0) {
          let gridContent = "";

          if (invItems.length > 1) {
            // 여러 개 있는 경우 표 형태로 출력
            let tableRowsHtml = "";
            invItems.forEach(item => {
              const area = item.Cabinet?.area_id?.room_name || "";
              const cabinetName = item.Cabinet?.cabinet_name || "";
              const doorVertical = item.door_vertical || "";
              const doorHorizontal = item.door_horizontal || "";
              const hCount = Number(item.Cabinet?.door_horizontal_count || 0);
              const shelfLevel = item.internal_shelf_level;
              const column = item.storage_column;

              let doorHLabel = "";
              if (hCount > 1) {
                if (doorHorizontal === "1") doorHLabel = "왼쪽";
                else if (doorHorizontal === "2") doorHLabel = "오른쪽";
                else if (doorHorizontal) doorHLabel = doorHorizontal;
              }

              const detailParts = [];
              if (doorVertical && doorHLabel) detailParts.push(`${doorVertical}층 ${doorHLabel}문`);
              else if (doorVertical) detailParts.push(`${doorVertical}층문`);
              else if (doorHLabel) detailParts.push(`${doorHLabel}문`);

              let shelfPart = "";
              if (shelfLevel && column) shelfPart = `${shelfLevel}단 ${column}열`;
              else {
                if (shelfLevel) shelfPart += `${shelfLevel}단`;
                if (column) shelfPart += (shelfPart ? " " : "") + `${column}열`;
              }
              if (shelfPart) detailParts.push(shelfPart);

              const detailStr = detailParts.join(", ");
              const locMain = `${area} 『${cabinetName}』`.trim();
              const fullLoc = detailStr ? `${locMain} (${detailStr})` : locMain;

              tableRowsHtml += `
                <tr style="border-bottom: 1px solid #dee2e6; background: white;">
                  <td style="padding: 6px 4px; font-weight: bold; color: #222; font-size: 11px; text-align: left; word-break: break-all; line-height: 1.3;">📍 ${fullLoc || '미지정'}</td>
                  <td style="padding: 6px 4px; text-align: right; color: #495057; font-size: 11px; white-space: nowrap;">${item.current_amount || 0}${item.unit || ''}</td>
                  <td style="padding: 6px 4px; text-align: center;">
                    <button class="chatbot-chip chip-filled" style="margin: 0; padding: 2px 6px; font-size: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;" onclick="App.Chatbot.goToInventoryDetail(${item.id})">상세</button>
                  </td>
                </tr>
              `.replace(/\n\s*/g, "");
            });

            gridContent = `
              <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; line-height: 1.4; table-layout: auto;">
                <thead>
                  <tr style="border-bottom: 2px solid #dee2e6; text-align: left; background: #f1f3f5; font-weight: bold; color: #495057;">
                    <th style="padding: 6px 4px; text-align: left;">보관 위치</th>
                    <th style="padding: 6px 4px; text-align: right; width: 60px;">수량</th>
                    <th style="padding: 6px 4px; text-align: center; width: 45px;">상세</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                </tbody>
              </table>
            `.replace(/\n\s*/g, "");
          } else {
            // 한 개만 있는 경우 카드 형태
            const item = invItems[0];
            const area = item.Cabinet?.area_id?.room_name || "";
            const cabinetName = item.Cabinet?.cabinet_name || "";
            const doorVertical = item.door_vertical || "";
            const doorHorizontal = item.door_horizontal || "";
            const hCount = Number(item.Cabinet?.door_horizontal_count || 0);
            const shelfLevel = item.internal_shelf_level;
            const column = item.storage_column;

            let doorHLabel = "";
            if (hCount > 1) {
              if (doorHorizontal === "1") doorHLabel = "왼쪽";
              else if (doorHorizontal === "2") doorHLabel = "오른쪽";
              else if (doorHorizontal) doorHLabel = doorHorizontal;
            }

            const detailParts = [];
            if (doorVertical && doorHLabel) detailParts.push(`${doorVertical}층 ${doorHLabel}문`);
            else if (doorVertical) detailParts.push(`${doorVertical}층문`);
            else if (doorHLabel) detailParts.push(`${doorHLabel}문`);

            let shelfPart = "";
            if (shelfLevel && column) shelfPart = `${shelfLevel}단 ${column}열`;
            else {
              if (shelfLevel) shelfPart += `${shelfLevel}단`;
              if (column) shelfPart += (shelfPart ? " " : "") + `${column}열`;
            }
            if (shelfPart) detailParts.push(shelfPart);

            const detailStr = detailParts.join(", ");
            const locMain = `${area} 『${cabinetName}』`.trim();
            const fullLoc = detailStr ? `${locMain} (${detailStr})` : locMain;

            gridContent = `
              <div class="chatbot-matching-item" style="padding: 6px 0; border-bottom: 1px dashed #eee; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span class="chatbot-matching-name" style="font-weight: bold; color: #222;">📍 ${fullLoc || '위치 미지정'}</span>
                  <div style="font-size: 11.5px; color: #666; margin-top: 2px;">📦 보유 수량: ${item.current_amount || 0}${item.unit || '개'} (No.${item.id})</div>
                </div>
                <button class="chatbot-chip chip-filled" style="margin: 0; padding: 2px 8px; font-size:11px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="App.Chatbot.goToInventoryDetail(${item.id})">상세이동</button>
              </div>
            `.replace(/\n\s*/g, "");
          }

          return `📍 <b>${chemName}</b>의 과학실 내 보관 위치 정보입니다.
` + `
          <div class="chatbot-chemical-card" style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px; margin-top: 8px;">
            <div class="chatbot-chem-header" style="display: flex; flex-direction: column; align-items: flex-start; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; margin-bottom: 8px; gap: 4px; width: 100%;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="chatbot-chem-title" style="font-weight: bold; color: #111; font-size: 15px; margin: 0; padding: 0; line-height: 1.2;">${chemName}</span>
                <span class="chatbot-chem-cas" style="font-size: 11px; background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-family: monospace; line-height: 1.2;">${casRn}</span>
              </div>
              <div class="chatbot-chem-subtitle" style="font-size: 11px; color: #666; margin: 0; padding: 0; line-height: 1.2; text-align: left;">${substance.substance_name || ""}</div>
            </div>
            <div style="display: flex; flex-direction: column; width: 100%;">
              ${gridContent}
            </div>
          </div>
          <div class="chatbot-chips-container" style="margin-top: 10px; display: flex; gap: 5px;">
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('위험성')">⚠️ 위험성(MSDS)</button>
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('물리적 특성')">🌡️ 물리적 특성</button>
          </div>`.replace(/\n\s*/g, "");
        } else {
          return `🔍 <b>${chemName}</b> (CAS: ${casRn})의 화학물질 정보는 등록되어 있으나, 현재 과학실 내에 **보관된 시약병(재고)이 없습니다.**
          
💡 **도움말:**
이 물질에 대해 다른 정보를 원하시면 아래 버튼을 눌러보세요.
<div class="chatbot-chips-container" style="margin-top: 10px; display: flex; gap: 5px;">
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('위험성')">⚠️ 위험성(MSDS)</button>
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('분자량')">⚖️ 분자량</button>
</div>`;
        }
      }

      // 3-1. 분자량(Molecular Weight) 의도
      if (isMwQuery) {
        return `⚖️ <b>${chemName}</b> (CAS: ${casRn})의 분자량 정보입니다.
        
- **분자식**: ${formula}
- **분자량**: <b>${molMass}</b>
<div class="chatbot-chips-container" style="margin-top: 10px;">
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('위험성')">⚠️ 위험성(MSDS)</button>
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('물리적 특성')">🌡️ 물리적 특성</button>
  <button class="chatbot-chip chip-filled" onclick="App.Chatbot.goToDetail(${substance.id})">상세 이동</button>
</div>`;
      }

      // 3-2. 위험성/MSDS 의도
      if (isMsdsQuery) {
        // MSDS 2번 조회
        const { data: msdsData } = await supabase
          .from("MSDS")
          .select("content")
          .eq("substance_id", substance.id)
          .eq("section_number", 2)
          .maybeSingle();

        // 유해화학물질 고시 조회
        const { data: hazardData } = await supabase
          .from("HazardClassifications")
          .select("sbstnClsfTypeNm, contInfo")
          .eq("substance_id", substance.id);

        let msds2Text = msdsData?.content || "등록된 MSDS 2번(유해성·위험성) 정보가 없습니다.";
        msds2Text = msds2Text.replace(/;;;/g, "\n").replace(/\|\|\|/g, " - ");

        const ghsDescriptions = {
          "01": "폭발성",
          "02": "인화성",
          "03": "산화성",
          "04": "고압 가스",
          "05": "부식성",
          "06": "급성 독성",
          "07": "경고/자극성",
          "08": "건강 유해성",
          "09": "환경 유해성"
        };

        // GHS 파일명 간의 줄바꿈(\n)을 공백으로 변경하여 나란히 표기
        msds2Text = msds2Text.replace(/(GHS\d+\.gif)\s*[\r\n]+\s*/gi, "$1 ");
        msds2Text = msds2Text.replace(/(GHS\d+\.gif)\s*[\r\n]+\s*/gi, "$1 ");

        msds2Text = msds2Text.replace(/GHS(\d+)\.gif/gi, (m, p1) => {
          const num = p1.padStart(2, "0");
          const imgUrl = `https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${num}.gif`;
          const label = ghsDescriptions[num] || `GHS${num}`;
          return `<span style="display: inline-flex; align-items: center; gap: 4px; background: #ffffff; border: 1px solid #ffc9c9; border-radius: 6px; padding: 2px 6px; margin: 2px 4px 2px 0; font-size: 11.5px; font-weight: bold; color: #d6336c; box-shadow: 0 1px 3px rgba(0,0,0,0.05); vertical-align: middle; white-space: nowrap;">
            <img src="${imgUrl}" alt="${label}" style="width: 22px; height: 22px; vertical-align: middle; object-fit: contain;" onerror="this.onerror=null; this.style.display='none';">
            ${label}
          </span>`;
        });

        let hazardText = "";
        if (hazardData && hazardData.length > 0) {
          hazardText = "\n\n⚠️ <b>법적 규제/고시 정보:</b>\n" + hazardData.map(h => `- **${h.sbstnClsfTypeNm}**: ${h.contInfo}`).join("\n");
        }

        return `⚠️ <b>${chemName}</b> (CAS: ${casRn})의 MSDS 위험성 정보입니다.
        
📢 <b>[MSDS 제2항. 유해성·위험성]</b>
${msds2Text}${hazardText}
<div class="chatbot-chips-container" style="margin-top: 10px;">
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('분자량')">⚖️ 분자량</button>
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('물리적 특성')">🌡️ 물리적 특성</button>
  <button class="chatbot-chip chip-filled" onclick="App.Chatbot.goToDetail(${substance.id})">상세 이동</button>
</div>`;
      }

      // 3-3. 물리화학적 특성 의도
      if (isPropQuery) {
        // Properties 테이블 조회
        const { data: props } = await supabase
          .from("Properties")
          .select("name, property")
          .eq("substance_id", substance.id);

        // MSDS 9번 조회
        const { data: msdsData } = await supabase
          .from("MSDS")
          .select("content")
          .eq("substance_id", substance.id)
          .eq("section_number", 9)
          .maybeSingle();

        let propText = "";
        if (props && props.length > 0) {
          propText = props.map(p => `- **${p.name}**: ${p.property}`).join("\n");
        } else if (msdsData?.content) {
          propText = msdsData.content.replace(/;;;/g, "\n").replace(/\|\|\|/g, " - ");
        } else {
          propText = "등록된 물리화학적 특성 정보가 없습니다.";
        }

        return `🌡️ <b>${chemName}</b> (CAS: ${casRn})의 물리화학적 특성 정보입니다.
        
${propText}
<div class="chatbot-chips-container" style="margin-top: 10px;">
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('분자량')">⚖️ 분자량</button>
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('위험성')">⚠️ 위험성(MSDS)</button>
  <button class="chatbot-chip chip-filled" onclick="App.Chatbot.goToDetail(${substance.id})">상세 이동</button>
</div>`;
      }

      // 3-4. 일반 요약 카드 및 퀵 헬퍼 출력 (선택된 시약에 대한 추가 질문 유도 단계)
      if (this.apiKey) {
        // AI 활성화 상태에서 다른 상세 질문을 입력한 경우
        const aiPrompt = `[현재 선택된 시약 정보]\n시약명: ${chemName}\nCAS 번호: ${casRn}\n화학식: ${formula}\n분자량: ${molMass}\n\n질문: ${query}`;
        return await this.callAI(aiPrompt);
      }

      // AI가 비활성화된 상태이거나 시약 이름만 입력한 경우 요약 카드 출력
      const summaryCardHtml = `🧪 <b>${chemName}</b> 시약이 선택되었습니다. 이 시약에 대해 무엇이 궁금하신가요?
` + `
        <div class="chatbot-chemical-card" style="background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 12px; padding: 12px 14px; margin-top: 8px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
          <div class="chatbot-chem-header" style="display: flex; flex-direction: column; align-items: flex-start; border-bottom: 1px dashed rgba(0, 0, 0, 0.08); padding-bottom: 6px; gap: 4px; width: 100%;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="chatbot-chem-title" style="font-weight: bold; font-size: 14px; color: #111; margin: 0; padding: 0; line-height: 1.2;">${chemName}</span>
              <span class="chatbot-chem-cas" style="font-size: 11px; background-color: #f1f3f5; color: #495057; padding: 2px 6px; border-radius: 4px; font-family: monospace; line-height: 1.2;">${casRn}</span>
            </div>
            <div class="chatbot-chem-subtitle" style="font-size: 11px; color: #666; margin: 0; padding: 0; line-height: 1.2; text-align: left;">${substance.substance_name || ""}</div>
          </div>
            <div class="chatbot-chem-label" style="color: #777; font-weight: 500;">분자식</div>
            <div class="chatbot-chem-val" style="color: #333;">${formula}</div>
            <div class="chatbot-chem-label" style="color: #777; font-weight: 500;">분자량</div>
            <div class="chatbot-chem-val" style="color: #333;">${molMass}</div>
          </div>
          <div class="chatbot-chem-footer-btns" style="display: flex; gap: 6px; margin-top: 6px;">
            <button class="chatbot-chem-btn" style="flex: 1; padding: 6px 0; font-size: 11px; font-weight: bold; border-radius: 6px; border: 1px solid #00a0b2; background: transparent; color: #00a0b2; cursor: pointer; text-align: center;" onclick="App.Chatbot.askPreset('분자량')">분자량</button>
            <button class="chatbot-chem-btn" style="flex: 1; padding: 6px 0; font-size: 11px; font-weight: bold; border-radius: 6px; border: 1px solid #00a0b2; background: transparent; color: #00a0b2; cursor: pointer; text-align: center;" onclick="App.Chatbot.askPreset('위험성')">위험성</button>
            <button class="chatbot-chem-btn" style="flex: 1; padding: 6px 0; font-size: 11px; font-weight: bold; border-radius: 6px; border: 1px solid #00a0b2; background: transparent; color: #00a0b2; cursor: pointer; text-align: center;" onclick="App.Chatbot.askPreset('특성')">물리<br>특성</button>
            <button class="chatbot-chem-btn btn-filled" style="flex: 1; padding: 6px 0; font-size: 11px; font-weight: bold; border-radius: 6px; border: 1px solid #00a0b2; background: #00a0b2; color: #ffffff; cursor: pointer; text-align: center;" onclick="App.Chatbot.goToDetail(${substance.id})">상세<br>이동</button>
          </div>
        </div>
      `.replace(/\n\s*/g, "");
      return summaryCardHtml;
    },

    goToDetail: function (substanceId) {
      const supabase = getSupabase();
      if (!supabase) return;

      supabase
        .from("Inventory")
        .select("id")
        .eq("substance_id", substanceId)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            this.togglePanel(false);
            if (getApp().Router?.go) {
              getApp().Router.go("inventoryDetail", { id: data[0].id });
            } else {
              localStorage.setItem("selected_inventory_id", data[0].id);
              location.reload();
            }
          } else {
            alert("해당 물질의 등록된 재고(시약병)가 없습니다.");
          }
        });
    },

    goToInventoryDetail: function (inventoryId) {
      this.togglePanel(false);
      if (getApp().Router?.go) {
        getApp().Router.go("inventoryDetail", { id: inventoryId });
      } else {
        localStorage.setItem("selected_inventory_id", inventoryId);
        location.reload();
      }
    },

    // ------------------------------------------------------------
    // 🧪 동적 DB Cross-Reference 시약 검색 엔진 (하드코딩 맵 전면 제거)
    // ------------------------------------------------------------
    findSubstanceByName: async function (query) {
      const supabase = getSupabase();
      if (!supabase) return null;

      // 1. 단 단위 및 농도 패턴(0.1M, 500mL, 1L, 36% 등) 정규화 및 분리
      // 온점(.)이 숫자 내 소수점일 경우 마침표로 오인하여 띄어쓰기 분리되지 않도록 보호
      const cleanText = query.replace(/[?,/#!$%\^&\*;:{}=\-_`~()]/g, " ").trim();
      const rawTokens = cleanText.split(/\s+/).filter(t => t.length >= 1);

      // 숫자, 몰농도(M), 부피(mL/L), 질량(g), 퍼센트(%) 등 수치/단위 토큰 제외 필터링
      const isUnitOrQuantityToken = (t) => {
        if (/^\d+(\.\d+)?(m|l|ml|g|kg|molar|%|n|몰|노르말|밀리리터|리터|그램)?$/i.test(t)) return true;
        if (/^(\d+(\.\d+)?)+(m|l|ml|g|kg|몰|노르말|밀리리터|리터|그램|%)+$/i.test(t)) return true;
        if (/^(m|l|ml|g|kg|몰|노르말|밀리리터|리터|그램|%)$/i.test(t)) return true;
        return false;
      };

      const tokens = rawTokens.filter(t => !isUnitOrQuantityToken(t));

      // 🧪 2. 화학식(Formula) 우선 탐색 (예: NaOH, HCl, KBr, H2SO4)
      for (const token of tokens) {
        if (/^[A-Za-z0-9]{2,}$/.test(token)) {
          const { data: formulaSub } = await supabase
            .from("Substance")
            .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
            .or(`molecular_formula.eq.${token},molecular_formula_mod.eq.${token}`)
            .limit(1);

          if (formulaSub && formulaSub.length > 0) {
            return formulaSub[0];
          }
        }
      }

      // 계층별 동적 DB Cross-Reference 검색 함수 (공백 불일치 자동 흡수 알고리즘 적용)
      const querySubstanceCandidate = async (st) => {
        if (!st || st.length < 1) return null;
        const noSpace = st.replace(/\s+/g, "");
        // 띄어쓰기 임의 포함 대응용 와일드카드 패턴 (예: "탄산칼슘" -> "%탄%산%칼%슘%")
        const syllableWildcard = noSpace.length >= 2 ? `%${noSpace.split("").join("%")}%` : `%${noSpace}%`;

        // 1. Substance 테이블 직접 검색
        // A. 정확히 일치 (.eq 및 _mod 공백 정제 컬럼)
        const { data: exactList } = await supabase
          .from("Substance")
          .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
          .or(`chem_name_kor.eq.${st},chem_name_kor_mod.eq.${noSpace},substance_name.eq.${st},substance_name_mod.eq.${noSpace},molecular_formula.eq.${st},molecular_formula_mod.eq.${st}`)
          .limit(1);

        if (exactList && exactList.length > 0) {
          return exactList[0];
        }

        // B. 단어 시작 일치 (st% 및 _mod 컬럼 공백 정제 시작 일치)
        const { data: prefixList } = await supabase
          .from("Substance")
          .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
          .or(`chem_name_kor.ilike.${st}%,chem_name_kor_mod.ilike.${noSpace}%,substance_name.ilike.${st}%,substance_name_mod.ilike.${noSpace}%`)
          .limit(10);

        if (prefixList && prefixList.length > 0) {
          prefixList.sort((a, b) => {
            const nameA = a.chem_name_kor_mod || a.chem_name_kor || "";
            const nameB = b.chem_name_kor_mod || b.chem_name_kor || "";
            return nameA.length - nameB.length;
          });
          return prefixList[0];
        }

        // C. 부분 일치 (%st% 및 음절 와일드카드 %탄%산%칼%슘%)
        const { data: partialList } = await supabase
          .from("Substance")
          .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
          .or(`chem_name_kor.ilike.%${st}%,chem_name_kor_mod.ilike.%${noSpace}%,chem_name_kor.ilike.${syllableWildcard},substance_name.ilike.%${st}%,substance_name_mod.ilike.%${noSpace}%,molecular_formula.ilike.%${st}%,molecular_formula_mod.ilike.%${st}%`)
          .limit(10);

        if (partialList && partialList.length > 0) {
          partialList.sort((a, b) => {
            const nameA = a.chem_name_kor_mod || a.chem_name_kor || "";
            const nameB = b.chem_name_kor_mod || b.chem_name_kor || "";
            return nameA.length - nameB.length;
          });
          return partialList[0];
        }

        // 2. Synonyms 테이블 대조 (synonyms_name, synonyms_eng) - 띄어쓰기 무시 대조
        try {
          const { data: synList } = await supabase
            .from("Synonyms")
            .select(`
              substance_id, synonyms_name, synonyms_eng,
              Substance ( id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass )
            `)
            .or(`synonyms_name.ilike.%${st}%,synonyms_name.ilike.${syllableWildcard},synonyms_eng.ilike.%${st}%,synonyms_eng.ilike.${syllableWildcard}`)
            .limit(10);

          if (synList && synList.length > 0) {
            // JS 인메모리 공백 제거 정밀 대조
            const matchedSyn = synList.find(s => {
              if (!s.Substance) return false;
              const synNameClean = (s.synonyms_name || "").replace(/\s+/g, "");
              const synEngClean = (s.synonyms_eng || "").replace(/\s+/g, "").toLowerCase();
              return synNameClean.includes(noSpace) || noSpace.includes(synNameClean) || synEngClean.includes(noSpace.toLowerCase());
            });
            if (matchedSyn?.Substance) return matchedSyn.Substance;
            if (synList[0]?.Substance) return synList[0].Substance;
          }
        } catch (e) {
          console.warn("Synonyms lookup warning:", e);
        }

        // 3. SubstanceRef 테이블 대조 (chem_name_kor_ref, substance_name_ref) - 띄어쓰기 무시 대조
        try {
          const { data: refList } = await supabase
            .from("SubstanceRef")
            .select(`
              cas_rn, chem_name_kor_ref, substance_name_ref,
              Substance ( id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass )
            `)
            .or(`chem_name_kor_ref.ilike.%${st}%,chem_name_kor_ref.ilike.${syllableWildcard},substance_name_ref.ilike.%${st}%,substance_name_ref.ilike.${syllableWildcard}`)
            .limit(10);

          if (refList && refList.length > 0) {
            const matchedRef = refList.find(r => {
              if (!r.Substance) return false;
              const refKorClean = (r.chem_name_kor_ref || "").replace(/\s+/g, "");
              const refEngClean = (r.substance_name_ref || "").replace(/\s+/g, "").toLowerCase();
              return refKorClean.includes(noSpace) || noSpace.includes(refKorClean) || refEngClean.includes(noSpace.toLowerCase());
            });
            if (matchedRef?.Substance) return matchedRef.Substance;
            if (refList[0]?.Substance) return refList[0].Substance;

            const casItem = refList.find(r => r.cas_rn);
            if (casItem?.cas_rn) {
              const { data: casSub } = await supabase
                .from("Substance")
                .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
                .eq("cas_rn", casItem.cas_rn.trim())
                .limit(1);
              if (casSub && casSub.length > 0) return casSub[0];
            }
          }
        } catch (e) {
          console.warn("SubstanceRef lookup warning:", e);
        }

        // 4. Inventory 테이블 대조 (edited_name_kor) - 띄어쓰기 무시 대조
        try {
          const { data: invMatches } = await supabase
            .from("Inventory")
            .select(`
              edited_name_kor, substance_id,
              Substance ( id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass )
            `)
            .or(`edited_name_kor.ilike.%${st}%,edited_name_kor.ilike.${syllableWildcard}`)
            .limit(10);

          if (invMatches && invMatches.length > 0) {
            const matchedInv = invMatches.find(i => {
              if (!i.Substance) return false;
              const invNameClean = (i.edited_name_kor || "").replace(/\s+/g, "");
              return invNameClean.includes(noSpace) || noSpace.includes(invNameClean);
            });
            if (matchedInv?.Substance) return matchedInv.Substance;
            if (invMatches[0]?.Substance) return invMatches[0].Substance;
          }
        } catch (e) {
          console.warn("Inventory edited_name_kor lookup warning:", e);
        }

        return null;
      };

      // 토큰 탐색 (1단계: 원본 토큰 -> 2단계: 조사/접사 제거 토큰)
      const targetTokens = tokens.length > 0 ? tokens : rawTokens;
      for (const token of targetTokens) {
        if (token.length < 2 && !/[a-zA-Z]/.test(token)) continue;
        const matched = await querySubstanceCandidate(token);
        if (matched) return matched;
      }

      for (const token of targetTokens) {
        if (token.length < 2) continue;
        const stripped = token.replace(/(의|은|는|이|가|을|를|과|와|도|으로|로|에|에서|이란|이란것|란|학교에|학교에서|과학실에)$/, "");
        if (stripped.length < 2 || stripped === token) continue;

        const matched = await querySubstanceCandidate(stripped);
        if (matched) return matched;
      }

      return null;
    },

    // ------------------------------------------------------------
    // 6️⃣ 다중 LLM API 연동 (오타 교정 및 복합 설명)
    // ------------------------------------------------------------
    callAI: async function (prompt) {
      if (!this.apiKey) {
        return "❌ API Key가 설정되어 있지 않습니다.";
      }

      const systemInstruction = `너는 중고등학교 과학실 시약 및 안전 관리 프로그램 'SciManager'의 친절한 인공지능 비서(Chatbot)야. 
다음 원칙에 따라 한국어로 친절하게 대답해줘:
1. 화학물질 분자량, 화학식, MSDS 정보, 보관 방법 등에 대한 과학적 질문에 성실히 답해줘.
2. 사용자가 오타를 내면(예: '수산화 타트륨') 문맥상 적절한 화학물질('수산화 나트륨')로 자동 인지하여 유연하게 대답해주고, 오타가 있었음을 친절하게 짚어줘.
3. 데이터베이스 조회에 실패한 질문에 대해 알고 있는 화학 지식을 기반으로 올바르게 설명해주되, 데이터베이스(DB)에는 없는 물질일 수 있음을 함께 덧붙여줘.
4. 답변은 간결하고 가독성이 좋게 마크다운 문법(굵게, 글머리표)을 적극 활용해줘.`;

      const provider = this.provider || "gemini";
      const modelName = this.model || "gpt-4o-mini";

      if (provider === "gemini") {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              systemInstruction: { parts: [{ text: systemInstruction }] }
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `HTTP ${response.status}`);
          }

          const json = await response.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) {
            return "🤖 AI 비서가 답변을 구성하지 못했습니다. 질문을 바르게 입력해 주세요.";
          }

          return rawText.trim();
        } catch (err) {
          console.error("Gemini API Error:", err);
          return `🤖 Gemini API 호출 중 오류가 발생했습니다.
          
⚠️ **원인 예시:**
- 입력된 **Gemini API Key**가 만료되었거나 올바르지 않습니다.
- 네트워크 연결 상태를 확인해 주세요.`;
        }
      } else {
        let endpoint = "https://api.openai.com/v1/chat/completions";
        if (provider === "custom") {
          let baseUrl = this.apiUrl ? this.apiUrl.trim() : "";
          if (!baseUrl) {
            return "❌ 커스텀 API Base URL이 설정되어 있지 않습니다. 설정에서 확인해 주세요.";
          }
          if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.slice(0, -1);
          }
          endpoint = `${baseUrl}/chat/completions`;
        }

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
              ]
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status} - ${errText}`);
          }

          const json = await response.json();
          const rawText = json.choices?.[0]?.message?.content;
          if (!rawText) {
            return `🤖 AI (${provider.toUpperCase()}) 비서가 답변을 구성하지 못했습니다.`;
          }

          return rawText.trim();
        } catch (err) {
          console.error("OpenAI Compatible API Error:", err);
          return `🤖 AI (${provider.toUpperCase()}) 호출 중 오류가 발생했습니다.
          
⚠️ **상세 에러:** ${err.message}
- API Key와 설정(Base URL, 모델명 등)을 다시 확인해 주세요.`;
        }
      }
    },

    handleConcCalcQuery: async function (query) {
      let concValue = null;
      let concType = "M";
      let volValue = 1.0;
      let volUnit = "1 L";

      const concMatch = query.match(/(\d+(?:\.\d+)?)\s*(M|몰|%)/i);
      if (concMatch) {
        concValue = parseFloat(concMatch[1]);
        if (concMatch[2] === "%") concType = "%";
      }

      const volMatch = query.match(/(\d+(?:\.\d+)?)\s*(mL|L|밀리리터|리터)/i);
      if (volMatch) {
        const val = parseFloat(volMatch[1]);
        const unit = volMatch[2].toLowerCase();
        if (unit === "ml" || unit === "밀리리터") {
          volValue = val / 1000;
          volUnit = `${val} mL`;
        } else {
          volValue = val;
          volUnit = `${val} L`;
        }
      }

      let matchedSubstance = await this.findSubstanceByName(query);
      if (matchedSubstance) {
        this.selectedSubstance = matchedSubstance;
      } else {
        matchedSubstance = this.selectedSubstance;
      }

      if (!matchedSubstance) {
        return `🧪 **몰농도 용액 제조 계산기 가이드**
- **입력 용량**: ${volUnit}
- **목표 농도**: ${concValue ? concValue + concType : "미지정 (예: 0.1M)"}

약품명(예: 수산화나트륨, NaOH, 염산 등)을 함께 입력해 주시면 시약장에 등록된 시약병을 자동 검색하여 최적의 희석/조제 레시피를 계산해 드립니다!
*예시: "염산 1M 10mL", "0.1M 수산화나트륨 500mL"*`;
      }

      const chemName = matchedSubstance.chem_name_kor || matchedSubstance.substance_name || "지정 시약";
      const rawFormula = matchedSubstance.molecular_formula_mod || matchedSubstance.molecular_formula || "";
      const formula = rawFormula ? `(${rawFormula})` : "";
      const mw = parseFloat(matchedSubstance.molecular_mass);

      if (!mw || isNaN(mw)) {
        return `🧪 **[${chemName} ${formula}] 용액 제조 안내**
데이터베이스에 분자량(MW) 정보가 등록되어 있지 않아 계산이 어렵습니다. MSDS 또는 시약 라벨의 분자량을 확인해 주세요.`;
      }

      if (!concValue) concValue = 0.1;
      const targetVolmL = volValue * 1000;
      const pureMassNeeded = concValue * volValue * mw; // 100% 순수 기준 (g)

      // 📦 1단계: DB Inventory (시약장)에서 해당 시약 관련 시약병 전체 검색 (4단계 안전 폴백 쿼리)
      let invList = [];
      const supabase = getSupabase();
      if (matchedSubstance && supabase) {
        try {
          let allInv = null;

          // 1차 시도: Cabinet 및 lab_rooms 전체 관계 조인 (Inventory 위치 상세 필드 포함)
          const res1 = await supabase
            .from("Inventory")
            .select(`
              id, current_amount, unit, concentration_value, concentration_unit, status, edited_name_kor, substance_id,
              door_vertical, door_horizontal, internal_shelf_level, storage_column,
              Substance ( id, chem_name_kor, chem_name_kor_mod, substance_name, molecular_formula, cas_rn ),
              Cabinet ( cabinet_name, door_horizontal_count, area_id:lab_rooms!fk_cabinet_lab_rooms ( room_name ) )
            `);

          if (!res1.error && res1.data && res1.data.length > 0) {
            allInv = res1.data;
          } else {
            // 2차 시도: Cabinet 및 lab_rooms 기본 조인
            const res2 = await supabase
              .from("Inventory")
              .select(`
                id, current_amount, unit, concentration_value, concentration_unit, status, edited_name_kor, substance_id,
                door_vertical, door_horizontal, internal_shelf_level, storage_column,
                Substance ( id, chem_name_kor, chem_name_kor_mod, substance_name, molecular_formula, cas_rn ),
                Cabinet ( cabinet_name, area_id:lab_rooms ( room_name ) )
              `);

            if (!res2.error && res2.data && res2.data.length > 0) {
              allInv = res2.data;
            } else {
              // 3차 시도: Substance 조인만 수행
              const res3 = await supabase
                .from("Inventory")
                .select(`
                  id, current_amount, unit, concentration_value, concentration_unit, status, edited_name_kor, substance_id,
                  door_vertical, door_horizontal, internal_shelf_level, storage_column,
                  Substance ( id, chem_name_kor, chem_name_kor_mod, substance_name, molecular_formula, cas_rn )
                `);

              if (!res3.error && res3.data && res3.data.length > 0) {
                allInv = res3.data;
              } else {
                // 4차 시도: Inventory 단일 테이블 최후의 최소 조인
                const res4 = await supabase
                  .from("Inventory")
                  .select("id, current_amount, unit, concentration_value, concentration_unit, status, edited_name_kor, substance_id, door_vertical, door_horizontal, internal_shelf_level, storage_column");
                allInv = res4.data || [];
              }
            }
          }

          if (allInv && allInv.length > 0) {
            const targetCas = (matchedSubstance.cas_rn || "").trim();
            const targetSubId = matchedSubstance.id;
            const targetKor = (chemName || "").replace(/\s+/g, "");
            const targetEng = (matchedSubstance.substance_name || "").toLowerCase();
            const isTargetHcl = targetKor.includes("염산") || targetKor.includes("염화수소") || targetEng.includes("hydrochloric") || query.includes("염산");
            const isTargetNaoh = targetKor.includes("수산화나트륨") || targetKor.includes("가성소다") || query.includes("수산화나트륨");
            const isTargetH2so4 = targetKor.includes("황산") || query.includes("황산");
            const isTargetHno3 = targetKor.includes("질산") || query.includes("질산");
            const isTargetCh3cooh = targetKor.includes("아세트산") || query.includes("빙초산") || query.includes("아세트산");
            const isTargetH2o2 = targetKor.includes("과산화수소") || query.includes("과산화수소");

            invList = allInv.filter(inv => {
              // 🛑 0. 전량소진/소진/폐기 상태이거나 잔여 수량이 0 이하인 시약병은 목록에서 제외
              const invStatus = String(inv.status || "").replace(/\s+/g, "");
              if (invStatus === "전량소진" || invStatus.includes("소진") || invStatus.includes("폐기") || invStatus.includes("삭제")) {
                return false;
              }
              if (inv.current_amount !== null && inv.current_amount !== undefined && inv.current_amount !== "" && parseFloat(inv.current_amount) <= 0) {
                return false;
              }

              // 1. substance_id 및 CAS 번호 일치 대조
              if (targetSubId && (inv.substance_id === targetSubId || inv.Substance?.id === targetSubId)) return true;
              if (targetCas && inv.Substance?.cas_rn && inv.Substance.cas_rn.trim() === targetCas) return true;

              // 2. 시약 명칭 매칭
              const invName = (inv.edited_name_kor || inv.Substance?.chem_name_kor_mod || inv.Substance?.chem_name_kor || "").replace(/\s+/g, "");
              if (invName && targetKor && (invName.includes(targetKor) || targetKor.includes(invName))) return true;

              // 3. 특수 시약 이명 확장 매칭
              if (isTargetHcl && (invName.includes("염산") || invName.includes("염화수소") || invName.includes("HCl"))) return true;
              if (isTargetNaoh && (invName.includes("수산화나트륨") || invName.includes("가성소다") || invName.includes("NaOH"))) return true;
              if (isTargetH2so4 && (invName.includes("황산") || invName.includes("H2SO4"))) return true;
              if (isTargetHno3 && (invName.includes("질산") || invName.includes("HNO3"))) return true;
              if (isTargetCh3cooh && (invName.includes("아세트산") || invName.includes("빙초산") || invName.includes("CH3COOH"))) return true;
              if (isTargetH2o2 && (invName.includes("과산화수소") || invName.includes("H2O2"))) return true;

              return false;
            });

            // 🎯 순수 시약 우선 필터링: 원래 요청 시약("수산화나트륨", "NaOH", "염산" 등)의 직접 시약병이 재고에 존재할 경우,
            // "뷰렛 용액", "페일링 용액" 등 2차 혼합 용액 시약병은 목록에서 자동 제외
            if (invList && invList.length > 0) {
              const directMatches = invList.filter(inv => {
                const invName = (inv.edited_name_kor || inv.Substance?.chem_name_kor_mod || inv.Substance?.chem_name_kor || "").replace(/\s+/g, "");
                const isDirectKor = targetKor && (invName.includes(targetKor) || targetKor.includes(invName));
                const isDirectHcl = isTargetHcl && (invName.includes("염산") || invName.includes("염화수소") || invName.includes("HCl"));
                const isDirectNaoh = isTargetNaoh && (invName.includes("수산화나트륨") || invName.includes("가성소다") || invName.includes("NaOH"));
                const isDirectH2so4 = isTargetH2so4 && (invName.includes("황산") || invName.includes("H2SO4"));
                const isDirectHno3 = isTargetHno3 && (invName.includes("질산") || invName.includes("HNO3"));
                const isDirectCh3cooh = isTargetCh3cooh && (invName.includes("아세트산") || invName.includes("빙초산") || invName.includes("CH3COOH"));
                const isDirectH2o2 = isTargetH2o2 && (invName.includes("과산화수소") || invName.includes("H2O2"));

                const isMixture = invName.includes("뷰렛") || invName.includes("페일링") || invName.includes("펠링") || invName.includes("베네딕트") || invName.includes("네슬러") || invName.includes("루골");

                return (isDirectKor || isDirectHcl || isDirectNaoh || isDirectH2so4 || isDirectHno3 || isDirectCh3cooh || isDirectH2o2) && !isMixture;
              });

              if (directMatches.length > 0) {
                invList = directMatches;
              }
            }
          }
        } catch (invErr) {
          console.error("Inventory lookup error in chatbot conc calc:", invErr);
        }
      }

      // 📦 2단계: 각 보유 시약병별 가용성 평가 및 최적 시약병 선정 (우선순위 부여)
      const inventoryEvaluations = [];

      if (invList && invList.length > 0) {
        invList.forEach((inv, index) => {
          const roomName = inv.Cabinet?.area_id?.room_name || "";
          const cabName = inv.Cabinet?.cabinet_name || "시약장";
          let mainLocStr = roomName ? `${roomName} > ${cabName}` : cabName;

          const detailLocParts = [];
          if (inv.door_vertical) detailLocParts.push(`${inv.door_vertical}층문`);
          if (inv.internal_shelf_level) detailLocParts.push(`${inv.internal_shelf_level}단`);
          if (inv.storage_column) detailLocParts.push(`${inv.storage_column}열`);

          const locStr = detailLocParts.length > 0 ? `${mainLocStr} (${detailLocParts.join(" ")})` : mainLocStr;
          const bottleName = inv.edited_name_kor || chemName;
          const amtStr = `${inv.current_amount || '-'}${inv.unit || "g"}`;

          let rawConcVal = (inv.concentration_value != null && inv.concentration_value !== "") ? parseFloat(inv.concentration_value) : null;
          let concUnit = (inv.concentration_unit || "").toUpperCase();

          if (rawConcVal == null || isNaN(rawConcVal)) {
            const titleConcMatch = (bottleName || "").match(/(\d+(?:\.\d+)?)\s*(%|M|몰|N|노르말)/i);
            if (titleConcMatch) {
              rawConcVal = parseFloat(titleConcMatch[1]);
              const rawU = titleConcMatch[2].toUpperCase();
              concUnit = (rawU === "몰") ? "M" : ((rawU === "노르말") ? "N" : rawU);
            }
          }

          const concStr = (rawConcVal != null && !isNaN(rawConcVal)) ? `${rawConcVal}${concUnit}` : "농도/순도 미지정";

          let valence = 1;
          if (chemName.includes("황산") || chemName.includes("H2SO4") || chemName.includes("탄산") || chemName.includes("수산화칼슘")) {
            valence = 2;
          } else if (chemName.includes("인산")) {
            valence = 3;
          }

          let bottleMolarity = null;
          if (concUnit === "M" || concUnit === "몰") {
            bottleMolarity = rawConcVal;
          } else if (concUnit === "N" || concUnit === "노르말") {
            bottleMolarity = rawConcVal / valence;
          } else if (concUnit === "%") {
            const perc = (rawConcVal && rawConcVal > 0) ? rawConcVal : 100;
            let d = 1.05;
            if (chemName.includes("염산") || chemName.includes("염화수소")) d = 1.19;
            else if (chemName.includes("황산")) d = 1.84;
            else if (chemName.includes("질산")) d = 1.42;
            else if (chemName.includes("수산화나트륨") || chemName.includes("NaOH")) d = 1.11;
            else if (chemName.includes("아세트산") || chemName.includes("빙초산")) d = 1.05;
            else if (chemName.includes("과산화수소")) d = 1.11;

            bottleMolarity = (perc * 10 * d) / mw;
          }

          let priority = 99;
          let isFeasible = true;
          let methodTitle = "";
          let methodDetail = "";
          let reqVolmL = 0;
          let reqMassg = 0;
          let badgeColor = "#2b8a3e";
          let badgeText = "제조 가능";

          if (concType === "M") {
            const isExactConc = bottleMolarity != null && !isNaN(bottleMolarity) && Math.abs(bottleMolarity - concValue) < 0.01;
            
            // 시약병 수량 단위(mL/L vs g/kg) 및 농도 단위(%/M/N)에 따른 고체 vs 액체 수용액 구분
            const invUnitLower = (inv.unit || "").toLowerCase();
            const isLiquidBottle = invUnitLower === "ml" || invUnitLower === "l" || invUnitLower === "밀리리터" || invUnitLower === "리터" || concUnit === "%" || concUnit === "M" || concUnit === "N";
            const isSolidReagent = !isLiquidBottle;

            if (isExactConc) {
              // 1순위: 요구 농도와 완벽히 동일한 농도의 용액 (단, 필요 용량 이상 보유 시에만)
              const stockAmt = (inv.current_amount != null && inv.current_amount !== "") ? parseFloat(inv.current_amount) : 99999;
              if (stockAmt >= targetVolmL) {
                priority = 1;
                const matchTag = (concUnit === "N") ? `${rawConcVal}N = ${bottleMolarity.toFixed(1)}M` : `${rawConcVal}${concUnit}`;
                methodTitle = `동일 농도 보유 (${matchTag})`;
                methodDetail = `이 시약병(${rawConcVal}${concUnit})은 목표 농도(${concValue}M)와 일치하므로 희석/제조 없이 소분하여 즉시 사용합니다.`;
                badgeText = "즉시 사용";
                badgeColor = "#2b8a3e";
              } else {
                priority = 99;
                isFeasible = false;
                badgeColor = "#d9534f";
                badgeText = "재고 부족";
                methodTitle = `동일 농도이나 재고 부족 (${stockAmt}mL < 필요 ${targetVolmL}mL)`;
                methodDetail = `목표 농도(${concValue}M)와 동일하나 보유 잔여량(${stockAmt}mL)이 필요 용량(${targetVolmL}mL)보다 부족하여 고체 시료로 신규 제조합니다.`;
              }
            } else if (isSolidReagent) {
              // 2순위: 순수 고체 시료 칭량 용해 (동일 농도가 없거나 부족할 때 최우선 제조 방식)
              priority = 2;
              const perc = (rawConcVal && rawConcVal > 0 && concUnit === "%") ? rawConcVal : 100;
              reqMassg = pureMassNeeded / (perc / 100);
              methodTitle = `고체 시약 칭량 용해 (추천 조제 방식)`;
              methodDetail = `순도 ${perc}% 반영 시약 <b>${reqMassg.toFixed(3)} g</b>을 칭량하여 정제수 ${volUnit}에 용해`;
              badgeText = "칭량 가능";
              badgeColor = "#e67e22";
            } else if (isLiquidBottle && bottleMolarity != null && bottleMolarity > concValue) {
              // 3순위: 고농도 수용액 희석 조제 (고체 시료가 없을 때 수용액 희석 사용)
              priority = 3;
              reqVolmL = (concValue * targetVolmL) / bottleMolarity;
              const concDisplay = (concUnit === "%") ? `${rawConcVal}% (약 ${bottleMolarity.toFixed(2)}M)` : `${rawConcVal}${concUnit}`;
              methodTitle = `고농도 용액 희석 (${concDisplay} → ${concValue}M)`;
              methodDetail = `보유 원액 <b>${reqVolmL < 1 ? reqVolmL.toFixed(2) : reqVolmL.toFixed(1)} mL</b>를 취해 정제수 ${volUnit}로 희석`;
              badgeText = "희석 가능";
              badgeColor = "#0056b3";
            } else {
              priority = 99;
              isFeasible = false;
              badgeColor = "#d9534f";
              badgeText = "희석 불가";
              const currMDisplay = bottleMolarity != null ? `약 ${bottleMolarity.toFixed(2)}M` : `${rawConcVal}${concUnit}`;
              methodTitle = `농도 부족 (${currMDisplay} < ${concValue}M)`;
              methodDetail = `보유 용액 농도(${currMDisplay})가 목표 농도(${concValue}M)보다 낮아 희석 조제가 불가능합니다.`;
            }
          } else {
            reqMassg = (concValue * targetVolmL) / 100;
            priority = 2;
            methodTitle = `% 용액 칭량 제조`;
            methodDetail = `시약 <b>${reqMassg.toFixed(2)} g</b>을 칭량하여 정제수 ${(targetVolmL - reqMassg).toFixed(0)} mL에 용해`;
            badgeText = "칭량 가능";
            badgeColor = "#e67e22";
          }

          inventoryEvaluations.push({
            index: index + 1,
            id: inv.id,
            bottleName,
            locStr,
            amtStr,
            concStr,
            rawConcVal,
            concUnit,
            bottleMolarity,
            priority,
            isFeasible,
            badgeColor,
            badgeText,
            methodTitle,
            methodDetail,
            reqVolmL,
            reqMassg
          });
        });
      }

      // 📦 3단계: 최적 추천 시약병(Top Bottle) 선정
      let topBottle = null;
      if (inventoryEvaluations.length > 0) {
        inventoryEvaluations.sort((a, b) => a.priority - b.priority);
        if (inventoryEvaluations[0].isFeasible) {
          topBottle = inventoryEvaluations[0];
        }
      }

      const flaskSizes = [50, 100, 200, 250, 500, 1000];
      let defaultFlaskVolmL = flaskSizes.find(s => s >= targetVolmL) || 50;

      const cardId = `conc-calc-card-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      if (!this.cardStates) this.cardStates = {};
      this.cardStates[cardId] = {
        chemName,
        formula,
        mw,
        concValue,
        concType,
        targetVolmL,
        requestedVolUnit: volUnit,
        pureMassNeeded,
        inventoryEvaluations,
        selectedBottleId: topBottle ? topBottle.id : null,
        selectedFlaskVolmL: defaultFlaskVolmL
      };

      const cardBodyHtml = this.renderConcCalcCardBody(cardId);
      return `<div id="${cardId}" style="background: #ffffff; border: 1px solid #d0e7ff; border-radius: 10px; padding: 12px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">${cardBodyHtml}</div>`;
    },

    // 🔄 시약병 동적 선택 이벤트 핸들러
    switchConcBottle: function (cardId, bottleId) {
      if (!this.cardStates) this.cardStates = {};
      const state = this.cardStates[cardId];
      if (!state) return;

      state.selectedBottleId = bottleId;
      const container = document.getElementById(cardId);
      if (container) {
        container.innerHTML = this.renderConcCalcCardBody(cardId);
      }
    },

    // 🔄 부피플라스크 규격 동적 선택 이벤트 핸들러
    switchConcFlask: function (cardId, flaskSize) {
      if (!this.cardStates) this.cardStates = {};
      const state = this.cardStates[cardId];
      if (!state) return;

      state.selectedFlaskVolmL = flaskSize;
      const container = document.getElementById(cardId);
      if (container) {
        container.innerHTML = this.renderConcCalcCardBody(cardId);
      }
    },

    // 📋 농도 계산 카드 동적 HTML 렌더링 엔진
    renderConcCalcCardBody: function (cardId) {
      const state = this.cardStates ? this.cardStates[cardId] : null;
      if (!state) return "";

      const { chemName, formula, mw, concValue, concType, targetVolmL, requestedVolUnit, pureMassNeeded, inventoryEvaluations, selectedFlaskVolmL } = state;

      // 🧪 1단계: 선택된 부피플라스크 규격(prepVolmL)에 따른 각 시약병 잔여 재고 가용성 실시간 동적 재평가
      const prepVolmL = selectedFlaskVolmL || targetVolmL;
      const prepVolL = prepVolmL / 1000;
      const prepVolUnitStr = prepVolmL >= 1000 ? `${(prepVolmL / 1000).toFixed(0)} L` : `${prepVolmL} mL`;

      inventoryEvaluations.forEach(item => {
        // 잔여 수량 숫자 파싱
        let stockAmt = parseFloat((item.amtStr || "").replace(/[^0-9.]/g, ""));
        if (isNaN(stockAmt) || stockAmt <= 0) stockAmt = 99999; // 미기록 시 기본 통과

        let reqVol = 0;
        let reqMass = 0;

        if (concType === "M") {
          if (item.priority === 1) { // 동일 농도 소분
            reqVol = prepVolmL;
          } else if (item.bottleMolarity && item.bottleMolarity > concValue) { // 고농도 희석
            reqVol = (concValue * prepVolmL) / item.bottleMolarity;
          } else { // 고체 칭량
            const perc = (item.rawConcVal && item.rawConcVal > 0 && item.concUnit === "%") ? item.rawConcVal : 100;
            reqMass = (concValue * prepVolL * mw) / (perc / 100);
          }
        } else {
          reqMass = (concValue * prepVolmL) / 100;
        }

        const isStockOk = reqVol > 0 ? (reqVol <= stockAmt) : (reqMass <= stockAmt);

        if (!isStockOk) {
          item.dynamicFeasible = false;
          item.dynamicBadgeText = "재고 부족";
          item.dynamicBadgeColor = "#d9534f";
          const neededStr = reqVol > 0 ? `${reqVol < 1 ? reqVol.toFixed(2) : reqVol.toFixed(1)}mL` : `${reqMass.toFixed(2)}g`;
          item.dynamicReason = `(필요 ${neededStr} > 보유 ${item.amtStr})`;
        } else {
          item.dynamicFeasible = item.isFeasible;
          item.dynamicBadgeText = item.badgeText;
          item.dynamicBadgeColor = item.badgeColor;
          item.dynamicReason = "";
        }
      });

      // 🧪 2단계: 가용성(dynamicFeasible)을 만족하는 최적 시약병 자동 결정
      let topBottle = inventoryEvaluations.find(b => b.id === state.selectedBottleId && b.dynamicFeasible);

      // 만약 선택된 시약병이 용량 초과로 불가능해진 경우, 가용한 다른 시약병으로 자동 전환
      if (!topBottle) {
        topBottle = inventoryEvaluations.find(b => b.dynamicFeasible);
        if (topBottle) {
          state.selectedBottleId = topBottle.id;
        }
      }

      const isExactMatch = topBottle ? topBottle.priority === 1 : false;

      // 📦 3단계: 시약장 전체 보유 재고 현황 HTML (전체 시약병 박스 클릭 버튼화)
      let evalItemsHtml = "";
      if (inventoryEvaluations.length > 0) {
        inventoryEvaluations.forEach(item => {
          const isSelected = topBottle && item.id === topBottle.id;
          const isSelectable = item.dynamicFeasible;

          let badgeHtml = "";
          if (isSelected) {
            badgeHtml = `<span style="background: #0056b3; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10.5px; font-weight: bold;">🎯 선택됨</span>`;
          } else {
            badgeHtml = `<span style="background: ${item.dynamicBadgeColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10.5px; font-weight: bold;">${item.dynamicBadgeText}</span>`;
          }

          const clickHandler = isSelectable ? `onclick="App.Chatbot.switchConcBottle('${cardId}', ${item.id})"` : '';
          const boxBg = isSelected ? '#f0f9ff' : (isSelectable ? 'white' : '#fff5f5');
          const boxBorder = isSelected ? '2px solid #1971c2' : (isSelectable ? '1px solid #ced4da' : '1px solid #ffc9c9');
          const cursorStyle = isSelectable ? 'cursor: pointer;' : 'cursor: not-allowed;';

          evalItemsHtml += `
            <div ${clickHandler} style="background: ${boxBg}; border: ${boxBorder}; border-radius: 8px; padding: 8px 10px; margin-top: 5px; ${cursorStyle} transition: all 0.15s ease-in-out;" onmouseover="if(${isSelectable && !isSelected}){this.style.background='#e7f5ff';this.style.borderColor='#74c0fc';}" onmouseout="if(${isSelectable && !isSelected}){this.style.background='white';this.style.borderColor='#ced4da';}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: bold; color: ${isSelected ? '#0056b3' : (isSelectable ? '#333' : '#c92a2a')}; font-size: 11.5px;">
                  ${isSelected ? '⭐ ' : ''}시약병 #${item.id}: ${item.bottleName}
                </span>
                ${badgeHtml}
              </div>
              <div style="color: #555; font-size: 10.5px; margin-top: 4px;">
                📍 <b>위치:</b> ${item.locStr} (잔여: <b>${item.amtStr}</b>, 농도: <b>${item.concStr}</b>)
                ${item.dynamicReason ? `<span style="color: #c92a2a; margin-left: 4px; font-weight: bold;">${item.dynamicReason}</span>` : ''}
              </div>
            </div>
          `.replace(/\n\s*/g, "");
        });
      }

      const evalBoxHtml = inventoryEvaluations.length > 0 ? `
        <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px;">
          <div style="font-weight: bold; color: #495057; font-size: 11.5px; margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined" style="font-size: 15px;">inventory_2</span>
            <span>📦 시약장 전체 보유 재고 현황 (${inventoryEvaluations.length}개 병 검색됨)</span>
          </div>
          <div style="font-size: 10px; color: #0056b3; margin-bottom: 4px;">💡 시약병 박스를 클릭하시면 해당 시약병 레시피로 실시간 전환됩니다.</div>
          ${evalItemsHtml}
        </div>
      `.replace(/\n\s*/g, "") : "";

      // 📋 2단계: 선택된 시약병 및 부피플라스크 기반 레시피 재계산 및 렌더링
      let recipeTitleHtml = "";
      let recipeBoxHtml = "";

      if (topBottle && topBottle.isFeasible) {
        const isExactMatch = topBottle ? topBottle.priority === 1 : false;
        const isSolidWeighing = topBottle ? topBottle.priority === 2 : false;
        const isLiquidDilution = topBottle ? topBottle.priority === 3 : false;

        let calculatedReqVolmL = 0;
        let calculatedReqMassg = 0;

        if (concType === "M") {
          if (isExactMatch) {
            calculatedReqVolmL = prepVolmL;
          } else if (isLiquidDilution && topBottle.bottleMolarity) {
            calculatedReqVolmL = (concValue * prepVolmL) / topBottle.bottleMolarity;
          } else {
            const perc = (topBottle.rawConcVal && topBottle.rawConcVal > 0 && topBottle.concUnit === "%") ? topBottle.rawConcVal : 100;
            calculatedReqMassg = (concValue * prepVolL * mw) / (perc / 100);
          }
        } else {
          calculatedReqMassg = (concValue * prepVolmL) / 100;
        }

        const volDisplayStr = calculatedReqVolmL < 1 ? calculatedReqVolmL.toFixed(2) : calculatedReqVolmL.toFixed(1);
        const massDisplayStr = calculatedReqMassg.toFixed(3);
        const initialWatermL = Math.max(3, Math.round(prepVolmL * 0.5));

        const isAcidOrBase = (chemName.includes("염산") || chemName.includes("염화수소") || chemName.includes("황산") || chemName.includes("질산") || chemName.includes("수산화나트륨") || chemName.includes("아세트산"));

        let prepItems = "";
        let stepsHtml = "";

        let finalStepNote = "";
        let finalStepText = "";

        if (prepVolmL < targetVolmL) {
          finalStepText = `제조 완료된 <b>${prepVolUnitStr} 용액 전체</b>를 메스시린더 또는 피펫으로 취하여 <b>실험 비커(또는 보관 용기)</b>에 담아 사용합니다.`;
          finalStepNote = `<span style="color: #c92a2a; font-size: 10.5px; font-weight: bold;">(⚠️ 총 목표 부피 ${requestedVolUnit} 중 ${prepVolUnitStr}가 조제되었으며, 남은 용액은 0 mL입니다. 더 필요한 경우 동일 조제를 추가 진행하세요.)</span>`;
        } else if (prepVolmL === targetVolmL) {
          finalStepText = `제조 완료된 <b>${prepVolUnitStr} 용액 전체</b>를 메스시린더 또는 피펫으로 취하여 <b>실험 비커(또는 보관 용기)</b>에 담아 사용합니다.`;
          finalStepNote = `<span style="color: #666; font-size: 10.5px;">(※ 필요 용량 ${requestedVolUnit} 전량이 취출되어 남은 용액은 0 mL입니다.)</span>`;
        } else {
          const remVolmL = prepVolmL - targetVolmL;
          const remVolStr = remVolmL >= 1000 ? `${(remVolmL / 1000).toFixed(1)} L` : `${remVolmL} mL`;
          finalStepText = `제조 완료된 <b>${prepVolUnitStr} 용액</b> 중 실험에 필요한 목표 부피 <b style="color: #0056b3;">${requestedVolUnit}</b>를 메스시린더 또는 피펫으로 정확히 취하여 <b>실험 비커(또는 보관 용기)</b>에 담아 사용합니다.`;
          finalStepNote = `<span style="color: #666; font-size: 10.5px;">(※ 사용 후 남은 용액 <b>${remVolStr}</b>는 라벨 부착 후 준비실에 보관하거나 과학실 폐액 처리 규정에 따라 처리합니다.)</span>`;
        }

        const finalStepHtml = `<li>${finalStepText}<br>${finalStepNote}</li>`;

        if (isExactMatch) {
          prepItems = `소분용기 (또는 메스시린더/실험비커), 피펫 (또는 피펫 펌프), 보호장갑`;
          stepsHtml = `
            <ol style="margin: 4px 0 0 16px; padding: 0; line-height: 1.65; color: #222;">
              <li>시약장 위치 <b>[${topBottle.locStr}]</b>에서 목표 농도와 일치하는 보유 시약병 <b>[${topBottle.bottleName}]</b>을 꺼냅니다.</li>
              <li>피펫 또는 메스시린더를 사용하여 별도의 증류수 희석이나 저울 칭량 과정 없이 필요한 목표 부피 <b>${requestedVolUnit}</b>를 실험 비커(또는 소분용기)에 깔끔히 담습니다.</li>
              <li>추가 물 희석이나 제조 절차 없이 실험에 즉시 사용합니다.</li>
            </ol>
          `;
        } else if (isLiquidDilution) {
          prepItems = `피펫, 피펫 펌프, <b>${prepVolUnitStr} 부피플라스크</b>, 메스시린더/실험비커, 증류수(정제수), 보안경, 보호장갑`;
          stepsHtml = `
            <ol style="margin: 4px 0 0 16px; padding: 0; line-height: 1.65; color: #222;">
              <li><b>${prepVolUnitStr} 부피플라스크</b>에 증류수를 미리 약 <b>${initialWatermL} mL</b> 정도 채웁니다.<br>
                  ${isAcidOrBase ? '<span style="color: #c92a2a; font-weight: bold;">(⚠️ 중요: 산/염기를 다룰 때는 항상 물에 원액을 천천히 가해야 안전합니다!)</span>' : ''}
              </li>
              <li>피펫과 피펫 펌프를 사용하여 보유 시약병 <b>[${topBottle.bottleName}]</b>에서 <b>원액 ${volDisplayStr} mL</b>를 정확히 취합니다.</li>
              <li>플라스크 벽면을 따라 원액 <b>${volDisplayStr} mL</b>를 천천히 흘려 넣습니다.</li>
              <li>부피플라스크의 <b>표시선(${prepVolUnitStr})</b>까지 나머지 증류수를 조심스럽게 채웁니다.</li>
              <li>마개를 닫고 위아래로 2~3회 뒤집으며 잘 섞은 후 시약병에 라벨 <b>[${chemName}, ${concValue}${concType}, 제조일자, 제조자]</b>을 부착합니다.</li>
              ${finalStepHtml}
            </ol>
          `;
        } else {
          prepItems = `전자저울, 유량지/비커, 약숟가락, <b>${prepVolUnitStr} 부피플라스크</b>, 메스시린더/실험비커, 증류수(정제수), 보안경, 보호장갑`;
          stepsHtml = `
            <ol style="margin: 4px 0 0 16px; padding: 0; line-height: 1.65; color: #222;">
              <li>전자저울에 유량지 또는 비커를 올리고 <b>영점(TARE/ZERO)</b>을 맞춥니다.</li>
              <li>보유 시약 <b>[${topBottle.bottleName}]</b>에서 시약 <b>${massDisplayStr} g</b>을 정확하게 칭량합니다.</li>
              <li><b>${prepVolUnitStr} 부피플라스크</b>에 증류수 약 <b>${initialWatermL} mL</b>를 채운 후 칭량한 시약을 넣어 완전히 용해시킵니다.</li>
              <li>최종 <b>표선(${prepVolUnitStr})</b>까지 증류수를 채우고 흔들어 잘 섞어줍니다.</li>
              <li>시약병에 라벨 <b>[${chemName}, ${concValue}${concType}, 제조일자, 제조자]</b>을 부착합니다.</li>
              ${finalStepHtml}
            </ol>
          `;
        }

        recipeTitleHtml = `🎯 <b>선택된 시약병:</b> <span style="color: #0056b3; font-weight: bold;">${topBottle.bottleName}</span> (위치: ${topBottle.locStr})`;

        const reqDisplayStr = isExactMatch
          ? `${topBottle.bottleName} ${prepVolUnitStr} (희석 없이 즉시 소분 사용)`
          : (isLiquidDilution ? `${topBottle.bottleName} ${volDisplayStr} mL` : `${topBottle.bottleName} ${massDisplayStr} g`);

        // 🧪 부피플라스크 규격 선택 칩 (50, 100, 200, 250, 500, 1000 mL)
        const flaskOptions = [50, 100, 200, 250, 500, 1000];
        let flaskChipsHtml = "";
        if (!isExactMatch) {
          flaskChipsHtml = `
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #b6e4ff;">
              <div style="font-weight: bold; color: #0056b3; font-size: 11px; margin-bottom: 4px;">
                🧪 보유 부피플라스크 규격 선택 (현재: <b>${prepVolUnitStr} 플라스크 기준</b>):
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                ${flaskOptions.map(sz => {
                  const active = (selectedFlaskVolmL === sz);
                  const szLabel = sz >= 1000 ? "1000mL (1L)" : `${sz}mL`;
                  return `
                    <button onclick="App.Chatbot.switchConcFlask('${cardId}', ${sz})" style="background: ${active ? '#0056b3' : '#ffffff'}; color: ${active ? '#ffffff' : '#0056b3'}; border: 1px solid #0056b3; padding: 2px 7px; border-radius: 12px; font-size: 10.5px; font-weight: bold; cursor: pointer; transition: all 0.15s;" onmouseover="if(!${active})this.style.background='#e7f5ff'" onmouseout="if(!${active})this.style.background='#ffffff'">
                      ${active ? '✓ ' : ''}${szLabel}
                    </button>
                  `;
                }).join("")}
              </div>
              <div style="font-size: 10px; color: #666; margin-top: 4px;">
                💡 50mL 이하 규격 부피플라스크가 과학실에 없는 경우, 보유 중인 플라스크 용량 버튼을 누르시면 해당 용량 맞춤 레시피로 실시간 재계산됩니다.
              </div>
            </div>
          `.replace(/\n\s*/g, "");
        }

        let guidanceChoiceBoxHtml = "";
        if (prepVolmL < targetVolmL) {
          const repeatCount = Math.ceil(targetVolmL / prepVolmL);
          const totalReqVolNum = (calculatedReqVolmL * repeatCount);
          const totalReqMassNum = (calculatedReqMassg * repeatCount);
          const totalReqVolStr = totalReqVolNum < 1 ? totalReqVolNum.toFixed(2) : totalReqVolNum.toFixed(1);
          const totalReqMassStr = totalReqMassNum.toFixed(3);
          const totalAmtStr = isLiquidDilution ? `원액 약 <b>${totalReqVolStr} mL</b>` : `시약 약 <b>${totalReqMassStr} g</b>`;
          const accumulatedVolStr = (prepVolmL * repeatCount >= 1000) ? `${(prepVolmL * repeatCount / 1000).toFixed(1)} L` : `${prepVolmL * repeatCount} mL`;

          guidanceChoiceBoxHtml = `
            <div style="margin-top: 8px; padding: 10px; background: #fff9db; border: 1px solid #fab005; border-radius: 8px; font-size: 11px; line-height: 1.6; color: #212529;">
              <div style="font-weight: bold; color: #f59f00; font-size: 11.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 16px;">help</span>
                <span>💡 부피플라스크 규격(${prepVolUnitStr}) 선택에 따른 조제 맞춤 안내 (목표 ${requestedVolUnit})</span>
              </div>
              <div style="color: #495057;">원래 요청하신 부피(<b>${requestedVolUnit}</b>)보다 작은 <b>${prepVolUnitStr} 부피플라스크</b>를 선택하셨습니다. 조제 목적에 맞춰 아래 2가지 선택지 중 하나를 선택하세요:</div>
              
              <div style="margin-top: 6px; padding: 6px 8px; background: #ffffff; border-radius: 6px; border: 1px solid #ffe066;">
                🔹 <b>선택지 A [총 목표량 ${requestedVolUnit} 제조가 반드시 필요한 경우]</b>:<br>
                위 1회(<b>${prepVolUnitStr}</b>) 레시피대로 <b style="color: #d9480f;">총 ${repeatCount}회 반복 조제</b>(${prepVolUnitStr} × ${repeatCount}회 = ${accumulatedVolStr})하여 1 L 비커 또는 보관 용기에 모아 사용하세요.<br>
                <span style="color: #495057; font-size: 10.5px;">(※ ${repeatCount}회 전체 조제 시 총 필요 원료: ${totalAmtStr})</span>
              </div>
              
              <div style="margin-top: 5px; padding: 6px 8px; background: #ffffff; border-radius: 6px; border: 1px solid #ffe066;">
                🔹 <b>선택지 B [${prepVolUnitStr} 분량만 새로 만들어 사용할 경우]</b>:<br>
                위 <b>${prepVolUnitStr} 기준 1회 레시피</b>대로만 조제하여 <b>${prepVolUnitStr}</b> 용액을 전량 사용하세요.
              </div>
            </div>
          `.replace(/\n\s*/g, "");
        }

        recipeBoxHtml = `
          <div style="background: #eef9ff; border: 1px solid #b6e4ff; border-radius: 8px; padding: 10px; margin-top: 8px;">
            <div style="font-weight: bold; color: #004085; font-size: 12.5px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size: 16px; color: #0056b3;">receipt_long</span>
              <span>📋 맞춤 제조 레시피 (${topBottle.methodTitle} - ${prepVolUnitStr} 기준)</span>
            </div>
            <div style="font-size: 11.5px; color: #333; line-height: 1.5; background: white; padding: 8px; border-radius: 6px; border: 1px solid #d0e7ff;">
              <div>• <b>준비물:</b> ${prepItems}</div>
              <div>• <b>필요 시약/원액 양 (1회 조제 기준):</b> <b style="color: #d9480f; font-size: 12.5px;">${reqDisplayStr}</b></div>
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cce5ff;">
                <div style="font-weight: bold; color: #0056b3; margin-bottom: 2px;">🧪 상세 조제 순서:</div>
                ${stepsHtml}
              </div>
              ${flaskChipsHtml}
              ${guidanceChoiceBoxHtml}
            </div>
          </div>
        `;
      } else {
        recipeTitleHtml = `⚠️ <b>사용 가능한 보유 재고가 없습니다.</b>`;
        recipeBoxHtml = `
          <div style="background: #fff5f5; border: 1px solid #ffc9c9; border-radius: 8px; padding: 10px; margin-top: 8px; color: #c92a2a; font-size: 11.5px;">
            ⚠️ 현재 시약장에 사용 가능한 <b>${chemName}</b> 재고가 등록되어 있지 않거나 희석 가능한 시약병이 없습니다.
          </div>
        `;
      }

      return `
        <div style="font-weight: bold; color: #0d47a1; font-size: 13.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; border-bottom: 1px dashed #b6e4ff; padding-bottom: 6px;">
          <span class="material-symbols-outlined" style="font-size: 18px; color: #0056b3;">science</span>
          <span>${chemName} ${formula} ${concValue}${concType} ${requestedVolUnit} 맞춤 조제 계산</span>
        </div>
        ${evalBoxHtml}
        <div style="margin-top: 10px; font-size: 11.5px; color: #495057; line-height: 1.4;">
          ${recipeTitleHtml}
        </div>
        ${recipeBoxHtml}
        <div style="margin-top: 10px; font-size: 11px; color: #c92a2a; background: #fff5f5; padding: 6px 8px; border-radius: 6px; border: 1px solid #ffc9c9;">
          ⚠️ <b>안전 수칙:</b> 강산/강염기 조제 시 보호장갑과 보안경을 착용하고, 산은 항상 물에 원액을 천천히 가해야 합니다.
        </div>
      `.replace(/\n\s*/g, "");
    },

    handleMaintenanceQuery: async function (query) {
      const q = query.toLowerCase();

      if (q.includes("현미경")) {
        return `
          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 10px; font-size: 12px;">
            <div style="font-weight: bold; color: #2b8a3e; font-size: 13px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">biotech</span>
              <span>생물/실체 현미경 점검 & 세척 매뉴얼</span>
            </div>
            <ul style="margin: 0; padding-left: 16px; line-height: 1.6; color: #333;">
              <li><b>렌즈 세척:</b> 대물/접안렌즈는 <b>70% 이소프로필 알코올</b> 또는 전용 렌즈클리너를 렌즈 페이퍼에 살짝 묻혀 원을 그리듯 안에서 밖으로 부드럽게 닦습니다. (일반 휴지/직물 사용 금지)</li>
              <li><b>점검 주기:</b> 사용 후 매회 먼지 제거, <b>6개월 주기</b> 초점 조절 라챗 및 재물대 이동 상태 점검.</li>
              <li><b>보관 수칙:</b> 사용 후 배율이 가장 낮은 <b>4배(가장 짧은) 대물렌즈</b>를 중앙에 맞추고 재물대를 최대로 내린 뒤 먼지 방지 커버를 씌워 보관합니다.</li>
            </ul>
          </div>
        `.replace(/\n\s*/g, "");
      }

      if (q.includes("흄후드") || q.includes("후드")) {
        return `
          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 10px; font-size: 12px;">
            <div style="font-weight: bold; color: #d9480f; font-size: 13px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">air</span>
              <span>흄후드(Fume Hood) 안전 점검 매뉴얼</span>
            </div>
            <ul style="margin: 0; padding-left: 16px; line-height: 1.6; color: #333;">
              <li><b>제어 풍속 기준:</b> 개구면 제어풍속이 <b>0.4 m/s 이상</b> 유지되는지 풍속계로 정기 측정합니다.</li>
              <li><b>필터 교체 주기:</b> 활성탄/HEPA 필터는 사용 빈도에 따라 <b>6개월~1년 주기</b>로 정기 교체합니다.</li>
              <li><b>작업 수칙:</b> 섀시(글래스 창)는 <b>15~20cm 이하</b>로 유지하고, 유해물질 작업은 후드 안쪽 15cm 깊숙이에서 진행합니다.</li>
            </ul>
          </div>
        `.replace(/\n\s*/g, "");
      }

      if (q.includes("저울") || q.includes("전자저울")) {
        return `
          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 10px; font-size: 12px;">
            <div style="font-weight: bold; color: #15aabf; font-size: 13px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">scale</span>
              <span>정밀 전자저울 점검 & 영점 교정 매뉴얼</span>
            </div>
            <ul style="margin: 0; padding-left: 16px; line-height: 1.6; color: #333;">
              <li><b>수평계 확인:</b> 저울 바닥의 기포 수평계가 중앙에 오도록 발판을 조절합니다.</li>
              <li><b>영점 조절(Tare):</b> 시약지나 용기를 얹은 후 <b>[TARE/ZERO]</b> 버튼을 눌러 0.000g으로 맞춥니다.</li>
              <li><b>청소 수칙:</b> 칭량 팬에 시약 가루가 쏟아진 경우 즉시 전용 부드러운 솔로 쓸어내고 알코올 솜으로 닦습니다.</li>
              <li><b>보관:</b> 직사광선과 진동을 피하고 바람막이 유리를 항상 닫아둡니다.</li>
            </ul>
          </div>
        `.replace(/\n\s*/g, "");
      }

      return `
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 10px; font-size: 12px;">
          <div style="font-weight: bold; color: #5c7cfa; font-size: 13px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined" style="font-size: 16px;">build</span>
            <span>학교 과학실 대표 교구/설비 관리 수칙</span>
          </div>
          <div style="line-height: 1.6; color: #333;">
            • <b>현미경:</b> 70% 이소프로필 알코올 렌즈 세척, 4배 대물렌즈 원위치 보관<br>
            • <b>흄후드:</b> 제어풍속 0.4m/s 이상 확인, 6~12개월 필터 교체<br>
            • <b>전자저울:</b> 수평계 확인, 사용 전 TARE 영점 교정, 진동 방지<br>
            • <b>MBL 센서:</b> 센서 전극 수용액 세척 후 건조, 배터리 방전 방지 보관
          </div>
        </div>
      `.replace(/\n\s*/g, "");
    },

    handleCurriculumQuery: async function (query) {
      const supabase = getSupabase();

      let targetCat = null;
      if (query.includes("물리")) targetCat = "물리학";
      else if (query.includes("화학")) targetCat = "화학";
      else if (query.includes("생명") || query.includes("생물")) targetCat = "생명과학";
      else if (query.includes("지구")) targetCat = "지구과학";
      else if (query.includes("융합")) targetCat = "융합과학";

      const { data: toolsList, error } = await supabase
        .from("tools")
        .select("id, tools_name, kit_class, location, quantity")
        .limit(100);

      if (error || !toolsList) {
        return "❌ 교구/키트 정보를 불러오지 못했습니다.";
      }

      let filteredTools = toolsList;
      if (targetCat) {
        filteredTools = toolsList.filter(t => t.kit_class && t.kit_class.includes(targetCat));
      }

      if (filteredTools.length === 0) {
        return `🔬 **${targetCat || "교육과정"} 관련 키트/교구 조회 결과**\n해당하는 등록 교구가 존재하지 않습니다.`;
      }

      let rowsHtml = "";
      filteredTools.slice(0, 8).forEach(t => {
        rowsHtml += `
          <tr style="border-bottom: 1px solid #eee; background: white;">
            <td style="padding: 6px 8px; font-weight: bold; color: #333;">${t.tools_name}</td>
            <td style="padding: 6px 8px; color: #0d47a1;">${t.kit_class || "-"}</td>
            <td style="padding: 6px 8px; text-align: center;">${t.quantity || 1}개</td>
          </tr>
        `.replace(/\n\s*/g, "");
      });

      return `
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 10px; font-size: 12px;">
          <div style="font-weight: bold; color: #0d47a1; font-size: 13px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined" style="font-size: 16px;">school</span>
            <span>${targetCat ? targetCat + ' 과목' : '교육과정 실험'} 관련 교구/키트 목록 (${filteredTools.length}건)</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 11px; border: 1px solid #dee2e6;">
            <thead>
              <tr style="background: #e3f2fd; color: #0d47a1; font-weight: bold;">
                <th style="padding: 6px 8px; text-align: left;">교구/키트 명</th>
                <th style="padding: 6px 8px; text-align: left;">과목 분류</th>
                <th style="padding: 6px 8px; text-align: center;">수량</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `.replace(/\n\s*/g, "");
    }
  };

  // 전역 노출
  globalThis.App = globalThis.App || {};
  globalThis.App.Chatbot = Chatbot;

  console.log("🤖 Chatbot 모듈 로드 완료 — App.Chatbot 등록됨");
})();
