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
            <button id="chatbot-close-btn" title="닫기">
              <span class="material-symbols-outlined">close</span>
            </button>
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

      // 구입요청/소모임박 키워드
      const lowStockKeywords = ["구입", "구매", "소모", "부족", "주문", "살 거", "구입요청"];
      const isLowStockQuery = tokens.some(t => lowStockKeywords.some(k => t.includes(k)));

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

      // 다른 시약 검색 요청 시 상태 초기화
      if (isResetQuery) {
        this.selectedSubstance = null;
        const inputEl = document.getElementById("chatbot-input");
        if (inputEl) {
          inputEl.placeholder = "무엇을 도와드릴까요?";
        }
        return `🔄 검색 상태가 초기화되었습니다. 궁금하신 약품, 교구, 설비의 이름을 입력해 주세요.`;
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

              reportHtml += `
                </div>
              </div>
              <div class="chatbot-chips-container" style="margin-top: 10px;">
                <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 시약 검색</button>
              </div>`;
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
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 시약 검색</button>
</div>`;
      }

      // 1. DB에서 가장 적합한 화학물질 매칭 찾기
      let foundSubstance = null;

      // 1단계: 원본 토큰 그대로 검색 (예: "질산은" 같이 마지막 글자가 조사와 혼동될 수 있는 고유 명칭 우선 대응)
      for (const token of tokens) {
        if (token.length < 2) continue; // 1글자는 스킵

        const { data } = await supabase
          .from("Substance")
          .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
          .or(`chem_name_kor.ilike.%${token}%,chem_name_kor_mod.ilike.%${token}%,substance_name.ilike.%${token}%,substance_name_mod.ilike.%${token}%`)
          .limit(1);

        if (data && data.length > 0) {
          foundSubstance = data[0];
          break;
        }
      }

      // 2단계: 1단계 실패 시 한국어 조사/접사(의, 은, 는, 이, 가, 을, 를 등)를 제거하여 검색 (예: "아세톤의" -> "아세톤" 검색)
      if (!foundSubstance) {
        for (const token of tokens) {
          if (token.length < 2) continue;

          const stripped = token.replace(/(의|은|는|이|가|을|를|과|와|도|으로|로|에|에서|이란|이란것|란)$/, "");
          if (stripped.length < 2 || stripped === token) continue; // 이미 검색했거나 2글자 미만인 경우 스킵

          const { data } = await supabase
            .from("Substance")
            .select("id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_formula, molecular_formula_mod, cas_rn, molecular_mass")
            .or(`chem_name_kor.ilike.%${stripped}%,chem_name_kor_mod.ilike.%${stripped}%,substance_name.ilike.%${stripped}%,substance_name_mod.ilike.%${stripped}%`)
            .limit(1);

          if (data && data.length > 0) {
            foundSubstance = data[0];
            break;
          }
        }
      }

      // 시약 매칭 성공 시 해당 시약을 현재 컨텍스트로 유지
      if (foundSubstance) {
        this.selectedSubstance = foundSubstance;
      }

      const substance = this.selectedSubstance;

      // --- 농도 변환 레시피 질의 처리 ---
      const concMatch = query.match(/([0-9.]+)\s*(M|mM|%|N)/i);
      const volMatch = query.match(/([0-9.]+)\s*(mL|L|l)/i);
      const makeKeywords = ["만들", "필요", "조제", "희석", "제조", "배합", "레시피"];
      const isMakeQuery = tokens.some(t => makeKeywords.some(k => t.includes(k))) || (concMatch && volMatch);

      if (substance && isMakeQuery && (concMatch || volMatch)) {
        const chemName = substance.chem_name_kor_mod || substance.chem_name_kor || substance.substance_name_mod || substance.substance_name;
        
        let targetVol = 500; // default 500mL
        if (volMatch) {
          const val = parseFloat(volMatch[1]);
          const unit = volMatch[2].toLowerCase();
          if (unit === 'l') {
            targetVol = val * 1000;
          } else {
            targetVol = val;
          }
        }
        
        let targetConc = 0.1; // default 0.1
        let targetUnit = "M";
        if (concMatch) {
          targetConc = parseFloat(concMatch[1]);
          targetUnit = concMatch[2].toUpperCase();
        }

        // 1. Fetch active inventory items for this substance
        const { data: invItems, error: invErr } = await supabase
          .from("Inventory")
          .select(`
            id, current_amount, initial_amount, unit, concentration_value, concentration_unit, state,
            Cabinet ( cabinet_name, area_id:lab_rooms!fk_cabinet_lab_rooms ( room_name ) ),
            Substance ( id, chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod, molecular_mass, Properties ( name, property ) )
          `)
          .eq("substance_id", substance.id)
          .gt("current_amount", 0);

        if (invErr) {
          console.error("Inventory fetch error for recipe:", invErr);
          return "❌ 재고 정보를 확인하는 도중 오류가 발생했습니다.";
        }

        if (!invItems || invItems.length === 0) {
          return `❌ 현재 과학실 내에 **${chemName}**의 재고가 한 병도 존재하지 않아 조제 레시피를 계산할 수 없습니다.`;
        }

        const extractDensity = (item) => {
          const props = item.Substance?.Properties || [];
          const densityProp = props.find(p => p.name && p.name.toLowerCase().includes("density"));
          if (!densityProp) return null;
          const m = densityProp.property.match(/([0-9.]+)\s*g\/cm3|([0-9.]+)\s*g\/mL|([0-9.]+)/i);
          return m ? parseFloat(m[1] || m[2] || m[3]) : null;
        };

        const chemDefaults = {
          "인산": {
            "mw": 98,
            "density": 1.685,
            "defaultConc": 85,
            "defaultUnit": "%"
          },
          "C.I. 염기성 보라색 010": {
            "mw": 479.01,
            "density": 1.3,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "황산": {
            "mw": 98.08,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "암모니아 용액": {
            "mw": 35.05,
            "density": 0.907,
            "defaultConc": 25,
            "defaultUnit": "%"
          },
          "암모니아수": {
            "mw": 35.05,
            "density": 0.907,
            "defaultConc": 25,
            "defaultUnit": "%"
          },
          "감초 추출물": {
            "mw": 0,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "C.I. pigment red 179": {
            "mw": 177.16,
            "density": 1.61,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "루미놀 용액": {
            "mw": 177.16,
            "density": 1.61,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "디클로로메탄": {
            "mw": 84.93,
            "density": 1.3255,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화수소": {
            "mw": 36.46,
            "density": 1.19,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염산": {
            "mw": 36.46,
            "density": 1.18,
            "defaultConc": 37,
            "defaultUnit": "%"
          },
          "D-리모넨(D-LIMONENE)": {
            "mw": 136.23,
            "density": 0.8402,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "D-리모넨": {
            "mw": 136.23,
            "density": 0.8402,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "P-아미노페놀": {
            "mw": 109.13,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "헤모글로빈": {
            "mw": 0,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "황산 마그네슘": {
            "mw": 122.38,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "메틸 알코올": {
            "mw": 32.04,
            "density": 0.81,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "칼륨 페로시안화물 트리수화물(POTASSIUM FERROCYANIDE TRIHYDRATE)": {
            "mw": 422.39,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "칼륨 페로시안화물 트리수화물": {
            "mw": 422.39,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "페로시안화 칼륨 3수화물": {
            "mw": 422.39,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "Magnesium": {
            "mw": 24.31,
            "density": 1.738,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "마그네슘": {
            "mw": 24.31,
            "density": 1.738,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "질산칼륨": {
            "mw": 102.11,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "질산 칼륨": {
            "mw": 102.11,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "과산화수소": {
            "mw": 34.01,
            "density": 1.11,
            "defaultConc": 30,
            "defaultUnit": "%"
          },
          "글리세롤": {
            "mw": 92.09,
            "density": 1.2613,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "말론 산": {
            "mw": 104.06,
            "density": 1.6,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "스트론튬 염화물, 헥사수화물(STRONTIUM CHLORIDE, HEXAHYDRATE)": {
            "mw": 266.61,
            "density": 1.95,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "스트론튬 염화물, 헥사수화물": {
            "mw": 266.61,
            "density": 1.95,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 스트론튬 6수화물": {
            "mw": 266.61,
            "density": 1.95,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "붕소산 사나트륨염(십수화물)": {
            "mw": 381.37,
            "density": 1.73,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "붕소산 사나트륨염": {
            "mw": 381.37,
            "density": 1.73,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "붕사": {
            "mw": 381.37,
            "density": 1.73,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "규산나트륨(SODIUM SILICATE)": {
            "mw": 122.06,
            "density": 1.4,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "규산나트륨": {
            "mw": 122.06,
            "density": 1.4,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "규산 나트륨": {
            "mw": 122.06,
            "density": 1.4,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화마그네슘": {
            "mw": 40.3,
            "density": 3.58,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 마그네슘, 헥사하이드레이트": {
            "mw": 203.3,
            "density": 1.56,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 마그네슘 6수화물": {
            "mw": 203.3,
            "density": 1.56,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "질산 은": {
            "mw": 170.88,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "요오드": {
            "mw": 253.81,
            "density": 4.9,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "아이오딘 용액": {
            "mw": 253.81,
            "density": 4.9,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "젖산 칼슘 5수화물": {
            "mw": 310.31,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "코발트 염화물, 헥사수화물(COBALT CHLORIDE, HEXAHYDRATE)": {
            "mw": 237.93,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "코발트 염화물, 헥사수화물": {
            "mw": 237.93,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 코발트 6수화물": {
            "mw": 237.93,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "수산화나트륨": {
            "mw": 40,
            "density": 2.13,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "수산화 나트륨": {
            "mw": 40,
            "density": 2.13,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "수산화 칼슘": {
            "mw": 74.09,
            "density": 2.24,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "질산 니켈, 헥사히드레이트(NICKEL NITRATE, HEXAHYDRATE)": {
            "mw": 292.81,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "질산 니켈, 헥사히드레이트": {
            "mw": 292.81,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "질산 니켈 6수화물": {
            "mw": 292.81,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "질산암모늄": {
            "mw": 80.04,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "질산 암모늄": {
            "mw": 80.04,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "구연산 나트륨(SODIUM CITRATE)": {
            "mw": 297.12,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "구연산 나트륨": {
            "mw": 297.12,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "구연산 나트륨 2수화물": {
            "mw": 297.12,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "에탄올": {
            "mw": 46.07,
            "density": 0.789,
            "defaultConc": 99,
            "defaultUnit": "%"
          },
          "질산 구리(II) 삼수화물": {
            "mw": 243.62,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "질산 구리 삼수화물": {
            "mw": 243.62,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "페놀 레드": {
            "mw": 354.38,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "요오드화 칼륨": {
            "mw": 166,
            "density": 3.13,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "아이오딘화 칼륨": {
            "mw": 166,
            "density": 3.13,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "시트르산 모노수화물(CITRIC ACID MONOHYDRATE)": {
            "mw": 210.14,
            "density": 1.5,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "시트르산 모노수화물": {
            "mw": 210.14,
            "density": 1.5,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 나트륨(SODIUM CHLORIDE)": {
            "mw": 58.44,
            "density": 2.165,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 나트륨": {
            "mw": 58.44,
            "density": 2.165,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "사프라닌 O": {
            "mw": 350.85,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "아이오딘화 나트륨(요오드화 나트륨)(SODIUM IODIDE)": {
            "mw": 149.89,
            "density": 3.67,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "아이오딘화 나트륨": {
            "mw": 149.89,
            "density": 3.67,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "황산암모늄": {
            "mw": 132.14,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 암모늄": {
            "mw": 132.14,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "무수초산": {
            "mw": 102.09,
            "density": 1.082,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "무수 아세트산": {
            "mw": 102.09,
            "density": 1.05,
            "defaultConc": 99.5,
            "defaultUnit": "%"
          },
          "이소프로필 알코올": {
            "mw": 60.1,
            "density": 0.78505,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "이산화 망간": {
            "mw": 86.94,
            "density": 5,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 리튬(LITHIUM CHLORIDE)": {
            "mw": 42.39,
            "density": 2.07,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 리튬": {
            "mw": 42.39,
            "density": 2.07,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "알루미늄 암모늄 황산염 도데카수화물": {
            "mw": 456.35,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "백반": {
            "mw": 456.35,
            "density": 1.64,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "C.I. 염기성 청색 009": {
            "mw": 319.85,
            "density": 1.31,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "메틸렌 블루": {
            "mw": 319.85,
            "density": 1.31,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "질산나트륨": {
            "mw": 86,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "질산 나트륨": {
            "mw": 86,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "브로모티몰 청색": {
            "mw": 624.38,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "BTB 용액": {
            "mw": 624.38,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "톨루이딘 블루 O": {
            "mw": 305.83,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "탄소": {
            "mw": 12.01,
            "density": 1.8,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "바륨 수산화물, 옥타수화물(BARIUM HYDROXIDE, OCTAHYDRATE)": {
            "mw": 315.46,
            "density": 2.18,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "바륨 수산화물, 옥타수화물": {
            "mw": 315.46,
            "density": 2.18,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "수산화 바륨 8수화물": {
            "mw": 315.46,
            "density": 2.18,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "티몰프탈레인": {
            "mw": 430.54,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "수산화 칼륨": {
            "mw": 56.11,
            "density": 2.044,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화 제I구리": {
            "mw": 143.09,
            "density": 6,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화 구리(I)": {
            "mw": 143.09,
            "density": 6,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화 구리": {
            "mw": 79.55,
            "density": 6.315,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "구리": {
            "mw": 63.55,
            "density": 8.94,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "페놀프탈레인": {
            "mw": 318.32,
            "density": 1.277,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "요오드산 칼륨": {
            "mw": 215.01,
            "density": 3.98,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "아이오딘산 칼륨": {
            "mw": 215.01,
            "density": 3.98,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "한천": {
            "mw": 0,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "알긴산 나트륨(SODIUM ALGINATE)": {
            "mw": 0,
            "density": 1.25,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "알긴산 나트륨": {
            "mw": 0,
            "density": 1.25,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "전분": {
            "mw": 0,
            "density": 0.119,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "녹말": {
            "mw": 0,
            "density": 0.119,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "황산 제1철, 칠수화물(FERROUS SULFATE, HEPTAHYDRATE)": {
            "mw": 280.03,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 제1철, 칠수화물": {
            "mw": 280.03,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 제1철 7수화물": {
            "mw": 280.03,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "Potassium chromate": {
            "mw": 196.21,
            "density": 2.73,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "크롬산 칼륨": {
            "mw": 196.21,
            "density": 2.73,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "철": {
            "mw": 55.85,
            "density": 7.86,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "GENTIAN VIOLET": {
            "mw": 407.98,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "크리스탈 바이올렛": {
            "mw": 407.98,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "황산 나트륨": {
            "mw": 144.06,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 나트륨 무수물": {
            "mw": 144.06,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "이탄산 나트륨(SODIUM BICARBONATE)": {
            "mw": 85.01,
            "density": 2.159,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "이탄산 나트륨": {
            "mw": 85.01,
            "density": 2.159,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "탄산 수소 나트륨": {
            "mw": 85.01,
            "density": 2.159,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 제II구리, 디히드레이트(CUPRIC CHLORIDE, DIHYDRATE)": {
            "mw": 170.48,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 제II구리, 디히드레이트": {
            "mw": 170.48,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 구리(II) 2수화물": {
            "mw": 170.48,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 구리 2수화물": {
            "mw": 170.48,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "2-하이드록시-5-((3-나이트로페닐)아조)벤조 산 모노나트륨 염(2-HYDROXY-5-((3-NITROPHEN...": {
            "mw": 310.22,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "2-하이드록시-5-벤조 산 모노나트륨 염(2-HYDROXY-5-((3-NITROPHEN...": {
            "mw": 310.22,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "알리자린 옐로우": {
            "mw": 310.22,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 제2철, 헥사히드레이트": {
            "mw": 270.3,
            "density": 1.339,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 철(II) 6수화물": {
            "mw": 270.3,
            "density": 1.339,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 철 6수화물": {
            "mw": 270.3,
            "density": 1.339,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "탄산 칼슘": {
            "mw": 102.1,
            "density": 2.8,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "티몰 블루": {
            "mw": 466.59,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "Potassium dichromate": {
            "mw": 296.2,
            "density": 2.676,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "중크롬산 칼륨": {
            "mw": 296.2,
            "density": 2.676,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "Aluminum": {
            "mw": 26.98,
            "density": 2.7,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "알루미늄": {
            "mw": 26.98,
            "density": 2.7,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화칼슘": {
            "mw": 56.08,
            "density": 3.3,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화 칼슘": {
            "mw": 56.08,
            "density": 3.3,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "나트륨 옥살산염": {
            "mw": 136.01,
            "density": 2.34,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "브로민화물 표준용액 브로민화물 표준용액 (1 mg/ml 브로민화물)(BROMIDE STANDARD SOLUTION (1 mg/ml BROMIDE))": {
            "mw": 119,
            "density": 2.75,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "브로민화물 표준용액 브로민화물 표준용액": {
            "mw": 119,
            "density": 2.75,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "브로민화 칼륨": {
            "mw": 119,
            "density": 2.75,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "아망가니즈 황산염 모노수화물": {
            "mw": 171.03,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 망간 모노수화물": {
            "mw": 171.03,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "티오황산 나트륨 펜타수화물(SODIUM THIOSULFATE PENTAHYDRATE)": {
            "mw": 250.2,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "티오황산 나트륨 펜타수화물": {
            "mw": 250.2,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "티오황산 나트륨 5수화물": {
            "mw": 250.2,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 칼륨": {
            "mw": 176.28,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "이산화티타늄": {
            "mw": 79.87,
            "density": 4.23,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "소디움 비설파이트": {
            "mw": 105.07,
            "density": 1.48,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "아황산수소 나트륨": {
            "mw": 105.07,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 아연, 헵타수화물": {
            "mw": 289.58,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 아연 7수화물": {
            "mw": 289.58,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "브로민산 칼륨(브롬산 칼륨)(POTASSIUM BROMATE)": {
            "mw": 168.01,
            "density": 3.34,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "브로민산 칼륨": {
            "mw": 168.01,
            "density": 3.34,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화제1철-제1철(FERRIC-FERROUS OXIDE)": {
            "mw": 231.54,
            "density": 5.1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화제1철-제1철": {
            "mw": 231.54,
            "density": 5.1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화 철(II),(III), Black": {
            "mw": 231.54,
            "density": 5.1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화 철, Black": {
            "mw": 231.54,
            "density": 5.1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "싸이오사이안산 칼륨": {
            "mw": 98.19,
            "density": 1.956,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "티오시안산 칼륨": {
            "mw": 98.19,
            "density": 1.956,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "인디고 카르민(INDIGO CARMINE)": {
            "mw": 468.37,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "인디고 카르민": {
            "mw": 468.37,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "인디고 카민": {
            "mw": 468.37,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "덱스트로스": {
            "mw": 180.16,
            "density": 1.544,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "포도당": {
            "mw": 180.16,
            "density": 1.544,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "초산": {
            "mw": 60.05,
            "density": 1.0446,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "아세트산": {
            "mw": 60.05,
            "density": 1.05,
            "defaultConc": 99.5,
            "defaultUnit": "%"
          },
          "살리실산": {
            "mw": 138.12,
            "density": 1.443,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "과망간산칼륨": {
            "mw": 159.04,
            "density": 2.7,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "과망간산 칼륨": {
            "mw": 159.04,
            "density": 2.7,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "메틸 적색": {
            "mw": 269.3,
            "density": 1.31,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "메틸 레드": {
            "mw": 269.3,
            "density": 1.31,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "브이엠 및 피 나프타": {
            "mw": 0,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "석유 에테르": {
            "mw": 0,
            "density": 1,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "메틸 오렌지(METHYL ORANGE)": {
            "mw": 328.34,
            "density": 1.473,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "메틸 오렌지": {
            "mw": 328.34,
            "density": 1.473,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화철": {
            "mw": 159.69,
            "density": 5.24,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화 철(III), Red": {
            "mw": 159.69,
            "density": 5.24,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화 철, Red": {
            "mw": 159.69,
            "density": 5.24,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 칼슘(CALCIUM CHLORIDE)": {
            "mw": 110.98,
            "density": 2.152,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "염화 칼슘": {
            "mw": 110.98,
            "density": 2.152,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "나트륨 아세트산, 트리수화물(SODIUM ACETATE, TRIHYDRATE)": {
            "mw": 137.09,
            "density": 1.05,
            "defaultConc": 99.5,
            "defaultUnit": "%"
          },
          "나트륨 아세트산, 트리수화물": {
            "mw": 137.09,
            "density": 1.05,
            "defaultConc": 99.5,
            "defaultUnit": "%"
          },
          "아세트산 나트륨 3수화물": {
            "mw": 137.09,
            "density": 1.05,
            "defaultConc": 99.5,
            "defaultUnit": "%"
          },
          "아세톤": {
            "mw": 58.08,
            "density": 0.79,
            "defaultConc": 99.5,
            "defaultUnit": "%"
          },
          "질산 납(Ⅱ)": {
            "mw": 333.24,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "질산 납": {
            "mw": 333.24,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "질산 납(II)": {
            "mw": 333.24,
            "density": 1.42,
            "defaultConc": 70,
            "defaultUnit": "%"
          },
          "황산 구리(II), 오수화물": {
            "mw": 251.7,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 구리, 오수화물": {
            "mw": 251.7,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 구리(II) 5수화물": {
            "mw": 251.7,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "황산 구리 5수화물": {
            "mw": 251.7,
            "density": 1.84,
            "defaultConc": 98,
            "defaultUnit": "%"
          },
          "산화 제II구리(CUPRIC OXIDE)": {
            "mw": 79.55,
            "density": 6.315,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화 제II구리": {
            "mw": 79.55,
            "density": 6.315,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "산화 구리(II)": {
            "mw": 79.55,
            "density": 6.315,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "Zinc": {
            "mw": 65.4,
            "density": 7.14,
            "defaultConc": 100,
            "defaultUnit": "%"
          },
          "아연": {
            "mw": 65.4,
            "density": 7.14,
            "defaultConc": 100,
            "defaultUnit": "%"
          }
        };

        const defaultData = Object.keys(chemDefaults).find(k => chemName.includes(k)) ? chemDefaults[Object.keys(chemDefaults).find(k => chemName.includes(k))] : null;
        const mw = (defaultData && defaultData.mw) ? defaultData.mw : (parseFloat(substance.molecular_mass) || 0);

        let bestCandidate = null;
        let candidateType = null;
        let candidateConcM = 0;

        const solids = invItems.filter(item => {
          const state = (item.state || "").trim();
          return ["고체", "파우더", "가루", "Solid", "Powder"].some(s => state.includes(s));
        });

        if (solids.length > 0) {
          solids.sort((a, b) => Number(b.current_amount || 0) - Number(a.current_amount || 0));
          bestCandidate = solids[0];
          candidateType = 'solid';
        } else {
          const liquids = [];
          for (const item of invItems) {
            const currentConcVal = parseFloat(item.concentration_value) || 0;
            const currentUnit = item.concentration_unit || "%";
            const density = extractDensity(item) || (defaultData ? defaultData.density : 1.0);

            let sourceM = 0;
            if (currentUnit === "M") {
              sourceM = currentConcVal;
            } else if (currentUnit === "%") {
              if (mw) {
                const calculationMw = (chemName.includes("암모니아") || chemName.includes("ammonia")) ? 17.03 : mw;
                sourceM = (currentConcVal * 10 * density) / calculationMw;
              } else {
                sourceM = 0;
              }
            } else if (currentUnit === "N") {
              sourceM = currentConcVal;
            }

            liquids.push({ item, sourceM, currentConcVal, currentUnit, density });
          }

          let destM = 0;
          if (targetUnit === "M") {
            destM = targetConc;
          } else if (targetUnit === "mM") {
            destM = targetConc / 1000;
          } else if (targetUnit === "%") {
            if (mw) {
              const calculationMw = (chemName.includes("암모니아") || chemName.includes("ammonia")) ? 17.03 : mw;
              destM = (targetConc * 10 * 1.0) / calculationMw;
            }
          }

          const validLiquids = liquids.filter(liq => {
            if (targetUnit === "%" && liq.currentUnit === "%") {
              return liq.currentConcVal >= targetConc;
            }
            return liq.sourceM >= destM;
          });

          if (validLiquids.length > 0) {
            validLiquids.sort((a, b) => b.sourceM - a.sourceM);
            bestCandidate = validLiquids[0].item;
            candidateType = 'liquid';
            candidateConcM = validLiquids[0].sourceM;
          }
        }

        if (!bestCandidate) {
          const stockList = invItems.map(i => {
            const val = i.concentration_value;
            const unit = i.concentration_unit;
            const state = i.state || "";
            if (val === null || val === undefined || val === "null" || val === "" || !unit || unit === "null") {
              return `농도 미표시 시약 (${state})`;
            }
            return `${val}${unit} ${state}`;
          }).join(', ');

          return `❌ **조제 불가능 (농도 부족 / 재고 없음)**
현재 과학실 내에 보유한 **${chemName}** 재고(${stockList}) 중 목표 농도(${targetConc}${targetUnit})보다 농도가 높은 액체 시약이나 고체 시약이 없어 조제 레시피를 계산할 수 없습니다.`;
        }

        let requiredAmount = 0;
        let stepsHtml = "";
        let prepHtml = "";
        const isAcid = (chemName || "").includes("산");
        const candidateName = bestCandidate.edited_name_kor || bestCandidate.Substance?.chem_name_kor_mod || chemName;
        const currentConcStr = `${bestCandidate.concentration_value || ''}${bestCandidate.concentration_unit || ''}`;
        const area = bestCandidate.Cabinet?.area_id?.room_name || "";
        const cabinetName = bestCandidate.Cabinet?.cabinet_name || "";
        const locationStr = `${area} 『${cabinetName}』`.trim() || "위치 미지정";

        if (candidateType === 'solid') {
          let purity = 1.0;
          if (bestCandidate.concentration_unit === "%" && bestCandidate.concentration_value) {
            purity = parseFloat(bestCandidate.concentration_value) / 100;
          }

          if (targetUnit === "M" || targetUnit === "mM") {
            if (!mw) {
              return `❌ 분자량(MW) 정보가 존재하지 않아 몰농도 레시피를 계산할 수 없습니다.`;
            }
            let targetM = targetConc;
            if (targetUnit === "mM") targetM = targetConc / 1000;
            const volL = targetVol / 1000;
            requiredAmount = (targetM * volL * mw) / purity;
          } else if (targetUnit === "%") {
            requiredAmount = (targetVol * (targetConc / 100)) / purity;
          }

          prepHtml = `
            <li><strong>사용할 시약:</strong> ${candidateName} (고체, No.${bestCandidate.id})</li>
            <li><strong>보관 위치:</strong> ${locationStr}</li>
            <li><strong>필요 시약 질량:</strong> <b style="color: #007bff;">${requiredAmount.toFixed(2)} g</b></li>
            <li><strong>필요 준비물:</strong> 전자저울, 약포지, 약숟가락, ${targetVol}mL 부피 플라스크, 씻기병(증류수), 비커</li>
          `;

          stepsHtml = `
            <ol style="margin: 0; padding-left: 20px; line-height: 1.6; font-size: 12px; color: #495057;">
              <li>전자저울에 약포지를 올리고 영점을 맞춥니다.</li>
              <li><strong>${candidateName} ${requiredAmount.toFixed(2)}g</strong>을 정확히 계량하여 비커에 넣습니다.</li>
              <li>증류수를 적당량(약 ${Math.floor(targetVol / 2)}mL) 부어 유리 막대로 저어 완전히 녹입니다. ${isAcid ? "<br><span style='color: #d6336c; font-weight: bold;'>※ 주의: 용해 시 발열 반응이 발생할 수 있으니 안전에 주의하십시오.</span>" : ""}</li>
              <li>녹인 용액을 <strong>${targetVol}mL 부피 플라스크</strong>에 조심스럽게 옮겨 담습니다.</li>
              <li>비커를 증류수로 2~3회 깨끗이 헹구어 플라스크에 같이 부어줍니다.</li>
              <li>표시선까지 증류수를 정확히 채우고 마개를 닫은 후, 위아래로 흔들어 균일하게 섞어 줍니다.</li>
            </ol>
          `;
        } else {
          const currentUnit = bestCandidate.concentration_unit || "%";
          const currentConcVal = parseFloat(bestCandidate.concentration_value) || 0;

          if (targetUnit === "%" && currentUnit === "%") {
            requiredAmount = (targetVol * targetConc) / currentConcVal;
          } else {
            let destM = 0;
            if (targetUnit === "M") {
              destM = targetConc;
            } else if (targetUnit === "mM") {
              destM = targetConc / 1000;
            } else if (targetUnit === "%") {
              if (mw) {
                destM = (targetConc * 10 * 1.0) / mw;
              }
            }
            requiredAmount = (destM * targetVol) / candidateConcM;
          }

          const waterVol = (targetVol - requiredAmount).toFixed(1);

          prepHtml = `
            <li><strong>사용할 시약:</strong> ${candidateName} (액체 ${currentConcStr}, No.${bestCandidate.id})</li>
            <li><strong>보관 위치:</strong> ${locationStr}</li>
            <li><strong>필요 원액 부피:</strong> <b style="color: #d6336c;">${requiredAmount.toFixed(2)} mL</b></li>
            <li><strong>필요 준비물:</strong> 피펫, 피펫 펌프, ${targetVol}mL 부피 플라스크, 증류수</li>
          `;

          if (isAcid) {
            stepsHtml = `
              <ol style="margin: 0; padding-left: 20px; line-height: 1.6; font-size: 12px; color: #495057;">
                <li><strong>${targetVol}mL 부피 플라스크</strong>에 증류수를 미리 약 ${(targetVol / 3).toFixed(0)}mL 정도 채워 둡니다. <br><span style="color: #d6336c; font-weight: bold;">(※ 중요: 발열 반응 방지를 위해 항상 물에 산을 첨가해야 합니다!)</span></li>
                <li>피펫을 사용하여 <strong>${candidateName} 원액 ${requiredAmount.toFixed(2)}mL</strong>를 정밀하게 취합니다.</li>
                <li>플라스크 벽면을 따라 원액을 아주 천천히 흘려 넣어 줍니다.</li>
                <li>부피 플라스크의 표시선까지 나머지 증류수를 조심스럽게 마저 채웁니다.</li>
                <li>마개를 꼭 닫고 플라스크를 천천히 뒤집어 가며 완전히 섞어 줍니다.</li>
              </ol>
            `;
          } else {
            stepsHtml = `
              <ol style="margin: 0; padding-left: 20px; line-height: 1.6; font-size: 12px; color: #495057;">
                <li><strong>${targetVol}mL 부피 플라스크</strong>에 피펫을 이용하여 <strong>${candidateName} 원액 ${requiredAmount.toFixed(2)}mL</strong>를 넣습니다.</li>
                <li>표시선까지 증류수를 채워 줍니다. (약 ${waterVol}mL 소요)</li>
                <li>마개를 닫고 가볍게 흔들어 균일하게 섞어 줍니다.</li>
              </ol>
            `;
          }
        }

        let stockWarning = "";
        const currentStock = parseFloat(bestCandidate.current_amount) || 0;
        const needed = requiredAmount;
        if (needed > currentStock) {
          stockWarning = `
            <div style="background: #fff5f5; border: 1px solid #ffa8a8; padding: 10px; border-radius: 6px; color: #e03131; font-weight: bold; font-size: 12px; margin-top: 10px;">
              ⚠️ [재고 부족 경고] 현재 보유 중인 재고량(${currentStock}${bestCandidate.unit || 'mL'})이 제조에 필요한 양(${needed.toFixed(2)}${bestCandidate.unit || 'mL'})보다 적습니다.
            </div>
          `;
        }

        return `🧪 **${chemName} ${targetConc}${targetUnit} ${volMatch ? volMatch[1] + volMatch[2] : '500mL'} 조제 레시피**
` + `
<div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 12px; margin-top: 10px;">
  <strong style="color: #495057; font-size: 13px;">📋 준비 단계</strong>
  <ul style="margin: 6px 0 0; padding-left: 20px; line-height: 1.5; font-size: 12px; color: #495057;">
    ${prepHtml}
  </ul>
  ${stockWarning}
</div>

<div style="background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 12px; margin-top: 10px;">
  <strong style="color: #0984e3; font-size: 13px;">⚙️ 조제 순서 (레시피)</strong>
  <div style="margin-top: 8px;">
    ${stepsHtml}
  </div>
</div>
`.replace(/\n\s*/g, "");
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
          <div class="chatbot-chips-container" style="margin-top: 10px; display: flex; gap: 5px;">
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 검색</button>
          </div>`;
        }

        if (isLocationQuery) {
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
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 검색</button>
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
            <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 검색</button>
          </div>`.replace(/\n\s*/g, "");
        } else {
          return `🔍 <b>${chemName}</b> (CAS: ${casRn})의 화학물질 정보는 등록되어 있으나, 현재 과학실 내에 **보관된 시약병(재고)이 없습니다.**
          
💡 **도움말:**
이 물질에 대해 다른 정보를 원하시면 아래 버튼을 눌러보세요.
<div class="chatbot-chips-container" style="margin-top: 10px; display: flex; gap: 5px;">
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('위험성')">⚠️ 위험성(MSDS)</button>
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('분자량')">⚖️ 분자량</button>
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 검색</button>
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
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 시약 검색</button>
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
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 시약 검색</button>
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
  <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 시약 검색</button>
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
          <div class="chatbot-chem-grid" style="display: grid; grid-template-columns: 80px 1fr; row-gap: 4px; font-size: 12.5px;">
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
        <div class="chatbot-chips-container" style="margin-top: 10px; display: flex; gap: 5px;">
          <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 검색</button>
        </div>
      `.replace(/\n\s*/g, "");
      return summaryCardHtml;
    },

    goToDetail: function (substanceId) {
      // Substance ID를 통해 Inventory 테이블의 레코드 ID를 찾아 이동합니다.
      const supabase = getSupabase();
      if (!supabase) return;

      supabase
        .from("Inventory")
        .select("id")
        .eq("substance_id", substanceId)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            this.togglePanel(false); // 챗봇 패널 닫기
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
      this.togglePanel(false); // 챗봇 패널 닫기
      if (getApp().Router?.go) {
        getApp().Router.go("inventoryDetail", { id: inventoryId });
      } else {
        localStorage.setItem("selected_inventory_id", inventoryId);
        location.reload();
      }
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

      if (provider === "gemini") {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }]
                }
              ],
              systemInstruction: {
                parts: [{ text: systemInstruction }]
              }
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
        // OpenAI 및 Custom OpenAI 호환 API (Claude, OpenRouter, Ollama 등)
        let endpoint = "https://api.openai.com/v1/chat/completions";
        const modelName = this.model || "gpt-4o-mini";

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
    }
  };

  // 전역 노출
  globalThis.App = globalThis.App || {};
  globalThis.App.Chatbot = Chatbot;

  console.log("🤖 Chatbot 모듈 로드 완료 — App.Chatbot 등록됨");
})();
