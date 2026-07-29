// Follows Supabase Edge Function conventions
// Deployment: supabase functions deploy sync-content --no-verify-jwt
import { serve } from "std/http/server.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DOMParser, Element } from "deno-dom";

const SAFETY_URL = "https://sites.google.com/view/pogokscience/%EA%B3%BC%ED%95%99%EC%8B%A4-%EC%95%88%EC%A0%84";
const MANUAL_URL = "https://sites.google.com/view/pogokscience/%EA%B3%BC%ED%95%99%EC%8B%A4-%EC%82%AC%EC%9A%A9%EC%84%A4%EB%AA%85%EC%84%9C";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            // Supabase API URL
            Deno.env.get("SUPABASE_URL") ?? "",
            // Supabase Service Role Key
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { target } = await req.json();

        if (!target) {
            throw new Error("Target parameter is required (safety or manual)");
        }

        let resultMsg = "";

        if (target === "safety") {
            resultMsg = await syncSafetyContent(supabaseClient);
        } else if (target === "manual") {
            resultMsg = await syncManualContent(supabaseClient);
        } else {
            throw new Error("Invalid target");
        }

        return new Response(
            JSON.stringify({ message: resultMsg }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});

async function syncSafetyContent(supabase: SupabaseClient) {
    console.log("Fetching Safety Page...");
    const response = await fetch(SAFETY_URL);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) throw new Error("Failed to parse HTML");

    const newRecords: { category: string; title: string; content_type: string; external_id: string; display_order: number; }[] = [];
    let displayOrder = 1;

    // 1. Scrape YouTube Videos
    const iframes = doc.querySelectorAll("iframe");
    Array.from(iframes).forEach((iframe: unknown) => {
        const el = iframe as Element;
        const src = el.getAttribute("src") || "";
        if (src.includes("youtube.com/embed/")) {
            const idMatch = src.match(/embed\/([^?]+)/);
            if (idMatch) {
                let title = "안전교육 동영상";

                // Heuristic: Check previous headings
                let curr = el.parentElement;
                for (let i = 0; i < 5; i++) {
                    if (!curr) break;
                    const prev = curr.previousElementSibling;
                    if (prev && (prev.tagName.match(/H[1-6]/) || prev.className.includes("text"))) {
                        title = prev.textContent.trim();
                        break;
                    }
                    curr = curr.parentElement;
                }

                newRecords.push({
                    category: "안전교육 동영상",
                    title: title || "동영상",
                    content_type: "video",
                    external_id: idMatch[1],
                    display_order: displayOrder++
                });
            }
        }
    });

    // 2. Scrape PDFs
    const links = doc.querySelectorAll("a");
    Array.from(links).forEach((a: unknown) => {
        const el = a as Element;
        const href = el.getAttribute("href") || "";
        if (href.includes("drive.google.com/file/d/")) {
            const idMatch = href.match(/\/d\/([^/]+)/);
            if (idMatch) {
                newRecords.push({
                    category: "안전 메뉴얼/서식",
                    title: el.textContent.trim() || "문서",
                    content_type: "pdf",
                    external_id: idMatch[1],
                    display_order: displayOrder++
                });
            }
        }
    });

    if (newRecords.length < 5) {
        throw new Error("Scraping found too few items (" + newRecords.length + "). Site structure may have changed.");
    }

    // Transaction
    const { error: delErr } = await supabase.from('safety_content').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) throw delErr;

    const { error: insErr } = await supabase.from('safety_content').insert(newRecords);
    if (insErr) throw insErr;

    return `Synced ${newRecords.length} safety items successfully.`;
}

async function syncManualContent(supabase: SupabaseClient, manualUrl?: string) {
    const targetUrl = manualUrl || MANUAL_URL;
    console.log(`Fetching Manual Page from: ${targetUrl}`);

    const response = await fetch(targetUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch site: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) throw new Error("Failed to parse HTML");

    const newRecords: { section_title: string; caption: string; image_url: string; display_order: number; }[] = [];
    let displayOrder = 1;
    let debugLog = "";

    // Ensure bucket exists (ignore error if exists)
    await supabase.storage.createBucket('lab_manual_images', { public: true });

    // Linear Traversal Strategy
    // Google Sites structure: <section> elements appear in order.
    // Some are headers (class lQAHbd), some are content content (class LS81yb or generic).

    // We will iterate all <section> elements in the document.
    const sections = doc.querySelectorAll('section');
    let currentSectionTitle = "일반"; // Default title if content appears before first header

    console.log(`Found ${sections.length} sections.`);
    debugLog += `Sections: ${sections.length}. `;

    const processedSrcs = new Set<string>();

    for (const section of Array.from(sections)) {
        const el = section as Element;

        // 1. Identify Section Header
        // The class 'lQAHbd' is highly specific to Google Sites section headers.
        if (el.className.includes('lQAHbd')) {
            const text = el.textContent.trim();
            if (text && text.length < 100) {
                currentSectionTitle = text;
                debugLog += `[NEW GROUP: ${currentSectionTitle}] `;
            }
            continue; // Header processed, move to next
        }

        // 2. Identify Content
        // Look for the grid container class 'LS81yb' inside this section
        const gridContainer = el.querySelector('.LS81yb');
        if (gridContainer) {
            // Found a content grid. Iterate its children (cells)
            // The grid container usually has direct children as cells.
            const cells = gridContainer.children;

            for (const cell of Array.from(cells)) {
                const cellEl = cell as Element;

                // Find Image in this cell
                const img = cellEl.querySelector('img');
                if (!img) continue; // Skip text-only cells

                let src = img.getAttribute('src') || img.getAttribute('data-src');
                if (!src) continue;

                if (src.includes("googleusercontent.com")) {
                    // Upgrade resolution
                    const hiResSrc = src.replace(/=w\d+$/, "") + "=w1280";

                    // Removed deduplication to support same image in different sections
                    // if (processedSrcs.has(hiResSrc)) continue;
                    // processedSrcs.add(hiResSrc);

                    // Find Caption
                    // Caption is usually in a sibling div or nested.
                    // Simple strategy: Get all text in this cell.
                    // Exclude the title/alt of the image itself if present in text (less likely in innerText)
                    let caption = cellEl.textContent.trim();

                    // Cleanup: Remove common trash text or URLs if mixed in
                    caption = caption.replace(/[\n\r]+/g, " ").trim();

                    // Fallback if empty (e.g. image only)
                    if (!caption) caption = "과학실 사진";

                    // Upload Logic
                    try {
                        const imgRes = await fetch(hiResSrc);
                        if (!imgRes.ok) continue;

                        const imgData = await imgRes.arrayBuffer();
                        const fileName = `manual_image_${displayOrder}.jpg`;

                        const { error: uploadError } = await supabase.storage
                            .from('lab_manual_images')
                            .upload(fileName, imgData, {
                                contentType: 'image/jpeg',
                                upsert: true
                            });

                        if (uploadError) {
                            console.error(`Upload failed: ${uploadError.message}`);
                            continue;
                        }

                        const { data: { publicUrl } } = supabase.storage
                            .from('lab_manual_images')
                            .getPublicUrl(fileName);

                        newRecords.push({
                            section_title: currentSectionTitle,
                            caption: caption,
                            image_url: publicUrl, // Use storage URL
                            display_order: displayOrder++
                        });
                        debugLog += `(Added to ${currentSectionTitle}) `;
                    } catch (err) {
                        console.error("Error processing image:", err);
                    }
                }
            }
        }
    }

    if (newRecords.length === 0) {
        console.log("0 items found.");
        return `No items found. Debug: ${debugLog}`;
    }

    // Replace all records
    const { error: delErr } = await supabase.from('lab_manual_content').delete().gte('display_order', 0);
    if (delErr) throw delErr;

    const { error: insErr } = await supabase.from('lab_manual_content').insert(newRecords);
    if (insErr) throw insErr;

    const uniqueSections = [...new Set(newRecords.map(r => r.section_title))];
    const sectionSummary = uniqueSections.join(", ");

    return `Synced ${newRecords.length} images across ${uniqueSections.length} sections: [${sectionSummary}].`;
}