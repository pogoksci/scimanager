// index.ts (Edge Function: cabinet-register)

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { decode } from "std/encoding/base64.ts";

const ALLOWED_ORIGIN = 'https://pogoksci.github.io'; 

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` } }
});

// ------------------------------------------------------------------
// 헬퍼 함수
// ------------------------------------------------------------------

function withCorsHeaders(response: Response, status: number = 200) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
    };
    return new Response(response.body, { headers, status });
}

// ------------------------------------------------------------------
// ⬇️ [수정됨] POST 로직: 캐비닛 등록 (중복 확인 추가)
// ------------------------------------------------------------------
async function handleCabinetRegistration(req: Request) {
    try {
        const cabinetData = await req.json();
        const areaName = cabinetData?.area_name?.trim() || '';
        const cabinetName = cabinetData?.cabinet_name?.trim() || '';

        if (areaName.length === 0 || cabinetName.length === 0) {
            throw new Error("필수 데이터 (약품실 또는 시약장 이름)가 누락되었습니다.");
        }
        
        // 1. Area ID 확보 (기존 로직 유지)
        let areaId: number;
        const { data: existingArea } = await supabase.from('Area').select('id').eq('name', areaName).single();
        if (existingArea) {
            areaId = existingArea.id;
        } else {
            const { data: newArea, error: areaInsertError } = await supabase.from('Area').insert([{ name: areaName }]).select('id').single();
            if (areaInsertError) throw new Error(`Area 등록 오류: ${areaInsertError.message}`);
            areaId = newArea.id;
        }

        // ⬇️ [새로운 코드 추가] 2. 같은 장소에 같은 이름의 캐비닛이 있는지 확인
        const { data: existingCabinet, error: checkError } = await supabase
            .from('Cabinet')
            .select('id')
            .eq('area_id', areaId)
            .eq('name', cabinetName)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116는 '결과 없음' 오류이므로 무시
            throw new Error(`DB 조회 오류: ${checkError.message}`);
        }

        if (existingCabinet) {
            throw new Error(`'${areaName}'에 '${cabinetName}' 이름의 시약장이 이미 존재합니다.`);
        }

        // 3. 중복이 없을 경우에만 캐비닛 데이터 삽입 (기존 로직 유지)
        const newCabinetData = {
            area_id: areaId,
            name: cabinetName,
            door_vertical_count: cabinetData.door_vertical_count || 1,
            door_horizontal_count: cabinetData.door_horizontal_count || 1,
            shelf_height: cabinetData.shelf_height || 3,
            storage_columns: cabinetData.storage_columns || 6,
        };

        // 1. 먼저 사진 URL 없이 캐비닛 정보만 삽입하고 id를 받아옵니다.
        const { data: cabinetInsert, error: cabinetError } = await supabase
            .from('Cabinet').insert([newCabinetData]).select('id, name').single();
        if (cabinetError) throw new Error(`Cabinet 삽입 오류: ${cabinetError.message}`);
        
        const cabinetId = cabinetInsert.id;

        // 2. 사진 업로드 및 URL 업데이트 로직 (casimport 함수와 동일)
        const photoUrls: { url_320: string | null; url_160: string | null } = { url_320: null, url_160: null };
        const uploadPromises = [];

        if (cabinetData.photo_320_base64) {
            const path_320 = `${cabinetId}_320.png`; // 파일 이름 규칙
            const imageData320 = decode(cabinetData.photo_320_base64.split(',')[1]);
            uploadPromises.push(supabase.storage.from('cabinet-photos').upload(path_320, imageData320, { contentType: 'image/png', upsert: true }));
        }
        if (cabinetData.photo_160_base64) {
            const path_160 = `${cabinetId}_160.png`;
            const imageData160 = decode(cabinetData.photo_160_base64.split(',')[1]);
            uploadPromises.push(supabase.storage.from('cabinet-photos').upload(path_160, imageData160, { contentType: 'image/png', upsert: true }));
        }

        const uploadResults = await Promise.all(uploadPromises);

        for (const result of uploadResults) {
            if (result.error) console.error("Storage 업로드 오류:", result.error.message);
            if (!result.data) continue;
            if (result.data.path.includes('_320.png')) {
                photoUrls.url_320 = supabase.storage.from('cabinet-photos').getPublicUrl(result.data.path).data.publicUrl;
            }
            if (result.data.path.includes('_160.png')) {
                photoUrls.url_160 = supabase.storage.from('cabinet-photos').getPublicUrl(result.data.path).data.publicUrl;
            }
        }

        if (photoUrls.url_320 || photoUrls.url_160) {
            const { error: updateError } = await supabase.from('Cabinet').update({ 
                photo_url_320: photoUrls.url_320,
                photo_url_160: photoUrls.url_160
            }).eq('id', cabinetId);
            if (updateError) console.error("사진 URL 업데이트 오류:", updateError.message);
        }

        return withCorsHeaders(new Response(JSON.stringify({ 
            status: 'success', 
            cabinetId: cabinetId,
            cabinetName: cabinetInsert.name
        }), { status: 200 }));

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('Cabinet Registration Fatal Error:', errorMessage);
        // ⬇️ [수정] 중복 오류 시 409 Conflict 상태 코드를 보내면 더 명확합니다.
        const status = errorMessage.includes('이미 존재합니다') ? 409 : 500;
        return withCorsHeaders(new Response(JSON.stringify({ error: errorMessage }), { status }));
    }
}

// ------------------------------------------------------------------
// DELETE 로직: 캐비닛 및 빈 Area 삭제 처리 (기존과 동일)
// ------------------------------------------------------------------
async function handleCabinetDeletion(req: Request) {
    try {
        const url = new URL(req.url);
        const cabinetId = url.searchParams.get('id');

        if (!cabinetId) {
            throw new Error('삭제할 캐비닛 ID가 필요합니다.');
        }

        const { data: cabinetToDelete, error: selectError } = await supabase
            .from('Cabinet')
            .select('area_id')
            .eq('id', cabinetId)
            .single();

        if (selectError || !cabinetToDelete) {
            throw new Error(`삭제할 캐비닛(ID: ${cabinetId})을 찾을 수 없습니다: ${selectError?.message || ''}`);
        }
        const { area_id } = cabinetToDelete;

        const { error: deleteError } = await supabase
            .from('Cabinet')
            .delete()
            .eq('id', cabinetId);

        if (deleteError) {
            throw new Error(`DB 삭제 오류: ${deleteError.message}`);
        }

        const { count, error: countError } = await supabase
            .from('Cabinet')
            .select('*', { count: 'exact', head: true })
            .eq('area_id', area_id);

        if (countError) {
            console.error(`캐비닛 개수 확인 중 오류: ${countError.message}`);
        }

        if (count === 0) {
            console.log(`Area (ID: ${area_id})에 남은 캐비닛이 없어 Area를 삭제합니다.`);
            const { error: areaDeleteError } = await supabase
                .from('Area')
                .delete()
                .eq('id', area_id);

            if (areaDeleteError) {
                console.error(`Area (ID: ${area_id}) 삭제 중 오류 발생: ${areaDeleteError.message}`);
            }
        }

        return withCorsHeaders(new Response(JSON.stringify({ message: `ID ${cabinetId} 캐비닛이 삭제되었습니다.` }), { status: 200 }));

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('Cabinet Deletion Fatal Error:', errorMessage);
        return withCorsHeaders(new Response(JSON.stringify({ error: errorMessage }), { status: 500 }));
    }
}

// ------------------------------------------------------------------
// 메인 라우터 함수 (기존과 동일)
// ------------------------------------------------------------------
serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
                'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    if (req.method === 'POST') {
        return await handleCabinetRegistration(req);
    }
    
    if (req.method === 'DELETE') {
        return await handleCabinetDeletion(req);
    }

    return withCorsHeaders(new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 }));
});