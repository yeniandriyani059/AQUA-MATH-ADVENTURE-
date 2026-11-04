import { MathQuestion } from '../types/game';

/**
 * BANK SOAL RESMI AQUA MATH ADVENTURE – SAVE AQUA CITY!
 * Total: 100 Soal Unik Kontekstual & Bertahap (10 Lokasi × 10 Soal)
 *
 * Standar Progresi Level:
 * - LEVEL 1 (Lokasi 1–2): Water Supply — Penjumlahan & Pengurangan Kontekstual (Mudah)
 * - LEVEL 2 (Lokasi 3–4): Water Distribution — Perkalian Kelompok Setara & Pembagian Distribusi (Mudah–Sedang)
 * - LEVEL 3 (Lokasi 5–6): Fair Water Challenge — Operasi Gabungan 2 Langkah (Sedang)
 * - LEVEL 4 (Lokasi 7–8): Smart Priority — Analisis Kebutuhan, Sisa & Prioritas 2–3 Langkah (Menantang)
 * - LEVEL 5 (Lokasi 9–10): Final Aqua Mission — Penalaran Multi-Langkah 3–4 Langkah & 10 Soal Acuan Utama LKPD (Sangat Menantang)
 */
export const QUESTIONS_BANK: MathQuestion[] = [
  // ============================================================================
  // LEVEL 1 – WATER SUPPLY | LOKASI 1: WATER TANK STATION (Penjumlahan Kontekstual)
  // ============================================================================
  {
    id: 'L1_LOC1_Q1',
    locationId: 1,
    levelId: 1,
    number: 1,
    topic: 'Penjumlahan Persediaan Air',
    competency: 'Menghitung total persediaan air dari volume awal dan tambahan pasokan (menyimpan puluhan)',
    difficultyLevel: 'Mudah',
    questionText:
      'Tangki Utama A di Water Tank Station menyimpan 245 liter air bersih. Pagi ini pipa pegunungan mengalirkan lagi 178 liter air bersih ke dalam Tangki Utama A, sedangkan Tangki Cadangan B tetap ditutup. Berapa liter seluruh air bersih di dalam Tangki Utama A sekarang?',
    options: {
      A: '413 liter',
      B: '423 liter',
      C: '323 liter',
      D: '433 liter',
    },
    correctOption: 'B',
    explanation:
      'Volume awal Tangki Utama A ditambah pasokan baru: 245 + 178. Satuan: 5 + 8 = 13 (tulis 3, simpan 1 puluhan). Puluhan: 4 + 7 + 1 = 12 (tulis 2, simpan 1 ratusan). Ratusan: 2 + 1 + 1 = 4. Jadi totalnya 423 liter.',
  },
  {
    id: 'L1_LOC1_Q2',
    locationId: 1,
    levelId: 1,
    number: 2,
    topic: 'Penjumlahan Persediaan Air',
    competency: 'Menjumlahkan dua pasokan air dari waktu yang berbeda dengan teknik menyimpan',
    difficultyLevel: 'Mudah',
    questionText:
      'Pada pagi hari, sensor Stasiun Menara Air mencatat 368 liter air masuk dari mata air utara. Pada siang hari, masuk lagi 257 liter air dari mata air selatan. Berapa liter total pasokan air yang masuk ke stasiun pada pagi dan siang hari?',
    options: {
      A: '625 liter',
      B: '525 liter',
      C: '615 liter',
      D: '635 liter',
    },
    correctOption: 'A',
    explanation:
      'Jumlahkan pasokan pagi dan siang: 368 + 257. Satuan: 8 + 7 = 15 (simpan 1). Puluhan: 6 + 5 + 1 = 12 (simpan 1). Ratusan: 3 + 2 + 1 = 6. Hasilnya adalah 625 liter.',
  },
  {
    id: 'L1_LOC1_Q3',
    locationId: 1,
    levelId: 1,
    number: 3,
    topic: 'Penjumlahan Persediaan Air',
    competency: 'Menentukan gabungan volume air dari dua menara penampungan',
    difficultyLevel: 'Mudah',
    questionText:
      'Tangki Menara Timur menampung 436 liter air bersih, sedangkan Tangki Menara Barat menampung 289 liter air bersih. Jika kedua tangki dihubungkan ke pipa induk yang sama, berapa liter jumlah seluruh air bersih dari kedua tangki tersebut?',
    options: {
      A: '625 liter',
      B: '715 liter',
      C: '725 liter',
      D: '735 liter',
    },
    correctOption: 'C',
    explanation:
      'Gabungan air kedua menara: 436 + 289 = 725 liter (6 + 9 = 15 simpan 1; 30 + 80 + 10 = 120 simpan 100; 400 + 200 + 100 = 700).',
  },
  {
    id: 'L1_LOC1_Q4',
    locationId: 1,
    levelId: 1,
    number: 4,
    topic: 'Penjumlahan Persediaan Air',
    competency: 'Menghitung volume akhir tandon setelah menerima tambahan air hujan tersaring',
    difficultyLevel: 'Mudah',
    questionText:
      'Sebelum hujan turun, tandon penampungan di Water Tank Station berisi 319 liter air. Setelah hujan reda, alat penyaring air hujan berhasil menambahkan 294 liter air bersih ke tandon itu. Berapa liter isi tandon penampungan sekarang?',
    options: {
      A: '513 liter',
      B: '603 liter',
      C: '623 liter',
      D: '613 liter',
    },
    correctOption: 'D',
    explanation:
      'Isi awal ditambah tambahan air hujan: 319 + 294 = 613 liter (9 + 4 = 13 simpan 1; 1 + 9 + 1 = 11 simpan 1; 3 + 2 + 1 = 6).',
  },
  {
    id: 'L1_LOC1_Q5',
    locationId: 1,
    levelId: 1,
    number: 5,
    topic: 'Penjumlahan Persediaan Air',
    competency: 'Memilih informasi relevan dan menjumlahkan volume air dari dua pipa pengisi',
    difficultyLevel: 'Mudah',
    questionText:
      'Bima memeriksa dua pipa pengisi menara selama 2 jam. Dalam waktu tersebut, Pipa Biru telah mengalirkan 475 liter air bersih dan Pipa Perak telah mengalirkan 348 liter air bersih. Berapa liter total air bersih yang dialirkan oleh kedua pipa tersebut?',
    options: {
      A: '813 liter',
      B: '823 liter',
      C: '723 liter',
      D: '833 liter',
    },
    correctOption: 'B',
    explanation:
      'Angka 2 jam adalah keterangan waktu, sedangkan volume air yang dijumlahkan adalah 475 liter + 348 liter = 823 liter.',
  },
  {
    id: 'L1_LOC1_Q6',
    locationId: 1,
    levelId: 1,
    number: 6,
    topic: 'Penjumlahan Persediaan Air',
    competency: 'Menjumlahkan bilangan tiga angka yang menghasilkan puluhan bulat',
    difficultyLevel: 'Mudah',
    questionText:
      'Tangki Cadangan 1 mula-mula berisi 284 liter air. Sinta membuka katup pengisi hingga air di dalam Tangki Cadangan 1 bertambah sebanyak 456 liter. Berapa liter volume air di Tangki Cadangan 1 setelah diisi?',
    options: {
      A: '740 liter',
      B: '730 liter',
      C: '640 liter',
      D: '750 liter',
    },
    correctOption: 'A',
    explanation:
      'Volume air setelah diisi: 284 + 456. Satuan: 4 + 6 = 10 (tulis 0, simpan 1). Puluhan: 8 + 5 + 1 = 14 (tulis 4, simpan 1). Ratusan: 2 + 4 + 1 = 7. Jadi hasilnya 740 liter.',
  },
  {
    id: 'L1_LOC1_Q7',
    locationId: 1,
    levelId: 1,
    number: 7,
    topic: 'Penjumlahan Persediaan Air',
    competency: 'Menghitung total cadangan air pada dua kubah penyimpanan',
    difficultyLevel: 'Mudah',
    questionText:
      'Untuk persiapan akhir pekan, Stasiun Menara Air menyiapkan 547 liter air di Kubah Bawah dan 268 liter air di Kubah Atas. Berapa liter jumlah seluruh persediaan air di kedua kubah tersebut?',
    options: {
      A: '715 liter',
      B: '805 liter',
      C: '815 liter',
      D: '825 liter',
    },
    correctOption: 'C',
    explanation:
      'Jumlahkan persediaan Kubah Bawah dan Kubah Atas: 547 + 268 = 815 liter (7 + 8 = 15; 40 + 60 + 10 = 110; 500 + 200 + 100 = 800).',
  },
  {
    id: 'L1_LOC1_Q8',
    locationId: 1,
    levelId: 1,
    number: 8,
    topic: 'Penjumlahan Persediaan Air',
    competency: 'Menjumlahkan pengiriman air dari dua truk tangki secara berurutan',
    difficultyLevel: 'Mudah',
    questionText:
      'Truk tangki pertama mengirim 358 liter air mineral pegunungan ke Stasiun Menara Air. Satu jam kemudian, truk tangki kedua mengirim lagi 387 liter air mineral. Berapa liter seluruh air mineral yang dikirim oleh kedua truk tangki itu?',
    options: {
      A: '735 liter',
      B: '645 liter',
      C: '755 liter',
      D: '745 liter',
    },
    correctOption: 'D',
    explanation:
      'Total kiriman kedua truk tangki: 358 + 387 = 745 liter (8 + 7 = 15 simpan 1; 5 + 8 + 1 = 14 simpan 1; 3 + 3 + 1 = 7).',
  },
  {
    id: 'L1_LOC1_Q9',
    locationId: 1,
    levelId: 1,
    number: 9,
    topic: 'Penjumlahan Persediaan Air',
    competency: 'Menghitung total hasil penyaringan dari dua unit filter kristal',
    difficultyLevel: 'Mudah',
    questionText:
      'Di ruang filter menara, Saringan Kristal A telah menjernihkan 469 liter air, sedangkan Saringan Kristal B menjernihkan 375 liter air. Berapa liter total air yang telah dijernihkan oleh kedua saringan kristal tersebut?',
    options: {
      A: '834 liter',
      B: '844 liter',
      C: '744 liter',
      D: '854 liter',
    },
    correctOption: 'B',
    explanation:
      'Total air jernih: 469 + 375 = 844 liter (9 + 5 = 14 simpan 1; 6 + 7 + 1 = 14 simpan 1; 4 + 3 + 1 = 8).',
  },
  {
    id: 'L1_LOC1_Q10',
    locationId: 1,
    levelId: 1,
    number: 10,
    topic: 'Penjumlahan Persediaan Air',
    competency: 'Menghitung total cadangan malam hari pada tangki induk',
    difficultyLevel: 'Mudah',
    questionText:
      'Menjelang malam, cadangan air di Tangki Induk tercatat 586 liter. Pompa otomatis malam hari menambahkan 349 liter air lagi agar tangki siap digunakan warga esok pagi. Berapa liter total air di Tangki Induk malam itu?',
    options: {
      A: '935 liter',
      B: '925 liter',
      C: '835 liter',
      D: '945 liter',
    },
    correctOption: 'A',
    explanation:
      'Total air di Tangki Induk: 586 + 349 = 935 liter (6 + 9 = 15 simpan 1; 8 + 4 + 1 = 13 simpan 1; 5 + 3 + 1 = 9).',
  },

  // ============================================================================
  // LEVEL 1 – WATER SUPPLY | LOKASI 2: FRESH WATER POND (Pengurangan, Sisa & Selisih)
  // ============================================================================
  {
    id: 'L1_LOC2_Q1',
    locationId: 2,
    levelId: 1,
    number: 1,
    topic: 'Pengurangan & Sisa Air',
    competency: 'Menghitung sisa persediaan air di kolam setelah disalurkan (teknik meminjam)',
    difficultyLevel: 'Mudah',
    questionText:
      'Kolam Air Segar menampung 642 liter air jernih pada pagi hari. Sebanyak 275 liter air dialirkan melalui pipa ke perumahan Blok Timur. Berapa liter sisa air jernih yang masih berada di Kolam Air Segar?',
    options: {
      A: '377 liter',
      B: '433 liter',
      C: '367 liter',
      D: '467 liter',
    },
    correctOption: 'C',
    explanation:
      'Sisa air = 642 − 275. Satuan: 12 − 5 = 7 (pinjam 1 puluhan dari 4 sehingga puluhan tinggal 3). Puluhan: 13 − 7 = 6 (pinjam 1 ratusan dari 6 sehingga ratusan tinggal 5). Ratusan: 5 − 2 = 3. Jadi sisanya 367 liter.',
  },
  {
    id: 'L1_LOC2_Q2',
    locationId: 2,
    levelId: 1,
    number: 2,
    topic: 'Pengurangan & Kekurangan Kapasitas',
    competency: 'Menentukan kekurangan air untuk mencapai kapasitas penuh dari bilangan ratusan bulat',
    difficultyLevel: 'Mudah',
    questionText:
      'Kapasitas penuh Kolam Taman Utara adalah 800 liter air. Saat ini sensor menunjukkan kolam tersebut baru terisi 465 liter air. Berapa liter air lagi yang dibutuhkan agar Kolam Taman Utara terisi penuh?',
    options: {
      A: '335 liter',
      B: '345 liter',
      C: '435 liter',
      D: '465 liter',
    },
    correctOption: 'A',
    explanation:
      'Kekurangan air = kapasitas penuh dikurangi isi saat ini: 800 − 465 = 335 liter (800 − 400 = 400, lalu 400 − 65 = 335).',
  },
  {
    id: 'L1_LOC2_Q3',
    locationId: 2,
    levelId: 1,
    number: 3,
    topic: 'Selisih Volume Air',
    competency: 'Menghitung selisih volume air antara dua kolam penampungan',
    difficultyLevel: 'Mudah',
    questionText:
      'Kolam Jernih A memiliki 734 liter air, sedangkan Kolam Jernih B memiliki 478 liter air. Berapa liter selisih volume air antara Kolam Jernih A dan Kolam Jernih B?',
    options: {
      A: '266 liter',
      B: '256 liter',
      C: '344 liter',
      D: '356 liter',
    },
    correctOption: 'B',
    explanation:
      'Selisih dicari dengan mengurangi volume yang lebih besar dengan yang lebih kecil: 734 − 478 = 256 liter.',
  },
  {
    id: 'L1_LOC2_Q4',
    locationId: 2,
    levelId: 1,
    number: 4,
    topic: 'Pengurangan & Sisa Air',
    competency: 'Menentukan sisa air di kolam setelah sebagian dikuras ke saluran penyaring',
    difficultyLevel: 'Mudah',
    questionText:
      'Sebelum proses pembersihan lumut, Kolam Air Segar berisi 915 liter air. Petugas menguras 348 liter air ke saluran penyaring untuk dibersihkan. Berapa liter air yang masih tersisa di dalam kolam?',
    options: {
      A: '577 liter',
      B: '633 liter',
      C: '667 liter',
      D: '567 liter',
    },
    correctOption: 'D',
    explanation:
      'Air yang tersisa di kolam: 915 − 348 = 567 liter (15 − 8 = 7; 10 − 4 = 6; 8 − 3 = 5).',
  },
  {
    id: 'L1_LOC2_Q5',
    locationId: 2,
    levelId: 1,
    number: 5,
    topic: 'Pengurangan & Kebutuhan Warga',
    competency: 'Menghitung kekurangan pasokan air terhadap target kebutuhan warga',
    difficultyLevel: 'Mudah',
    questionText:
      'Warga Distrik Hijau membutuhkan 750 liter air segar hari ini. Pipa dari Fresh Water Pond telah mengalirkan 486 liter air ke distrik tersebut. Berapa liter kekurangan air yang masih harus dialirkan?',
    options: {
      A: '274 liter',
      B: '264 liter',
      C: '336 liter',
      D: '364 liter',
    },
    correctOption: 'B',
    explanation:
      'Kekurangan pasokan air: 750 − 486 = 264 liter (10 − 6 = 4; 14 − 8 = 6; 6 − 4 = 2).',
  },
  {
    id: 'L1_LOC2_Q6',
    locationId: 2,
    levelId: 1,
    number: 6,
    topic: 'Pengurangan & Sisa Air',
    competency: 'Menghitung sisa air kolam alami setelah diambil mobil tangki taman',
    difficultyLevel: 'Mudah',
    questionText:
      'Dari 823 liter air di kolam penampungan alami, sebanyak 369 liter air digunakan untuk mengisi mobil tangki penyiram taman kota. Berapa liter air yang masih tersisa di kolam penampungan alami?',
    options: {
      A: '454 liter',
      B: '464 liter',
      C: '546 liter',
      D: '554 liter',
    },
    correctOption: 'A',
    explanation:
      'Sisa air kolam penampungan alami: 823 − 369 = 454 liter (13 − 9 = 4; 11 − 6 = 5; 7 − 3 = 4).',
  },
  {
    id: 'L1_LOC2_Q7',
    locationId: 2,
    levelId: 1,
    number: 7,
    topic: 'Pengurangan & Jumlah Pemakaian',
    competency: 'Menentukan banyak air yang telah digunakan dari perubahan volume awal dan akhir',
    difficultyLevel: 'Mudah',
    questionText:
      'Pada siang hari, volume air di Kolam Teratai turun dari 604 liter menjadi 258 liter karena telah dialirkan ke kebun warga. Berapa liter air yang telah dialirkan ke kebun warga tersebut?',
    options: {
      A: '356 liter',
      B: '446 liter',
      C: '346 liter',
      D: '454 liter',
    },
    correctOption: 'C',
    explanation:
      'Banyak air yang telah dialirkan = volume awal dikurangi volume akhir: 604 − 258 = 346 liter.',
  },
  {
    id: 'L1_LOC2_Q8',
    locationId: 2,
    levelId: 1,
    number: 8,
    topic: 'Perbandingan & Selisih Air',
    competency: 'Membandingkan dua kolam dan menghitung selisih volumenya',
    difficultyLevel: 'Mudah',
    questionText:
      'Sinta mencatat bahwa Kolam Barat menyimpan 861 liter air dan Kolam Timur menyimpan 574 liter air. Berapa liter lebih banyak air di Kolam Barat dibandingkan di Kolam Timur?',
    options: {
      A: '297 liter',
      B: '313 liter',
      C: '387 liter',
      D: '287 liter',
    },
    correctOption: 'D',
    explanation:
      'Selisih air Kolam Barat dan Kolam Timur: 861 − 574 = 287 liter (11 − 4 = 7; 15 − 7 = 8; 7 − 5 = 2).',
  },
  {
    id: 'L1_LOC2_Q9',
    locationId: 2,
    levelId: 1,
    number: 9,
    topic: 'Pengurangan & Sisa Air',
    competency: 'Menghitung sisa air di tandon mata air alami setelah disalurkan ke warga',
    difficultyLevel: 'Mudah',
    questionText:
      'Tandon mata air alami di tepi kolam menyimpan 940 liter air. Sebanyak 475 liter air disalurkan ke dapur umum dan pos warga. Berapa liter sisa air di tandon mata air alami itu?',
    options: {
      A: '475 liter',
      B: '465 liter',
      C: '535 liter',
      D: '565 liter',
    },
    correctOption: 'B',
    explanation:
      'Sisa air tandon: 940 − 475 = 465 liter (10 − 5 = 5; 13 − 7 = 6; 8 − 4 = 4).',
  },
  {
    id: 'L1_LOC2_Q10',
    locationId: 2,
    levelId: 1,
    number: 10,
    topic: 'Pengurangan & Sisa Air',
    competency: 'Menghitung sisa cadangan malam setelah separuh air dipompa ke tangki penyaringan',
    difficultyLevel: 'Mudah',
    questionText:
      'Kolam Air Segar memiliki cadangan malam sebanyak 712 liter air. Sebelum matahari terbit, 356 liter air dipompa menuju tangki penyaringan pagi. Berapa liter air yang tersisa di kolam?',
    options: {
      A: '356 liter',
      B: '366 liter',
      C: '346 liter',
      D: '456 liter',
    },
    correctOption: 'A',
    explanation:
      'Sisa air di kolam: 712 − 356 = 356 liter (12 − 6 = 6; 10 − 5 = 5; 6 − 3 = 3).',
  },

  // ============================================================================
  // LEVEL 2 – WATER DISTRIBUTION | LOKASI 3: PIPELINE CENTER (Perkalian Kontekstual)
  // ============================================================================
  {
    id: 'L2_LOC3_Q1',
    locationId: 3,
    levelId: 2,
    number: 1,
    topic: 'Perkalian Debit Pipa',
    competency: 'Menghitung total aliran air dari beberapa jalur pipa dengan debit yang sama',
    difficultyLevel: 'Mudah',
    questionText:
      'Di Pipeline Center terdapat 6 jalur pipa aktif yang menuju Distrik Utara. Setiap jalur pipa mengalirkan 45 liter air per menit. Berapa liter total air yang dialirkan oleh keenam jalur pipa tersebut dalam satu menit?',
    options: {
      A: '240 liter',
      B: '260 liter',
      C: '270 liter',
      D: '280 liter',
    },
    correctOption: 'C',
    explanation:
      'Total air = 6 × 45 liter. Kita hitung: (6 × 40) + (6 × 5) = 240 + 30 = 270 liter.',
  },
  {
    id: 'L2_LOC3_Q2',
    locationId: 3,
    levelId: 2,
    number: 2,
    topic: 'Perkalian Kelompok Wadah',
    competency: 'Menentukan jumlah seluruh galon air dari beberapa rak penyimpanan setara',
    difficultyLevel: 'Mudah',
    questionText:
      'Petugas menyusun 8 rak galon cadangan di ruang pipa induk. Setiap rak berisi 16 galon air untuk teknisi jaga. Berapa galon air seluruhnya yang tersedia di delapan rak tersebut?',
    options: {
      A: '128 galon',
      B: '88 galon',
      C: '118 galon',
      D: '136 galon',
    },
    correctOption: 'A',
    explanation:
      'Jumlah seluruh galon = 8 × 16 = (8 × 10) + (8 × 6) = 80 + 48 = 128 galon.',
  },
  {
    id: 'L2_LOC3_Q3',
    locationId: 3,
    levelId: 2,
    number: 3,
    topic: 'Perkalian Debit & Waktu',
    competency: 'Menghitung total volume air berdasarkan debit per jam dan lama waktu pompa bekerja',
    difficultyLevel: 'Mudah',
    questionText:
      'Sebuah pompa pendorong di Pipeline Center mampu mengalirkan 65 liter air setiap jam ke menara cabang. Jika pompa tersebut bekerja stabil selama 4 jam berturut-turut, berapa liter total air yang telah dialirkan?',
    options: {
      A: '240 liter',
      B: '260 liter',
      C: '250 liter',
      D: '270 liter',
    },
    correctOption: 'B',
    explanation:
      'Total air selama 4 jam = 4 × 65 liter = (4 × 60) + (4 × 5) = 240 + 20 = 260 liter.',
  },
  {
    id: 'L2_LOC3_Q4',
    locationId: 3,
    levelId: 2,
    number: 4,
    topic: 'Perkalian Katup Pipa',
    competency: 'Menghitung hasil kali banyak katup pipa dengan volume air per bukaan',
    difficultyLevel: 'Sedang',
    questionText:
      'Bima mengaktifkan 7 katup pipa sejajar untuk mengisi kolam cadangan. Setiap katup pipa mengeluarkan 35 liter air dalam sekali bukaan. Berapa liter air yang terkumpul dari ketujuh katup pipa tersebut?',
    options: {
      A: '215 liter',
      B: '235 liter',
      C: '255 liter',
      D: '245 liter',
    },
    correctOption: 'D',
    explanation:
      'Total air dari 7 katup = 7 × 35 liter = (7 × 30) + (7 × 5) = 210 + 35 = 245 liter.',
  },
  {
    id: 'L2_LOC3_Q5',
    locationId: 3,
    levelId: 2,
    number: 5,
    topic: 'Perkalian Kapasitas Tangki',
    competency: 'Menentukan total muatan air dari sejumlah tangki mini berukuran sama',
    difficultyLevel: 'Sedang',
    questionText:
      'Sebuah truk pengangkut di Pipeline Center membawa 9 tangki mini. Jika setiap tangki mini berisi 24 liter air murni, berapa liter air murni yang dibawa oleh truk pengangkut tersebut?',
    options: {
      A: '186 liter',
      B: '206 liter',
      C: '216 liter',
      D: '224 liter',
    },
    correctOption: 'C',
    explanation:
      'Total air murni = 9 × 24 liter = (9 × 20) + (9 × 4) = 180 + 36 = 216 liter.',
  },
  {
    id: 'L2_LOC3_Q6',
    locationId: 3,
    levelId: 2,
    number: 6,
    topic: 'Perkalian Siklus Air Pendingin',
    competency: 'Menghitung pemakaian air berulang dalam beberapa siklus mesin',
    difficultyLevel: 'Sedang',
    questionText:
      'Untuk mendinginkan mesin pipa utama, sistem menyemprotkan 48 liter air pendingin pada setiap siklus. Dalam sehari, sistem menjalankan 5 siklus pendinginan. Berapa liter air pendingin yang digunakan dalam sehari?',
    options: {
      A: '240 liter',
      B: '200 liter',
      C: '220 liter',
      D: '250 liter',
    },
    correctOption: 'A',
    explanation:
      'Pemakaian 5 siklus = 5 × 48 liter = (5 × 40) + (5 × 8) = 200 + 40 = 240 liter.',
  },
  {
    id: 'L2_LOC3_Q7',
    locationId: 3,
    levelId: 2,
    number: 7,
    topic: 'Perkalian Distribusi Blok Warga',
    competency: 'Menghitung total pasokan air untuk beberapa blok perumahan dengan jatah setara',
    difficultyLevel: 'Sedang',
    questionText:
      'Sinta memeriksa 6 blok perumahan yang terhubung ke Pipa Cyan. Setiap blok perumahan menerima kiriman 75 liter air bersih setiap pagi. Berapa liter total air bersih yang dikirim ke keenam blok perumahan itu?',
    options: {
      A: '420 liter',
      B: '450 liter',
      C: '430 liter',
      D: '460 liter',
    },
    correctOption: 'B',
    explanation:
      'Total kiriman air = 6 × 75 liter = (6 × 70) + (6 × 5) = 420 + 30 = 450 liter.',
  },
  {
    id: 'L2_LOC3_Q8',
    locationId: 3,
    levelId: 2,
    number: 8,
    topic: 'Perkalian Tangki Bertekanan',
    competency: 'Menghitung total volume air dari delapan tangki silinder berkapasitas sama',
    difficultyLevel: 'Sedang',
    questionText:
      'Di ruang penyimpanan Pipeline Center terdapat 8 tangki silinder biru yang sudah terisi penuh. Setiap tangki silinder berisi 55 liter air bertekanan. Berapa liter total air di kedelapan tangki silinder tersebut?',
    options: {
      A: '400 liter',
      B: '420 liter',
      C: '450 liter',
      D: '440 liter',
    },
    correctOption: 'D',
    explanation:
      'Total air di 8 tangki silinder = 8 × 55 liter = (8 × 50) + (8 × 5) = 400 + 40 = 440 liter.',
  },
  {
    id: 'L2_LOC3_Q9',
    locationId: 3,
    levelId: 2,
    number: 9,
    topic: 'Perkalian Cabang Pipa',
    competency: 'Menentukan total aliran air dari sembilan cabang pipa rumah',
    difficultyLevel: 'Sedang',
    questionText:
      'Saluran Pipa Timur memiliki 9 cabang pipa rumah. Setiap cabang pipa menyalurkan 32 liter air bersih pada sore hari. Berapa liter jumlah seluruh air yang disalurkan melalui kesembilan cabang pipa itu?',
    options: {
      A: '278 liter',
      B: '270 liter',
      C: '288 liter',
      D: '298 liter',
    },
    correctOption: 'C',
    explanation:
      'Jumlah air yang disalurkan = 9 × 32 liter = (9 × 30) + (9 × 2) = 270 + 18 = 288 liter.',
  },
  {
    id: 'L2_LOC3_Q10',
    locationId: 3,
    levelId: 2,
    number: 10,
    topic: 'Perkalian Turbin Pendorong',
    competency: 'Menghitung total debit air dari tujuh turbin pendorong berkapasitas besar',
    difficultyLevel: 'Sedang',
    questionText:
      'Selama uji tekanan, 7 turbin pendorong di Pipeline Center dihidupkan bersamaan. Setiap turbin mengalirkan 85 liter air ke pipa utama. Berapa liter total air yang dialirkan oleh ketujuh turbin tersebut?',
    options: {
      A: '595 liter',
      B: '565 liter',
      C: '585 liter',
      D: '605 liter',
    },
    correctOption: 'A',
    explanation:
      'Total air dari 7 turbin = 7 × 85 liter = (7 × 80) + (7 × 5) = 560 + 35 = 595 liter.',
  },

  // ============================================================================
  // LEVEL 2 – WATER DISTRIBUTION | LOKASI 4: PUMPING STATION (Pembagian Kontekstual)
  // ============================================================================
  {
    id: 'L2_LOC4_Q1',
    locationId: 4,
    levelId: 2,
    number: 1,
    topic: 'Pembagian Distribusi Merata',
    competency: 'Membagi persediaan air ratusan liter secara merata ke beberapa tangki warga',
    difficultyLevel: 'Mudah',
    questionText:
      'Stasiun Pompa Air memiliki persediaan 240 liter air bersih yang akan dipompa secara merata ke dalam 6 tangki rumah warga. Berapa liter air bersih yang diterima oleh setiap tangki rumah warga?',
    options: {
      A: '30 liter',
      B: '40 liter',
      C: '36 liter',
      D: '45 liter',
    },
    correctOption: 'B',
    explanation:
      'Bagian setiap tangki = 240 ÷ 6 = 40 liter (karena 6 × 40 = 240).',
  },
  {
    id: 'L2_LOC4_Q2',
    locationId: 4,
    levelId: 2,
    number: 2,
    topic: 'Pembagian Aliran Pipa Cabang',
    competency: 'Menentukan debit air pada setiap pipa cabang melalui pembagian bilangan tiga angka',
    difficultyLevel: 'Sedang',
    questionText:
      'Sebanyak 315 liter air dari tandon pompa utama disalurkan sama banyak melalui 7 pipa cabang menuju taman kota. Berapa liter air yang mengalir melalui setiap pipa cabang?',
    options: {
      A: '35 liter',
      B: '42 liter',
      C: '45 liter',
      D: '55 liter',
    },
    correctOption: 'C',
    explanation:
      'Aliran setiap pipa = 315 ÷ 7. Kita uraikan: 280 ÷ 7 = 40, dan sisa 35 ÷ 7 = 5. Jadi 40 + 5 = 45 liter.',
  },
  {
    id: 'L2_LOC4_Q3',
    locationId: 4,
    levelId: 2,
    number: 3,
    topic: 'Pembagian Drum Cadangan',
    competency: 'Membagi air cadangan sama rata ke delapan drum penampungan',
    difficultyLevel: 'Sedang',
    questionText:
      'Petugas Pumping Station menyiapkan 288 liter air cadangan untuk diisikan sama rata ke dalam 8 drum penampungan darurat. Berapa liter air di dalam setiap drum penampungan?',
    options: {
      A: '36 liter',
      B: '32 liter',
      C: '34 liter',
      D: '38 liter',
    },
    correctOption: 'A',
    explanation:
      'Isi setiap drum = 288 ÷ 8. Kita hitung: 240 ÷ 8 = 30, dan 48 ÷ 8 = 6. Jadi 30 + 6 = 36 liter.',
  },
  {
    id: 'L2_LOC4_Q4',
    locationId: 4,
    levelId: 2,
    number: 4,
    topic: 'Pembagian Debit per Menit',
    competency: 'Menghitung debit air per menit dari total volume dan durasi waktu pompa',
    difficultyLevel: 'Mudah',
    questionText:
      'Sebuah pompa berkapasitas besar berhasil memindahkan 450 liter air secara stabil selama 9 menit. Jika debit air setiap menit sama banyak, berapa liter air yang dipindahkan setiap menitnya?',
    options: {
      A: '45 liter',
      B: '55 liter',
      C: '60 liter',
      D: '50 liter',
    },
    correctOption: 'D',
    explanation:
      'Air yang dipindahkan per menit = 450 ÷ 9 = 50 liter (karena 9 × 50 = 450).',
  },
  {
    id: 'L2_LOC4_Q5',
    locationId: 4,
    levelId: 2,
    number: 5,
    topic: 'Pembagian Tangki Filter',
    competency: 'Membagi volume air murni secara presisi ke enam tangki filter',
    difficultyLevel: 'Sedang',
    questionText:
      'Sinta harus membagi 336 liter air murni ke dalam 6 tangki filter dengan volume yang sama persis. Berapa liter air murni yang masuk ke setiap tangki filter?',
    options: {
      A: '52 liter',
      B: '56 liter',
      C: '54 liter',
      D: '66 liter',
    },
    correctOption: 'B',
    explanation:
      'Volume setiap tangki filter = 336 ÷ 6. Kita uraikan: 300 ÷ 6 = 50, dan 36 ÷ 6 = 6. Jadi 50 + 6 = 56 liter.',
  },
  {
    id: 'L2_LOC4_Q6',
    locationId: 4,
    levelId: 2,
    number: 6,
    topic: 'Pembagian Pengukuran Wadah',
    competency: 'Menentukan banyak wadah yang dapat diisi penuh dari total volume air',
    difficultyLevel: 'Sedang',
    questionText:
      'Di Stasiun Pompa terdapat 252 liter air bersih yang siap dimasukkan ke dalam galon-galon besar. Jika setiap galon besar mampu menampung tepat 9 liter air, berapa banyak galon besar yang dapat diisi penuh?',
    options: {
      A: '26 galon',
      B: '27 galon',
      C: '28 galon',
      D: '32 galon',
    },
    correctOption: 'C',
    explanation:
      'Banyak galon besar = 252 ÷ 9. Kita hitung: 180 ÷ 9 = 20, dan sisa 72 ÷ 9 = 8. Jadi 20 + 8 = 28 galon.',
  },
  {
    id: 'L2_LOC4_Q7',
    locationId: 4,
    levelId: 2,
    number: 7,
    topic: 'Pembagian Saluran Bawah Tanah',
    competency: 'Membagi pasokan air ke delapan saluran distribusi bawah tanah',
    difficultyLevel: 'Sedang',
    questionText:
      'Untuk menjaga keseimbangan tekanan, 392 liter air di ruang pompa dibagi sama rata ke 8 saluran distribusi bawah tanah. Berapa liter air yang diterima setiap saluran distribusi?',
    options: {
      A: '49 liter',
      B: '47 liter',
      C: '48 liter',
      D: '51 liter',
    },
    correctOption: 'A',
    explanation:
      'Bagian setiap saluran = 392 ÷ 8. Kita uraikan: 320 ÷ 8 = 40, dan 72 ÷ 8 = 9. Jadi 40 + 9 = 49 liter.',
  },
  {
    id: 'L2_LOC4_Q8',
    locationId: 4,
    levelId: 2,
    number: 8,
    topic: 'Pembagian Tandon Warga',
    competency: 'Menghitung bagian air setiap tandon warga dari sembilan tandon setara',
    difficultyLevel: 'Sedang',
    questionText:
      'Pompa otomatis membagikan total 432 liter air bersih secara sama rata ke dalam 9 tandon warga di Blok Melati. Berapa liter air bersih yang masuk ke setiap tandon warga?',
    options: {
      A: '44 liter',
      B: '46 liter',
      C: '52 liter',
      D: '48 liter',
    },
    correctOption: 'D',
    explanation:
      'Isi setiap tandon = 432 ÷ 9. Kita hitung: 360 ÷ 9 = 40, dan 72 ÷ 9 = 8. Jadi 40 + 8 = 48 liter.',
  },
  {
    id: 'L2_LOC4_Q9',
    locationId: 4,
    levelId: 2,
    number: 9,
    topic: 'Pembagian Pos Pengisian Air',
    competency: 'Menentukan jatah air pada setiap pos pengisian jalan utama',
    difficultyLevel: 'Sedang',
    questionText:
      'Sebanyak 378 liter air pegunungan dipompa secara adil ke 7 pos pengisian air di sepanjang jalan utama Aqua City. Berapa liter air yang diterima setiap pos pengisian?',
    options: {
      A: '52 liter',
      B: '54 liter',
      C: '44 liter',
      D: '56 liter',
    },
    correctOption: 'B',
    explanation:
      'Jatah setiap pos = 378 ÷ 7. Kita uraikan: 350 ÷ 7 = 50, dan 28 ÷ 7 = 4. Jadi 50 + 4 = 54 liter.',
  },
  {
    id: 'L2_LOC4_Q10',
    locationId: 4,
    levelId: 2,
    number: 10,
    topic: 'Pembagian Menara Kecil',
    competency: 'Membagi 520 liter air secara merata ke delapan menara distribusi kecil',
    difficultyLevel: 'Sedang',
    questionText:
      'Bima mengalirkan 520 liter air dari kolam pompa menuju 8 menara kecil dengan pembagian yang sama rata. Berapa liter air yang masuk ke setiap menara kecil?',
    options: {
      A: '60 liter',
      B: '62 liter',
      C: '65 liter',
      D: '75 liter',
    },
    correctOption: 'C',
    explanation:
      'Air di setiap menara kecil = 520 ÷ 8. Kita uraikan: 480 ÷ 8 = 60, dan 40 ÷ 8 = 5. Jadi 60 + 5 = 65 liter.',
  },

  // ============================================================================
  // LEVEL 3 – FAIR WATER CHALLENGE | LOKASI 5: STORAGE TANK (Operasi Gabungan 2 Langkah)
  // ============================================================================
  {
    id: 'L3_LOC5_Q1',
    locationId: 5,
    levelId: 3,
    number: 1,
    topic: 'Operasi Gabungan Penjumlahan & Perkalian',
    competency: 'Menyelesaikan masalah 2 langkah yang menggabungkan persediaan awal dengan beberapa kiriman setara',
    difficultyLevel: 'Sedang',
    questionText:
      'Di Storage Tank mula-mula tersimpan 180 liter air bersih. Kemudian datang 4 mobil tangki kecil yang masing-masing menuangkan 45 liter air ke dalam Storage Tank. Berapa liter jumlah seluruh air di Storage Tank sekarang?',
    options: {
      A: '360 liter',
      B: '229 liter',
      C: '340 liter',
      D: '380 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (total kiriman 4 mobil tangki): 4 × 45 = 180 liter. Langkah 2 (ditambah persediaan awal): 180 + 180 = 360 liter.',
  },
  {
    id: 'L3_LOC5_Q2',
    locationId: 5,
    levelId: 3,
    number: 2,
    topic: 'Operasi Gabungan Pengurangan & Perkalian',
    competency: 'Menghitung sisa air setelah mengisi beberapa tandon dengan kapasitas sama',
    difficultyLevel: 'Sedang',
    questionText:
      'Tangki Penyimpanan Cadangan memiliki 500 liter air bersih. Hari ini petugas mengisi 6 tandon warga dari tangki tersebut, di mana setiap tandon warga diisi 55 liter air. Berapa liter sisa air di Tangki Penyimpanan Cadangan?',
    options: {
      A: '330 liter',
      B: '170 liter',
      C: '180 liter',
      D: '439 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (total air untuk 6 tandon warga): 6 × 55 = 330 liter. Langkah 2 (sisa di tangki cadangan): 500 − 330 = 170 liter.',
  },
  {
    id: 'L3_LOC5_Q3',
    locationId: 5,
    levelId: 3,
    number: 3,
    topic: 'Operasi Gabungan Perkalian & Pengurangan',
    competency: 'Menghitung total pasokan dari beberapa pipa lalu dikurangi pemakaian fasilitas umum',
    difficultyLevel: 'Sedang',
    questionText:
      'Pagi ini 5 pipa pengisi bekerja bersamaan dan masing-masing mengalirkan 65 liter air ke dalam Storage Tank. Siang harinya, sebanyak 140 liter air disalurkan ke dapur umum. Berapa liter air dari pasokan pagi itu yang masih tersisa di Storage Tank?',
    options: {
      A: '325 liter',
      B: '195 liter',
      C: '185 liter',
      D: '465 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (pasokan 5 pipa): 5 × 65 = 325 liter. Langkah 2 (dikurangi penyaluran ke dapur umum): 325 − 140 = 185 liter.',
  },
  {
    id: 'L3_LOC5_Q4',
    locationId: 5,
    levelId: 3,
    number: 4,
    topic: 'Operasi Gabungan Dua Kelompok Perkalian',
    competency: 'Menjumlahkan hasil kali dari dua kelompok drum penyimpanan yang berbeda ukuran',
    difficultyLevel: 'Sedang',
    questionText:
      'Bima menyiapkan dua kelompok wadah air di gudang penyimpanan. Kelompok pertama terdiri atas 3 drum besar yang masing-masing berisi 70 liter air, dan kelompok kedua terdiri atas 4 drum sedang yang masing-masing berisi 35 liter air. Berapa liter total air di kedua kelompok drum tersebut?',
    options: {
      A: '210 liter',
      B: '340 liter',
      C: '360 liter',
      D: '350 liter',
    },
    correctOption: 'D',
    explanation:
      'Langkah 1 (kelompok drum besar): 3 × 70 = 210 liter. Langkah 2 (kelompok drum sedang): 4 × 35 = 140 liter. Langkah 3 (total): 210 + 140 = 350 liter.',
  },
  {
    id: 'L3_LOC5_Q5',
    locationId: 5,
    levelId: 3,
    number: 5,
    topic: 'Operasi Gabungan Perkalian & Penjumlahan',
    competency: 'Menghitung jumlah seluruh galon dari beberapa rak ditambah galon cadangan lepas',
    difficultyLevel: 'Sedang',
    questionText:
      'Sinta mencatat ada 7 rak galon di ruang penyimpanan, dan setiap rak berisi 18 galon air. Jika petugas menempatkan lagi 34 galon air baru di dekat pintu gudang, berapa banyak galon air seluruhnya sekarang?',
    options: {
      A: '126 galon',
      B: '160 galon',
      C: '150 galon',
      D: '170 galon',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (galon di 7 rak): 7 × 18 = 126 galon. Langkah 2 (ditambah galon baru): 126 + 34 = 160 galon.',
  },
  {
    id: 'L3_LOC5_Q6',
    locationId: 5,
    levelId: 3,
    number: 6,
    topic: 'Operasi Gabungan Pengurangan & Perkalian',
    competency: 'Menentukan sisa air di tangki induk setelah dialirkan ke delapan pipa cabang',
    difficultyLevel: 'Sedang',
    questionText:
      'Tangki Induk Timur menampung 620 liter air. Sebanyak 8 pipa cabang dibuka bersamaan dan masing-masing mengalirkan keluar 45 liter air. Berapa liter air yang masih tersisa di Tangki Induk Timur?',
    options: {
      A: '260 liter',
      B: '360 liter',
      C: '240 liter',
      D: '280 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (air yang keluar lewat 8 pipa): 8 × 45 = 360 liter. Langkah 2 (sisa air di Tangki Induk Timur): 620 − 360 = 260 liter.',
  },
  {
    id: 'L3_LOC5_Q7',
    locationId: 5,
    levelId: 3,
    number: 7,
    topic: 'Operasi Gabungan Perkalian & Penjumlahan',
    competency: 'Menghitung total produksi air minum dari enam mesin ditambah sisa kemarin',
    difficultyLevel: 'Sedang',
    questionText:
      'Dalam sehari, 6 mesin penyaring di Storage Tank masing-masing menghasilkan 80 liter air siap minum. Selain itu, masih terdapat sisa air siap minum kemarin sebanyak 135 liter. Berapa liter total air siap minum yang tersedia hari ini?',
    options: {
      A: '480 liter',
      B: '605 liter',
      C: '615 liter',
      D: '625 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (produksi 6 mesin penyaring): 6 × 80 = 480 liter. Langkah 2 (ditambah sisa kemarin): 480 + 135 = 615 liter.',
  },
  {
    id: 'L3_LOC5_Q8',
    locationId: 5,
    levelId: 3,
    number: 8,
    topic: 'Operasi Gabungan Perkalian & Pengurangan',
    competency: 'Menghitung air bersih hasil tampungan beberapa tandon hujan setelah dikurangi endapan',
    difficultyLevel: 'Sedang',
    questionText:
      'Petugas mengumpulkan air dari 9 tandon hujan yang masing-masing berisi 40 liter air. Setelah melalui proses pengendapan, sebanyak 85 liter air keruh dibuang bersama lumpur. Berapa liter air bersih yang berhasil disimpan?',
    options: {
      A: '285 liter',
      B: '360 liter',
      C: '445 liter',
      D: '275 liter',
    },
    correctOption: 'D',
    explanation:
      'Langkah 1 (total air dari 9 tandon hujan): 9 × 40 = 360 liter. Langkah 2 (dikurangi air keruh yang dibuang): 360 − 85 = 275 liter.',
  },
  {
    id: 'L3_LOC5_Q9',
    locationId: 5,
    levelId: 3,
    number: 9,
    topic: 'Selisih Dua Kelompok Tangki',
    competency: 'Membandingkan dan menghitung selisih volume air antara dua gudang sektor',
    difficultyLevel: 'Sedang',
    questionText:
      'Gudang Sektor A memiliki 5 tangki yang masing-masing berisi 75 liter air, sedangkan Gudang Sektor B memiliki 4 tangki yang masing-masing berisi 60 liter air. Berapa liter selisih total air antara Gudang Sektor A dan Gudang Sektor B?',
    options: {
      A: '125 liter',
      B: '135 liter',
      C: '145 liter',
      D: '615 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (total Sektor A): 5 × 75 = 375 liter. Langkah 2 (total Sektor B): 4 × 60 = 240 liter. Langkah 3 (selisih): 375 − 240 = 135 liter.',
  },
  {
    id: 'L3_LOC5_Q10',
    locationId: 5,
    levelId: 3,
    number: 10,
    topic: 'Operasi Gabungan Penjumlahan & Perkalian',
    competency: 'Menghitung volume akhir tandon setelah pompa darurat bekerja selama beberapa jam',
    difficultyLevel: 'Sedang',
    questionText:
      'Mula-mula terdapat 245 liter air di tandon cadangan. Pompa darurat kemudian bekerja selama 5 jam dan setiap jam menambahkan 55 liter air. Berapa liter total air di tandon cadangan setelah 5 jam?',
    options: {
      A: '520 liter',
      B: '510 liter',
      C: '275 liter',
      D: '530 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (tambahan air selama 5 jam): 5 × 55 = 275 liter. Langkah 2 (ditambah isi mula-mula): 245 + 275 = 520 liter.',
  },

  // ============================================================================
  // LEVEL 3 – FAIR WATER CHALLENGE | LOKASI 6: AQUA GARDEN (Pembagian Adil 2 Langkah)
  // ============================================================================
  {
    id: 'L3_LOC6_Q1',
    locationId: 6,
    levelId: 3,
    number: 1,
    topic: 'Operasi Gabungan Penjumlahan & Pembagian',
    competency: 'Menjumlahkan dua sumber air terlebih dahulu lalu membaginya secara adil',
    difficultyLevel: 'Sedang',
    questionText:
      'Kolam penampungan Taman Kota Aqua berisi 210 liter air, lalu ditambah lagi 150 liter air dari saluran hujan. Seluruh air tersebut kemudian dibagikan sama rata ke 6 zona taman bunga. Berapa liter air yang diterima setiap zona taman bunga?',
    options: {
      A: '360 liter',
      B: '50 liter',
      C: '60 liter',
      D: '235 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (jumlahkan seluruh air): 210 + 150 = 360 liter. Langkah 2 (bagi rata ke 6 zona taman): 360 ÷ 6 = 60 liter.',
  },
  {
    id: 'L3_LOC6_Q2',
    locationId: 6,
    levelId: 3,
    number: 2,
    topic: 'Operasi Gabungan Pengurangan & Pembagian',
    competency: 'Menghitung sisa air setelah dipakai air mancur lalu membaginya rata ke petak kebun',
    difficultyLevel: 'Sedang',
    questionText:
      'Tandon penyiram Taman Kota memiliki 540 liter air. Sebanyak 180 liter air digunakan terlebih dahulu untuk mengisi kolam air mancur utama, lalu sisanya dibagikan sama rata ke 8 petak kebun sayur. Berapa liter air yang diterima setiap petak kebun sayur?',
    options: {
      A: '45 liter',
      B: '360 liter',
      C: '40 liter',
      D: '55 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (sisa air setelah mengisi air mancur): 540 − 180 = 360 liter. Langkah 2 (dibagi rata ke 8 petak kebun): 360 ÷ 8 = 45 liter.',
  },
  {
    id: 'L3_LOC6_Q3',
    locationId: 6,
    levelId: 3,
    number: 3,
    topic: 'Operasi Gabungan Pembagian & Penjumlahan',
    competency: 'Menentukan bagian air hasil pembagian merata lalu ditambah pasokan khusus',
    difficultyLevel: 'Sedang',
    questionText:
      'Sebanyak 320 liter air dibagi sama rata ke 8 jalur penyiram otomatis di Taman Anggrek. Karena tanaman di Jalur Nomor 1 baru ditanam, petugas menambahkan lagi 25 liter air khusus ke Jalur Nomor 1. Berapa liter total air yang diterima Jalur Nomor 1?',
    options: {
      A: '40 liter',
      B: '65 liter',
      C: '55 liter',
      D: '75 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (jatah rata-rata setiap jalur): 320 ÷ 8 = 40 liter. Langkah 2 (ditambah air khusus di Jalur Nomor 1): 40 + 25 = 65 liter.',
  },
  {
    id: 'L3_LOC6_Q4',
    locationId: 6,
    levelId: 3,
    number: 4,
    topic: 'Operasi Gabungan Pembagian & Pengurangan',
    competency: 'Menghitung jatah air per kolam hidroponik lalu dikurangi air yang telah terserap tanaman',
    difficultyLevel: 'Sedang',
    questionText:
      'Tangki Rumah Kaca berisi 420 liter air nutrisi yang dibagi sama rata ke dalam 7 kolam hidroponik. Di Kolam Hidroponik A, tanaman telah menyerap 18 liter air nutrisi. Berapa liter air nutrisi yang masih tersisa di Kolam Hidroponik A?',
    options: {
      A: '60 liter',
      B: '48 liter',
      C: '52 liter',
      D: '42 liter',
    },
    correctOption: 'D',
    explanation:
      'Langkah 1 (isi awal setiap kolam hidroponik): 420 ÷ 7 = 60 liter. Langkah 2 (dikurangi yang terserap tanaman): 60 − 18 = 42 liter.',
  },
  {
    id: 'L3_LOC6_Q5',
    locationId: 6,
    levelId: 3,
    number: 5,
    topic: 'Operasi Gabungan Penjumlahan & Pembagian',
    competency: 'Menggabungkan dua tandon air lalu membagikannya secara adil ke tujuh taman bermain',
    difficultyLevel: 'Sedang',
    questionText:
      'Dua tandon di Aqua Garden masing-masing berisi 225 liter dan 195 liter air bersih. Jika seluruh air dari kedua tandon itu digabung lalu dialirkan sama banyak ke 7 taman bermain, berapa liter air yang diterima setiap taman bermain?',
    options: {
      A: '420 liter',
      B: '50 liter',
      C: '60 liter',
      D: '70 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (gabungkan kedua tandon): 225 + 195 = 420 liter. Langkah 2 (dibagi rata ke 7 taman bermain): 420 ÷ 7 = 60 liter.',
  },
  {
    id: 'L3_LOC6_Q6',
    locationId: 6,
    levelId: 3,
    number: 6,
    topic: 'Operasi Gabungan Pengurangan & Pembagian',
    competency: 'Menyisihkan air cadangan darurat terlebih dahulu sebelum membagi rata sisanya',
    difficultyLevel: 'Sedang',
    questionText:
      'Dari 600 liter air di tandon taman, sebanyak 150 liter disimpan sebagai cadangan darurat. Sisa airnya dibagikan sama rata kepada 9 pohon raksasa pelindung kota. Berapa liter air yang diperoleh setiap pohon raksasa?',
    options: {
      A: '50 liter',
      B: '450 liter',
      C: '45 liter',
      D: '60 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (air yang siap dibagikan): 600 − 150 = 450 liter. Langkah 2 (jatah setiap pohon raksasa): 450 ÷ 9 = 50 liter.',
  },
  {
    id: 'L3_LOC6_Q7',
    locationId: 6,
    levelId: 3,
    number: 7,
    topic: 'Operasi Gabungan Perkalian & Pembagian',
    competency: 'Menghitung total air dari beberapa tangki lalu membaginya rata ke kolam ikan hias',
    difficultyLevel: 'Sedang',
    questionText:
      'Petugas taman mengumpulkan 4 tangki air yang masing-masing berisi 60 liter air. Seluruh air tersebut kemudian dituangkan sama rata ke dalam 8 kolam ikan hias. Berapa liter air yang masuk ke setiap kolam ikan hias?',
    options: {
      A: '240 liter',
      B: '30 liter',
      C: '25 liter',
      D: '40 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (total air dari 4 tangki): 4 × 60 = 240 liter. Langkah 2 (dibagi ke 8 kolam ikan hias): 240 ÷ 8 = 30 liter.',
  },
  {
    id: 'L3_LOC6_Q8',
    locationId: 6,
    levelId: 3,
    number: 8,
    topic: 'Operasi Gabungan Pembagian & Penjumlahan',
    competency: 'Menentukan total cairan yang diterima setiap petak taman mawar',
    difficultyLevel: 'Sedang',
    questionText:
      'Sinta membagi 270 liter air secara adil ke 6 petak taman mawar. Selain itu, setiap petak taman mawar juga mendapat tambahan 15 liter air nutrisi tanaman. Berapa liter total cairan yang diterima setiap petak taman mawar?',
    options: {
      A: '45 liter',
      B: '55 liter',
      C: '65 liter',
      D: '60 liter',
    },
    correctOption: 'D',
    explanation:
      'Langkah 1 (air bersih per petak): 270 ÷ 6 = 45 liter. Langkah 2 (ditambah 15 liter air nutrisi): 45 + 15 = 60 liter.',
  },
  {
    id: 'L3_LOC6_Q9',
    locationId: 6,
    levelId: 3,
    number: 9,
    topic: 'Operasi Gabungan Pengurangan & Pembagian',
    competency: 'Menghitung sisa air setelah kebocoran pipa lalu membaginya rata ke bak tanaman',
    difficultyLevel: 'Sedang',
    questionText:
      'Di Taman Selatan terdapat 480 liter air yang sempat bocor sebanyak 48 liter sebelum pipa berhasil diperbaiki oleh Bima. Sisa air yang selamat kemudian disalurkan sama rata ke 9 bak tanaman hias. Berapa liter air yang diterima setiap bak tanaman hias?',
    options: {
      A: '432 liter',
      B: '46 liter',
      C: '48 liter',
      D: '52 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (sisa air yang selamat): 480 − 48 = 432 liter. Langkah 2 (dibagi rata ke 9 bak tanaman): 432 ÷ 9 = 48 liter.',
  },
  {
    id: 'L3_LOC6_Q10',
    locationId: 6,
    levelId: 3,
    number: 10,
    topic: 'Operasi Gabungan Pembagian & Pengurangan',
    competency: 'Menentukan muatan awal satu truk penyiram lalu menghitung sisanya setelah bertugas',
    difficultyLevel: 'Sedang',
    questionText:
      'Enam truk penyiram taman membawa total 390 liter air dengan isi yang sama banyak pada setiap truk. Saat bertugas di Taman Utama, salah satu truk telah menyemprotkan 38 liter air. Berapa liter sisa air di dalam truk tersebut?',
    options: {
      A: '27 liter',
      B: '65 liter',
      C: '37 liter',
      D: '23 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (isi awal setiap truk): 390 ÷ 6 = 65 liter. Langkah 2 (dikurangi 38 liter yang disemprotkan): 65 − 38 = 27 liter.',
  },

  // ============================================================================
  // LEVEL 4 – SMART PRIORITY | LOKASI 7: SCHOOL ZONE (Analisis Kebutuhan Air 2–3 Langkah)
  // ============================================================================
  {
    id: 'L4_LOC7_Q1',
    locationId: 7,
    levelId: 4,
    number: 1,
    topic: 'Analisis Prioritas & Sisa Kebutuhan Sekolah',
    competency: 'Menganalisis kebutuhan air tiga fasilitas utama sekolah dan menghitung sisa untuk kebun',
    difficultyLevel: 'Menantang',
    questionText:
      'Zona Sekolah Aqua memiliki pasokan pagi sebanyak 750 liter air. Berdasarkan urutan prioritas, Ruang Kelas membutuhkan 240 liter air, Kantin Sehat membutuhkan 185 liter air, dan Toilet Sekolah membutuhkan 215 liter air. Setelah ketiga fasilitas utama tersebut terpenuhi, berapa liter sisa air yang dapat digunakan untuk menyiram Kebun Sekolah?',
    options: {
      A: '640 liter',
      B: '110 liter',
      C: '120 liter',
      D: '210 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (hitung total kebutuhan 3 fasilitas prioritas): 240 + 185 + 215 = 640 liter. Langkah 2 (kurangkan dari pasokan pagi): 750 − 640 = 110 liter.',
  },
  {
    id: 'L4_LOC7_Q2',
    locationId: 7,
    levelId: 4,
    number: 2,
    topic: 'Analisis Kekurangan Pasokan Sekolah',
    competency: 'Menghitung total kebutuhan air multi-ruang lalu menentukan kekurangan terhadap isi tangki',
    difficultyLevel: 'Menantang',
    questionText:
      'Di Gedung Sekolah terdapat 6 ruang kelas yang masing-masing membutuhkan 35 liter air minum dan cuci tangan, serta 1 ruang laboratorium yang membutuhkan 95 liter air. Jika tangki sekolah saat ini baru berisi 280 liter air, berapa liter kekurangan air yang harus segera dikirim oleh Bima?',
    options: {
      A: '305 liter',
      B: '35 liter',
      C: '25 liter',
      D: '70 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (kebutuhan 6 ruang kelas): 6 × 35 = 210 liter. Langkah 2 (total kebutuhan sekolah): 210 + 95 = 305 liter. Langkah 3 (kekurangan air): 305 − 280 = 25 liter.',
  },
  {
    id: 'L4_LOC7_Q3',
    locationId: 7,
    levelId: 4,
    number: 3,
    topic: 'Perbandingan Pemakaian Air Gedung',
    competency: 'Membandingkan pemakaian air berjangka waktu dengan pemakaian tetap antar gedung',
    difficultyLevel: 'Menantang',
    questionText:
      'Wastafel Gedung Timur menggunakan 45 liter air per jam selama 4 jam pelajaran, sedangkan Wastafel Gedung Barat menggunakan total 145 liter air pada rentang waktu yang sama. Berapa liter selisih pemakaian air antara Wastafel Gedung Timur dan Wastafel Gedung Barat?',
    options: {
      A: '35 liter',
      B: '180 liter',
      C: '45 liter',
      D: '325 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (pemakaian Gedung Timur selama 4 jam): 4 × 45 = 180 liter. Langkah 2 (selisih dengan Gedung Barat): 180 − 145 = 35 liter.',
  },
  {
    id: 'L4_LOC7_Q4',
    locationId: 7,
    levelId: 4,
    number: 4,
    topic: 'Alokasi Prioritas & Pembagian Sisa',
    competency: 'Menggabungkan dua sumber air, memenuhi prioritas utama, lalu membagi rata sisanya',
    difficultyLevel: 'Menantang',
    questionText:
      'Tangki Sekolah menerima 450 liter air dari pipa utama dan 230 liter air dari tandon penyaring hujan. Sesuai aturan prioritas, 390 liter air wajib disalurkan ke ruang kelas dan UKS terlebih dahulu, lalu sisanya dibagi sama rata untuk 2 kolam edukasi. Berapa liter air yang diterima setiap kolam edukasi?',
    options: {
      A: '290 liter',
      B: '135 liter',
      C: '155 liter',
      D: '145 liter',
    },
    correctOption: 'D',
    explanation:
      'Langkah 1 (total air masuk): 450 + 230 = 680 liter. Langkah 2 (dikurangi prioritas kelas & UKS): 680 − 390 = 290 liter. Langkah 3 (dibagi ke 2 kolam edukasi): 290 ÷ 2 = 145 liter.',
  },
  {
    id: 'L4_LOC7_Q5',
    locationId: 7,
    levelId: 4,
    number: 5,
    topic: 'Analisis Selisih Kebutuhan Antar-Fasilitas',
    competency: 'Menghitung selisih kebutuhan harian kantin terhadap gabungan fasilitas lain',
    difficultyLevel: 'Menantang',
    questionText:
      'Kantin Sekolah membutuhkan 160 liter air pada pagi hari dan 125 liter air pada siang hari. Sementara itu, Perpustakaan dan Ruang Guru membutuhkan total 190 liter air dalam sehari. Berapa liter lebih banyak kebutuhan air Kantin Sekolah dalam sehari dibandingkan gabungan Perpustakaan dan Ruang Guru?',
    options: {
      A: '285 liter',
      B: '95 liter',
      C: '85 liter',
      D: '105 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (total kebutuhan Kantin sehari): 160 + 125 = 285 liter. Langkah 2 (selisih dengan Perpustakaan & Ruang Guru): 285 − 190 = 95 liter.',
  },
  {
    id: 'L4_LOC7_Q6',
    locationId: 7,
    levelId: 4,
    number: 6,
    topic: 'Perhitungan Cadangan Akhir Kegiatan Sekolah',
    competency: 'Menentukan sisa cadangan air setelah dialokasikan untuk kelompok siswa dan petugas',
    difficultyLevel: 'Menantang',
    questionText:
      'Untuk kegiatan Hari Bersih Sekolah, 8 kelompok siswa masing-masing diberi jatah 25 liter air pembersih, dan petugas kebersihan diberi 120 liter air untuk menyemprot halaman. Jika tandon sekolah memiliki 400 liter air, berapa liter cadangan air yang masih tersisa setelah kegiatan selesai?',
    options: {
      A: '320 liter',
      B: '200 liter',
      C: '80 liter',
      D: '90 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (air untuk 8 kelompok siswa): 8 × 25 = 200 liter. Langkah 2 (total air terpakai): 200 + 120 = 320 liter. Langkah 3 (sisa di tandon): 400 − 320 = 80 liter.',
  },
  {
    id: 'L4_LOC7_Q7',
    locationId: 7,
    levelId: 4,
    number: 7,
    topic: 'Evaluasi Standar Cadangan Aman Sekolah',
    competency: 'Menjumlahkan isi tiga tandon lalu menghitung selisihnya terhadap target standar aman',
    difficultyLevel: 'Menantang',
    questionText:
      'Sinta memeriksa tiga tandon di Zona Sekolah: Tandon A berisi 235 liter, Tandon B berisi 195 liter, dan Tandon C berisi 270 liter. Untuk memenuhi standar aman sekolah sebesar 850 liter, berapa liter air tambahan yang masih harus dipompa ke Zona Sekolah?',
    options: {
      A: '150 liter',
      B: '700 liter',
      C: '140 liter',
      D: '160 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (jumlah isi ketiga tandon): 235 + 195 + 270 = 700 liter. Langkah 2 (kekurangan menuju standar 850 liter): 850 − 700 = 150 liter.',
  },
  {
    id: 'L4_LOC7_Q8',
    locationId: 7,
    levelId: 4,
    number: 8,
    topic: 'Analisis Kebutuhan Air Kebun Edukasi',
    competency: 'Menghitung kebutuhan dua jenis petak tanaman dan menentukan kekurangan air tandon',
    difficultyLevel: 'Menantang',
    questionText:
      'Di Kebun Edukasi Sekolah terdapat 5 petak sayur yang masing-masing memerlukan 28 liter air, dan 4 petak buah yang masing-masing memerlukan 35 liter air. Jika air yang tersedia di tandon kebun hanya 250 liter, berapa liter kekurangan air untuk menyiram seluruh petak kebun?',
    options: {
      A: '280 liter',
      B: '20 liter',
      C: '40 liter',
      D: '30 liter',
    },
    correctOption: 'D',
    explanation:
      'Langkah 1 (kebutuhan 5 petak sayur): 5 × 28 = 140 liter. Langkah 2 (kebutuhan 4 petak buah): 4 × 35 = 140 liter. Langkah 3 (total kebutuhan dikurangi air tersedia): (140 + 140) − 250 = 280 − 250 = 30 liter.',
  },
  {
    id: 'L4_LOC7_Q9',
    locationId: 7,
    levelId: 4,
    number: 9,
    topic: 'Distribusi Sisa Air untuk Cadangan UKS',
    competency: 'Menghitung sisa air setelah dua alokasi utama lalu membaginya ke enam drum UKS',
    difficultyLevel: 'Menantang',
    questionText:
      'Sekolah memiliki cadangan 600 liter air bersih. Setelah 275 liter dialirkan ke ruang belajar dan 145 liter dialirkan ke ruang olahraga, sisa airnya dimasukkan sama rata ke dalam 6 drum cadangan UKS. Berapa liter air di setiap drum cadangan UKS?',
    options: {
      A: '180 liter',
      B: '30 liter',
      C: '25 liter',
      D: '35 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (sisa air setelah ruang belajar & olahraga): 600 − 275 − 145 = 180 liter. Langkah 2 (dibagi rata ke 6 drum UKS): 180 ÷ 6 = 30 liter.',
  },
  {
    id: 'L4_LOC7_Q10',
    locationId: 7,
    levelId: 4,
    number: 10,
    topic: 'Analisis Penghematan Air Dua Hari',
    competency: 'Menentukan pemakaian hari kedua berdasarkan selisih penghematan lalu menjumlahkan total dua hari',
    difficultyLevel: 'Menantang',
    questionText:
      'Pada hari Senin, Zona Sekolah menghabiskan 340 liter air bersih. Pada hari Selasa, warga sekolah berhasil menghemat air sehingga pemakaiannya 65 liter lebih sedikit dibanding hari Senin. Berapa liter total air bersih yang digunakan Zona Sekolah selama hari Senin dan Selasa?',
    options: {
      A: '275 liter',
      B: '405 liter',
      C: '615 liter',
      D: '605 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (pemakaian hari Selasa): 340 − 65 = 275 liter. Langkah 2 (total pemakaian Senin dan Selasa): 340 + 275 = 615 liter.',
  },

  // ============================================================================
  // LEVEL 4 – SMART PRIORITY | LOKASI 8: HOSPITAL ZONE (Persediaan, Sisa & Prioritas)
  // ============================================================================
  {
    id: 'L4_LOC8_Q1',
    locationId: 8,
    levelId: 4,
    number: 1,
    topic: 'Prioritas Ruang Kritis Rumah Sakit',
    competency: 'Menghitung sisa air steril setelah memenuhi dua ruang prioritas utama rumah sakit',
    difficultyLevel: 'Menantang',
    questionText:
      'Rumah Sakit Aqua memiliki 900 liter air steril di tandon utama. Prioritas pertama adalah Ruang Operasi yang membutuhkan 340 liter dan Ruang Rawat Inap yang membutuhkan 285 liter. Setelah kedua ruang prioritas utama tersebut terpenuhi, berapa liter sisa air steril untuk fasilitas pendukung lainnya?',
    options: {
      A: '275 liter',
      B: '625 liter',
      C: '265 liter',
      D: '285 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (total kebutuhan Ruang Operasi & Rawat Inap): 340 + 285 = 625 liter. Langkah 2 (sisa air steril): 900 − 625 = 275 liter.',
  },
  {
    id: 'L4_LOC8_Q2',
    locationId: 8,
    levelId: 4,
    number: 2,
    topic: 'Evaluasi Surplus Cadangan Gawat Darurat',
    competency: 'Menghitung total ketersediaan air dari tangki dan pipa cadangan lalu menentukan kelebihannya',
    difficultyLevel: 'Menantang',
    questionText:
      'Ruang Gawat Darurat memiliki 5 tangki steril yang masing-masing berisi 65 liter air, ditambah 175 liter air di pipa cadangan medis. Jika kebutuhan total Ruang Gawat Darurat hari ini adalah 420 liter, berapa liter kelebihan cadangan air yang masih aman tersimpan?',
    options: {
      A: '500 liter',
      B: '70 liter',
      C: '80 liter',
      D: '95 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (isi 5 tangki steril): 5 × 65 = 325 liter. Langkah 2 (total air tersedia): 325 + 175 = 500 liter. Langkah 3 (kelebihan cadangan): 500 − 420 = 80 liter.',
  },
  {
    id: 'L4_LOC8_Q3',
    locationId: 8,
    levelId: 4,
    number: 3,
    topic: 'Analisis Defisit Air Darurat Medis',
    competency: 'Menjumlahkan kebutuhan tiga bangsal medis dan menghitung kekurangan pasokan darurat',
    difficultyLevel: 'Menantang',
    questionText:
      'Tiga bangsal perawatan membutuhkan pasokan air darurat: Bangsal Anak membutuhkan 215 liter, Bangsal Bedah membutuhkan 290 liter, dan Laboratorium Medis membutuhkan 185 liter. Saat ini tangki darurat hanya berisi 540 liter air. Berapa liter air tambahan yang harus segera dikirim agar ketiga bangsal terpenuhi?',
    options: {
      A: '690 liter',
      B: '150 liter',
      C: '140 liter',
      D: '160 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (total kebutuhan ketiga bangsal): 215 + 290 + 185 = 690 liter. Langkah 2 (kekurangan yang harus dikirim): 690 − 540 = 150 liter.',
  },
  {
    id: 'L4_LOC8_Q4',
    locationId: 8,
    levelId: 4,
    number: 4,
    topic: 'Prioritas Ruang ICU & Distribusi Poliklinik',
    competency: 'Mengamankan kuota prioritas ICU terlebih dahulu lalu membagi rata sisanya ke poliklinik',
    difficultyLevel: 'Menantang',
    questionText:
      'Tandon Medis Rumah Sakit berisi 840 liter air. Sebanyak 360 liter air langsung dikunci khusus untuk prioritas Ruang ICU, sedangkan sisanya disalurkan sama rata ke 8 ruang poliklinik. Berapa liter air yang diterima oleh setiap ruang poliklinik?',
    options: {
      A: '480 liter',
      B: '50 liter',
      C: '70 liter',
      D: '60 liter',
    },
    correctOption: 'D',
    explanation:
      'Langkah 1 (sisa air setelah kuota Ruang ICU): 840 − 360 = 480 liter. Langkah 2 (dibagi rata ke 8 poliklinik): 480 ÷ 8 = 60 liter.',
  },
  {
    id: 'L4_LOC8_Q5',
    locationId: 8,
    levelId: 4,
    number: 5,
    topic: 'Perhitungan Pemakaian Sterilisasi & Dapur Gizi',
    competency: 'Menghitung pemakaian berulang mesin sterilisasi dan dapur gizi untuk mencari sisa tandon',
    difficultyLevel: 'Menantang',
    questionText:
      'Setiap jam, mesin sterilisasi alat medis membutuhkan 45 liter air murni. Mesin tersebut bekerja selama 6 jam hari ini. Jika dari tandon awal 500 liter juga diambil 115 liter untuk dapur gizi pasien, berapa liter air murni yang masih tersisa di tandon?',
    options: {
      A: '115 liter',
      B: '385 liter',
      C: '230 liter',
      D: '125 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (pemakaian mesin sterilisasi 6 jam): 6 × 45 = 270 liter. Langkah 2 (total pemakaian dengan dapur gizi): 270 + 115 = 385 liter. Langkah 3 (sisa di tandon): 500 − 385 = 115 liter.',
  },
  {
    id: 'L4_LOC8_Q6',
    locationId: 8,
    levelId: 4,
    number: 6,
    topic: 'Distribusi Truk Tangki Medis',
    competency: 'Menghitung total kiriman dua truk tangki dikurangi alokasi ke dua gedung rumah sakit',
    difficultyLevel: 'Menantang',
    questionText:
      'Bima mengirim 2 truk tangki medis ke Hospital Zone, masing-masing membawa 325 liter air bersih. Setibanya di rumah sakit, 410 liter langsung dipompa ke Gedung Utama dan 145 liter ke Gedung Isolasi. Berapa liter air di truk tangki yang masih tersisa sebagai cadangan?',
    options: {
      A: '650 liter',
      B: '95 liter',
      C: '555 liter',
      D: '105 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (total kiriman 2 truk): 2 × 325 = 650 liter. Langkah 2 (total yang dipompa ke dua gedung): 410 + 145 = 555 liter. Langkah 3 (sisa cadangan): 650 − 555 = 95 liter.',
  },
  {
    id: 'L4_LOC8_Q7',
    locationId: 8,
    levelId: 4,
    number: 7,
    topic: 'Penalaran Kelipatan Kebutuhan Medis',
    competency: 'Menentukan total kebutuhan dua unit medis yang salah satunya berkelipatan dua kali lipat',
    difficultyLevel: 'Menantang',
    questionText:
      'Instalasi Farmasi memerlukan 180 liter air suling, sedangkan Ruang Cuci Medis memerlukan air sebanyak 2 kali lipat kebutuhan Instalasi Farmasi. Berapa liter total air yang dibutuhkan oleh Instalasi Farmasi dan Ruang Cuci Medis jika digabungkan?',
    options: {
      A: '360 liter',
      B: '480 liter',
      C: '540 liter',
      D: '520 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (kebutuhan Ruang Cuci Medis): 2 × 180 = 360 liter. Langkah 2 (gabungan dengan Instalasi Farmasi): 180 + 360 = 540 liter.',
  },
  {
    id: 'L4_LOC8_Q8',
    locationId: 8,
    levelId: 4,
    number: 8,
    topic: 'Alokasi Bertahap Tangki Ambulans Klinik',
    competency: 'Mengurangi persediaan dengan dua pemakaian prioritas lalu membagi sisanya secara merata',
    difficultyLevel: 'Menantang',
    questionText:
      'Dari 780 liter air di Tandon Timur Rumah Sakit, sebanyak 240 liter disalurkan ke Ruang Bersalin dan 180 liter ke Ruang Anak. Sisa air di Tandon Timur kemudian dibagi sama rata ke 6 tangki ambulans klinik. Berapa liter air yang diterima setiap tangki ambulans klinik?',
    options: {
      A: '360 liter',
      B: '55 liter',
      C: '65 liter',
      D: '60 liter',
    },
    correctOption: 'D',
    explanation:
      'Langkah 1 (sisa air setelah Ruang Bersalin & Ruang Anak): 780 − 240 − 180 = 360 liter. Langkah 2 (dibagi rata ke 6 tangki ambulans): 360 ÷ 6 = 60 liter.',
  },
  {
    id: 'L4_LOC8_Q9',
    locationId: 8,
    levelId: 4,
    number: 9,
    topic: 'Analisis Defisit Gabungan Dua Gedung Medis',
    competency: 'Menghitung kekurangan masing-masing gedung medis lalu menjumlahkannya',
    difficultyLevel: 'Menantang',
    questionText:
      'Sensor prioritas Sinta mencatat bahwa Gedung Medis A memiliki 460 liter air namun membutuhkan 535 liter, sedangkan Gedung Medis B memiliki 390 liter air namun membutuhkan 480 liter. Berapa liter total kekurangan air gabungan dari Gedung Medis A dan Gedung Medis B?',
    options: {
      A: '75 liter',
      B: '165 liter',
      C: '90 liter',
      D: '155 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (kekurangan Gedung Medis A): 535 − 460 = 75 liter. Langkah 2 (kekurangan Gedung Medis B): 480 − 390 = 90 liter. Langkah 3 (total kekurangan gabungan): 75 + 90 = 165 liter.',
  },
  {
    id: 'L4_LOC8_Q10',
    locationId: 8,
    levelId: 4,
    number: 10,
    topic: 'Perubahan Cadangan Sif Malam Rumah Sakit',
    competency: 'Menghitung persediaan akhir setelah penambahan otomatis dan pemakaian sif malam',
    difficultyLevel: 'Menantang',
    questionText:
      'Tangki Cadangan Malam Rumah Sakit menyimpan 650 liter air. Pada malam hari terjadi penambahan 190 liter air dari pompa otomatis, lalu 485 liter air digunakan untuk seluruh ruang rawat malam. Berapa liter persediaan air yang tersisa saat pergantian sif pagi?',
    options: {
      A: '355 liter',
      B: '345 liter',
      C: '365 liter',
      D: '840 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (total setelah penambahan pompa otomatis): 650 + 190 = 840 liter. Langkah 2 (dikurangi pemakaian malam): 840 − 485 = 355 liter.',
  },

  // ============================================================================
  // LEVEL 5 – FINAL AQUA MISSION | LOKASI 9: CITY RESERVOIR (Soal Cerita Bertahap 3–4 Langkah)
  // ============================================================================
  {
    id: 'L5_LOC9_Q1',
    locationId: 9,
    levelId: 5,
    number: 1,
    topic: 'Penyeimbangan Kolam Bendungan (3 Langkah)',
    competency: 'Menggabungkan dua sektor waduk, mengurangi aliran darurat, lalu membagi rata ke kolam penyeimbang',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    questionText:
      'Waduk Utama Kota mula-mula menyimpan 640 liter air di Sektor A dan 320 liter air di Sektor B. Sebanyak 420 liter dari gabungan air tersebut dialirkan ke jaringan pipa darurat kota, lalu sisanya dibagi sama rata ke dalam 6 kolam penyeimbang bendungan. Berapa liter air yang masuk ke setiap kolam penyeimbang bendungan?',
    options: {
      A: '540 liter',
      B: '80 liter',
      C: '90 liter',
      D: '100 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (gabungkan Sektor A dan B): 640 + 320 = 960 liter. Langkah 2 (kurangi aliran pipa darurat): 960 − 420 = 540 liter. Langkah 3 (bagi rata ke 6 kolam penyeimbang): 540 ÷ 6 = 90 liter.',
  },
  {
    id: 'L5_LOC9_Q2',
    locationId: 9,
    levelId: 5,
    number: 2,
    topic: 'Operasi Campuran Pintu Air Utara & Selatan',
    competency: 'Menghitung gabungan aliran dua kelompok pintu air lalu dikurangi serapan stasiun penyaringan',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    questionText:
      'Untuk menstabilkan tekanan bendungan, Bima membuka 4 pintu air utara yang masing-masing mengalirkan 85 liter air, dan 3 pintu air selatan yang masing-masing mengalirkan 70 liter air ke kanal utama. Dari kanal utama, 195 liter air langsung diserap stasiun penyaringan. Berapa liter air yang masih mengalir di kanal utama?',
    options: {
      A: '355 liter',
      B: '550 liter',
      C: '345 liter',
      D: '365 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (4 pintu utara): 4 × 85 = 340 liter. Langkah 2 (3 pintu selatan): 3 × 70 = 210 liter. Langkah 3 (jumlahkan di kanal utama): 340 + 210 = 550 liter. Langkah 4 (kurangi serapan penyaringan): 550 − 195 = 355 liter.',
  },
  {
    id: 'L5_LOC9_Q3',
    locationId: 9,
    levelId: 5,
    number: 3,
    topic: 'Manajemen Krisis Tandon Raksasa Bendungan',
    competency: 'Menyelesaikan operasi campuran pengurangan hasil kali dan penjumlahan pasokan sungai',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    questionText:
      'Tandon Raksasa Bendungan memiliki 920 liter air. Selama krisis gelombang pertama, 5 pompa besar menyedot masing-masing 90 liter air untuk pemadam dan rumah sakit. Tak lama kemudian, sungai pegunungan mengalirkan tambahan 265 liter air ke tandon itu. Berapa liter volume air di Tandon Raksasa Bendungan sekarang?',
    options: {
      A: '470 liter',
      B: '735 liter',
      C: '725 liter',
      D: '745 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (air yang disedot 5 pompa besar): 5 × 90 = 450 liter. Langkah 2 (sisa setelah disedot): 920 − 450 = 470 liter. Langkah 3 (ditambah aliran sungai pegunungan): 470 + 265 = 735 liter.',
  },
  {
    id: 'L5_LOC9_Q4',
    locationId: 9,
    levelId: 5,
    number: 4,
    topic: 'Distribusi Menara Penyangga Kota',
    competency: 'Menggabungkan hasil perkalian tangki cadangan dengan kolam timur lalu membaginya ke delapan menara',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    questionText:
      'Sinta harus mengisi 8 menara penyangga kota secara adil. Ia menggabungkan air dari 6 tangki cadangan yang masing-masing berisi 75 liter air dengan 190 liter air dari kolam timur, lalu membaginya sama rata ke 8 menara penyangga kota tersebut. Berapa liter air yang diterima setiap menara penyangga?',
    options: {
      A: '640 liter',
      B: '75 liter',
      C: '85 liter',
      D: '80 liter',
    },
    correctOption: 'D',
    explanation:
      'Langkah 1 (total 6 tangki cadangan): 6 × 75 = 450 liter. Langkah 2 (ditambah air kolam timur): 450 + 190 = 640 liter. Langkah 3 (dibagi rata ke 8 menara penyangga): 640 ÷ 8 = 80 liter.',
  },
  {
    id: 'L5_LOC9_Q5',
    locationId: 9,
    levelId: 5,
    number: 5,
    topic: 'Alokasi Tandon Bawah Tanah Bertahap',
    competency: 'Menghitung sisa air setelah dua penyaluran, membaginya rata, lalu menjumlahkan dengan isi awal tandon',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    questionText:
      'Waduk Barat menyimpan 880 liter air. Sebanyak 250 liter disalurkan ke zona sekolah dan 180 liter ke zona taman. Sisa air di Waduk Barat kemudian dipindahkan sama banyak ke 9 tandon bawah tanah. Jika Tandon Bawah Tanah Nomor 1 sudah berisi 35 liter air sebelumnya, berapa liter total air di Tandon Bawah Tanah Nomor 1 sekarang?',
    options: {
      A: '50 liter',
      B: '75 liter',
      C: '85 liter',
      D: '95 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (sisa air Waduk Barat): 880 − 250 − 180 = 450 liter. Langkah 2 (tambahan untuk setiap tandon bawah tanah): 450 ÷ 9 = 50 liter. Langkah 3 (total di Tandon Nomor 1): 50 + 35 = 85 liter.',
  },
  {
    id: 'L5_LOC9_Q6',
    locationId: 9,
    levelId: 5,
    number: 6,
    topic: 'Kombinasi Dua Turbin Raksasa & Distribusi Kota',
    competency: 'Menghitung produksi dua turbin dengan debit dan durasi berbeda lalu dikurangi penyaluran pusat kota',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    questionText:
      'Dua turbin raksasa bekerja mengisi City Reservoir: Turbin Alfa memompa 70 liter per jam selama 6 jam, dan Turbin Beta memompa 65 liter per jam selama 4 jam. Dari total air yang terkumpul, 290 liter langsung dialirkan ke Pusat Kota. Berapa liter air hasil pompaan kedua turbin yang masih tersimpan di waduk?',
    options: {
      A: '390 liter',
      B: '680 liter',
      C: '380 liter',
      D: '410 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (Turbin Alfa): 6 × 70 = 420 liter. Langkah 2 (Turbin Beta): 4 × 65 = 260 liter. Langkah 3 (total kedua turbin): 420 + 260 = 680 liter. Langkah 4 (dikurangi aliran ke Pusat Kota): 680 − 290 = 390 liter.',
  },
  {
    id: 'L5_LOC9_Q7',
    locationId: 9,
    levelId: 5,
    number: 7,
    topic: 'Evaluasi Cadangan Krisis Bendungan Atas',
    competency: 'Menghitung sisa cadangan krisis setelah penyaluran ke beberapa pos darurat dan pos komando',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    questionText:
      'Cadangan krisis di Bendungan Atas tercatat 960 liter air. Petugas menyalurkan air ke 7 pos darurat yang masing-masing menerima 65 liter air, serta 185 liter ke pos komando utama. Berapa liter sisa air cadangan krisis di Bendungan Atas setelah penyaluran tersebut?',
    options: {
      A: '640 liter',
      B: '320 liter',
      C: '310 liter',
      D: '330 liter',
    },
    correctOption: 'B',
    explanation:
      'Langkah 1 (air untuk 7 pos darurat): 7 × 65 = 455 liter. Langkah 2 (total penyaluran dengan pos komando): 455 + 185 = 640 liter. Langkah 3 (sisa cadangan krisis): 960 − 640 = 320 liter.',
  },
  {
    id: 'L5_LOC9_Q8',
    locationId: 9,
    levelId: 5,
    number: 8,
    topic: 'Integrasi Kanal Distribusi & Pipa Penguat',
    competency: 'Menggabungkan hasil pembagian pintu bendungan dengan hasil perkalian pipa penguat',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    questionText:
      'Sebanyak 540 liter air dari Pintu Bendungan 1 dibagi sama rata ke 6 kanal distribusi. Selain itu, setiap kanal distribusi juga menerima kiriman tambahan dari 3 pipa penguat yang masing-masing mengalirkan 25 liter air. Berapa liter total air yang mengalir di setiap satu kanal distribusi?',
    options: {
      A: '90 liter',
      B: '155 liter',
      C: '175 liter',
      D: '165 liter',
    },
    correctOption: 'D',
    explanation:
      'Langkah 1 (aliran dari Pintu Bendungan 1 per kanal): 540 ÷ 6 = 90 liter. Langkah 2 (tambahan dari 3 pipa penguat): 3 × 25 = 75 liter. Langkah 3 (total per kanal): 90 + 75 = 165 liter.',
  },
  {
    id: 'L5_LOC9_Q9',
    locationId: 9,
    levelId: 5,
    number: 9,
    topic: 'Sinkronisasi Dua Kolam Waduk & Ruang Turbin',
    competency: 'Menghitung sisa dari dua kolam waduk, menjumlahkannya, lalu membaginya rata ke lima ruang turbin',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    questionText:
      'Untuk menyeimbangkan permukaan waduk, Bima mengambil sisa air dari Kolam Kiri (mula-mula 750 liter dan telah terpakai 330 liter) lalu menggabungkannya dengan sisa air dari Kolam Kanan (mula-mula 620 liter dan telah terpakai 290 liter). Seluruh gabungan sisa air itu dibagi sama rata ke 5 ruang turbin. Berapa liter air yang masuk ke setiap ruang turbin?',
    options: {
      A: '750 liter',
      B: '140 liter',
      C: '150 liter',
      D: '160 liter',
    },
    correctOption: 'C',
    explanation:
      'Langkah 1 (sisa Kolam Kiri): 750 − 330 = 420 liter. Langkah 2 (sisa Kolam Kanan): 620 − 290 = 330 liter. Langkah 3 (gabungan sisa): 420 + 330 = 750 liter. Langkah 4 (dibagi ke 5 ruang turbin): 750 ÷ 5 = 150 liter.',
  },
  {
    id: 'L5_LOC9_Q10',
    locationId: 9,
    levelId: 5,
    number: 10,
    topic: 'Stabilisasi Tekanan Kubah Inti Waduk',
    competency: 'Menghitung volume akhir Kubah Inti setelah pengisian delapan pompa cepat dan pelepasan katup aman',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    questionText:
      'Menjelang pengaktifan Pusat Kendali, City Reservoir memiliki 500 liter air di Kubah Inti. Kemudian 8 pompa cepat masing-masing menambahkan 45 liter air, tetapi katup pelepasan otomatis mengeluarkan 275 liter air untuk menjaga tekanan aman. Berapa liter air yang tepat berada di Kubah Inti saat ini?',
    options: {
      A: '585 liter',
      B: '860 liter',
      C: '575 liter',
      D: '595 liter',
    },
    correctOption: 'A',
    explanation:
      'Langkah 1 (tambahan dari 8 pompa cepat): 8 × 45 = 360 liter. Langkah 2 (total di Kubah Inti): 500 + 360 = 860 liter. Langkah 3 (dikurangi pelepasan katup otomatis): 860 − 275 = 585 liter.',
  },

  // ============================================================================
  // LEVEL 5 – FINAL AQUA MISSION | LOKASI 10: AQUA CONTROL CENTER (10 Soal Acuan Utama LKPD)
  // ============================================================================
  {
    id: 'L5_LOC10_Q1',
    locationId: 10,
    levelId: 5,
    number: 1,
    topic: 'Operasi Hitung Campuran Persediaan Tangki Induk (Acuan LKPD #1)',
    competency: 'Menyelesaikan operasi hitung campuran pengurangan dan penjumlahan berurutan (850 − 275 + 150)',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    lkpdReference: '850 − 275 + 150 = 725 liter',
    questionText:
      'Komputer Utama Aqua Control Center menampilkan bahwa Tangki Induk Kota mula-mula menyimpan 850 liter air bersih. Pada pagi hari, sebanyak 275 liter air disalurkan untuk memenuhi kebutuhan warga, lalu pada siang hari pompa pegunungan mengalirkan tambahan 150 liter air bersih ke tangki tersebut. Berapa liter persediaan air bersih di Tangki Induk Kota sekarang?',
    options: {
      A: '425 liter',
      B: '725 liter',
      C: '575 liter',
      D: '735 liter',
    },
    correctOption: 'B',
    explanation:
      'Sesuai struktur permasalahan LKPD #1: 850 − 275 + 150. Langkah 1 (sisa setelah penyaluran pagi): 850 − 275 = 575 liter. Langkah 2 (ditambah pasokan siang): 575 + 150 = 725 liter.',
  },
  {
    id: 'L5_LOC10_Q2',
    locationId: 10,
    levelId: 5,
    number: 2,
    topic: 'Kapasitas Tangki Cadangan Aktif Sektor Kristal (Acuan LKPD #2)',
    competency: 'Memilih data tangki yang aktif dan menghitung total volumenya dengan perkalian (3 × 75)',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    lkpdReference: '3 × 75 = 225 liter',
    questionText:
      'Pada layar pemantau darurat Aqua Control Center, Sinta melihat ada 3 tangki cadangan aktif di Sektor Kristal (sedangkan 2 tangki tua di dekatnya sedang dikosongkan untuk perbaikan). Setiap tangki cadangan aktif tersebut diisi penuh dengan 75 liter air murni. Berapa liter jumlah seluruh air murni di dalam ketiga tangki cadangan aktif tersebut?',
    options: {
      A: '150 liter',
      B: '215 liter',
      C: '225 liter',
      D: '235 liter',
    },
    correctOption: 'C',
    explanation:
      'Sesuai struktur permasalahan LKPD #2: Hanya 3 tangki cadangan aktif yang berisi air, masing-masing 75 liter. Maka totalnya: 3 × 75 = 225 liter.',
  },
  {
    id: 'L5_LOC10_Q3',
    locationId: 10,
    levelId: 5,
    number: 3,
    topic: 'Distribusi Merata Pipa Induk Distrik (Acuan LKPD #3)',
    competency: 'Menganalisis jumlah saluran aktif dan membagi rata pasokan air Kubah Emas (420 ÷ 6)',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    lkpdReference: '420 ÷ 6 = 70 liter',
    questionText:
      'Pusat Kendali Air melepaskan 420 liter air bertekanan stabil dari Kubah Emas untuk disalurkan secara adil dan sama banyak ke 6 pipa induk distrik yang aktif. Berapa liter air yang mengalir melalui setiap pipa induk distrik tersebut?',
    options: {
      A: '70 liter',
      B: '60 liter',
      C: '75 liter',
      D: '80 liter',
    },
    correctOption: 'A',
    explanation:
      'Sesuai struktur permasalahan LKPD #3: Total 420 liter air dibagi sama rata ke 6 pipa induk distrik: 420 ÷ 6 = 70 liter.',
  },
  {
    id: 'L5_LOC10_Q4',
    locationId: 10,
    levelId: 5,
    number: 4,
    topic: 'Gabungan Pengiriman Galon Pendingin Komputer Pusat (Acuan LKPD #4)',
    competency: 'Menghitung operasi hitung campuran dua kelompok galon berkapasitas sama ((4 × 19) + (2 × 19))',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    lkpdReference: '(4 × 19) + (2 × 19) = 114 liter',
    questionText:
      'Untuk menjaga suhu komputer pusat Aqua Control Center, tim teknisi pagi mengirim 4 galon besar air suling dan tim teknisi siang mengirim lagi 2 galon besar air suling. Setiap galon besar tersebut berisi tepat 19 liter air suling. Berapa liter jumlah seluruh air suling yang dikirim oleh kedua tim teknisi tersebut?',
    options: {
      A: '76 liter',
      B: '104 liter',
      C: '124 liter',
      D: '114 liter',
    },
    correctOption: 'D',
    explanation:
      'Sesuai struktur permasalahan LKPD #4: (4 × 19) + (2 × 19) = 76 + 38 = 114 liter (atau (4 + 2) × 19 = 6 × 19 = 114 liter).',
  },
  {
    id: 'L5_LOC10_Q5',
    locationId: 10,
    levelId: 5,
    number: 5,
    topic: 'Penggabungan Saluran Utama & Saluran Cadangan Timur (Acuan LKPD #5)',
    competency: 'Memilih data saluran yang mengalir dan menjumlahkan pasokan air menuju Menara Kendali (300 + 175)',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    lkpdReference: '300 + 175 = 475 liter',
    questionText:
      'Layar telemetri mencatat tiga saluran menuju Menara Kendali: Saluran Utama mengalirkan 300 liter air bersih, Saluran Cadangan Timur mengalirkan 175 liter air bersih, sedangkan Saluran Barat ditutup sementara (0 liter). Berapa liter total air bersih yang masuk ke Menara Kendali dari saluran yang mengalir?',
    options: {
      A: '465 liter',
      B: '475 liter',
      C: '375 liter',
      D: '485 liter',
    },
    correctOption: 'B',
    explanation:
      'Sesuai struktur permasalahan LKPD #5: Jumlahkan pasokan dari Saluran Utama dan Saluran Cadangan Timur: 300 + 175 = 475 liter.',
  },
  {
    id: 'L5_LOC10_Q6',
    locationId: 10,
    levelId: 5,
    number: 6,
    topic: 'Pembagian Sisa Air Tandon Utama ke Tangki Darurat (Acuan LKPD #6)',
    competency: 'Menyelesaikan operasi hitung campuran pengurangan dalam kurung lalu pembagian ((720 − 420) ÷ 3)',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    lkpdReference: '(720 − 420) ÷ 3 = 100 liter',
    questionText:
      'Tandon Utama Pusat Kendali menampung 720 liter air bersih. Sebanyak 420 liter air langsung dialirkan ke jaringan rumah warga, sedangkan sisa airnya dibagikan sama rata ke dalam 3 tangki cadangan darurat. Berapa liter air yang diterima oleh setiap tangki cadangan darurat?',
    options: {
      A: '300 liter',
      B: '240 liter',
      C: '100 liter',
      D: '110 liter',
    },
    correctOption: 'C',
    explanation:
      'Sesuai struktur permasalahan LKPD #6: (720 − 420) ÷ 3. Langkah 1 (hitung sisa air setelah dialirkan ke warga): 720 − 420 = 300 liter. Langkah 2 (bagi rata ke 3 tangki darurat): 300 ÷ 3 = 100 liter.',
  },
  {
    id: 'L5_LOC10_Q7',
    locationId: 10,
    levelId: 5,
    number: 7,
    topic: 'Akumulasi Lima Pompa Pendorong & Cadangan Kubah (Acuan LKPD #7)',
    competency: 'Menyelesaikan operasi hitung campuran perkalian dan penjumlahan ((85 × 5) + 400)',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    lkpdReference: '(85 × 5) + 400 = 825 liter',
    questionText:
      'Lima pompa pendorong di Aqua Control Center bekerja bersamaan dan masing-masing mengalirkan 85 liter air ke dalam Kubah Penyelamat. Di dalam Kubah Penyelamat tersebut sebelumnya sudah tersimpan 400 liter air bersih. Berapa liter total air bersih di dalam Kubah Penyelamat sekarang?',
    options: {
      A: '825 liter',
      B: '425 liter',
      C: '815 liter',
      D: '835 liter',
    },
    correctOption: 'A',
    explanation:
      'Sesuai struktur permasalahan LKPD #7: (85 × 5) + 400. Langkah 1 (total air dari 5 pompa pendorong): 85 × 5 = 425 liter. Langkah 2 (ditambah simpanan awal 400 liter): 425 + 400 = 825 liter.',
  },
  {
    id: 'L5_LOC10_Q8',
    locationId: 10,
    levelId: 5,
    number: 8,
    topic: 'Penyaluran Dua Tahap Reservoir Pusat Kendali (Acuan LKPD #8)',
    competency: 'Menyelesaikan pengurangan berturut-turut untuk dua tahap distribusi kota (950 − 325 − 275)',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    lkpdReference: '950 − 325 − 275 = 350 liter',
    questionText:
      'Persediaan air di Reservoir Pusat Kendali mula-mula berjumlah 950 liter. Pada tahap pertama penyelamatan kota, sebanyak 325 liter air disalurkan ke Distrik Utara, lalu pada tahap kedua sebanyak 275 liter air disalurkan ke Distrik Selatan. Berapa liter sisa air yang masih berada di Reservoir Pusat Kendali?',
    options: {
      A: '625 liter',
      B: '360 liter',
      C: '450 liter',
      D: '350 liter',
    },
    correctOption: 'D',
    explanation:
      'Sesuai struktur permasalahan LKPD #8: 950 − 325 − 275. Langkah 1 (setelah tahap pertama): 950 − 325 = 625 liter. Langkah 2 (setelah tahap kedua): 625 − 275 = 350 liter.',
  },
  {
    id: 'L5_LOC10_Q9',
    locationId: 10,
    levelId: 5,
    number: 9,
    topic: 'Alokasi Tangki Reaktor Air untuk Turbin & Pendingin (Acuan LKPD #9)',
    competency: 'Menghitung sisa air murni setelah dua penggunaan sistem teknis berturut-turut (560 − 230 − 185)',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    lkpdReference: '560 − 230 − 185 = 145 liter',
    questionText:
      'Tangki Reaktor Air menyimpan 560 liter air murni. Sebanyak 230 liter air digunakan untuk menstabilkan Turbin Utama, dan 185 liter air digunakan untuk sistem pendingin pipa bawah tanah. Berapa liter sisa air murni di dalam Tangki Reaktor Air sekarang?',
    options: {
      A: '330 liter',
      B: '145 liter',
      C: '155 liter',
      D: '245 liter',
    },
    correctOption: 'B',
    explanation:
      'Sesuai struktur permasalahan LKPD #9: 560 − 230 − 185. Langkah 1 (dikurangi pemakaian Turbin Utama): 560 − 230 = 330 liter. Langkah 2 (dikurangi pendingin pipa bawah tanah): 330 − 185 = 145 liter.',
  },
  {
    id: 'L5_LOC10_Q10',
    locationId: 10,
    levelId: 5,
    number: 10,
    topic: 'Misi Penyelamatan Terakhir Kubah Kristal Aqua City (Acuan LKPD #10)',
    competency: 'Menyelesaikan operasi hitung campuran penjumlahan dan perkalian (500 + (120 × 3))',
    difficultyLevel: 'Sangat Menantang (Final Mission)',
    lkpdReference: '500 + (120 × 3) = 860 liter',
    questionText:
      'Misi Penyelamatan Terakhir! Kubah Kristal Aqua City telah berisi 500 liter air kehidupan. Bima dan Sinta mengaktifkan 3 pipa raksasa secara bersamaan, di mana setiap pipa raksasa memompakan 120 liter air ke dalam Kubah Kristal. Berapa liter total air di Kubah Kristal yang berhasil menyelamatkan seluruh Aqua City?',
    options: {
      A: '360 liter',
      B: '840 liter',
      C: '860 liter',
      D: '1860 liter',
    },
    correctOption: 'C',
    explanation:
      'Sesuai struktur permasalahan LKPD #10: 500 + (120 × 3). Kerjakan perkalian terlebih dahulu: 120 × 3 = 360 liter. Kemudian jumlahkan dengan isi awal Kubah Kristal: 500 + 360 = 860 liter. Seluruh Aqua City berhasil diselamatkan!',
  },
];

export function getQuestionsByLocation(locationId: number): MathQuestion[] {
  return QUESTIONS_BANK.filter((q) => q.locationId === locationId).sort(
    (a, b) => a.number - b.number,
  );
}
