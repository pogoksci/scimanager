import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const {
      method,
      cabinet_name,
      area_id,
      photo_320_base64,
      photo_160_base64,
      door_vertical_count
    } = body;

    const cabinet_id = body.cabinet_id || body.id; // ✅ Handle both for robustness

    // 1️⃣ LOCATION (Area) VALIDATION
    // lab_rooms ID provided from client
    if (!area_id && (method === 'POST' || method === 'PATCH')) {
      // PATCH might be partial, but usually location is key. 
      // If optional updates allowed without area_id, we need check.
      // But let's assume if it creates/updates, area_id is key.
      // Actually, for PATCH, if area_id is missing, we might keep existing?
      // Let's stick to simple logic: if passed, use it.
    }

    // 2️⃣ IMAGE UPLOAD
    // Upload to 'equipment-cabinets' bucket
    let photo_url_320 = null;
    let photo_url_160 = null;

    // Helper to upload base64
    const uploadImage = async (base64: string, path: string) => {
      const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) return null;

      const type = matches[1];
      const buffer = Uint8Array.from(atob(matches[2]), c => c.charCodeAt(0));

      const { data, error } = await supabase.storage
        .from('equipment-cabinets')
        .upload(path, buffer, { contentType: type, upsert: true });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from('equipment-cabinets')
        .getPublicUrl(path);

      return publicUrl.publicUrl;
    };

    if (photo_320_base64) {
      const filename = `equip_${Date.now()}_320.jpg`;
      photo_url_320 = await uploadImage(photo_320_base64, filename);
    }

    if (photo_160_base64) {
      const filename = `equip_${Date.now()}_160.jpg`;
      photo_url_160 = await uploadImage(photo_160_base64, filename);
    }

    // 3️⃣ DB OPERATION
    const payload: any = {
      cabinet_name,
      door_vertical_count, // Can be null
    };

    if (area_id) {
      payload.area_id = area_id;
    }

    // Only update photo URLs if new ones were uploaded
    if (photo_url_320) payload.photo_url_320 = photo_url_320;
    if (photo_url_160) payload.photo_url_160 = photo_url_160;

    const action = method || req.method;

    if (action === 'POST') {
      if (!area_id) throw new Error("Area ID required for creation");
      const { error } = await supabase.from('EquipmentCabinet').insert(payload);
      if (error) throw error;
    } else if (action === 'PATCH') {
      if (!cabinet_id) throw new Error("Cabinet ID required for update");
      const { error } = await supabase.from('EquipmentCabinet').update(payload).eq('id', cabinet_id);
      if (error) throw error;
    } else if (action === 'DELETE') {
      if (!cabinet_id) throw new Error("Cabinet ID required for delete");

      // 1. Fetch record to get photo paths
      const { data: cabinet, error: fetchError } = await supabase
        .from('EquipmentCabinet')
        .select('photo_url_320, photo_url_160')
        .eq('id', cabinet_id)
        .single();

      if (!fetchError && cabinet) {
        const pathsToDelete: string[] = [];
        const extractPath = (url: string) => {
          if (!url) return null;
          const parts = url.split('/');
          return parts[parts.length - 1]; // filename
        };

        const p320 = extractPath(cabinet.photo_url_320);
        if (p320) pathsToDelete.push(p320);
        const p160 = extractPath(cabinet.photo_url_160);
        if (p160) pathsToDelete.push(p160);

        if (pathsToDelete.length > 0) {
          console.log("🗑️ Deleting photos from storage:", pathsToDelete);
          await supabase.storage.from('equipment-cabinets').remove(pathsToDelete);
        }
      }

      // 2. Delete record
      const { error } = await supabase.from('EquipmentCabinet').delete().eq('id', cabinet_id);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
