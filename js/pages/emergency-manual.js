// ================================================================
// /js/pages/emergency-manual.js — 과학실 비상시 대처 요령 & 대피도 안내
// ================================================================
(function () {
    const EmergencyManual = {};

    EmergencyManual.init = async function () {
        try {
            console.log("🚨 Emergency Manual Init");
            const container = document.getElementById('emergency-manual-container');
            if (!container) {
                console.error("❌ emergency-manual-container not found!");
                return;
            }

            // Force Body & HTML Scroll Unlock
            document.documentElement.style.overflowY = "auto";
            document.body.style.overflowY = "auto";
            document.body.style.height = "auto";
            document.body.classList.remove("home-active");
            document.body.classList.add("loaded");

            container.innerHTML = `
                <div id="emergency-manual-scroll-wrapper" style="
                    height: 100vh;
                    height: calc(100dvh - 60px); 
                    overflow-y: auto; 
                    -webkit-overflow-scrolling: touch; 
                    padding: 20px 16px 140px 16px; 
                    box-sizing: border-box;
                    background: #f8f9fa;
                ">
                    <div style="max-width: 1100px; margin: 0 auto;">
                        <!-- 헤더 영역 -->
                        <div style="
                            background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
                            color: white;
                            padding: 24px 28px;
                            border-radius: 16px;
                            box-shadow: 0 4px 16px rgba(211, 47, 47, 0.25);
                            margin-bottom: 20px;
                            display: flex;
                            flex-wrap: wrap;
                            justify-content: space-between;
                            align-items: center;
                            gap: 16px;
                        ">
                            <div>
                                <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; display: flex; align-items: center; gap: 10px;">
                                    <span>🚨</span> 과학실 비상시 대처 요령 및 대피 안내
                                </h1>
                                <p style="margin: 8px 0 0 0; opacity: 0.92; font-size: 14px; font-weight: 400; line-height: 1.5;">
                                    실험실별 비상 대피도, 안전 설비 위치, 비상 연락망 및 응급상황 행동 수칙
                                </p>
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button onclick="App.EmergencyManual.printPage()" style="
                                    background: rgba(255, 255, 255, 0.2);
                                    color: white;
                                    border: 1px solid rgba(255, 255, 255, 0.4);
                                    padding: 8px 16px;
                                    border-radius: 8px;
                                    font-size: 13px;
                                    font-weight: bold;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                    transition: background 0.2s;
                                " onmouseover="this.style.background='rgba(255, 255, 255, 0.35)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
                                    <span class="material-symbols-outlined" style="font-size: 18px;">print</span> 인쇄하기
                                </button>
                            </div>
                        </div>

                        <!-- 퀵 이동 네비게이션 칩 -->
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px;">
                            <button onclick="App.EmergencyManual.scrollToSection('sec-lab1')" style="background: #ffffff; color: #c92a2a; border: 1px solid #ffc9c9; padding: 6px 14px; border-radius: 20px; font-size: 12.5px; font-weight: bold; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background='#ffffff'">🏢 과학교과실1 대피도</button>
                            <button onclick="App.EmergencyManual.scrollToSection('sec-lab2')" style="background: #ffffff; color: #1971c2; border: 1px solid #a5d8ff; padding: 6px 14px; border-radius: 20px; font-size: 12.5px; font-weight: bold; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#e7f5ff'" onmouseout="this.style.background='#ffffff'">🏢 과학교과실2 대피도</button>
                            <button onclick="App.EmergencyManual.scrollToSection('sec-contact')" style="background: #ffffff; color: #2b8a3e; border: 1px solid #b2f2bb; padding: 6px 14px; border-radius: 20px; font-size: 12.5px; font-weight: bold; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#ebfbee'" onmouseout="this.style.background='#ffffff'">🚨 비상연락망</button>
                            <button onclick="App.EmergencyManual.scrollToSection('sec-rules')" style="background: #ffffff; color: #e67e22; border: 1px solid #ffe8cc; padding: 6px 14px; border-radius: 20px; font-size: 12.5px; font-weight: bold; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#fff4e6'" onmouseout="this.style.background='#ffffff'">🏃 공통 대피 요령</button>
                        </div>

                        <!-- 1. 과학교과실1 응급상황 대피도 -->
                        <div id="sec-lab1" style="background: white; border-radius: 16px; border: 1px solid #e9ecef; box-shadow: 0 4px 20px rgba(0,0,0,0.06); margin-bottom: 28px; overflow: hidden;">
                            <div style="background: #fff5f5; border-bottom: 1px solid #ffe3e3; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #c92a2a; display: flex; align-items: center; gap: 8px;">
                                    <span>🏢</span> 1. 과학교과실1 응급상황 대피도
                                </h2>
                                <button onclick="App.EmergencyManual.openLightbox('data/Emergency1.png')" style="background: #c92a2a; color: white; border: none; padding: 6px 14px; border-radius: 20px; font-size: 12.5px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">zoom_in</span> 대피도 크게 보기
                                </button>
                            </div>
                            <div style="padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; align-items: start;">
                                <!-- 도면 이미지 -->
                                <div style="text-align: center; background: #fafafa; padding: 12px; border-radius: 12px; border: 1px solid #eee; cursor: pointer;" onclick="App.EmergencyManual.openLightbox('data/Emergency1.png')">
                                    <img src="data/Emergency1.png" alt="과학교과실1 대피도" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                                    <div style="margin-top: 8px; font-size: 12px; color: #888;">🔍 클릭 시 고화질 대피도 맵 확대</div>
                                </div>
                                <!-- 세부 설명 텍스트 -->
                                <div style="display: flex; flex-direction: column; gap: 16px;">
                                    <div style="background: #f8f9fa; padding: 14px; border-radius: 10px; border-left: 4px solid #c92a2a;">
                                        <div style="font-weight: bold; color: #333; font-size: 14px; margin-bottom: 4px;">📍 위치 정보</div>
                                        <div style="color: #495057; font-size: 13.5px; font-weight: 600;">본관 2층 (수리과학교육부 교무실 맞은편)</div>
                                    </div>
                                    <div style="background: #f8f9fa; padding: 14px; border-radius: 10px; border-left: 4px solid #e67e22;">
                                        <div style="font-weight: bold; color: #333; font-size: 14px; margin-bottom: 6px;">🧯 주요 안전 설비 위치</div>
                                        <ul style="margin: 0; padding-left: 18px; color: #495057; font-size: 13px; line-height: 1.6;">
                                            <li><b>소화기 / 방화사:</b> 실험실 내부 출입문 양옆 및 측면 Wall, 복도 곳곳에 배치</li>
                                            <li><b>구급상자:</b> 중앙 후면 벽면 (방화사 배치 구역 인근)</li>
                                        </ul>
                                    </div>
                                    <div style="background: #fff5f5; padding: 14px; border-radius: 10px; border-left: 4px solid #d32f2f;">
                                        <div style="font-weight: bold; color: #c92a2a; font-size: 14px; margin-bottom: 6px;">🏃 대피 경로</div>
                                        <ol style="margin: 0; padding-left: 18px; color: #212529; font-size: 13px; line-height: 1.7; font-weight: 600;">
                                            <li>화재 및 비상상황 발생 시 출입문을 통해 복도로 신속히 퇴실합니다.</li>
                                            <li>복도 진출 후 <span style="color: #d32f2f;">좌측 계단 방향</span>으로 이동합니다.</li>
                                            <li>계단을 이용하여 지상(외부) 안전지대로 신속히 대피합니다.</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 2. 과학교과실2 응급상황 대피도 -->
                        <div id="sec-lab2" style="background: white; border-radius: 16px; border: 1px solid #e9ecef; box-shadow: 0 4px 20px rgba(0,0,0,0.06); margin-bottom: 28px; overflow: hidden;">
                            <div style="background: #e7f5ff; border-bottom: 1px solid #a5d8ff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #1971c2; display: flex; align-items: center; gap: 8px;">
                                    <span>🏢</span> 2. 과학교과실2 응급상황 대피도
                                </h2>
                                <button onclick="App.EmergencyManual.openLightbox('data/Emergency2.png')" style="background: #1971c2; color: white; border: none; padding: 6px 14px; border-radius: 20px; font-size: 12.5px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">zoom_in</span> 대피도 크게 보기
                                </button>
                            </div>
                            <div style="padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; align-items: start;">
                                <!-- 도면 이미지 -->
                                <div style="text-align: center; background: #fafafa; padding: 12px; border-radius: 12px; border: 1px solid #eee; cursor: pointer;" onclick="App.EmergencyManual.openLightbox('data/Emergency2.png')">
                                    <img src="data/Emergency2.png" alt="과학교과실2 대피도" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                                    <div style="margin-top: 8px; font-size: 12px; color: #888;">🔍 클릭 시 고화질 대피도 맵 확대</div>
                                </div>
                                <!-- 세부 설명 텍스트 -->
                                <div style="display: flex; flex-direction: column; gap: 16px;">
                                    <div style="background: #f8f9fa; padding: 14px; border-radius: 10px; border-left: 4px solid #1971c2;">
                                        <div style="font-weight: bold; color: #333; font-size: 14px; margin-bottom: 4px;">📍 위치 정보</div>
                                        <div style="color: #495057; font-size: 13.5px; font-weight: 600;">본관 2층 (과학준비실 맞은편)</div>
                                    </div>
                                    <div style="background: #f8f9fa; padding: 14px; border-radius: 10px; border-left: 4px solid #e67e22;">
                                        <div style="font-weight: bold; color: #333; font-size: 14px; margin-bottom: 6px;">🧯 주요 안전 설비 위치</div>
                                        <ul style="margin: 0; padding-left: 18px; color: #495057; font-size: 13px; line-height: 1.6;">
                                            <li><b>소화기 / 방화사:</b> 실험실 전면 및 후면 출입구 부근, 준비실 내부</li>
                                            <li><b>구급상자:</b> 후면 벽면 상단</li>
                                        </ul>
                                    </div>
                                    <div style="background: #e7f5ff; padding: 14px; border-radius: 10px; border-left: 4px solid #1864ab;">
                                        <div style="font-weight: bold; color: #1864ab; font-size: 14px; margin-bottom: 6px;">🏃 대피 경로</div>
                                        <ol style="margin: 0; padding-left: 18px; color: #212529; font-size: 13px; line-height: 1.7; font-weight: 600;">
                                            <li>비상벨 및 경보 확인 즉시 전면 또는 후면 출입문을 통해 복도로 이동합니다.</li>
                                            <li>복도로 나와 <span style="color: #1864ab;">우측 계단(도서실 방향)</span>으로 신속하게 이동합니다.</li>
                                            <li>계단을 통해 건물 밖 안전지대로 이동합니다.</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 3. 안전사고 비상연락망 안내 -->
                        <div id="sec-contact" style="background: white; border-radius: 16px; border: 1px solid #e9ecef; box-shadow: 0 4px 20px rgba(0,0,0,0.06); margin-bottom: 28px; overflow: hidden;">
                            <div style="background: #ebfbee; border-bottom: 1px solid #b2f2bb; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #2b8a3e; display: flex; align-items: center; gap: 8px;">
                                    <span>📞</span> 3. 안전사고 비상연락망 안내
                                </h2>
                                <button onclick="App.EmergencyManual.openLightbox('data/Emergency3.png')" style="background: #2b8a3e; color: white; border: none; padding: 6px 14px; border-radius: 20px; font-size: 12.5px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">zoom_in</span> 비상연락망 도표 크게 보기
                                </button>
                            </div>
                            <div style="padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; align-items: start;">
                                <!-- 비상연락망 이미지 -->
                                <div style="text-align: center; background: #fafafa; padding: 12px; border-radius: 12px; border: 1px solid #eee; cursor: pointer;" onclick="App.EmergencyManual.openLightbox('data/Emergency3.png')">
                                    <img src="data/Emergency3.png" alt="안전사고 비상연락망" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                                    <div style="margin-top: 8px; font-size: 12px; color: #888;">🔍 클릭 시 고화질 비상연락망 계통도 확대</div>
                                </div>
                                <!-- 세부 설명 텍스트 -->
                                <div style="display: flex; flex-direction: column; gap: 16px;">
                                    <!-- 핵심 지침 강조 박스 -->
                                    <div style="background: #fff5f5; border: 1.5px dashed #ffc9c9; padding: 12px 16px; border-radius: 10px; color: #c92a2a; font-weight: bold; font-size: 13.5px; display: flex; align-items: center; gap: 8px;">
                                        <span class="material-symbols-outlined" style="font-size: 20px;">timer</span>
                                        <span>[핵심 지침] 화학 사고 발생 시 15분 이내 즉시 신고</span>
                                    </div>
                                    <!-- 학내 비상 연락 체계 -->
                                    <div style="background: #f8f9fa; padding: 14px; border-radius: 10px; border-left: 4px solid #2b8a3e;">
                                        <div style="font-weight: bold; color: #2b8a3e; font-size: 14px; margin-bottom: 6px;">🚨 학내 비상 연락 체계</div>
                                        <ul style="margin: 0; padding-left: 18px; color: #333; font-size: 13px; line-height: 1.65;">
                                            <li><b>상황 발생 및 최초 조치:</b> 교과실험 담당교사 <i>(상황 체크, 학생 알림, 초기 처치 및 전파)</i></li>
                                            <li><b>보고 및 협조:</b>
                                                <ul style="margin: 4px 0 0 0; padding-left: 16px; color: #555;">
                                                    <li><b>보건실 / 행정실:</b> 즉시 통보 및 응급처치 지원</li>
                                                    <li><b>안전관리 담당자:</b> (정) 수리과학교육부장 / (부) 수리과학교육부계</li>
                                                    <li><b>안전관리 부총괄자:</b> 교감</li>
                                                    <li><b>안전관리 총괄자:</b> 교장</li>
                                                </ul>
                                            </li>
                                        </ul>
                                    </div>
                                    <!-- 유관기관 긴급 연락처 -->
                                    <div style="background: #f8f9fa; padding: 14px; border-radius: 10px; border-left: 4px solid #d32f2f;">
                                        <div style="font-weight: bold; color: #d32f2f; font-size: 14px; margin-bottom: 6px;">📞 주요 유관기관 긴급 연락처</div>
                                        <ul style="margin: 0; padding-left: 18px; color: #333; font-size: 13px; line-height: 1.65;">
                                            <li><b>화재 및 인명구조:</b> <span style="color: #d32f2f; font-weight: bold; font-size: 14px;">119 안전센터 (국번없이 119)</span></li>
                                            <li><b>상황보고 및 유관기관:</b>
                                                <ul style="margin: 4px 0 0 0; padding-left: 16px; color: #555;">
                                                    <li>지역교육청(과학영재정보교육) / 도교육청(융합교육정책과) / 교육부(교육안전정책과)</li>
                                                    <li>근처 협력 병원 응급실 / 인근 파출소</li>
                                                    <li>소방, 전기, 환경 안전 관리 기관 <i>(시청 기후에너지과, 한강유역환경청 등)</i></li>
                                                </ul>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 4. 응급상황 발생 시 대피 요령 (공통) -->
                        <div id="sec-rules" style="background: white; border-radius: 16px; border: 1px solid #e9ecef; box-shadow: 0 4px 20px rgba(0,0,0,0.06); overflow: hidden;">
                            <div style="background: #fff4e6; border-bottom: 1px solid #ffe8cc; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
                                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #e67e22; display: flex; align-items: center; gap: 8px;">
                                    <span>🏃</span> 4. 응급상황 발생 시 대피 요령 (공통 행동 수칙)
                                </h2>
                            </div>
                            <div style="padding: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
                                <!-- 1) 화재 및 화학물질 누출 시 -->
                                <div style="background: #fff5f5; border: 1px solid #ffe3e3; border-radius: 12px; padding: 18px;">
                                    <h3 style="margin: 0 0 14px 0; font-size: 15.5px; font-weight: 800; color: #d32f2f; display: flex; align-items: center; gap: 6px;">
                                        <span>🔥</span> 1️⃣ 화재 및 화학물질 누출 시
                                    </h3>
                                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: #333; line-height: 1.6;">
                                        <div style="background: white; padding: 10px 12px; border-radius: 8px; border: 1px solid #ffd8d8;">
                                            📢 <b>즉시 알림:</b> <span style="color: #d32f2f; font-weight: bold;">"불이야!"</span> 또는 <span style="color: #d32f2f; font-weight: bold;">"비상상황!"</span>을 크게 외쳐 주변에 알리고 비상벨을 누릅니다.
                                        </div>
                                        <div style="background: white; padding: 10px 12px; border-radius: 8px; border: 1px solid #ffd8d8;">
                                            😷 <b>신체 보호:</b> 젖은 수건이나 옷으로 코와 입을 막고, 자세를 낮춰 낮게 이동합니다.
                                        </div>
                                        <div style="background: white; padding: 10px 12px; border-radius: 8px; border: 1px solid #ffd8d8;">
                                            ⚡ <b>전원 차단:</b> 여유가 있을 경우 가스 밸브를 잠그고 메인 전원 스위치를 차단합니다.
                                        </div>
                                        <div style="background: white; padding: 10px 12px; border-radius: 8px; border: 1px solid #ffd8d8;">
                                            🏃 <b>대피 우선:</b> 소화기로 초기 진화가 어려운 경우 지체 없이 비상구를 통해 대피합니다.
                                        </div>
                                        <div style="background: white; padding: 10px 12px; border-radius: 8px; border: 1px solid #ffd8d8; font-weight: bold; color: #c92a2a;">
                                            🚫 <b>엘리베이터 이용 금지:</b> 대피 시에는 반드시 계단을 이용합니다.
                                        </div>
                                    </div>
                                </div>

                                <!-- 2) 실험 중 부상 발생 시 -->
                                <div style="background: #e7f5ff; border: 1px solid #a5d8ff; border-radius: 12px; padding: 18px;">
                                    <h3 style="margin: 0 0 14px 0; font-size: 15.5px; font-weight: 800; color: #1971c2; display: flex; align-items: center; gap: 6px;">
                                        <span>🩹</span> 2️⃣ 실험 중 부상 발생 시
                                    </h3>
                                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: #333; line-height: 1.6;">
                                        <div style="background: white; padding: 10px 12px; border-radius: 8px; border: 1px solid #d0ebff;">
                                            💧 <b>열상 / 화상:</b> 흐르는 시원한 물에 <b>15분 이상</b> 열을 식힌 후 보건실 또는 병원으로 이동합니다.
                                        </div>
                                        <div style="background: white; padding: 10px 12px; border-radius: 8px; border: 1px solid #d0ebff;">
                                            👁️ <b>화학물질 접촉:</b> 눈이나 피부에 튄 경우 즉시 세안기/비상 샤워기를 이용해 <b>15분 이상</b> 씻어냅니다.
                                        </div>
                                        <div style="background: white; padding: 10px 12px; border-radius: 8px; border: 1px solid #d0ebff;">
                                            👨‍🏫 <b>담당 교사 통보:</b> 즉시 담당 교사에게 알리고 가이드에 따라 응급처치를 받습니다.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 라이트박스(확대) 모달 -->
                <div id="emergency-lightbox-modal" style="
                    display: none;
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0, 0, 0, 0.88);
                    backdrop-filter: blur(4px);
                    z-index: 99999;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    box-sizing: border-box;
                " onclick="App.EmergencyManual.closeLightbox()">
                    <button onclick="App.EmergencyManual.closeLightbox()" style="
                        position: absolute;
                        top: 20px;
                        right: 24px;
                        background: rgba(255, 255, 255, 0.2);
                        color: white;
                        border: none;
                        width: 44px;
                        height: 44px;
                        border-radius: 50%;
                        font-size: 24px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255, 255, 255, 0.4)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
                        ✕
                    </button>
                    <img id="emergency-lightbox-img" src="" alt="확대 이미지" style="
                        max-width: 95%;
                        max-height: 92vh;
                        object-fit: contain;
                        border-radius: 8px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                    " onclick="event.stopPropagation()">
                </div>
            `;

        } catch (err) {
            console.error("EmergencyManual Init Error:", err);
            const container = document.getElementById('emergency-manual-container');
            if (container) container.innerHTML = `<div style="padding:20px; color:red;">오류가 발생했습니다: ${err.message}</div>`;
        }
    };

    EmergencyManual.openLightbox = function (src) {
        const modal = document.getElementById('emergency-lightbox-modal');
        const img = document.getElementById('emergency-lightbox-img');
        if (modal && img) {
            img.src = src;
            modal.style.display = 'flex';
        }
    };

    EmergencyManual.closeLightbox = function () {
        const modal = document.getElementById('emergency-lightbox-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    };

    EmergencyManual.scrollToSection = function (id) {
        const el = document.getElementById(id);
        const wrapper = document.getElementById('emergency-manual-scroll-wrapper');
        if (el) {
            if (wrapper) {
                const targetPos = el.offsetTop - 15;
                wrapper.scrollTo({ top: targetPos, behavior: 'smooth' });
            } else {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    EmergencyManual.printPage = function () {
        window.print();
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.EmergencyManual = EmergencyManual;
})();
