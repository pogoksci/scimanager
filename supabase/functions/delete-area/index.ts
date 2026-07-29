// ================================================================
// /functions/delete-area/index.ts — Area 연동 공용 삭제 함수
// 시약장(Cabinet), 교구장(EquipmentCabinet) 등 공통 사용 가능
// ================================================================
import { serve } from "std/http/server.ts";
import {
  supabase,
  corsHeaders,
  handleOptions,
} from "../_shared/utils.ts";

serve(async (req) => {
  // ✅ OPTIONS (CORS Preflight)
  if (req.method === "OPTIONS") return handleOptions();

  // ✅ DELETE 메서드만 허용
  if (req.method !== "DELETE") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    // ------------------------------------------------------------
    // 1️⃣ URL 파라미터 읽기
    // ------------------------------------------------------------
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const table = url.searchParams.get("table") || "Cabinet"; // 기본: 시약장
    const relationColumn = url.searchParams.get("relation") || "area_id"; // 기본: area_id
    const relationTable = url.searchParams.get("relationTable") || "Area"; // 기본: Area

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id parameter" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    console.log(`🧩 [delete-area] 요청 수신 — table=${table}, id=${id}`);

    // ------------------------------------------------------------
    // 2️⃣ 삭제 대상 조회
    // ------------------------------------------------------------
    const { data: target, error: findErr } = await supabase
      .from(table)
      .select(`${relationColumn}, photo_url_320, photo_url_160`)
      .eq("id", id)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!target) throw new Error(`${table}(${id}) 정보를 찾을 수 없습니다.`);

    // 💡 Deno Lint 문제를 해결하기 위한 타입 정의 및 단언
    // 키가 문자열이고 값이 string, number, null 등을 가질 수 있는 객체임을 명시
    type AreaRelationTarget = {
      [key: string]: string | number | null | undefined;
    };

    // **target**에 정의된 타입을 단언하여 동적 키 접근을 허용
    const typedTarget = target as unknown as AreaRelationTarget;

    const areaId = typedTarget[relationColumn];
    console.log(`📦 관련 ${relationTable} ID: ${areaId}`);

    // ------------------------------------------------------------
    // 📸 사진 삭제 처리 (Cabinet, EquipmentCabinet 인 경우)
    // ------------------------------------------------------------
    const photoUrls = [typedTarget.photo_url_320, typedTarget.photo_url_160].filter(Boolean) as string[];

    if (photoUrls.length > 0) {
      const bucketName = "cabinet-photos";
      const pathsToDelete: string[] = [];

      for (const url of photoUrls) {
        try {
          // Public URL에서 경로 추출 (e.g. .../public/cabinet-photos/user_id/filename.jpg)
          // URL 형식이 https://[ref].supabase.co/storage/v1/object/public/[bucket]/[path] 인 경우
          const parts = url.split(`/public/${bucketName}/`);
          if (parts.length === 2) {
            pathsToDelete.push(parts[1]);
          }
        } catch (e) {
          console.error(`⚠️ URL 파싱 실패 (${url}):`, e);
        }
      }

      if (pathsToDelete.length > 0) {
        console.log(`🗑️ 스토리지 삭제 시도: ${pathsToDelete.join(", ")}`);
        const { error: storageErr } = await supabase.storage.from(bucketName).remove(pathsToDelete);
        if (storageErr) {
          console.error("⚠️ 스토리지 삭제 오류 (무시하고 계속 진행):", storageErr);
        } else {
          console.log("✅ 스토리지 파일 삭제 성공");
        }
      }
    }

    // ------------------------------------------------------------
    // 3️⃣ 주 테이블 항목 삭제
    // ------------------------------------------------------------
    const { error: delErr } = await supabase.from(table).delete().eq("id", id);
    if (delErr) throw delErr;

    // 💡 Area(lab_rooms) 제거 로직 삭제됨 (lab_rooms는 정적 데이터이므로 삭제하지 않음)


    // ------------------------------------------------------------
    // ✅ 정상 응답 반환
    // ------------------------------------------------------------
    return new Response(
      JSON.stringify({ success: true, deletedId: id, table }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const e = err as Error;
    console.error("❌ Delete-Area 실패:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
