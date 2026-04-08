// ===== KONFIGURACJA SUPABASE =====
// Na Vercelu zmienne są wstrzykiwane przez build
// Lokalnie możesz stworzyć plik .env lub wpisać bezpośrednio

// Te zmienne zostaną podmienione przez Vercel podczas build
const SUPABASE_URL = typeof window !== 'undefined' ? (window.SUPABASE_URL || '') : '';
const SUPABASE_ANON_KEY = typeof window !== 'undefined' ? (window.SUPABASE_ANON_KEY || '') : '';

const SUPABASE_CONFIG = {
    url: SUPABASE_URL || 'TU_WKLEJ_URL_PROJEKTU',
    anonKey: SUPABASE_ANON_KEY || 'TU_WKLEJ_ANON_KEY'
};

if (typeof window !== 'undefined') {
    window.SUPABASE_CONFIG = SUPABASE_CONFIG;
}
