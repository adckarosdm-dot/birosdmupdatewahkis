(function () {
  const config = window.ROSDM_CONFIG || {};
  const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes('ISI_') && config.SUPABASE_ANON_KEY && !config.SUPABASE_ANON_KEY.includes('ISI_');
  const db = configured ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;

  const $ = (id) => document.getElementById(id);
  const loader = $('loader');

  const fallback = {
    settings: {
      site_name: 'RO SDM',
      tagline: 'Portal Digital Biro SDM',
      hero_title: 'SDM Polri Unggul',
      hero_subtitle: 'Manajemen informasi SDM Polri Polda Bali yang modern, transparan, dan akuntabel.',
      hero_image_url: 'https://ui-avatars.com/api/?name=RO+SDM+POLDA+BALI&background=FFEB3B&color=1A237E&size=900&bold=true',
      about_title: 'Biro SDM Polda Bali',
      about_body: 'Biro SDM Polda Bali menyelenggarakan pembinaan dan pengelolaan sumber daya manusia Polri di lingkungan Polda Bali, meliputi pengadaan, pembinaan karier, perawatan personel, psikologi kepolisian, serta administrasi personel.',
      vision: 'Terwujudnya SDM Polri Polda Bali yang unggul, profesional, modern, dan berintegritas.',
      mission: 'Menyelenggarakan manajemen SDM yang transparan dan akuntabel.\nMeningkatkan kompetensi dan profesionalisme personel.\nMelaksanakan pembinaan karier secara objektif dan berkelanjutan.\nMengoptimalkan pelayanan administrasi SDM berbasis digital.',
      address: 'Polda Bali, Denpasar, Bali',
      email: '-',
      phone: '-',
      instagram_url: 'https://www.instagram.com/biro_sdm_polda_bali',
      facebook_url: 'https://www.facebook.com/ro.sdm.polda.bali',
      youtube_url: 'https://www.youtube.com/@BiroSDMPoldaBali',
      tiktok_url: 'https://www.tiktok.com/@sdm_polda_bali',
      x_url: 'https://x.com/birosdmbali'
    },
    officers: [
      { name: 'KOMPOL DAYU KALPIKA', rank: '', position: 'KASUBAG RENMIN', photo_url: 'https://ui-avatars.com/api/?name=DAYU+KALPIKA&background=FFEB3B&color=1A237E&size=400&bold=true', description: 'Pejabat Subbag Renmin.' },
      { name: 'AKBP GEDE JUNAEDI', rank: '', position: 'KABAG DALPERS', photo_url: 'https://ui-avatars.com/api/?name=GEDE+JUNAEDI&background=FFEB3B&color=1A237E&size=400&bold=true', description: 'Pejabat Bag Dalpers.' },
      { name: 'AKBP MICHAEL RISAKOTTA', rank: '', position: 'KABAG BINKAR', photo_url: 'https://ui-avatars.com/api/?name=MICHAEL+RISAKOTTA&background=FFEB3B&color=1A237E&size=400&bold=true', description: 'Pejabat Bag Binkar.' },
      { name: 'KABAG WATPERS', rank: '', position: 'KABAG WATPERS', photo_url: 'https://ui-avatars.com/api/?name=WATPERS&background=E5E7EB&color=111827&size=400&bold=true', description: 'Pejabat Bag Watpers.' },
      { name: 'AKBP I NYOMAN WIBAWA', rank: '', position: 'KABAG PSI', photo_url: 'https://ui-avatars.com/api/?name=I+NYOMAN+WIBAWA&background=FFEB3B&color=1A237E&size=400&bold=true', description: 'Pejabat Bag Psi.' }
    ],
    sections: [
      { name: 'BAG DALPERS', description: 'Pelayanan penyediaan personel, seleksi, dan administrasi penerimaan anggota Polri.', duties: 'Seleksi penerimaan, administrasi pendidikan, dan pengelolaan personel.' },
      { name: 'BAG BINKAR', description: 'Pembinaan karier, kepangkatan, mutasi jabatan, dan asesmen kompetensi.', duties: 'UKP, mutasi jabatan, asesmen, dan pengembangan karier.' },
      { name: 'BAG WATPERS', description: 'Perawatan personel, kesejahteraan, rohani jasmani, dan penghargaan.', duties: 'Pembinaan mental, jasmani, kesejahteraan, dan administrasi akhir dinas.' },
      { name: 'BAG PSI', description: 'Pelayanan psikologi kepolisian dan psikologi personel.', duties: 'Psikologi operasional, psikologi personel, dan pemeriksaan psikologi.' },
      { name: 'SUBBAG RENMIN', description: 'Perencanaan, administrasi, tata usaha, keuangan, dan logistik internal.', duties: 'Renja, DIPA, tata usaha, keuangan, dan inventaris.' }
    ],
    news: [
      { title: 'Selamat Datang di Portal Biro SDM Polda Bali', category: 'INFORMASI', body: 'Berita ini adalah contoh awal. Setelah Supabase tersambung, admin dapat menghapus dan mengganti berita melalui dashboard.', image_url: 'https://via.placeholder.com/900x600/FFEB3B/1A237E?text=RO+SDM+BALI', published_at: new Date().toISOString() }
    ],
    gallery: [],
    documents: [],
    announcements: [],
    reports: []
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function showLoader(show) {
    if (!loader) return;
    loader.classList.toggle('show', !!show);
  }

  function setText(id, value) {
    const el = $(id);
    if (el && value !== undefined && value !== null) el.textContent = value;
  }

  function setImage(id, value) {
    const el = $(id);
    if (el && value) el.src = value;
  }

  async function getRows(table, options = {}) {
    if (!db) return fallback[table] || [];
    let q = db.from(table).select('*');
    if (options.eq) options.eq.forEach(([k, v]) => { q = q.eq(k, v); });
    if (options.order) q = q.order(options.order.column, { ascending: options.order.ascending ?? true });
    if (options.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) {
      console.error(error);
      return fallback[table] || [];
    }
    return data || [];
  }

  async function loadSettings() {
    if (!db) return fallback.settings;
    const { data, error } = await db.from('site_settings').select('*').eq('id', 1).single();
    if (error) {
      console.warn(error.message);
      return fallback.settings;
    }
    return { ...fallback.settings, ...(data || {}) };
  }

  function renderSettings(settings) {
    setText('navSiteName', settings.site_name || 'RO SDM');
    setText('tagline', settings.tagline);
    setText('heroTitle', settings.hero_title);
    setText('heroSubtitle', settings.hero_subtitle);
    setImage('heroImage', settings.hero_image_url);
    setText('aboutTitle', settings.about_title);
    setText('aboutBody', settings.about_body);
    setText('visionText', settings.vision);
    setText('addressText', settings.address || '-');
    setText('emailText', settings.email || '-');
    setText('phoneText', settings.phone || '-');

    const missionList = $('missionList');
    const missionLines = String(settings.mission || '').split('\n').map(x => x.trim()).filter(Boolean);
    missionList.innerHTML = missionLines.map((item) => `<li class="flex gap-3"><span class="text-amber-600 font-black">•</span><span>${esc(item)}</span></li>`).join('');

    const socials = [
      ['instagram_url', 'fa-brands fa-instagram', 'Instagram'],
      ['facebook_url', 'fa-brands fa-facebook-f', 'Facebook'],
      ['youtube_url', 'fa-brands fa-youtube', 'YouTube'],
      ['tiktok_url', 'fa-brands fa-tiktok', 'TikTok'],
      ['x_url', 'fa-brands fa-x-twitter', 'X']
    ];
    $('socialLinks').innerHTML = socials.filter(([key]) => settings[key]).map(([key, icon, label]) => `
      <a href="${esc(settings[key])}" target="_blank" rel="noopener" class="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label="${esc(label)}">
        <i class="${icon}"></i>
      </a>`).join('');
  }

  function renderOfficers(rows) {
    const grid = $('officersGrid');
    if (!rows.length) {
      grid.innerHTML = emptyCard('Belum ada data pejabat.');
      return;
    }
    grid.innerHTML = rows.map((p) => `
      <article class="card-soft card-hover p-8 text-center">
        <img src="${esc(p.photo_url)}" alt="${esc(p.name)}" class="w-36 h-36 rounded-full mx-auto object-cover border-4 border-yellow-300 p-1 bg-white" />
        <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest mt-5">${esc(p.position)}</p>
        <h3 class="text-xl font-black mt-2">${esc([p.rank, p.name].filter(Boolean).join(' '))}</h3>
        <p class="text-xs text-gray-500 font-semibold mt-4 leading-relaxed">${esc(p.description || '')}</p>
      </article>
    `).join('');
  }

  function renderSections(rows) {
    const grid = $('sectionsGrid');
    if (!rows.length) {
      grid.innerHTML = emptyCard('Belum ada data bagian/fungsi.');
      return;
    }
    grid.innerHTML = rows.map((s) => `
      <article class="card-soft card-hover p-8">
        <div class="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center mb-6">
          <i class="fa-solid fa-sitemap text-[#1A237E]"></i>
        </div>
        <h3 class="text-xl font-black mb-3">${esc(s.name)}</h3>
        <p class="text-sm text-gray-500 font-semibold leading-relaxed mb-5">${esc(s.description || '')}</p>
        <div class="bg-gray-50 rounded-2xl p-4 text-xs text-gray-500 font-bold leading-relaxed">${esc(s.duties || '')}</div>
      </article>
    `).join('');
  }

  function renderNews(newsRows, reportRows = []) {
    const grid = $('newsGrid');

    const newsItems = (newsRows || []).map((n) => ({
      type: 'news',
      title: n.title,
      category: n.category || 'Berita',
      body: n.body || '',
      image_url: n.image_url || 'https://via.placeholder.com/900x600/FFEB3B/1A237E?text=RO+SDM+BALI',
      date: n.published_at || n.created_at
    }));

    const reportItems = (reportRows || []).map((r) => ({
      type: 'report',
      title: r.title,
      category: `${r.polres_name || 'LAPORAN'} • ${r.bag_subbag || ''}`,
      body: r.description || '',
      image_url: r.image_url || 'https://via.placeholder.com/900x600/FFEB3B/1A237E?text=LAPORAN+SDM',
      date: r.activity_date || r.created_at
    }));

    const combined = [...reportItems, ...newsItems]
      .filter((item) => item.title)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 12);

    if (!combined.length) {
      grid.innerHTML = emptyCard('Belum ada berita atau laporan.');
      return;
    }

    grid.innerHTML = combined.map((item) => `
      <article class="card-soft card-hover overflow-hidden">
        <img src="${esc(item.image_url)}" alt="${esc(item.title)}" class="w-full h-52 object-cover" />
        <div class="p-7">
          <p class="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-3">${esc(item.category)}</p>
          <h3 class="text-lg font-black leading-snug mb-3 line-clamp-2">${esc(item.title)}</h3>
          <p class="text-xs text-gray-500 font-semibold leading-relaxed line-clamp-3">${esc(item.body)}</p>
          <p class="text-[10px] text-gray-400 font-bold mt-5">${formatDate(item.date)}</p>
        </div>
      </article>
    `).join('');
  }

  function renderGallery(rows) {
    const grid = $('galleryGrid');
    if (!rows.length) {
      grid.innerHTML = emptyCard('Galeri masih kosong.');
      return;
    }
    grid.innerHTML = rows.map((g) => `
      <article class="card-soft overflow-hidden card-hover">
        ${g.media_type === 'video'
          ? `<div class="h-52 bg-gray-900 flex items-center justify-center text-white"><i class="fa-solid fa-play text-4xl"></i></div>`
          : `<img src="${esc(g.media_url)}" alt="${esc(g.title)}" class="w-full h-52 object-cover" />`}
        <div class="p-6">
          <p class="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2">${esc(g.album || 'Galeri')}</p>
          <h3 class="font-black">${esc(g.title)}</h3>
          ${g.media_type === 'video' ? `<a href="${esc(g.media_url)}" target="_blank" rel="noopener" class="text-xs font-black text-amber-700 mt-3 inline-block">Buka Video</a>` : ''}
        </div>
      </article>
    `).join('');
  }

  function renderDocuments(rows) {
    const list = $('documentsList');
    if (!rows.length) {
      list.innerHTML = emptyCard('Belum ada dokumen publik.');
      return;
    }
    list.innerHTML = rows.map((d) => `
      <a href="${esc(d.file_url)}" target="_blank" rel="noopener" class="card-soft card-hover p-6 block">
        <div class="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-5"><i class="fa-solid fa-file-pdf"></i></div>
        <p class="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2">${esc(d.category || 'Dokumen')} ${d.year ? esc(d.year) : ''}</p>
        <h3 class="font-black leading-snug">${esc(d.title)}</h3>
        <p class="text-xs text-gray-500 font-semibold mt-3 line-clamp-2">${esc(d.description || '')}</p>
      </a>
    `).join('');
  }

  function renderAnnouncements(rows) {
    const grid = $('announcementsGrid');
    if (!rows.length) {
      grid.innerHTML = emptyCard('Belum ada pengumuman aktif.');
      return;
    }
    grid.innerHTML = rows.map((a) => `
      <article class="card-soft p-6 border-l-4 ${a.is_pinned ? 'border-l-amber-400' : 'border-l-gray-200'}">
        <p class="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2">${a.is_pinned ? 'Prioritas' : 'Pengumuman'}</p>
        <h3 class="text-lg font-black mb-3">${esc(a.title)}</h3>
        <p class="text-sm text-gray-500 font-semibold leading-relaxed">${esc(a.body || '')}</p>
        ${a.attachment_url ? `<a href="${esc(a.attachment_url)}" target="_blank" rel="noopener" class="text-xs font-black text-amber-700 mt-4 inline-block">Lihat Lampiran</a>` : ''}
      </article>
    `).join('');
  }

  function emptyCard(message) {
    return `<div class="col-span-full card-soft p-10 text-center text-gray-400 font-black uppercase tracking-widest text-xs">${esc(message)}</div>`;
  }

  function formatDate(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
    } catch (_) {
      return String(value);
    }
  }

  async function loadAll() {
    showLoader(true);
    try {
      const settings = await loadSettings();
      renderSettings(settings);

      const [officers, sections, news, reports, gallery, documents, announcements] = await Promise.all([
        getRows('officers', { eq: [['is_active', true]], order: { column: 'sort_order' } }),
        getRows('sections', { eq: [['is_active', true]], order: { column: 'sort_order' } }),
        getRows('news', { eq: [['status', 'published']], order: { column: 'published_at', ascending: false }, limit: 9 }),
        getRows('reports', { order: { column: 'created_at', ascending: false }, limit: 100 }),
        getRows('gallery', { eq: [['is_active', true]], order: { column: 'created_at', ascending: false }, limit: 6 }),
        getRows('documents', { eq: [['is_public', true]], order: { column: 'created_at', ascending: false }, limit: 9 }),
        getRows('announcements', { eq: [['status', 'published']], order: { column: 'is_pinned', ascending: false }, limit: 4 })
      ]);

      renderOfficers(officers);
      renderSections(sections);
      renderNews(news, reports);
      renderGallery(gallery);
      renderDocuments(documents);
      renderAnnouncements(announcements);
    } finally {
      showLoader(false);
    }
  }

  $('mobileBtn')?.addEventListener('click', () => $('mobileMenu').classList.toggle('hidden'));
  $('refreshBtn')?.addEventListener('click', loadAll);
  loadAll();
})();
