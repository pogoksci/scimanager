
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { parse } from "https://deno.land/x/xml@2.1.0/mod.ts";
import {
    supabase,
    corsHeaders,
    CAS_API_KEY,
    KOSHA_API_KEY,
} from "../_shared/utils.ts";

// ---- Types ----
interface KoshaChemListItem {
    casNo?: string;
    chemId?: string;
    chemNameKor?: string;
    enNo?: string;
}

interface KoshaMsdsItem {
    itemDetail?: string;
    msdsItemNameKor?: string;
    msdsItemNo?: string;
}

interface MsdsSection {
    section_number: number;
    content: string;
}

interface CasDetail {
    name?: string;
    molecularFormula?: string;
    molecularMass?: number;
    synonyms?: string[];
    experimentalProperties?: {
        name: string;
        property: string;
        sourceNumber: number;
    }[];
}

// ---- Helpers ----
function normalizeCas(input: unknown): string {
    const raw = String(input ?? "").trim();
    return raw.replace(/[^\d-]/g, "").replace(/-+/g, "-");
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function pick(obj: unknown, key: string): unknown {
    return isRecord(obj) ? obj[key] : undefined;
}

function toArray<T>(v: unknown): T[] {
    return Array.isArray(v) ? (v as T[]) : v == null ? [] : [v as T];
}

// ---- API Fetchers ----

// 1. CAS API (Basic Info)
async function fetchCasDetail(cas_rn: string): Promise<CasDetail> {
    try {
        const url = `https://commonchemistry.cas.org/api/detail?cas_rn=${encodeURIComponent(cas_rn)}`;
        const response = await fetch(url, {
            method: "GET",
            headers: { "X-API-KEY": CAS_API_KEY },
        });
        if (!response.ok) return {};
        return await response.json();
    } catch (e) {
        console.error("CAS API Error:", e);
        return {};
    }
}

// 2. KOSHA Chem ID
async function fetchKoshaChemId(cas_rn: string): Promise<KoshaChemListItem | null> {
    const url = new URL("https://msds.kosha.or.kr/openapi/service/msdschem/chemlist");
    url.searchParams.set("serviceKey", KOSHA_API_KEY);
    url.searchParams.set("searchWrd", cas_rn);
    url.searchParams.set("searchCnd", "1");

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const xml = await response.text();
        const doc = parse(xml);
        const responseNode = pick(doc, "response");
        const bodyNode = pick(responseNode, "body");
        const itemsNode = pick(bodyNode, "items");
        const itemNode = pick(itemsNode, "item");

        const list = toArray<KoshaChemListItem>(itemNode);
        if (list.length === 0) return null;

        const normalizedInput = normalizeCas(cas_rn);
        const match = list.find((it) => normalizeCas(it.casNo) === normalizedInput);
        return match ?? list[0] ?? null;
    } catch (e) {
        console.error("KOSHA Chem ID Error:", e);
        return null;
    }
}

// 3. KOSHA MSDS (All Sections)
async function fetchKoshaMsds(chemId: string): Promise<MsdsSection[]> {
    const sections = Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, "0"));
    const results: MsdsSection[] = [];

    for (const section of sections) {
        const url = `https://msds.kosha.or.kr/openapi/service/msdschem/chemdetail${section}?serviceKey=${KOSHA_API_KEY}&chemId=${chemId}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                results.push({ section_number: Number(section), content: "정보 없음" });
                continue;
            }
            const xml = await res.text();
            const doc = parse(xml);
            const responseNode = pick(doc, "response");
            const bodyNode = pick(responseNode, "body");
            const itemsNode = pick(bodyNode, "items");
            const itemNode = pick(itemsNode, "item");

            const list = toArray<KoshaMsdsItem>(itemNode);
            if (list.length === 0) {
                results.push({ section_number: Number(section), content: "정보 없음" });
                continue;
            }

            const structuredContent = list
                .map((it) => {
                    const no = it.msdsItemNo ?? "";
                    const name = it.msdsItemNameKor ?? "";
                    const rawDetail = String(it.itemDetail ?? "");
                    const detail = rawDetail
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/;/g, "\n")
                        .replace(/\|/g, "\n")
                        .trim() || "자료없음";
                    return `${no}|||${name}|||${detail}`;
                })
                .join(";;;");

            results.push({ section_number: Number(section), content: structuredContent });
        } catch (e) {
            console.error(`MSDS Section ${section} Error:`, e);
            results.push({ section_number: Number(section), content: "조회 오류" });
        }
    }
    return results;
}

// ---- Main Handler ----
serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { cas_rn } = await req.json();
        const normalizedCas = normalizeCas(cas_rn);

        if (!normalizedCas) {
            throw new Error("Invalid CAS Number");
        }

        console.log(`[kit-casimport] Processing CAS: ${normalizedCas}`);

        // 1. Fetch External Data
        const casData = await fetchCasDetail(normalizedCas);
        const koshaInfo = await fetchKoshaChemId(normalizedCas);

        let msdsData: MsdsSection[] = [];
        let nameKo = koshaInfo?.chemNameKor || null;
        let nameEn = casData.name || koshaInfo?.enNo || null; // enNo might not be name, but close enough if CAS fails

        if (koshaInfo?.chemId) {
            const chemId = koshaInfo.chemId.toString().padStart(6, "0");
            msdsData = await fetchKoshaMsds(chemId);
        }

        // Fallback if no info found
        if (!nameKo && !nameEn) {
            console.log(`[kit-casimport] No external data for ${normalizedCas}. Registering as placeholder.`);
            nameKo = normalizedCas; // Use CAS as name so it appears in lists
            nameEn = "Information Not Available";
        }

        // 2. Prepare Record
        const record = {
            cas_no: normalizedCas,
            name_ko: nameKo,
            name_en: nameEn,
            formula: casData.molecularFormula || null,
            molecular_weight: casData.molecularMass ? String(casData.molecularMass) : null,
            msds_data: {
                sections: msdsData,
                experimental_properties: casData.experimentalProperties || []
            }, // Storing as JSONB wrapper
        };

        // 3. Upsert to kit_chemicals
        const { error } = await supabase
            .from("kit_chemicals")
            .upsert(record, { onConflict: "cas_no" });

        if (error) {
            throw error;
        }

        return new Response(JSON.stringify({ success: true, data: record }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("[kit-casimport] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
