// ===== KONFIGURACJA SUPABASE =====
// WAŻNE: Ten plik zawiera klucze publiczne (anon key jest bezpieczny do użycia w przeglądarce)

const SUPABASE_CONFIG = {
    url: 'https://tiakzfgvaqimyqomccbx.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYWt6Zmd2YXFpbXlxb21jY2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDEwNDIsImV4cCI6MjA5MTIxNzA0Mn0._VCM_8PwS9R6b0SWyyDka9WjXOlCnlxvMIRJjEqDmcI'
};

// Eksport konfiguracji
if (typeof window !== 'undefined') {
    window.SUPABASE_CONFIG = SUPABASE_CONFIG;
}
