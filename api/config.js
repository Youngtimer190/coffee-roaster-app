// API endpoint do bezpiecznego pobierania konfiguracji Supabase
// Na Vercel zmienne środowiskowe są bezpiecznie przechowywane

export default function handler(req, res) {
  // Ustaw nagłówki CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-store');

  // Zwróć konfigurację ze zmiennych środowiskowych Vercel
  res.status(200).json({
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  });
}
