// /supabase/functions/waste-manager/index.ts
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

    const {
      action, // 'register_log' | 'process_disposal' | 'delete_log'
      ...payload
    } = await req.json();

    let resultData;

    // 1️⃣ REGISTER LOG (logs waste generation)
    if (action === 'register_log') {
      const {
        mode, // 'create' | 'edit'
        id,
        date,
        classification,
        amount: directAmount, // Optional (Direct input)
        total_mass_log: totalMass, // Optional (Total mass input)
        unit = 'g',
        manager,
        remarks
      } = payload;

      let finalAmount = 0;
      let finalTotalMass = null;

      if (directAmount !== undefined && directAmount !== null && directAmount !== "") {
        // Direct amount input
        finalAmount = Number(directAmount);
        // Check for previous logs to warn if this is first log without total_mass (handled in UI mostly, but good to know)
      } else if (totalMass !== undefined && totalMass !== null && totalMass !== "") {
        // Total mass calculation
        finalTotalMass = Number(totalMass);

        // Fetch previous latest log for this classification
        let query = supabase
          .from("WasteLog")
          .select("total_mass_log")
          .eq("classification", classification)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1);

        if (mode === 'edit' && id) {
          query = query.neq("id", id);
        }

        const { data: lastLog } = await query.maybeSingle();
        const prevTotal = (lastLog && lastLog.total_mass_log) ? Number(lastLog.total_mass_log) : 0;

        finalAmount = finalTotalMass - prevTotal;

        // Note: Negative amount check is usually done in UI confirmation. 
        // Here we accept it, as it might be a reset/empty event.
      } else {
        throw new Error("Either amount or total_mass_log is required.");
      }

      const dbPayload = {
        date,
        classification,
        amount: finalAmount,
        total_mass_log: finalTotalMass,
        unit,
        manager,
        remarks
      };

      if (mode === 'edit' && id) {
        const { data, error } = await supabase.from("WasteLog").update(dbPayload).eq("id", id).select().single();
        if (error) throw error;
        resultData = data;
      } else {
        const { data, error } = await supabase.from("WasteLog").insert(dbPayload).select().single();
        if (error) throw error;
        resultData = data;
      }
    }

    // 2️⃣ PROCESS DISPOSAL (logs disposal transaction)
    else if (action === 'process_disposal') {
      const {
        classification,
        company_name,
        date,
        total_amount,
        manager
      } = payload;

      // A. Create Disposal Record
      const { data: disposalData, error: disposalError } = await supabase
        .from("WasteDisposal")
        .insert({
          date,
          classification,
          total_amount,
          company_name,
          manager
        })
        .select()
        .single();

      if (disposalError) throw disposalError;

      // B. Update related logs
      const { error: updateError } = await supabase
        .from("WasteLog")
        .update({ disposal_id: disposalData.id })
        .eq("classification", classification)
        .is("disposal_id", null)
        .lte("date", date); // ✅ Modified: Filter by date

      if (updateError) {
        // Rollback disposal creation if possible, or just throw
        await supabase.from("WasteDisposal").delete().eq("id", disposalData.id);
        throw updateError;
      }

      resultData = disposalData;
    }

    // 3️⃣ DELETE LOG
    else if (action === 'delete_log') {
      const { id } = payload;
      const { error } = await supabase.from("WasteLog").delete().eq("id", id);
      if (error) throw error;
      resultData = { success: true };
    }

    else {
      throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: resultData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
