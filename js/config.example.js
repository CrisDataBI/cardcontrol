// Copia este archivo como config.js y rellena tus credenciales de Supabase
// Las obtienes en: supabase.com → tu proyecto → Settings → API
const SUPABASE_URL = 'https://XXXXXXXXXX.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
