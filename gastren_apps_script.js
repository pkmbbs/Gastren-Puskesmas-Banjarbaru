/**
 * ================================================================
 * GASTREN — Google Apps Script  |  Versi Optimized (Batch)
 * Gerakan Anti Scabies Pondok Pesantren
 * Puskesmas Banjarbaru Selatan
 * ================================================================
 * CARA PAKAI:
 * 1. Buka spreadsheet → klik menu "Extensions" → "Apps Script"
 * 2. Hapus semua kode yang ada, paste seluruh kode ini
 * 3. Klik 💾 Save (Ctrl+S)
 * 4. Pilih fungsi "pasangTrigger" → klik ▶ Run
 * 5. Izinkan akses → klik "Allow"
 * 6. Selesai! Laporan otomatis update setiap ada form baru masuk.
 * ================================================================
 */

// ── KONFIGURASI ──────────────────────────────────────────────────
const CFG = {
  SHEET_DATA:    'Form Responses 1',
  SHEET_REKAP:   'Rekap Bulanan',
  SHEET_DIAGRAM: 'Diagram',
};

// ── Pejabat Penandatangan ────────────────────────────────────────
const PEJABAT = {
  pjProgram: {
    jabatan: 'Penanggung Jawab Program',
    nama:    'Sri Minarni, SKM',
    nip:     'NIP. 19790315 200604 2 023',
  },
  kepalaPkm: {
    jabatan: 'Kepala Puskesmas Banjarbaru Selatan',
    nama:    'dr. Hernita Indriani',
    nip:     'NIP. 19851001 201402 2 005',
  },
};

// ── Identitas Instansi ───────────────────────────────────────────
const INSTANSI = {
  pemerintah: 'PEMERINTAH  KOTA  BANJARBARU',
  dinas:      'DINAS KESEHATAN',
  puskesmas:  'PUSKESMAS BANJARBARU SELATAN',
  alamat:     'Jalan Rambai No.1  Telp.(0511) 4772381  Banjarbaru  Kode Pos. 70713',
  // ── ID File Logo dari Google Drive ───────────────────────
  // Salin dari link Drive: drive.google.com/file/d/[ID INI]/view
  logoFileId: '1vYMnHR1MeXnBpdP2R_xvUuVL8ky_WiXq',
};

// ── Daftar Pesantren ─────────────────────────────────────────────
const PESANTREN_LIST = [
  { nama: 'PP Waratsatul Fuqaha',   singkat: 'Waratsatul Fuqaha',  kunci: ['waratsatul','fuqaha'] },
  { nama: 'PP Tahfiz Menara Quran', singkat: 'Menara Quran',       kunci: ['menara','quran','tahfiz'] },
  { nama: "PP Mahad Ba'bud",        singkat: "Mahad Ba'bud",       kunci: ['babud',"ba'bud",'mahad'] },
];

const BULAN_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

// ── Warna Sheet DIAGRAM (dark mode) ─────────────────────────────
const WD = {
  EMAS:'#F59E0B', EMAS_TUA:'#B45309', BIRU:'#0EA5E9', BIRU_TUA:'#0369A1',
  HIJAU:'#22C55E', UNGU:'#8B5CF6', PINK:'#EC4899',
  GELAP2:'#0A1628', GELAP3:'#0F1F3D', HEADER:'#1E3A6E',
  PUTIH:'#FFFFFF', ABU:'#94A3B8',
};

// ── Warna Sheet REKAP (print-ready) ─────────────────────────────
const WP = {
  HITAM:'#000000', PUTIH:'#FFFFFF',
  H_BIRU:'#1E3A6E', H_BIRU2:'#2B5797', H_ABU:'#4A5568',
  ISI_ABU:'#F7FAFC', ISI_ALT:'#EBF4FF',
  GARIS:'#2B5797', TEXT:'#1A202C', TEXT2:'#4A5568',
};

// ================================================================
// MENU SPREADSHEET
// ================================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔄 GASTREN')
    .addItem('📄 Update Rekap Bulanan (Otomatis)',  'runRekapBulanan')
    .addSeparator()
    .addItem('📊 Update Diagram (klik manual)',     'runDiagram')
    .addSeparator()
    .addItem('⚙️  Pasang Trigger Otomatis',         'pasangTrigger')
    .addToUi();
}

// onFormSubmit: HANYA update Rekap (cepat, <2 menit)
// Diagram diklik manual karena 5 grafik bisa >6 menit
function onFormSubmit() { runRekapBulanan(); }

function pasangTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
  // Hanya jalankan Rekap (tidak Diagram agar tidak timeout)
  const data = bacaSemuaData(ss);
  buatRekapBulanan(ss, data);
  SpreadsheetApp.getUi().alert(
    '✅ Berhasil!',
    'Trigger otomatis sudah dipasang.\n\n' +
    'Rekap Bulanan akan update otomatis setiap form baru masuk.\n\n' +
    'Untuk Diagram: klik menu GASTREN → Update Diagram (klik manual).',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function runRekapBulanan() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const data = bacaSemuaData(ss);
  buatRekapBulanan(ss, data);
  ss.toast('✅ Rekap Bulanan diperbarui!', 'GASTREN', 3);
}

function runDiagram() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const data = bacaSemuaData(ss);
  buatDiagram(ss, data);
  ss.toast('✅ Diagram diperbarui!', 'GASTREN', 3);
}

// ================================================================
// BACA DATA
// ================================================================
function bacaSemuaData(ss) {
  let sheet = ss.getSheetByName(CFG.SHEET_DATA)
    || ss.getSheetByName('Sheet1')
    || ss.getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  return rows.slice(1).map(r => ({
    tanggalLaporan:   r[2],
    namaPasien:       String(r[3] || ''),
    namaPesantren:    String(r[5] || ''),
    jenisKelamin:     String(r[7] || ''),
    keluhan:          String(r[8] || ''),
    statusAkhir:      String(r[9] || ''),
    statusPengobatan: String(r[11]|| ''),
  })).filter(r => r.namaPesantren.trim() !== '');
}

// ── Helper: cocokkan pesantren ───────────────────────────────────
function cocokkanPesantren(nama) {
  const n = (nama || '').toLowerCase();
  for (let i = 0; i < PESANTREN_LIST.length; i++) {
    if (PESANTREN_LIST[i].kunci.some(k => n.includes(k))) return i;
  }
  return -1;
}

// ── Helper: parse tanggal ────────────────────────────────────────
function parseBulan(tanggal) {
  let d = null;
  if (tanggal instanceof Date && !isNaN(tanggal)) {
    d = tanggal;
  } else if (typeof tanggal === 'string') {
    const m = tanggal.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  }
  if (!d) return null;
  return { tahun: d.getFullYear(), bulan0: d.getMonth() };
}

// ── Helper: format tanggal Indonesia ────────────────────────────
function tglIndonesia(date) {
  return date.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
}

// ── Helper: border tabel ─────────────────────────────────────────
function borTabel(range, warna) {
  range.setBorder(true,true,true,true,true,true,
    warna||WP.HITAM, SpreadsheetApp.BorderStyle.SOLID);
}
function borTebal(range) {
  range.setBorder(true,true,true,true,false,false,
    WP.HITAM, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

// ── Helper: tulis baris tabel sekaligus (BATCH) ──────────────────
// data      = array of arrays (2D)
// bgs       = 2D array warna background per sel
// fgColors  = 2D array warna teks per sel
// weights   = 2D array 'bold'/'normal' per sel
// aligns    = 2D array 'center'/'left'/'right' per sel
function tulisBatch(sheet, startRow, startCol, data, bgs, fgColors, weights, aligns) {
  if (!data || data.length === 0) return;
  const numRows = data.length;
  const numCols = data[0].length;
  const rng = sheet.getRange(startRow, startCol, numRows, numCols);
  rng.setValues(data);
  if (bgs)      rng.setBackgrounds(bgs);
  if (fgColors) rng.setFontColors(fgColors);
  if (weights)  rng.setFontWeights(weights);
  if (aligns)   rng.setHorizontalAlignments(aligns);
  rng.setFontSize(9).setVerticalAlignment('middle');
}

// ================================================================
// BUAT REKAP BULANAN (PRINT-READY A4) — VERSI BATCH
// ================================================================
function buatRekapBulanan(ss, data) {

  // ── Persiapan sheet ────────────────────────────────────────
  let sheet = ss.getSheetByName(CFG.SHEET_REKAP);
  if (!sheet) sheet = ss.insertSheet(CFG.SHEET_REKAP);
  sheet.clearContents();
  sheet.clearFormats();
  sheet.getCharts().forEach(c => sheet.removeChart(c));
  sheet.setTabColor(WP.H_BIRU);

  // ── Lebar kolom (total ~740px untuk A4 portrait) ───────────
  // [A]=Logo/No [B]=Label [C]=Total [D-F]=3 Pesantren [G-H]=Gender [I]=Sembuh [J]=%
  [90, 150, 55, 85, 85, 80, 55, 65, 55, 55].forEach((w, i) => sheet.setColumnWidth(i+1, w));

  // ── Hitung semua agregat ───────────────────────────────────
  const now             = new Date();
  const totalKasus      = data.length;
  const totalSembuh     = data.filter(r => r.statusAkhir.toLowerCase().includes('sembuh')).length;
  const totalBerobat    = data.filter(r => r.statusPengobatan.toLowerCase().includes('berobat')).length;
  const totalLaki       = data.filter(r => r.jenisKelamin.toLowerCase().includes('laki')).length;
  const totalPerempuan  = data.filter(r => r.jenisKelamin.toLowerCase().includes('perempuan')).length;
  const pctSembuh       = totalKasus > 0 ? Math.round((totalSembuh/totalKasus)*100) : 0;

  const perPP = PESANTREN_LIST.map((_,idx) => {
    const pp = data.filter(r => cocokkanPesantren(r.namaPesantren) === idx);
    return {
      total:     pp.length,
      laki:      pp.filter(r => r.jenisKelamin.toLowerCase().includes('laki')).length,
      perempuan: pp.filter(r => r.jenisKelamin.toLowerCase().includes('perempuan')).length,
      sembuh:    pp.filter(r => r.statusAkhir.toLowerCase().includes('sembuh')).length,
      berobat:   pp.filter(r => r.statusPengobatan.toLowerCase().includes('berobat')).length,
    };
  });

  const perBulan = {};
  data.forEach(r => {
    const pb = parseBulan(r.tanggalLaporan);
    if (!pb) return;
    const key = `${pb.tahun}-${String(pb.bulan0+1).padStart(2,'0')}`;
    if (!perBulan[key]) perBulan[key] = {
      label: `${BULAN_ID[pb.bulan0]} ${pb.tahun}`,
      total:0, sembuh:0, berobat:0, laki:0, perempuan:0, pp:[0,0,0]
    };
    const b = perBulan[key];
    b.total++;
    if (r.jenisKelamin.toLowerCase().includes('laki'))        b.laki++;
    if (r.jenisKelamin.toLowerCase().includes('perempuan'))   b.perempuan++;
    if (r.statusAkhir.toLowerCase().includes('sembuh'))       b.sembuh++;
    if (r.statusPengobatan.toLowerCase().includes('berobat')) b.berobat++;
    const idx = cocokkanPesantren(r.namaPesantren);
    if (idx >= 0) b.pp[idx]++;
  });
  const bulanKeys = Object.keys(perBulan).sort();

  const keluhanMap = {};
  data.forEach(r => { const k=r.keluhan.trim(); if(k) keluhanMap[k]=(keluhanMap[k]||0)+1; });
  const keluhanArr = Object.entries(keluhanMap).sort((a,b)=>b[1]-a[1]);

  let B = 1;

  // ================================================================
  // KOP SURAT
  // ================================================================

  // ── Area kosong kolom A untuk logo (logo disisipkan setelah teks kop) ─
  // Logo tidak pakai formula IMAGE (sering #ERROR),
  // melainkan DriveApp.getFileById() yang langsung baca dari Drive
  sheet.getRange(B, 1, 4, 1).merge()
    .setBackground(WP.PUTIH)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  const KOP_BARIS_LOGO = B; // simpan baris awal kop untuk posisi logo

  // Baris 1: PEMERINTAH KOTA BANJARBARU
  sheet.getRange(B, 2, 1, 9).merge()
    .setValue(INSTANSI.pemerintah)
    .setFontSize(11).setFontWeight('bold').setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setVerticalAlignment('bottom')
    .setFontColor(WP.HITAM).setBackground(WP.PUTIH);
  sheet.setRowHeight(B, 24); B++;

  // Baris 2: DINAS KESEHATAN
  sheet.getRange(B, 2, 1, 9).merge()
    .setValue(INSTANSI.dinas)
    .setFontSize(11).setFontWeight('bold').setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setFontColor(WP.HITAM).setBackground(WP.PUTIH);
  sheet.setRowHeight(B, 22); B++;

  // Baris 3: PUSKESMAS BANJARBARU SELATAN
  sheet.getRange(B, 2, 1, 9).merge()
    .setValue(INSTANSI.puskesmas)
    .setFontSize(16).setFontWeight('bold').setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setFontColor(WP.HITAM).setBackground(WP.PUTIH);
  sheet.setRowHeight(B, 30); B++;

  // Baris 4: Alamat
  sheet.getRange(B, 2, 1, 9).merge()
    .setValue(INSTANSI.alamat)
    .setFontSize(9).setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setVerticalAlignment('top')
    .setFontColor(WP.HITAM).setBackground(WP.PUTIH);
  sheet.setRowHeight(B, 20); B++;

  // Garis tebal + tipis (ganda)
  sheet.getRange(B, 1, 1, 10).merge().setBackground(WP.HITAM);
  sheet.setRowHeight(B, 4); B++;
  sheet.getRange(B, 1, 1, 10).merge().setBackground('#777777');
  sheet.setRowHeight(B, 1); B++;
  sheet.setRowHeight(B, 8); B++;

  // ── Sisipkan Logo via DriveApp (paling andal, langsung baca file Drive) ──
  // DriveApp menggunakan OAuth sehingga tidak perlu URL publik / formula IMAGE
  if (INSTANSI.logoFileId && INSTANSI.logoFileId.length > 5) {
    try {
      const logoBlob = DriveApp.getFileById(INSTANSI.logoFileId).getBlob();
      // insertImage(blob, kolom, baris, offsetX, offsetY)
      // Posisi: kolom 1 (A), di baris kop awal, offset kecil dari tepi
      const logoImg = sheet.insertImage(logoBlob, 1, KOP_BARIS_LOGO, 3, 3);
      // Ukuran logo: 82×82 px (sesuai tinggi kop ~96px)
      logoImg.setWidth(82).setHeight(82);
    } catch(logoErr) {
      // Jika gagal, tampilkan pesan di sel (tidak error fatal)
      sheet.getRange(KOP_BARIS_LOGO, 1, 4, 1)
        .setValue('⚠️\nLogo\ngagal')
        .setFontSize(7).setFontColor('#FF6600')
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
      Logger.log('Logo error: ' + logoErr.toString());
    }
  }

  // ================================================================
  // JUDUL LAPORAN
  // ================================================================
  sheet.getRange(B, 1, 1, 10).merge()
    .setValue('LAPORAN BULANAN PROGRAM GASTREN')
    .setFontSize(13).setFontWeight('bold').setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setFontColor(WP.HITAM).setBackground(WP.PUTIH);
  sheet.setRowHeight(B, 26); B++;

  sheet.getRange(B, 1, 1, 10).merge()
    .setValue('(Gerakan Anti Scabies Pondok Pesantren)')
    .setFontSize(10).setFontStyle('italic').setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setFontColor(WP.TEXT2).setBackground(WP.PUTIH);
  B++;

  sheet.getRange(B-2, 1, 2, 10)
    .setBorder(false,false,true,false,false,false,WP.HITAM,SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setRowHeight(B, 6); B++;

  // Periode & tanggal cetak
  sheet.getRange(B, 1, 1, 5).merge()
    .setValue(`Periode Laporan : ${BULAN_ID[now.getMonth()]} ${now.getFullYear()}`)
    .setFontSize(9.5).setFontFamily('Times New Roman').setFontColor(WP.TEXT).setBackground(WP.PUTIH);
  sheet.getRange(B, 6, 1, 5).merge()
    .setValue(`Tanggal Cetak : ${tglIndonesia(now)}`)
    .setFontSize(9.5).setFontFamily('Times New Roman')
    .setHorizontalAlignment('right').setFontColor(WP.TEXT).setBackground(WP.PUTIH);
  sheet.setRowHeight(B, 20); B++;
  sheet.setRowHeight(B, 8); B++;

  // ================================================================
  // A. RINGKASAN KESELURUHAN
  // ================================================================
  sheet.getRange(B, 1, 1, 10).merge()
    .setValue('A.  RINGKASAN KESELURUHAN')
    .setFontSize(10).setFontWeight('bold').setFontFamily('Times New Roman')
    .setFontColor(WP.PUTIH).setBackground(WP.H_BIRU);
  sheet.setRowHeight(B, 22); B++;

  // Label row (6 kolom)
  const rLabel = [['Total Kasus','Sembuh','Berobat','Laki-laki','Perempuan','Tingkat Sembuh','','','','']];
  const rNilai = [[totalKasus,  totalSembuh, totalBerobat, totalLaki, totalPerempuan, `${pctSembuh}%`,'','','','']];
  const rLabelBg = [Array(10).fill('#3D6096')];
  const rNilaiBg = [['#EBF4FF','#EBF4FF','#EBF4FF','#EBF4FF','#EBF4FF','#EBF4FF',WP.PUTIH,WP.PUTIH,WP.PUTIH,WP.PUTIH]];
  const rLabelFg = [Array(10).fill(WP.PUTIH)];
  const rNilaiFg = [Array(6).fill(WP.H_BIRU).concat(Array(4).fill(WP.PUTIH))];

  sheet.getRange(B, 1, 1, 10).setValues(rLabel).setBackgrounds(rLabelBg)
    .setFontColors(rLabelFg).setFontWeights([Array(10).fill('bold')])
    .setFontSize(8.5).setHorizontalAlignments([Array(10).fill('center')]);
  sheet.setRowHeight(B, 18); B++;

  sheet.getRange(B, 1, 1, 10).setValues(rNilai).setBackgrounds(rNilaiBg)
    .setFontColors(rNilaiFg).setFontWeights([Array(10).fill('bold')])
    .setFontSize(16).setHorizontalAlignments([Array(10).fill('center')]);
  borTabel(sheet.getRange(B-1, 1, 2, 6), WP.GARIS);
  sheet.setRowHeight(B, 34); B++;
  sheet.setRowHeight(B, 8); B++;

  // ================================================================
  // B. REKAP PER BULAN
  // ================================================================
  sheet.getRange(B, 1, 1, 10).merge()
    .setValue('B.  REKAPITULASI KASUS PER BULAN')
    .setFontSize(10).setFontWeight('bold').setFontFamily('Times New Roman')
    .setFontColor(WP.PUTIH).setBackground(WP.H_BIRU);
  sheet.setRowHeight(B, 22); B++;

  // Header 2 baris (merge sel tertentu)
  const hBulan1 = [['No.','Bulan','Total\nKasus',
    'Nama Pondok Pesantren','','',
    'Jenis Kelamin','',
    'Sembuh','%']];
  const hBulan2 = [['','','',
    PESANTREN_LIST[0].singkat, PESANTREN_LIST[1].singkat, PESANTREN_LIST[2].singkat,
    'L','P','','']];

  sheet.getRange(B, 1, 1, 10).setValues(hBulan1)
    .setBackground(WP.H_BIRU2).setFontColor(WP.PUTIH).setFontWeight('bold')
    .setFontSize(8.5).setHorizontalAlignment('center').setWrap(true);
  sheet.getRange(B, 4, 1, 3).merge(); // D-F = Nama Pesantren
  sheet.getRange(B, 7, 1, 2).merge(); // G-H = Jenis Kelamin
  sheet.getRange(B, 1, 2, 1).merge(); // A = No. (2 baris)
  sheet.getRange(B, 2, 2, 1).merge(); // B = Bulan (2 baris)
  sheet.getRange(B, 3, 2, 1).merge(); // C = Total (2 baris)
  sheet.getRange(B, 9, 2, 1).merge(); // I = Sembuh (2 baris)
  sheet.getRange(B, 10, 2, 1).merge();// J = % (2 baris)
  sheet.setRowHeight(B, 24); B++;

  sheet.getRange(B, 4, 1, 5).setValues([hBulan2[0].slice(3,8)])
    .setBackground(WP.H_BIRU2).setFontColor(WP.PUTIH).setFontWeight('bold')
    .setFontSize(8.5).setHorizontalAlignment('center').setWrap(true);
  borTebal(sheet.getRange(B-1, 1, 2, 10));
  sheet.setRowHeight(B, 20); B++;

  // ── Data per bulan (BATCH) ────────────────────────────────
  const bDataBulan  = [], bBgBulan = [], bFgBulan = [], bWtBulan = [], bAlBulan = [];
  bulanKeys.forEach((key, idx) => {
    const b   = perBulan[key];
    const pct = b.total > 0 ? `${Math.round((b.sembuh/b.total)*100)}%` : '0%';
    const bg  = idx % 2 === 0 ? WP.PUTIH : WP.ISI_ABU;
    bDataBulan.push([idx+1, b.label, b.total, b.pp[0], b.pp[1], b.pp[2], b.laki, b.perempuan, b.sembuh, pct]);
    bBgBulan.push(Array(10).fill(bg));
    bFgBulan.push([WP.TEXT, WP.H_BIRU, WP.TEXT, WP.TEXT, WP.TEXT, WP.TEXT, WP.TEXT, WP.TEXT, WP.TEXT, WP.TEXT]);
    bWtBulan.push(['normal','bold','normal','normal','normal','normal','normal','normal','normal','normal']);
    bAlBulan.push(['center','left','center','center','center','center','center','center','center','center']);
  });
  if (bDataBulan.length > 0) {
    tulisBatch(sheet, B, 1, bDataBulan, bBgBulan, bFgBulan, bWtBulan, bAlBulan);
    borTabel(sheet.getRange(B, 1, bDataBulan.length, 10), WP.GARIS);
  }
  B += bDataBulan.length;

  // Baris TOTAL
  const totBulanRow = [['JUMLAH', '', totalKasus,
    perPP[0].total, perPP[1].total, perPP[2].total,
    totalLaki, totalPerempuan, totalSembuh, `${pctSembuh}%`]];
  sheet.getRange(B, 1, 1, 10).setValues(totBulanRow)
    .setBackground(WP.H_BIRU).setFontColor(WP.PUTIH).setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center');
  sheet.getRange(B, 1, 1, 2).merge().setHorizontalAlignment('center');
  borTebal(sheet.getRange(B, 1, 1, 10));
  B++;
  sheet.setRowHeight(B, 8); B++;

  // ================================================================
  // C. REKAP PER PESANTREN
  // ================================================================
  sheet.getRange(B, 1, 1, 10).merge()
    .setValue('C.  REKAPITULASI PER PONDOK PESANTREN')
    .setFontSize(10).setFontWeight('bold').setFontFamily('Times New Roman')
    .setFontColor(WP.PUTIH).setBackground(WP.H_BIRU);
  sheet.setRowHeight(B, 22); B++;

  sheet.getRange(B, 1, 1, 8).setValues([['No.','Nama Pondok Pesantren','Total','Laki-laki','Perempuan','Sembuh','Berobat','% Sembuh']])
    .setBackground(WP.H_BIRU2).setFontColor(WP.PUTIH).setFontWeight('bold')
    .setFontSize(8.5).setHorizontalAlignment('center');
  sheet.getRange(B, 9, 1, 2).merge().setBackground(WP.PUTIH);
  borTebal(sheet.getRange(B, 1, 1, 8));
  sheet.setRowHeight(B, 22); B++;

  // ── Data per pesantren (BATCH) ────────────────────────────
  const bDataPP=[], bBgPP=[], bFgPP=[], bWtPP=[], bAlPP=[];
  PESANTREN_LIST.forEach((pp, idx) => {
    const d   = perPP[idx];
    const pct = d.total > 0 ? `${Math.round((d.sembuh/d.total)*100)}%` : '0%';
    const bg  = idx % 2 === 0 ? WP.PUTIH : WP.ISI_ABU;
    bDataPP.push([idx+1, pp.nama, d.total, d.laki, d.perempuan, d.sembuh, d.berobat, pct]);
    bBgPP.push(Array(8).fill(bg));
    bFgPP.push([WP.TEXT, WP.H_BIRU2, WP.TEXT, WP.TEXT, WP.TEXT, WP.TEXT, WP.TEXT, WP.TEXT]);
    bWtPP.push(['normal','bold','normal','normal','normal','normal','normal','normal']);
    bAlPP.push(['center','left','center','center','center','center','center','center']);
  });
  if (bDataPP.length > 0) {
    tulisBatch(sheet, B, 1, bDataPP, bBgPP, bFgPP, bWtPP, bAlPP);
    borTabel(sheet.getRange(B, 1, bDataPP.length, 8), WP.GARIS);
    sheet.getRange(B, 9, bDataPP.length, 2).setBackground(WP.PUTIH);
  }
  B += bDataPP.length;

  // Total pesantren
  sheet.getRange(B, 1, 1, 8).setValues([['-','TOTAL',totalKasus,totalLaki,totalPerempuan,totalSembuh,totalBerobat,`${pctSembuh}%`]])
    .setBackground(WP.H_BIRU).setFontColor(WP.PUTIH).setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center');
  sheet.getRange(B, 2).setHorizontalAlignment('left');
  borTebal(sheet.getRange(B, 1, 1, 8));
  sheet.getRange(B, 9, 1, 2).merge().setBackground(WP.PUTIH);
  B++;
  sheet.setRowHeight(B, 8); B++;

  // ================================================================
  // D. DISTRIBUSI KELUHAN
  // ================================================================
  sheet.getRange(B, 1, 1, 10).merge()
    .setValue('D.  DISTRIBUSI KELUHAN')
    .setFontSize(10).setFontWeight('bold').setFontFamily('Times New Roman')
    .setFontColor(WP.PUTIH).setBackground(WP.H_BIRU);
  sheet.setRowHeight(B, 22); B++;

  sheet.getRange(B, 1, 1, 5).setValues([['No.','Jenis Keluhan','','Jumlah','Persentase']])
    .setBackground(WP.H_BIRU2).setFontColor(WP.PUTIH).setFontWeight('bold')
    .setFontSize(8.5).setHorizontalAlignment('center');
  sheet.getRange(B, 2, 1, 2).merge();
  sheet.getRange(B, 6, 1, 5).merge().setBackground(WP.PUTIH);
  borTebal(sheet.getRange(B, 1, 1, 5));
  sheet.setRowHeight(B, 22); B++;

  if (keluhanArr.length === 0) {
    sheet.getRange(B, 1, 1, 5).merge()
      .setValue('Belum ada data keluhan.')
      .setFontSize(9).setFontStyle('italic')
      .setHorizontalAlignment('center').setBackground(WP.ISI_ABU);
    borTabel(sheet.getRange(B, 1, 1, 5), WP.GARIS);
    B++;
  } else {
    // ── Data keluhan (BATCH) ──────────────────────────────────
    const bDataK=[], bBgK=[], bFgK=[], bAlK=[];
    const maxK = keluhanArr[0][1];
    keluhanArr.forEach(([k,v], idx) => {
      const pct = totalKasus > 0 ? `${Math.round((v/totalKasus)*100)}%` : '0%';
      const bg  = idx % 2 === 0 ? WP.PUTIH : WP.ISI_ABU;
      bDataK.push([idx+1, k, '', v, pct]);
      bBgK.push(Array(5).fill(bg));
      bFgK.push([WP.TEXT, WP.TEXT, WP.TEXT, WP.TEXT, WP.H_BIRU2]);
      bAlK.push(['center','left','left','center','center']);
    });
    tulisBatch(sheet, B, 1, bDataK, bBgK, bFgK, null, bAlK);
    // Merge kolom B-C per baris
    for (let i = 0; i < bDataK.length; i++) sheet.getRange(B+i, 2, 1, 2).merge();
    borTabel(sheet.getRange(B, 1, bDataK.length, 5), WP.GARIS);
    sheet.getRange(B, 6, bDataK.length, 5).setBackground(WP.PUTIH);
    B += bDataK.length;
  }
  sheet.setRowHeight(B, 14); B++;

  // ================================================================
  // TANDA TANGAN (kanan bawah, format resmi Indonesia)
  // ================================================================
  const now2 = new Date();

  // Tanggal
  sheet.getRange(B, 1, 1, 10).merge()
    .setValue(`Banjarbaru,  ${BULAN_ID[now2.getMonth()]} ${now2.getFullYear()}`)
    .setFontSize(10).setFontFamily('Times New Roman')
    .setHorizontalAlignment('right').setFontColor(WP.HITAM).setBackground(WP.PUTIH);
  sheet.setRowHeight(B, 20); B++;

  // Jabatan kiri: PJ Program
  sheet.getRange(B, 1, 1, 5).merge()
    .setValue(PEJABAT.pjProgram.jabatan + ',')
    .setFontSize(10).setFontWeight('bold').setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setFontColor(WP.HITAM).setBackground(WP.PUTIH);

  // Jabatan kanan: Kepala Puskesmas
  sheet.getRange(B, 6, 1, 5).merge()
    .setValue(PEJABAT.kepalaPkm.jabatan + ',')
    .setFontSize(10).setFontWeight('bold').setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setFontColor(WP.HITAM).setBackground(WP.PUTIH);
  sheet.setRowHeight(B, 20); B++;

  // Spasi tanda tangan (4 baris)
  for (let i = 0; i < 4; i++) {
    sheet.getRange(B, 1, 1, 10).setBackground(WP.PUTIH);
    sheet.setRowHeight(B, 18); B++;
  }

  // Nama PJ Program (kiri)
  sheet.getRange(B, 1, 1, 5).merge()
    .setValue(PEJABAT.pjProgram.nama)
    .setFontSize(10).setFontWeight('bold').setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setFontColor(WP.HITAM).setBackground(WP.PUTIH)
    .setBorder(false,false,true,false,false,false,WP.HITAM,SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(B, 20);

  // Nama Kepala Puskesmas (kanan)
  sheet.getRange(B, 6, 1, 5).merge()
    .setValue(PEJABAT.kepalaPkm.nama)
    .setFontSize(10).setFontWeight('bold').setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setFontColor(WP.HITAM).setBackground(WP.PUTIH)
    .setBorder(false,false,true,false,false,false,WP.HITAM,SpreadsheetApp.BorderStyle.SOLID);
  B++;

  // NIP kiri
  sheet.getRange(B, 1, 1, 5).merge()
    .setValue(PEJABAT.pjProgram.nip)
    .setFontSize(9).setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setFontColor(WP.HITAM).setBackground(WP.PUTIH);

  // NIP kanan
  sheet.getRange(B, 6, 1, 5).merge()
    .setValue(PEJABAT.kepalaPkm.nip)
    .setFontSize(9).setFontFamily('Times New Roman')
    .setHorizontalAlignment('center').setFontColor(WP.HITAM).setBackground(WP.PUTIH);
  sheet.setRowHeight(B, 18); B++;
  sheet.setRowHeight(B, 10); B++;

  // Garis penutup dokumen
  sheet.getRange(B, 1, 1, 10).merge().setBackground(WP.HITAM);
  sheet.setRowHeight(B, 3); B++;
  sheet.getRange(B, 1, 1, 10).merge().setBackground('#777777');
  sheet.setRowHeight(B, 1); B++;

  // ── Set print area ────────────────────────────────────────
  // Tidak perlu diset manual — seluruh konten sudah dalam A-J
  // User tinggal: File > Print > Paper A4 > Portrait > Fit to width

  ss.toast('📄 Rekap Bulanan selesai! Buka sheet "Rekap Bulanan" untuk cek hasilnya.','GASTREN',4);
}

// ================================================================
// BUAT DIAGRAM (DARK MODE — untuk layar/presentasi)
// ================================================================
function buatDiagram(ss, data) {
  let sheet = ss.getSheetByName(CFG.SHEET_DIAGRAM);
  if (!sheet) sheet = ss.insertSheet(CFG.SHEET_DIAGRAM);
  sheet.clearContents();
  sheet.clearFormats();
  sheet.getCharts().forEach(c => sheet.removeChart(c));
  sheet.setTabColor(WD.BIRU);

  const totalKasus    = data.length;
  const totalSembuh   = data.filter(r => r.statusAkhir.toLowerCase().includes('sembuh')).length;
  const totalBerobat  = data.filter(r => r.statusPengobatan.toLowerCase().includes('berobat')).length;
  const totalLaki     = data.filter(r => r.jenisKelamin.toLowerCase().includes('laki')).length;
  const totalPerempuan= data.filter(r => r.jenisKelamin.toLowerCase().includes('perempuan')).length;
  const totalLainnya  = Math.max(0, totalKasus - totalSembuh - totalBerobat);

  const now = new Date();

  // Header
  sheet.getRange('A1:P1').merge()
    .setValue('📊 DIAGRAM GASTREN — Gerakan Anti Scabies Pondok Pesantren')
    .setFontSize(13).setFontWeight('bold').setFontColor(WD.PUTIH)
    .setBackground(WD.EMAS_TUA).setHorizontalAlignment('center');
  sheet.setRowHeight(1, 38);

  sheet.getRange('A2:P2').merge()
    .setValue(`Puskesmas Banjarbaru Selatan  |  Total: ${totalKasus} Kasus  |  ${tglIndonesia(now)}`)
    .setFontSize(10).setFontColor(WD.ABU).setBackground(WD.HEADER)
    .setHorizontalAlignment('center');

  // Data pesantren [A4]
  const pp = PESANTREN_LIST.map((_,i) =>
    data.filter(r => cocokkanPesantren(r.namaPesantren) === i).length
  );
  sheet.getRange(4,1,4,2).setValues([
    ['Pesantren','Kasus'],
    ['PP Waratsatul Fuqaha', pp[0]],
    ['PP Tahfiz Menara Quran', pp[1]],
    ["PP Mahad Ba'bud", pp[2]],
  ]);
  sheet.getRange(4,1,1,2).setBackground(WD.EMAS_TUA).setFontColor(WD.PUTIH).setFontWeight('bold');
  sheet.getRange(5,1,3,2).setBackground(WD.GELAP3).setFontColor(WD.PUTIH).setHorizontalAlignment('center');

  // Data gender [D4]
  sheet.getRange(4,4,3,2).setValues([
    ['Jenis Kelamin','Jumlah'],
    ['Laki-laki', totalLaki],
    ['Perempuan', totalPerempuan],
  ]);
  sheet.getRange(4,4,1,2).setBackground(WD.BIRU_TUA).setFontColor(WD.PUTIH).setFontWeight('bold');
  sheet.getRange(5,4,2,2).setBackground(WD.GELAP3).setFontColor(WD.PUTIH).setHorizontalAlignment('center');

  // Data status [G4]
  sheet.getRange(4,7,4,2).setValues([
    ['Status','Jumlah'],
    ['Sembuh', totalSembuh],
    ['Berobat', totalBerobat],
    ['Lainnya', totalLainnya],
  ]);
  sheet.getRange(4,7,1,2).setBackground('#166534').setFontColor(WD.PUTIH).setFontWeight('bold');
  sheet.getRange(5,7,3,2).setBackground(WD.GELAP3).setFontColor(WD.PUTIH).setHorizontalAlignment('center');

  // Data tren bulanan [A10]
  const perBulan = {};
  data.forEach(r => {
    const pb = parseBulan(r.tanggalLaporan);
    if (!pb) return;
    const key = `${pb.tahun}-${String(pb.bulan0+1).padStart(2,'0')}`;
    if (!perBulan[key]) perBulan[key] = {
      label:`${BULAN_ID[pb.bulan0].slice(0,3)} '${String(pb.tahun).slice(2)}`, pp:[0,0,0]
    };
    const idx = cocokkanPesantren(r.namaPesantren);
    if (idx >= 0) perBulan[key].pp[idx]++;
  });
  const bulanKeys = Object.keys(perBulan).sort();
  const bB = 10;

  sheet.getRange(bB,1,1,5).setValues([['Bulan','Waratsatul Fuqaha','Menara Quran',"Mahad Ba'bud",'Total']])
    .setBackground(WD.EMAS_TUA).setFontColor(WD.PUTIH).setFontWeight('bold');

  if (bulanKeys.length > 0) {
    const bulanData = bulanKeys.map((key,i) => {
      const b = perBulan[key];
      return [b.label, b.pp[0], b.pp[1], b.pp[2], b.pp[0]+b.pp[1]+b.pp[2]];
    });
    const bulanBg = bulanData.map((_,i) => Array(5).fill(i%2===0?WD.GELAP3:WD.GELAP2));
    const bulanFg = bulanData.map(() => [WD.EMAS, WD.PUTIH, WD.PUTIH, WD.PUTIH, WD.PUTIH]);
    sheet.getRange(bB+1,1,bulanData.length,5)
      .setValues(bulanData).setBackgrounds(bulanBg).setFontColors(bulanFg)
      .setHorizontalAlignment('center');
  }

  // Data keluhan [G10]
  const keluhanMap = {};
  data.forEach(r => { const k=r.keluhan.trim(); if(k) keluhanMap[k]=(keluhanMap[k]||0)+1; });
  const keluhanArr = Object.entries(keluhanMap).sort((a,b)=>b[1]-a[1]);

  sheet.getRange(bB,7,1,2).setValues([['Keluhan','Jumlah']])
    .setBackground('#7C3AED').setFontColor(WD.PUTIH).setFontWeight('bold');
  if (keluhanArr.length > 0) {
    const kData = keluhanArr.map(([k,v]) => [k,v]);
    const kBg   = kData.map((_,i) => Array(2).fill(i%2===0?WD.GELAP3:WD.GELAP2));
    const kFg   = kData.map(() => Array(2).fill(WD.PUTIH));
    sheet.getRange(bB+1,7,kData.length,2)
      .setValues(kData).setBackgrounds(kBg).setFontColors(kFg)
      .setHorizontalAlignment('center');
  }

  sheet.autoResizeColumns(1, 10);
  sheet.setColumnWidth(1, 200);

  // ── BUAT 5 CHART ───────────────────────────────────────────
  const startChart = 20;
  if (totalKasus > 0) {
    // Chart 1: PIE Pesantren
    sheet.insertChart(sheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange(4,1,4,2))
      .setPosition(startChart,1,0,0)
      .setOption('title','🕌 Distribusi per Pesantren')
      .setOption('titleTextStyle',{color:WD.PUTIH,fontSize:12,bold:true})
      .setOption('width',380).setOption('height',280)
      .setOption('is3D',true)
      .setOption('backgroundColor',{fill:WD.GELAP3})
      .setOption('legend',{textStyle:{color:WD.PUTIH},position:'bottom'})
      .setOption('slices',{0:{color:WD.EMAS},1:{color:WD.BIRU},2:{color:WD.UNGU}})
      .build());

    // Chart 2: PIE Gender
    sheet.insertChart(sheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange(4,4,3,2))
      .setPosition(startChart,7,0,0)
      .setOption('title','👥 Distribusi Jenis Kelamin')
      .setOption('titleTextStyle',{color:WD.PUTIH,fontSize:12,bold:true})
      .setOption('width',380).setOption('height',280)
      .setOption('is3D',true)
      .setOption('backgroundColor',{fill:WD.GELAP3})
      .setOption('legend',{textStyle:{color:WD.PUTIH},position:'bottom'})
      .setOption('slices',{0:{color:WD.UNGU},1:{color:'#EC4899'}})
      .build());

    // Chart 3: PIE Status
    sheet.insertChart(sheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange(4,7,4,2))
      .setPosition(startChart,13,0,0)
      .setOption('title','💊 Status Pengobatan')
      .setOption('titleTextStyle',{color:WD.PUTIH,fontSize:12,bold:true})
      .setOption('width',380).setOption('height',280)
      .setOption('is3D',true)
      .setOption('backgroundColor',{fill:WD.GELAP3})
      .setOption('legend',{textStyle:{color:WD.PUTIH},position:'bottom'})
      .setOption('slices',{0:{color:WD.HIJAU},1:{color:WD.BIRU},2:{color:'#64748B'}})
      .build());
  }

  if (bulanKeys.length > 0) {
    // Chart 4: COLUMN Tren Bulanan
    sheet.insertChart(sheet.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(sheet.getRange(bB,1,bulanKeys.length+1,4))
      .setPosition(startChart+17,1,0,0)
      .setOption('title','📈 Tren Kasus per Bulan')
      .setOption('titleTextStyle',{color:WD.PUTIH,fontSize:12,bold:true})
      .setOption('width',560).setOption('height',300)
      .setOption('backgroundColor',{fill:WD.GELAP3})
      .setOption('chartArea',{backgroundColor:WD.GELAP2,width:'78%',height:'72%'})
      .setOption('hAxis',{title:'Bulan',textStyle:{color:WD.ABU},titleTextStyle:{color:WD.EMAS}})
      .setOption('vAxis',{title:'Jumlah',minValue:0,textStyle:{color:WD.ABU},titleTextStyle:{color:WD.EMAS},gridlines:{color:'#1E3A6E'}})
      .setOption('legend',{position:'bottom',textStyle:{color:WD.PUTIH}})
      .setOption('series',{0:{color:WD.EMAS},1:{color:WD.BIRU},2:{color:WD.UNGU}})
      .build());
  }

  if (keluhanArr.length > 0) {
    // Chart 5: BAR Keluhan
    sheet.insertChart(sheet.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(sheet.getRange(bB,7,keluhanArr.length+1,2))
      .setPosition(startChart+17,10,0,0)
      .setOption('title','🩺 Distribusi Keluhan')
      .setOption('titleTextStyle',{color:WD.PUTIH,fontSize:12,bold:true})
      .setOption('width',420).setOption('height',300)
      .setOption('backgroundColor',{fill:WD.GELAP3})
      .setOption('chartArea',{backgroundColor:WD.GELAP2,width:'65%',height:'72%'})
      .setOption('hAxis',{title:'Jumlah',minValue:0,textStyle:{color:WD.ABU},titleTextStyle:{color:WD.EMAS}})
      .setOption('vAxis',{textStyle:{color:WD.PUTIH}})
      .setOption('legend',{position:'none'})
      .setOption('series',{0:{color:WD.BIRU}})
      .build());
  }
}
