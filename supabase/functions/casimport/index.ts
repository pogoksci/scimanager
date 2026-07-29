
/// <reference lib="deno.ns" />
import { parse } from "x/xml";
import {
  supabase,
  corsHeaders,
  handleOptions,
  logError,
  CAS_API_KEY,
  KOSHA_API_KEY,
  KREACH_API_KEY,
} from "../_shared/utils.ts";

// ---- XML 파싱 유틸 & 공통 함수 ----
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function pick(obj: unknown, key: string): unknown {
  return isRecord(obj) ? obj[key] : undefined;
}

function toArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : v == null ? [] : [v as T];
}

function normalizeCas(input: unknown): string {
  const raw = String(input ?? "").trim();
  return raw.replace(/[^\d-]/g, "").replace(/-+/g, "-");
}

function toNumeric(val: any): number | null {
  if (val === null || val === undefined || String(val).trim() === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// ---- KOSHA / K-REACH API 응답 타입 정의 ----
interface KoshaChemListItem {
  casNo?: string;
  chemId?: string;
  chemNameKor?: string;
  enNo?: string;
  keNo?: string;
  unNo?: string;
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

interface NcisType {
  sbstnClsfTypeNm?: string;
  unqNo?: string;
  contInfo?: string;
  excpInfo?: string;
  ancmntYmd?: string;
  ancmntInfo?: string;
}

interface NcisItem {
  sbstnId?: string;
  casNo?: string;
  korexst?: string;
  sbstnNm2Kor?: string; // Added for synonyms
  typeList?: {
    type?: NcisType | NcisType[];
  };
}

interface KreachItem {
  sbstnClsfTypeNm: string | null;
  unqNo: string | null;
  contInfo: string | null;
  ancmntInfo: string | null;
  ancmntYmd: string | null;
}

interface CasDetail {
  name?: string;
  molecularFormula?: string;
  molecularMass?: number;
  synonyms?: string[];
  uri?: string;
  inchi?: string;
  inchiKey?: string;
  canonicalSmile?: string;
  smile?: string;
  images?: string[];
  experimentalProperties?: {
    name: string;
    property: string;
    sourceNumber: number;
  }[];
  propertyCitations?: {
    sourceNumber: number;
    source: string;
    docUri: string;
  }[];
  replacedRns?: string[];
  hasMolfile?: boolean;
}

/* ------------------------------------------------------------------
   🔎 외부 API 조회 함수들
------------------------------------------------------------------ */

// CAS
async function fetchCasDetail(cas_rn: string): Promise<CasDetail> {
  const url = `https://commonchemistry.cas.org/api/detail?cas_rn=${encodeURIComponent(cas_rn)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "X-API-KEY": CAS_API_KEY },
  });
  if (!response.ok) throw new Error(`CAS API 요청 실패 (${response.status})`);
  return response.json();
}

// KOSHA → chemId
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
    console.error("KOSHA chemId 조회 오류:", e);
    return null;
  }
}

// KOSHA → 16개 MSDS section (or specific section)
async function fetchKoshaMsds(chemId: string, targetSection?: string): Promise<MsdsSection[]> {
  const sections = targetSection ? [targetSection] : Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, "0"));
  const results: MsdsSection[] = [];

  for (const section of sections) {
    const url =
      `https://msds.kosha.or.kr/openapi/service/msdschem/chemdetail${section}?serviceKey=${KOSHA_API_KEY}&chemId=${chemId}`;
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

      // 구조화된 데이터 생성: 번호|||항목명|||내용;;;번호|||항목명|||내용...
      const structuredContent = list
        .map((it) => {
          const no = it.msdsItemNo ?? "";
          const name = it.msdsItemNameKor ?? "";
          const detail =
            String(it.itemDetail || "")
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
      console.error(`MSDS 섹션 ${section} 조회 오류:`, e);
      results.push({ section_number: Number(section), content: "조회 오류" });
    }
  }
  return results;
}

// NCIS (National Chemicals Information System) - New API
async function fetchKreachInfo(cas_rn: string): Promise<{ items: KreachItem[]; synonyms: string[] }> {
  // https://apis.data.go.kr/B552584/kecoapi/ncissbstn/chemSbstnList
  const url = `https://apis.data.go.kr/B552584/kecoapi/ncissbstn/chemSbstnList?serviceKey=${KREACH_API_KEY}&pageNo=1&numOfRows=10&searchGubun=2&searchNm=${encodeURIComponent(
    cas_rn,
  )}&returnType=XML`;

  const classifications: KreachItem[] = [];
  const synonymsSet = new Set<string>();

  try {
    const response = await fetch(url);
    if (!response.ok) return { items: [], synonyms: [] };

    const xml = await response.text();
    const doc = parse(xml);

    const responseNode = pick(doc, "response");
    const bodyNode = pick(responseNode, "body");
    const itemsNode = pick(bodyNode, "items");
    const itemNode = pick(itemsNode, "item");

    const list = toArray<NcisItem>(itemNode);
    // API returns items matching the search. Filter by CAS just in case.
    const filtered = list.filter((it) => normalizeCas(it.casNo) === normalizeCas(cas_rn));

    if (filtered.length === 0) return { items: [], synonyms: [] };

    // 1. Collect all types and synonyms from all matched items
    const allTypes: NcisType[] = [];
    for (const item of filtered) {
      // Synonyms (sbstnNm2Kor) - split by semicolon
      if (item.sbstnNm2Kor) {
        const syns = item.sbstnNm2Kor.split(";").map(s => s.trim()).filter(s => s.length > 0);
        syns.forEach(s => synonymsSet.add(s));
      }

      const types = item.typeList?.type;
      if (types) {
        allTypes.push(...toArray<NcisType>(types));
      }
    }

    // 2. Group by classification type
    const grouped = new Map<string, NcisType[]>();
    for (const t of allTypes) {
      const name = t.sbstnClsfTypeNm;
      if (!name) continue;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)!.push(t);
    }

    // 3. Merge logic: For each type, pick the best entry
    for (const [typeNm, candidates] of grouped) {
      // Sort candidates
      // Priority 1: ancmntYmd (descending)
      // Priority 2: content length (descending) - proxy for "more info"
      candidates.sort((a, b) => {
        const dateA = String(a.ancmntYmd || "").trim();
        const dateB = String(b.ancmntYmd || "").trim();

        if (dateA !== dateB) {
          // If one has date and other doesn't, the one with date wins
          if (!dateA) return 1;
          if (!dateB) return -1;
          // Both have dates, compare string (YYYYMMDD)
          return dateB.localeCompare(dateA);
        }

        // Dates are equal or both empty -> compare content length
        const contentA = (a.contInfo || "") + (a.ancmntInfo || "");
        const contentB = (b.contInfo || "") + (b.ancmntInfo || "");
        return contentB.length - contentA.length;
      });

      const best = candidates[0];

      classifications.push({
        sbstnClsfTypeNm: typeNm,
        unqNo: best.unqNo || null,
        contInfo: best.contInfo || null,
        ancmntInfo: best.ancmntInfo || null,
        ancmntYmd: best.ancmntYmd ? String(best.ancmntYmd).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : null,
      });
    }

  } catch (e) {
    console.error("NCIS 조회 오류:", e);
  }
  return { items: classifications, synonyms: Array.from(synonymsSet) };
}

/* ------------------------------------------------------------------
   🔄 POST: MSDS 업데이트 확인 (Check & Update)
------------------------------------------------------------------ */
async function handleCheckUpdate(req: Request) {
  const body = await req.json().catch(() => ({}));
  const cas_rn = normalizeCas(body?.cas_rn);

  if (!cas_rn) throw new Error("CAS 번호가 유효하지 않습니다.");

  // 1. Substance 조회 (ID, last_msds_check, kosha_chem_id)
  const { data: substance, error: subErr } = await supabase
    .from("Substance")
    .select("id, last_msds_check, kosha_chem_id")
    .eq("cas_rn", cas_rn)
    .maybeSingle();

  if (subErr || !substance) throw new Error("해당 CAS 번호의 물질을 찾을 수 없습니다.");

  // 2. 7일 스로틀링 체크
  if (substance.last_msds_check) {
    const lastCheck = new Date(substance.last_msds_check);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastCheck.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays < 7) {
      return new Response(JSON.stringify({ status: "skipped", reason: "recent_check", last_check: substance.last_msds_check }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 3. DB의 MSDS 16번 항목 조회
  const { data: dbMsds } = await supabase
    .from("MSDS")
    .select("content")
    .eq("substance_id", substance.id)
    .eq("section_number", 16)
    .maybeSingle();

  // 4. KOSHA 실시간 데이터 조회 (16번 항목)
  // kosha_chem_id가 없으면 다시 조회
  let chemId = substance.kosha_chem_id;
  if (!chemId) {
    const koshaData = await fetchKoshaChemId(cas_rn);
    chemId = koshaData?.chemId ? koshaData.chemId.toString().padStart(6, "0") : null;
    if (chemId) {
      await supabase.from("Substance").update({ kosha_chem_id: chemId }).eq("id", substance.id);
    }
  }

  if (!chemId) {
    // KOSHA ID를 못 찾으면 업데이트 불가 -> last_msds_check만 갱신
    await supabase.from("Substance").update({ last_msds_check: new Date().toISOString() }).eq("id", substance.id);
    return new Response(JSON.stringify({ status: "skipped", reason: "no_kosha_id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const liveMsdsList = await fetchKoshaMsds(chemId, "16");
  const liveContent = liveMsdsList[0]?.content || "";

  // 5. 날짜 추출 및 비교
  // 날짜 형식 예: 2023-01-01, 2023.01.01 등. "개정일자", "작성일자" 등의 키워드 뒤에 나오는 날짜를 찾음.
  const extractDate = (text: string): string | null => {
    // YYYY-MM-DD or YYYY.MM.DD
    const matches = text.match(/(\d{4})[-.](\d{2})[-.](\d{2})/g);
    if (!matches) return null;
    // 가장 최신 날짜 반환
    return matches.sort().pop() || null;
  };

  const dbDate = dbMsds ? extractDate(dbMsds.content) : null;
  const liveDate = extractDate(liveContent);

  console.log(`[CheckUpdate] CAS: ${cas_rn}, DB Date: ${dbDate}, Live Date: ${liveDate}`);
  let updated = false;

  // 라이브 날짜가 있고, (DB 날짜가 없거나 라이브가 더 최신이면) 업데이트 진행
  if (liveDate && (!dbDate || liveDate > dbDate)) {
    console.log("🚀 New version found. Updating MSDS...");

    // 전체 섹션 다시 조회
    const allSections = await fetchKoshaMsds(chemId);

    if (allSections.length > 0) {
      // 기존 MSDS 삭제
      await supabase.from("MSDS").delete().eq("substance_id", substance.id);

      // 새 MSDS 삽입
      const { error: insertErr } = await supabase.from("MSDS").insert(
        allSections.map((d) => ({ substance_id: substance.id, ...d }))
      );

      if (!insertErr) updated = true;
      else console.error("MSDS Insert Error:", insertErr);
    }
  }

  // 6. last_msds_check 갱신
  await supabase.from("Substance").update({ last_msds_check: new Date().toISOString() }).eq("id", substance.id);

  return new Response(JSON.stringify({ status: updated ? "updated" : "latest", dbDate, liveDate }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ------------------------------------------------------------------
   📌 POST: 신규 시약 / 재고 등록
------------------------------------------------------------------ */
async function handlePostInventory(req: Request) {
  const body = await req.json().catch(() => ({}));
  const cas_rnsInput = body?.cas_rns ?? body?.casRns ?? [];
  const inventoryDetails = body?.inventoryDetails ?? {};
  const cas_rn = normalizeCas(Array.isArray(cas_rnsInput) ? cas_rnsInput[0] : cas_rnsInput);

  if (!cas_rn) throw new Error("CAS 번호가 유효하지 않습니다.");

  // ----------------------------------------------------------------
  // 🆕 Placeholder Handling (Bypass External APIs)
  // ----------------------------------------------------------------
  if (cas_rn.startsWith("NC-")) {
    console.log(`[Placeholder] Skipping external APIs for ${cas_rn}`);

    // Check Existence
    const { data: existing, error: findErr } = await supabase
      .from("Substance")
      .select("id")
      .eq("cas_rn", cas_rn)
      .maybeSingle();

    if (findErr) throw findErr;

    let substanceId = existing?.id;

    if (!substanceId) {
      // Create new placeholder
      const { data: newSub, error: createErr } = await supabase
        .from("Substance")
        .insert({
          cas_rn: cas_rn,
          chem_name_en: "Unidentified Substance", // Default Name
          chem_name_kor: "미확인 물질", // Default Name
          is_placeholder: true
        })
        .select("id")
        .single();

      if (createErr) throw createErr;
      substanceId = newSub.id;
    }

    return new Response(
      JSON.stringify({
        message: "Placeholder processed successfully",
        substance: { id: substanceId, cas_rn: cas_rn }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 1. Fetch External Data ALWAYS
  let casData: Partial<CasDetail> = {};
  try {
    casData = await fetchCasDetail(cas_rn);
  } catch (e) {
    console.error("CAS API 오류:", e);
  }

  // KOSHA / NCIS Data
  let chemNameKor: string | null = null;
  let enNo: string | null = null;
  let keNo: string | null = null;
  let unNo: string | null = null;
  let chemId: string | null = null;
  try {
    const kData = await fetchKoshaChemId(cas_rn);
    if (kData) {
      keNo = kData.keNo || null;
      chemNameKor = kData.chemNameKor || null;
      enNo = kData.enNo || null;
      unNo = kData.unNo || null;
      chemId = kData.chemId ? kData.chemId.toString().padStart(6, "0") : null;
    }
  } catch (e) {
    console.error("KOSHA API 오류:", e);
  }

  // 2. Check Existence
  let substanceId: number | null = null;
  let isNew = false;

  const { data: existing, error: existErr } = await supabase
    .from("Substance")
    .select("id")
    .eq("cas_rn", cas_rn)
    .maybeSingle();

  if (existErr) throw new Error(`Substance 조회 오류: ${existErr.message}`);

  const subData = {
    cas_rn,
    substance_name: casData.name ?? null,
    uri: casData.uri ?? null,
    inchi: casData.inchi ?? null,
    inchikey: casData.inchiKey ?? null,
    canonical_smiles: casData.canonicalSmile ?? null,
    smile: casData.canonicalSmile ?? null,
    molecular_formula: casData.molecularFormula ?? null,
    molecular_mass: toNumeric(casData.molecularMass),
    chem_name_kor: chemNameKor,
    en_no: enNo,
    ke_no: keNo,
    un_no: unNo,
    kosha_chem_id: chemId,
    svg_image: casData.images?.[0] ?? null,
    has_molfile: casData.hasMolfile ?? false,
    chem_name_kor_mod: null,
    substance_name_mod: null,
    molecular_formula_mod: null,
  };

  // 🆕 Check SubstanceRef for Overrides
  const { data: refData } = await supabase
    .from("SubstanceRef")
    .select("chem_name_kor_ref, substance_name_ref, molecular_formula_ref, molecular_mass_ref, valence_ref")
    .eq("cas_ref", cas_rn)
    .maybeSingle();

  if (refData) {
    console.log(`[CASIMPORT] RefData Found for ${cas_rn}:`, refData);
    if (refData.chem_name_kor_ref) subData.chem_name_kor_mod = refData.chem_name_kor_ref;
    if (refData.substance_name_ref) subData.substance_name_mod = refData.substance_name_ref;
    if (refData.molecular_formula_ref) subData.molecular_formula_mod = refData.molecular_formula_ref;
  } else {
    console.log(`[CASIMPORT] No RefData for ${cas_rn}`);
  }

  // Fallback molecular mass from SubstanceRef if API fails or empty
  if (!subData.molecular_mass && refData?.molecular_mass_ref) {
    subData.molecular_mass = Number(refData.molecular_mass_ref);
    console.log(`[CASIMPORT] Molecular Mass Fallback from RefData: ${subData.molecular_mass}`);
  }

  if (existing) {
    substanceId = existing.id;
    // Update Substance
    await supabase.from("Substance").update(subData).eq("id", substanceId);

    // Clear related tables for re-insertion (Properties, Citations, HazardClassifications)
    // Note: Synonyms and ReplacedRns are handled via MERGE to preserve IDs and manual entries.
    await supabase.from("Properties").delete().eq("substance_id", substanceId);
    await supabase.from("Citations").delete().eq("substance_id", substanceId);
    await supabase.from("Citations").delete().eq("substance_id", substanceId);

  } else {
    // Insert Substance
    const { data: newSub, error: createErr } = await supabase
      .from("Substance")
      .insert(subData)
      .select("id")
      .single();

    if (createErr || !newSub) {
      throw new Error(`Substance 생성 실패: ${createErr?.message || "데이터 없음"}`);
    }

    substanceId = newSub.id;
    isNew = true;
  }

  // 3. Insert Related Data (Common)
  const casSynonyms = (casData.synonyms || []).slice(0, 5);
  const { items: hazardItems, synonyms: ncisSynonyms } = await fetchKreachInfo(cas_rn);

  // HazardClassifications (Delete & Insert only if new data exists)
  if (hazardItems && hazardItems.length > 0) {
    // 1. Delete existing
    await supabase.from("HazardClassifications").delete().eq("substance_id", substanceId);

    // 2. Insert new
    const { error: hazardErr } = await supabase.from("HazardClassifications").insert(
      hazardItems.map((item) => ({
        substance_id: substanceId,
        sbstnClsfTypeNm: item.sbstnClsfTypeNm,
        unqNo: item.unqNo,
        contInfo: item.contInfo,
        ancmntInfo: item.ancmntInfo,
        ancmntYmd: item.ancmntYmd,
      }))
    );

    if (hazardErr) {
      console.error(`HazardClassifications insert failed for ${cas_rn}:`, hazardErr);
    }
  }

  // ----------------------------------------------------------------
  // 🆕 Extract School Standards from HazardClassifications
  // ----------------------------------------------------------------
  // Logic:
  // 1. "인체등유해성물질" -> school_hazardous_chemical_standard
  // 2. "사고대비물질" -> school_accident_precaution_chemical_standard
  // Extract concentration from contInfo (e.g., "1% 이상" -> "1%")

  const extractConcentration = (text: string | null): string | null => {
    if (!text) return null;
    // Match percentage pattern (e.g., "25%", "1.5 %")
    const match = text.match(/(\d+(\.\d+)?)\s*%/);
    return match ? `${match[1]}%` : null;
  };

  const updatePayload: Record<string, string | number | null | undefined> = {};

  if (hazardItems && hazardItems.length > 0) {
    const hazardousItem = hazardItems.find(item => item.sbstnClsfTypeNm === "인체등유해성물질");
    if (hazardousItem) {
      const val = extractConcentration(hazardousItem.contInfo);
      if (val) updatePayload.school_hazardous_chemical_standard = val;
    }

    const accidentItem = hazardItems.find(item => item.sbstnClsfTypeNm === "사고대비물질");
    if (accidentItem) {
      const val = extractConcentration(accidentItem.contInfo);
      if (val) updatePayload.school_accident_precaution_chemical_standard = val;
    }
  }

  // HazardList에 있는 학교 안전 기준 정보를 Substance 테이블로 복사 (Legacy Logic - Still useful for other standards)
  const { data: hazardListEntry } = await supabase
    .from("HazardList")
    .select("special_health_standard, toxic_standard, permitted_standard, restricted_standard, prohibited_standard")
    .ilike("cas_nos", `%${cas_rn}%`)
    .maybeSingle();

  if (hazardListEntry) {
    if (hazardListEntry.special_health_standard) updatePayload.special_health_checkup_hazardous_factor_standard = hazardListEntry.special_health_standard;
    if (hazardListEntry.toxic_standard) updatePayload.toxic_substance_standard = hazardListEntry.toxic_standard;
    if (hazardListEntry.permitted_standard) updatePayload.permitted_substance_standard = hazardListEntry.permitted_standard;
    if (hazardListEntry.restricted_standard) updatePayload.restricted_substance_standard = hazardListEntry.restricted_standard;
    if (hazardListEntry.prohibited_standard) updatePayload.prohibited_substance_standard = hazardListEntry.prohibited_standard;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error: subUpdateErr } = await supabase
      .from("Substance")
      .update(updatePayload)
      .eq("id", substanceId);

    if (subUpdateErr) {
      console.error(`Substance standards update failed for ${cas_rn}:`, subUpdateErr);
    } else {
      console.log(`Substance standards updated for ${cas_rn}.`);
    }
  }

  // ----------------------------------------------------------------
  // 🆕 MSDS Initial Fetch & Insert
  // ----------------------------------------------------------------
  if (chemId) {
    console.log(`[CASIMPORT] Fetching initial MSDS for chemId: ${chemId}`);
    try {
      const allSections = await fetchKoshaMsds(chemId);
      if (allSections.length > 0) {
        // 1. Delete existing (just in case)
        await supabase.from("MSDS").delete().eq("substance_id", substanceId);

        // 2. Insert new
        const { error: msdsErr } = await supabase.from("MSDS").insert(
          allSections.map((d) => ({ substance_id: substanceId, ...d }))
        );

        if (msdsErr) console.error(`MSDS Initial Insert Error for ${cas_rn}:`, msdsErr);
        else console.log(`MSDS Initial Insert Success for ${cas_rn}`);
      }
    } catch (e) {
      console.error(`MSDS Initial Fetch Failed for ${cas_rn}:`, e);
    }
  }

  // Synonyms (MERGE Logic)
  // 1. Fetch existing synonyms
  const { data: existingSynonyms } = await supabase
    .from("Synonyms")
    .select("synonyms_name, synonyms_eng")
    .eq("substance_id", substanceId);

  const existingEng = new Set(existingSynonyms?.map((s: { synonyms_eng: string | null }) => s.synonyms_eng).filter(Boolean));
  const existingKor = new Set(existingSynonyms?.map((s: { synonyms_name: string | null }) => s.synonyms_name).filter(Boolean));

  // 2. Filter new English synonyms
  const newEngSynonyms = casSynonyms.filter(s => !existingEng.has(s));
  if (newEngSynonyms.length > 0) {
    await supabase.from("Synonyms").insert(
      newEngSynonyms.map((s) => ({ substance_id: substanceId, synonyms_eng: s }))
    );
  }

  // 3. Filter new Korean synonyms
  const uniqueKor = Array.from(new Set(ncisSynonyms));
  const newKorSynonyms = uniqueKor.filter(s => !existingKor.has(s));
  if (newKorSynonyms.length > 0) {
    await supabase.from("Synonyms").insert(
      newKorSynonyms.map((s) => ({ substance_id: substanceId, synonyms_name: s }))
    );
  }

  // Properties
  if (casData.experimentalProperties?.length) {
    await supabase.from("Properties").insert(
      casData.experimentalProperties.map((p) => ({
        substance_id: substanceId,
        name: p.name,
        property: p.property,
        source_number: p.sourceNumber,
      }))
    );
  }

  // Citations
  if (casData.propertyCitations?.length) {
    await supabase.from("Citations").insert(
      casData.propertyCitations.map((c) => ({
        substance_id: substanceId,
        source_number: c.sourceNumber,
        source: c.source,
        url: c.docUri,
      }))
    );
  }

  // Replaced RNs (MERGE Logic)
  if (casData.replacedRns?.length) {
    // 1. Fetch existing
    const { data: existingRns } = await supabase
      .from("ReplacedRns")
      .select("replaced_rn")
      .eq("substance_id", substanceId);

    const existingRnSet = new Set(existingRns?.map((r: { replaced_rn: string }) => r.replaced_rn));

    // 2. Filter new
    const newRns = casData.replacedRns.filter(rn => !existingRnSet.has(rn));

    if (newRns.length > 0) {
      await supabase.from("ReplacedRns").insert(
        newRns.map((rn) => ({
          substance_id: substanceId,
          replaced_rn: rn,
        }))
      );
    }
  }

  // Types
  type ExperimentalProperty = { name: string; property: string };
  type InventoryInsertPayload = {
    substance_id: number;
    bottle_identifier: string;
    initial_amount: number | null | undefined;
    current_amount: number;
    unit: string | null | undefined;
    cabinet_id: number | null;
    state: string | null | undefined;
    classification: string | null | undefined;
    manufacturer: string | null | undefined;
    purchase_date: string | null | undefined;
    valence?: number | null;
    status: string;
    updated_at: string;
    msds_pdf_url: string | null;
    msds_pdf_hash: string | null;
    concentration_value: number | null;
    concentration_unit: string | null | undefined;
    converted_concentration_value_1: number | null;
    converted_concentration_unit_1: string | null;
    converted_concentration_value_2: number | null;
    converted_concentration_unit_2: string | null;
    school_hazardous_chemical?: string | null;
    school_accident_precaution_chemical?: string | null;
    special_health_checkup_hazardous_factor?: string | null;
    toxic_substance?: string | null;
    permitted_substance?: string | null;
    restricted_substance?: string | null;
    prohibited_substance?: string | null;
    door_vertical?: string | null;
    door_horizontal?: string | null;
    internal_shelf_level?: string | null;
    storage_column?: string | null;
    bottle_mass?: number | null;
    bottle_type?: string | null;
  };

  // 4. Inventory Insert
  if (!substanceId) throw new Error("Substance ID is missing");

  const nowCurrent = Number(inventoryDetails.current_amount ?? inventoryDetails.purchase_volume ?? 0);
  const invInsert: InventoryInsertPayload = {
    substance_id: substanceId,
    bottle_identifier: `${cas_rn}-${crypto.randomUUID()}`,
    initial_amount: toNumeric(inventoryDetails.purchase_volume),
    current_amount: toNumeric(inventoryDetails.current_amount ?? inventoryDetails.purchase_volume ?? 0) ?? 0,
    unit: inventoryDetails.unit,
    cabinet_id: inventoryDetails.cabinet_id ?? null,
    door_vertical: inventoryDetails.door_vertical ?? null,
    door_horizontal: inventoryDetails.door_horizontal ?? null,
    internal_shelf_level: inventoryDetails.internal_shelf_level ?? null,
    storage_column: inventoryDetails.storage_column ?? null,
    state: inventoryDetails.state ?? null,
    bottle_mass: toNumeric(inventoryDetails.bottle_mass),
    bottle_type: inventoryDetails.bottle_type ?? null,
    classification: inventoryDetails.classification ?? null,
    manufacturer: inventoryDetails.manufacturer ?? null,
    purchase_date: inventoryDetails.purchase_date ?? null,
    status: inventoryDetails.status ?? "사용중",
    updated_at: new Date().toISOString(),
    msds_pdf_url: inventoryDetails.msds_pdf_url ?? null,
    msds_pdf_hash: inventoryDetails.msds_pdf_hash ?? null,
    concentration_value: toNumeric(inventoryDetails.concentration_value),
    concentration_unit: inventoryDetails.concentration_unit ?? null,
    converted_concentration_value_1: null,
    converted_concentration_unit_1: null,
    converted_concentration_value_2: null,
    converted_concentration_unit_2: null,
    valence: refData?.valence_ref ?? null, // ✅ SubstanceRef valence override
  };

  // 🧮 Calculate Conversions
  if (invInsert.concentration_value && invInsert.concentration_unit) {
    const densityProp = (casData.experimentalProperties as ExperimentalProperty[] | undefined)
      ?.find((p) => p.name === "Density");
    const densityVal = densityProp ? parseFloat(densityProp.property) : 1;

    const annotateUnit = (unit: string | null) => {
      if (!unit) return unit;
      const stateVal = String(invInsert.state || "").trim().toLowerCase();
      const solids = ["파우더", "조각", "비드", "펠렛", "리본", "막대", "벌크", "고체"];
      const isSolid = solids.some((k) => stateVal.includes(k));
      const isGas = stateVal.includes("기체") || stateVal.includes("gas");
      const isLiquid = stateVal === "액체" || stateVal.includes("liquid");
      if (unit === "M" && (isSolid || isGas)) return `${unit} (의미 없음)`;
      if (unit === "m" && (isLiquid || isGas)) return `${unit} (정의 불가)`;
      return unit;
    };

    const conversions = computeConversions({
      value: invInsert.concentration_value,
      unit: invInsert.concentration_unit,
      molarMass: casData.molecularMass,
      density: densityVal
    });

    if (conversions) {
      if (invInsert.concentration_unit === "%") {
        invInsert.converted_concentration_value_1 = conversions.molarity;
        invInsert.converted_concentration_unit_1 = annotateUnit("M");
        invInsert.converted_concentration_value_2 = conversions.molality;
        invInsert.converted_concentration_unit_2 = annotateUnit("m");
      } else if (invInsert.concentration_unit === "M" || invInsert.concentration_unit === "N") {
        invInsert.converted_concentration_value_1 = conversions.percent;
        invInsert.converted_concentration_unit_1 = "%";
        invInsert.converted_concentration_value_2 = conversions.molality;
        invInsert.converted_concentration_unit_2 = annotateUnit("m");
      }
    }
  }

  // ----------------------------------------------------------------
  // 🆕 Inventory Hazard Columns Population
  // ----------------------------------------------------------------
  // 1. Get latest Substance standards
  const { data: latestSub } = await supabase
    .from("Substance")
    .select("school_hazardous_chemical_standard, school_accident_precaution_chemical_standard, special_health_checkup_hazardous_factor_standard, toxic_substance_standard, permitted_substance_standard, restricted_substance_standard, prohibited_substance_standard")
    .eq("id", substanceId)
    .single();

  if (latestSub) {
    // 2. Determine Percentage Concentration
    let percentValue: number | null = null;

    if (invInsert.concentration_unit === "%") {
      percentValue = invInsert.concentration_value;
    } else if (invInsert.converted_concentration_unit_1 === "%") {
      percentValue = invInsert.converted_concentration_value_1;
    } else if (invInsert.converted_concentration_unit_2 === "%") {
      percentValue = invInsert.converted_concentration_value_2;
    }

    // 🛑 Substance-Only Mode (Early Return)
    if (body.type === "substance") {
      return new Response(JSON.stringify({
        status: "success",
        data: {
          id: substanceId,
          cas_rn: cas_rn,
          chemical_formula: subData.molecular_formula_mod || subData.molecular_formula, // Prefer modified
          molecular_mass: subData.molecular_mass,
          chemical_name_ko: subData.chem_name_kor_mod || subData.chem_name_kor,
          classification: latestSub?.school_hazardous_chemical_standard ? "인체등유해성물질" : null, // Basic inference
          standards: latestSub
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Compare and Set
    const compareAndSet = (standardStr: string | null): string => {
      if (!standardStr || percentValue === null) return "-";
      // Extract number from standard (e.g., "25%" -> 25)
      const match = standardStr.match(/(\d+(\.\d+)?)/);
      if (!match) return "-";
      const standardVal = parseFloat(match[0]);

      if (percentValue >= standardVal) return "◯";
      return "-";
    };

    invInsert.school_hazardous_chemical = compareAndSet(latestSub.school_hazardous_chemical_standard);
    invInsert.school_accident_precaution_chemical = compareAndSet(latestSub.school_accident_precaution_chemical_standard);
    invInsert.special_health_checkup_hazardous_factor = compareAndSet(latestSub.special_health_checkup_hazardous_factor_standard);
    invInsert.toxic_substance = compareAndSet(latestSub.toxic_substance_standard);
    invInsert.permitted_substance = compareAndSet(latestSub.permitted_substance_standard);
    invInsert.restricted_substance = compareAndSet(latestSub.restricted_substance_standard);
    invInsert.prohibited_substance = compareAndSet(latestSub.prohibited_substance_standard);
  }

  console.log("[CASIMPORT] Received inventoryDetails:", inventoryDetails);

  // 🛡️ Cabinet ID Existence Check
  if (invInsert.cabinet_id) {
    const { data: cabExists } = await supabase
      .from("Cabinet")
      .select("id")
      .eq("id", invInsert.cabinet_id)
      .maybeSingle();

    if (!cabExists) {
      console.warn(`[CASIMPORT] Cabinet ID ${invInsert.cabinet_id} does not exist. Setting to NULL.`);
      invInsert.cabinet_id = null;
    }
  }

  const { data: inv, error: invErr } = await supabase
    .from("Inventory")
    .insert([invInsert])
    .select("id")
    .single();

  console.log("[CASIMPORT] invInsert.purchase_date before insert:", invInsert.purchase_date);
  console.log("[CASIMPORT] Inventory Insert Result:", { id: inv?.id, error: invErr });

  if (invErr) throw new Error(`Inventory 생성 오류: ${invErr.message}`);
  const inventoryId = inv.id;

  // ----------------------------------------------------------------
  // 🆕 Insert Initial Registration Log
  // ----------------------------------------------------------------
  if (inventoryId && invInsert.initial_amount) {
    const { error: logErr } = await supabase
      .from("UsageLog")
      .insert({
        inventory_id: inventoryId,
        usage_date: invInsert.purchase_date || new Date().toISOString().split('T')[0],
        subject: "최초 등록",
        amount: invInsert.initial_amount,
        unit: invInsert.unit,
        period: "기타"
      });

    if (logErr) {
      console.warn(`[CASIMPORT] Initial UsageLog insert failed for ${cas_rn}:`, logErr);
    } else {
      console.log(`[CASIMPORT] Initial UsageLog created for ${cas_rn}`);
    }
  }

  // 5. Photo Update
  const uploaded: Record<string, string> = {};
  if (inventoryDetails.photo_url_320) uploaded.photo_url_320 = inventoryDetails.photo_url_320;
  if (inventoryDetails.photo_url_160) uploaded.photo_url_160 = inventoryDetails.photo_url_160;

  if (Object.keys(uploaded).length > 0) {
    await supabase.from("Inventory").update(uploaded).eq("id", inventoryId);
  }

  return new Response(JSON.stringify({ cas_rn, status: "success", inventoryId, isNew }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractStoragePath(url: string | null): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex === -1) return null;
  const bucket = rest.slice(0, slashIndex);
  if (bucket !== "reagent-photos" && bucket !== "msds-pdf") return null;
  const path = rest.slice(slashIndex + 1);
  return path || null;
}

async function handleDeleteInventory(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  if (type && type !== "inventory") {
    return new Response(JSON.stringify({ error: "Unsupported delete type" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const idParam = url.searchParams.get("id");
  if (!idParam || Number.isNaN(Number(idParam))) {
    return new Response(JSON.stringify({ error: "Missing inventory id" }), {
      status: 400,
      headers: corsHeaders,
    });
  }
  const inventoryId = Number(idParam);

  const { data: inventory, error } = await supabase
    .from("Inventory")
    .select("id, substance_id, photo_url_320, photo_url_160, msds_pdf_url, msds_pdf_hash")
    .eq("id", inventoryId)
    .maybeSingle();

  if (error) throw new Error(`Inventory 조회 오류: ${error.message}`);
  if (!inventory) {
    return new Response(JSON.stringify({ error: "Inventory not found" }), {
      status: 404,
      headers: corsHeaders,
    });
  }

  const { error: delErr } = await supabase.from("Inventory").delete().eq("id", inventoryId);
  if (delErr) throw new Error(`Inventory 삭제 오류: ${delErr.message}`);

  // 사진 삭제
  const paths = [extractStoragePath(inventory.photo_url_320), extractStoragePath(inventory.photo_url_160)].filter(
    Boolean,
  ) as string[];
  if (paths.length) {
    const { error: storageErr } = await supabase.storage.from("reagent-photos").remove(paths);
    if (storageErr) console.error("Storage 삭제 오류:", storageErr.message);
  }

  // MSDS PDF 안전 삭제 (Reference Counting)
  if (inventory.msds_pdf_url) {
    // Hash가 있으면 Hash로 중복 확인
    if (inventory.msds_pdf_hash) {
      const { count } = await supabase
        .from("Inventory")
        .select("id", { count: "exact", head: true })
        .eq("msds_pdf_hash", inventory.msds_pdf_hash);

      if (count === 0) {
        const pdfPath = extractStoragePath(inventory.msds_pdf_url);
        if (pdfPath) {
          await supabase.storage.from("msds-pdf").remove([pdfPath]);
        }
      }
    }
  }

  // Substance 삭제 확인 (Inventory가 더 이상 없으면 Substance도 삭제)
  const { count: invCount } = await supabase
    .from("Inventory")
    .select("id", { count: "exact", head: true })
    .eq("substance_id", inventory.substance_id);

  if (invCount === 0) {
    // 연관 데이터 삭제 (Cascade 설정이 되어 있다면 불필요하지만, 명시적으로 처리)
    await supabase.from("HazardClassifications").delete().eq("substance_id", inventory.substance_id);
    await supabase.from("Synonyms").delete().eq("substance_id", inventory.substance_id);
    await supabase.from("MSDS").delete().eq("substance_id", inventory.substance_id);
    await supabase.from("Substance").delete().eq("id", inventory.substance_id);
  }

  return new Response(JSON.stringify({ status: "success" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleDownloadMol(req: Request) {
  const url = new URL(req.url);
  const substanceId = url.searchParams.get("substance_id");
  if (!substanceId) {
    return new Response(JSON.stringify({ error: "Missing substance_id" }), { status: 400, headers: corsHeaders });
  }

  const { data: sub, error } = await supabase
    .from("Substance")
    .select("uri, cas_rn")
    .eq("id", substanceId)
    .single();

  if (error || !sub || !sub.uri) {
    return new Response(JSON.stringify({ error: "Substance or URI not found" }), { status: 404, headers: corsHeaders });
  }

  const casUrl = `https://commonchemistry.cas.org/api/export?uri=${encodeURIComponent(sub.uri)}&format=mol`;
  const res = await fetch(casUrl, {
    headers: { "X-API-KEY": CAS_API_KEY },
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: `CAS API Error: ${res.status}` }), { status: 502, headers: corsHeaders });
  }

  const molContent = await res.text();

  return new Response(molContent, {
    headers: {
      ...corsHeaders,
      "Content-Type": "chemical/x-mdl-molfile",
      "Content-Disposition": `attachment; filename="${sub.cas_rn}.mol"`,
    },
  });
}

/* ------------------------------------------------------------------
   🌐 메인 엔드포인트
------------------------------------------------------------------ */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    if (req.method === "POST") {
      if (type === "check_update") return await handleCheckUpdate(req);
      return await handlePostInventory(req);
    }
    if (req.method === "GET" && type === "download_mol") return await handleDownloadMol(req);
    if (req.method === "DELETE") return await handleDeleteInventory(req);

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  } catch (e) {
    return logError("CASIMPORT Main", e);
  }
});

function computeConversions({
  value,
  unit,
  molarMass,
  density,
}: {
  value: number;
  unit: string;
  molarMass: number | string | null | undefined;
  density: number | string | null | undefined;
}) {
  const v = Number(value);
  const mw = Number(molarMass);
  const rho = Number(density) || 1; // g/mL
  const result = { percent: null as number | null, molarity: null as number | null, molality: null as number | null };

  if (!Number.isFinite(v) || !Number.isFinite(mw) || mw <= 0) return null;

  if (unit === "%") {
    const massSolute = v;
    const totalMass = 100;
    const solutionVolumeL = (totalMass / rho) / 1000;
    const moles = massSolute / mw;
    result.molarity = solutionVolumeL > 0 ? moles / solutionVolumeL : null;

    const solventMassKg = (totalMass - massSolute) / 1000;
    result.molality = solventMassKg > 0 ? moles / solventMassKg : null;
    result.percent = v;
  } else if (unit === "M" || unit === "N") {
    const effectiveM = v;
    const solutionVolumeL = 1;
    const moles = effectiveM * solutionVolumeL;
    const soluteMassG = moles * mw;
    const solutionMassG = solutionVolumeL * 1000 * rho;

    result.percent = solutionMassG > 0 ? (soluteMassG / solutionMassG) * 100 : null;

    const solventMassKg = (solutionMassG - soluteMassG) / 1000;
    result.molality = solventMassKg > 0 ? moles / solventMassKg : null;
    result.molarity = effectiveM;
  }
  return result;
}
