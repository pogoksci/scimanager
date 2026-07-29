// /functions/_shared/utils.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** ✅ 환경 변수 */
export const SUPABASE_URL = Deno.env.get('PROJECT_URL')!;
export const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const CAS_API_KEY = Deno.env.get('CAS_API_KEY')!;
export const KOSHA_API_KEY = Deno.env.get('KOSHA_API_KEY')!;
export const KREACH_API_KEY = Deno.env.get('KREACH_API_KEY')!;

/** ✅ 공통 CORS 헤더 */
export const ALLOWED_ORIGIN = '*';
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': "GET, POST, PATCH, DELETE, OPTIONS", // 이 함수가 사용할 HTTP 메서드 포함
};

/** ✅ Supabase 클라이언트 생성 */
export const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
});

/** ✅ 에러 로깅 함수 */
export function logError(context: string, error: unknown): Response {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object"
        ? JSON.stringify(error)
        : String(error);

  console.error(`[${context}]`, message);

  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export function handleOptions(): Response {
  return new Response("ok", { headers: corsHeaders });
}
