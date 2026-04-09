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
    // Inicjalizacja zmiennych stopera
    this.stopwatchInterval = null;
    this.stopwatchTime = 0;
    this.stopwatchRunning = false;
    this.stopwatchSticky = false;
    this.firstCrackTime = null;
    this.lastStageIndex = 0;
    this.init();
  }

  async init() {
    const recentList = document.getElementById('recentBatchesList');
    const profilesList = document.getElementById('profilesList');
    const batchesList = document.getElementById('batchesList');

    if (recentList) recentList.innerHTML = this.createSkeletonHTML('batch-card').repeat(2);
    if (profilesList) profilesList.innerHTML = this.createSkeletonHTML('profile-card').repeat(2);
    if (batchesList) batchesList.innerHTML = this.createSkeletonHTML('batch-card').repeat(2);

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

  // ===== SKELETON =====
  createSkeletonHTML(type) {
    if (type === 'profile-card' || type === 'batch-card') {
      return `<div class="skeleton-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div></div>`;
    }
    return '<div class="skeleton-card"><div class="skeleton skeleton-text"></div></div>';
  }

  // ===== SUPABASE =====
  async initSupabase() {
    try {
      // Najpierw załaduj konfigurację (z API lub lokalnie)
      if (window.loadSupabaseConfig) {
        await window.loadSupabaseConfig();
      }

      if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
        console.error('Supabase: Brak konfiguracji! Ustaw SUPABASE_URL i SUPABASE_ANON_KEY w Vercel lub lokalnie.');
        return;
      }
      this.supabase = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
      const { error } = await this.supabase.from('profiles').select('count', { count: 'exact', head: true });
      if (error) {
        console.error('Supabase: Błąd połączenia:', error);
      } else {
        console.log('Supabase: Połączono pomyślnie');
        this.supabaseReady = true;
      }
    } catch (err) {
      console.error('Supabase: Błąd inicjalizacji:', err);
    }
  }

  async fetchProfiles() {
    if (!this.supabaseReady) {
      console.log('fetchProfiles: Supabase nie jest gotowy');
      return [];
    }
    const { data, error } = await this.supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Błąd pobierania profili:', error); return []; }
    console.log('fetchProfiles: pobrano', data?.length, 'profili');
    return data.map(p => ({
      id: p.id, name: p.name, beanType: p.bean_type || 'arabica', origin: p.origin || '',
      stages: p.stages || [], notes: p.notes || '', createdAt: p.created_at
    }));
  }

  async createProfile(profileData) {
    if (!this.supabaseReady) return null;
    const dbData = { name: profileData.name, bean_type: profileData.beanType || 'arabica', origin: profileData.origin || '', stages: profileData.stages || [], notes: profileData.notes || '' };
    const { data, error } = await this.supabase.from('profiles').insert(dbData).select().single();
    if (error) { console.error('Błąd tworzenia profilu:', error); return null; }
    return { id: data.id, name: data.name, beanType: data.bean_type, origin: data.origin, stages: data.stages, notes: data.notes, createdAt: data.created_at };
  }

  async updateProfile(id, profileData) {
    if (!this.supabaseReady) return false;
    const dbData = { name: profileData.name, bean_type: profileData.beanType || 'arabica', origin: profileData.origin || '', stages: profileData.stages || [], notes: profileData.notes || '' };
    const { error } = await this.supabase.from('profiles').update(dbData).eq('id', id);
    if (error) { console.error('Błąd aktualizacji profilu:', error); return false; }
    return true;
  }

  async deleteProfileFromDB(id) {
    if (!this.supabaseReady) return false;
    const { error } = await this.supabase.from('profiles').delete().eq('id', id);
    return !error;
  }

  async fetchBatches() {
    if (!this.supabaseReady) return [];
    const { data, error } = await this.supabase.from('batches').select('*, profile:profiles(id, name)').order('date', { ascending: false });
    if (error) { console.error('Błąd pobierania partii:', error); return []; }
    return data.map(b => ({
      id: b.id, profileId: b.profile_id, profileName: b.profile?.name || null, date: b.date,
      weight: b.weight, roastLevel: b.roast_level || 'medium', duration: b.duration,
      finalTemp: b.final_temp, rating: b.rating, notes: b.notes || '', createdAt: b.created_at
    }));
  }

  async createBatch(batchData) {
    if (!this.supabaseReady) return null;
    const dbData = { profile_id: batchData.profileId || null, date: batchData.date, weight: batchData.weight, roast_level: batchData.roastLevel || 'medium', duration: batchData.duration || null, final_temp: batchData.finalTemp || null, rating: batchData.rating || 5, notes: batchData.notes || '' };
    const { data, error } = await this.supabase.from('batches').insert(dbData).select().single();
    if (error) { console.error('Błąd tworzenia partii:', error); return null; }
    return { id: data.id, profileId: data.profile_id, date: data.date, weight: data.weight, roastLevel: data.roast_level, duration: data.duration, finalTemp: data.final_temp, rating: data.rating, notes: data.notes };
  }

  async updateBatch(id, batchData) {
    if (!this.supabaseReady) return false;
    const dbData = { profile_id: batchData.profileId || null, date: batchData.date, weight: batchData.weight, roast_level: batchData.roastLevel || 'medium', duration: batchData.duration || null, final_temp: batchData.finalTemp || null, rating: batchData.rating || 5, notes: batchData.notes || '' };
    const { error } = await this.supabase.from('batches').update(dbData).eq('id', id);
    return !error;
  }

  async deleteBatchFromDB(id) {
    if (!this.supabaseReady) return false;
    const { error } = await this.supabase.from('batches').delete().eq('id', id);
    return !error;
  }

  // ===== WAKE LOCK =====
  async setupWakeLock() {
    await this.requestWakeLock();
    document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible') await this.requestWakeLock(); });
  }

  async requestWakeLock() { try { if ('wakeLock' in navigator) this.wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {} }

  async releaseWakeLock() { if (this.wakeLock) { await this.wakeLock.release(); this.wakeLock = null; } }

  isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

  setupIosWakeLock() { if (typeof NoSleep !== 'undefined') this.noSleep = new NoSleep(); }

  startIosWakeLockDirectly() { if (this.noSleep) this.noSleep.enable(); }

  stopIosWakeLock() { if (this.noSleep) this.noSleep.disable(); }

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
    if (menuToggle && navMenu) menuToggle.addEventListener('click', () => navMenu.classList.toggle('active'));
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)'; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // ===== DASHBOARD =====
  async loadDashboard() {
    this.batches = await this.fetchBatches();
    this.profiles = await this.fetchProfiles();
    this.renderDashboard();
  }

  renderDashboard() {
    // Usuń klasę loading ze statystyk
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('loading'));

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
      recentList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔥</div><h3>Brak partii</h3><p>Dodaj swoją pierwszą partię palenia!</p></div>';
    } else {
      recentList.innerHTML = sortedBatches.map(batch => this.createBatchCardHTML(batch)).join('');
    }
  }

  // ===== PROFILE =====
  setupProfileModal() {
    const modal = document.getElementById('profileModal');
    document.getElementById('addProfileBtn').addEventListener('click', () => this.openProfileModal());
    modal.querySelector('.modal-close').addEventListener('click', () => this.closeProfileModal());
    modal.querySelector('.modal-cancel').addEventListener('click', () => this.closeProfileModal());
    document.getElementById('addStageBtn').addEventListener('click', () => this.addStageRow());
    document.getElementById('profileForm').addEventListener('submit', async (e) => { e.preventDefault(); await this.saveProfile(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) this.closeProfileModal(); });
    this.setupStopwatch();
    const firstCrackBtn = document.getElementById('firstCrackBtn');
    if (firstCrackBtn) firstCrackBtn.addEventListener('click', () => this.recordFirstCrack());
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
        stagesContainer.innerHTML = profile.stages && profile.stages.length > 0
          ? profile.stages.map((stage, index) => this.createStageRowHTML(index + 1, stage)).join('')
          : this.createStageRowHTML(1, { time: '00:00' });
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
    if (this.stopwatchInterval) { clearInterval(this.stopwatchInterval); this.stopwatchInterval = null; }
    this.stopwatchTime = 0; this.stopwatchRunning = false; this.stopwatchSticky = false; this.firstCrackTime = null;
    this.updateStopwatchDisplay();
    this.releaseWakeLock(); this.stopIosWakeLock();
    const stopwatchEl = this.stopwatchEl(); const placeholderEl = this.placeholderEl();
    if (stopwatchEl) stopwatchEl.classList.remove('is-sticky');
    if (placeholderEl) placeholderEl.classList.remove('active');
    const fcResult = document.getElementById('firstCrackResult');
    if (fcResult) fcResult.style.display = 'none';
  }

  createStageRowHTML(num, stage = {}) {
    const isFC = stage.note && stage.note.toLowerCase().includes('first crack');
    return `<div class="stage-row ${isFC ? 'stage-fc' : ''}" data-stage="${num}">
      <button type="button" class="btn-remove-stage">×</button>
      <div class="stage-header"><span class="${isFC ? 'stage-num stage-num-fc' : 'stage-num'}">${isFC ? 'FC' : num}</span></div>
      <div class="stage-fields">
        <div class="stage-field"><label class="stage-label">Temp.</label><input type="number" class="stage-temp" placeholder="°C" min="0" max="300" value="${stage.temp || ''}"></div>
        <div class="stage-field"><label class="stage-label">Czas</label><input type="text" class="stage-time" placeholder="mm:ss" value="${stage.time || '00:00'}"></div>
        <div class="stage-field stage-field-note"><label class="stage-label">Notatka</label><input type="text" class="stage-note" placeholder="np. first crack" value="${stage.note || ''}"></div>
      </div></div>`;
  }

  addStageRow() {
    const container = document.getElementById('roastStages');
    const currentRows = container.querySelectorAll('.stage-row');
    const mins = Math.floor(this.stopwatchTime / 60);
    const secs = this.stopwatchTime % 60;
    const timeStr = mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
    const newRow = document.createElement('div');
    newRow.innerHTML = this.createStageRowHTML(currentRows.length + 1, { time: timeStr });
    container.appendChild(newRow.firstElementChild);
    this.attachStageListeners();
    container.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
            const numEl = r.querySelector('.stage-num');
            if (!numEl.classList.contains('stage-num-fc')) {
              numEl.textContent = i + 1;
            }
            r.dataset.stage = i + 1;
          });
        } else {
          this.showToast('Musi zostać przynajmniej jeden etap', 'warning');
        }
      });
    });
  }

async saveProfile() {
    console.log('saveProfile: start');
    const name = document.getElementById("profileName").value.trim();
    const beanType = document.getElementById("beanType").value;
    const origin = document.getElementById("origin").value.trim();
    const notes = document.getElementById("profileNotes").value.trim();
    const stages = [];
    document.querySelectorAll(".stage-row").forEach(row => {
      const temp = row.querySelector(".stage-temp").value;
      const time = row.querySelector(".stage-time").value;
      const note = row.querySelector(".stage-note").value;
      if (temp || time) stages.push({ temp: parseFloat(temp) || 0, time: time || "", note });
    });
    const profileData = { name, beanType, origin, stages, notes };
    console.log('saveProfile: data', profileData);
    let success = false;
    if (this.editingProfileId) {
      success = await this.updateProfile(this.editingProfileId, profileData);
      if (success) this.showToast("Profil zaktualizowany!"); else this.showToast("Błąd aktualizacji profilu", "error");
    } else {
      const newProfile = await this.createProfile(profileData);
      console.log('saveProfile: newProfile', newProfile);
      success = !!newProfile;
      if (success) this.showToast("Profil utworzony!"); else this.showToast("Błąd tworzenia profilu", "error");
    }
    this.closeProfileModal();
    if (success) {
      console.log('saveProfile: odświeżanie listy...');
      // Najpierw przełącz widok, POTEM renderuj
      this.switchToView("profiles");
      // Teraz pobierz i wyrenderuj dane
      this.profiles = await this.fetchProfiles();
      console.log('saveProfile: profiles', this.profiles.length);
      this.renderProfiles();
      this.batches = await this.fetchBatches();
      this.renderDashboard();
      console.log('saveProfile: koniec');
    }
  }

  switchToView(viewName) {
    const navButtons = document.querySelectorAll(".nav-btn");
    const views = document.querySelectorAll(".view");
    navButtons.forEach(b => b.classList.remove("active"));
    views.forEach(v => v.classList.remove("active"));
    document.querySelector(`.nav-btn[data-view="${viewName}"]`)?.classList.add("active");
    document.getElementById(viewName)?.classList.add("active");
    this.currentView = viewName;
  }

  async loadProfiles() {
    this.profiles = await this.fetchProfiles();
    this.renderProfiles();
  }

  renderProfiles() {
    console.log('renderProfiles: start, profiles count:', this.profiles.length);
    const container = document.getElementById('profilesList');
    console.log('renderProfiles: container:', container, 'display:', container ? window.getComputedStyle(container.closest('.view')).display : 'no container');
    if (this.profiles.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><h3>Brak profili</h3><p>Utwórz pierwszy profil palenia dla swoich ziaren.</p></div>';
      return;
    }
    container.innerHTML = this.profiles.map(profile => `
      <div class="profile-card" data-id="${profile.id}">
        <div class="profile-header"><span class="profile-name">${profile.name}</span><span class="profile-type">${profile.beanType || 'arabica'}</span></div>
        ${profile.origin ? `<div class="card-body" style="margin-bottom: 8px;">📍 ${profile.origin}</div>` : ''}
        <div class="profile-info"><span>${profile.stages?.length || 0} etapów</span><span>Utworzony: ${this.formatDate(profile.createdAt)}</span></div>
        <div class="profile-actions">
          <button onclick="app.openProfileModal('${profile.id}')">Edytuj</button>
          <button onclick="app.useProfile('${profile.id}')">Użyj</button>
          <button class="btn-delete" onclick="app.deleteProfile('${profile.id}')">Usuń</button>
        </div>
      </div>`).join('');
  }

  async deleteProfile(id) {
    if (confirm('Czy na pewno chcesz usunąć ten profil?')) {
      const success = await this.deleteProfileFromDB(id);
      if (success) {
        this.switchToView('profiles');
        this.profiles = await this.fetchProfiles();
        this.renderProfiles();
        await this.loadDashboard();
        this.showToast('Profil usunięty', 'warning');
      } else {
        this.showToast('Błąd usuwania profilu', 'error');
      }
    }
  }

  useProfile(profileId) {
    const profile = this.profiles.find(p => p.id === profileId);
    if (profile) this.openProfileViewModal(profile);
  }

  openProfileViewModal(profile) {
    const modal = document.getElementById('profileViewModal');
    document.getElementById('profileViewName').textContent = profile.name;
    document.getElementById('profileViewType').textContent = this.getBeanTypeName(profile.beanType);
    document.getElementById('profileViewOrigin').textContent = profile.origin || 'Brak pochodzenia';
    let stagesHTML = '';
    let hasFCStage = false;
    if (profile.stages && profile.stages.length > 0) {
      profile.stages.forEach((stage, index) => {
        const isFC = stage.note && stage.note.toLowerCase().includes('first crack');
        if (isFC) hasFCStage = true;
        stagesHTML += `<div class="profile-view-stage ${isFC ? 'stage-fc' : ''}">
          <span class="profile-view-stage-num ${isFC ? 'stage-num-fc' : ''}">${isFC ? 'FC' : index + 1}</span>
          <div class="profile-view-stage-info">
            <span class="profile-view-stage-time">${stage.time || '--:--'}</span>
            <span class="profile-view-stage-temp">${stage.temp ? stage.temp + '°C' : '--°C'}</span>
            ${isFC ? '<span class="profile-view-stage-label">First Crack</span>' : `<span class="profile-view-stage-note">${stage.note || ''}</span>`}
          </div></div>`;
      });
    }
    if (!hasFCStage) stagesHTML += `<div class="profile-view-stage stage-estimated-fc"><span class="profile-view-stage-num">?</span><div class="profile-view-stage-info"><span class="profile-view-stage-time">--:--</span><span class="profile-view-stage-note">Szacowany First Crack</span><span class="profile-view-stage-label estimated">Szacowany FC</span></div></div>`;
    document.getElementById('profileViewStages').innerHTML = stagesHTML;
    const notesEl = document.getElementById('profileViewNotes');
    if (profile.notes) { notesEl.style.display = 'block'; notesEl.querySelector('p').textContent = profile.notes; }
    else notesEl.style.display = 'none';
    this.activeProfileId = profile.id;
    modal.classList.add('active');
  }

  getBeanTypeName(type) { return { 'arabica': 'Arabica', 'robusta': 'Robusta', 'blend': 'Mieszanka' }[type] || 'Arabica'; }

  setupProfileViewModal() {
    const modal = document.getElementById('profileViewModal');
    modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    document.getElementById('startRoastingBtn').addEventListener('click', (e) => { this.startIosWakeLockDirectly(); modal.classList.remove('active'); this.startRoastingMode(this.activeProfileId); });
  }

  // ===== TRYB PALENIA =====
  async startRoastingMode(profileId) {
    const profile = this.profiles.find(p => p.id === profileId);
    if (!profile) return;

    // Inicjalizuj AudioContext przy starcie palenia (iOS wymaga interakcji)
    await this.initAudioContext();

    this.roastingProfile = profile;
    this.roastingTime = 0;
    this.roastingFCClicked = false;
    this.roastingActualFCTime = null;
    this.lastStageIndex = 0;
    this.openRoastingModal(profile);
  }

  openRoastingModal(profile) {
    const modal = document.getElementById('roastingModal');
    document.getElementById('roastingTimer').textContent = '00:00:00';
    document.getElementById('roastingCurrentStage').querySelector('.current-stage-name').textContent = 'Przygotowanie';
    document.getElementById('roastingFCResult').style.display = 'none';
    let stagesHTML = '';
    let hasFCStage = false;
    if (profile.stages && profile.stages.length > 0) {
      profile.stages.forEach((stage, index) => {
        const isFC = stage.note && stage.note.toLowerCase().includes('first crack');
        if (isFC) hasFCStage = true;
        stagesHTML += `<div class="roasting-stage ${isFC ? 'stage-fc' : ''} upcoming" data-index="${index}" data-time="${this.timeToSeconds(stage.time)}" data-fc="${isFC}">
          <span class="roasting-stage-num">${isFC ? 'FC' : index + 1}</span>
          <div class="roasting-stage-info">
            <span class="roasting-stage-time">${stage.time || '--:--'}</span>
            <span class="roasting-stage-temp">${stage.temp ? stage.temp + '°C' : ''}</span>
            ${isFC ? '<span class="roasting-stage-label">First Crack</span>' : `<span class="roasting-stage-note">${stage.note || ''}</span>`}
          </div></div>`;
      });
    }
    if (!hasFCStage) stagesHTML += `<div class="roasting-stage estimated-fc upcoming" data-index="fc-estimated" data-fc="true"><span class="roasting-stage-num">?</span><div class="roasting-stage-info"><span class="roasting-stage-time">--:--</span><span class="roasting-stage-note">Szacowany First Crack</span><span class="roasting-stage-label">Szacowany FC</span></div></div>`;
    document.getElementById('roastingStagesList').innerHTML = stagesHTML;
    const firstStageEl = document.getElementById('roastingStagesList').querySelector('.roasting-stage');
    if (firstStageEl) { firstStageEl.classList.remove('upcoming'); firstStageEl.classList.add('active'); }
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
    this.roastingInterval = setInterval(() => { this.roastingTime++; this.updateRoastingDisplay(); this.checkStagesProgress(); }, 1000);
  }

  updateRoastingDisplay() {
    const h = Math.floor(this.roastingTime / 3600);
    const m = Math.floor((this.roastingTime % 3600) / 60);
    const s = this.roastingTime % 60;
    document.getElementById('roastingTimer').textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  checkStagesProgress() {
    const stages = document.querySelectorAll('.roasting-stage');
    let currentStageName = 'Palenie';
    if (this.roastingProfile?.stages?.length > 0) currentStageName = this.roastingProfile.stages[0].note || 'Etap 1';
    const stageElements = Array.from(document.getElementById('roastingStagesList').querySelectorAll('.roasting-stage'));
    let currentStageIndex = 0;
    for (let i = stageElements.length - 1; i >= 0; i--) {
      const stageTime = parseInt(stageElements[i].dataset.time) || 0;
      if (stageTime > 0 && this.roastingTime >= stageTime) { currentStageIndex = i; break; }
    }
    if (this.lastStageIndex !== currentStageIndex) this.playStageChangeSound();
    this.lastStageIndex = currentStageIndex;
    stages.forEach(s => s.classList.remove('completed', 'active', 'upcoming'));
    stageElements.forEach((stageEl, index) => {
      if (index < currentStageIndex) stageEl.classList.add('completed');
      else if (index === currentStageIndex) {
        stageEl.classList.add('active');
        const note = stageEl.querySelector('.roasting-stage-note')?.textContent;
        const label = stageEl.querySelector('.roasting-stage-label');
        if (label && stageEl.classList.contains('stage-fc')) currentStageName = label.textContent;
        else if (note && !note.includes('Szacowany') && note.trim()) currentStageName = note;
        else currentStageName = `Etap ${index + 1}`;
      } else stageEl.classList.add('upcoming');
    });
    document.getElementById('roastingCurrentStage').querySelector('.current-stage-name').textContent = currentStageName;
  }

  // Inicjalizacja AudioContext przy pierwszej interakcji (wymagane na iOS)
  async initAudioContext() {
    if (this._audioContext) return this._audioContext;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this._audioContext = new AudioContext();

      // Na iOS musimy wznowić kontekst po interakcji użytkownika
      if (this._audioContext.state === 'suspended') {
        await this._audioContext.resume();
      }

      // Odtwórz cichy dźwięk aby "odblokować" audio na iOS
      const osc = this._audioContext.createOscillator();
      const gain = this._audioContext.createGain();
      osc.connect(gain);
      gain.connect(this._audioContext.destination);
      gain.gain.setValueAtTime(0.001, this._audioContext.currentTime);
      osc.start();
      osc.stop(this._audioContext.currentTime + 0.001);

      console.log('AudioContext zainicjalizowany:', this._audioContext.state);
      return this._audioContext;
    } catch (e) {
      console.error('Błąd inicjalizacji AudioContext:', e);
      return null;
    }
  }

  async playStageChangeSound() {
    try {
      // Upewnij się, że AudioContext jest zainicjalizowany
      if (!this._audioContext) {
        await this.initAudioContext();
      }

      const ctx = this._audioContext;
      if (ctx && ctx.state === 'running') {
        const playTone = (freq, start, dur) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.3, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
          osc.start(start);
          osc.stop(start + dur);
        };

        const now = ctx.currentTime;
        playTone(1319, now, 0.15);
        playTone(1047, now + 0.12, 0.2);
      }

      // Dodatkowo wibracja na iOS i innych urządzeniach mobilnych
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      console.error('Błąd odtwarzania dźwięku:', e);
    }
  }

  timeToSeconds(timeStr) { if (!timeStr || timeStr === '--:--') return 0; const p = timeStr.split(':'); return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : 0; }

  formatTime(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${(seconds % 60).toString().padStart(2,'0')}`; }

  setupRoastingModal() {
    const modal = document.getElementById('roastingModal');
    modal.querySelector('.modal-close').addEventListener('click', () => { if (confirm('Czy na pewno chcesz przerwać palenie?')) { this.stopRoasting(); modal.classList.remove('active'); } });
    modal.addEventListener('click', (e) => { if (e.target === modal) { if (confirm('Czy na pewno chcesz przerwać palenie?')) { this.stopRoasting(); modal.classList.remove('active'); } } });
    document.getElementById('roastingPauseBtn').addEventListener('click', () => this.toggleRoastingPause());
    document.getElementById('roastingFCBtn').addEventListener('click', () => this.recordRoastingFC());
    document.getElementById('cancelRoastingBtn').addEventListener('click', () => { if (confirm('Czy na pewno chcesz przerwać palenie?')) { this.stopRoasting(); modal.classList.remove('active'); } });
    document.getElementById('finishRoastingBtn').addEventListener('click', () => this.finishRoasting());
  }

  toggleRoastingPause() {
    const btn = document.getElementById('roastingPauseBtn');
    if (this.roastingPaused) {
      this.roastingPaused = false;
      this.requestWakeLock();
      if (this.noSleep) this.noSleep.enable();
      this.roastingInterval = setInterval(() => { this.roastingTime++; this.updateRoastingDisplay(); this.checkStagesProgress(); }, 1000);
      btn.innerHTML = '⏸️ Pauza';
      btn.classList.remove('paused');
    } else {
      this.roastingPaused = true;
      if (this.roastingInterval) { clearInterval(this.roastingInterval); this.roastingInterval = null; }
      this.releaseWakeLock();
      this.stopIosWakeLock();
      btn.innerHTML = '▶️ Wznów';
      btn.classList.add('paused');
    }
  }

  recordRoastingFC() {
    if (this.roastingFCClicked) return;
    this.roastingFCClicked = true;
    this.roastingActualFCTime = this.roastingTime;
    document.getElementById('roastingFCResult').style.display = 'block';
    document.getElementById('fcActualTime').textContent = this.formatTime(this.roastingActualFCTime);
    let estimatedFCTime = null;
    if (this.roastingProfile?.stages) {
      const fcStage = this.roastingProfile.stages.find(s => s.note?.toLowerCase().includes('first crack'));
      if (fcStage) estimatedFCTime = this.timeToSeconds(fcStage.time);
    }
    document.getElementById('fcEstimatedTime').textContent = estimatedFCTime ? this.formatTime(estimatedFCTime) : '--:--';
    document.getElementById('roastingFCBtn').style.display = 'none';
    document.getElementById('finishRoastingBtn').style.display = 'inline-flex';
    const fcStageEl = document.querySelector('.roasting-stage[data-fc="true"]');
    if (fcStageEl) { fcStageEl.classList.remove('active', 'upcoming'); fcStageEl.classList.add('completed'); }
    this.showToast('First Crack zapisany!', 'success');
  }

  stopRoasting() { if (this.roastingInterval) { clearInterval(this.roastingInterval); this.roastingInterval = null; } this.releaseWakeLock(); this.stopIosWakeLock(); }

  finishRoasting() {
    this.stopRoasting();
    document.getElementById('roastingModal').classList.remove('active');
    this.openBatchModal();
    document.getElementById('batchProfile').value = this.roastingProfile.id;
    document.getElementById('batchDuration').value = (this.roastingTime / 60).toFixed(1);
    if (this.roastingActualFCTime) document.getElementById('batchNotes').value = `FC: ${this.formatTime(this.roastingActualFCTime)}`;
    this.showToast('Palenie zakończone! Uzupełnij dane partii.', 'success');
  }

  populateProfileSelect() {
    const select = document.getElementById('batchProfile');
    select.innerHTML = '<option value="">-- Wybierz profil --</option>' + this.profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  // ===== PARTIE =====
  setupBatchModal() {
    const modal = document.getElementById('batchModal');
    document.getElementById('addBatchBtn').addEventListener('click', () => this.openBatchModal());
    modal.querySelector('.modal-close').addEventListener('click', () => this.closeBatchModal());
    modal.querySelector('.modal-cancel').addEventListener('click', () => this.closeBatchModal());
    const ratingInput = document.getElementById('batchRating');
    ratingInput.addEventListener('input', (e) => modal.querySelector('.rating-value').textContent = e.target.value);
    document.getElementById('batchForm').addEventListener('submit', async (e) => { e.preventDefault(); await this.saveBatch(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) this.closeBatchModal(); });
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

  closeBatchModal() { document.getElementById('batchModal').classList.remove('active'); this.editingBatchId = null; }

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
    let success = false;
    if (this.editingBatchId) {
      success = await this.updateBatch(this.editingBatchId, data);
      if (success) this.showToast('Partia zaktualizowana!'); else this.showToast('Błąd aktualizacji partii', 'error');
    } else {
      const newBatch = await this.createBatch(data);
      success = !!newBatch;
      if (success) this.showToast('Nowa partia zapisana!'); else this.showToast('Błąd zapisu partii', 'error');
    }
    this.closeBatchModal();
    if (success) {
      this.batches = await this.fetchBatches();
      this.renderBatches();
      await this.loadDashboard();
    }
  }

  async loadBatches() {
    this.batches = await this.fetchBatches();
    this.renderBatches();
  }

  renderBatches() {
    const searchTerm = document.getElementById('batchSearch')?.value?.toLowerCase() || '';
    const filter = document.getElementById('batchFilter')?.value || 'all';
    let filtered = [...this.batches].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (searchTerm) filtered = filtered.filter(b => b.notes?.toLowerCase().includes(searchTerm) || b.profileName?.toLowerCase().includes(searchTerm));
    if (filter !== 'all') {
      const levels = { 'light': ['green', 'cinnamon', 'light'], 'medium': ['medium'], 'dark': ['medium-dark', 'dark', 'french', 'italian'] };
      filtered = filtered.filter(b => levels[filter]?.includes(b.roastLevel));
    }
    const container = document.getElementById('batchesList');
    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔥</div><h3>Brak partii</h3><p>Dodaj swoją pierwszą partię palenia!</p></div>';
      return;
    }
    container.innerHTML = filtered.map(batch => this.createBatchListItemHTML(batch)).join('');
    container.querySelectorAll('.btn-edit-batch').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); this.openBatchModal(btn.dataset.id); }));
    container.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); this.deleteBatch(btn.dataset.id); }));
  }

  createBatchCardHTML(batch) {
    const profileName = batch.profileName || this.profiles.find(p => p.id === batch.profileId)?.name || 'Brak profilu';
    const roastLevelNames = { 'green': 'Zielona', 'cinnamon': 'Cynamonowa', 'light': 'Jasna', 'medium': 'Średnia', 'medium-dark': 'Średnio-ciemna', 'dark': 'Ciemna', 'french': 'French', 'italian': 'Italian' };
    return `<div class="batch-card" data-id="${batch.id}">
      <div class="batch-roast-indicator roast-${batch.roastLevel}"></div>
      <div class="batch-header"><div><div class="batch-title">${profileName}</div><span class="roast-level-badge roast-${batch.roastLevel}">${roastLevelNames[batch.roastLevel] || 'Nieznany'}</span></div><span class="batch-date">${this.formatDate(batch.date)}</span></div>
      <div class="batch-details">
        <div class="batch-detail"><span class="batch-detail-label">Ilość</span><span class="batch-detail-value">${batch.weight}g</span></div>
        <div class="batch-detail"><span class="batch-detail-label">Czas</span><span class="batch-detail-value">${batch.duration ? batch.duration + ' min' : '-'}</span></div>
        <div class="batch-detail"><span class="batch-detail-label">Temp.</span><span class="batch-detail-value">${batch.finalTemp ? batch.finalTemp + '°C' : '-'}</span></div>
        <div class="batch-detail"><span class="batch-detail-label">Ocena</span><span class="batch-detail-value">${batch.rating}/10</span></div>
      </div>${batch.notes ? `<div class="card-body" style="margin-top: 10px; font-size: 13px;">${batch.notes}</div>` : ''}</div>`;
  }

  createBatchListItemHTML(batch) {
    const profileName = batch.profileName || this.profiles.find(p => p.id === batch.profileId)?.name || 'Brak profilu';
    const roastLevelNames = { 'green': 'Zielona', 'cinnamon': 'Cynamonowa', 'light': 'Jasna', 'medium': 'Średnia', 'medium-dark': 'Średnio-ciemna', 'dark': 'Ciemna', 'french': 'French', 'italian': 'Italian' };
    return `<div class="batch-card" data-id="${batch.id}">
      <div class="batch-roast-indicator roast-${batch.roastLevel}"></div>
      <div class="batch-header"><div><div class="batch-title">${profileName}</div><span class="roast-level-badge roast-${batch.roastLevel}">${roastLevelNames[batch.roastLevel] || 'Nieznany'}</span>
      <div class="batch-rating">${'⭐'.repeat(batch.rating || 0)}${'☆'.repeat(10 - (batch.rating || 0))}</div></div><span class="batch-date">${this.formatDate(batch.date)}</span></div>
      <div class="batch-details">
        <div class="batch-detail"><span class="batch-detail-label">Ilość</span><span class="batch-detail-value">${batch.weight}g</span></div>
        <div class="batch-detail"><span class="batch-detail-label">Czas</span><span class="batch-detail-value">${batch.duration ? batch.duration + ' min' : '-'}</span></div>
        <div class="batch-detail"><span class="batch-detail-label">Temp. końcowa</span><span class="batch-detail-value">${batch.finalTemp ? batch.finalTemp + '°C' : '-'}</span></div>
      </div>${batch.notes ? `<div class="card-body" style="margin-top: 10px; font-size: 13px;">${batch.notes}</div>` : ''}
      <div class="profile-actions" style="margin-top: 12px;">
        <button class="btn-edit-batch" data-id="${batch.id}">Edytuj</button>
        <button class="btn-delete" data-id="${batch.id}">Usuń</button>
      </div></div>`;
  }

  async deleteBatch(id) {
    if (confirm('Czy na pewno chcesz usunąć tę partię?')) {
      const success = await this.deleteBatchFromDB(id);
      if (success) {
        this.batches = await this.fetchBatches();
        this.renderBatches();
        await this.loadDashboard();
        this.showToast('Partia usunięta', 'warning');
      } else { this.showToast('Błąd usuwania partii', 'error'); }
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
    if (startBtn) startBtn.addEventListener('click', (e) => { this.startIosWakeLockDirectly(); this.startStopwatch(); });
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseStopwatch());
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetStopwatch());
    this.setupIosWakeLock();
    this.setupStickyStopwatch();
  }

  setupStickyStopwatch() {
    const stopwatch = this.stopwatchEl();
    const placeholder = this.placeholderEl();
    const modalContent = document.getElementById('profileModal')?.querySelector('.modal-content');
    if (!stopwatch || !modalContent) return;
    modalContent.addEventListener('scroll', () => {
      if (!this.stopwatchRunning) return;
      if (!this.stopwatchSticky) { if (stopwatch.getBoundingClientRect().bottom < 80) this.makeStopwatchSticky(); }
      else { if (modalContent.scrollTop < 50 || placeholder.getBoundingClientRect().top > 60) this.unmakeStopwatchSticky(); }
    });
  }

  makeStopwatchSticky() { if (this.stopwatchSticky) return; this.stopwatchSticky = true; this.stopwatchEl()?.classList.add('is-sticky'); this.placeholderEl()?.classList.add('active'); }

  unmakeStopwatchSticky() { if (!this.stopwatchSticky) return; this.stopwatchSticky = false; this.stopwatchEl()?.classList.remove('is-sticky'); this.placeholderEl()?.classList.remove('active'); }

  startStopwatch() { if (this.stopwatchRunning) return; this.stopwatchRunning = true; this.requestWakeLock(); this.stopwatchInterval = setInterval(() => { this.stopwatchTime++; this.updateStopwatchDisplay(); }, 1000); }

  pauseStopwatch() { this.stopwatchRunning = false; if (this.stopwatchInterval) { clearInterval(this.stopwatchInterval); this.stopwatchInterval = null; } this.releaseWakeLock(); this.stopIosWakeLock(); }

  resetStopwatch() { this.pauseStopwatch(); this.stopwatchTime = 0; this.firstCrackTime = null; this.updateStopwatchDisplay(); this.unmakeStopwatchSticky(); this.releaseWakeLock(); this.stopIosWakeLock(); document.getElementById('firstCrackResult').style.display = 'none'; document.querySelectorAll('.stage-fc').forEach(s => s.remove()); }

  stopwatchEl() { return document.getElementById('stopwatch'); }

  placeholderEl() { return document.getElementById('stopwatchPlaceholder'); }

  updateStopwatchDisplay() {
    const display = document.getElementById('stopwatchTime');
    if (display) {
      const h = Math.floor(this.stopwatchTime / 3600);
      const m = Math.floor((this.stopwatchTime % 3600) / 60);
      const s = this.stopwatchTime % 60;
      display.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }
    if (this.firstCrackTime !== null && this.firstCrackTime > 0) this.updateFirstCrackPercent();
  }

  recordFirstCrack() { this.firstCrackTime = this.stopwatchTime; document.getElementById('firstCrackResult').style.display = 'block'; this.updateFirstCrackPercent(); this.addFirstCrackStage(); }

  addFirstCrackStage() {
    const container = document.getElementById('roastStages');
    if (!container) return;
    const mins = Math.floor(this.stopwatchTime / 60);
    const secs = this.stopwatchTime % 60;
    const timeStr = mins.toString().padStart(2,'0') + ':' + secs.toString().padStart(2,'0');
    const fcStage = document.createElement('div');
    fcStage.className = 'stage-row stage-fc';
    fcStage.dataset.stage = 'fc';
    fcStage.innerHTML = `<button type="button" class="btn-remove-stage">×</button>
      <div class="stage-header"><span class="stage-num stage-num-fc">FC</span></div>
      <div class="stage-fields">
        <div class="stage-field"><label class="stage-label">Temp.</label><input type="number" class="stage-temp" placeholder="°C" min="0" max="300"></div>
        <div class="stage-field"><label class="stage-label">Czas</label><input type="text" class="stage-time" placeholder="mm:ss" value="${timeStr}"></div>
        <div class="stage-field stage-field-note"><label class="stage-label">Notatka</label><input type="text" class="stage-note" placeholder="np. first crack" value="First Crack"></div>
      </div>`;
    container.appendChild(fcStage);
    this.attachStageListeners();
    fcStage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  updateFirstCrackPercent() {
    const percentEl = document.getElementById('firstCrackPercent');
    if (percentEl && this.firstCrackTime !== null) {
      if (this.stopwatchTime > 0 && this.firstCrackTime > 0) {
        const timeAfterFC = this.stopwatchTime - this.firstCrackTime;
        percentEl.textContent = ((timeAfterFC / this.stopwatchTime) * 100).toFixed(1) + '%';
      } else percentEl.textContent = '0%';
    }
  }

  // ===== KALKULATORY =====
  setupCalculators() {
    document.getElementById('calcLossBtn').addEventListener('click', () => {
      const before = parseFloat(document.getElementById('weightBefore').value);
      const after = parseFloat(document.getElementById('weightAfter').value);
      if (before && after && before > 0) {
        const loss = ((before - after) / before * 100).toFixed(2);
        document.getElementById('lossResult').querySelector('.result-value').textContent = loss + '%';
        document.getElementById('lossResult').querySelector('.result-label').textContent = this.getRoastTypeByLoss(parseFloat(loss));
      } else this.showToast('Wprowadź poprawne wartości', 'error');
    });

    document.getElementById('calcRorBtn').addEventListener('click', () => {
      const start = parseFloat(document.getElementById('rorStart').value);
      const end = parseFloat(document.getElementById('rorEnd').value);
      const time = parseFloat(document.getElementById('rorTime').value);
      if (start != null && end != null && time > 0) document.getElementById('rorResult').querySelector('.result-value').textContent = ((end - start) / time).toFixed(1) + '°C';
      else this.showToast('Wprowadź poprawne wartości', 'error');
    });

    document.getElementById('calcTimeBtn').addEventListener('click', () => {
      const target = parseFloat(document.getElementById('targetTemp').value);
      const current = parseFloat(document.getElementById('currentTemp').value);
      const rate = parseFloat(document.getElementById('roastType').value);
      if (target && current && target > current) document.getElementById('timeResult').querySelector('.result-value').textContent = ((target - current) / rate).toFixed(1) + ' min';
      else this.showToast('Wprowadź poprawne wartości', 'error');
    });
  }

  getRoastTypeByLoss(loss) {
    if (loss < 11) return 'Zielona / Cynamonowa';
    if (loss < 13) return 'Jasna (Light)';
    if (loss < 15) return 'Średnia (Medium)';
    if (loss < 17) return 'Średnio-ciemna';
    if (loss < 19) return 'Ciemna (Dark)';
    if (loss < 21) return 'French';
    return 'Italian';
  }

  // ===== iOS VIEWPORT FIX =====
  setupiOSViewportFix() {
    const originalHeight = window.innerHeight;
    document.addEventListener('blur', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') setTimeout(() => { window.scrollTo(0, 0); document.body.style.minHeight = originalHeight + 'px'; }, 100); }, true);
    window.addEventListener('resize', () => { if (window.innerHeight >= originalHeight * 0.9) document.body.style.minHeight = ''; });
    document.querySelectorAll('.modal').forEach(modal => {
      const observer = new MutationObserver((mutations) => { mutations.forEach((m) => { if (m.attributeName === 'class' && !modal.classList.contains('active')) setTimeout(() => window.scrollTo(0, 0), 100); }); });
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
    navigator.serviceWorker.register('sw.js').then(r => console.log('SW zarejestrowany:', r.scope)).catch(e => console.log('Rejestracja SW nieudana:', e));
  });
}
