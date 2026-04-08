// ===== COFFEE ROASTER APP with SUPABASE =====
// Aplikacja do śledzenia profili i partii palenia kawy

class CoffeeRoasterApp {
    constructor() {
        this.profiles = [];
        this.batches = [];
        this.currentView = 'dashboard';
        this.editingProfileId = null;
        this.editingBatchId = null;

        this.wakeLock = null;
        this.noSleep = null;

        this.roastingProfile = null;
        this.roastingTime = 0;
        this.roastingInterval = null;
        this.roastingFCClicked = false;
        this.roastingActualFCTime = null;
        this.activeProfileId = null;
        this.roastingPaused = false;

        this.supabaseReady = false;
        this.isLoading = false;

        this.init();
    }

    async init() {
        this.showLoadingState('dashboard');
        this.showLoadingState('profilesList');
        this.showLoadingState('batchesList');

        await this.initSupabase();

        this.setupNavigation();
        this.setupProfileModal();
        this.setupBatchModal();
        this.setupCalculators();
        this.setupProfileViewModal();
        this.setupRoastingModal();
        this.setupWakeLock();
        this.setupiOSViewportFix();

        await this.loadDashboard();
        await this.loadProfiles();
        await this.loadBatches();
    }

    // ===== SKELETON & LOADING =====
    createSkeletonHTML(type) {
        if (type === 'profile-card') {
            return `
                <div class="profile-card skeleton-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text short"></div>
                </div>
            `;
        }
        if (type === 'batch-card') {
            return `
                <div class="batch-card skeleton-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text short"></div>
                </div>
            `;
        }
        if (type === 'stat-card') {
            return `
                <div class="stat-card skeleton-card">
                    <div class="skeleton skeleton-circle"></div>
                    <div class="skeleton skeleton-number"></div>
                    <div class="skeleton skeleton-text short"></div>
                </div>
            `;
        }
        return '<div class="skeleton-card"><div class="skeleton skeleton-text"></div></div>';
    }

    showLoadingState(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (containerId === 'dashboard') {
            const statsContainer = document.querySelector('.dashboard-stats');
            if (statsContainer) {
                statsContainer.innerHTML = this.createSkeletonHTML('stat-card').repeat(3);
            }
            const recentList = document.getElementById('recentBatchesList');
            if (recentList) {
                recentList.innerHTML = this.createSkeletonHTML('batch-card').repeat(2);
            }
        } else {
            container.innerHTML = this.createSkeletonHTML('profile-card').repeat(3);
        }
    }

    // ===== SUPABASE =====
    async initSupabase() {
        try {
            if (!window.SUPABASE_CONFIG ||
                window.SUPABASE_CONFIG.url === 'TU_WKLEJ_URL_PROJEKTU' ||
                window.SUPABASE_CONFIG.anonKey === 'TU_WKLEJ_ANON_KEY') {
                console.error('Supabase: Brak konfiguracji!');
                this.showToast('Błąd: Skonfiguruj Supabase', 'error');
                return;
            }

            this.supabase = window.supabase.createClient(
                window.SUPABASE_CONFIG.url,
                window.SUPABASE_CONFIG.anonKey
            );

            const { error } = await this.supabase.from('profiles').select('count', { count: 'exact', head: true });
            if (error) {
                console.error('Supabase: Błąd połączenia:', error);
                this.showToast('Błąd połączenia z bazą', 'error');
            } else {
                console.log('Supabase: Połączono pomyślnie');
                this.supabaseReady = true;
            }
        } catch (err) {
            console.error('Supabase: Błąd inicjalizacji:', err);
            this.showToast('Błąd inicjalizacji Supabase', 'error');
        }
    }

    async fetchProfiles() {
        if (!this.supabaseReady) return [];
        const { data, error } = await this.supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Błąd pobierania profili:', error);
            return [];
        }

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
        const { error } = await this.supabase.from('profiles').delete().eq('id', id);
        if (error) {
            console.error('Błąd usuwania profilu:', error);
            return false;
        }
        return true;
    }

    async fetchBatches() {
        if (!this.supabaseReady) return [];
        const { data, error } = await this.supabase
            .from('batches')
            .select('*, profile:profiles(id, name)')
            .order('date', { ascending: false });

        if (error) {
            console.error('Błąd pobierania partii:', error);
            return [];
        }

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

        const { error } = await this.supabase.from('batches').update(dbData).eq('id', id);
        if (error) {
            console.error('Błąd aktualizacji partii:', error);
            this.showToast('Błąd aktualizacji partii', 'error');
            return false;
        }
        return true;
    }

    async deleteBatchFromDB(id) {
        if (!this.supabaseReady) return false;
        const { error } = await this.supabase.from('batches').delete().eq('id', id);
        if (error) {
            console.error('Błąd usuwania partii:', error);
            return false;
        }
        return true;
    }

    // ===== WAKE LOCK =====
    async setupWakeLock() {
        await this.requestWakeLock();
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
            }
        } catch (err) {}
    }

    async releaseWakeLock() {
        if (this.wakeLock) {
            await this.wakeLock.release();
            this.wakeLock = null;
        }
    }

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    setupIosWakeLock() {
        if (typeof NoSleep !== 'undefined') {
            this.noSleep = new NoSleep();
        }
    }

    startIosWakeLockDirectly(event) {
        if (this.noSleep) {
            this.noSleep.enable();
        }
    }

    stopIosWakeLock() {
        if (this.noSleep) {
            this.noSleep.disable();
        }
    }

    // ===== NAWIGACJA =====
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const views = document.querySelectorAll('.view');

        navButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const viewName = btn.dataset.view;
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                views.forEach(v => v.classList.remove('active'));
                document.getElementById(viewName).classList.add('active');
                this.currentView = viewName;

                if (viewName === 'dashboard') await this.loadDashboard();
                if (viewName === 'profiles') await this.loadProfiles();
                if (viewName === 'batches') await this.loadBatches();
            });
        });

        const menuToggle = document.getElementById('menuToggle');
        const navMenu = document.querySelector('.nav-menu');
        if (menuToggle && navMenu) {
            menuToggle.addEventListener('click', () => navMenu.classList.toggle('active'));
        }
    }

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

        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
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

    // ===== DASHBOARD =====
    async loadDashboard() {
        this.batches = await this.fetchBatches();
        this.profiles = await this.fetchProfiles();
        this.renderDashboard();
    }

    renderDashboard() {
        document.getElementById('totalBatches').textContent = this.batches.length;
        document.getElementById('totalProfiles').textContent = this.profiles.length;

        if (this.batches.length > 0) {
            const totalRating = this.batches.reduce((sum, b) => sum + (parseInt(b.rating) || 0), 0);
            document.getElementById('avgRating').textContent = (totalRating / this.batches.length).toFixed(1);
        } else {
            document.getElementById('avgRating').textContent = '0.0';
        }

        const recentList = document.getElementById('recentBatchesList');
        const sortedBatches = [...this.batches].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

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
        addStageBtn.addEventListener('click', () => this.addStageRow());

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveProfile();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeProfileModal();
        });

        this.setupStopwatch();

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

        if (this.stopwatchInterval) {
            clearInterval(this.stopwatchInterval);
            this.stopwatchInterval = null;
        }
        this.stopwatchTime = 0;
        this.stopwatchRunning = false;
        this.stopwatchSticky = false;
        this.firstCrackTime = null;
        this.updateStopwatchDisplay();

        this.releaseWakeLock();
        this.stopIosWakeLock();

        const stopwatchEl = this.stopwatchEl();
        const placeholderEl = this.placeholderEl();
        if (stopwatchEl) stopwatchEl.classList.remove('is-sticky');
        if (placeholderEl) placeholderEl.classList.remove('active');

        const fcResult = document.getElementById('firstCrackResult');
        if (fcResult) fcResult.style.display = 'none';
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
                        <input type="number" class="stage-temp" placeholder="°C" min="0" max="300" value="${stage.temp || ''}">
                    </div>
                    <div class="stage-field">
                        <label class="stage-label">Czas</label>
                        <input type="text" class="stage-time" placeholder="mm:ss" value="${stage.time || '00:00'}">
                    </div>
                    <div class="stage-field stage-field-note">
                        <label class="stage-label">Notatka</label>
                        <input type="text" class="stage-note" placeholder="np. first crack" value="${stage.note || ''}">
                    </div>
                </div>
            </div>
        `;
    }

    addStageRow() {
        const container = document.getElementById('roastStages');
        const currentRows = container.querySelectorAll('.stage-row');

        const mins = Math.floor(this.stopwatchTime / 60);
        const secs = this.stopwatchTime % 60;
        const timeStr = mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');

        const stage = { time: timeStr };
        const newRow = document.createElement('div');
        newRow.innerHTML = this.createStageRowHTML(currentRows.length + 1, stage);
        container.appendChild(newRow.firstElementChild);
        this.attachStageListeners();

        const newStage = container.lastElementChild;
        if (newStage) newStage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    attachStageListeners() {
        document.querySelectorAll('.btn-remove-stage').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                const row = e.target.closest('.stage-row');
                const rows = document.querySelectorAll('.stage-row');
                if (rows.length > 1) {
                    row.remove();
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

        const stages = [];
        document.querySelectorAll('.stage-row').forEach(row => {
            const temp = row.querySelector('.stage-temp').value;
            const time = row.querySelector('.stage-time').value;
            const note = row.querySelector('.stage-note').value;
            if (temp || time) {
                stages.push({ temp: parseFloat(temp) || 0, time: time || '', note });
            }
        });

        // Pokaż skeleton loading
        const profilesContainer = document.getElementById('profilesList');
        profilesContainer.innerHTML = this.createSkeletonHTML('profile-card').repeat(2);

        const profileData = { name, beanType, origin, stages, notes };

        let success = false;
        if (this.editingProfileId) {
            success = await this.updateProfile(this.editingProfileId, profileData);
            if (success) this.showToast('Profil zaktualizowany!');
        } else {
            const newProfile = await this.createProfile(profileData);
            success = !!newProfile;
            if (success) this.showToast('Profil utworzony!');
        }

        if (success) {
            this.profiles = await this.fetchProfiles();
            this.renderProfiles();
        }

        this.closeProfileModal();
    }

    async loadProfiles() {
        this.profiles = await this.fetchProfiles();
        this.renderProfiles();
    }

    renderProfiles() {
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
            document.getElementById('profilesList').innerHTML = this.createSkeletonHTML('profile-card');
            const success = await this.deleteProfileFromDB(id);
            if (success) {
                this.profiles = await this.fetchProfiles();
                this.renderProfiles();
                await this.loadDashboard();
                this.showToast('Profil usunięty', 'warning');
            }
        }
    }

    useProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (profile) this.openProfileViewModal(profile);
    }

    openProfileViewModal(profile) {
        const modal = document.getElementById('profileViewModal');
        const stagesContainer = document.getElementById('profileViewStages');

        document.getElementById('profileViewName').textContent = profile.name;
        document.getElementById('profileViewType').textContent = this.getBeanTypeName(profile.beanType);
        document.getElementById('profileViewOrigin').textContent = profile.origin || 'Brak pochodzenia';

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

        const notesEl = document.getElementById('profileViewNotes');
        if (profile.notes) {
            notesEl.style.display = 'block';
            notesEl.querySelector('p').textContent = profile.notes;
        } else {
            notesEl.style.display = 'none';
        }

        this.activeProfileId = profile.id;
        modal.classList.add('active');
    }

    getBeanTypeName(type) {
        const names = { 'arabica': 'Arabica', 'robusta': 'Robusta', 'blend': 'Mieszanka' };
        return names[type] || 'Arabica';
    }

    setupProfileViewModal() {
        const modal = document.getElementById('profileViewModal');
        const closeBtn = modal.querySelector('.modal-close');
        const startBtn = document.getElementById('startRoastingBtn');

        closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });

        startBtn.addEventListener('click', (e) => {
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
        this.lastStageIndex = 0;

        this.openRoastingModal(profile);
    }

    openRoastingModal(profile) {
        const modal = document.getElementById('roastingModal');
        const stagesContainer = document.getElementById('roastingStagesList');

        document.getElementById('roastingTimer').textContent = '00:00:00';
        document.getElementById('roastingCurrentStage').querySelector('.current-stage-name').textContent = 'Przygotowanie';
        document.getElementById('roastingFCResult').style.display = 'none';

        let stagesHTML = '';
        let hasFCStage = false;

        if (profile.stages && profile.stages.length > 0) {
            profile.stages.forEach((stage, index) => {
                const isFC = stage.note && stage.note.toLowerCase().includes('first crack');
                if (isFC) hasFCStage = true;

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

        const firstStageEl = stagesContainer.querySelector('.roasting-stage');
        if (firstStageEl) {
            firstStageEl.classList.remove('upcoming');
            firstStageEl.classList.add('active');
        }

        this.lastStageIndex = 0;

        document.getElementById('roastingFCBtn').style.display = 'inline-flex';
        document.getElementById('finishRoastingBtn').style.display = 'none';
        document.getElementById('roastingPauseBtn').innerHTML = '⏸️ Pauza';
        document.getElementById('roastingPauseBtn').classList.remove('paused');
        this.roastingPaused = false;

        modal.classList.add('active');
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
        let currentStageName = 'Palenie';
        const profile = this.roastingProfile;

        if (profile && profile.stages && profile.stages.length > 0) {
            const firstStage = profile.stages[0];
            currentStageName = firstStage.note || `Etap 1`;
        }

        const stagesContainer = document.getElementById('roastingStagesList');
        const stageElements = Array.from(stagesContainer.querySelectorAll('.roasting-stage'));

        let currentStageIndex = 0;
        for (let i = stageElements.length - 1; i >= 0; i--) {
            const stageTime = parseInt(stageElements[i].dataset.time) || 0;
            if (stageTime > 0 && this.roastingTime >= stageTime) {
                currentStageIndex = i;
                break;
            }
        }

        if (this.lastStageIndex !== currentStageIndex) {
            this.playStageChangeSound();
        }
        this.lastStageIndex = currentStageIndex;

        stages.forEach((stageEl) => {
            stageEl.classList.remove('completed', 'active', 'upcoming');
        });

        stageElements.forEach((stageEl, index) => {
            if (index < currentStageIndex) {
                stageEl.classList.add('completed');
            } else if (index === currentStageIndex) {
                stageEl.classList.add('active');
                const note = stageEl.querySelector('.roasting-stage-note')?.textContent;
                const label = stageEl.querySelector('.roasting-stage-label');

                if (label && stageEl.classList.contains('stage-fc')) {
                    currentStageName = label.textContent;
                } else if (note && !note.includes('Szacowany') && note.trim() !== '') {
                    currentStageName = note;
                } else {
                    currentStageName = `Etap ${index + 1}`;
                }
            } else {
                stageEl.classList.add('upcoming');
            }
        });

        document.getElementById('roastingCurrentStage').querySelector('.current-stage-name').textContent = currentStageName;
    }

    playStageChangeSound() {
        try {
            if (!this._audioContext) {
                this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const audioContext = this._audioContext;
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

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
            playTone(1319, now, 0.15);
            playTone(1047, now + 0.12, 0.2);

        } catch (e) {}
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

        pauseBtn.addEventListener('click', () => this.toggleRoastingPause());
        fcBtn.addEventListener('click', () => this.recordRoastingFC());
        cancelBtn.addEventListener('click', () => {
            this.stopRoasting();
            modal.classList.remove('active');
        });
        finishBtn.addEventListener('click', () => this.finishRoasting());
    }

    toggleRoastingPause() {
        const pauseBtn = document.getElementById('roastingPauseBtn');

        if (this.roastingPaused) {
            this.roastingPaused = false;
            this.requestWakeLock();
            if (this.noSleep) this.noSleep.enable();
            this.roastingInterval = setInterval(() => {
                this.roastingTime++;
                this.updateRoastingDisplay();
                this.checkStagesProgress();
            }, 1000);
            pauseBtn.innerHTML = '⏸️ Pauza';
            pauseBtn.classList.remove('paused');
        } else {
            this.roastingPaused = true;
            if (this.roastingInterval) {
                clearInterval(this.roastingInterval);
                this.roastingInterval = null;
            }
            this.releaseWakeLock();
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

        const profile = this.roastingProfile;
        let estimatedFCTime = null;
        if (profile.stages) {
            const fcStage = profile.stages.find(s => s.note && s.note.toLowerCase().includes('first crack'));
            if (fcStage) {
                estimatedFCTime = this.timeToSeconds(fcStage.time);
            }
        }

        document.getElementById('fcEstimatedTime').textContent = estimatedFCTime ? this.formatTime(estimatedFCTime) : '--:--';

        document.getElementById('roastingFCBtn').style.display = 'none';
        document.getElementById('finishRoastingBtn').style.display = 'inline-flex';

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
        this.stopIosWakeLock();
    }

    finishRoasting() {
        this.stopRoasting();
        document.getElementById('roastingModal').classList.remove('active');

        this.openBatchModal();

        document.getElementById('batchProfile').value = this.roastingProfile.id;
        document.getElementById('batchDuration').value = (this.roastingTime / 60).toFixed(1);

        if (this.roastingActualFCTime) {
            document.getElementById('batchNotes').value = `FC: ${this.formatTime(this.roastingActualFCTime)}`;
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

        // Pokaż skeleton
        document.getElementById('batchesList').innerHTML = this.createSkeletonHTML('batch-card').repeat(2);

        let success = false;
        if (this.editingBatchId) {
            success = await this.updateBatch(this.editingBatchId, data);
            if (success) this.showToast('Partia zaktualizowana!');
        } else {
            const newBatch = await this.createBatch(data);
            success = !!newBatch;
            if (success) this.showToast('Nowa partia zapisana!');
        }

        if (success) {
            this.batches = await this.fetchBatches();
            this.renderBatches();
            await this.loadDashboard();
        }

        this.closeBatchModal();
    }

    async loadBatches() {
        this.batches = await this.fetchBatches();
        this.renderBatches();
    }

    renderBatches() {
        const searchTerm = document.getElementById('batchSearch')?.value?.toLowerCase() || '';
        const filter = document.getElementById('batchFilter')?.value || 'all';

        let filtered = [...this.batches].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (searchTerm) {
            filtered = filtered.filter(b =>
                b.notes?.toLowerCase().includes(searchTerm) ||
                b.profileName?.toLowerCase().includes(searchTerm)
            );
        }

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
            document.getElementById('batchesList').innerHTML = this.createSkeletonHTML('batch-card');
            const success = await this.deleteBatchFromDB(id);
            if (success) {
                this.batches = await this.fetchBatches();
                this.renderBatches();
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
                this.startIosWakeLockDirectly(e);
                this.startStopwatch();
            });
        }
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseStopwatch());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetStopwatch());

        this.setupIosWakeLock();
        this.setupStickyStopwatch();
    }

    setupStickyStopwatch() {
        const stopwatch = this.stopwatchEl();
        const placeholder = this.placeholderEl();
        const modal = document.getElementById('profileModal');
        const modalContent = modal ? modal.querySelector('.modal-content') : null;

        if (!stopwatch || !modalContent) return;

        modalContent.addEventListener('scroll', () => {
            if (!this.stopwatchRunning) return;

            if (!this.stopwatchSticky) {
                const stopwatchRect = stopwatch.getBoundingClientRect();
                if (stopwatchRect.bottom < 80) {
                    this.makeStopwatchSticky();
                }
            } else {
                const scrollTop = modalContent.scrollTop;
                const placeholderRect = placeholder.getBoundingClientRect();
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
        this.stopIosWakeLock();
    }

    resetStopwatch() {
        this.pauseStopwatch();
        this.stopwatchTime = 0;
        this.firstCrackTime = null;
        this.updateStopwatchDisplay();
        this.unmakeStopwatchSticky();
        this.releaseWakeLock();
        this.stopIosWakeLock();

        const fcResult = document.getElementById('firstCrackResult');
        if (fcResult) fcResult.style.display = 'none';

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
        if (this.firstCrackTime !== null && this.firstCrackTime > 0) {
            this.updateFirstCrackPercent();
        }
    }

    recordFirstCrack() {
        this.firstCrackTime = this.stopwatchTime;
        const result = document.getElementById('firstCrackResult');
        if (result) result.style.display = 'block';
        this.updateFirstCrackPercent();
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

        fcStage.innerHTML = `
            <button type="button" class="btn-remove-stage">×</button>
            <div class="stage-header">
                <span class="stage-num stage-num-fc">FC</span>
            </div>
            <div class="stage-fields">
                <div class="stage-field">
                    <label class="stage-label">Temp.</label>
                    <input type="number" class="stage-temp" placeholder="°C" min="0" max="300">
                </div>
                <div class="stage-field">
                    <label class="stage-label">Czas</label>
                    <input type="text" class="stage-time" placeholder="mm:ss" value="${timeStr}">
                </div>
                <div class="stage-field stage-field-note">
                    <label class="stage-label">Notatka</label>
                    <input type="text" class="stage-note" placeholder="np. first crack" value="First Crack">
                </div>
            </div>
        `;

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
        document.getElementById('calcLossBtn').addEventListener('click', () => {
            const before = parseFloat(document.getElementById('weightBefore').value);
            const after = parseFloat(document.getElementById('weightAfter').value);

            if (before && after && before > 0) {
                const loss = ((before - after) / before * 100).toFixed(2);
                const resultEl = document.getElementById('lossResult');
                resultEl.querySelector('.result-value').textContent = loss + '%';
                resultEl.querySelector('.result-label').textContent = this.getRoastTypeByLoss(parseFloat(loss));
            } else {
                this.showToast('Wprowadź poprawne wartości', 'error');
            }
        });

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

        document.getElementById('calcTimeBtn').addEventListener('click', () => {
            const target = parseFloat(document.getElementById('targetTemp').value);
            const current = parseFloat(document.getElementById('currentTemp').value);
            const rate = parseFloat(document.getElementById('roastType').value);

            if (target && current && target > current) {
                const minutes = ((target - current) / rate).toFixed(1);
                document.getElementById('timeResult').querySelector('.result-value').textContent = minutes + ' min';
            } else {
                this.showToast('Wprowadź poprawne wartości', 'error');
            }
        });
    }

    getRoastTypeByLoss(lossPercent) {
        if (lossPercent < 11) return 'Zielona / Cynamonowa';
        if (lossPercent < 13) return 'Jasna (Light)';
        if (lossPercent < 15) return 'Średnia (Medium)';
        if (lossPercent < 17) return 'Średnio-ciemna';
        if (lossPercent < 19) return 'Ciemna (Dark)';
        if (lossPercent < 21) return 'French';
        return 'Italian';
    }

    // ===== iOS VIEWPORT FIX =====
    setupiOSViewportFix() {
        const originalHeight = window.innerHeight;

        document.addEventListener('blur', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                setTimeout(() => {
                    window.scrollTo(0, 0);
                    document.body.style.minHeight = originalHeight + 'px';
                }, 100);
            }
        }, true);

        window.addEventListener('resize', () => {
            if (window.innerHeight >= originalHeight * 0.9) {
                document.body.style.minHeight = '';
            }
        });

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

// Inicjalizacja
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CoffeeRoasterApp();

    const batchSearch = document.getElementById('batchSearch');
    const batchFilter = document.getElementById('batchFilter');

    if (batchSearch) batchSearch.addEventListener('input', () => window.app.renderBatches());
    if (batchFilter) batchFilter.addEventListener('change', () => window.app.renderBatches());
});

// Service Worker
if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => console.log('SW zarejestrowany:', registration.scope))
            .catch(error => console.log('Rejestracja SW nieudana:', error));
    });
}
