// ================================================================
// /js/utils/export.js — CSV Export Utilities
// ================================================================

(function () {
    console.log("📤 App.Utils.Export 모듈 로드됨");

    globalThis.App = globalThis.App || {};
    globalThis.App.Utils = globalThis.App.Utils || {};

    /**
     * Generic CSV Export Function
     * @param {string} filename - The name of the file to download (e.g., 'data.csv')
     * @param {Array<Object>} data - Array of objects to export
     * @param {Array<string>} columns - List of keys to include as columns
     */
    function exportToCSV(filename, data, columns) {
        if (!data || !data.length) {
            alert("내보낼 데이터가 없습니다.");
            return;
        }

        // 1. Create Header Row
        const header = columns.join(",");

        // 2. Create Data Rows
        const rows = data.map(row => {
            return columns.map(col => {
                let val = row[col] === null || row[col] === undefined ? "" : row[col];
                // Escape quotes and wrap in quotes if contains comma or newline
                val = String(val).replace(/"/g, '""');
                if (val.includes(",") || val.includes("\n") || val.includes('"')) {
                    val = `"${val}"`;
                }
                return val;
            }).join(",");
        });

        // 3. Combine with BOM for Excel compatibility (UTF-8)
        const csvContent = "\uFEFF" + [header, ...rows].join("\n");

        // 4. Create Blob and Download Link
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Export Experiment Kits Catalog
     */
    async function exportExperimentKits() {
        try {
            const supabase = App.supabase;
            if (!supabase) throw new Error("Supabase client not found");

            // Fetch all data from experiment_kit
            const { data, error } = await supabase
                .from('experiment_kit')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            // Define columns to export
            const columns = ['id', 'kit_name', 'kit_class', 'kit_cas'];

            // Generate Filename with Date
            const dateStr = new Date().toISOString().slice(0, 10);
            const filename = `experiment_kit_${dateStr}.csv`;

            exportToCSV(filename, data, columns);

        } catch (e) {
            console.error("Export failed:", e);
            alert("데이터 내보내기 중 오류가 발생했습니다.");
        }
    }

    // Expose functions
    App.Utils.exportToCSV = exportToCSV;
    App.Utils.exportExperimentKits = exportExperimentKits;

})();
