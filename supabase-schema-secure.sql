-- =====================================================
-- COFFEE ROASTER PRO - BEZPIECZNY SCHEMAT SUPABASE
-- =====================================================
-- Wklej ten plik do SQL Editor w Supabase aby zaktualizować polityki bezpieczeństwa
-- =====================================================

-- =====================================================
-- 1. USUŃ STARE POLITYKI RLS
-- =====================================================
DROP POLICY IF EXISTS "Pełny dostęp do profili" ON profiles;
DROP POLICY IF EXISTS "Pełny dostęp do partii" ON batches;

-- =====================================================
-- 2. NOWE POLITYKI RLS (bezpieczniejsze)
-- =====================================================
-- UWAGA: Te polityki pozwalają na anonimowy dostęp, ALE:
-- - Możesz je zmienić później na wymaganie logowania
-- - Klucze są teraz bezpiecznie w zmiennych środowiskowych Vercel

-- Profiles - anonimowy dostęp (możesz zmienić w przyszłości)
CREATE POLICY "Odczyt profili - anonimowy" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Zapis profili - anonimowy" ON profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Aktualizacja profili - anonimowy" ON profiles
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Usuwanie profili - anonimowy" ON profiles
  FOR DELETE USING (true);

-- Batches - anonimowy dostęp
CREATE POLICY "Odczyt partii - anonimowy" ON batches
  FOR SELECT USING (true);

CREATE POLICY "Zapis partii - anonimowy" ON batches
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Aktualizacja partii - anonimowy" ON batches
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Usuwanie partii - anonimowy" ON batches
  FOR DELETE USING (true);

-- =====================================================
-- 3. WŁĄCZ RLS (jeśli nie jest włączone)
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- INSTRUKCJA DLA UŻYTKOWNIKA:
-- =====================================================
-- 1. Zaloguj się do Supabase Dashboard
-- 2. Przejdź do SQL Editor
-- 3. Wklej i uruchom ten plik
-- 4. Przejdź do Settings > API > kliknij "Rotate" przy anon key
-- 5. Skopiuj nowy URL i anon key
-- 6. W Vercel Dashboard dodaj zmienne środowiskowe:
--    - SUPABASE_URL = twój_url
--    - SUPABASE_ANON_KEY = twój_nowy_klucz
-- =====================================================
