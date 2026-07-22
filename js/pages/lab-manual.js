(function () {
    const LabManual = {};

    let MANUAL_DATA = [];

    LabManual.init = async function () {
        try {
            console.log("📖 Lab Manual Init");
            const mainContent = document.getElementById('lab-manual-container');
            if (!mainContent) {
                console.error("❌ lab-manual-container not found!");
                return;
            }

            // 1. Force Body Scroll Unlock
            document.body.style.overflowY = "auto";
            document.body.style.height = "auto";
            document.body.style.overscrollBehaviorY = "auto";

            // Show Loading State
            mainContent.innerHTML = '<div style="padding:40px; text-align:center;">데이터를 불러오는 중입니다...</div>';

            if (!App.supabase) {
                throw new Error("Supabase Client is not initialized.");
            }

            // 2. Fetch Data from DB
            await fetchContentFromDB();

            mainContent.innerHTML = `
                <div style="
                    height: 100vh; 
                    overflow-y: auto; 
                    -webkit-overflow-scrolling: touch; 
                    padding: 20px; 
                    box-sizing: border-box; 
                    padding-bottom: 120px;
                ">
                    <div style="max-width: 1000px; margin: 0 auto;">
                        <div class="safety-header-row">
                            <h1 class="safety-section-title">🧪 과학실 사용 설명서</h1>
                            <button id="btn-sync-manual" style="display:none; padding:8px 16px; background:#f44336; color:white; border:none; border-radius:4px; cursor:pointer;">
                                🔄 최신 콘텐츠 동기화
                            </button>
                        </div>
                        <p style="color:#666; margin-bottom:30px;">과학실 시설 현황과 안전 장비 위치를 확인하세요.</p>
                        <div style="display:flex; flex-direction:column; gap:40px;">
                            ${renderManuals()}
                        </div>
                    </div>
                </div>
            `;

            checkAdminRole();
        } catch (err) {
            console.error("LabManual Init Error:", err);
            const mainContent = document.getElementById('lab-manual-container');
            if (mainContent) mainContent.innerHTML = `<div style="padding:20px; color:red;">오류가 발생했습니다: ${err.message}</div>`;
            alert("오류 발생: " + err.message);
        }
    };

    function checkAdminRole() {
        if (App.Auth && App.Auth.isAdmin && App.Auth.isAdmin()) {
            const btn = document.getElementById('btn-sync-manual');
            if (btn) {
                btn.style.display = 'block';
                btn.onclick = triggerContentSync;
            }
        }
    }

    async function triggerContentSync() {
        const defaultUrl = "https://sites.google.com/view/pogokscience/%EA%B3%BC%ED%95%99%EC%8B%A4-%EC%82%AC%EC%9A%A9%EC%84%A4%EB%AA%85%EC%84%9C";
        const manualUrl = prompt("동기화할 구글 사이트 주소를 입력하세요:", defaultUrl);

        if (!manualUrl) return; // Cancelled
        if (!confirm("입력한 사이트의 최신 내용으로 동기화하시겠습니까? (시간이 다소 소요될 수 있습니다)")) return;

        const btn = document.getElementById('btn-sync-manual');
        btn.disabled = true;
        btn.textContent = "동기화 중...";

        const { data, error } = await App.supabase.functions.invoke('sync-content', {
            body: { target: 'manual', url: manualUrl }
        });

        if (error) {
            alert("동기화 실패: " + error.message);
            btn.textContent = "🔄 최신 콘텐츠 동기화";
            btn.disabled = false;
        } else {
            alert(data.message || "동기화 완료!");
            location.reload();
        }
    }

    async function fetchContentFromDB() {
        const { data, error } = await App.supabase
            .from('lab_manual_content')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) {
            console.error("DB Fetch Error:", error);
            alert("콘텐츠를 불러오는데 실패했습니다.");
            return;
        }

        // Group by section_title
        const groups = {};
        data.forEach(item => {
            if (!groups[item.section_title]) groups[item.section_title] = [];
            groups[item.section_title].push({
                caption: item.caption,
                src: item.image_url
            });
        });

        // Convert to array
        // Order keys manually if needed, or rely on insert order if seeded correctly.
        // Or specific logic to sort keys. For now, rely on seeded order implicitly or basic object iteration
        // Better: Find unique Titles in valid order from data.
        const uniqueTitles = [...new Set(data.map(d => d.section_title))];

        MANUAL_DATA = uniqueTitles.map(title => ({
            title: title,
            items: groups[title]
        }));
    }

    function renderManuals() {
        return MANUAL_DATA.map(group => `
            <div>
                <h2 class="manual-section-title">
                    ${group.title}
                </h2>
                <div class="manual-grid">
                    ${group.items.map(item => `
                        <div class="manual-card">
                            <div class="manual-card-img-wrapper">
                                <img src="${item.src}" alt="${item.caption}" loading="lazy" 
                                    class="manual-card-img"
                                    onclick="window.open('${item.src}', '_blank')">
                            </div>
                            <div class="manual-card-content">
                                <h3 class="manual-card-text">${item.caption}</h3>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.LabManual = LabManual;
})();
