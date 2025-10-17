// index.ts (Supabase Edge Function: casimport)

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { decode } from "std/encoding/base64.ts";

interface CasProperty {
    name: string;
    property: string;
    units: string;
}

interface CasCitation {
    source: string;
    url: string;
}

// CORS Origin 설정
const ALLOWED_ORIGIN = 'https://pogoksci.github.io';
const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
};

// 환경 변수에서 키 가져오기
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CAS_API_KEY = Deno.env.get('CAS_API_KEY')!;

// Supabase 클라이언트 초기화
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` } }
});

// ------------------------------------------------------------------
// 헬퍼 함수
// ------------------------------------------------------------------

async function fetchCasDetail(casRn: string) {
    const url = `https://commonchemistry.cas.org/api/detail?cas_rn=${casRn}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-API-KEY': CAS_API_KEY }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CAS API 호출 실패 (${response.status}): ${errorText.substring(0, 100)}...`);
    }
    return response.json();
}

// ------------------------------------------------------------------
// 핸들러 함수들
// ------------------------------------------------------------------

async function handleGetLocationData() {
    const { data: areas, error: areaError } = await supabase.from('Area').select('id, name');
    if (areaError) throw new Error(`Area 조회 오류: ${areaError.message}`);
    
    const { data: cabinets, error: cabinetError } = await supabase.from('Cabinet').select('id, area_id, name, shelf_height, door_vertical_count, door_horizontal_count, storage_columns');
    if (cabinetError) throw new Error(`Cabinet 조회 오류: ${cabinetError.message}`);
    
    return new Response(JSON.stringify({ areas, cabinets }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handlePostInventory(req: Request) {
    const { casRns, inventoryDetails } = await req.json();
    const casRn = casRns[0];

    let substanceId: number;
    let isNewSubstance = false;

    const { data: existingSubstance, error: checkError } = await supabase.from('Substance').select('id').eq('cas_rn', casRn).single();
    if (checkError && checkError.code !== 'PGRST116') throw new Error(`DB 조회 오류: ${checkError.message}`);

    if (existingSubstance) {
        substanceId = existingSubstance.id;
    } else {
        isNewSubstance = true;
        const fullData = await fetchCasDetail(casRn);
        
        const substanceData = {
            cas_rn: fullData.rn || casRn, name: fullData.name || null, uri: fullData.uri || null,
            inchikey: fullData.inchiKey || null, molecular_formula: fullData.molecularFormula?.replace(/<.+?>/g, '') || null,
            molecular_mass: fullData.molecularMass ? parseFloat(fullData.molecularMass) : null,
            has_molfile: fullData.hasMolfile || false, svg_image: fullData.images?.[0] || null,
        };
        const { data: subInsert, error: subError } = await supabase.from('Substance').insert([substanceData]).select('id').single();
        if (subError) throw new Error(`Substance 삽입 오류: ${subError.message}`);
        substanceId = subInsert.id;

        const auxiliaryInsertions = [];
        const substanceFk = { substance_id: substanceId };
        if (fullData.synonyms && Array.isArray(fullData.synonyms)) {
            auxiliaryInsertions.push(supabase.from('Synonyms').insert(fullData.synonyms.map((s: string) => ({ ...substanceFk, name: s }))));
        }
        // Experimental Properties 삽입
        if (fullData.experimentalProperties && Array.isArray(fullData.experimentalProperties)) {
            auxiliaryInsertions.push(
                supabase.from('Properties').insert(
                    fullData.experimentalProperties.map((p: CasProperty) => ({ // ⬅️ [수정됨]
                        ...substanceFk, name: p.name, property: p.property,
                        units: p.units, type: 'experimental'
                    }))
                )
            );
        }
        // Predicted Properties 삽입
        if (fullData.predictedProperties && Array.isArray(fullData.predictedProperties)) {
            auxiliaryInsertions.push(
                supabase.from('Properties').insert(
                    fullData.predictedProperties.map((p: CasProperty) => ({ // ⬅️ [수정됨]
                        ...substanceFk, name: p.name, property: p.property,
                        units: p.units, type: 'predicted'
                    }))
                )
            );
        }
        // Citations 삽입
        if (fullData.citations && Array.isArray(fullData.citations)) {
            auxiliaryInsertions.push(
                supabase.from('Citations').insert(
                    fullData.citations.map((c: CasCitation) => ({ // ⬅️ [수정됨]
                        ...substanceFk, source: c.source, url: c.url
                    }))
                )
            );
        }

        const results = await Promise.all(auxiliaryInsertions);
        for (const result of results) {
            if (result.error) console.error('보조 테이블 삽입 중 오류:', result.error.message);
        }
    }

    const { data: invInsert, error: invError } = await supabase.from('Inventory').insert([{
        substance_id: substanceId,
        bottle_identifier: `${casRn}-${crypto.randomUUID()}`,
        initial_amount: inventoryDetails.purchase_volume,
        unit: inventoryDetails.unit,
        current_amount: inventoryDetails.current_amount,
        door_vertical: inventoryDetails.door_vertical,
        door_horizontal: inventoryDetails.door_horizontal,
        internal_shelf_level: inventoryDetails.internal_shelf_level,
        storage_column: inventoryDetails.storage_columns,
        cabinet_id: inventoryDetails.cabinet_id,
        classification: inventoryDetails.classification,
        state: inventoryDetails.state,
        concentration_value: inventoryDetails.concentration_value,
        concentration_unit: inventoryDetails.concentration_unit,
        manufacturer: inventoryDetails.manufacturer,
        purchase_date: inventoryDetails.purchase_date,
    }]).select('id').single();
    if (invError) throw new Error(`Inventory 삽입 오류: ${invError.message}`);
    const inventoryId = invInsert.id;
    
    const photoUrls: { url_320: string | null; url_160: string | null } = { url_320: null, url_160: null };
    const uploadPromises = [];
    if (inventoryDetails.photo_320_base64) {
        const path_320 = `${inventoryId}_${casRn}_320.png`;
        const imageData320 = decode(inventoryDetails.photo_320_base64.split(',')[1]);
        uploadPromises.push(supabase.storage.from('reagent-photos').upload(path_320, imageData320, { contentType: 'image/png', upsert: true }));
    }
    if (inventoryDetails.photo_160_base64) {
        const path_160 = `${inventoryId}_${casRn}_160.png`;
        const imageData160 = decode(inventoryDetails.photo_160_base64.split(',')[1]);
        uploadPromises.push(supabase.storage.from('reagent-photos').upload(path_160, imageData160, { contentType: 'image/png', upsert: true }));
    }

    const uploadResults = await Promise.all(uploadPromises);
    for (const result of uploadResults) {
        if (result.error) console.error("Storage 업로드 오류:", result.error.message);
        if (!result.data) continue;
        if (result.data.path.includes('_320.png')) {
            photoUrls.url_320 = supabase.storage.from('reagent-photos').getPublicUrl(result.data.path).data.publicUrl;
        }
        if (result.data.path.includes('_160.png')) {
            photoUrls.url_160 = supabase.storage.from('reagent-photos').getPublicUrl(result.data.path).data.publicUrl;
        }
    }

    if (photoUrls.url_320 || photoUrls.url_160) {
        const { error: updateError } = await supabase.from('Inventory').update({ photo_url_320: photoUrls.url_320, photo_url_160: photoUrls.url_160 }).eq('id', inventoryId);
        if (updateError) console.error("사진 URL 업데이트 오류:", updateError.message);
    }
    
    const responsePayload = [{ casRn, status: 'success', inventoryId, isNewSubstance }];
    return new Response(JSON.stringify(responsePayload), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleCabinetDeletion(req: Request) {
    const url = new URL(req.url);
    const cabinetId = url.searchParams.get('id');
    if (!cabinetId) throw new Error('삭제할 캐비닛 ID가 필요합니다.');
    
    const { data: cabinetToDelete, error: selectError } = await supabase.from('Cabinet').select('area_id').eq('id', cabinetId).single();
    if (selectError || !cabinetToDelete) throw new Error(`삭제할 캐비닛(ID: ${cabinetId})을 찾을 수 없습니다: ${selectError?.message || ''}`);
    const { area_id } = cabinetToDelete;

    const { error: deleteError } = await supabase.from('Cabinet').delete().eq('id', cabinetId);
    if (deleteError) throw new Error(`DB 삭제 오류: ${deleteError.message}`);

    const { count, error: countError } = await supabase.from('Cabinet').select('*', { count: 'exact', head: true }).eq('area_id', area_id);
    if (countError) console.error(`캐비닛 개수 확인 중 오류: ${countError.message}`);

    if (count === 0) {
        console.log(`Area (ID: ${area_id})에 남은 캐비닛이 없어 Area를 삭제합니다.`);
        const { error: areaDeleteError } = await supabase.from('Area').delete().eq('id', area_id);
        if (areaDeleteError) console.error(`Area (ID: ${area_id}) 삭제 중 오류 발생: ${areaDeleteError.message}`);
    }
    
    return new Response(JSON.stringify({ message: `ID ${cabinetId} 캐비닛이 삭제되었습니다.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ------------------------------------------------------------------
// 메인 라우터 함수
// ------------------------------------------------------------------

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (req.method === 'GET') {
            return await handleGetLocationData();
        }
        if (req.method === 'POST') {
            return await handlePostInventory(req);
        }
        if (req.method === 'DELETE') {
            return await handleCabinetDeletion(req);
        }
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('Main Handler Fatal Error:', errorMessage);
        return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});