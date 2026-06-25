// =============================================
// GASTREN - Gerakan Anti Scabies Pondok Pesantren
// JavaScript Logic — app.js
// Puskesmas Banjarbaru Selatan, Kota Banjarbaru
// =============================================

'use strict';

// ---- CONFIG ----
const SHEET_ID = '1QX6GC-cgkPMTlG99XvdvECD8eAArc6jbPCyeEjhxEAg';
const FORM_URL  = 'https://bit.ly/PELAPORAN_GASTREN';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 menit

// Threshold kasus (untuk warna marker)
const THRESH = { low: 5, high: 10 };

// Daftar pesantren (koordinat GPS presisi)
const PESANTREN = [
    {
        id: 'waratsatul-fuqaha',
        name: 'PP Waratsatul Fuqaha',
        fullName: 'Pondok Pesantren Waratsatul Fuqaha',
        short: 'Waratsatul Fuqaha',
        address: 'Jl. Sumber Ilmu, RT 24 RW 05, Guntung Pinang, Kemuning, Banjarbaru Selatan',
        lat: -3.4741742776795643, lng: 114.82172849505324
    },
    {
        id: 'menara-quran',
        name: 'PP Tahfiz Menara Quran',
        fullName: 'Pondok Pesantren Tahfiz Menara Quran',
        short: 'Menara Quran',
        address: 'Banjarbaru Selatan, Kota Banjarbaru, Kalimantan Selatan',
        lat: -3.4653114038653925, lng: 114.81566696892764
    },
    {
        id: 'mahad-babud',
        name: "PP Mahad Ba'bud",
        fullName: "Pondok Pesantren Mahad Ba'bud",
        short: "Mahad Ba'bud",
        address: 'Banjarbaru Selatan, Kota Banjarbaru, Kalimantan Selatan',
        lat: -3.4459660794911375, lng: 114.81995089505294
    }
];

// Lokasi Puskesmas (koordinat GPS presisi)
const PUSKESMAS = {
    name: 'Puskesmas Banjarbaru Selatan',
    address: 'Jl. Lanan, Kel. Kemuning, Kec. Banjarbaru Selatan, Kota Banjarbaru',
    lat: -3.443597245268018, lng: 114.82978815582179
};

// Warna chart per pesantren (Gold + Blue theme)
const CHART_COLORS = [
    { bg: 'rgba(245, 158, 11,  0.75)', border: '#f59e0b' },  // Gold
    { bg: 'rgba(14,  165, 233, 0.75)', border: '#0ea5e9' },  // Blue
    { bg: 'rgba(139, 92,  246, 0.75)', border: '#8b5cf6' }   // Purple
];

// Nama bulan Indonesia
const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const BULAN_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ---- STATE ----
let map, markersLayer = {};
let barChart, pieChart, genderChart, statusChart;
let allRows = [], filteredRows = [];

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initMap();
    initBackToTop();
    loadData();
    setInterval(loadData, REFRESH_INTERVAL);
});

// =============================================
// NAVBAR
// =============================================
function initNavbar() {
    const navbar   = document.getElementById('navbar');
    const toggle   = document.getElementById('navToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
        // Active link based on scroll
        const sections = ['hero','peta','statistik','pesantren','tentang'];
        let current = 'hero';
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el && window.scrollY >= el.offsetTop - 120) current = id;
        });
        navLinks.forEach(a => {
            a.classList.toggle('active', a.id === `link-${current}`);
        });
    });

    toggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('open');
    });

    // Close mobile menu on link click
    document.querySelectorAll('.mobile-link, .nav-link').forEach(a => {
        a.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });
}

// =============================================
// BACK TO TOP
// =============================================
function initBackToTop() {
    const btn = document.getElementById('backToTop');
    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 400);
    });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// =============================================
// DATA LOADING
// =============================================
async function loadData() {
    try {
        showSyncIcon(true);
        allRows = await fetchSheetData();
        filteredRows = [...allRows];
        const stats = processData(allRows);
        updateHeroStats(stats);
        updateMapMarkers(stats);   // update marker dengan data terbaru
        updateCharts(stats);
        renderPesantrenCards(stats);
        renderTable(filteredRows);
        checkAlerts(stats);
        updateLastUpdate();
    } catch (err) {
        console.error('Gagal memuat data:', err);
        document.getElementById('lastUpdate').textContent = 'Gagal memuat data. Coba refresh.';
        // Tetap tampilkan marker dengan data kosong
        const emptyStats = processData([]);
        updateMapMarkers(emptyStats);
        renderPesantrenCards(emptyStats);
        renderTable([]);
    } finally {
        showSyncIcon(false);
        hideLoading();
    }
}

// =============================================
// FETCH GOOGLE SHEETS DATA (gviz/tq)
// =============================================
async function fetchSheetData() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
    const res  = await fetch(url);
    const text = await res.text();

    // Hapus JSONP wrapper: /*O_o*/ google.visualization.Query.setResponse({...});
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
    if (!match) throw new Error('Format respons tidak dikenali');

    const data = JSON.parse(match[1]);
    if (!data.table || !data.table.rows) return [];

    return data.table.rows
        .map(row => {
            const c = row.c || [];
            return {
                timestamp:       getCellValue(c[0]),
                namaPuskesmas:   getCellValue(c[1]),
                tanggalLaporan:  getCellFormatted(c[2]) || getCellValue(c[2]),
                namaPasien:      getCellValue(c[3]),
                kelas:           getCellValue(c[4]),
                namaPesantren:   getCellValue(c[5]),
                kelurahan:       getCellValue(c[6]),
                jenisKelamin:    getCellValue(c[7]),
                keluhan:         getCellValue(c[8]),
                statusAkhir:     getCellValue(c[9]),
                pengendalian:    getCellValue(c[10]),
                statusPengobatan:getCellValue(c[11])
            };
        })
        .filter(r => r.namaPesantren && r.namaPesantren.trim() !== '');
}

function getCellValue(cell) {
    if (!cell) return '';
    // Handle gviz Date format: "Date(2026,3,14,...)"
    if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
        return cell.f || cell.v;
    }
    return cell.v !== null && cell.v !== undefined ? String(cell.v).trim() : '';
}

function getCellFormatted(cell) {
    return cell?.f ? String(cell.f).trim() : null;
}

// =============================================
// PROCESS DATA
// =============================================
function processData(rows) {
    const stats = {
        totalKasus: rows.length,
        sembuh:     0,
        berobat:    0,
        lakiLaki:   0,
        perempuan:  0,
        keluhanMap: {},      // distribusi keluhan
        perPesantren: {},
        perBulan: {}
    };

    // Init per pesantren
    PESANTREN.forEach(p => {
        stats.perPesantren[p.id] = { total: 0, sembuh: 0, berobat: 0, lakiLaki: 0, perempuan: 0 };
    });

    // Init 6 bulan terakhir
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        stats.perBulan[key] = {};
        PESANTREN.forEach(p => { stats.perBulan[key][p.id] = 0; });
    }

    rows.forEach(row => {
        const pid = matchPesantren(row.namaPesantren);
        const ps  = pid ? stats.perPesantren[pid] : null;

        // Gender
        const gender = (row.jenisKelamin || '').toLowerCase();
        if (gender.includes('laki')) {
            stats.lakiLaki++;
            if (ps) ps.lakiLaki++;
        } else if (gender.includes('perempuan')) {
            stats.perempuan++;
            if (ps) ps.perempuan++;
        }

        // Status
        const statusAkhir      = (row.statusAkhir || '').toLowerCase();
        const statusPengobatan = (row.statusPengobatan || '').toLowerCase();
        if (statusAkhir.includes('sembuh')) {
            stats.sembuh++;
            if (ps) ps.sembuh++;
        }
        if (statusPengobatan.includes('berobat')) {
            stats.berobat++;
            if (ps) ps.berobat++;
        }

        // Keluhan
        const keluhan = (row.keluhan || '').trim();
        if (keluhan) {
            stats.keluhanMap[keluhan] = (stats.keluhanMap[keluhan] || 0) + 1;
        }

        // Total per pesantren
        if (ps) ps.total++;

        // Per bulan
        const tanggal = row.tanggalLaporan || row.timestamp || '';
        const monthKey = parseMonthKey(tanggal);
        if (monthKey && stats.perBulan[monthKey] && pid) {
            stats.perBulan[monthKey][pid]++;
        }
    });

    return stats;
}

function matchPesantren(name) {
    if (!name) return null;
    const n = name.toLowerCase();
    if (n.includes('waratsatul') || n.includes('fuqaha'))  return 'waratsatul-fuqaha';
    if (n.includes('menara') || n.includes('quran') || n.includes('tahfiz')) return 'menara-quran';
    if (n.includes("babud") || n.includes("ba'bud") || n.includes("mahad")) return 'mahad-babud';
    return null;
}

function parseMonthKey(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr);

    // DD/MM/YYYY or D/M/YYYY
    const m1 = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m1) {
        const month = String(parseInt(m1[2])).padStart(2, '0');
        return `${m1[3]}-${month}`;
    }
    // Date(YYYY,M,D,...) — gviz, month is 0-indexed
    const m2 = s.match(/Date\((\d+),(\d+),(\d+)/);
    if (m2) {
        const month = String(parseInt(m2[2]) + 1).padStart(2, '0');
        return `${m2[1]}-${month}`;
    }
    // YYYY-MM-DD
    const m3 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m3) return `${m3[1]}-${m3[2]}`;

    return null;
}

// =============================================
// HERO STATS
// =============================================
function updateHeroStats(stats) {
    animateCounter('statTotal', stats.totalKasus);
    animateCounter('statSembuh', stats.sembuh);
    animateCounter('statBerobat', stats.berobat);
    document.getElementById('statPesantren').textContent = PESANTREN.length;
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const duration = 800;
    const startTime = performance.now();
    const update = (now) => {
        const t = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(start + (target - start) * ease);
        if (t < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
}

// =============================================
// MAP
// =============================================
function initMap() {
    // Titik tengah mencakup 3 pesantren + Puskesmas
    const allLats = [-3.4741742776795643, -3.4653114038653925, -3.4459660794911375, -3.443597245268018];
    const allLngs = [114.82172849505324,  114.81566696892764,  114.81995089505294,  114.82978815582179];
    const centerLat = allLats.reduce((a, b) => a + b, 0) / allLats.length;
    const centerLng = allLngs.reduce((a, b) => a + b, 0) / allLngs.length;

    map = L.map('map', {
        center: [centerLat, centerLng],
        zoom: 13,
        zoomControl: false,
        attributionControl: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // Tambah marker Puskesmas
    const pkIcon = createDivIcon('🏥', 'blue', '', 56);
    L.marker([PUSKESMAS.lat, PUSKESMAS.lng], { icon: pkIcon })
        .addTo(map)
        .bindPopup(`
            <div class="popup-box">
                <div class="popup-title"><i class="fas fa-hospital"></i> ${PUSKESMAS.name}</div>
                <div class="popup-addr"><i class="fas fa-map-pin" style="color:#3b82f6"></i>&nbsp;${PUSKESMAS.address}</div>
                <div class="popup-severity sev-blue" style="background:rgba(59,130,246,0.1);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);">
                    <i class="fas fa-shield-virus"></i> Pusat Koordinasi GASTREN
                </div>
            </div>
        `, { maxWidth: 280 });

    // Tampilkan marker pesantren LANGSUNG (abu-abu) sebelum data diambil
    // Marker akan diperbarui otomatis setelah data dari Google Sheets tersedia
    const defaultStats = processData([]);
    updateMapMarkers(defaultStats);
}

function updateMapMarkers(stats) {
    PESANTREN.forEach(p => {
        // Hapus marker lama
        if (markersLayer[p.id]) {
            map.removeLayer(markersLayer[p.id]);
        }

        const ps = stats.perPesantren[p.id] || { total: 0, sembuh: 0, berobat: 0 };
        const count  = ps.total;
        const color  = getStatusColor(count);
        const sevText = getSeverityText(count);
        const sevClass = getSeverityClass(count);

        const icon = createDivIcon('🕌', color, count, 52);
        const marker = L.marker([p.lat, p.lng], { icon })
            .addTo(map)
            .bindPopup(buildPopup(p, ps, sevText, sevClass), { maxWidth: 300 });

        markersLayer[p.id] = marker;
    });
}

function buildPopup(p, ps, sevText, sevClass) {
    const sembuhPct = ps.total > 0 ? Math.round((ps.sembuh / ps.total) * 100) : 0;
    return `
        <div class="popup-box">
            <div class="popup-title"><i class="fas fa-mosque"></i> ${p.name}</div>
            <div class="popup-addr"><i class="fas fa-map-pin" style="color:#10b981"></i>&nbsp;${p.address}</div>
            <div class="popup-stats">
                <div class="popup-stat">
                    <div class="popup-stat-val">${ps.total}</div>
                    <div class="popup-stat-lbl">Total Kasus</div>
                </div>
                <div class="popup-stat">
                    <div class="popup-stat-val" style="color:#4ade80">${ps.sembuh}</div>
                    <div class="popup-stat-lbl">Sembuh</div>
                </div>
                <div class="popup-stat">
                    <div class="popup-stat-val" style="color:#fcd34d">${ps.berobat}</div>
                    <div class="popup-stat-lbl">Berobat</div>
                </div>
            </div>
            <div class="popup-severity ${sevClass}">
                <i class="fas fa-circle-dot"></i> ${sevText}
                ${ps.total > 0 ? `&nbsp;·&nbsp; ${sembuhPct}% sembuh` : ''}
            </div>
        </div>
    `;
}

function createDivIcon(emoji, color, count, size) {
    const countBadge = (count !== '' && count !== undefined)
        ? `<div class="pm-badge">${count}</div>` : '';
    return L.divIcon({
        className: '',
        html: `<div class="pm-wrap" style="width:${size+4}px;height:${size+16}px">
                   <div class="pm-body pm-${color}" style="width:${size}px;height:${size}px">
                       ${emoji}
                   </div>
                   ${countBadge}
                   <div class="pm-tail pm-${color}"></div>
               </div>`,
        iconSize:   [size + 4, size + 16],
        iconAnchor: [(size + 4) / 2, size + 16],
        popupAnchor:[0, -(size + 12)]
    });
}

function getStatusColor(count) {
    if (count === 0) return 'gray';
    if (count < THRESH.low) return 'green';
    if (count <= THRESH.high) return 'yellow';
    return 'red';
}

function getSeverityText(count) {
    if (count === 0) return 'Belum ada laporan';
    if (count < THRESH.low) return `Rendah — ${count} kasus`;
    if (count <= THRESH.high) return `Sedang — ${count} kasus`;
    return `⚠️ Tinggi — ${count} kasus`;
}

function getSeverityClass(count) {
    if (count === 0) return 'sev-gray';
    if (count < THRESH.low) return 'sev-green';
    if (count <= THRESH.high) return 'sev-yellow';
    return 'sev-red';
}

// =============================================
// CHARTS
// =============================================

// Plugin: Teks tengah untuk doughnut chart
const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
        const opts = chart.options.plugins?.centerText;
        if (!opts) return;
        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        ctx.save();
        // Teks utama (angka besar)
        if (opts.main !== undefined) {
            ctx.font = `bold 2rem Poppins, Inter, sans-serif`;
            ctx.fillStyle = opts.mainColor || '#fcd34d';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(opts.main), cx, cy - 10);
        }
        // Sub-teks (keterangan kecil)
        if (opts.sub) {
            ctx.font = `500 0.68rem Inter, sans-serif`;
            ctx.fillStyle = opts.subColor || '#64748b';
            ctx.fillText(opts.sub, cx, cy + 14);
        }
        ctx.restore();
    }
};
Chart.register(centerTextPlugin);

let keluhanChart = null;

function updateCharts(stats) {
    renderRekapGrid(stats);
    buildBarChart(stats);
    buildPieChart(stats);
    buildGenderChart(stats);
    buildStatusChart(stats);
    buildKeluhanChart(stats);
}

// ── Rekap Grid (Ringkasan Cepat) ──────────────────
function renderRekapGrid(stats) {
    const el = document.getElementById('rekapGrid');
    if (!el) return;
    const totalLaporan = stats.totalKasus;
    const pctSembuh    = totalLaporan > 0 ? Math.round((stats.sembuh / totalLaporan) * 100) : 0;
    const cards = [
        { color: 'gold',   icon: 'fa-viruses',       val: totalLaporan, lbl: 'Total Laporan' },
        { color: 'green',  icon: 'fa-check-circle',  val: stats.sembuh, lbl: 'Sudah Sembuh' },
        { color: 'blue',   icon: 'fa-pills',         val: stats.berobat,lbl: 'Sedang Berobat' },
        { color: 'purple', icon: 'fa-mars',           val: stats.lakiLaki,   lbl: 'Laki-laki' },
        { color: 'pink',   icon: 'fa-venus',          val: stats.perempuan,  lbl: 'Perempuan' },
        { color: 'gold',   icon: 'fa-percent',        val: pctSembuh + '%',  lbl: 'Tingkat Sembuh' },
    ];
    el.innerHTML = cards.map(c => `
        <div class="rekap-card ${c.color}">
            <div class="rekap-icon"><i class="fas ${c.icon}"></i></div>
            <div>
                <div class="rekap-val">${c.val}</div>
                <div class="rekap-lbl">${c.lbl}</div>
            </div>
        </div>
    `).join('');
}

// ── Bar Chart: Tren per Bulan ──────────────────────
function buildBarChart(stats) {
    const ctx = document.getElementById('barChart').getContext('2d');
    const monthKeys = Object.keys(stats.perBulan);
    const labels = monthKeys.map(key => {
        const [y, m] = key.split('-');
        return `${BULAN[parseInt(m) - 1]} '${y.slice(2)}`;
    });

    const datasets = PESANTREN.map((p, i) => ({
        label: p.name,
        data: monthKeys.map(k => stats.perBulan[k][p.id] || 0),
        backgroundColor: CHART_COLORS[i].bg,
        borderColor:     CHART_COLORS[i].border,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
    }));

    if (barChart) barChart.destroy();
    barChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#cbd5e1', font: { family: 'Inter', size: 11 }, padding: 16, boxWidth: 12 }
                },
                tooltip: {
                    ...darkTooltip(),
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.raw} kasus`
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
                    grid:  { color: 'rgba(255,255,255,0.04)' }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11 },
                        stepSize: 1,
                        callback: v => Number.isInteger(v) ? v : null
                    },
                    grid: { color: 'rgba(255,255,255,0.07)' }
                }
            }
        }
    });
}

// ── Pie Chart: Per Pesantren ───────────────────────
function buildPieChart(stats) {
    const ctx   = document.getElementById('pieChart').getContext('2d');
    const data  = PESANTREN.map(p => stats.perPesantren[p.id]?.total || 0);
    const total = data.reduce((a, b) => a + b, 0);
    const hasData = total > 0;

    if (pieChart) pieChart.destroy();
    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: PESANTREN.map(p => p.name),
            datasets: [{
                data: hasData ? data : [1, 1, 1],
                backgroundColor: hasData
                    ? CHART_COLORS.map(c => c.bg)
                    : ['rgba(100,116,139,0.35)','rgba(100,116,139,0.2)','rgba(100,116,139,0.1)'],
                borderColor: 'rgba(6, 13, 31, 0.8)',
                borderWidth: 3, hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#cbd5e1', font: { family: 'Inter', size: 10 }, padding: 10, boxWidth: 10 }
                },
                tooltip: {
                    ...darkTooltip(),
                    callbacks: {
                        label: ctx => {
                            if (!hasData) return ' Belum ada data';
                            const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                            return ` ${ctx.label}: ${ctx.raw} kasus (${pct}%)`;
                        }
                    }
                },
                centerText: {
                    main: hasData ? total : '—',
                    sub: hasData ? 'Total Kasus' : 'Belum ada data',
                    mainColor: '#fcd34d', subColor: '#64748b'
                }
            }
        }
    });
}

// ── Gender Chart ───────────────────────────────────
function buildGenderChart(stats) {
    const ctx  = document.getElementById('genderChart').getContext('2d');
    const laki = stats.lakiLaki, perempuan = stats.perempuan;
    const total = laki + perempuan;
    const hasData = total > 0;
    const pctP = total > 0 ? Math.round((perempuan / total) * 100) : 0;

    if (genderChart) genderChart.destroy();
    genderChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Laki-laki', 'Perempuan'],
            datasets: [{
                data: hasData ? [laki, perempuan] : [1, 1],
                backgroundColor: hasData
                    ? ['rgba(99,102,241,0.8)', 'rgba(244,114,182,0.8)']
                    : ['rgba(100,116,139,0.3)', 'rgba(100,116,139,0.15)'],
                borderColor: 'rgba(6,13,31,0.8)',
                borderWidth: 3, hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#cbd5e1', font: { family: 'Inter', size: 11 }, padding: 14, boxWidth: 12 }
                },
                tooltip: {
                    ...darkTooltip(),
                    callbacks: {
                        label: ctx => {
                            if (!hasData) return ' Belum ada data';
                            const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                            return ` ${ctx.label}: ${ctx.raw} orang (${pct}%)`;
                        }
                    }
                },
                centerText: {
                    main: hasData ? `${pctP}%` : '—',
                    sub: hasData ? 'Perempuan' : 'Belum ada data',
                    mainColor: '#f9a8d4', subColor: '#64748b'
                }
            }
        }
    });
}

// ── Status Chart ───────────────────────────────────
function buildStatusChart(stats) {
    const ctx     = document.getElementById('statusChart').getContext('2d');
    const sembuh  = stats.sembuh;
    const berobat = stats.berobat;
    const lainnya = Math.max(0, stats.totalKasus - sembuh - berobat);
    const total   = stats.totalKasus;
    const hasData = total > 0;
    const pctSembuh = total > 0 ? Math.round((sembuh / total) * 100) : 0;

    if (statusChart) statusChart.destroy();
    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Sembuh', 'Berobat', 'Lainnya'],
            datasets: [{
                data: hasData ? [sembuh, berobat, lainnya].map(v => v || 0) : [1, 1, 1],
                backgroundColor: hasData
                    ? ['rgba(34,197,94,0.8)', 'rgba(14,165,233,0.8)', 'rgba(100,116,139,0.5)']
                    : ['rgba(100,116,139,0.3)','rgba(100,116,139,0.2)','rgba(100,116,139,0.1)'],
                borderColor: 'rgba(6,13,31,0.8)',
                borderWidth: 3, hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#cbd5e1', font: { family: 'Inter', size: 11 }, padding: 14, boxWidth: 12 }
                },
                tooltip: {
                    ...darkTooltip(),
                    callbacks: {
                        label: ctx => {
                            if (!hasData) return ' Belum ada data';
                            const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                            return ` ${ctx.label}: ${ctx.raw} orang (${pct}%)`;
                        }
                    }
                },
                centerText: {
                    main: hasData ? `${pctSembuh}%` : '—',
                    sub: hasData ? 'Tingkat Sembuh' : 'Belum ada data',
                    mainColor: '#4ade80', subColor: '#64748b'
                }
            }
        }
    });
}

// ── Keluhan Chart (Horizontal Bar) ────────────────
function buildKeluhanChart(stats) {
    const wrap  = document.getElementById('keluhanWrap');
    const empty = document.getElementById('keluhanEmpty');
    const ctx   = document.getElementById('keluhanChart').getContext('2d');

    const keluhanMap = stats.keluhanMap || {};
    const entries = Object.entries(keluhanMap)
        .sort((a, b) => b[1] - a[1]);       // urutkan dari terbanyak

    if (entries.length === 0) {
        wrap.style.display  = 'none';
        empty.style.display = 'block';
        return;
    }
    wrap.style.display  = 'block';
    empty.style.display = 'none';

    const labels = entries.map(([k]) => k);
    const data   = entries.map(([, v]) => v);
    const maxVal = Math.max(...data);

    const bgColors = data.map(v => {
        const ratio = v / maxVal;
        if (ratio >= 0.8) return 'rgba(239,68,68,0.75)';
        if (ratio >= 0.5) return 'rgba(245,158,11,0.75)';
        return 'rgba(14,165,233,0.75)';
    });

    if (keluhanChart) keluhanChart.destroy();
    keluhanChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Jumlah Kasus',
                data,
                backgroundColor: bgColors,
                borderColor: bgColors.map(c => c.replace('0.75', '1')),
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',          // horizontal bar
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...darkTooltip(),
                    callbacks: {
                        label: ctx => ` ${ctx.raw} kasus`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#94a3b8', font: { family: 'Inter', size: 11 },
                        stepSize: 1,
                        callback: v => Number.isInteger(v) ? v : null
                    },
                    grid: { color: 'rgba(255,255,255,0.06)' }
                },
                y: {
                    ticks: { color: '#cbd5e1', font: { family: 'Inter', size: 12 } },
                    grid: { display: false }
                }
            }
        }
    });
}

function darkTooltip() {
    return {
        backgroundColor: 'rgba(4,11,24,0.97)',
        titleColor:  '#fcd34d',
        bodyColor:   '#cbd5e1',
        borderColor: 'rgba(245,158,11,0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        titleFont: { family: 'Poppins', weight: 'bold' },
        bodyFont:  { family: 'Inter' }
    };
}

// =============================================
// PESANTREN CARDS
// =============================================
function renderPesantrenCards(stats) {
    const container = document.getElementById('pesantrenCards');
    container.innerHTML = '';

    PESANTREN.forEach(p => {
        const ps = stats.perPesantren[p.id] || { total: 0, sembuh: 0, berobat: 0 };
        const color     = getStatusColor(ps.total);
        const sevText   = getSeverityText(ps.total);
        const sembuhPct = ps.total > 0 ? Math.round((ps.sembuh / ps.total) * 100) : 0;

        const card = document.createElement('div');
        card.className = 'pesantren-card';
        card.innerHTML = `
            <div class="pc-header">
                <div class="pc-status-badge ${color}">
                    <i class="fas fa-circle" style="font-size:7px"></i>
                    ${sevText}
                </div>
                <div class="pc-name">${p.fullName}</div>
                <div class="pc-addr">
                    <i class="fas fa-map-pin"></i>
                    <span>${p.address}</span>
                </div>
            </div>
            <div class="pc-body">
                <div class="pc-stats-row">
                    <div class="pc-stat total">
                        <div class="pc-stat-val">${ps.total}</div>
                        <div class="pc-stat-lbl">Total Kasus</div>
                    </div>
                    <div class="pc-stat sembuh">
                        <div class="pc-stat-val">${ps.sembuh}</div>
                        <div class="pc-stat-lbl">Sembuh</div>
                    </div>
                    <div class="pc-stat berobat">
                        <div class="pc-stat-val">${ps.berobat}</div>
                        <div class="pc-stat-lbl">Berobat</div>
                    </div>
                </div>
                <div class="pc-progress">
                    <div class="pc-progress-bar" style="width:${sembuhPct}%"></div>
                </div>
                <div class="pc-progress-label">
                    <i class="fas fa-check-circle" style="color:#22c55e"></i>
                    ${sembuhPct}% tingkat kesembuhan
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// =============================================
// TABLE
// =============================================
function renderTable(rows) {
    const tbody = document.getElementById('tableBody');
    const countEl = document.getElementById('tableCount');
    const footerEl = document.getElementById('tableFooter');

    countEl.textContent = rows.length;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><i class="fas fa-inbox"></i>&nbsp; Tidak ada data yang cocok</td></tr>`;
        footerEl.textContent = '';
        return;
    }

    const sortedRows = [...rows].reverse(); // Tampilkan terbaru di atas

    tbody.innerHTML = sortedRows.map((r, i) => {
        const statusAkhirBadge    = buildStatusBadge(r.statusAkhir, 'akhir');
        const statusPengobatanBadge = buildStatusBadge(r.statusPengobatan, 'pengobatan');
        const tanggal = formatTanggal(r.tanggalLaporan || r.timestamp);
        const pesantrenShort = getPesantrenShort(r.namaPesantren);
        const genderIcon = getGenderIcon(r.jenisKelamin);

        return `
            <tr>
                <td style="color:#64748b;font-size:0.78rem;font-weight:600">${i + 1}</td>
                <td style="white-space:nowrap;color:#94a3b8;font-size:0.82rem">${tanggal}</td>
                <td><span class="pesantren-tag" title="${r.namaPesantren}">${pesantrenShort}</span></td>
                <td style="color:#94a3b8">${r.kelas || '-'}</td>
                <td>${genderIcon} <span style="color:#94a3b8;font-size:0.82rem">${r.jenisKelamin || '-'}</span></td>
                <td style="color:#94a3b8;font-size:0.82rem">${r.keluhan || '-'}</td>
                <td>${statusAkhirBadge}</td>
                <td>${statusPengobatanBadge}</td>
            </tr>
        `;
    }).join('');

    footerEl.textContent = `Menampilkan ${rows.length} dari ${allRows.length} laporan · Data diperbarui otomatis`;

    // Setup filter & search
    setupTableFilter();
}

function buildStatusBadge(status, type) {
    if (!status) return `<span class="status-chip status-default">—</span>`;
    const s = status.toLowerCase();
    if (s.includes('sembuh'))  return `<span class="status-chip status-sembuh"><i class="fas fa-check-circle"></i> Sembuh</span>`;
    if (s.includes('berobat')) return `<span class="status-chip status-berobat"><i class="fas fa-pills"></i> Berobat</span>`;
    return `<span class="status-chip status-default">${status}</span>`;
}

function getGenderIcon(gender) {
    if (!gender) return '';
    const g = gender.toLowerCase();
    if (g.includes('laki')) return `<i class="fas fa-mars" style="color:#818cf8"></i>`;
    if (g.includes('perempuan')) return `<i class="fas fa-venus" style="color:#f472b6"></i>`;
    return `<i class="fas fa-genderless" style="color:#94a3b8"></i>`;
}

function getPesantrenShort(name) {
    if (!name) return 'Unknown';
    const n = name.toLowerCase();
    if (n.includes('waratsatul') || n.includes('fuqaha')) return 'PP Waratsatul Fuqaha';
    if (n.includes('menara') || n.includes('quran'))      return 'PP Tahfiz Menara Quran';
    if (n.includes("babud") || n.includes("mahad"))       return "PP Mahad Ba'bud";
    return name.length > 25 ? name.substring(0, 25) + '…' : name;
}

function formatTanggal(dateStr) {
    if (!dateStr) return '-';
    const s = String(dateStr);
    // DD/MM/YYYY → Hari DD Bulan YYYY
    const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
        return `${String(m[1]).padStart(2, '0')} ${BULAN[parseInt(m[2]) - 1]} ${m[3]}`;
    }
    // Sudah terformat
    return s.length > 12 ? s.substring(0, 12) : s;
}

function setupTableFilter() {
    const searchEl  = document.getElementById('tableSearch');
    const filterP   = document.getElementById('filterPesantren');
    const filterS   = document.getElementById('filterStatus');

    const applyFilter = () => {
        const q  = (searchEl.value || '').toLowerCase();
        const fp = (filterP.value || '').toLowerCase();
        const fs = (filterS.value || '').toLowerCase();

        filteredRows = allRows.filter(r => {
            const pesantren = (r.namaPesantren || '').toLowerCase();
            const statusA   = (r.statusAkhir || '').toLowerCase();
            const statusP   = (r.statusPengobatan || '').toLowerCase();
            const keluhan   = (r.keluhan || '').toLowerCase();

            const matchQ  = !q  || pesantren.includes(q) || statusA.includes(q) || statusP.includes(q) || keluhan.includes(q);
            const matchFP = !fp || pesantren.includes(fp);
            const matchFS = !fs || statusA.includes(fs) || statusP.includes(fs);
            return matchQ && matchFP && matchFS;
        });
        renderTable(filteredRows);
        // Don't re-call setupTableFilter (avoid infinite loop)
        attachFilterListeners();
    };

    const attachFilterListeners = () => {
        searchEl.removeEventListener('input', applyFilter);
        filterP.removeEventListener('change', applyFilter);
        filterS.removeEventListener('change', applyFilter);
        searchEl.addEventListener('input', applyFilter);
        filterP.addEventListener('change', applyFilter);
        filterS.addEventListener('change', applyFilter);
    };

    attachFilterListeners();
}

// =============================================
// ALERTS
// =============================================
function checkAlerts(stats) {
    const highCases = PESANTREN.filter(p => {
        return (stats.perPesantren[p.id]?.total || 0) > THRESH.high;
    });
    const banner = document.getElementById('alertBanner');
    const text   = document.getElementById('alertText');

    if (highCases.length > 0) {
        const names = highCases.map(p => p.name).join(', ');
        text.textContent = `⚠️ Kasus scabies TINGGI terdeteksi di: ${names}. Segera ambil tindakan!`;
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
}

// =============================================
// UI HELPERS
// =============================================
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => overlay.remove(), 600);
    }
}

function showSyncIcon(show) {
    const icon = document.getElementById('syncIcon');
    if (icon) icon.style.display = show ? 'inline-block' : 'none';
}

function updateLastUpdate() {
    const el = document.getElementById('lastUpdate');
    if (!el) return;
    const now = new Date();
    const jam   = String(now.getHours()).padStart(2, '0');
    const menit = String(now.getMinutes()).padStart(2, '0');
    const tgl   = now.getDate();
    const bln   = BULAN_FULL[now.getMonth()];
    const thn   = now.getFullYear();
    el.textContent = `Terakhir diperbarui: ${tgl} ${bln} ${thn} pukul ${jam}:${menit} WITA`;
}
