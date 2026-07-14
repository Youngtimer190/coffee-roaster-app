// ===== LOKALNA KONFIGURACJA SUPABASE (DO DEVELOPMENTU) =====
// Skopiuj ten plik jako supabase-config.local.js i uzupełnij swoje klucze
// Plik supabase-config.local.js jest w .gitignore - nie commituj swoich kluczy!

const SUPABASE_CONFIG_LOCAL = {
  url: 'https://tiakzfgvaqimyqomccbx.supabase.co',  // <-- Twój URL Supabase
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYWt6Zmd2YXFpbXlxb21jY2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDEwNDIsImV4cCI6MjA5MTIxNzA0Mn0._VCM_8PwS9R6b0SWyyDka9WjXOlCnlxvMIRJjEqDmcI'  // <-- Twój anon key
};

window.SUPABASE_CONFIG_LOCAL = SUPABASE_CONFIG_LOCAL;
