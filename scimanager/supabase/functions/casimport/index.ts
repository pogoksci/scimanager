// index.ts (Supabase Edge Function: casimport)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const results = [];
    
    try {
        const { casRns, inventoryDetails } = await req.json();
        console.log("Received Inventory Data:", inventoryDetails);
        
        const casRn = casRns[0]; 

        let substanceId: number;
        let isNewSubstance = false;

        // 1. Substance 테이블에서 CAS RN 존재 확인 및 Substance ID 획득 로직 유지
        const { data: existingSubstance, error: checkError } = await supabase
            .from('Substance')
            .select('id') 
            .eq('cas_rn', casRn)
            .single();

        // (checkError 처리 로직 유지)
        if (checkError && checkError.code !== 'PGRST116') { throw new Error(`DB 조회 오류: ${checkError.message}`); }

        if (existingSubstance) {
            substanceId = existingSubstance.id;
        } else {
            // ... Substance API 호출 및 보조 테이블 삽입 로직 유지 ...
            isNewSubstance = true;
            const fullData = await fetchCasDetail(casRn);

            // SubstanceData 생성 및 삽입 로직 유지 (synonyms, citations 등 포함)
            const substanceData = {
                cas_rn: fullData.rn, name: fullData.name, uri: fullData.uri, inchikey: fullData.inchiKey, 
                molecular_formula: fullData.molecularFormula.replace(/<\/?sub>|<\/?sup>|<\/?em>/g, ''),
                molecular_mass: parseFloat(fullData.molecularMass), has_molfile: fullData.hasMolfile, 
                svg_image: fullData.images ? fullData.images[0] : null,
            };
            
            const { data: subInsert, error: subError } = await supabase.from('Substance').insert([substanceData]).select('id').single();
            if (subError) throw new Error(`Substance 삽입 오류: ${subError.message}`);
            substanceId = subInsert.id;

            // ... 보조 테이블 삽입 로직 (Synonyms, Citations, Properties, ReplacedRns) 유지 ...
            // (then((res: { error: { message: string } | null }) => ... 형식 유지)
        }
        
        // 3. Inventory 테이블에 새 시약병 정보 삽입
        const bottleIdentifier = `${casRn}-${crypto.randomUUID()}`; 

        const inventoryData = {
            substance_id: substanceId,
            bottle_identifier: bottleIdentifier, 
            
            // 🔑 InventoryDetails에서 6단계 위치 정보와 폼 필드를 모두 가져와 삽입
            initial_amount: inventoryDetails.purchase_volume, unit: inventoryDetails.unit, 
            current_amount: inventoryDetails.current_amount, location_area: inventoryDetails.location_area,
            door_vertical: inventoryDetails.door_vertical, door_horizontal: inventoryDetails.door_horizontal,
            internal_shelf_level: inventoryDetails.internal_shelf_level, storage_column: inventoryDetails.storage_column,
            cabinet_id: inventoryDetails.cabinet_id, // FK
            
            // 나머지 폼 필드
            classification: inventoryDetails.classification, state: inventoryDetails.state,
            concentration_value: inventoryDetails.concentration_value, concentration_unit: inventoryDetails.concentration_unit, 
            manufacturer: inventoryDetails.manufacturer, purchase_date: inventoryDetails.purchase_date,
            
            photo_storage_url: null, // Storage 제거됨
        };

        const { error: invError } = await supabase.from('Inventory').insert([inventoryData]);
        if (invError) throw new Error(`Inventory 삽입 오류: ${invError.message}`);
        
        results.push({ casRn, status: 'success', id: substanceId, inventoryId: bottleIdentifier, isNewSubstance });

        return withCorsHeaders(new Response(JSON.stringify(results), { status: 200 }));

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