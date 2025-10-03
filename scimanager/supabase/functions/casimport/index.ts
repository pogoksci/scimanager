// index.ts (Supabase Edge Function: casimport)

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { decode } from "std/encoding/base64.ts";

// ⚠️ CORS Origin 설정: 당신의 GitHub Pages 주소
const ALLOWED_ORIGIN = 'https://pogoksci.github.io'; 

// 환경 변수에서 키를 가져옵니다.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!; // RLS 우회용 비밀 키
const CAS_API_KEY = Deno.env.get('CAS_API_KEY')!; 

// 🔑 Service Role Key를 사용하여 최고 권한으로 클라이언트 초기화
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false, 
    },
    global: {
        headers: {
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}` 
        }
    }
});

// ------------------------------------------------------------------
// 헬퍼 함수
// ------------------------------------------------------------------

function withCorsHeaders(response: Response, status: number = 200) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', // GET 추가
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
    };
    return new Response(response.body, { headers, status });
}

async function fetchCasDetail(casRn: string) {
    const url = `https://commonchemistry.cas.org/api/detail?cas_rn=${casRn}&apikey=${CAS_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CAS API 호출 실패 (${response.status}): ${errorText.substring(0, 100)}...`);
    }
    return response.json();
}

// ------------------------------------------------------------------
// GET 로직: 장소 데이터 조회 (Area & Cabinet)
// ------------------------------------------------------------------

async function handleGetLocationData() {
    try {
        // Area 테이블 데이터 조회
        const { data: areas, error: areaError } = await supabase
            .from('Area')
            .select('id, name'); 
        if (areaError) throw new Error(`Area 조회 오류: ${areaError.message}`);
        
        // Cabinet 테이블 데이터 조회
        const { data: cabinets, error: cabinetError } = await supabase
            // 🔑 Cabinet 테이블에 area_id(FK)와 모든 속성을 조회
            .from('Cabinet')
            .select('id, area_id, name, shelf_height, door_vertical_count, door_horizontal_count, storage_columns'); 

        if (cabinetError) throw new Error(`Cabinet 조회 오류: ${cabinetError.message}`);
        
        // 두 데이터를 묶어서 클라이언트에게 전송
        return withCorsHeaders(new Response(JSON.stringify({ areas, cabinets }), { status: 200 }));
        
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('Location GET Fatal Error:', errorMessage);
        return withCorsHeaders(new Response(JSON.stringify({ error: errorMessage }), { status: 500 }));
    }
}

// ------------------------------------------------------------------
// POST 로직: 재고 데이터 삽입
// ------------------------------------------------------------------

async function handlePostInventory(req: Request) {
    try {
        const { casRns, inventoryDetails } = await req.json();
        const casRn = casRns[0];

        let substanceId: number;
        let isNewSubstance = false;

        // 1. Substance 테이블에서 CAS RN 존재 확인
        const { data: existingSubstance, error: checkError } = await supabase
            .from('Substance')
            .select('id')
            .eq('cas_rn', casRn)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // '결과 없음' 오류는 정상
            throw new Error(`DB 조회 오류: ${checkError.message}`);
        }

        if (existingSubstance) {
            substanceId = existingSubstance.id;
        } else {
            isNewSubstance = true;
            // 2. CAS API에서 물질 정보 조회
            const fullData = await fetchCasDetail(casRn);

            // 3. 새 물질 정보 삽입
            const substanceData = {
                cas_rn: fullData.rn, name: fullData.name, uri: fullData.uri, inchikey: fullData.inchiKey,
                molecular_formula: fullData.molecularFormula.replace(/<\/?sub>|<\/?sup>|<\/?em>/g, ''),
                molecular_mass: parseFloat(fullData.molecularMass), has_molfile: fullData.hasMolfile,
                svg_image: fullData.images ? fullData.images[0] : null,
            };
            const { data: subInsert, error: subError } = await supabase.from('Substance').insert([substanceData]).select('id').single();
            if (subError) throw new Error(`Substance 삽입 오류: ${subError.message}`);
            substanceId = subInsert.id;
            
            // ... (Synonyms, Citations 등 보조 테이블 삽입 로직) ...
        }

        // 4. Inventory 테이블에 새 시약병 정보 삽입 후 ID 반환받기
        const { data: invInsert, error: invError } = await supabase
            .from('Inventory')
            .insert([{
                substance_id: substanceId,
                bottle_identifier: `${casRn}-${crypto.randomUUID()}`,
                initial_amount: inventoryDetails.purchase_volume,
                unit: inventoryDetails.unit,
                current_amount: inventoryDetails.current_amount,
                location_area: inventoryDetails.location_area,
                door_vertical: inventoryDetails.door_vertical,
                door_horizontal: inventoryDetails.door_horizontal,
                internal_shelf_level: inventoryDetails.internal_shelf_level,
                storage_column: inventoryDetails.storage_columns, // 'storage_column'으로 수정 (DB 스키마에 맞게)
                cabinet_id: inventoryDetails.cabinet_id,
                classification: inventoryDetails.classification,
                state: inventoryDetails.state,
                concentration_value: inventoryDetails.concentration_value,
                concentration_unit: inventoryDetails.concentration_unit,
                manufacturer: inventoryDetails.manufacturer,
                purchase_date: inventoryDetails.purchase_date,
            }])
            .select('id')
            .single();

        if (invError) throw new Error(`Inventory 삽입 오류: ${invError.message}`);
        const inventoryId = invInsert.id;

        // 5. 사진이 있으면 Storage에 업로드하고 URL을 DB에 업데이트
        const photoUrls: { url_320: string | null; url_160: string | null } = { url_320: null, url_160: null };
        const uploadPromises = [];

        // 320px 이미지 처리
        if (inventoryDetails.photo_320_base64) {
            const path_320 = `${inventoryId}_${casRn}_320.png`;
            const imageData320 = decode(inventoryDetails.photo_320_base64.split(',')[1]);
            uploadPromises.push(
                supabase.storage.from('reagent-photos').upload(path_320, imageData320, { contentType: 'image/png', upsert: true })
            );
        }
        // 160px 이미지 처리
        if (inventoryDetails.photo_160_base64) {
            const path_160 = `${inventoryId}_${casRn}_160.png`;
            const imageData160 = decode(inventoryDetails.photo_160_base64.split(',')[1]);
            uploadPromises.push(
                supabase.storage.from('reagent-photos').upload(path_160, imageData160, { contentType: 'image/png', upsert: true })
            );
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
            const { error: updateError } = await supabase
                .from('Inventory')
                .update({ 
                    photo_url_320: photoUrls.url_320,
                    photo_url_160: photoUrls.url_160
                })
                .eq('id', inventoryId);

            if (updateError) console.error("사진 URL 업데이트 오류:", updateError.message);
        }

        // 6. 최종 성공 결과 반환
        return withCorsHeaders(new Response(JSON.stringify([{ 
            casRn, 
            status: 'success', 
            inventoryId: inventoryId, // bottle_identifier 대신 숫자 ID 반환
            isNewSubstance: isNewSubstance
        }]), { status: 200 }));

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('POST Fatal Error:', errorMessage);
        return withCorsHeaders(new Response(JSON.stringify({ error: errorMessage }), { status: 500 }));
    }
}

// ------------------------------------------------------------------
// 메인 라우터 함수
// ------------------------------------------------------------------

async function handler(req: Request) {
    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        return withCorsHeaders(new Response(null, { status: 204 }));
    }

    // GET 요청 처리: await 추가
    if (req.method === 'GET') {
        return await handleGetLocationData();
    }

    // POST 요청 처리: await 추가
    if (req.method === 'POST') {
        return await handlePostInventory(req);
    }

    // 지원하지 않는 메서드 처리
    return withCorsHeaders(new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 }));
}

serve(handler);