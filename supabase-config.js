// ===== KONFIGURACJA SUPABASE =====
// Konfiguracja jest pobierana z API endpoint /api/config
// Klucze są bezpiecznie przechowywane jako zmienne środowiskowe w Vercel

const SUPABASE_CONFIG = {
  url: '',
  anonKey: ''
};

// Pobierz konfigurację z API endpoint
async function loadSupabaseConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const config = await response.json();
      if (config.url && config.anonKey) {
        SUPABASE_CONFIG.url = config.url;
        SUPABASE_CONFIG.anonKey = config.anonKey;
        console.log('Supabase: Konfiguracja załadowana z API');
        return true;
      }
    }
    console.warn('Supabase: Nie udało się pobrać konfiguracji z API');
    return false;
  } catch (e) {
    console.error('Supabase: Błąd pobierania konfiguracji:', e);
    return false;
  }
}

window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.loadSupabaseConfig = loadSupabaseConfig;
