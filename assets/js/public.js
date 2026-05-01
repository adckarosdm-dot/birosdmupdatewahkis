(function () {
  const config = window.ROSDM_CONFIG || {};
  const configured =
    config.SUPABASE_URL &&
    !config.SUPABASE_URL.includes('ISI_') &&
    config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_ANON_KEY.includes('ISI_');

  const db = configured
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;

  const $ = (id) => document.getElementById(id);
  const loader = $('loader');

  const state = {
    settings: null,
    officers: [],
    sections: [],
    news: [],
    reports: [],
    gallery: [],
    documents: [],
    announcements: []
  };

  let reportsChartInstance = null;

  const fallback = {
    settings: {
      site_name: 'RO SDM',
      tagline: 'Portal Digital Biro SDM',
      hero_title: 'SDM Polri Unggul',
      hero_subtitle: 'Manajemen informasi SDM Polri Polda Bali yang modern, transparan, dan akuntabel.',
      hero_image_url: 'https://ui-avatars.com/api/?name=RO+SDM+POLDA+BALI&background=FFEB3B&color=1A237E&size=900&bold=true',
      about_title: 'Biro SDM Polda Bali',
      about_body: 'Biro SDM Polda Bali menyelenggarakan pembinaan dan pengelolaan sumber daya manusia Polri di lingkungan Polda Bali.',
      vision: 'Terwujudnya SDM Polri Polda Bali yang unggul, profesional, modern, dan berintegritas.',
      mission: 'Menyelenggarakan manajemen SDM yang transparan dan akuntabel.\nMeningkatkan kompetensi dan profesionalisme personel.\nMelaksanakan pembinaan karier secara objektif dan berkelanjutan.',
      address: 'Polda Bali, Denpasar, Bali',
      email: '-',
      phone: '-',
      instagram_url: '',
      facebook_url: '',
      youtube_url: '',
      tiktok_url: '',
      x_url: ''
    },
    officers: [],
    sections: [],
    news: [
      {
        title: 'Selamat Datang di Portal Biro SDM Polda Bali',
        category: 'INFORMASI',
        body: 'Berita ini adalah contoh awal. Setelah Supabase tersambung, admin dapat menghapus dan mengganti berita melalui dashboard.',
        image_url: 'https://via.placeholder.com/900x600/FFEB3B/1A237E?text=RO+SDM+BALI',
        published_at: new Date().toISOString()
      }
    ],
    reports: [],
    gallery: [],
    documents: [],
    announcements: []
  };

  const polresForChart = [
    'POLRESTA DENPASAR',
    'POLRES BADUNG',
    'POLRES GIANYAR',
    'POLRES TABANAN',
    'POLRES BULELENG',
    'POLRES JEMBRANA',
    'POLRES KLUNGKUNG',
    'POLRES BANGLI',
    'POLRES KARANGASEM',
    'POLRES BANDARA'
  ];

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char]));
  }

  function showLoader(show) {
    if (!loader) return;
    loader.classList.toggle('show', !!show);
  }

  function value(id) {
    return ($(id)?.value || '').trim();
  }

  function setValue(id, val) {
    const el = $(id);
    if (el) el.value = val ?? '';
  }

  function setText(id, val) {
    const el = $(id);
    if (el && val !== undefined && val !== null) el.textContent = val;
  }

  function setImage(id, url) {
    const el = $(id);
    if (el && url) el.src = url;
  }

  function formatDate(dateValue) {
    if (!dateValue) return '';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date(dateValue));
    } catch (_) {
      return String(dateValue);
    }
  }

  function toYmd(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function todayYmd() {
    return toYmd(new Date());
  }

  function daysAgoYmd(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return toYmd(date);
  }

  function normalizeText(text) {
    return String(text || '').toUpperCase().trim();
  }

  async function getRows(table, options = {}) {
    if (!db) return fallback[table] || [];

    let q = db.from(table).select('*');

    if (options.eq) {
      options.eq.forEach(([key, val]) => {
        q = q.eq(key, val);
      });
    }

    if (options.order) {
      q = q.order(options.order.column, {
        ascending: options.order.ascending ?? true
      });
    }

    if (options.limit) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;

    if (error) {
      console.error(`Gagal mengambil tabel ${table}:`, error);
      return fallback[table] || [];
    }

    return data || [];
  }

  async function loadSettings() {
    if (!db) return fallback.settings;

    const { data, error } = await db
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.warn('Gagal mengambil pengaturan:', error.message);
      return fallback.settings;
    }

    return {
      ...fallback.settings,
      ...(data || {})
    };
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
    if (missionList) {
      const missionLines = String(settings.mission || '')
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);

      missionList.innerHTML = missionLines
        .map((item) => `<li class="flex gap-3"><span class="text-amber-600 font-black">•</span><span>${esc(item)}</span></li>`)
        .join('');
    }

    const socialLinks = $('socialLinks');
    if (socialLinks) {
      const socials = [
        ['instagram_url', 'fa-brands fa-instagram', 'Instagram'],
        ['facebook_url', 'fa-brands fa-facebook-f', 'Facebook'],
        ['youtube_url', 'fa-brands fa-youtube', 'YouTube'],
        ['tiktok_url', 'fa-brands fa-tiktok', 'TikTok'],
        ['x_url', 'fa-brands fa-x-twitter', 'X']
      ];

      socialLinks.innerHTML = socials
        .filter(([key]) => settings[key])
        .map(([key, icon, label]) => `
          <a href="${esc(settings[key])}" target="_blank" rel="noopener"
            class="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="${esc(label)}">
            <i class="${icon}"></i>
          </a>
        `)
        .join('');
    }
  }

  function renderOfficers(rows) {
    const grid = $('officersGrid');
    if (!grid) return;

    if (!rows.length) {
      grid.innerHTML = emptyCard('Belum ada data pejabat.');
      return;
    }

    grid.innerHTML = rows.map((p) => `
      <article class="card-soft card-hover p-8 text-center">
        <img src="${esc(p.photo_url || '')}" alt="${esc(p.name || '')}" class="w-36 h-36 rounded-full mx-auto object-cover border-4 border-yellow-300 p-1 bg-white" />
        <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest mt-5">${esc(p.position || '')}</p>
        <h3 class="text-xl font-black mt-2">${esc([p.rank, p.name].filter(Boolean).join(' '))}</h3>
        <p class="text-xs text-gray-500 font-semibold mt-4 leading-relaxed">${esc(p.description || '')}</p>
      </article>
    `).join('');
  }

  function renderSections(rows) {
    const grid = $('sectionsGrid');
    if (!grid) return;

    if (!rows.length) {
      grid.innerHTML = emptyCard('Belum ada data bagian/fungsi.');
      return;
    }

    grid.innerHTML = rows.map((s) => `
      <article class="card-soft card-hover p-8">
        <div class="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center mb-6">
          <i class="fa-solid ${esc(s.icon_class || 'fa-sitemap')} text-[#1A237E]"></i>
        </div>
        <h3 class="text-xl font-black mb-3">${esc(s.name || '')}</h3>
        <p class="text-sm text-gray-500 font-semibold leading-relaxed mb-5">${esc(s.description || '')}</p>
        <div class="bg-gray-50 rounded-2xl p-4 text-xs text-gray-500 font-bold leading-relaxed">${esc(s.duties || '')}</div>
      </article>
    `).join('');
  }

  function getPublicReportFilterValues() {
    return {
      polres: value('public_filter_polres'),
      bag: value('public_filter_bag_subbag') || value('public_filter_bag'),
      startDate: value('public_filter_start_date'),
      endDate: value('public_filter_end_date')
    };
  }

  function hasActivePublicFilter() {
    const filter = getPublicReportFilterValues();
    return Boolean(filter.polres || filter.bag || filter.startDate || filter.endDate);
  }

  function getFilteredReports(rows, options = {}) {
    const filter = getPublicReportFilterValues();

    let startDate = filter.startDate;
    let endDate = filter.endDate;

    if (options.defaultLastSevenDays && !startDate && !endDate) {
      startDate = daysAgoYmd(7);
      endDate = todayYmd();
    }

    return (rows || []).filter((report) => {
      const reportDate = report.activity_date || '';

      const matchPolres =
        !filter.polres ||
        normalizeText(report.polres_name) === normalizeText(filter.polres);

      const matchBag =
        !filter.bag ||
        normalizeText(report.bag_subbag) === normalizeText(filter.bag);

      const matchStart = !startDate || reportDate >= startDate;
      const matchEnd = !endDate || reportDate <= endDate;

      return matchPolres && matchBag && matchStart && matchEnd;
    });
  }

  function renderNews(newsRows = [], reportRows = []) {
    const grid = $('newsGrid');
    if (!grid) return;

    const filterActive = hasActivePublicFilter();
    const filteredReports = getFilteredReports(reportRows);

    const reportItems = filteredReports.map((report) => ({
      type: 'report',
      title: report.title,
      category: `${report.polres_name || 'LAPORAN'} • ${report.bag_subbag || ''}`,
      body: report.description || '',
      image_url: report.image_url || 'https://via.placeholder.com/900x600/FFEB3B/1A237E?text=LAPORAN+SDM',
      date: report.activity_date || report.created_at
    }));

    const newsItems = (newsRows || []).map((news) => ({
      type: 'news',
      title: news.title,
      category: news.category || 'INFORMASI',
      body: news.body || '',
      image_url: news.image_url || 'https://via.placeholder.com/900x600/FFEB3B/1A237E?text=RO+SDM+BALI',
      date: news.published_at || news.created_at
    }));

    const combined = filterActive ? reportItems : [...reportItems, ...newsItems];

    const sorted = combined
      .filter((item) => item.title)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 20);

    window.__lastRenderedItems = sorted;

    if (!sorted.length) {
      grid.innerHTML = emptyCard(filterActive ? 'Tidak ada laporan sesuai filter.' : 'Belum ada berita atau laporan.');
      return;
    }

    grid.innerHTML = sorted.map((item, i) => `
      <article data-report-index="${i}" class="card-soft card-hover overflow-hidden cursor-pointer">
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

  function renderWeeklyReportsChart(reportRows = []) {
    const canvas = $('reportsChart');
    const summary = $('reportsChartSummary');

    if (!canvas) return;

    if (!window.Chart) {
      console.warn('Chart.js belum dimuat. Pastikan script Chart.js ada sebelum public.js.');
      return;
    }

    const chartRows = getFilteredReports(reportRows, { defaultLastSevenDays: true })
      .filter((report) => normalizeText(report.polres_name) && normalizeText(report.polres_name) !== 'BIRO SDM');

    const counts = {};
    polresForChart.forEach((name) => {
      counts[name] = 0;
    });

    chartRows.forEach((report) => {
      const polres = normalizeText(report.polres_name);
      if (counts[polres] !== undefined) {
        counts[polres] += 1;
      }
    });

    const labels = polresForChart;
    const totalReports = labels.reduce((sum, name) => sum + (counts[name] || 0), 0);

    const percentages = labels.map((name) => {
      if (!totalReports) return 0;
      return Number(((counts[name] / totalReports) * 100).toFixed(1));
    });

    if (reportsChartInstance) {
      reportsChartInstance.destroy();
    }

    reportsChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Persentase Laporan',
            data: percentages,
            backgroundColor: '#d4af37',
            borderColor: '#1A237E',
            borderWidth: 1,
            borderRadius: 8,
            maxBarThickness: 42
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 8,
            right: 8,
            bottom: 0,
            left: 8
          }
        },
        plugins: {
          legend: {
            display: true
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const index = ctx.dataIndex;
                const polres = labels[index];
                const jumlah = counts[polres] || 0;
                const persen = percentages[index] || 0;
                return ` ${persen}% (${jumlah} laporan)`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              font: {
                size: 9,
                weight: 'bold'
              }
            },
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (val) => `${val}%`,
              stepSize: 20
            }
          }
        }
      }
    });

    if (summary) {
      summary.innerHTML = labels.map((name) => {
        const jumlah = counts[name] || 0;
        const persen = totalReports ? Number(((jumlah / totalReports) * 100).toFixed(1)) : 0;

        return `
          <div class="report-summary-item">
            <p class="report-summary-name">${esc(name)}</p>
            <p class="report-summary-count">${jumlah} laporan</p>
            <p class="report-summary-percent">${persen}% dari total laporan</p>
          </div>
        `;
      }).join('');
    }
  }

  function renderGallery(rows) {
    const grid = $('galleryGrid');
    if (!grid) return;

    if (!rows.length) {
      grid.innerHTML = emptyCard('Galeri masih kosong.');
      return;
    }

    grid.innerHTML = rows.map((g) => `
      <article class="card-soft overflow-hidden card-hover">
        ${g.media_type === 'video'
          ? `<div class="h-52 bg-gray-900 flex items-center justify-center text-white"><i class="fa-solid fa-play text-4xl"></i></div>`
          : `<img src="${esc(g.media_url || '')}" alt="${esc(g.title || '')}" class="w-full h-52 object-cover" />`
        }
        <div class="p-6">
          <p class="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2">${esc(g.album || 'Galeri')}</p>
          <h3 class="font-black">${esc(g.title || '')}</h3>
          ${g.media_type === 'video' ? `<a href="${esc(g.media_url || '#')}" target="_blank" rel="noopener" class="text-xs font-black text-amber-700 mt-3 inline-block">Buka Video</a>` : ''}
        </div>
      </article>
    `).join('');
  }

  function renderDocuments(rows) {
    const list = $('documentsList');
    if (!list) return;

    if (!rows.length) {
      list.innerHTML = emptyCard('Belum ada dokumen publik.');
      return;
    }

    list.innerHTML = rows.map((d) => `
      <a href="${esc(d.file_url || '#')}" target="_blank" rel="noopener" class="card-soft card-hover p-6 block">
        <div class="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-5">
          <i class="fa-solid fa-file-pdf"></i>
        </div>
        <p class="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2">${esc(d.category || 'Dokumen')} ${d.year ? esc(d.year) : ''}</p>
        <h3 class="font-black leading-snug">${esc(d.title || '')}</h3>
        <p class="text-xs text-gray-500 font-semibold mt-3 line-clamp-2">${esc(d.description || '')}</p>
      </a>
    `).join('');
  }

  function renderAnnouncements(rows) {
    const grid = $('announcementsGrid');
    if (!grid) return;

    if (!rows.length) {
      grid.innerHTML = emptyCard('Belum ada pengumuman aktif.');
      return;
    }

    grid.innerHTML = rows.map((a) => `
      <article class="card-soft p-6 border-l-4 ${a.is_pinned ? 'border-l-amber-400' : 'border-l-gray-200'}">
        <p class="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2">${a.is_pinned ? 'Prioritas' : 'Pengumuman'}</p>
        <h3 class="text-lg font-black mb-3">${esc(a.title || '')}</h3>
        <p class="text-sm text-gray-500 font-semibold leading-relaxed">${esc(a.body || '')}</p>
        ${a.attachment_url ? `<a href="${esc(a.attachment_url)}" target="_blank" rel="noopener" class="text-xs font-black text-amber-700 mt-4 inline-block">Lihat Lampiran</a>` : ''}
      </article>
    `).join('');
  }

  function emptyCard(message) {
    return `<div class="col-span-full card-soft p-10 text-center text-gray-400 font-black uppercase tracking-widest text-xs">${esc(message)}</div>`;
  }

  function openReportModal(index) {
    const items = window.__lastRenderedItems || [];
    const item = items[index];

    if (!item) return;

    const title = $('modalTitle');
    const meta = $('modalMeta');
    const img = $('modalImage');
    const desc = $('modalDesc');
    const modal = $('reportModal');

    if (!modal || !title || !meta || !desc) return;

    title.textContent = item.title || '-';
    meta.textContent = `${item.category || '-'} • ${formatDate(item.date) || '-'}`;
    desc.textContent = item.body || '-';

    if (img) {
      if (item.image_url) {
        img.src = item.image_url;
        img.classList.remove('hidden');
      } else {
        img.classList.add('hidden');
      }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeReportModal() {
    const modal = $('reportModal');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  function rerenderReportDependentSections() {
    renderNews(state.news, state.reports);
    renderWeeklyReportsChart(state.reports);
  }

  function bindPublicFilters() {
    const ids = [
      'public_filter_polres',
      'public_filter_bag_subbag',
      'public_filter_bag',
      'public_filter_start_date',
      'public_filter_end_date'
    ];

    ids.forEach((id) => {
      $(id)?.addEventListener('change', rerenderReportDependentSections);
    });

    $('public_reset_filter')?.addEventListener('click', () => {
      setValue('public_filter_polres', '');
      setValue('public_filter_bag_subbag', '');
      setValue('public_filter_bag', '');
      setValue('public_filter_start_date', '');
      setValue('public_filter_end_date', '');
      rerenderReportDependentSections();
    });
  }

  function bindReportModal() {
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-report-index]');
      if (card) {
        openReportModal(Number(card.dataset.reportIndex));
      }

      if (e.target.closest('#closeReportModal')) {
        closeReportModal();
      }

      if (e.target.id === 'reportModal') {
        closeReportModal();
      }
    });
  }

  async function loadAll() {
    showLoader(true);

    try {
      const settings = await loadSettings();
      renderSettings(settings);

      const [officers, sections, news, reports, gallery, documents, announcements] = await Promise.all([
        getRows('officers', { eq: [['is_active', true]], order: { column: 'sort_order', ascending: true } }),
        getRows('sections', { eq: [['is_active', true]], order: { column: 'sort_order', ascending: true } }),
        getRows('news', { eq: [['status', 'published']], order: { column: 'published_at', ascending: false }, limit: 20 }),
        getRows('reports', { order: { column: 'created_at', ascending: false }, limit: 300 }),
        getRows('gallery', { eq: [['is_active', true]], order: { column: 'created_at', ascending: false }, limit: 20 }),
        getRows('documents', { eq: [['is_public', true]], order: { column: 'created_at', ascending: false }, limit: 20 }),
        getRows('announcements', { eq: [['status', 'published']], order: { column: 'is_pinned', ascending: false }, limit: 8 })
      ]);

      state.officers = officers;
      state.sections = sections;
      state.news = news;
      state.reports = reports;
      state.gallery = gallery;
      state.documents = documents;
      state.announcements = announcements;

      renderOfficers(state.officers);
      renderSections(state.sections);
      renderNews(state.news, state.reports);
      renderWeeklyReportsChart(state.reports);
      renderGallery(state.gallery);
      renderDocuments(state.documents);
      renderAnnouncements(state.announcements);
    } finally {
      showLoader(false);
    }
  }

  $('mobileBtn')?.addEventListener('click', () => {
    $('mobileMenu')?.classList.toggle('hidden');
  });

  $('refreshBtn')?.addEventListener('click', loadAll);

  bindPublicFilters();
  bindReportModal();
  loadAll();
})();
