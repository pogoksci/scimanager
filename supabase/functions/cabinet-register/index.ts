// /functions/cabinet-register/index.ts
import { serve } from "std/http/server.ts";
import { decode } from "std/encoding/base64.ts";
import {
  supabase,
  corsHeaders,
  handleOptions,
  logError,
} from "../_shared/utils.ts";

/* ------------------------------------------------------------------
   📦 사진 업로드 (POST와 PATCH에서 공용으로 사용)
------------------------------------------------------------------ */
async function uploadCabinetPhotos(
  cabinetId: number,
  photo_320_base64?: string,
  photo_160_base64?: string,
): Promise<{ photo_url_320: string | null; photo_url_160: string | null }> {
  const bucket = "cabinet-photos";
  const photoUrls = {
    photo_url_320: null as string | null,
    photo_url_160: null as string | null,
  };

  const uploadPromises: Promise<{
    data: { path: string } | null;
    error: { message: string } | null;
  }>[] = [];

  if (photo_320_base64) {
    const data = decode((photo_320_base64.split(",")[1] || "").trim());
    const path = `${cabinetId}_320.png`;
    uploadPromises.push(
      supabase.storage.from(bucket)
        .upload(path, data, { contentType: "image/png", upsert: true }),
    );
  }

  if (photo_160_base64) {
    const data = decode((photo_160_base64.split(",")[1] || "").trim());
    const path = `${cabinetId}_160.png`;
    uploadPromises.push(
      supabase.storage.from(bucket)
        .upload(path, data, { contentType: "image/png", upsert: true }),
    );
  }

  const results = await Promise.allSettled(uploadPromises);

  for (const result of results) {
    if (result.status === "fulfilled") {
      const r = result.value;
      if (r.error) {
        console.error("Storage Upload Error:", r.error.message);
        continue;
      }
      if (!r.data?.path) continue;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(
        r.data.path,
      );
      if (r.data.path.includes("_320.png")) photoUrls.photo_url_320 = pub.publicUrl;
      if (r.data.path.includes("_160.png")) photoUrls.photo_url_160 = pub.publicUrl;
    } else {
      console.error("Storage 업로드 실패:", result.reason);
    }
  }

  return photoUrls;
}

/* ------------------------------------------------------------------
   🏷 Area ID 조회 또는 생성
------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   🏷 [수정됨] Area ID는 클라이언트에서 전달받음
   (lab_rooms 테이블은 고정 데이터이므로 동적 생성/삭제 하지 않음)
------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   🧩 POST: 새 시약장 등록
------------------------------------------------------------------ */
async function handlePost(req: Request) {
  const {
    area_id, // ✅ area_name 대신 area_id 수신
    cabinet_name,
    photo_320_base64,
    photo_160_base64,
    ...rest
  } = await req.json();

  if (!cabinet_name) throw new Error("시약장 이름이 누락되었습니다.");
  if (!area_id) throw new Error("장소(area_id) 정보가 누락되었습니다.");

  const { data: existing } = await supabase
    .from("Cabinet")
    .select("id")
    .eq("area_id", area_id)
    .eq("cabinet_name", cabinet_name)
    .single();

  if (existing) {
    throw new Error(`'${cabinet_name}' 시약장이 해당 장소에 이미 존재합니다.`);
  }

  const { data: newCabinet, error } = await supabase
    .from("Cabinet")
    .insert({
      area_id: area_id,
      cabinet_name,
      door_vertical_count: rest.door_vertical_count || 1,
      door_horizontal_count: rest.door_horizontal_count || 1,
      shelf_height: rest.shelf_height || 1,
      storage_columns: rest.storage_columns || 1,
      // user_id is optional/managed by RLS or passed in body?
      // utils.js updates user_id. We can add it if passed.
      user_id: rest.user_id || undefined
    })
    .select("id, cabinet_name")
    .single();

  if (error) throw error;

  if (photo_320_base64 || photo_160_base64) {
    const { photo_url_320, photo_url_160 } = await uploadCabinetPhotos(
      newCabinet.id,
      photo_320_base64,
      photo_160_base64,
    );
    await supabase.from("Cabinet").update({ photo_url_320, photo_url_160 }).eq("id", newCabinet.id);
  }

  return new Response(JSON.stringify(newCabinet), { status: 201 });
}

/* ------------------------------------------------------------------
   🧱 PATCH: 시약장 정보 수정
------------------------------------------------------------------ */
async function handlePatch(req: Request) {
  const body = await req.json();
  const {
    cabinet_id,
    cabinet_name,
    area_id, // ✅ area_name에서 변경
    photo_320_base64,
    photo_160_base64,
    ...rest
  } = body;

  if (!cabinet_id) throw new Error("수정할 시약장의 ID가 없습니다.");

  // 🔹 3️⃣ 업데이트 페이로드 준비
  const updatePayload: Record<string, unknown> = {
    ...rest,
    cabinet_name,
  };

  // area_id가 있으면 업데이트
  if (area_id) {
    updatePayload.area_id = area_id;
  }

  // 🔹 4️⃣ 이미지 업로드 (선택적)
  if (photo_320_base64 || photo_160_base64) {
    const photoUrls = await uploadCabinetPhotos(
      cabinet_id,
      photo_320_base64,
      photo_160_base64,
    );
    updatePayload.photo_url_320 = photoUrls.photo_url_320;
    updatePayload.photo_url_160 = photoUrls.photo_url_160;
  }

  // 🔹 5️⃣ Cabinet 업데이트 실행
  const { error: updateErr } = await supabase
    .from("Cabinet")
    .update(updatePayload)
    .eq("id", cabinet_id);

  if (updateErr) throw updateErr;

  // 🧹 Area 자동 삭제 로직 제거됨 (lab_rooms는 고정)

  return new Response(
    JSON.stringify({ message: "성공적으로 수정되었습니다." }),
    { status: 200 },
  );
}

/* ------------------------------------------------------------------
   🗑 DELETE: 시약장 삭제
------------------------------------------------------------------ */
async function handleDelete(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("삭제할 시약장 ID가 없습니다.");

  const { error: delErr } = await supabase
    .from("Cabinet")
    .delete()
    .eq("id", id);
  if (delErr) throw delErr;

  // 🧹 Area 자동 삭제 로직 제거됨 (lab_rooms는 고정)

  return new Response(
    JSON.stringify({ message: "성공적으로 삭제되었습니다." }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/* ------------------------------------------------------------------
   🚀 메인 라우터 — 공용 CORS 헤더 일괄 적용
------------------------------------------------------------------ */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();

  try {
    let response: Response;
    switch (req.method) {
      case "POST":
        response = await handlePost(req);
        break;
      case "PATCH":
        response = await handlePatch(req);
        break;
      case "DELETE":
        response = await handleDelete(req);
        break;
      default:
        response = new Response(
          JSON.stringify({ error: "Method Not Allowed" }),
          { status: 405 },
        );
    }

    // ✅ 공용 CORS 헤더 적용 (통합 처리)
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) =>
      headers.set(key, value)
    );
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (e) {
    return logError("Cabinet-Register Main", e);
  }
});
