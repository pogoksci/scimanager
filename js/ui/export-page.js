(function () {
    const ExportPage = {
        init: function () {
            console.log("📤 ExportPage init");

            const btnExportKits = document.getElementById("btn-export-kits-csv");
            if (btnExportKits) {
                btnExportKits.addEventListener("click", async () => {
                    if (App.Utils && App.Utils.exportExperimentKits) {
                        // UI Feedback could be added here (e.g., disable button, show spinner)
                        const originalText = btnExportKits.innerHTML;
                        btnExportKits.disabled = true;
                        btnExportKits.innerHTML = `<span class="material-symbols-outlined">hourglass_empty</span><span>내보내는 중...</span>`;

                        try {
                            await App.Utils.exportExperimentKits();
                        } catch (err) {
                            console.error("Export failed:", err);
                            alert("내보내기 중 오류가 발생했습니다.");
                        } finally {
                            btnExportKits.disabled = false;
                            btnExportKits.innerHTML = originalText;
                        }
                    } else {
                        alert("내보내기 기능을 불러올 수 없습니다.");
                    }
                });
            }
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.ExportPage = ExportPage;
})();
