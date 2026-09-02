const SUPABASE_URL="https://mirwbtlwglrpmbbqhfol.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_vaI958fVoME7adXeaa247A_2pfR3ogG";
const supabaseClient=window.supabase?window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
