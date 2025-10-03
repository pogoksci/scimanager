// index.ts (Edge Function: cabinet-register)

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

// ⚠️ CORS Origin 설정 (클라이언트 도메인)
const ALLOWED_ORIGIN = 'https://pogoksci.github.io'; 

// 환경 변수에서 키를 가져옵니다. (Service Role Key는 RLS 우회에 필수)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!; 
const _CAS_API_KEY = Deno.env.get('CAS_API_KEY')!; 
// CAS_API_KEY는 이 함수에서 사용되지 않지만, 다른 함수와의 통일성을 위해 유지합니다.

// 🔑 Service Role Key를 사용하여 DB 관리 권한으로 클라이언트 초기화
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

// CORS 헤더 추가 함수 (유지)
function withCorsHeaders(response: Response, status: number = 200) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
    };
    return new Response(response.body, { headers, status });
}

// ------------------------------------------------------------------
// 메인 로직: 캐비닛 등록 처리 (POST)
// ------------------------------------------------------------------

async function handleCabinetRegistration(req: Request) {
    try {
        // req.json()의 최상위 객체에서 직접 값을 추출합니다.
        const { 
            area_name, 
            cabinet_name,
            door_vertical_count,
            door_horizontal_count,
            shelf_height,
            storage_columns // storage_column 오타 수정
        } = await req.json();

        // 🚨 1. 데이터 유효성 검사
        // trim()을 적용하려면 변수가 문자열이어야 하므로, typeof 체크를 추가하면 더 안전합니다.
        if (!area_name || !cabinet_name || typeof area_name !== 'string' || typeof cabinet_name !== 'string') {
            throw new Error("필수 데이터 (약품실 또는 보관장 이름)가 누락되었거나 형식이 잘못되었습니다.");
        }
        
        // 이제 area_name과 cabinet_name 변수를 직접 사용하면 됩니다.
        const areaName = area_name.trim();
        const cabinetName = cabinet_name.trim();

        // 🔑 나머지 필드에 대한 기본값 할당
        const doorVerticalCount = door_vertical_count || 1;
        const doorHorizontalCount = door_horizontal_count || 1;
        const shelfHeight = shelf_height || 3;
        const storageColumn = storage_columns || 6; // storage_columns로 수정

        // 2. Area ID 확보 로직: Area 테이블에 이름이 있는지 확인하고 없으면 새로 삽입
        let areaId: number;

        // Area 조회
        const { data: existingArea } = await supabase
            .from('Area')
            .select('id')
            .eq('name', areaName) // areaName은 이제 빈 문자열이 아님을 보장
            .single();

        if (existingArea) {
            // 1-A. Area가 이미 존재하면 기존 ID 사용
            areaId = existingArea.id;
        } else {
            // 1-B. Area가 없으면 새로 삽입하고 ID 획득 (최초 등록 지원)
            const { data: newArea, error: areaInsertError } = await supabase
                .from('Area')
                .insert([{ name: areaName }])
                .select('id')
                .single();
                
            if (areaInsertError) throw new Error(`Area 등록 오류: ${areaInsertError.message}`);
            areaId = newArea.id;
        }

        // 3. Cabinet 데이터 구성 및 삽입
        const newCabinetData = {
            area_id: areaId, // 🔑 획득한 areaId 사용
            name: cabinetName, // cabinetName은 이제 빈 문자열이 아님을 보장
            door_vertical_count: doorVerticalCount, 
            door_horizontal_count: doorHorizontalCount,
            shelf_height: shelfHeight,
            storage_columns: storageColumn,
            // photo_url 등 다른 필드가 있다면 여기에 추가
        };

        const { data: cabinetInsert, error: cabinetError } = await supabase
            .from('Cabinet')
            .insert([newCabinetData])
            .select('id, name')
            .single();
            
        if (cabinetError) throw new Error(`Cabinet 삽입 오류: ${cabinetError.message}`);

        // 4. 성공 응답 반환
        return withCorsHeaders(new Response(JSON.stringify({ 
            status: 'success', 
            cabinetId: cabinetInsert.id,
            cabinetName: cabinetInsert.name
        }), { status: 200 }));

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('Cabinet Registration Fatal Error:', errorMessage);
        
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

    // POST 요청만 처리
    if (req.method === 'POST') {
        return await handleCabinetRegistration(req);
    }

    // 지원하지 않는 메서드 처리
    return withCorsHeaders(new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 }));
}

serve(handler);