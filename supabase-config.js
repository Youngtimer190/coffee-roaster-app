// ===== KONFIGURACJA SUPABASE =====
// Na Vercel: pobierana z API endpoint /api/config (zmienne środowiskowe)
// Lokalnie: można użyć supabase-config.local.js (gitignored) do developmentu

const SUPABASE_CONFIG = {
  url: '',
  anonKey: ''
};

// Pobierz konfigurację z API endpoint lub użyj konfiguracji lokalnej
async function loadSupabaseConfig() {
  // Sprawdź czy jest konfiguracja lokalna (dla developmentu)
  if (window.SUPABASE_CONFIG_LOCAL && window.SUPABASE_CONFIG_LOCAL.url && window.SUPABASE_CONFIG_LOCAL.anonKey) {
    SUPABASE_CONFIG.url = window.SUPABASE_CONFIG_LOCAL.url;
    SUPABASE_CONFIG.anonKey = window.SUPABASE_CONFIG_LOCAL.anonKey;
    console.log('Supabase: Użyto konfiguracji lokalnej');
    return true;
  }

  // Próbuj pobrać z API endpoint (Vercel)
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
  } catch (e) {
    console.warn('Supabase: API endpoint niedostępny (prawdopodobnie środowisko lokalne)');
  }

  console.error('Supabase: Brak konfiguracji!');
  console.error('Dla developmentu lokalnego:');
  console.error('1. Skopiuj supabase-config.local.example.js jako supabase-config.local.js');
  console.error('2. Uzupełnij swoje klucze Supabase w supabase-config.local.js');
  return false;
}

window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.loadSupabaseConfig = loadSupabaseConfig;
