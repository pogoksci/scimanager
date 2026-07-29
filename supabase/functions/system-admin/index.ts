// /supabase/functions/system-admin/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/std@0.168.0/encoding/csv.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: Clean CSV Value
function clean(val: unknown): string | null {
    if (!val) return null;
    let s = String(val).trim();
    if (s === "" || s === "EMPTY") return null;
    if (s.startsWith("'")) {
        s = s.substring(1);
    }
    // Remove " ( ) characters (Excel formatting prevention) - Removed to preserve special characters
    // s = s.replace(/["()]/g, ""); 
    return s.trim();
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const reqData = await req.json();
        const { action, csv_content } = reqData;

        let resultData;

        // 1️⃣ SYNC HAZARD DATA (Truncate + Insert)
        if (action === 'sync_hazard_data') {
            if (!csv_content) throw new Error("No CSV content provided");

            // 0. Truncate Table
            const { error: rpcError } = await supabase.rpc('truncate_table', { table_name: 'HazardList' });
            if (rpcError) throw new Error(`Truncate failed: ${rpcError.message}`);

            // Parse CSV
            const rows = await parse(csv_content, { skipFirstRow: true });

            const chemicalMap = new Map();
            let processedCount = 0;

            for (const row of rows) {
                // Parse returns objects with header keys
                const r = row as any;

                const cas = clean(r['CAS']);
                if (!cas) continue;

                const regulationType = clean(r['구분']); // e.g. 특수건강진단대상 유해인자, 유독물질
                const standardValue = clean(r['기준농도']);
                let name = clean(r['물질']);

                if (name) name = name.replace(/^(\d+\)|[가-하]\.)\s*/, "");
                const normalizedCas = cas.replace(/\|\|\|/g, ", ");

                if (!chemicalMap.has(normalizedCas)) {
                    chemicalMap.set(normalizedCas, {
                        cas_nos: normalizedCas,
                        chem_name: name,
                        hazard_class: null,
                        school_hazardous_standard: null,
                        school_accident_precaution_standard: null,
                        special_health_standard: null,
                        toxic_standard: null,
                        permitted_standard: null,
                        restricted_standard: null,
                        prohibited_standard: null
                    });
                }
                const chemData = chemicalMap.get(normalizedCas);
                if (name && (!chemData.chem_name || name.length > chemData.chem_name.length)) {
                    chemData.chem_name = name;
                }
                if (regulationType) {
                    if (chemData.hazard_class) {
                        if (!chemData.hazard_class.includes(regulationType)) {
                            chemData.hazard_class += `, ${regulationType}`;
                        }
                    } else {
                        chemData.hazard_class = regulationType;
                    }
                }
                let mappedCol = null;
                // Logic to map 'regulationType' string to DB column
                // '구분' column in CSV holds values like "특수건강진단대상 유해인자", "유독물질", "제한물질" etc.
                if (regulationType) {
                    if (regulationType.includes("특수건강")) mappedCol = "special_health_standard";
                    else if (regulationType.includes("유독")) mappedCol = "toxic_standard";
                    else if (regulationType.includes("제한")) mappedCol = "restricted_standard";
                    else if (regulationType.includes("금지")) mappedCol = "prohibited_standard";
                    else if (regulationType.includes("허가")) mappedCol = "permitted_standard";
                    else if (regulationType.includes("사고대비")) mappedCol = "school_accident_precaution_standard";
                    // Note: 'school_hazardous_standard' might need mapping if it exists in CSV strictly
                }

                if (mappedCol) {
                    if (chemData[mappedCol]) chemData[mappedCol] += `, ${standardValue}`;
                    else chemData[mappedCol] = standardValue || "해당";
                }
                processedCount++;
            }

            const insertData = Array.from(chemicalMap.values());

            // Batch Insert (Clean Table)
            // Remove 'id' if present in object to let DB generate new Identity
            const cleanInsertData = insertData.map(({ id, ...rest }: any) => rest);

            const BATCH_SIZE = 1000;
            for (let i = 0; i < cleanInsertData.length; i += BATCH_SIZE) {
                const batch = cleanInsertData.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from("HazardList").insert(batch);
                if (error) throw error;
            }

            resultData = { processed: processedCount, upserted: cleanInsertData.length };
        }

        // 2️⃣ SYNC SUBSTANCE REF (Truncate + Insert)
        else if (action === 'sync_substance_ref') {
            if (!csv_content) throw new Error("No CSV content provided");

            // 0. Truncate Table
            const { error: rpcError } = await supabase.rpc('truncate_table', { table_name: 'SubstanceRef' });
            if (rpcError) throw new Error(`Truncate failed: ${rpcError.message}`);

            // Parse CSV
            const rows = await parse(csv_content, { skipFirstRow: true });

            const insertData = (rows as any[]).map((row: any) => {
                // CAS should be clean (remove Excel formatting artifact: quotes)
                const rawCas = clean(row.cas_ref);
                const cas = rawCas ? rawCas.replace(/["()]/g, "") : null;

                return {
                    cas_ref: cas,
                    chem_name_kor_ref: clean(row.chem_name_kor_ref),
                    substance_name_ref: clean(row.substance_name_ref),
                    molecular_formula_ref: clean(row.molecular_formula_ref),
                    molecular_mass_ref: row.molecular_mass_ref ? Number(row.molecular_mass_ref) : null,
                    valence_ref: clean(row.valence)
                };
            }).filter(item => item && item.cas_ref);

            // Batch Insert (Clean Table)
            // No need to fetch existing IDs since we truncated
            const BATCH_SIZE = 1000;
            const validData = insertData.filter(i => i !== null);

            for (let i = 0; i < validData.length; i += BATCH_SIZE) {
                const batch = validData.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from("SubstanceRef").insert(batch);
                if (error) throw error;
            }

            resultData = { count: validData.length };
        }

        // 3️⃣ SYNC REAGENT INFO (SubstanceRef -> Substance)
        else if (action === 'sync_reagent_info') {
            // 1. Fetch all SubstanceRef
            const { data: refRows, error: refError } = await supabase
                .from("SubstanceRef")
                .select("cas_ref, chem_name_kor_ref, substance_name_ref, molecular_formula_ref, molecular_mass_ref");

            if (refError) throw refError;

            const refCount = refRows?.length || 0;

            if (!refRows || refRows.length === 0) {
                return new Response(JSON.stringify({ status: "success", count: 0, refCount: 0, message: "No reference data found" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 2. Fetch all existing Substance to match
            const casList = refRows.map((r: any) => r.cas_ref).filter(Boolean);

            const { data: subRows, error: subError } = await supabase
                .from("Substance")
                .select("id, cas_rn, molecular_mass")
                .in("cas_rn", casList);

            if (subError) throw subError;
            const subCountInRef = subRows?.length || 0;

            let updatedCount = 0;
            const mismatchSamples: string[] = [];
            const BATCH_SIZE = 100;

            for (let i = 0; i < subRows.length; i += BATCH_SIZE) {
                const batch = subRows.slice(i, i + BATCH_SIZE);
                const updates = batch.map((sub: any) => {
                    const subCas = String(sub.cas_rn || "").trim().toLowerCase();
                    // Also normalize ref CAS in case they already have quotes in DB
                    const ref = refRows.find((r: any) => {
                        const rCas = String(r.cas_ref || "").trim().toLowerCase().replace(/["()]/g, "");
                        return rCas === subCas;
                    });

                    if (!ref) {
                        if (mismatchSamples.length < 5) mismatchSamples.push(sub.cas_rn);
                        return null;
                    }

                    return {
                        id: sub.id,
                        cas_rn: sub.cas_rn, // Inclusion of NOT NULL column for upsert
                        chem_name_kor_mod: ref.chem_name_kor_ref || null,
                        substance_name_mod: ref.substance_name_ref || null,
                        molecular_formula_mod: ref.molecular_formula_ref || null,
                        molecular_mass: sub.molecular_mass ? sub.molecular_mass : (ref.molecular_mass_ref ? Number(ref.molecular_mass_ref) : sub.molecular_mass)
                    };
                }).filter((u: any) => u !== null);

                if (updates.length > 0) {
                    const { error: upErr } = await supabase.from("Substance").upsert(updates);
                    if (upErr) throw upErr;
                    updatedCount += updates.length;
                }
            }

            resultData = {
                count: updatedCount,
                refTotal: refCount,
                subMatched: subCountInRef,
                mismatchSamples: mismatchSamples,
                refSample: refRows.length > 0 ? { keys: Object.keys(refRows[0]), firstCas: refRows[0].cas_ref } : null,
                subSample: subRows.length > 0 ? { keys: Object.keys(subRows[0]), firstCas: subRows[0].cas_rn } : null
            };
        }

        // 3️⃣ SYNC EXPERIMENT KIT (Upsert)
        else if (action === 'sync_experiment_kit') {
            if (!csv_content) throw new Error("No CSV content provided");

            // Parse CSV (Header: id, kit_name, kit_class, kit_cas)
            const rows = await parse(csv_content, { skipFirstRow: true });

            const upsertData = (rows as any[]).map((row: any) => {
                let rawCas = clean(row.kit_cas);
                if (rawCas) rawCas = rawCas.replace(/'/g, "").replace(/\s+/g, "");

                // Robust kit_person extraction (Korean/English headers)
                const rawPerson = row.kit_person || row['인원수'] || row['인원'];

                return {
                    id: row.id ? Number(row.id) : undefined,
                    kit_name: clean(row.kit_name),
                    kit_class: clean(row.kit_class),
                    kit_cas: rawCas,
                    kit_person: rawPerson ? Number(rawPerson) : null
                };
            }).filter((k: any) => k.kit_name);

            // Batch Upsert
            const BATCH_SIZE = 1000;
            for (let i = 0; i < upsertData.length; i += BATCH_SIZE) {
                const batch = upsertData.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from("experiment_kit").upsert(batch, { onConflict: 'id' });
                if (error) throw error;
            }
            resultData = { count: upsertData.length };
        }

        // 3️⃣ RESET DATABASE
        else if (action === 'reset_database') {
            // 1. Storage - Delete All Files in ALL Buckets
            const buckets = [
                "msds-pdf",
                "tools-photo",
                "equipment-cabinets",
                "kit-photos",
                "cabinet-photos",
                "reagent-photos"
            ];

            let totalDeleted = 0;

            for (const bucket of buckets) {
                let hasFiles = true;

                while (hasFiles) {
                    // List files in the bucket root
                    const { data: files, error: listError } = await supabase.storage.from(bucket).list(undefined, { limit: 100 });

                    if (listError) {
                        console.warn(`Error listing bucket ${bucket}: ${listError.message}`);
                        // Don't throw, try to continue with other buckets
                        break;
                    }

                    if (!files || files.length === 0) {
                        hasFiles = false;
                        break;
                    }

                    const filesToRemove = files.map((f: any) => f.name);
                    const { error: removeError } = await supabase.storage.from(bucket).remove(filesToRemove);

                    if (removeError) {
                        console.warn(`Error deleting from bucket ${bucket}: ${removeError.message}`);
                        break;
                    }

                    totalDeleted += files.length;

                    // Stop if we fetched fewer than limit (likely no more files)
                    if (files.length < 100) {
                        hasFiles = false;
                    }
                }
            }

            // 2. RPC Reset
            const { error: rpcError } = await supabase.rpc('reset_all_data');
            if (rpcError) throw rpcError;

            resultData = { deletedFiles: totalDeleted, success: true };
        }

        // 4️⃣ DELETE INVENTORY (Orphan Cleanup)
        else if (action === 'delete_inventory') {
            const { inventory_id } = reqData;
            if (!inventory_id) throw new Error("inventory_id is required");

            // 1. Get Inventory Details for File Cleanup
            const { data: item, error: fetchError } = await supabase
                .from("Inventory")
                .select("id, substance_id, photo_url_320, photo_url_160, msds_pdf_url, msds_pdf_hash")
                .eq("id", inventory_id)
                .single();

            if (fetchError || !item) throw new Error("Inventory item not found");

            // 2. File Cleanup Check
            const filesToDelete = { msds: false, photos: [] as string[] };

            // Check MSDS Hash Usage
            if (item.msds_pdf_hash && item.msds_pdf_url) {
                const { count } = await supabase
                    .from("Inventory")
                    .select("*", { count: "exact", head: true })
                    .eq("msds_pdf_hash", item.msds_pdf_hash)
                    .neq("id", inventory_id); // Exclude self

                if (count === 0) {
                    // Safe to delete MSDS
                    filesToDelete.msds = true;
                    // Extract path from URL (e.g., .../msds-pdf/filename.pdf)
                    const urlObj = new URL(item.msds_pdf_url);
                    const path = decodeURIComponent(urlObj.pathname.split("/public/msds-pdf/")[1]);
                    if (path) {
                        const { error: rmErr } = await supabase.storage.from("msds-pdf").remove([path]);
                        if (rmErr) console.warn("MSDS delete error:", rmErr);
                    }
                }
            }

            // Photo Cleanup (Always unique to inventory usually, but let's check or just delete if standard path)
            // Photos are stored as `reagent-photos/inventoryId_timestammp.jpg`
            if (item.photo_url_320) {
                const p = decodeURIComponent(new URL(item.photo_url_320).pathname.split("/public/reagent-photos/")[1]);
                if (p) filesToDelete.photos.push(p);
            }
            if (item.photo_url_160) {
                const p = decodeURIComponent(new URL(item.photo_url_160).pathname.split("/public/reagent-photos/")[1]);
                if (p) filesToDelete.photos.push(p);
            }

            if (filesToDelete.photos.length > 0) {
                await supabase.storage.from("reagent-photos").remove(filesToDelete.photos);
            }

            // 3. Delete Inventory
            const { error: delError } = await supabase
                .from("Inventory")
                .delete()
                .eq("id", inventory_id);
            if (delError) throw delError;

            // 4. Orphan Substance Check
            // Check if any inventory remains for this substance
            const { count: remaining } = await supabase
                .from("Inventory")
                .select("*", { count: "exact", head: true })
                .eq("substance_id", item.substance_id);

            let substanceDeleted = false;
            if (remaining === 0) {
                // Delete Substance (Cascade triggers will handle children like Synonyms, Properties)
                const { error: subDelError } = await supabase
                    .from("Substance")
                    .delete()
                    .eq("id", item.substance_id);

                if (!subDelError) substanceDeleted = true;
            }

            resultData = {
                inventory_deleted: true,
                files_removed: filesToDelete,
                substance_deleted: substanceDeleted
            };
        }

        // 5️⃣ UPDATE SUBSTANCE (Admin Override)
        else if (action === 'update_substance') {
            const { substance_id, chem_name_kor_mod, substance_name_mod, molecular_formula_mod, molecular_mass } = reqData;
            if (!substance_id) throw new Error("substance_id is required");

            const updates: any = {};
            if (chem_name_kor_mod !== undefined) updates.chem_name_kor_mod = chem_name_kor_mod;
            if (substance_name_mod !== undefined) updates.substance_name_mod = substance_name_mod;
            if (molecular_formula_mod !== undefined) updates.molecular_formula_mod = molecular_formula_mod;
            if (molecular_mass !== undefined) updates.molecular_mass = molecular_mass;

            if (Object.keys(updates).length === 0) throw new Error("No update fields provided");

            const { data, error } = await supabase
                .from("Substance")
                .update(updates)
                .eq("id", substance_id)
                .select()
                .single();

            if (error) throw error;
            resultData = data;
        }

        else {
            throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ success: true, data: resultData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        // Return 200 with error field so invoke() doesn't throw generic error,
        // allowing client to see the actual error message.
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
