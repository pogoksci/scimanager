import { serve } from "std/http/server.ts";
import { supabase, corsHeaders, handleOptions, logError } from "../_shared/utils.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  try {
    const {
      mode, // 'create' | 'edit'
      id, // target user_kit id (if edit mode)
      kit_id, // ✅ Added: Explicit Catalog ID
      kit_name,
      kit_class,
      kit_cas, // optional (for custom kit creation)
      kit_person, // ✅ Added: Kit Person (people per kit)
      quantity,
      purchase_date,
      photo_base64,
      location // ✅ Added
    } = await req.json();

    // 0️⃣ AUTHENTICATION CHECK
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Check if kit exists in 'experiment_kit' catalog. If not, create it (Custom Kit).
    let catalogId = kit_id || null; // Use provided ID if available

    if (!catalogId) {
      // Attempt to find existing by name
      const { data: existingCatalog, error: findError } = await supabase
        .from("experiment_kit")
        .select("id")
        .eq("kit_name", kit_name)
        .maybeSingle();

      if (findError) throw findError;

      if (existingCatalog) {
        catalogId = existingCatalog.id;
      } else {
        // Create new catalog entry
        const { data: newCatalog, error: createError } = await supabase
          .from("experiment_kit")
          .insert({
            kit_name,
            kit_class,
            kit_cas: kit_cas || null,
            kit_person: kit_person || null // ✅ Added: Save person count to catalog
          })
          .select("id")
          .single();

        if (createError) throw createError;
        catalogId = newCatalog.id;
      }
    }

    // 2️⃣ IMAGE UPLOAD
    // Upload to 'kit-photos' bucket if photo is provided
    let image_url = null;

    if (photo_base64) {
      const matches = photo_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const type = matches[1];
        const buffer = Uint8Array.from(atob(matches[2]), c => c.charCodeAt(0));
        const filename = `kit_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('kit-photos')
          .upload(filename, buffer, { contentType: type, upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('kit-photos')
          .getPublicUrl(filename);

        image_url = publicUrlData.publicUrl;
      }
    }

    // 3️⃣ INVENTORY MANAGEMENT (user_kits)
    const payload: any = {
      user_id: user.id, // ✅ Explicitly set Owner (since Service Role client is used)
      kit_id: catalogId, // ✅ Map Catalog ID
      kit_class,
      kit_name,
      kit_person, // ✅ Added Person info
      quantity,
      purchase_date,
      location // ✅ Added
    };

    if (image_url) {
      payload.image_url = image_url;
    }

    let resultData;

    if (mode === 'edit') {
      if (!id) throw new Error("ID is required for edit mode");
      const { data, error } = await supabase
        .from('user_kits')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      resultData = data;
    } else {
      const { data, error } = await supabase
        .from('user_kits')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      resultData = data;
    }

    return new Response(JSON.stringify({ success: true, data: resultData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return logError("Kit Register", err);
  }
});

