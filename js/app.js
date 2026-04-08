// ===== COFFEE ROASTER APP with SUPABASE =====
// Aplikacja do śledzenia profili i partii palenia kawy

class CoffeeRoasterApp {
    constructor() {
        // Dane aplikacji - tymczasowe cache
        this.profiles = [];
        this.batches = [];
        this.currentView = 'dashboard';
        this.editingProfileId = null;
        this.editingBatchId = null;

        // Wake Lock - blokowanie ekranu
        this.wakeLock = null;
        this.noSleep = null; // NoSleep.js for iOS

        // Tryb palenia
        this.roastingProfile = null;
        this.roastingTime = 0;
        this.roastingInterval = null;
        this.roastingFCClicked = false;
        this.roastingActualFCTime = null;
        this.activeProfileId = null;
        this.roastingPaused = false;

        // Stan połączenia z Supabase
        this.supabaseReady = false;

        this.init();
    }

    // ===== INICJALIZACJA =====
    async init() {
        // Inicjalizuj Supabase
        await this.initSupabase();

        this.setupNavigation();
        this.setupProfileModal();
        this.setupBatchModal();
        this.setupCalculators();
        this.setupProfileViewModal();
        this.setupRoastingModal();

        this.setupWakeLock();

        this.setupiOSViewportFix();

        // Załaduj dane z Supabase
        await this.loadDashboard();
        await this.loadProfiles();
        await this.loadBatches();
    }

    // ===== SUPABASE =====
    async initSupabase() {
        try {
            // Sprawdź czy konfiguracja jest ustawiona
            if (!window.SUPABASE_CONFIG ||
                window.SUPABASE_CONFIG.url === 'TU_WKLEJ_URL_PROJEKTU' ||
                window.SUPABASE_CONFIG.anonKey === 'TU_WKLEJ_ANON_KEY') {
                console.error('Supabase: Brak konfiguracji! Uzupełnij supabase-config.js');
                this.showToast('Błąd: Skonfiguruj Supabase w supabase-config.js', 'error');
                return;
            }

            // Inicjalizuj klienta Supabase
            this.supabase = window.supabase.createClient(
                window.SUPABASE_CONFIG.url,
                window.SUPABASE_CONFIG.anonKey
            );

            // Test połączenia
            const { error } = await this.supabase.from('profiles').select('count', { count: 'exact', head: true });
            if (error) {
                console.error('Supabase: Błąd połączenia:', error);
                this.showToast('Błąd połączenia z bazą danych', 'error');
            } else {
                console.log('Supabase: Połączono pomyślnie');
                this.supabaseReady = true;
            }
        } catch (err) {
            console.error('Supabase: Błąd inicjalizacji:', err);
            this.showToast('Błąd inicjalizacji Supabase', 'error');
        }
    }

    // ----- PROFILES CRUD -----

    async fetchProfiles() {
        if (!this.supabaseReady) return [];

        const { data, error } = await this.supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Błąd pobierania profili:', error);
            this.showToast('Błąd pobierania profili', 'error');
            return [];
        }

        // Konwertuj format z Supabase do formatu aplikacji
        return data.map(p => ({
            id: p.id,
            name: p.name,
            beanType: p.bean_type || 'arabica',
            origin: p.origin || '',
            stages: p.stages || [],
            notes: p.notes || '',
            createdAt: p.created_at,
            updatedAt: p.updated_at
        }));
    }

    async createProfile(profileData) {
        if (!this.supabaseReady) return null;

        const dbData = {
            name: profileData.name,
            bean_type: profileData.beanType || 'arabica',
            origin: profileData.origin || '',
            stages: profileData.stages || [],
            notes: profileData.notes || ''
        };

        const { data, error } = await this.supabase
            .from('profiles')
            .insert(dbData)
            .select()
            .single();

        if (error) {
            console.error('Błąd tworzenia profilu:', error);
            this.showToast('Błąd zapisywania profilu', 'error');
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            beanType: data.bean_type,
            origin: data.origin,
            stages: data.stages,
            notes: data.notes,
            createdAt: data.created_at
        };
    }

    async updateProfile(id, profileData) {
        if (!this.supabaseReady) return false;

        const dbData = {
            name: profileData.name,
            bean_type: profileData.beanType || 'arabica',
            origin: profileData.origin || '',
            stages: profileData.stages || [],
            notes: profileData.notes || ''
        };

        const { error } = await this.supabase
            .from('profiles')
            .update(dbData)
            .eq('id', id);

        if (error) {
            console.error('Błąd aktualizacji profilu:', error);
            this.showToast('Błąd aktualizacji profilu', 'error');
            return false;
        }

        return true;
    }

    async deleteProfileFromDB(id) {
        if (!this.supabaseReady) return false;

        const { error } = await this.supabase
            .from('profiles')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania profilu:', error);
            this.showToast('Błąd usuwania profilu', 'error');
            return false;
        }

        return true;
    }

    // ----- BATCHES CRUD -----

    async fetchBatches() {
        if (!this.supabaseReady) return [];

        const { data, error } = await this.supabase
            .from('batches')
            .select('*, profile:profiles(id, name)')
            .order('date', { ascending: false });

        if (error) {
            console.error('Błąd pobierania partii:', error);
            this.showToast('Błąd pobierania partii', 'error');
            return [];
        }

        // Konwertuj format
        return data.map(b => ({
            id: b.id,
            profileId: b.profile_id,
            profileName: b.profile?.name || null,
            date: b.date,
            weight: b.weight,
            roastLevel: b.roast_level || 'medium',
            duration: b.duration,
            finalTemp: b.final_temp,
            rating: b.rating,
            notes: b.notes || '',
            createdAt: b.created_at,
            updatedAt: b.updated_at
        }));
    }

    async createBatch(batchData) {
        if (!this.supabaseReady) return null;

        const dbData = {
            profile_id: batchData.profileId || null,
            date: batchData.date,
            weight: batchData.weight,
            roast_level: batchData.roastLevel || 'medium',
            duration: batchData.duration || null,
            final_temp: batchData.finalTemp || null,
            rating: batchData.rating || 5,
            notes: batchData.notes || ''
        };

        const { data, error } = await this.supabase
            .from('batches')
            .insert(dbData)
            .select()
            .single();

        if (error) {
            console.error('Błąd tworzenia partii:', error);
            this.showToast('Błąd zapisywania partii', 'error');
            return null;
        }

        return {
            id: data.id,
            profileId: data.profile_id,
            date: data.date,
            weight: data.weight,
            roastLevel: data.roast_level,
            duration: data.duration,
            finalTemp: data.final_temp,
            rating: data.rating,
            notes: data.notes,
            createdAt: data.created_at
        };
    }

    async updateBatch(id, batchData) {
        if (!this.supabaseReady) return false;

        const dbData = {
            profile_id: batchData.profileId || null,
            date: batchData.date,
            weight: batchData.weight,
            roast_level: batchData.roastLevel || 'medium',
            duration: batchData.duration || null,
            final_temp: batchData.finalTemp || null,
            rating: batchData.rating || 5,
            notes: batchData.notes || ''
        };

        const { error } = await this.supabase
            .from('batches')
            .update(dbData)
            .eq('id', id);

        if (error) {
            console.error('Błąd aktualizacji partii:', error);
            this.showToast('Błąd aktualizacji partii', 'error');
            return false;
        }

        return true;
    }

    async deleteBatchFromDB(id) {
        if (!this.supabaseReady) return false;

        const { error } = await this.supabase
            .from('batches')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Błąd usuwania partii:', error);
            this.showToast('Błąd usuwania partii', 'error');
            return false;
        }

        return true;
    }

    // ===== WAKE LOCK - blokowanie ekranu =====
    async setupWakeLock() {
        // Spróbuj uzyskać wake lock przy starcie
        await this.requestWakeLock();

        // Ponów przy zmianie widoczności strony
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                await this.requestWakeLock();
            }
        });
    }

    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock aktywny');
            }
        } catch (err) {
            console.log('Wake Lock nie jest wspierany lub nie udało się aktywować:', err);
        }
    }

    async releaseWakeLock() {
        if (this.wakeLock) {
            await this.wakeLock.release();
            this.wakeLock = null;
        }
    }

    // ===== iOS WAKE LOCK - NoSleep.js =====
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    setupIosWakeLock() {
        // Inicjalizacja NoSleep.js
        if (typeof NoSleep !== 'undefined') {
            this.noSleep = new NoSleep();
            console.log('NoSleep.js zainicjalizowany');
        } else {
            console.log('NoSleep.js niedostępny');
        }
    }

    startIosWakeLockDirectly(event) {
        console.log('Próba włączenia NoSleep...');

        if (this.noSleep) {
            this.noSleep.enable();
            console.log('NoSleep włączony');
        } else if (this.isIOS()) {
            // Fallback jeśli NoSleep nie załadowany
            console.log('NoSleep niedostępny, próbuję fallback');
        }
    }

    startIosWakeLock() {
        // Handled directly in click handler
    }

    stopIosWakeLock() {
        if (this.noSleep) {
            this.noSleep.disable();
            console.log('NoSleep zatrzymany');
        }
    }

    // ===== NAWIGACJA =====
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const views = document.querySelectorAll('.view');
        const fab = document.getElementById('quickRoastBtn');

        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const viewName = btn.dataset.view;

                // Update active states
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                views.forEach(v => v.classList.remove('active'));
                document.getElementById(viewName).classList.add('active');

                this.currentView = viewName;

                // Pokaż/ukryj FAB button
                if (fab) {
                    if (viewName === 'dashboard' || viewName === 'batches') {
                        fab.classList.remove('hidden');
                    } else {
                        fab.classList.add('hidden');
                    }
                }

                // Odśwież dane dla widoku
                if (viewName === 'dashboard') this.loadDashboard();
                if (viewName === 'profiles') this.loadProfiles();
                if (viewName === 'batches') this.loadBatches();
            });
        });

        // Mobile menu toggle
        const menuToggle = document.getElementById('menuToggle');
        const navMenu = document.querySelector('.nav-menu');

        if (menuToggle && navMenu) {
            menuToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }
    }

    // ===== POMOCNICZE FUNKCJE =====
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Usunięto saveData - teraz używamy Supabase

    // ===== DASHBOARD =====
    async loadDashboard() {
        // Pobierz świeże dane
        this.batches = await this.fetchBatches();
        this.profiles = await this.fetchProfiles();

        // Statystyki
        document.getElementById('totalBatches').textContent = this.batches.length;
        document.getElementById('totalProfiles').textContent = this.profiles.length;

        // Średnia ocena
        if (this.batches.length > 0) {
            const totalRating = this.batches.reduce((sum, b) => sum + (parseInt(b.rating) || 0), 0);
            const avgRating = (totalRating / this.batches.length).toFixed(1);
            document.getElementById('avgRating').textContent = avgRating;
        } else {
            document.getElementById('avgRating').textContent = '0.0';
        }

        // Ostatnie partie
        const recentList = document.getElementById('recentBatchesList');
        const sortedBatches = [...this.batches].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        ).slice(0, 5);

        if (sortedBatches.length === 0) {
            recentList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔥</div>
                    <h3>Brak partii</h3>
                    <p>Dodaj swoją pierwszą partię palenia!</p>
                </div>
            `;
        } else {
            recentList.innerHTML = sortedBatches.map(batch => this.createBatchCardHTML(batch)).join('');
        }
    }

    // ===== PROFILE =====
    setupProfileModal() {
        const modal = document.getElementById('profileModal');
        const openBtn = document.getElementById('addProfileBtn');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.modal-cancel');
        const form = document.getElementById('profileForm');
        const addStageBtn = document.getElementById('addStageBtn');

        openBtn.addEventListener('click', () => this.openProfileModal());
        closeBtn.addEventListener('click', () => this.closeProfileModal());
        cancelBtn.addEventListener('click', () => this.closeProfileModal());

        // Dodawanie etapów
        addStageBtn.addEventListener('click', () => this.addStageRow());

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveProfile();
        });

        // Zamykanie modalu po kliknięciu poza
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeProfileModal();
        });

        // Stoper
        this.setupStopwatch();

        // First Crack
        const firstCrackBtn = document.getElementById('firstCrackBtn');
        if (firstCrackBtn) {
            firstCrackBtn.addEventListener('click', () => this.recordFirstCrack());
        }
    }

    openProfileModal(profileId = null) {
        const modal = document.getElementById('profileModal');
        const form = document.getElementById('profileForm');
        const title = document.getElementById('profileModalTitle');
        const stagesContainer = document.getElementById('roastStages');

        this.editingProfileId = profileId;

        if (profileId) {
            const profile = this.profiles.find(p => p.id === profileId);
            if (profile) {
                title.textContent = 'Edytuj profil';
                document.getElementById('profileName').value = profile.name;
                document.getElementById('beanType').value = profile.beanType || 'arabica';
                document.getElementById('origin').value = profile.origin || '';
                document.getElementById('profileNotes').value = profile.notes || '';

                // Wypełnij etapy
                if (profile.stages && profile.stages.length > 0) {
                    stagesContainer.innerHTML = profile.stages.map((stage, index) =>
                        this.createStageRowHTML(index + 1, stage)
                    ).join('');
                } else {
                    stagesContainer.innerHTML = this.createStageRowHTML(1, { time: '00:00' });
                }
            }
        } else {
            title.textContent = 'Nowy profil';
            form.reset();
            stagesContainer.innerHTML = this.createStageRowHTML(1);
        }

        this.attachStageListeners();
        modal.classList.add('active');
    }

    closeProfileModal() {
        document.getElementById('profileModal').classList.remove('active');
        this.editingProfileId = null;
        // Zresetuj stoper
        if (this.stopwatchInterval) {
            clearInterval(this.stopwatchInterval);
            this.stopwatchInterval = null;
        }
        this.stopwatchTime = 0;
        this.stopwatchRunning = false;
        this.stopwatchSticky = false;
        this.firstCrackTime = null;
        this.updateStopwatchDisplay();
        // Wyłącz Wake Lock i NoSleep
        this.releaseWakeLock();
        this.stopIosWakeLock();
        // Usuń sticky i placeholder (z null check)
        const stopwatchEl = this.stopwatchEl();
        const placeholderEl = this.placeholderEl();
        if (stopwatchEl) stopwatchEl.classList.remove('is-sticky');
        if (placeholderEl) placeholderEl.classList.remove('active');
        // Ukryj wynik First Crack
        const fcResult = document.getElementById('firstCrackResult');
        if (fcResult) {
            fcResult.style.display = 'none';
        }
    }

    createStageRowHTML(num, stage = {}) {
        const isFC = stage.note && stage.note.toLowerCase().includes('first crack');
        const stageNumClass = isFC ? 'stage-num stage-num-fc' : 'stage-num';
        const stageNumText = isFC ? 'FC' : num;

        return `
            <div class="stage-row ${isFC ? 'stage-fc' : ''}" data-stage="${num}">
                <button type="button" class="btn-remove-stage">×</button>
                <div class="stage-header">
                    <span class="${stageNumClass}">${stageNumText}</span>
                </div>
                <div class="stage-fields">
                    <div class="stage-field">
                        <label class="stage-label">Temp.</label>
                        <input type="number" class="stage-temp" placeholder="°C" min="0" max="300"
                            value="${stage.temp || ''}">
                    </div>
                    <div class="stage-field">
                        <label class="stage-label">Czas</label>
                        <input type="text" class="stage-time" placeholder="mm:ss"
                            value="${stage.time || '00:00'}">
                    </div>
                    <div class="stage-field stage-field-note">
                        <label class="stage-label">Notatka</label>
                        <input type="text" class="stage-note" placeholder="np. first crack"
                            value="${stage.note || ''}">
                    </div>
                </div>
            </div>
        `;
    }

    addStageRow() {
        const container = document.getElementById('roastStages');
        const currentRows = container.querySelectorAll('.stage-row');

        // Oblicz aktualny czas ze stopera w formacie mm:ss
        const mins = Math.floor(this.stopwatchTime / 60);
        const secs = this.stopwatchTime % 60;
        const timeStr = mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');

        // Przekaż czas do createStageRowHTML
        const stage = { time: timeStr };
        const newRow = document.createElement('div');
        newRow.innerHTML = this.createStageRowHTML(currentRows.length + 1, stage);
        container.appendChild(newRow.firstElementChild);
        this.attachStageListeners();

        // Przewiń do nowego etapu
        const newStage = container.lastElementChild;
        if (newStage) {
            newStage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    attachStageListeners() {
        document.querySelectorAll('.btn-remove-stage').forEach(btn => {
            // Usuń stare listenery klonując przycisk
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                const row = e.target.closest('.stage-row');
                const rows = document.querySelectorAll('.stage-row');
                if (rows.length > 1) {
                    row.remove();
                    // Renumeruj etapy
                    document.querySelectorAll('.stage-row').forEach((r, i) => {
                        r.querySelector('.stage-num').textContent = i + 1;
                        r.dataset.stage = i + 1;
                    });
                } else {
                    this.showToast('Musi zostać przynajmniej jeden etap', 'warning');
                }
            });
        });
    }

    async saveProfile() {
        const name = document.getElementById('profileName').value.trim();
        const beanType = document.getElementById('beanType').value;
        const origin = document.getElementById('origin').value.trim();
        const notes = document.getElementById('profileNotes').value.trim();

        // Zbierz etapy
        const stages = [];
        document.querySelectorAll('.stage-row').forEach(row => {
            const temp = row.querySelector('.stage-temp').value;
            const time = row.querySelector('.stage-time').value;
            const note = row.querySelector('.stage-note').value;
            if (temp || time) {
                stages.push({ temp: parseFloat(temp) || 0, time: time || '', note });
            }
        });

        const profileData = {
            name,
            beanType,
            origin,
            stages,
            notes
        };

        if (this.editingProfileId) {
            const success = await this.updateProfile(this.editingProfileId, profileData);
            if (success) {
                this.showToast('Profil zaktualizowany!');
            }
        } else {
            const newProfile = await this.createProfile(profileData);
            if (newProfile) {
                this.showToast('Profil utworzony!');
            }
        }

        await this.loadProfiles();
        await this.loadDashboard();
        this.closeProfileModal();
    }

    async loadProfiles() {
        this.profiles = await this.fetchProfiles();
        const container = document.getElementById('profilesList');

        if (this.profiles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>Brak profili</h3>
                    <p>Utwórz pierwszy profil palenia dla swoich ziaren.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.profiles.map(profile => `
            <div class="profile-card" data-id="${profile.id}">
                <div class="profile-header">
                    <span class="profile-name">${profile.name}</span>
                    <span class="profile-type">${profile.beanType || 'arabica'}</span>
                </div>
                ${profile.origin ? `<div class="card-body" style="margin-bottom: 8px;">📍 ${profile.origin}</div>` : ''}
                <div class="profile-info">
                    <span>${profile.stages?.length || 0} etapów</span>
                    <span>Utworzony: ${this.formatDate(profile.createdAt)}</span>
                </div>
                <div class="profile-actions">
                    <button onclick="app.openProfileModal('${profile.id}')">✏️ Edytuj</button>
                    <button onclick="app.useProfile('${profile.id}')">▶️ Użyj</button>
                    <button class="btn-delete" onclick="app.deleteProfile('${profile.id}')">🗑️ Usuń</button>
                </div>
            </div>
        `).join('');
    }

    async deleteProfile(id) {
        if (confirm('Czy na pewno chcesz usunąć ten profil?')) {
            const success = await this.deleteProfileFromDB(id);
            if (success) {
                await this.loadProfiles();
                await this.loadDashboard();
                this.showToast('Profil usunięty', 'warning');
            }
        }
    }

    useProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (profile) {
            this.openProfileViewModal(profile);
        }
    }

    // ===== PODGLĄD PROFILU =====
    openProfileViewModal(profile) {
        const modal = document.getElementById('profileViewModal');
        const stagesContainer = document.getElementById('profileViewStages');

        document.getElementById('profileViewName').textContent = profile.name;
        document.getElementById('profileViewType').textContent = this.getBeanTypeName(profile.beanType);
        document.getElementById('profileViewOrigin').textContent = profile.origin || 'Brak pochodzenia';

        // Buduj listę etapów
        let stagesHTML = '';
        let hasFCStage = false;

        if (profile.stages && profile.stages.length > 0) {
            profile.stages.forEach((stage, index) => {
                const isFC = stage.note && stage.note.toLowerCase().includes('first crack');
                if (isFC) hasFCStage = true;

                stagesHTML += `
                    <div class="profile-view-stage ${isFC ? 'stage-fc' : ''}">
                        <span class="profile-view-stage-num ${isFC ? 'stage-num-fc' : ''}">${isFC ? 'FC' : index + 1}</span>
                        <div class="profile-view-stage-info">
                            <span class="profile-view-stage-time">${stage.time || '--:--'}</span>
                            <span class="profile-view-stage-temp">${stage.temp ? stage.temp + '°C' : '--°C'}</span>
                            ${isFC ? '<span class="profile-view-stage-label">First Crack</span>' : `<span class="profile-view-stage-note">${stage.note || ''}</span>`}
                        </div>
                    </div>
                `;
            });
        }

        // Jeśli nie ma etapu FC, dodaj szacowany
        if (!hasFCStage) {
            stagesHTML += `
                <div class="profile-view-stage stage-estimated-fc">
                    <span class="profile-view-stage-num">?</span>
                    <div class="profile-view-stage-info">
                        <span class="profile-view-stage-time">--:--</span>
                        <span class="profile-view-stage-note">Szacowany First Crack</span>
                        <span class="profile-view-stage-label estimated">Szacowany FC</span>
                    </div>
                </div>
            `;
        }

        stagesContainer.innerHTML = stagesHTML;

        // Notatki
        const notesEl = document.getElementById('profileViewNotes');
        if (profile.notes) {
            notesEl.style.display = 'block';
            notesEl.querySelector('p').textContent = profile.notes;
        } else {
            notesEl.style.display = 'none';
        }

        // Zapisz profil do użycia przy paleniu
        this.activeProfileId = profile.id;

        modal.classList.add('active');
    }

    getBeanTypeName(type) {
        const names = {
            'arabica': 'Arabica',
            'robusta': 'Robusta',
            'blend': 'Mieszanka'
        };
        return names[type] || 'Arabica';
    }

    setupProfileViewModal() {
        const modal = document.getElementById('profileViewModal');
        const closeBtn = modal.querySelector('.modal-close');
        const startBtn = document.getElementById('startRoastingBtn');

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

        startBtn.addEventListener('click', (e) => {
            // iOS: włącz NoSleep bezpośrednio w click handler (wymagane przez iOS)
            this.startIosWakeLockDirectly(e);
            modal.classList.remove('active');
            this.startRoastingMode(this.activeProfileId);
        });
    }

    // ===== TRYB PALENIA =====
    startRoastingMode(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        this.roastingProfile = profile;
        this.roastingTime = 0;
        this.roastingInterval = null;
        this.roastingFCClicked = false;
        this.roastingActualFCTime = null;
        this.roastingCompleted = false;
        this.lastStageIndex = 0; // Start z indeksem 0 (pierwszy etap)

        this.openRoastingModal(profile);
    }

    openRoastingModal(profile) {
        const modal = document.getElementById('roastingModal');
        const stagesContainer = document.getElementById('roastingStagesList');

        document.getElementById('roastingTimer').textContent = '00:00:00';
        document.getElementById('roastingCurrentStage').querySelector('.current-stage-name').textContent = 'Przygotowanie';

        // Ukryj wynik FC na początku
        document.getElementById('roastingFCResult').style.display = 'none';

        // Zbuduj listę etapów
        let stagesHTML = '';
        let hasFCStage = false;

        if (profile.stages && profile.stages.length > 0) {
            profile.stages.forEach((stage, index) => {
                const isFC = stage.note && stage.note.toLowerCase().includes('first crack');
                if (isFC) hasFCStage = true;

                // Dla FC nie pokazuj notatki, tylko etykietę
                const noteHTML = isFC ? '' : `<span class="roasting-stage-note">${stage.note || ''}</span>`;
                const labelHTML = isFC ? '<span class="roasting-stage-label">First Crack</span>' : '';

                stagesHTML += `
                    <div class="roasting-stage ${isFC ? 'stage-fc' : ''} upcoming" data-index="${index}" data-time="${this.timeToSeconds(stage.time)}" data-fc="${isFC}">
                        <span class="roasting-stage-num">${isFC ? 'FC' : index + 1}</span>
                        <div class="roasting-stage-info">
                            <span class="roasting-stage-time">${stage.time || '--:--'}</span>
                            <span class="roasting-stage-temp">${stage.temp ? stage.temp + '°C' : ''}</span>
                            ${noteHTML}
                            ${labelHTML}
                        </div>
                    </div>
                `;
            });
        }

        // Dodaj szacowany FC jeśli nie ma
        if (!hasFCStage) {
            stagesHTML += `
                <div class="roasting-stage estimated-fc upcoming" data-index="fc-estimated" data-fc="true">
                    <span class="roasting-stage-num">?</span>
                    <div class="roasting-stage-info">
                        <span class="roasting-stage-time">--:--</span>
                        <span class="roasting-stage-note">Szacowany First Crack</span>
                        <span class="roasting-stage-label">Szacowany FC</span>
                    </div>
                </div>
            `;
        }

        stagesContainer.innerHTML = stagesHTML;

        // Ustaw pierwszy etap jako aktywny na starcie
        const firstStageEl = stagesContainer.querySelector('.roasting-stage');
        if (firstStageEl) {
            firstStageEl.classList.remove('upcoming');
            firstStageEl.classList.add('active');
        }

        // Resetuj indeks ostatniego etapu dla dźwięku
        this.lastStageIndex = 0;

        // Resetuj przyciski
        const fcBtn = document.getElementById('roastingFCBtn');
        fcBtn.style.display = 'inline-flex';

        const finishBtn = document.getElementById('finishRoastingBtn');
        finishBtn.style.display = 'none';

        const pauseBtn = document.getElementById('roastingPauseBtn');
        pauseBtn.innerHTML = '⏸️ Pauza';
        pauseBtn.classList.remove('paused');

        // Resetuj stan pauzy
        this.roastingPaused = false;

        modal.classList.add('active');

        // Uruchom stoper
        this.startRoastingTimer();
    }

    startRoastingTimer() {
        this.requestWakeLock();
        this.roastingPaused = false;
        this.roastingInterval = setInterval(() => {
            this.roastingTime++;
            this.updateRoastingDisplay();
            this.checkStagesProgress();
        }, 1000);
    }

    updateRoastingDisplay() {
        const timerEl = document.getElementById('roastingTimer');
        const hours = Math.floor(this.roastingTime / 3600);
        const minutes = Math.floor((this.roastingTime % 3600) / 60);
        const seconds = this.roastingTime % 60;
        timerEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    checkStagesProgress() {
        const stages = document.querySelectorAll('.roasting-stage');

        // Pobierz nazwę pierwszego etapu z profilu
        let currentStageName = 'Palenie';
        const profile = this.roastingProfile;
        if (profile && profile.stages && profile.stages.length > 0) {
            const firstStage = profile.stages[0];
            if (firstStage.note) {
                currentStageName = firstStage.note;
            } else {
                currentStageName = `Etap 1`;
            }
        }

        // Pobierz kontener etapów
        const stagesContainer = document.getElementById('roastingStagesList');
        const stageElements = Array.from(stagesContainer.querySelectorAll('.roasting-stage'));

        // Znajdź aktualny etap
        let currentStageIndex = 0;

        for (let i = stageElements.length - 1; i >= 0; i--) {
            const stageTime = parseInt(stageElements[i].dataset.time) || 0;
            if (stageTime > 0 && this.roastingTime >= stageTime) {
                currentStageIndex = i;
                break;
            }
        }

        // Sprawdź czy etap się zmienił - wtedy odtwórz dźwięk
        if (this.lastStageIndex !== currentStageIndex) {
            this.playStageChangeSound();
        }
        this.lastStageIndex = currentStageIndex;

        // Resetuj wszystkie etapy
        stages.forEach((stageEl) => {
            stageEl.classList.remove('completed', 'active', 'upcoming');
        });

        // Oznacz etapy
        stageElements.forEach((stageEl, index) => {
            if (index < currentStageIndex) {
                // Etapy przed aktualnym - zakończone
                stageEl.classList.add('completed');
            } else if (index === currentStageIndex) {
                // Aktualny etap
                stageEl.classList.add('active');
                const note = stageEl.querySelector('.roasting-stage-note')?.textContent;
                const label = stageEl.querySelector('.roasting-stage-label');

                // Dla FC pobierz nazwę z label (priorytet)
                if (label && stageEl.classList.contains('stage-fc')) {
                    currentStageName = label.textContent;
                } else if (note && !note.includes('Szacowany') && note.trim() !== '') {
                    currentStageName = note;
                } else {
                    // Jeśli brak notatki, pokaż "Etap X"
                    currentStageName = `Etap ${index + 1}`;
                }
            } else {
                // Przyszłe etapy
                stageEl.classList.add('upcoming');
            }
        });

        document.getElementById('roastingCurrentStage').querySelector('.current-stage-name').textContent = currentStageName;
    }

    playStageChangeSound() {
        try {
            // Dla iOS: używamy jednego, persisted audio context
            if (!this._audioContext) {
                this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const audioContext = this._audioContext;

            // iOS fix: wznów kontekst jeśli jest suspended
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            // Dźwięk "ding" - dwa tony
            const playTone = (freq, startTime, duration) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = freq;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            };

            const now = audioContext.currentTime;

            // Pierwszy ton - wyższy (E6)
            playTone(1319, now, 0.15);

            // Drugi ton - niższy (C6)
            playTone(1047, now + 0.12, 0.2);

        } catch (e) {
            console.log('Audio nie jest wspierane:', e);
        }
    }

    timeToSeconds(timeStr) {
        if (!timeStr || timeStr === '--:--') return 0;
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        return 0;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    setupRoastingModal() {
        const modal = document.getElementById('roastingModal');
        const closeBtn = modal.querySelector('.modal-close');
        const fcBtn = document.getElementById('roastingFCBtn');
        const pauseBtn = document.getElementById('roastingPauseBtn');
        const cancelBtn = document.getElementById('cancelRoastingBtn');
        const finishBtn = document.getElementById('finishRoastingBtn');

        closeBtn.addEventListener('click', () => {
            if (confirm('Czy na pewno chcesz przerwać palenie?')) {
                this.stopRoasting();
                modal.classList.remove('active');
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (confirm('Czy na pewno chcesz przerwać palenie?')) {
                    this.stopRoasting();
                    modal.classList.remove('active');
                }
            }
        });

        pauseBtn.addEventListener('click', () => {
            this.toggleRoastingPause();
        });

        fcBtn.addEventListener('click', () => {
            this.recordRoastingFC();
        });

        cancelBtn.addEventListener('click', () => {
            this.stopRoasting();
            modal.classList.remove('active');
        });

        finishBtn.addEventListener('click', () => {
            this.finishRoasting();
        });
    }

    toggleRoastingPause() {
        const pauseBtn = document.getElementById('roastingPauseBtn');

        if (this.roastingPaused) {
            // Wznów
            this.roastingPaused = false;
            this.requestWakeLock();
            // iOS: włącz NoSleep
            if (this.noSleep) {
                this.noSleep.enable();
            }
            this.roastingInterval = setInterval(() => {
                this.roastingTime++;
                this.updateRoastingDisplay();
                this.checkStagesProgress();
            }, 1000);
            pauseBtn.innerHTML = '⏸️ Pauza';
            pauseBtn.classList.remove('paused');
        } else {
            // Pauzuj
            this.roastingPaused = true;
            if (this.roastingInterval) {
                clearInterval(this.roastingInterval);
                this.roastingInterval = null;
            }
            this.releaseWakeLock();
            // iOS: wyłącz NoSleep
            this.stopIosWakeLock();
            pauseBtn.innerHTML = '▶️ Wznów';
            pauseBtn.classList.add('paused');
        }
    }

    recordRoastingFC() {
        if (this.roastingFCClicked) return;

        this.roastingFCClicked = true;
        this.roastingActualFCTime = this.roastingTime;

        const fcResultEl = document.getElementById('roastingFCResult');
        fcResultEl.style.display = 'block';

        document.getElementById('fcActualTime').textContent = this.formatTime(this.roastingActualFCTime);

        // Znajdź szacowany FC
        const profile = this.roastingProfile;
        let estimatedFCTime = null;
        if (profile.stages) {
            const fcStage = profile.stages.find(s => s.note && s.note.toLowerCase().includes('first crack'));
            if (fcStage) {
                estimatedFCTime = this.timeToSeconds(fcStage.time);
            }
        }

        if (estimatedFCTime) {
            document.getElementById('fcEstimatedTime').textContent = this.formatTime(estimatedFCTime);
        } else {
            document.getElementById('fcEstimatedTime').textContent = '--:--';
        }

        // Ukryj przycisk FC
        const fcBtn = document.getElementById('roastingFCBtn');
        fcBtn.style.display = 'none';

        // Pokaż przycisk "Zapisz partię"
        const finishBtn = document.getElementById('finishRoastingBtn');
        finishBtn.style.display = 'inline-flex';

        // Zaznacz etap FC jako completed
        const fcStageEl = document.querySelector('.roasting-stage[data-fc="true"]');
        if (fcStageEl) {
            fcStageEl.classList.remove('active', 'upcoming');
            fcStageEl.classList.add('completed');
        }

        this.showToast('First Crack zapisany!', 'success');
    }

    stopRoasting() {
        if (this.roastingInterval) {
            clearInterval(this.roastingInterval);
            this.roastingInterval = null;
        }
        this.releaseWakeLock();
        this.stopIosWakeLock(); // iOS: wyłącz NoSleep
    }

    finishRoasting() {
        this.stopRoasting();

        // Otwórz modal nowej partii z danymi z palenia
        const modal = document.getElementById('roastingModal');
        modal.classList.remove('active');

        // Otwórz modal partii
        this.openBatchModal();

        // Wypełnij danymi
        document.getElementById('batchProfile').value = this.roastingProfile.id;
        document.getElementById('batchDuration').value = (this.roastingTime / 60).toFixed(1);

        if (this.roastingActualFCTime) {
            const notes = `FC: ${this.formatTime(this.roastingActualFCTime)}`;
            document.getElementById('batchNotes').value = notes;
        }

        this.showToast('Palenie zakończone! Uzupełnij dane partii.', 'success');
    }

    populateProfileSelect() {
        const select = document.getElementById('batchProfile');
        select.innerHTML = '<option value="">-- Wybierz profil --</option>' +
            this.profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    // ===== PARTIE =====
    setupBatchModal() {
        const modal = document.getElementById('batchModal');
        const openBtn = document.getElementById('addBatchBtn');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.modal-cancel');
        const form = document.getElementById('batchForm');
        const ratingInput = document.getElementById('batchRating');
        const ratingValue = modal.querySelector('.rating-value');

        openBtn.addEventListener('click', () => this.openBatchModal());
        closeBtn.addEventListener('click', () => this.closeBatchModal());
        cancelBtn.addEventListener('click', () => this.closeBatchModal());

        ratingInput.addEventListener('input', (e) => {
            ratingValue.textContent = e.target.value;
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveBatch();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeBatchModal();
        });
    }

    openBatchModal(batchId = null) {
        const modal = document.getElementById('batchModal');
        const form = document.getElementById('batchForm');
        const title = document.getElementById('batchModalTitle');

        this.populateProfileSelect();
        this.editingBatchId = batchId;

        if (batchId) {
            const batch = this.batches.find(b => b.id === batchId);
            if (batch) {
                title.textContent = 'Edytuj partię';
                document.getElementById('batchDate').value = batch.date;
                document.getElementById('batchProfile').value = batch.profileId || '';
                document.getElementById('batchWeight').value = batch.weight;
                document.getElementById('batchRoastLevel').value = batch.roastLevel || 'medium';
                document.getElementById('batchDuration').value = batch.duration || '';
                document.getElementById('batchFinalTemp').value = batch.finalTemp || '';
                document.getElementById('batchRating').value = batch.rating || 5;
                modal.querySelector('.rating-value').textContent = batch.rating || 5;
                document.getElementById('batchNotes').value = batch.notes || '';
            }
        } else {
            title.textContent = 'Nowa partia';
            form.reset();
            document.getElementById('batchDate').valueAsDate = new Date();
            document.getElementById('batchRoastLevel').value = 'medium';
            document.getElementById('batchRating').value = 5;
            modal.querySelector('.rating-value').textContent = 5;
        }

        modal.classList.add('active');
    }

    closeBatchModal() {
        document.getElementById('batchModal').classList.remove('active');
        this.editingBatchId = null;
    }

    async saveBatch() {
        const data = {
            profileId: document.getElementById('batchProfile').value,
            date: document.getElementById('batchDate').value,
            weight: parseFloat(document.getElementById('batchWeight').value),
            roastLevel: document.getElementById('batchRoastLevel').value,
            duration: parseFloat(document.getElementById('batchDuration').value) || null,
            finalTemp: parseFloat(document.getElementById('batchFinalTemp').value) || null,
            rating: parseInt(document.getElementById('batchRating').value),
            notes: document.getElementById('batchNotes').value.trim()
        };

        if (this.editingBatchId) {
            const success = await this.updateBatch(this.editingBatchId, data);
            if (success) {
                this.showToast('Partia zaktualizowana!');
            }
        } else {
            const newBatch = await this.createBatch(data);
            if (newBatch) {
                this.showToast('Nowa partia zapisana!');
            }
        }

        await this.loadBatches();
        await this.loadDashboard();
        this.closeBatchModal();
    }

    async loadBatches() {
        this.batches = await this.fetchBatches();

        const searchTerm = document.getElementById('batchSearch')?.value?.toLowerCase() || '';
        const filter = document.getElementById('batchFilter')?.value || 'all';

        let filtered = [...this.batches].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        // Filtruj wg wyszukiwania
        if (searchTerm) {
            filtered = filtered.filter(b =>
                b.notes?.toLowerCase().includes(searchTerm) ||
                b.profileName?.toLowerCase().includes(searchTerm)
            );
        }

        // Filtruj wg poziomu wypalenia
        if (filter !== 'all') {
            const levels = {
                'light': ['green', 'cinnamon', 'light'],
                'medium': ['medium'],
                'dark': ['medium-dark', 'dark', 'french', 'italian']
            };
            filtered = filtered.filter(b => levels[filter]?.includes(b.roastLevel));
        }

        const container = document.getElementById('batchesList');

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔥</div>
                    <h3>Brak partii</h3>
                    <p>Dodaj swoją pierwszą partię palenia!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(batch => this.createBatchListItemHTML(batch)).join('');

        // Dodaj event listenery do przycisków
        container.querySelectorAll('.btn-edit-batch').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openBatchModal(btn.dataset.id);
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteBatch(btn.dataset.id);
            });
        });
    }

    createBatchCardHTML(batch) {
        const profileName = batch.profileName || this.profiles.find(p => p.id === batch.profileId)?.name || 'Brak profilu';
        const roastLevelNames = {
            'green': 'Zielona', 'cinnamon': 'Cynamonowa', 'light': 'Jasna',
            'medium': 'Średnia', 'medium-dark': 'Średnio-ciemna',
            'dark': 'Ciemna', 'french': 'French', 'italian': 'Italian'
        };

        const ratingStars = '⭐'.repeat(batch.rating || 0) + '☆'.repeat(10 - (batch.rating || 0));

        return `
            <div class="batch-card" data-id="${batch.id}">
                <div class="batch-roast-indicator roast-${batch.roastLevel}"></div>
                <div class="batch-header">
                    <div>
                        <div class="batch-title">${profileName}</div>
                        <span class="roast-level-badge roast-${batch.roastLevel}">${roastLevelNames[batch.roastLevel] || 'Nieznany'}</span>
                    </div>
                    <span class="batch-date">${this.formatDate(batch.date)}</span>
                </div>
                <div class="batch-details">
                    <div class="batch-detail">
                        <span class="batch-detail-label">Ilość</span>
                        <span class="batch-detail-value">${batch.weight}g</span>
                    </div>
                    <div class="batch-detail">
                        <span class="batch-detail-label">Czas</span>
                        <span class="batch-detail-value">${batch.duration ? batch.duration + ' min' : '-'}</span>
                    </div>
                    <div class="batch-detail">
                        <span class="batch-detail-label">Temp.</span>
                        <span class="batch-detail-value">${batch.finalTemp ? batch.finalTemp + '°C' : '-'}</span>
                    </div>
                    <div class="batch-detail">
                        <span class="batch-detail-label">Ocena</span>
                        <span class="batch-detail-value">${batch.rating}/10</span>
                    </div>
                </div>
                ${batch.notes ? `<div class="card-body" style="margin-top: 10px; font-size: 13px;">${batch.notes}</div>` : ''}
            </div>
        `;
    }

    createBatchListItemHTML(batch) {
        const profileName = batch.profileName || this.profiles.find(p => p.id === batch.profileId)?.name || 'Brak profilu';
        const roastLevelNames = {
            'green': 'Zielona', 'cinnamon': 'Cynamonowa', 'light': 'Jasna',
            'medium': 'Średnia', 'medium-dark': 'Średnio-ciemna',
            'dark': 'Ciemna', 'french': 'French', 'italian': 'Italian'
        };

        return `
            <div class="batch-card" data-id="${batch.id}">
                <div class="batch-roast-indicator roast-${batch.roastLevel}"></div>
                <div class="batch-header">
                    <div>
                        <div class="batch-title">${profileName}</div>
                        <span class="roast-level-badge roast-${batch.roastLevel}">${roastLevelNames[batch.roastLevel] || 'Nieznany'}</span>
                        <div class="batch-rating">${'⭐'.repeat(batch.rating || 0)}${'☆'.repeat(10 - (batch.rating || 0))}</div>
                    </div>
                    <span class="batch-date">${this.formatDate(batch.date)}</span>
                </div>
                <div class="batch-details">
                    <div class="batch-detail">
                        <span class="batch-detail-label">Ilość</span>
                        <span class="batch-detail-value">${batch.weight}g</span>
                    </div>
                    <div class="batch-detail">
                        <span class="batch-detail-label">Czas</span>
                        <span class="batch-detail-value">${batch.duration ? batch.duration + ' min' : '-'}</span>
                    </div>
                    <div class="batch-detail">
                        <span class="batch-detail-label">Temp. końcowa</span>
                        <span class="batch-detail-value">${batch.finalTemp ? batch.finalTemp + '°C' : '-'}</span>
                    </div>
                </div>
                ${batch.notes ? `<div class="card-body" style="margin-top: 10px; font-size: 13px;">${batch.notes}</div>` : ''}
                <div class="profile-actions" style="margin-top: 12px;">
                    <button class="btn-edit-batch" data-id="${batch.id}">✏️ Edytuj</button>
                    <button class="btn-delete" data-id="${batch.id}">🗑️ Usuń</button>
                </div>
            </div>
        `;
    }

    async deleteBatch(id) {
        if (confirm('Czy na pewno chcesz usunąć tę partię?')) {
            const success = await this.deleteBatchFromDB(id);
            if (success) {
                await this.loadBatches();
                await this.loadDashboard();
                this.showToast('Partia usunięta', 'warning');
            }
        }
    }

    // ===== STOPER =====
    setupStopwatch() {
        this.stopwatchInterval = null;
        this.stopwatchTime = 0;
        this.stopwatchRunning = false;
        this.stopwatchSticky = false;

        const startBtn = document.getElementById('stopwatchStart');
        const pauseBtn = document.getElementById('stopwatchPause');
        const resetBtn = document.getElementById('stopwatchReset');

        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                // iOS: play audio DIRECTLY in click handler (required by iOS)
                this.startIosWakeLockDirectly(e);
                this.startStopwatch();
            });
        }
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.pauseStopwatch());
        }
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetStopwatch());
        }

        // iOS Wake Lock setup
        this.setupIosWakeLock();

        // Intersection Observer dla sticky stopera
        this.setupStickyStopwatch();
    }

    setupStickyStopwatch() {
        const stopwatch = this.stopwatchEl();
        const placeholder = this.placeholderEl();
        const modal = document.getElementById('profileModal');
        const modalContent = modal ? modal.querySelector('.modal-content') : null;

        if (!stopwatch || !modalContent) return;

        // Zapamiętaj pozycję stopera w formularzu
        this.stopwatchOriginalTop = null;

        // Słuchamy scrolla w modalu
        modalContent.addEventListener('scroll', () => {
            if (!this.stopwatchRunning) return;

            // Jeśli stoper nie jest sticky, sprawdź jego pozycję
            if (!this.stopwatchSticky) {
                const stopwatchRect = stopwatch.getBoundingClientRect();
                const headerHeight = 80; // wysokość headera modala

                // Jeśli stoper znika z góry ekranu
                if (stopwatchRect.bottom < headerHeight) {
                    this.makeStopwatchSticky();
                }
            } else {
                // Stoper jest sticky - sprawdź czy scroll wrócił do góry
                const scrollTop = modalContent.scrollTop;
                const placeholderRect = placeholder.getBoundingClientRect();

                // Jeśli placeholder jest widoczny (scroll blisko góry)
                if (scrollTop < 50 || placeholderRect.top > 60) {
                    this.unmakeStopwatchSticky();
                }
            }
        });
    }

    makeStopwatchSticky() {
        if (this.stopwatchSticky) return;
        this.stopwatchSticky = true;
        this.stopwatchEl().classList.add('is-sticky');
        this.placeholderEl().classList.add('active');
    }

    unmakeStopwatchSticky() {
        if (!this.stopwatchSticky) return;
        this.stopwatchSticky = false;
        this.stopwatchEl().classList.remove('is-sticky');
        this.placeholderEl().classList.remove('active');
    }

    startStopwatch() {
        if (this.stopwatchRunning) return;
        this.stopwatchRunning = true;
        this.requestWakeLock();
        // iOS Wake Lock is handled directly in click handler
        // Nie dodajemy sticky od razu - tylko przy scrollowaniu
        this.stopwatchInterval = setInterval(() => {
            this.stopwatchTime++;
            this.updateStopwatchDisplay();
        }, 1000);
    }

    pauseStopwatch() {
        this.stopwatchRunning = false;
        if (this.stopwatchInterval) {
            clearInterval(this.stopwatchInterval);
            this.stopwatchInterval = null;
        }
        this.releaseWakeLock();
        this.stopIosWakeLock(); // iOS: wyłącz NoSleep
    }

    resetStopwatch() {
        this.pauseStopwatch();
        this.stopwatchTime = 0;
        this.firstCrackTime = null;
        this.updateStopwatchDisplay();
        this.unmakeStopwatchSticky();
        this.releaseWakeLock();
        this.stopIosWakeLock(); // iOS workaround

        // Ukryj wynik First Crack
        const fcResult = document.getElementById('firstCrackResult');
        if (fcResult) {
            fcResult.style.display = 'none';
        }

        // Usuń etapy FC dodane przez First Crack
        const fcStages = document.querySelectorAll('.stage-fc');
        fcStages.forEach(stage => stage.remove());
    }

    stopwatchEl() {
        return document.getElementById('stopwatch');
    }

    placeholderEl() {
        return document.getElementById('stopwatchPlaceholder');
    }

    updateStopwatchDisplay() {
        const display = document.getElementById('stopwatchTime');
        if (display) {
            const hours = Math.floor(this.stopwatchTime / 3600);
            const minutes = Math.floor((this.stopwatchTime % 3600) / 60);
            const seconds = this.stopwatchTime % 60;
            display.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        // Aktualizuj % First Crack jeśli został zapisany
        if (this.firstCrackTime !== null && this.firstCrackTime > 0) {
            this.updateFirstCrackPercent();
        }
    }

    // ===== FIRST CRACK =====
    recordFirstCrack() {
        this.firstCrackTime = this.stopwatchTime;
        const result = document.getElementById('firstCrackResult');
        if (result) {
            result.style.display = 'block';
        }
        this.updateFirstCrackPercent();

        // Dodaj etap First Crack
        this.addFirstCrackStage();
    }

    addFirstCrackStage() {
        const container = document.getElementById('roastStages');
        if (!container) return;

        const mins = Math.floor(this.stopwatchTime / 60);
        const secs = this.stopwatchTime % 60;
        const timeStr = mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');

        const fcStage = document.createElement('div');
        fcStage.className = 'stage-row stage-fc';
        fcStage.dataset.stage = 'fc';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-remove-stage';
        removeBtn.textContent = '×';

        const header = document.createElement('div');
        header.className = 'stage-header';

        const numSpan = document.createElement('span');
        numSpan.className = 'stage-num stage-num-fc';
        numSpan.textContent = 'FC';
        header.appendChild(numSpan);

        const fields = document.createElement('div');
        fields.className = 'stage-fields';

        // Temp field with label
        const tempField = document.createElement('div');
        tempField.className = 'stage-field';
        const tempLabel = document.createElement('label');
        tempLabel.className = 'stage-label';
        tempLabel.textContent = 'Temp.';
        const tempInput = document.createElement('input');
        tempInput.type = 'number';
        tempInput.className = 'stage-temp';
        tempInput.placeholder = '°C';
        tempInput.min = '0';
        tempInput.max = '300';
        tempField.appendChild(tempLabel);
        tempField.appendChild(tempInput);

        // Time field with label
        const timeField = document.createElement('div');
        timeField.className = 'stage-field';
        const timeLabel = document.createElement('label');
        timeLabel.className = 'stage-label';
        timeLabel.textContent = 'Czas';
        const timeInput = document.createElement('input');
        timeInput.type = 'text';
        timeInput.className = 'stage-time';
        timeInput.placeholder = 'mm:ss';
        timeInput.value = timeStr;

        timeField.appendChild(timeLabel);
        timeField.appendChild(timeInput);

        // Note field with label
        const noteField = document.createElement('div');
        noteField.className = 'stage-field stage-field-note';
        const noteLabel = document.createElement('label');
        noteLabel.className = 'stage-label';
        noteLabel.textContent = 'Notatka';
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.className = 'stage-note';
        noteInput.placeholder = 'np. first crack';
        noteInput.value = 'First Crack';
        noteField.appendChild(noteLabel);
        noteField.appendChild(noteInput);

        fields.appendChild(tempField);
        fields.appendChild(timeField);
        fields.appendChild(noteField);

        fcStage.appendChild(removeBtn);
        fcStage.appendChild(header);
        fcStage.appendChild(fields);

        container.appendChild(fcStage);
        this.attachStageListeners();

        fcStage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    updateFirstCrackPercent() {
        const percentEl = document.getElementById('firstCrackPercent');
        if (percentEl && this.firstCrackTime !== null) {
            if (this.stopwatchTime > 0 && this.firstCrackTime > 0) {
                const timeAfterFC = this.stopwatchTime - this.firstCrackTime;
                const percent = ((timeAfterFC / this.stopwatchTime) * 100).toFixed(1);
                percentEl.textContent = `${percent}%`;
            } else {
                percentEl.textContent = '0%';
            }
        }
    }

    // ===== KALKULATORY =====
    setupCalculators() {
        // Kalkulator utraty masy
        document.getElementById('calcLossBtn').addEventListener('click', () => {
            const before = parseFloat(document.getElementById('weightBefore').value);
            const after = parseFloat(document.getElementById('weightAfter').value);

            if (before && after && before > 0) {
                const loss = ((before - after) / before * 100).toFixed(2);
                const resultEl = document.getElementById('lossResult');

                // Określ typ roastu na podstawie utraty masy
                const roastType = this.getRoastTypeByLoss(parseFloat(loss));

                resultEl.querySelector('.result-value').textContent = loss + '%';
                resultEl.querySelector('.result-label').textContent = roastType;
            } else {
                this.showToast('Wprowadź poprawne wartości', 'error');
            }
        });

        // Kalkulator ROR (Rate of Rise)
        document.getElementById('calcRorBtn').addEventListener('click', () => {
            const start = parseFloat(document.getElementById('rorStart').value);
            const end = parseFloat(document.getElementById('rorEnd').value);
            const time = parseFloat(document.getElementById('rorTime').value);

            if (start !== null && end !== null && time && time > 0) {
                const ror = ((end - start) / time).toFixed(1);
                document.getElementById('rorResult').querySelector('.result-value').textContent = ror + '°C';
            } else {
                this.showToast('Wprowadź poprawne wartości', 'error');
            }
        });

        // Kalkulator czasu
        document.getElementById('calcTimeBtn').addEventListener('click', () => {
            const target = parseFloat(document.getElementById('targetTemp').value);
            const current = parseFloat(document.getElementById('currentTemp').value);
            const rate = parseFloat(document.getElementById('roastType').value);

            if (target && current && target > current) {
                const minutes = ((target - current) / rate).toFixed(1);
                document.getElementById('timeResult').querySelector('.result-value').textContent = minutes + ' min';
            } else {
                this.showToast('Wprowadź poprawne wartości (temperatura docelowa musi być wyższa)', 'error');
            }
        });
    }

    // Określ typ roastu na podstawie utraty masy
    getRoastTypeByLoss(lossPercent) {
        // Typowe wartości utraty masy dla różnych poziomów palenia
        if (lossPercent < 11) {
            return 'Zielona / Cynamonowa';
        } else if (lossPercent < 13) {
            return 'Jasna (Light)';
        } else if (lossPercent < 15) {
            return 'Średnia (Medium)';
        } else if (lossPercent < 17) {
            return 'Średnio-ciemna';
        } else if (lossPercent < 19) {
            return 'Ciemna (Dark)';
        } else if (lossPercent < 21) {
            return 'French';
        } else {
            return 'Italian';
        }
    }

    // ===== iOS VIEWPORT FIX =====
    setupiOSViewportFix() {
        const originalHeight = window.innerHeight;

        // Przy blur na inputach - przywróć viewport
        document.addEventListener('blur', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                setTimeout(() => {
                    window.scrollTo(0, 0);
                    document.body.style.minHeight = originalHeight + 'px';
                }, 100);
            }
        }, true);

        // Przy resize okna
        window.addEventListener('resize', () => {
            if (window.innerHeight >= originalHeight * 0.9) {
                document.body.style.minHeight = '';
            }
        });

        // Przy zamknięciu modala - reset scroll
        document.querySelectorAll('.modal').forEach(modal => {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'class' && !modal.classList.contains('active')) {
                        setTimeout(() => window.scrollTo(0, 0), 100);
                    }
                });
            });
            observer.observe(modal, { attributes: true });
        });
    }
}

// Inicjalizacja aplikacji
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CoffeeRoasterApp();

    // Event listenery dla filtrów partii
    const batchSearch = document.getElementById('batchSearch');
    const batchFilter = document.getElementById('batchFilter');

    if (batchSearch) {
        batchSearch.addEventListener('input', () => window.app.loadBatches());
    }
    if (batchFilter) {
        batchFilter.addEventListener('change', () => window.app.loadBatches());
    }
});

// Rejestracja Service Workera dla PWA (tylko raz)
if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW zarejestrowany:', registration.scope);
            })
            .catch(error => {
                console.log('Rejestracja SW nieudana:', error);
            });
    });
}
