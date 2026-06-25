# 🕌 GASTREN — Gerakan Anti Scabies Pondok Pesantren

> **Sistem Informasi & Monitoring Scabies** berbasis web untuk Puskesmas Banjarbaru Selatan, Kota Banjarbaru, Kalimantan Selatan.

---

## 📋 Tentang Proyek

**GASTREN** (Gerakan Anti Scabies Pondok Pesantren) adalah sistem digital yang dikembangkan oleh **Puskesmas Banjarbaru Selatan** untuk:

- Memantau penyebaran penyakit **scabies (kudis)** di pondok pesantren wilayah kerja
- Menyajikan **peta interaktif** lokasi pesantren dan kasus
- Menghasilkan **laporan bulanan otomatis** yang siap cetak (A4)
- Menampilkan **diagram/grafik** distribusi kasus secara real-time

### Pondok Pesantren yang Dipantau
| No | Nama Pesantren | Lokasi |
|----|----------------|--------|
| 1 | PP Waratsatul Fuqaha | Banjarbaru Selatan |
| 2 | PP Tahfiz Menara Quran | Banjarbaru Selatan |
| 3 | PP Mahad Ba'bud | Banjarbaru Selatan |

---

## ✨ Fitur

### 🌐 Website Dashboard
- **Hero section** dengan statistik ringkas (total kasus, sembuh, pesantren)
- **Peta interaktif** (Leaflet.js + OpenStreetMap) dengan marker lokasi pesantren & puskesmas
- **Kartu info** per pesantren dengan data kasus real-time
- **Grafik distribusi** pesantren, gender, status pengobatan
- **Link langsung** ke Google Form pengisian data
- Desain responsif dengan tema **emas-biru kesehatan**

### 📊 Google Sheets Integration (Apps Script)
- **Auto-update** laporan setiap ada data form baru masuk
- **Rekap Bulanan** print-ready format A4 dengan kop surat resmi
- **5 Diagram otomatis** (distribusi pesantren, gender, status, tren bulanan, keluhan)
- **Tanda tangan** dua pejabat (Penanggung Jawab Program & Kepala Puskesmas)

---

## 🚀 Cara Pakai

### Website
1. Buka `index.html` langsung di browser, **atau**
2. Deploy ke GitHub Pages (lihat bagian di bawah)

### Google Apps Script
1. Buka spreadsheet Google Form scabies
2. Klik **Extensions → Apps Script**
3. Paste seluruh isi `gastren_apps_script.js`
4. Klik **💾 Save** → pilih fungsi `pasangTrigger` → klik **▶ Run**
5. Izinkan akses → klik **Allow**

---

## 📁 Struktur File

```
GASTREN/
├── index.html              # Halaman utama website dashboard
├── style.css               # Styling dengan tema emas-biru kesehatan
├── app.js                  # Logic peta, grafik, dan data
├── gastren_apps_script.js  # Google Apps Script untuk laporan otomatis
└── README.md               # Dokumentasi ini
```

---

## 🛠️ Teknologi

| Komponen | Teknologi |
|----------|-----------|
| Website | HTML5, CSS3 (Vanilla), JavaScript |
| Peta | Leaflet.js + OpenStreetMap |
| Grafik | Chart.js |
| Font | Google Fonts (Outfit) |
| Laporan | Google Apps Script (Sheets) |
| Data | Google Forms + Google Sheets |

---

## 🌐 Deploy ke GitHub Pages (Website Online Gratis)

1. Upload semua file ke repositori GitHub ini
2. Klik **Settings** → **Pages**
3. Di bagian *Source*, pilih **Branch: main** → folder **/ (root)**
4. Klik **Save**
5. Website akan tersedia di: `https://[username].github.io/[nama-repo]/`

---

## 👥 Tim

| Peran | Nama |
|-------|------|
| Penanggung Jawab Program | Sri Minarni, SKM — NIP. 19790315 200604 2 023 |
| Kepala Puskesmas | dr. Hernita Indriani — NIP. 19851001 201402 2 005 |

**Instansi:** Puskesmas Banjarbaru Selatan — Dinas Kesehatan — Pemerintah Kota Banjarbaru  
**Alamat:** Jalan Rambai No.1, Banjarbaru, Kalimantan Selatan — Kode Pos 70713

---

## 📞 Kontak

Puskesmas Banjarbaru Selatan  
📞 Telp. (0511) 4772381  
📍 Jalan Rambai No.1, Banjarbaru

---

*Dikembangkan untuk mendukung program kesehatan masyarakat di lingkungan pondok pesantren.*
