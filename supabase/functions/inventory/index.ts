import { serve } from 'std/http/server.ts';
import { supabase, corsHeaders, handleOptions, logError } from '../_shared/utils.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const id = url.searchParams.get('id');

    if (type === 'inventory-detail' && id) {
      const { data, error } = await supabase
        .from('Inventory')
        .select(`*, Substance(*, MSDS(*), Synonyms(*), Properties(*), Citations(*), HazardClassifications(*)), Cabinet(*)`)
        .eq('id', id)
        .single();
      if (error) throw new Error(`상세 조회 오류: ${error.message}`);
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    if (type === 'inventory') {
      const { data, error } = await supabase
        .from('Inventory')
        .select('*, Substance(*), Cabinet(*)')
        .order('id', { ascending: true });
      if (error) throw new Error(`목록 조회 오류: ${error.message}`);
      return new Response(JSON.stringify({ inventory: data }), { headers: corsHeaders });
    }

    const { data: areas, error: areaError } = await supabase.from('lab_rooms').select('*').order('id');
    const { data: cabinets, error: cabinetError } = await supabase.from('Cabinet').select('*');
    if (areaError) throw new Error(areaError.message);
    if (cabinetError) throw new Error(cabinetError.message);

    return new Response(JSON.stringify({ areas, cabinets }), { headers: corsHeaders });
  } catch (e) {
    return logError('INVENTORY Main', e);
  }
});
