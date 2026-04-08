-- =====================================================
-- COFFEE ROASTER PRO - SCHEMAT BAZY DANYCH SUPABASE
-- =====================================================
-- Wklej całą zawartość tego pliku do edytora SQL w Supabase:
-- Dashboard -> SQL Editor -> New Query -> Paste -> Run
-- =====================================================

-- Usuń istniejące tabele jeśli istnieją (uwaga: to usunie dane!)
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- =====================================================
-- TABELA PROFILES (Profile palenia)
-- =====================================================
CREATE TABLE profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    bean_type TEXT DEFAULT 'arabica',
    origin TEXT,
    stages JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy dla profiles
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

-- =====================================================
-- TABELA BATCHES (Partie palenia)
-- =====================================================
CREATE TABLE batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight DECIMAL(10,2) NOT NULL,
    roast_level TEXT DEFAULT 'medium',
    duration DECIMAL(5,1),
    final_temp DECIMAL(6,2),
    rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 10),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy dla batches
CREATE INDEX idx_batches_date ON batches(date DESC);
CREATE INDEX idx_batches_profile_id ON batches(profile_id);
CREATE INDEX idx_batches_roast_level ON batches(roast_level);

-- =====================================================
-- POLITYKA RLS (Row Level Security)
-- =====================================================
-- Włącz RLS dla obu tabel
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- Polityki pozwalające na pełny dostęp dla anonimowych użytkowników
-- (dla aplikacji bez logowania - możesz dostosować później)

-- Profiles - pełny dostęp
CREATE POLICY "Pełny dostęp do profili" ON profiles
    FOR ALL USING (true) WITH CHECK (true);

-- Batches - pełny dostęp
CREATE POLICY "Pełny dostęp do partii" ON batches
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGER do aktualizacji updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger dla profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger dla batches
CREATE TRIGGER update_batches_updated_at
    BEFORE UPDATE ON batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- KOMENTARZE DO TABEL (opcjonalnie)
-- =====================================================
COMMENT ON TABLE profiles IS 'Profile palenia kawy';
COMMENT ON TABLE batches IS 'Historia partii palenia kawy';

COMMENT ON COLUMN profiles.stages IS 'JSON array z etapami: [{temp, time, note}]';
COMMENT ON COLUMN batches.roast_level IS 'green/cinnamon/light/medium/medium-dark/dark/french/italian';
