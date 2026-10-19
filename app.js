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

    // OpenStreetMap — bekerja sempurna di GitHub Pages
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
    // buildGenderChart dihapus — pesantren khusus santri laki-laki
    buildStatusChart(stats);
    buildKeluhanChart(stats);
    buildTrendChart(stats);
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
        { color: 'gold',   icon: 'fa-percent',       val: pctSembuh + '%', lbl: 'Tingkat Sembuh' },
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
        // encode data row untuk dikirim ke modal
        const rowIdx = allRows.length - 1 - i; // index di allRows (reversed)

        return `
            <tr class="table-row-clickable" onclick="bukaModal(${allRows.length - 1 - i})" title="Klik untuk detail">
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
    const filterB   = document.getElementById('filterBulan'); // filter bulan baru

    const applyFilter = () => {
        const q  = (searchEl.value || '').toLowerCase();
        const fp = (filterP.value || '').toLowerCase();
        const fs = (filterS.value || '').toLowerCase();
        const fb = filterB ? (filterB.value || '') : ''; // nilai bulan (mis. "06")

        filteredRows = allRows.filter(r => {
            const pesantren = (r.namaPesantren || '').toLowerCase();
            const statusA   = (r.statusAkhir || '').toLowerCase();
            const statusP   = (r.statusPengobatan || '').toLowerCase();
            const keluhan   = (r.keluhan || '').toLowerCase();
            const kelas     = (r.kelas || '').toLowerCase();

            // Cocokkan bulan dari tanggalLaporan
            let matchFB = true;
            if (fb) {
                const monthKey = parseMonthKey(r.tanggalLaporan || r.timestamp || '');
                matchFB = monthKey ? monthKey.endsWith('-' + fb) : false;
            }

            const matchQ  = !q  || pesantren.includes(q) || statusA.includes(q) ||
                            statusP.includes(q) || keluhan.includes(q) || kelas.includes(q);
            const matchFP = !fp || pesantren.includes(fp);
            const matchFS = !fs || statusA.includes(fs) || statusP.includes(fs);
            return matchQ && matchFP && matchFS && matchFB;
        });
        renderTable(filteredRows);
        attachFilterListeners();
    };

    const attachFilterListeners = () => {
        searchEl.removeEventListener('input', applyFilter);
        filterP.removeEventListener('change', applyFilter);
        filterS.removeEventListener('change', applyFilter);
        if (filterB) filterB.removeEventListener('change', applyFilter);

        searchEl.addEventListener('input', applyFilter);
        filterP.addEventListener('change', applyFilter);
        filterS.addEventListener('change', applyFilter);
        if (filterB) filterB.addEventListener('change', applyFilter);
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

// =============================================
// MODAL DETAIL SANTRI
// =============================================
function bukaModal(rowIndex) {
    const r = allRows[rowIndex];
    if (!r) return;

    const tanggal = formatTanggal(r.tanggalLaporan || r.timestamp);
    const genderIcon = getGenderIcon(r.jenisKelamin);
    const statusAkhirBadge = buildStatusBadge(r.statusAkhir, 'akhir');
    const statusPengobatanBadge = buildStatusBadge(r.statusPengobatan, 'pengobatan');
    const sembuh = (r.statusAkhir || '').toLowerCase().includes('sembuh');

    document.getElementById('modalBody').innerHTML = `
        <div class="modal-status-bar ${sembuh ? 'sembuh' : 'berobat'}">
            ${sembuh
                ? '<i class="fas fa-check-circle"></i> Pasien Sudah Sembuh'
                : '<i class="fas fa-procedures"></i> Masih Dalam Pengobatan'}
        </div>
        <div class="modal-info-grid">
            <div class="modal-info-item">
                <div class="modal-info-label"><i class="fas fa-calendar-alt"></i> Tanggal Laporan</div>
                <div class="modal-info-value">${tanggal}</div>
            </div>
            <div class="modal-info-item">
                <div class="modal-info-label"><i class="fas fa-mosque"></i> Pondok Pesantren</div>
                <div class="modal-info-value">${r.namaPesantren || '-'}</div>
            </div>
            <div class="modal-info-item">
                <div class="modal-info-label">${genderIcon} Jenis Kelamin</div>
                <div class="modal-info-value">${r.jenisKelamin || '-'}</div>
            </div>
            <div class="modal-info-item">
                <div class="modal-info-label"><i class="fas fa-graduation-cap"></i> Kelas / Tingkat</div>
                <div class="modal-info-value">${r.kelas || '-'}</div>
            </div>
            <div class="modal-info-item modal-info-full">
                <div class="modal-info-label"><i class="fas fa-stethoscope"></i> Keluhan / Gejala</div>
                <div class="modal-info-value">${r.keluhan || '-'}</div>
            </div>
            <div class="modal-info-item">
                <div class="modal-info-label"><i class="fas fa-notes-medical"></i> Status Akhir</div>
                <div class="modal-info-value">${statusAkhirBadge}</div>
            </div>
            <div class="modal-info-item">
                <div class="modal-info-label"><i class="fas fa-pills"></i> Status Pengobatan</div>
                <div class="modal-info-value">${statusPengobatanBadge}</div>
            </div>
            ${r.pengendalian ? `
            <div class="modal-info-item modal-info-full">
                <div class="modal-info-label"><i class="fas fa-shield-alt"></i> Pengendalian</div>
                <div class="modal-info-value">${r.pengendalian}</div>
            </div>` : ''}
            ${r.kelurahan ? `
            <div class="modal-info-item">
                <div class="modal-info-label"><i class="fas fa-map-marker-alt"></i> Kelurahan</div>
                <div class="modal-info-value">${r.kelurahan}</div>
            </div>` : ''}
        </div>
        <div class="modal-privacy-note">
            <i class="fas fa-lock"></i>
            Data nama pasien tidak ditampilkan untuk menjaga privasi sesuai regulasi kesehatan.
        </div>
    `;

    const overlay = document.getElementById('modalOverlay');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function tutupModal(e) {
    if (e && e.target !== document.getElementById('modalOverlay') &&
        !e.target.closest('.modal-close')) return;
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

// Tutup modal dengan tombol Escape
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') tutupModal({target: document.getElementById('modalOverlay')});
});

// =============================================
// CETAK / PRINT LAPORAN
// =============================================
function cetakLaporan() {
    const now = new Date();
    const tgl = `${now.getDate()} ${BULAN_FULL[now.getMonth()]} ${now.getFullYear()}`;
    const jam = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WITA`;

    // Kumpulkan data yang sedang ditampilkan (filteredRows)
    const rows = [...filteredRows].reverse();
    const totalKasus = rows.length;
    const sembuh  = rows.filter(r => (r.statusAkhir||'').toLowerCase().includes('sembuh')).length;
    const berobat = rows.filter(r => (r.statusPengobatan||'').toLowerCase().includes('berobat')).length;
    const pct = totalKasus > 0 ? Math.round((sembuh/totalKasus)*100) : 0;

    const tableRows = rows.map((r, i) => {
        const tgl = formatTanggal(r.tanggalLaporan || r.timestamp);
        const ps  = getPesantrenShort(r.namaPesantren);
        const statusA = (r.statusAkhir||'').toLowerCase().includes('sembuh') ? '✓ Sembuh' : (r.statusAkhir || '-');
        const statusP = (r.statusPengobatan||'').toLowerCase().includes('berobat') ? 'Berobat' : (r.statusPengobatan || '-');
        return `<tr>
            <td>${i+1}</td>
            <td>${tgl}</td>
            <td>${ps}</td>
            <td>${r.kelas||'-'}</td>
            <td>${r.jenisKelamin||'-'}</td>
            <td>${r.keluhan||'-'}</td>
            <td>${statusA}</td>
            <td>${statusP}</td>
        </tr>`;
    }).join('');

    const win = window.open('', '_blank', 'width=1000,height=700');
    win.document.write(`<!DOCTYPE html><html lang="id"><head>
        <meta charset="UTF-8">
        <title>Laporan GASTREN — ${tgl}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; background: #fff; }
            .kop { display:flex; align-items:center; border-bottom: 4px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
            .kop-text { flex:1; text-align:center; }
            .kop-text h1 { font-size: 14pt; font-weight: bold; letter-spacing: 1px; }
            .kop-text h2 { font-size: 18pt; font-weight: bold; text-transform:uppercase; }
            .kop-text p  { font-size: 10pt; }
            .judul { text-align:center; margin: 12px 0 4px; }
            .judul h3 { font-size: 13pt; font-weight:bold; text-decoration:underline; text-transform:uppercase; }
            .periode { text-align:center; font-size:10pt; margin-bottom:14px; color:#333; font-style:italic; }
            .ringkasan { display:flex; gap:16px; margin-bottom:16px; }
            .ring-box { flex:1; border:1px solid #000; padding:8px; text-align:center; }
            .ring-box .val { font-size:20pt; font-weight:bold; }
            .ring-box .lbl { font-size:9pt; }
            table { width:100%; border-collapse:collapse; margin-bottom:20px; font-size:10pt; }
            th { background:#1a1a2e; color:#fff; padding:6px 4px; text-align:center; border:1px solid #000; }
            td { padding:5px 4px; border:1px solid #ccc; }
            tr:nth-child(even) td { background:#f5f5f5; }
            .footer-sign { display:flex; justify-content:space-between; margin-top:40px; }
            .sign-box { text-align:center; width:240px; }
            .sign-box .sign-line { border-top:1px solid #000; margin-top:60px; padding-top:4px; }
            .sign-box .sign-name { font-weight:bold; }
            .sign-box .sign-nip  { font-size:9pt; }
            @media print {
                body { margin: 1cm 1.5cm; }
                .no-print { display:none; }
            }
        </style>
    </head><body>
        <div class="no-print" style="background:#f59e0b;color:#000;padding:8px 16px;font-family:sans-serif;font-size:12px">
            ⚠️ Tekan <strong>Ctrl+P</strong> (atau <strong>⌘P</strong> di Mac) untuk cetak / simpan PDF
        </div>
        <div style="padding:20px">
        <div class="kop">
            <div class="kop-text">
                <p>PEMERINTAH KOTA BANJARBARU</p>
                <p>DINAS KESEHATAN</p>
                <h2>PUSKESMAS BANJARBARU SELATAN</h2>
                <p>Jalan Rambai No.1 Telp.(0511) 4772381 Banjarbaru Kode Pos. 70713</p>
            </div>
        </div>
        <div class="judul">
            <h3>LAPORAN PROGRAM GASTREN</h3>
            <p style="font-size:11pt;font-style:italic">(Gerakan Anti Scabies Pondok Pesantren)</p>
        </div>
        <div class="periode">Tanggal Cetak: ${tgl} Pukul ${jam} &nbsp;|&nbsp; Total data ditampilkan: ${totalKasus} kasus</div>
        <div class="ringkasan">
            <div class="ring-box"><div class="val">${totalKasus}</div><div class="lbl">Total Kasus</div></div>
            <div class="ring-box"><div class="val">${sembuh}</div><div class="lbl">Sembuh</div></div>
            <div class="ring-box"><div class="val">${berobat}</div><div class="lbl">Berobat</div></div>
            <div class="ring-box"><div class="val">${pct}%</div><div class="lbl">Tingkat Sembuh</div></div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>No</th><th>Tanggal</th><th>Pondok Pesantren</th>
                    <th>Kelas</th><th>JK</th><th>Keluhan</th>
                    <th>Status Akhir</th><th>Pengobatan</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
        <div class="footer-sign">
            <div class="sign-box">
                <p>Mengetahui,</p>
                <p>Penanggung Jawab Program</p>
                <div class="sign-line">
                    <p class="sign-name">Sri Minarni, SKM</p>
                    <p class="sign-nip">NIP. 19790315 200604 2 023</p>
                </div>
            </div>
            <div class="sign-box">
                <p>Banjarbaru, ${tgl}</p>
                <p>Kepala Puskesmas Banjarbaru Selatan</p>
                <div class="sign-line">
                    <p class="sign-name">dr. Hernita Indriani</p>
                    <p class="sign-nip">NIP. 19851001 201402 2 005</p>
                </div>
            </div>
        </div>
        </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 800);
}

// =============================================
// GRAFIK TREN PENYEMBUHAN BULANAN (LINE CHART)
// =============================================
let trendChart = null;

function buildTrendChart(stats) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    const monthKeys = Object.keys(stats.perBulan).sort();
    const labels = monthKeys.map(key => {
        const [y, m] = key.split('-');
        return `${BULAN[parseInt(m) - 1]} '${y.slice(2)}`;
    });

    // Hitung jumlah sembuh dan total per bulan dari allRows
    const sembuhPerBulan  = {};
    const totalPerBulan   = {};
    monthKeys.forEach(k => { sembuhPerBulan[k] = 0; totalPerBulan[k] = 0; });

    allRows.forEach(r => {
        const key = parseMonthKey(r.tanggalLaporan || r.timestamp || '');
        if (!key || !totalPerBulan.hasOwnProperty(key)) return;
        totalPerBulan[key]++;
        if ((r.statusAkhir || '').toLowerCase().includes('sembuh')) sembuhPerBulan[key]++;
    });

    const pctSembuh = monthKeys.map(k => {
        const total = totalPerBulan[k];
        return total > 0 ? Math.round((sembuhPerBulan[k] / total) * 100) : 0;
    });

    const totalData   = monthKeys.map(k => totalPerBulan[k]);
    const sembuhData  = monthKeys.map(k => sembuhPerBulan[k]);

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Total Kasus',
                    data: totalData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.12)',
                    borderWidth: 2.5,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#f59e0b',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'yKasus'
                },
                {
                    label: 'Sudah Sembuh',
                    data: sembuhData,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    borderWidth: 2.5,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#22c55e',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'yKasus'
                },
                {
                    label: '% Penyembuhan',
                    data: pctSembuh,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [6, 3],
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#0ea5e9',
                    tension: 0.4,
                    yAxisID: 'yPct'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    labels: { color: '#cbd5e1', font: { family: 'Inter', size: 11 }, padding: 16, boxWidth: 12 }
                },
                tooltip: {
                    ...darkTooltip(),
                    callbacks: {
                        label: ctx => {
                            if (ctx.dataset.label === '% Penyembuhan') return ` Tingkat Sembuh: ${ctx.raw}%`;
                            return ` ${ctx.dataset.label}: ${ctx.raw} orang`;
                        }
                    }
                }
            },
            scales: {
                yKasus: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    ticks: {
                        color: '#94a3b8', font: { family: 'Inter', size: 11 },
                        stepSize: 1, callback: v => Number.isInteger(v) ? v : null
                    },
                    grid: { color: 'rgba(255,255,255,0.07)' },
                    title: { display: true, text: 'Jumlah Kasus', color: '#64748b', font: { size: 10 } }
                },
                yPct: {
                    type: 'linear',
                    position: 'right',
                    min: 0, max: 100,
                    ticks: {
                        color: '#0ea5e9', font: { family: 'Inter', size: 11 },
                        callback: v => v + '%'
                    },
                    grid: { display: false },
                    title: { display: true, text: '% Sembuh', color: '#0ea5e9', font: { size: 10 } }
                },
                x: {
                    ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
                    grid:  { color: 'rgba(255,255,255,0.04)' }
                }
            }
        }
    });
}

