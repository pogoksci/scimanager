(function () {
    globalThis.App = globalThis.App || {};
    globalThis.App.Utils = globalThis.App.Utils || {};

    // Initialize Supabase client (ensure SUPABASE_URL and SUPABASE_ANON_KEY are available globally or passed in)
    // Assuming window.supabaseClient is available from app-bootstrap.js

    async function syncExperimentKits() {
        const statusDiv = document.getElementById('sync-status');
        if (statusDiv) statusDiv.textContent = 'Reading CSV...';

        try {
            const response = await fetch('data/experiment_kit.csv');
            if (!response.ok) throw new Error('Failed to load CSV file');
            const csvText = await response.text();

            const rows = parseCSV(csvText);
            const kits = rows.map(row => {
                // Clean CAS numbers: remove single quotes, trim whitespace
                let cleanCas = row.kit_cas;
                if (cleanCas) {
                    cleanCas = cleanCas.replace(/'/g, '').replace(/"/g, '').trim();
                }

                if (!cleanCas || cleanCas === 'EMPTY') {
                    cleanCas = null;
                } else {
                    // Ensure comma separation is clean
                    cleanCas = cleanCas.split(',').map(c => c.trim()).filter(c => c).join(', ');
                }

                const cleanClass = row.kit_class ? row.kit_class.replace(/"/g, '').trim() : null;
                const finalClass = (cleanClass === 'EMPTY' || cleanClass === '') ? null : cleanClass;

                return {
                    kit_name: row.kit_name,
                    kit_class: finalClass,
                    kit_cas: cleanCas,
                    kit_person: row.kit_person || null
                };
            }).filter(kit => kit.kit_name); // Filter out empty rows

            if (statusDiv) statusDiv.textContent = `Found ${kits.length} kits. Syncing to Database...`;

            const { data: existingKits, error: fetchError } = await window.supabaseClient
                .from('experiment_kit')
                .select('kit_name, id');

            if (fetchError) throw fetchError;

            const existingMap = new Map(existingKits.map(k => [k.kit_name, k.id]));
            const upsertData = [];

            for (const kit of kits) {
                const id = existingMap.get(kit.kit_name);
                if (id) {
                    upsertData.push({ ...kit, id }); // Update existing
                } else {
                    upsertData.push(kit); // Insert new
                }
            }

            const { error } = await window.supabaseClient
                .from('experiment_kit')
                .upsert(upsertData, { onConflict: 'id' });

            if (error) throw error;

            if (statusDiv) statusDiv.textContent = 'Sync Complete!';
            alert('Experiment Kit Data Synced Successfully!');

        } catch (error) {
            console.error('Sync failed:', error);
            if (statusDiv) statusDiv.textContent = 'Sync Failed: ' + error.message;
            alert('Sync Failed: ' + error.message);
        }
    }

    function parseCSV(text) {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const row = {};
            let currentLine = lines[i];

            // Simple state machine for CSV parsing
            const values = [];
            let currentVal = '';
            let inQuotes = false;

            for (let char of currentLine) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentVal);
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal); // Last value

            row.kit_name = values[1]?.trim();
            row.kit_class = values[2]?.trim();
            row.kit_cas = values[3]?.trim();
            row.kit_person = values[4]?.trim();

            if (row.kit_name) result.push(row);
        }
        return result;
    }

    globalThis.App.Utils.syncExperimentKits = syncExperimentKits;
})();
