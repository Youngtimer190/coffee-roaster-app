// ===== KONFIGURACJA SUPABASE =====
// Anon key jest bezpieczny do użycia publicznego (nie jest sekretem)
// Na Vercel możesz nadpisać te wartości przez Environment Variables

const SUPABASE_CONFIG = {
  url: 'https://tiakzfgvaqimyqomccbx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYWt6Zmd2YXFpbXlxb21jY2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDEwNDIsImV4cCI6MjA5MTIxNzA0Mn0._VCM_8PwS9R6b0SWyyDka9WjXOlCnlxvMIRJjEqDmcI'
};

// Próba pobrania konfiguracji z API (nadpisuje hardcoded wartości)
async function loadSupabaseConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const config = await response.json();
      if (config.url && config.anonKey) {
        SUPABASE_CONFIG.url = config.url;
        SUPABASE_CONFIG.anonKey = config.anonKey;
        console.log('Supabase: Konfiguracja z Vercel Env');
      }
    }
  } catch (e) {
    // Brak API endpoint - użyj hardcoded wartości
  }
}

window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.loadSupabaseConfig = loadSupabaseConfig;
