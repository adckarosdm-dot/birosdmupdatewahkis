(function () {
  'use strict';

  const config = window.ROSDM_CONFIG || {};
  const configured = Boolean(
    config.SUPABASE_URL &&
    !config.SUPABASE_URL.includes('ISI_') &&
    config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_ANON_KEY.includes('ISI_')
  );
  const db = configured ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const bucket = config.STORAGE_BUCKET || 'media';

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const loader = $('loader');

  const state = {
    session: null,
    adminProfile: null,
    settings: {},
    officers: [],
    sections: [],
    news: [],
    gallery: [],
    documents: [],
    announcements: [],
    reports: []
  };

  const reportOptions = {
    biroSdm: [
      'SUBBAG DIAPERS',
      'SUBBAG SELEK',
      'SUBBAG PNS',
      'SUBBAG PANGKAT',
      'SUBBAG MUTJAB',
      'SUBBAG KOMPETEN',
      'SUBBAG ROHJASHOR',
      'SUBBAG KHIRDINLUR',
      'SUBBAG PSIPOL',
      'SUBBAG PSIPERS',
      'SUBBAG RENMIN'
    ],
    polres: ['BAG DALPERS', 'BAG BINKAR', 'BAG WATPERS']
  };

  const listMeta = {
    officers: { order: 'sort_order', ascending: true, render: renderOfficers },
    sections: { order: 'sort_order', ascending: true, render: renderSections },
    news: { order: 'created_at', ascending: false, render: renderNews },
    gallery: { order: 'created_at', ascending: false, render: renderGallery },
    documents: { order: 'created_at', ascending: false, render: renderDocuments },
    announcements: { order: 'created_at', ascending: false, render: renderAnnouncements },
    reports: { order: 'created_at', ascending: false, render: renderReports }
  };

  const typeMap = {
    officer: { table: 'officers', tab: 'officers' },
    section: { table: 'sections', tab: 'sections' },
    news: { table: 'news', tab: 'news' },
    gallery: { table: 'gallery', tab: 'gallery' },
    document: { table: 'documents', tab: 'documents' },
    announcement: { table: 'announcements', tab: 'announcements' },
    report: { table: 'reports', tab: 'reports' }
  };

  const roleRules = {
    reports_editor: {
      allowedTabs: ['dashboard', 'reports'],
      writableTypes: ['report'],
      loadTables: ['reports']
    },
    default: {
      allowedTabs: ['dashboard', 'settings', 'officers', 'sections', 'news', 'gallery', 'documents', 'announcements', 'reports'],
      writableTypes: Object.keys(typeMap),
      loadTables: Object.keys(listMeta)
    }
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char]));
  }

  function value(id) {
    return ($(id)?.value || '').trim();
  }

  function checked(id) {
    return Boolean($(id)?.checked);
  }

  function setValue(id, val) {
    const el = $(id);
    if (el) el.value = val ?? '';
  }

  function setChecked(id, val) {
    const el = $(id);
    if (el) el.checked = Boolean(val);
  }

  function numberValue(id, fallback = 0) {
    const raw = value(id);
    return raw === '' ? fallback : Number(raw);
  }

  function showLoader(show) {
    loader?.classList.toggle('show', Boolean(show));
  }

  function showLogin() {
    $('loginView')?.classList.remove('hidden');
    $('appView')?.classList.add('hidden');
  }

  function showApp() {
    $('loginView')?.classList.add('hidden');
    $('appView')?.classList.remove('hidden');
    const emailText = $('adminEmailText');
    if (emailText) emailText.textContent = state.session?.user?.email || '';
  }

  function roleConfig() {
    return roleRules[state.adminProfile?.role] || roleRules.default;
  }

  function canWrite(type) {
    return roleConfig().writableTypes.includes(type);
  }

  function slugFileName(name) {
    return String(name || 'file')
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async function uploadIfSelected(inputId, folder, fallbackUrl = '') {
    const input = $(inputId);
    const file = input?.files?.[0];
    if (!file) return fallbackUrl || null;

    const fileId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const path = `${folder}/${Date.now()}-${fileId}-${slugFileName(file.name)}`;
    const { error } = await db.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });
    if (error) throw error;

    const { data } = db.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function requireAdmin() {
    if (!configured) {
      $('configWarning')?.classList.remove('hidden');
      showLogin();
      return false;
    }

    showLoader(true);
    try {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      state.session = data.session;

      if (!state.session) {
        showLogin();
        return false;
      }

      await loadAdminProfile();
      showApp();
      applyRoleAccess();
      await loadAll();
      return true;
    } catch (err) {
      await db?.auth?.signOut();
      state.session = null;
      state.adminProfile = null;
      showLogin();
      alert(err.message || err);
      return false;
    } finally {
      showLoader(false);
    }
  }

  async function loadAdminProfile() {
    const userId = state.session?.user?.id;
    if (!userId) throw new Error('Session login tidak valid.');

    const { data, error } = await db
      .from('admin_users')
      .select('user_id, name, role, is_active')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Akun admin tidak ditemukan. Pastikan email sudah ditambahkan ke tabel admin_users.');
    if (!data.is_active) throw new Error('Akun admin nonaktif.');

    state.adminProfile = data;
  }

  function applyRoleAccess() {
    const rules = roleConfig();

    $$('.admin-tab').forEach((btn) => {
      const tab = btn.dataset.tab;
      const allowed = rules.allowedTabs.includes(tab);
      btn.classList.toggle('hidden', !allowed);
      btn.disabled = !allowed;
    });

    if (!rules.allowedTabs.includes('settings')) {
      disableForms(['settingsForm', 'officerForm', 'sectionForm', 'newsForm', 'galleryForm', 'documentForm', 'announcementForm']);
    }

    if (state.adminProfile?.role === 'reports_editor') {
      activateTab('reports');
    }
  }

  function disableForms(formIds) {
    formIds.forEach((formId) => {
      const form = $(formId);
      if (!form) return;
      $$('input, textarea, select, button', form).forEach((el) => {
        el.disabled = true;
      });
    });
  }

  function activateTab(tab) {
    const rules = roleConfig();
    const targetTab = rules.allowedTabs.includes(tab) ? tab : rules.allowedTabs[0];

    $$('.admin-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === targetTab);
    });
    $$('.tab-panel').forEach((panel) => panel.classList.add('hidden'));
    $(`tab-${targetTab}`)?.classList.remove('hidden');

    const title = document.querySelector(`.admin-tab[data-tab="${targetTab}"]`)?.textContent?.trim() || 'Dashboard';
    const pageTitle = $('pageTitle');
    if (pageTitle) pageTitle.textContent = title;
  }

  async function loadAll() {
    showLoader(true);
    try {
      await loadSettings();
      await Promise.all(roleConfig().loadTables.map((table) => loadTable(table)));
      renderAll();
    } finally {
      showLoader(false);
    }
  }

  async function loadSettings() {
    const { data, error } = await db.from('site_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    state.settings = data || {};
  }

  async function loadTable(table) {
    const meta = listMeta[table];
    let q = db.from(table).select('*');
    if (meta?.order) q = q.order(meta.order, { ascending: meta.ascending ?? true });
    const { data, error } = await q;
    if (error) throw error;
    state[table] = data || [];
  }

  async function reloadAndRender(table) {
    await loadTable(table);
    renderCounts();
    listMeta[table]?.render?.();
  }

  function renderAll() {
    fillSettingsForm();
    renderCounts();
    renderOfficers();
    renderSections();
    renderNews();
    renderGallery();
    renderDocuments();
    renderAnnouncements();
    renderReports();
  }

  function renderCounts() {
    setText('countReports', state.reports.length);
    setText('countNews', state.news.length);
    setText('countOfficers', state.officers.length);
    setText('countDocuments', state.documents.length);
    setText('countAnnouncements', state.announcements.length);
  }

  function setText(id, val) {
    const el = $(id);
    if (el) el.textContent = val ?? '';
  }

  function fillSettingsForm() {
    const s = state.settings || {};
    [
      'site_name', 'tagline', 'hero_title', 'hero_subtitle', 'hero_image_url',
      'about_title', 'about_body', 'vision', 'mission', 'email', 'phone', 'address',
      'instagram_url', 'facebook_url', 'youtube_url', 'tiktok_url', 'x_url'
    ].forEach((key) => setValue(`set_${key}`, s[key] || ''));
  }

  function emptyList(text) {
    return `<div class="table-card text-center text-gray-400 font-black uppercase tracking-widest text-xs">${esc(text)}</div>`;
  }

  function statusBadge(status) {
    const color = status === 'published'
      ? 'bg-green-50 text-green-700'
      : status === 'draft'
        ? 'bg-yellow-50 text-yellow-700'
        : 'bg-gray-100 text-gray-600';
    return `<span class="badge ${color}">${esc(status || 'status')}</span>`;
  }

  function actions(type, id) {
    return `
      <div class="flex gap-2">
        <button class="action-btn bg-blue-50 text-blue-700" data-edit="${esc(type)}" data-id="${esc(id)}">Edit</button>
        <button class="action-btn bg-red-50 text-red-700" data-delete="${esc(type)}" data-id="${esc(id)}">Hapus</button>
      </div>
    `;
  }

  function renderOfficers() {
    const list = $('officersList');
    if (!list) return;
    list.innerHTML = state.officers.map((p) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div class="flex items-center gap-4">
          <img src="${esc(p.photo_url || '')}" class="w-16 h-16 rounded-2xl object-cover bg-gray-100" alt="${esc(p.name || '')}" />
          <div>
            <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${esc(p.position || '-')}</p>
            <h3 class="font-black">${esc([p.rank, p.name].filter(Boolean).join(' ') || '-')}</h3>
            <p class="text-xs text-gray-400 font-bold">Urutan: ${esc(p.sort_order || 0)} | ${p.is_active ? 'Aktif' : 'Nonaktif'}</p>
          </div>
        </div>
        ${actions('officer', p.id)}
      </article>
    `).join('') || emptyList('Belum ada pejabat.');
  }

  function renderSections() {
    const list = $('sectionsList');
    if (!list) return;
    list.innerHTML = state.sections.map((s) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div>
          <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">Urutan ${esc(s.sort_order || 0)}</p>
          <h3 class="font-black">${esc(s.name || '-')}</h3>
          <p class="text-xs text-gray-500 font-semibold line-clamp-2">${esc(s.description || '')}</p>
          <p class="text-xs text-gray-400 font-semibold line-clamp-2 mt-1">${esc(s.duties || '')}</p>
        </div>
        ${actions('section', s.id)}
      </article>
    `).join('') || emptyList('Belum ada bagian.');
  }

  function renderNews() {
    const list = $('newsList');
    if (!list) return;
    list.innerHTML = state.news.map((n) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div class="flex items-center gap-4">
          <img src="${esc(n.image_url || '')}" class="w-20 h-16 rounded-2xl object-cover bg-gray-100" alt="${esc(n.title || '')}" />
          <div>
            <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${esc(n.category || 'Berita')}</p>
            <h3 class="font-black">${esc(n.title || '-')}</h3>
            <div class="mt-2">${statusBadge(n.status)}</div>
          </div>
        </div>
        ${actions('news', n.id)}
      </article>
    `).join('') || emptyList('Belum ada berita.');
  }

  function renderGallery() {
    const list = $('galleryList');
    if (!list) return;
    list.innerHTML = state.gallery.map((g) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div class="flex items-center gap-4">
          <img src="${g.media_type === 'image' ? esc(g.media_url || '') : ''}" class="w-20 h-16 rounded-2xl object-cover bg-gray-100" alt="${esc(g.title || '')}" />
          <div>
            <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${esc(g.album || g.media_type || 'Galeri')}</p>
            <h3 class="font-black">${esc(g.title || '-')}</h3>
            <p class="text-xs text-gray-400 font-bold">${g.is_active ? 'Aktif' : 'Nonaktif'}</p>
          </div>
        </div>
        ${actions('gallery', g.id)}
      </article>
    `).join('') || emptyList('Galeri kosong.');
  }

  function renderDocuments() {
    const list = $('documentsListAdmin');
    if (!list) return;
    list.innerHTML = state.documents.map((d) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div>
          <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${esc(d.category || 'Dokumen')} ${d.year ? esc(d.year) : ''}</p>
          <h3 class="font-black">${esc(d.title || '-')}</h3>
          <p class="text-xs text-gray-400 font-bold">${d.is_public ? 'Publik' : 'Nonpublik'}</p>
        </div>
        <div class="flex gap-2">
          <a href="${esc(d.file_url || '#')}" target="_blank" rel="noopener" class="action-btn bg-gray-50 text-gray-700">Buka</a>
          ${actions('document', d.id)}
        </div>
      </article>
    `).join('') || emptyList('Belum ada dokumen.');
  }

  function renderAnnouncements() {
    const list = $('announcementsListAdmin');
    if (!list) return;
    list.innerHTML = state.announcements.map((a) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div>
          <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${a.is_pinned ? 'Prioritas' : 'Pengumuman'}</p>
          <h3 class="font-black">${esc(a.title || '-')}</h3>
          <div class="mt-2">${statusBadge(a.status)}</div>
        </div>
        ${actions('announcement', a.id)}
      </article>
    `).join('') || emptyList('Belum ada pengumuman.');
  }

  function getFilteredReports() {
    const polres = value('filter_polres');
    const bag = value('filter_bag_subbag');
    const startDate = value('filter_start_date');
    const endDate = value('filter_end_date');

    return state.reports.filter((r) => {
      const reportDate = String(r.activity_date || '').slice(0, 10);
      return (!polres || r.polres_name === polres) &&
        (!bag || r.bag_subbag === bag) &&
        (!startDate || reportDate >= startDate) &&
        (!endDate || reportDate <= endDate);
    });
  }

  function renderReports() {
    const list = $('reportsList');
    if (!list) return;

    const rows = getFilteredReports();
    list.innerHTML = rows.map((r) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div class="flex gap-4 items-center">
          <img src="${esc(r.image_url || '')}" class="w-20 h-16 rounded-2xl object-cover bg-gray-100" alt="${esc(r.title || '')}" />
          <div>
            <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${esc(r.polres_name || '-')} • ${esc(r.bag_subbag || '-')}</p>
            <h3 class="font-black">${esc(r.title || '-')}</h3>
            <p class="text-xs text-gray-400 font-bold">${esc(r.activity_date || '-')}</p>
            <p class="text-xs text-gray-500 font-semibold line-clamp-2">${esc(r.description || '')}</p>
          </div>
        </div>
        ${actions('report', r.id)}
      </article>
    `).join('') || emptyList('Belum ada laporan.');
  }

  async function saveSettings(e) {
    e.preventDefault();
    if (!canWrite('officer')) return alert('Akun ini tidak boleh mengubah pengaturan website.');
    await runTask(async () => {
      const payload = {
        id: 1,
        site_name: value('set_site_name'),
        tagline: value('set_tagline'),
        hero_title: value('set_hero_title'),
        hero_subtitle: value('set_hero_subtitle'),
        hero_image_url: await uploadIfSelected('set_hero_file', 'settings', value('set_hero_image_url')),
        about_title: value('set_about_title'),
        about_body: value('set_about_body'),
        vision: value('set_vision'),
        mission: value('set_mission'),
        email: value('set_email'),
        phone: value('set_phone'),
        address: value('set_address'),
        instagram_url: value('set_instagram_url'),
        facebook_url: value('set_facebook_url'),
        youtube_url: value('set_youtube_url'),
        tiktok_url: value('set_tiktok_url'),
        x_url: value('set_x_url'),
        updated_at: new Date().toISOString()
      };
      const { error } = await db.from('site_settings').upsert(payload);
      if (error) throw error;
      await loadSettings();
      fillSettingsForm();
      alert('Pengaturan website berhasil disimpan.');
    });
  }

  async function saveEntity(type, payloadBuilder, successMessage, formId) {
    if (!canWrite(type)) return alert('Akun ini hanya boleh mengelola menu Pelaporan.');
    await runTask(async () => {
      const payload = await payloadBuilder();
      if (!payload.id) delete payload.id;
      await upsert(typeMap[type].table, payload);
      resetForm(formId);
      if (type === 'report') updateReportBagOptions();
      await reloadAndRender(typeMap[type].table);
      alert(successMessage);
    });
  }

  async function upsert(table, payload) {
    const { error } = await db.from(table).upsert(payload);
    if (error) throw error;
  }

  async function runTask(callback) {
    showLoader(true);
    try {
      await callback();
    } catch (err) {
      alert(err.message || err);
    } finally {
      showLoader(false);
    }
  }

  async function saveOfficer(e) {
    e.preventDefault();
    await saveEntity('officer', async () => ({
      id: value('officer_id') || undefined,
      rank: value('officer_rank'),
      name: value('officer_name'),
      position: value('officer_position'),
      photo_url: await uploadIfSelected('officer_file', 'officers', value('officer_photo_url')),
      description: value('officer_description'),
      sort_order: numberValue('officer_sort_order', 1),
      is_active: checked('officer_is_active'),
      updated_at: new Date().toISOString()
    }), 'Data pejabat berhasil disimpan.', 'officerForm');
  }

  async function saveSection(e) {
    e.preventDefault();
    await saveEntity('section', async () => ({
      id: value('section_id') || undefined,
      name: value('section_name'),
      description: value('section_description'),
      duties: value('section_duties'),
      sort_order: numberValue('section_sort_order', 1),
      is_active: checked('section_is_active'),
      updated_at: new Date().toISOString()
    }), 'Data bagian berhasil disimpan.', 'sectionForm');
  }

  async function saveNews(e) {
    e.preventDefault();
    await saveEntity('news', async () => {
      const id = value('news_id');
      const status = value('news_status') || 'draft';
      const old = state.news.find((x) => x.id === id) || {};
      return {
        id: id || undefined,
        title: value('news_title'),
        category: value('news_category') || 'Berita',
        body: value('news_body'),
        image_url: await uploadIfSelected('news_file', 'news', value('news_image_url')),
        status,
        published_at: status === 'published' ? (old.published_at || new Date().toISOString()) : null,
        updated_at: new Date().toISOString()
      };
    }, 'Berita berhasil disimpan.', 'newsForm');
  }

  async function saveGallery(e) {
    e.preventDefault();
    await saveEntity('gallery', async () => ({
      id: value('gallery_id') || undefined,
      title: value('gallery_title'),
      album: value('gallery_album'),
      media_type: value('gallery_media_type') || 'image',
      media_url: await uploadIfSelected('gallery_file', 'gallery', value('gallery_media_url')),
      description: value('gallery_description'),
      sort_order: numberValue('gallery_sort_order', 1),
      is_active: checked('gallery_is_active'),
      updated_at: new Date().toISOString()
    }), 'Galeri berhasil disimpan.', 'galleryForm');
  }

  async function saveDocument(e) {
    e.preventDefault();
    await saveEntity('document', async () => {
      const payload = {
        id: value('document_id') || undefined,
        title: value('document_title'),
        category: value('document_category'),
        file_url: await uploadIfSelected('document_file', 'documents', value('document_file_url')),
        year: numberValue('document_year', null),
        description: value('document_description'),
        is_public: checked('document_is_public'),
        updated_at: new Date().toISOString()
      };
      if (!payload.year) payload.year = null;
      return payload;
    }, 'Dokumen berhasil disimpan.', 'documentForm');
  }

  async function saveAnnouncement(e) {
    e.preventDefault();
    await saveEntity('announcement', async () => ({
      id: value('announcement_id') || undefined,
      title: value('announcement_title'),
      body: value('announcement_body'),
      attachment_url: await uploadIfSelected('announcement_file', 'announcements', value('announcement_attachment_url')),
      start_date: value('announcement_start_date') || null,
      end_date: value('announcement_end_date') || null,
      is_pinned: checked('announcement_is_pinned'),
      status: value('announcement_status') || 'draft',
      updated_at: new Date().toISOString()
    }), 'Pengumuman berhasil disimpan.', 'announcementForm');
  }

  async function saveReport(e) {
    e.preventDefault();
    await saveEntity('report', async () => {
      const id = value('report_id');
      const old = state.reports.find((x) => x.id === id) || {};
      return {
        id: id || undefined,
        polres_name: value('report_polres_name'),
        bag_subbag: value('report_bag_subbag'),
        title: value('report_title'),
        activity_date: value('report_activity_date') || null,
        description: value('report_description'),
        image_url: await uploadIfSelected('report_file', 'reports', old.image_url || ''),
        updated_at: new Date().toISOString()
      };
    }, 'Laporan berhasil disimpan.', 'reportForm');
  }

  function resetForm(formId) {
    const form = $(formId);
    form?.reset();
    $$('input[type="hidden"]', form).forEach((el) => { el.value = ''; });
    $$('input[type="checkbox"]', form).forEach((el) => {
      el.checked = el.id.includes('is_active') || el.id.includes('is_public');
    });
  }

  function editItem(type, id) {
    if (!canWrite(type)) return alert('Akun ini hanya boleh mengedit menu Pelaporan.');
    const meta = typeMap[type];
    const item = state[meta.table].find((row) => row.id === id);
    if (!item) return alert('Data tidak ditemukan.');

    activateTab(meta.tab);

    const editors = {
      officer: () => {
        setValue('officer_id', item.id);
        setValue('officer_rank', item.rank);
        setValue('officer_name', item.name);
        setValue('officer_position', item.position);
        setValue('officer_photo_url', item.photo_url);
        setValue('officer_description', item.description);
        setValue('officer_sort_order', item.sort_order || 1);
        setChecked('officer_is_active', item.is_active);
      },
      section: () => {
        setValue('section_id', item.id);
        setValue('section_name', item.name);
        setValue('section_description', item.description);
        setValue('section_duties', item.duties);
        setValue('section_sort_order', item.sort_order || 1);
        setChecked('section_is_active', item.is_active);
      },
      news: () => {
        setValue('news_id', item.id);
        setValue('news_title', item.title);
        setValue('news_category', item.category);
        setValue('news_image_url', item.image_url);
        setValue('news_status', item.status || 'draft');
        setValue('news_body', item.body);
      },
      gallery: () => {
        setValue('gallery_id', item.id);
        setValue('gallery_title', item.title);
        setValue('gallery_album', item.album);
        setValue('gallery_media_type', item.media_type || 'image');
        setValue('gallery_media_url', item.media_url);
        setValue('gallery_description', item.description);
        setValue('gallery_sort_order', item.sort_order || 1);
        setChecked('gallery_is_active', item.is_active);
      },
      document: () => {
        setValue('document_id', item.id);
        setValue('document_title', item.title);
        setValue('document_category', item.category);
        setValue('document_year', item.year);
        setValue('document_file_url', item.file_url);
        setValue('document_description', item.description);
        setChecked('document_is_public', item.is_public);
      },
      announcement: () => {
        setValue('announcement_id', item.id);
        setValue('announcement_title', item.title);
        setValue('announcement_body', item.body);
        setValue('announcement_attachment_url', item.attachment_url);
        setValue('announcement_start_date', item.start_date);
        setValue('announcement_end_date', item.end_date);
        setValue('announcement_status', item.status || 'draft');
        setChecked('announcement_is_pinned', item.is_pinned);
      },
      report: () => {
        setValue('report_id', item.id);
        setValue('report_polres_name', item.polres_name);
        updateReportBagOptions(item.bag_subbag);
        setValue('report_title', item.title);
        setValue('report_activity_date', item.activity_date);
        setValue('report_description', item.description);
      }
    };

    editors[type]?.();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteItem(type, id) {
    if (!canWrite(type)) return alert('Akun ini hanya boleh menghapus data pada menu Pelaporan.');
    const meta = typeMap[type];
    if (!meta || !confirm('Hapus data ini?')) return;

    await runTask(async () => {
      const { error } = await db.from(meta.table).delete().eq('id', id);
      if (error) throw error;
      await reloadAndRender(meta.table);
      alert('Data berhasil dihapus.');
    });
  }

  function updateReportBagOptions(selectedValue = '') {
    const select = $('report_bag_subbag');
    if (!select) return;

    const options = value('report_polres_name') === 'BIRO SDM'
      ? reportOptions.biroSdm
      : reportOptions.polres;

    select.innerHTML = '<option value="">Pilih Bag/Subbag</option>';
    options.forEach((item) => {
      const option = document.createElement('option');
      option.value = item;
      option.textContent = item;
      if (item === selectedValue) option.selected = true;
      select.appendChild(option);
    });
  }

  function resetReportFilter() {
    ['filter_polres', 'filter_bag_subbag', 'filter_start_date', 'filter_end_date'].forEach((id) => setValue(id, ''));
    renderReports();
  }

  function downloadReportsExcel() {
    if (!window.XLSX) return alert('Library Excel belum terbaca.');

    const rows = getFilteredReports().map((item, index) => ({
      No: index + 1,
      Satker_Polres: item.polres_name,
      Bag_Subbag: item.bag_subbag,
      Judul_Laporan: item.title,
      Tanggal_Kegiatan: item.activity_date,
      Deskripsi: item.description,
      Link_Foto: item.image_url,
      Dibuat: item.created_at
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan');
    XLSX.writeFile(workbook, 'laporan-pelaporan-satker.xlsx');
  }

  function bindEvents() {
    $('loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!configured) return alert('Supabase belum dikonfigurasi.');

      await runTask(async () => {
        const { data, error } = await db.auth.signInWithPassword({
          email: value('loginEmail'),
          password: value('loginPassword')
        });
        if (error) throw error;
        state.session = data.session;
        await loadAdminProfile();
        showApp();
        applyRoleAccess();
        await loadAll();
      });
    });

    $('logoutBtn')?.addEventListener('click', async () => {
      await db?.auth?.signOut();
      state.session = null;
      state.adminProfile = null;
      showLogin();
    });

    $('refreshAdminBtn')?.addEventListener('click', loadAll);
    $('settingsForm')?.addEventListener('submit', saveSettings);
    $('officerForm')?.addEventListener('submit', saveOfficer);
    $('sectionForm')?.addEventListener('submit', saveSection);
    $('newsForm')?.addEventListener('submit', saveNews);
    $('galleryForm')?.addEventListener('submit', saveGallery);
    $('documentForm')?.addEventListener('submit', saveDocument);
    $('announcementForm')?.addEventListener('submit', saveAnnouncement);
    $('reportForm')?.addEventListener('submit', saveReport);

    $('report_polres_name')?.addEventListener('change', () => updateReportBagOptions());
    $('downloadReportExcel')?.addEventListener('click', downloadReportsExcel);
    $('resetReportFilter')?.addEventListener('click', resetReportFilter);
    ['filter_polres', 'filter_bag_subbag', 'filter_start_date', 'filter_end_date'].forEach((id) => {
      $(id)?.addEventListener('change', renderReports);
    });

    $$('.admin-tab').forEach((btn) => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });

    $$('[data-reset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        resetForm(btn.dataset.reset);
        if (btn.dataset.reset === 'reportForm') updateReportBagOptions();
      });
    });

    document.addEventListener('click', (e) => {
      const edit = e.target.closest('[data-edit]');
      if (edit) editItem(edit.dataset.edit, edit.dataset.id);

      const del = e.target.closest('[data-delete]');
      if (del) deleteItem(del.dataset.delete, del.dataset.id);
    });
  }

  bindEvents();
  updateReportBagOptions();
  requireAdmin();
})();
