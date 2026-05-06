(function () {
  const config = window.ROSDM_CONFIG || {};
  const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes('ISI_') && config.SUPABASE_ANON_KEY && !config.SUPABASE_ANON_KEY.includes('ISI_');
  const db = configured ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const bucket = config.STORAGE_BUCKET || 'media';

  const $ = (id) => document.getElementById(id);
  const loader = $('loader');
  const state = {
    session: null,
    adminProfile: null,
    settings: null,
    officers: [],
    sections: [],
    news: [],
    gallery: [],
    documents: [],
    announcements: [],
    reports: []
  };

  const typeMap = {
    officer: { table: 'officers', state: 'officers', form: 'officerForm', prefix: 'officer' },
    section: { table: 'sections', state: 'sections', form: 'sectionForm', prefix: 'section' },
    news: { table: 'news', state: 'news', form: 'newsForm', prefix: 'news' },
    gallery: { table: 'gallery', state: 'gallery', form: 'galleryForm', prefix: 'gallery' },
    document: { table: 'documents', state: 'documents', form: 'documentForm', prefix: 'document' },
    announcement: { table: 'announcements', state: 'announcements', form: 'announcementForm', prefix: 'announcement' },
    report: { table: 'reports', state: 'reports', form: 'reportForm', prefix: 'report' }
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function showLoader(show) {
    loader?.classList.toggle('show', !!show);
  }

  function value(id) {
    return ($(id)?.value || '').trim();
  }

  function checked(id) {
    return !!$(id)?.checked;
  }

  function setValue(id, val) {
    const el = $(id);
    if (el) el.value = val ?? '';
  }

  function setChecked(id, val) {
    const el = $(id);
    if (el) el.checked = !!val;
  }

  function numberValue(id, fallback = 0) {
    const raw = value(id);
    return raw === '' ? fallback : Number(raw);
  }

  function slugFileName(name) {
    return String(name || 'file').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/-+/g, '-');
  }

  async function uploadIfSelected(inputId, folder, fallbackUrl = '') {
    const input = $(inputId);
    const file = input?.files?.[0];
    if (!file) return fallbackUrl || null;

    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${slugFileName(file.name)}`;
    const { error } = await db.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;

    const { data } = db.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function requireAdmin() {
    if (!configured) {
      $('configWarning')?.classList.remove('hidden');
      return false;
    }

    const { data } = await db.auth.getSession();
    state.session = data.session;
    if (state.session) {
      await loadAdminProfile();
      showApp();
      applyRoleAccess();
      await loadAll();
    } else {
      showLogin();
    }
    return true;
  }

  async function loadAdminProfile() {
    const userId = state.session?.user?.id;
    if (!userId) return;

    const { data, error } = await db.from('admin_users')
      .select('user_id, name, role, is_active')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      if (!data.is_active) throw new Error('Akun admin nonaktif.');
      state.adminProfile = data;
      return;
    }

    const email = String(state.session?.user?.email || '').toLowerCase();
    state.adminProfile = {
      user_id: userId,
      name: state.session?.user?.email || 'Admin',
      role: email === 'editportal@gmail.com' ? 'reports_editor' : 'super_admin',
      is_active: true
    };
  }

  function showLogin() {
    $('loginView').classList.remove('hidden');
    $('appView').classList.add('hidden');
  }

  function showApp() {
    $('loginView').classList.add('hidden');
    $('appView').classList.remove('hidden');
    $('adminEmailText').textContent = state.session?.user?.email || '';
  }

  function isReportsOnlyUser() {
    return state.adminProfile?.role === 'reports_editor';
  }

  function applyRoleAccess() {
    if (!isReportsOnlyUser()) return;

    document.querySelectorAll('.admin-tab').forEach((btn) => {
      const tab = btn.dataset.tab;
      const allowed = tab === 'dashboard' || tab === 'reports';
      btn.classList.toggle('hidden', !allowed);
    });

    ['settingsForm','officerForm','sectionForm','newsForm','galleryForm','documentForm','announcementForm']
      .forEach((formId) => {
        const form = $(formId);
        if (!form) return;
        form.querySelectorAll('input, textarea, select, button').forEach((el) => {
          el.disabled = true;
        });
      });

    activateTab('reports');
  }

  function activateTab(tab) {
    document.querySelectorAll('.admin-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.add('hidden'));
    $(`tab-${tab}`)?.classList.remove('hidden');
    const title = document.querySelector(`.admin-tab[data-tab="${tab}"]`)?.textContent?.trim() || 'Dashboard';
    $('pageTitle').textContent = title;
  }

  async function loadAll() {
    showLoader(true);
    try {
      await Promise.all([
        loadSettings(),
        loadTable('officers', { order: 'sort_order', ascending: true }),
        loadTable('sections', { order: 'sort_order', ascending: true }),
        loadTable('news', { order: 'created_at', ascending: false }),
        loadTable('gallery', { order: 'created_at', ascending: false }),
        loadTable('documents', { order: 'created_at', ascending: false }),
        loadTable('announcements', { order: 'created_at', ascending: false }),
        loadTable('reports', { order: 'created_at', ascending: false })
      ]);
      renderAll();
    } finally {
      showLoader(false);
    }
  }

  async function loadSettings() {
    const { data, error } = await db.from('site_settings').select('*').eq('id', 1).single();
    if (error) throw error;
    state.settings = data || {};
  }

  async function loadTable(table, options = {}) {
    let q = db.from(table).select('*');
    if (options.order) q = q.order(options.order, { ascending: options.ascending ?? true });
    const { data, error } = await q;
    if (error) throw error;
    state[table] = data || [];
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
    if ($('countReports')) $('countReports').textContent = state.reports.length;
    if ($('countNews')) $('countNews').textContent = state.news.length;
    if ($('countOfficers')) $('countOfficers').textContent = state.officers.length;
    if ($('countDocuments')) $('countDocuments').textContent = state.documents.length;
    if ($('countAnnouncements')) $('countAnnouncements').textContent = state.announcements.length;
  }

  function fillSettingsForm() {
    const s = state.settings || {};
    ['site_name','tagline','hero_title','hero_subtitle','hero_image_url','about_title','about_body','vision','mission','email','phone','address','instagram_url','facebook_url','youtube_url','tiktok_url','x_url']
      .forEach((key) => setValue(`set_${key}`, s[key] || ''));
  }

  function statusBadge(status) {
    const color = status === 'published' ? 'bg-green-50 text-green-700' : status === 'draft' ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-100 text-gray-600';
    return `<span class="badge ${color}">${esc(status || 'status')}</span>`;
  }



  const reportBiroSdmOptions = [
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
  ];

  const reportPolresOptions = [
    'BAG DALPERS',
    'BAG BINKAR',
    'BAG WATPERS'
  ];

  function updateReportBagOptions(selectedValue = '') {
    const select = $('report_bag_subbag');
    if (!select) return;

    const satker = value('report_polres_name');
    const options = satker === 'BIRO SDM' ? reportBiroSdmOptions : reportPolresOptions;

    select.innerHTML = '<option value="">Pilih Bag/Subbag</option>';
    options.forEach((item) => {
      const option = document.createElement('option');
      option.value = item;
      option.textContent = item;
      if (item === selectedValue) option.selected = true;
      select.appendChild(option);
    });
  }

  function getFilteredReports() {
    const polres = value('filter_polres');
    const bag = value('filter_bag_subbag');
    const startDate = value('filter_start_date');
    const endDate = value('filter_end_date');

    return state.reports.filter((r) => {
      const reportDate = r.activity_date || '';
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
          <img src="${esc(r.image_url || '')}" class="w-20 h-16 rounded-2xl object-cover bg-gray-100" />
          <div>
            <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">
              ${esc(r.polres_name || '-')} • ${esc(r.bag_subbag || '-')}
            </p>
            <h3 class="font-black">${esc(r.title || '-')}</h3>
            <p class="text-xs text-gray-400 font-bold">${esc(r.activity_date || '-')}</p>
            <p class="text-xs text-gray-500 font-semibold line-clamp-2">${esc(r.description || '')}</p>
          </div>
        </div>

        <div class="flex gap-2">
          <button class="action-btn bg-blue-50 text-blue-700" data-edit="report" data-id="${esc(r.id)}">Edit</button>
          <button class="action-btn bg-red-50 text-red-700" data-delete="report" data-id="${esc(r.id)}">Hapus</button>
        </div>
      </article>
    `).join('') || emptyList('Belum ada laporan.');
  }

  function renderOfficers() {
    const list = $('officersList');
    list.innerHTML = state.officers.map((p) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div class="flex items-center gap-4">
          <img src="${esc(p.photo_url || '')}" class="w-16 h-16 rounded-2xl object-cover bg-gray-100" />
          <div>
            <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${esc(p.position)}</p>
            <h3 class="font-black">${esc([p.rank, p.name].filter(Boolean).join(' '))}</h3>
            <p class="text-xs text-gray-400 font-bold">Urutan: ${esc(p.sort_order)} | ${p.is_active ? 'Aktif' : 'Nonaktif'}</p>
          </div>
        </div>
        <div class="flex gap-2"><button class="action-btn bg-blue-50 text-blue-700" data-edit="officer" data-id="${esc(p.id)}">Edit</button><button class="action-btn bg-red-50 text-red-700" data-delete="officer" data-id="${esc(p.id)}">Hapus</button></div>
      </article>
    `).join('') || emptyList('Belum ada pejabat.');
  }

  function renderSections() {
    const list = $('sectionsList');
    list.innerHTML = state.sections.map((s) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div>
          <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">Urutan ${esc(s.sort_order)}</p>
          <h3 class="font-black">${esc(s.name)}</h3>
          <p class="text-xs text-gray-500 font-semibold line-clamp-2">${esc(s.description || '')}</p>
          <p class="text-xs text-gray-400 font-semibold line-clamp-2 mt-1">${esc(s.duties || '')}</p>
        </div>
        <div class="flex gap-2">
          <button class="action-btn bg-blue-50 text-blue-700" data-edit="section" data-id="${esc(s.id)}">Edit Bag/Subbag</button>
          <button class="action-btn bg-red-50 text-red-700" data-delete="section" data-id="${esc(s.id)}">Hapus</button>
        </div>
      </article>
    `).join('') || emptyList('Belum ada bagian.');
  }

  function renderNews() {
    const list = $('newsList');
    list.innerHTML = state.news.map((n) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div class="flex items-center gap-4">
          <img src="${esc(n.image_url || '')}" class="w-20 h-16 rounded-2xl object-cover bg-gray-100" />
          <div><p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${esc(n.category || 'Berita')}</p><h3 class="font-black">${esc(n.title)}</h3><div class="mt-2">${statusBadge(n.status)}</div></div>
        </div>
        <div class="flex gap-2"><button class="action-btn bg-blue-50 text-blue-700" data-edit="news" data-id="${esc(n.id)}">Edit</button><button class="action-btn bg-red-50 text-red-700" data-delete="news" data-id="${esc(n.id)}">Hapus</button></div>
      </article>
    `).join('') || emptyList('Belum ada berita.');
  }

  function renderGallery() {
    const list = $('galleryList');
    list.innerHTML = state.gallery.map((g) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div class="flex items-center gap-4">
          <img src="${g.media_type === 'image' ? esc(g.media_url || '') : ''}" class="w-20 h-16 rounded-2xl object-cover bg-gray-100" />
          <div><p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${esc(g.album || g.media_type)}</p><h3 class="font-black">${esc(g.title)}</h3><p class="text-xs text-gray-400 font-bold">${g.is_active ? 'Aktif' : 'Nonaktif'}</p></div>
        </div>
        <div class="flex gap-2"><button class="action-btn bg-blue-50 text-blue-700" data-edit="gallery" data-id="${esc(g.id)}">Edit</button><button class="action-btn bg-red-50 text-red-700" data-delete="gallery" data-id="${esc(g.id)}">Hapus</button></div>
      </article>
    `).join('') || emptyList('Galeri kosong.');
  }

  function renderDocuments() {
    const list = $('documentsListAdmin');
    list.innerHTML = state.documents.map((d) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div><p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${esc(d.category || 'Dokumen')} ${d.year ? esc(d.year) : ''}</p><h3 class="font-black">${esc(d.title)}</h3><p class="text-xs text-gray-400 font-bold">${d.is_public ? 'Publik' : 'Nonpublik'}</p></div>
        <div class="flex gap-2"><a href="${esc(d.file_url || '#')}" target="_blank" class="action-btn bg-gray-50 text-gray-700">Buka</a><button class="action-btn bg-blue-50 text-blue-700" data-edit="document" data-id="${esc(d.id)}">Edit</button><button class="action-btn bg-red-50 text-red-700" data-delete="document" data-id="${esc(d.id)}">Hapus</button></div>
      </article>
    `).join('') || emptyList('Belum ada dokumen.');
  }

  function renderAnnouncements() {
    const list = $('announcementsListAdmin');
    list.innerHTML = state.announcements.map((a) => `
      <article class="table-card flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        <div><p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">${a.is_pinned ? 'Prioritas' : 'Pengumuman'}</p><h3 class="font-black">${esc(a.title)}</h3><div class="mt-2">${statusBadge(a.status)}</div></div>
        <div class="flex gap-2"><button class="action-btn bg-blue-50 text-blue-700" data-edit="announcement" data-id="${esc(a.id)}">Edit</button><button class="action-btn bg-red-50 text-red-700" data-delete="announcement" data-id="${esc(a.id)}">Hapus</button></div>
      </article>
    `).join('') || emptyList('Belum ada pengumuman.');
  }

  function emptyList(text) {
    return `<div class="table-card text-center text-gray-400 font-black uppercase tracking-widest text-xs">${esc(text)}</div>`;
  }

  async function saveSettings(e) {
    e.preventDefault();
    showLoader(true);
    try {
      const heroUrl = await uploadIfSelected('set_hero_file', 'settings', value('set_hero_image_url'));
      const payload = {
        id: 1,
        site_name: value('set_site_name'),
        tagline: value('set_tagline'),
        hero_title: value('set_hero_title'),
        hero_subtitle: value('set_hero_subtitle'),
        hero_image_url: heroUrl,
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
    } catch (err) {
      alert(err.message || err);
    } finally {
      showLoader(false);
    }
  }

  async function saveOfficer(e) {
    e.preventDefault();
    showLoader(true);
    try {
      const id = value('officer_id');
      const payload = {
        id: id || undefined,
        rank: value('officer_rank'),
        name: value('officer_name'),
        position: value('officer_position'),
        photo_url: await uploadIfSelected('officer_file', 'officers', value('officer_photo_url')),
        description: value('officer_description'),
        sort_order: numberValue('officer_sort_order', 1),
        is_active: checked('officer_is_active'),
        updated_at: new Date().toISOString()
      };
      if (!id) delete payload.id;
      await upsert('officers', payload);
      resetForm('officerForm');
      await reloadAndRender('officers');
      alert('Data pejabat berhasil disimpan.');
    } catch (err) { alert(err.message || err); }
    finally { showLoader(false); }
  }

  async function saveSection(e) {
    e.preventDefault();
    showLoader(true);
    try {
      const id = value('section_id');
      const payload = {
        id: id || undefined,
        name: value('section_name'),
        description: value('section_description'),
        duties: value('section_duties'),
        sort_order: numberValue('section_sort_order', 1),
        is_active: checked('section_is_active'),
        updated_at: new Date().toISOString()
      };
      if (!id) delete payload.id;
      await upsert('sections', payload);
      resetForm('sectionForm');
      await reloadAndRender('sections');
      alert('Data bagian berhasil disimpan.');
    } catch (err) { alert(err.message || err); }
    finally { showLoader(false); }
  }

  async function saveNews(e) {
    e.preventDefault();
    showLoader(true);
    try {
      const id = value('news_id');
      const status = value('news_status') || 'draft';
      const old = state.news.find((x) => x.id === id) || {};
      const payload = {
        id: id || undefined,
        title: value('news_title'),
        category: value('news_category') || 'Berita',
        body: value('news_body'),
        image_url: await uploadIfSelected('news_file', 'news', value('news_image_url')),
        status,
        published_at: status === 'published' ? (old.published_at || new Date().toISOString()) : null,
        updated_at: new Date().toISOString()
      };
      if (!id) delete payload.id;
      await upsert('news', payload);
      resetForm('newsForm');
      await reloadAndRender('news');
      alert('Berita berhasil disimpan.');
    } catch (err) { alert(err.message || err); }
    finally { showLoader(false); }
  }

  async function saveGallery(e) {
    e.preventDefault();
    showLoader(true);
    try {
      const id = value('gallery_id');
      const payload = {
        id: id || undefined,
        title: value('gallery_title'),
        album: value('gallery_album'),
        media_type: value('gallery_media_type') || 'image',
        media_url: await uploadIfSelected('gallery_file', 'gallery', value('gallery_media_url')),
        description: value('gallery_description'),
        sort_order: numberValue('gallery_sort_order', 1),
        is_active: checked('gallery_is_active'),
        updated_at: new Date().toISOString()
      };
      if (!id) delete payload.id;
      await upsert('gallery', payload);
      resetForm('galleryForm');
      await reloadAndRender('gallery');
      alert('Galeri berhasil disimpan.');
    } catch (err) { alert(err.message || err); }
    finally { showLoader(false); }
  }

  async function saveDocument(e) {
    e.preventDefault();
    showLoader(true);
    try {
      const id = value('document_id');
      const payload = {
        id: id || undefined,
        title: value('document_title'),
        category: value('document_category'),
        file_url: await uploadIfSelected('document_file', 'documents', value('document_file_url')),
        year: numberValue('document_year', null),
        description: value('document_description'),
        is_public: checked('document_is_public'),
        updated_at: new Date().toISOString()
      };
      if (!id) delete payload.id;
      if (!payload.year) payload.year = null;
      await upsert('documents', payload);
      resetForm('documentForm');
      await reloadAndRender('documents');
      alert('Dokumen berhasil disimpan.');
    } catch (err) { alert(err.message || err); }
    finally { showLoader(false); }
  }

  async function saveAnnouncement(e) {
    e.preventDefault();
    showLoader(true);
    try {
      const id = value('announcement_id');
      const payload = {
        id: id || undefined,
        title: value('announcement_title'),
        body: value('announcement_body'),
        attachment_url: await uploadIfSelected('announcement_file', 'announcements', value('announcement_attachment_url')),
        start_date: value('announcement_start_date') || null,
        end_date: value('announcement_end_date') || null,
        is_pinned: checked('announcement_is_pinned'),
        status: value('announcement_status') || 'draft',
        updated_at: new Date().toISOString()
      };
      if (!id) delete payload.id;
      await upsert('announcements', payload);
      resetForm('announcementForm');
      await reloadAndRender('announcements');
      alert('Pengumuman berhasil disimpan.');
    } catch (err) { alert(err.message || err); }
    finally { showLoader(false); }
  }



  async function saveReport(e) {
    e.preventDefault();
    showLoader(true);

    try {
      const id = value('report_id');
      const old = state.reports.find((x) => x.id === id) || {};

      const payload = {
        id: id || undefined,
        polres_name: value('report_polres_name'),
        bag_subbag: value('report_bag_subbag'),
        title: value('report_title'),
        activity_date: value('report_activity_date') || null,
        description: value('report_description'),
        image_url: await uploadIfSelected('report_file', 'reports', old.image_url || ''),
        updated_at: new Date().toISOString()
      };

      if (!id) delete payload.id;

      await upsert('reports', payload);
      resetForm('reportForm');
      updateReportBagOptions();
      await reloadAndRender('reports');

      alert('Laporan berhasil disimpan.');
    } catch (err) {
      alert(err.message || err);
    } finally {
      showLoader(false);
    }
  }

  function downloadReportsExcel() {
    if (!window.XLSX) {
      alert('Library Excel belum terbaca. Pastikan script xlsx sudah ditambahkan di admin.html.');
      return;
    }

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

  async function upsert(table, payload) {
    const { error } = await db.from(table).upsert(payload);
    if (error) throw error;
  }

  async function reloadAndRender(table) {
    const orderMap = {
      officers: ['sort_order', true],
      sections: ['sort_order', true],
      news: ['created_at', false],
      gallery: ['created_at', false],
      documents: ['created_at', false],
      announcements: ['created_at', false],
      reports: ['created_at', false]
    };
    const [column, ascending] = orderMap[table];
    await loadTable(table, { order: column, ascending });
    renderCounts();
    if (table === 'officers') renderOfficers();
    if (table === 'sections') renderSections();
    if (table === 'news') renderNews();
    if (table === 'gallery') renderGallery();
    if (table === 'documents') renderDocuments();
    if (table === 'announcements') renderAnnouncements();
    if (table === 'reports') renderReports();
  }

  function resetForm(formId) {
    const form = $(formId);
    form?.reset();
    form?.querySelectorAll('input[type="hidden"]').forEach((el) => { el.value = ''; });
    form?.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      if (el.id.includes('is_active') || el.id.includes('is_public')) el.checked = true;
      else el.checked = false;
    });
  }

  function editItem(type, id) {
    if (isReportsOnlyUser() && type !== 'report') {
      return alert('Akun ini hanya boleh mengedit menu Pelaporan.');
    }
    const meta = typeMap[type];
    const item = state[meta.state].find((row) => row.id === id);
    if (!item) return alert('Data tidak ditemukan.');
    activateTab(meta.state === 'documents' ? 'documents' : meta.state === 'announcements' ? 'announcements' : meta.state);

    if (type === 'officer') {
      setValue('officer_id', item.id); setValue('officer_rank', item.rank); setValue('officer_name', item.name); setValue('officer_position', item.position); setValue('officer_photo_url', item.photo_url); setValue('officer_description', item.description); setValue('officer_sort_order', item.sort_order || 1); setChecked('officer_is_active', item.is_active);
    }
    if (type === 'section') {
      setValue('section_id', item.id); setValue('section_name', item.name); setValue('section_description', item.description); setValue('section_duties', item.duties); setValue('section_sort_order', item.sort_order || 1); setChecked('section_is_active', item.is_active);
    }
    if (type === 'news') {
      setValue('news_id', item.id); setValue('news_title', item.title); setValue('news_category', item.category); setValue('news_image_url', item.image_url); setValue('news_status', item.status || 'draft'); setValue('news_body', item.body);
    }
    if (type === 'gallery') {
      setValue('gallery_id', item.id); setValue('gallery_title', item.title); setValue('gallery_album', item.album); setValue('gallery_media_type', item.media_type || 'image'); setValue('gallery_media_url', item.media_url); setValue('gallery_description', item.description); setValue('gallery_sort_order', item.sort_order || 1); setChecked('gallery_is_active', item.is_active);
    }
    if (type === 'document') {
      setValue('document_id', item.id); setValue('document_title', item.title); setValue('document_category', item.category); setValue('document_year', item.year); setValue('document_file_url', item.file_url); setValue('document_description', item.description); setChecked('document_is_public', item.is_public);
    }
    if (type === 'announcement') {
      setValue('announcement_id', item.id); setValue('announcement_title', item.title); setValue('announcement_body', item.body); setValue('announcement_attachment_url', item.attachment_url); setValue('announcement_start_date', item.start_date); setValue('announcement_end_date', item.end_date); setValue('announcement_status', item.status || 'draft'); setChecked('announcement_is_pinned', item.is_pinned);
    }
    if (type === 'report') {
      setValue('report_id', item.id);
      setValue('report_polres_name', item.polres_name);
      updateReportBagOptions(item.bag_subbag);
      setValue('report_title', item.title);
      setValue('report_activity_date', item.activity_date);
      setValue('report_description', item.description);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteItem(type, id) {
    if (isReportsOnlyUser() && type !== 'report') {
      return alert('Akun ini hanya boleh menghapus data pada menu Pelaporan.');
    }
    const meta = typeMap[type];
    if (!meta || !confirm('Hapus data ini?')) return;
    showLoader(true);
    try {
      const { error } = await db.from(meta.table).delete().eq('id', id);
      if (error) throw error;
      await reloadAndRender(meta.table);
      alert('Data berhasil dihapus.');
    } catch (err) {
      alert(err.message || err);
    } finally {
      showLoader(false);
    }
  }

  async function login(e) {
    e.preventDefault();
    if (!configured) return alert('Supabase belum dikonfigurasi.');
    showLoader(true);
    try {
      const { data, error } = await db.auth.signInWithPassword({ email: value('loginEmail'), password: value('loginPassword') });
      if (error) throw error;
      state.session = data.session;
      await loadAdminProfile();
      showApp();
      applyRoleAccess();
      await loadAll();
    } catch (err) {
      alert(err.message || err);
    } finally {
      showLoader(false);
    }
  }

  async function logout() {
    await db.auth.signOut();
    state.session = null;
    showLogin();
  }

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) activateTab(tab.dataset.tab);

    const edit = e.target.closest('[data-edit]');
    if (edit) editItem(edit.dataset.edit, edit.dataset.id);

    const del = e.target.closest('[data-delete]');
    if (del) deleteItem(del.dataset.delete, del.dataset.id);

    const reset = e.target.closest('[data-reset]');
    if (reset) resetForm(reset.dataset.reset);
  });

  $('loginForm')?.addEventListener('submit', login);
  $('logoutBtn')?.addEventListener('click', logout);
  $('refreshAdminBtn')?.addEventListener('click', loadAll);
  $('settingsForm')?.addEventListener('submit', saveSettings);
  $('officerForm')?.addEventListener('submit', saveOfficer);
  $('sectionForm')?.addEventListener('submit', saveSection);
  $('newsForm')?.addEventListener('submit', saveNews);
  $('galleryForm')?.addEventListener('submit', saveGallery);
  $('documentForm')?.addEventListener('submit', saveDocument);
  $('announcementForm')?.addEventListener('submit', saveAnnouncement);


  $('reportForm')?.addEventListener('submit', saveReport);
  $('downloadReportExcel')?.addEventListener('click', downloadReportsExcel);
  $('report_polres_name')?.addEventListener('change', () => updateReportBagOptions());
  $('filter_polres')?.addEventListener('change', renderReports);
  $('filter_bag_subbag')?.addEventListener('change', renderReports);
  $('filter_start_date')?.addEventListener('change', renderReports);
  $('filter_end_date')?.addEventListener('change', renderReports);
  $('resetReportFilter')?.addEventListener('click', () => {
    setValue('filter_polres', '');
    setValue('filter_bag_subbag', '');
    setValue('filter_start_date', '');
    setValue('filter_end_date', '');
    renderReports();
  });

  requireAdmin();
})();
