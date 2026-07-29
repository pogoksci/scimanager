// /supabase/functions/usage-manager/index.ts
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
        const body = await req.json();
        const { action, ...payload } = body;

        console.log(`[UsageManager] Action: ${action}`, payload);

        const url = Deno.env.get("SUPABASE_URL");
        const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!url || !key) {
            console.error("[UsageManager] Missing environment variables");
            throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
        }

        const supabase = createClient(url, key);
        let resultData;

        // 1️⃣ REGISTER USAGE
        if (action === 'register_usage') {
            const {
                inventory_id,
                usage_date,
                subject,
                period,
                amount: inputAmount,
                remaining_mass,
                unit,
            } = payload;

            const { data: inventory, error: invError } = await supabase
                .from("Inventory")
                .select(`
                    id, current_amount, bottle_mass, concentration_unit, concentration_value, unit,
                    Substance ( Properties ( name, property ) )
                `)
                .eq("id", inventory_id)
                .single();

            if (invError) {
                console.error("[UsageManager] Inventory fetch error:", invError);
                throw new Error(`Inventory item fetch failed: ${invError.message}`);
            }
            if (!inventory) throw new Error("Inventory item not found");

            console.log("[UsageManager] Found inventory:", inventory);

            let calculatedUsage = 0;
            const substanceData = Array.isArray(inventory.Substance) ? inventory.Substance[0] : inventory.Substance;

            if (inputAmount !== undefined && inputAmount !== null && inputAmount !== "") {
                calculatedUsage = Number(inputAmount);
            } else if (remaining_mass !== undefined && remaining_mass !== null && remaining_mass !== "") {
                const massVal = Number(remaining_mass);
                const bottleMass = inventory.bottle_mass;

                if (bottleMass == null) {
                    console.error("[UsageManager] Missing bottle_mass");
                    throw new Error("Bottle mass is missing for this item. Cannot calculate usage by weight.");
                }

                const remainingContentMass = massVal - bottleMass;
                if (remainingContentMass < 0) throw new Error("Remaining mass cannot be less than bottle mass.");

                if (inventory.unit === 'g' || inventory.unit === 'kg' || inventory.unit === 'mg') {
                    calculatedUsage = (inventory.current_amount || 0) - remainingContentMass;
                } else if (inventory.unit === 'mL' || inventory.unit === 'L') {
                    const props = substanceData?.Properties || [];
                    const densityProp = props.find((p: any) => p.name === "Density");

                    if (!densityProp || !densityProp.property) {
                        console.error("[UsageManager] Missing Density prop for volume calc");
                        throw new Error("Density information missing for volume calculation.");
                    }

                    let density = parseFloat(densityProp.property);
                    if (isNaN(density)) throw new Error("Invalid density format.");

                    if (inventory.concentration_unit === '%') {
                        const conc = parseFloat(inventory.concentration_value);
                        if (!isNaN(conc)) {
                            const ratio = conc / 100;
                            density = (density * ratio) + (1.0 * (1 - ratio));
                        }
                    }

                    const remainingVolume = remainingContentMass / density;
                    calculatedUsage = (inventory.current_amount || 0) - remainingVolume;
                    calculatedUsage = Math.round(calculatedUsage * 100) / 100;
                } else {
                    throw new Error(`Unsupported unit for calculation: ${inventory.unit}`);
                }
            } else {
                throw new Error("Either amount or remaining_mass is required.");
            }

            console.log("[UsageManager] Calculated usage:", calculatedUsage);
            if (calculatedUsage <= 0) throw new Error(`Calculated usage is invalid: ${calculatedUsage}`);

            const { error: logError } = await supabase
                .from("UsageLog")
                .insert({
                    inventory_id,
                    usage_date,
                    subject,
                    period,
                    amount: calculatedUsage,
                    unit: inventory.unit
                });

            if (logError) {
                console.error("[UsageManager] UsageLog insert error:", logError);
                throw new Error(`UsageLog insert failed: ${logError.message}`);
            }

            const newAmount = (inventory.current_amount || 0) - calculatedUsage;
            const newStatus = newAmount <= 0 ? "전량소진" : "사용가능";
            const finalAmount = Math.max(0, newAmount);

            console.log("[UsageManager] Updating inventory amount to:", finalAmount);

            const { data: updatedInv, error: updateError } = await supabase
                .from("Inventory")
                .update({
                    current_amount: finalAmount,
                    status: newStatus
                })
                .eq("id", inventory_id)
                .select()
                .single();

            if (updateError) {
                console.error("[UsageManager] Inventory update error:", updateError);
                throw new Error(`Inventory update failed: ${updateError.message}`);
            }
            resultData = updatedInv;
        }

        // 2️⃣ UPDATE USAGE LOG (Inventory)
        else if (action === 'update_usage_log') {
            const { log_id, new_amount, new_date, new_subject, new_period } = payload;

            const { data: oldLog, error: fetchError } = await supabase
                .from("UsageLog")
                .select("amount, inventory_id")
                .eq("id", log_id)
                .single();

            if (fetchError || !oldLog) throw new Error("Log entry not found");

            const diff = Number(new_amount) - oldLog.amount;

            const { error: logUpdateError } = await supabase
                .from("UsageLog")
                .update({
                    amount: new_amount,
                    usage_date: new_date,
                    subject: new_subject,
                    period: new_period
                })
                .eq("id", log_id);

            if (logUpdateError) throw logUpdateError;

            const { data: inv, error: invFetchError } = await supabase.from("Inventory").select("current_amount").eq("id", oldLog.inventory_id).single();
            if (invFetchError) throw invFetchError;

            let newInvAmount = inv.current_amount - diff;
            newInvAmount = Math.max(0, newInvAmount);

            const { error: invUpdateError } = await supabase
                .from("Inventory")
                .update({ current_amount: newInvAmount })
                .eq("id", oldLog.inventory_id);

            if (invUpdateError) throw invUpdateError;
            resultData = { success: true };
        }

        // 3️⃣ DELETE USAGE LOG (Inventory)
        else if (action === 'delete_usage_log') {
            const { log_id } = payload;

            const { data: log, error: fetchError } = await supabase
                .from("UsageLog")
                .select("amount, inventory_id")
                .eq("id", log_id)
                .single();

            if (fetchError || !log) throw new Error("Log entry not found");

            const { error: deleteError } = await supabase
                .from("UsageLog")
                .delete()
                .eq("id", log_id);

            if (deleteError) throw deleteError;

            const { data: inv, error: invFetchError } = await supabase.from("Inventory").select("current_amount").eq("id", log.inventory_id).single();
            if (invFetchError) throw invFetchError;

            const newInvAmount = inv.current_amount + log.amount;
            const { error: invUpdateError } = await supabase
                .from("Inventory")
                .update({ current_amount: newInvAmount })
                .eq("id", log.inventory_id);

            if (invUpdateError) throw invUpdateError;
            resultData = { success: true };
        }

        // 4️⃣ REGISTER/UPDATE/DELETE KIT LOG
        else if (action === 'register_kit_usage' || action === 'update_kit_log' || action === 'delete_kit_log') {
            const { user_kit_id, user_id, amount, date, type, log_id } = payload;

            const { data: kit, error: kitFetchError } = await supabase
                .from('user_kits')
                .select('quantity')
                .eq('id', user_kit_id)
                .single();

            if (kitFetchError || !kit) throw new Error("Kit not found");

            if (action === 'register_kit_usage') {
                const change = (type === 'usage') ? -amount : amount;
                const newQuantity = kit.quantity + change;
                if (newQuantity < 0) throw new Error("Insufficient stock");

                const { error: updateError } = await supabase.from('user_kits').update({ quantity: newQuantity }).eq('id', user_kit_id);
                if (updateError) throw updateError;

                // Restored user_id
                const { error: logError } = await supabase.from('kit_usage_log').insert({
                    user_kit_id, user_id, change_amount: change, log_date: date, log_type: type
                });
                if (logError) throw logError;
                resultData = { success: true, newQuantity };
            }
            else if (action === 'update_kit_log') {
                const { data: oldLog, error: logFetchError } = await supabase.from('kit_usage_log').select('change_amount').eq('id', log_id).single();
                if (logFetchError || !oldLog) throw new Error("Old log not found");

                const newChange = (type === 'usage') ? -amount : amount;
                const diff = newChange - oldLog.change_amount;
                const newQuantity = kit.quantity + diff;
                if (newQuantity < 0) throw new Error("Insufficient stock after update");

                const { error: logUpdateError } = await supabase.from('kit_usage_log').update({
                    change_amount: newChange, log_date: date, log_type: type
                }).eq('id', log_id);
                if (logUpdateError) throw logUpdateError;

                const { error: updateError } = await supabase.from('user_kits').update({ quantity: newQuantity }).eq('id', user_kit_id);
                if (updateError) throw updateError;
                resultData = { success: true, newQuantity };
            }
            else if (action === 'delete_kit_log') {
                const { data: log, error: logFetchError } = await supabase.from('kit_usage_log').select('change_amount').eq('id', log_id).single();
                if (logFetchError || !log) throw new Error("Log not found");

                const revertedStock = kit.quantity - log.change_amount;
                if (revertedStock < 0) throw new Error("Insufficient stock after deletion revert");

                const { error: deleteError } = await supabase.from('kit_usage_log').delete().eq('id', log_id);
                if (deleteError) throw deleteError;

                const { error: updateError } = await supabase.from('user_kits').update({ quantity: revertedStock }).eq('id', user_kit_id);
                if (updateError) throw updateError;
                resultData = { success: true, newQuantity: revertedStock };
            }
        }

        // 5️⃣ REGISTER/UPDATE/DELETE TOOL LOG
        else if (action === 'register_tool_usage' || action === 'update_tool_log' || action === 'delete_tool_log') {
            const { tool_id, user_id, change_amount, new_quantity, reason, date, log_id } = payload;

            const { data: tool, error: toolFetchError } = await supabase
                .from('tools')
                .select('requirement, stock')
                .eq('id', tool_id)
                .single();

            if (toolFetchError || !tool) throw new Error("Tool not found");

            if (action === 'register_tool_usage') {
                const req = Number(tool.requirement) || 0;
                const proportion = req > 0 ? new_quantity / req : 0;

                const { error: updateError } = await supabase.from('tools').update({
                    stock: new_quantity, proportion: parseFloat(proportion.toFixed(4))
                }).eq('id', tool_id);
                if (updateError) throw updateError;

                // Restored user_id
                const { error: logError } = await supabase.from('tools_usage_log').insert({
                    tools_id: tool_id, user_id, change_amount, final_quantity: new_quantity, reason, created_at: date
                });
                if (logError) throw logError;
                resultData = { success: true, newQuantity: new_quantity };
            }
            else if (action === 'update_tool_log') {
                const { data: oldLog, error: logFetchError } = await supabase.from('tools_usage_log').select('change_amount').eq('id', log_id).single();
                if (logFetchError || !oldLog) throw new Error("Old log not found");

                const diff = (change_amount || 0) - (oldLog.change_amount || 0);
                const updatedStock = tool.stock + diff;
                if (updatedStock < 0) throw new Error("Insufficient stock after update");

                const req = Number(tool.requirement) || 0;
                const proportion = req > 0 ? updatedStock / req : 0;

                const { error: logUpdateError } = await supabase.from('tools_usage_log').update({
                    change_amount, final_quantity: updatedStock, reason, created_at: date
                }).eq('id', log_id);
                if (logUpdateError) throw logUpdateError;

                const { error: updateError } = await supabase.from('tools').update({
                    stock: updatedStock, proportion: parseFloat(proportion.toFixed(4))
                }).eq('id', tool_id);
                if (updateError) throw updateError;
                resultData = { success: true, newQuantity: updatedStock };
            }
            else if (action === 'delete_tool_log') {
                const { data: log, error: logFetchError } = await supabase.from('tools_usage_log').select('change_amount').eq('id', log_id).single();
                if (logFetchError || !log) throw new Error("Log not found");

                const revertedStock = tool.stock - log.change_amount;
                if (revertedStock < 0) throw new Error("Insufficient stock after deletion revert");

                const req = Number(tool.requirement) || 0;
                const proportion = req > 0 ? revertedStock / req : 0;

                const { error: deleteError } = await supabase.from('tools_usage_log').delete().eq('id', log_id);
                if (deleteError) throw deleteError;

                const { error: updateError } = await supabase.from('tools').update({
                    stock: revertedStock, proportion: parseFloat(proportion.toFixed(4))
                }).eq('id', tool_id);
                if (updateError) throw updateError;
                resultData = { success: true, newQuantity: revertedStock };
            }
        }

        else if (action === 'test') {
            resultData = { message: "Connectivity OK", env: { url: !!url, key: !!key } };
        }
        else {
            throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ success: true, data: resultData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        const error = err as Error;
        console.error("[UsageManager] Runtime Error:", error.message);
        console.error(error.stack);

        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack,
            context: "Edge Function Runtime Exception",
            details: (err as any).details || (err as any).hint || null
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
