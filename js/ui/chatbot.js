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
            <input type="text" id="chatbot-input" placeholder="시약의 이름을 입력하세요..." autocomplete="off">
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
            정보를 조회하고자 하는 시약의 이름을 입력해 주세요.<br><br>
            <span style="color:#777; font-size:12px;">💡 <b>시약 예시:</b></span>
            <ul style="margin: 4px 0 8px 16px; padding: 0; font-size:12.5px; color:#555;">
              <li>"수산화 나트륨"</li>
              <li>"염산"</li>
              <li>"에탄올"</li>
              <li>"아세톤"</li>
            </ul>
            밑의 추천 시약을 클릭하거나 직접 이름을 입력해 보세요!
            <div class="chatbot-chips-container" style="margin-top: 10px;">
              <button class="chatbot-chip" onclick="App.Chatbot.askPreset('수산화 나트륨')">🧪 수산화 나트륨</button>
              <button class="chatbot-chip" onclick="App.Chatbot.askPreset('염산')">🧪 염산</button>
              <button class="chatbot-chip" onclick="App.Chatbot.askPreset('에탄올')">🧪 에탄올</button>
              <button class="chatbot-chip" onclick="App.Chatbot.askPreset('아세톤')">🧪 아세톤</button>
            </div>
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

      const isMwQuery = tokens.some(t => mwKeywords.some(k => t.includes(k)));
      const isMsdsQuery = tokens.some(t => msdsKeywords.some(k => t.includes(k)));
      const isPropQuery = tokens.some(t => propKeywords.some(k => t.includes(k)));
      const isResetQuery = tokens.some(t => resetKeywords.some(k => t.includes(k)));
      const isMatchingQuery = tokens.some(t => matchingKeywords.some(k => t.includes(k)));
      const isEmergencyQuery = tokens.some(t => emergencyKeywords.some(k => t.includes(k)));
      const isWasteQuery = tokens.some(t => wasteKeywords.some(k => t.includes(k)));

      // 다른 시약 검색 요청 시 상태 초기화
      if (isResetQuery) {
        this.selectedSubstance = null;
        const inputEl = document.getElementById("chatbot-input");
        if (inputEl) {
          inputEl.placeholder = "시약의 이름을 입력하세요...";
        }
        return `🔄 다른 시약을 검색합니다. 시약의 이름을 입력해 주세요.
        <div class="chatbot-chips-container" style="margin-top: 10px;">
          <button class="chatbot-chip" onclick="App.Chatbot.askPreset('수산화 나트륨')">🧪 수산화 나트륨</button>
          <button class="chatbot-chip" onclick="App.Chatbot.askPreset('염산')">🧪 염산</button>
          <button class="chatbot-chip" onclick="App.Chatbot.askPreset('에탄올')">🧪 에탄올</button>
          <button class="chatbot-chip" onclick="App.Chatbot.askPreset('아세톤')">🧪 아세톤</button>
        </div>`;
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
        return `🔍 입력하신 실험 키트("${cleanSubject || query}")에 대한 준비물 정보를 찾을 수 없습니다.
        
💡 <b>실험명 예시:</b>
- "화학정원 만들기" (또는 "화학정원")
- "앙금 생성 반응" (또는 "앙금")
- "기체 발생 장치"
- "달고나 만들기"
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

      // 2. 물질 매칭 실패 시 -> 긴급/폐기 일반 대처 혹은 AI Fallback
      if (!substance) {
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
          return `🔍 데이터베이스에서 입력하신 키워드와 관련된 화학물질을 찾지 못했습니다.
          
💡 <b>도움말:</b>
오타가 없는지 확인하거나 정확한 명칭(예: '수산화 나트륨', '에탄올', '염산')으로 질문해 보세요.
일반적인 질문이나 오타 자동 보정 기능을 원하시면 **[설정 > 과학실 설정 > 사용자 기초설정]** 탭에서 API Key를 입력해 주시면 똑똑한 AI 모드를 사용할 수 있습니다!`;
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
        inputEl.placeholder = `"${chemName}"에 대해 질문하세요 (예: 분자량, 위험성)...`;
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
      const summaryCardHtml = `
        🧪 <b>${chemName}</b> 시약이 선택되었습니다. 이 시약에 대해 무엇이 궁금하신가요?
        <div class="chatbot-chemical-card">
          <div class="chatbot-chem-header">
            <div>
              <div class="chatbot-chem-title">${chemName}</div>
              <div class="chatbot-chem-subtitle">${substance.substance_name || ""}</div>
            </div>
            <span class="chatbot-chem-cas">${casRn}</span>
          </div>
          <div class="chatbot-chem-grid">
            <div class="chatbot-chem-label">분자식</div>
            <div class="chatbot-chem-val">${formula}</div>
            <div class="chatbot-chem-label">분자량</div>
            <div class="chatbot-chem-val">${molMass}</div>
          </div>
          <div class="chatbot-chem-footer-btns">
            <button class="chatbot-chem-btn" onclick="App.Chatbot.askPreset('분자량')">분자량</button>
            <button class="chatbot-chem-btn" onclick="App.Chatbot.askPreset('위험성')">위험성</button>
            <button class="chatbot-chem-btn" onclick="App.Chatbot.askPreset('특성')">물리<br>특성</button>
            <button class="chatbot-chem-btn btn-filled" onclick="App.Chatbot.goToDetail(${substance.id})">상세<br>이동</button>
          </div>
        </div>
        <div class="chatbot-chips-container" style="margin-top: 10px;">
          <button class="chatbot-chip" onclick="App.Chatbot.askPreset('다른 시약 검색')">🔄 다른 시약 검색</button>
        </div>
      `;
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
        let modelName = this.model || "gpt-4o-mini";

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
