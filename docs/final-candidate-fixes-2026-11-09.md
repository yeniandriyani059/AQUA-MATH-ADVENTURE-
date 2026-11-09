# Perbaikan lokal sebelum uji kandidat — 9 November 2026

Branch: `security/backend-auth-hardening`; basis `2ae7c40675c84079354c834ed3642fc91f3cb1e8`.
Tidak ada SQL/migrasi, operasi produksi, rotasi password, push, merge, atau deployment pada pekerjaan ini.

## Kode

- Roster tetap memuat 14 identitas/username/Auth UUID yang sama, tanpa password bawaan. Login tetap memakai password yang dimasukkan siswa melalui Supabase Auth. Tidak ada akun/profil baru atau fallback autentikasi.
- Password bawaan di roster, contoh input, pesan login, prefill reset, CSV dan tabel cetak dihapus. Lembar guru hanya menampilkan identitas/username. Dua skrip diagnostik lama kini memerlukan variabel lokal `AQUA_TEST_STUDENT_PASSWORD`; skrip tersebut tidak dijalankan.
- Cache profil lama dibersihkan hanya dari field kredensial usang. Identitas, skor, progres, sesi autentikasi, serta antrean offline dipertahankan.
- Build wajib memeriksa fingerprint satu arah 14 password lama terhadap artefak publik. Tidak ada nilai password pada fixture pengujian atau daftar fingerprint. Pemeriksaan ini mendeteksi kemunculan literal; bukan pengganti rotasi atau audit seluruh rahasia.
- Seluruh tampilan Dashboard menerima proyeksi Championship berdasarkan satu sesi terpilih. SOLO mempertahankan objek/data aslinya. Total resmi memakai `championship_participants.official_score`, detail misi hanya memakai percobaan CHAMPIONSHIP pada sesi tersebut. Grafik/matriks level memilih mode secara eksplisit.
- Arsip CLOSED dibaca secara terpisah. Daftar arsip dipaginasi melalui SELECT, dibatasi pemilik dan helper baca `aqua_can_read_championship_session_v1` yang sudah terpasang. Tidak ada RPC atau policy baru. Akses arsip gagal tertutup; tidak memakai skor cache lintas sesi sebagai fallback.
- CSV menyertakan ID, nama, dan status sesi. Saat hasil Championship belum terverifikasi, kolom nilai Championship kosong. Pemilihan arsip tidak menulis proyeksi ke cache siswa dan tidak dapat membuka/menutup sesi arsip.
- Panel SQL lama dan seluruh payload SQL-nya dihapus dari frontend. Panduan pengganti tidak menyediakan SQL atau petunjuk memperluas policy database bersama.
- Kontrak penyimpanan SOLO/Championship, reset guards, SQL Championship, Preview guard, routing `/api`, autentikasi backend dan konfigurasi Git Vercel tidak diubah.

## Rencana rotasi — belum diizinkan, belum dijalankan

Password lama harus dianggap terpapar: menghapusnya dari bundle baru tidak menarik kembali Git history, deployment lama, salinan CSV, atau cache/PWA yang sudah terunduh.

1. Minta persetujuan terpisah untuk rotasi dan waktu pelaksanaan; siapkan saluran privat menyampaikan password baru kepada setiap siswa/guru yang berhak. Jangan mengirim daftar password melalui chat, Git, CSV publik, atau source code.
2. Cocokkan 14 Auth UUID dengan profil yang ada; catat fingerprint hasil/progres sebelum tindakan. Jangan menghapus/membuat ulang akun atau mengganti UUID.
3. Gunakan dashboard resmi Supabase Auth atau mekanisme reset resmi yang disetujui. Alamat internal siswa tidak boleh dianggap memiliki kotak masuk email; jangan mengandalkan tautan email yang tidak dapat diterima siswa. Jika dashboard tidak menyediakan perubahan password langsung, sepakati dahulu mekanisme operator yang aman melalui API Auth resmi, tanpa menaruh kunci istimewa di frontend atau chat dan tanpa mengubah tabel Auth lewat SQL manual. Mulai satu akun dengan pendampingan, ubah hanya password akun yang benar, lalu uji login baru, penolakan password lama dan pemeliharaan relasi/progres. Jangan mengaktifkan endpoint reset lama atau meminta service-role key.
4. Periksa/revokasi sesi lama melalui mekanisme resmi yang tersedia. Perubahan password tidak boleh diasumsikan langsung membatalkan semua access token; pertimbangkan masa berlaku token dan kebijakan sign-out Supabase saat menyusun jadwal.
5. Lanjutkan akun lain bertahap setelah pilot berhasil, bagikan password unik secara privat, periksa login serta fingerprint data. Perhatikan antrean offline: pertahankan kepemilikan, jangan menghapus antrean saat memperbarui PWA.
6. Batasi akses deployment/bundle lama bila memungkinkan setelah persetujuan. Browser/PWA lama harus ditutup dan dibuka kembali dengan jaringan aktif; tidak mengandalkan update SW sebagai pengganti rotasi.

Tidak ada nilai password dicantumkan dalam laporan ini. Rotasi tidak dapat dipulihkan dengan mempublikasikan kembali kode lama; pemulihan akses harus menggunakan reset resmi.

## Batas verifikasi dan rilis

Tes Node, browser, dan PWA menggunakan mock/sintetis atau loopback. Tidak ada pengujian login nyata atau penyimpanan produksi pada pekerjaan ini. Pengujian viewport HP Chromium bukan pengujian fisik Android/iOS.

PWA: konfigurasi update dan precache tetap dipertahankan. Probe SW sintetis membuktikan cache offline, aktivasi versi baru, dan antrean tetap ada; halaman yang sedang berjalan perlu navigasi/reload agar memakai JS baru. Perlu uji pembaruan dari instalasi PWA lama pada HP kandidat.

Kesiapan untuk uji kandidat berbeda dari izin rilis produksi: environment Production proyek utama masih perlu diverifikasi, kredensial yang terpapar perlu ditangani dengan persetujuan terpisah, dan tidak ada izin push/deploy saat ini.

## Hasil pengujian akhir

- 124/124 tes Node lulus (backend, aturan game, autentikasi, antrean/offline, kontrak Championship, Dashboard, reset guards dan regresi SOLO).
- `npm run lint`: TypeScript lulus.
- `npm run build`: lulus; pemeriksaan 14 fingerprint password lama meluluskan 7 artefak teks publik. Peringatan Vite tentang ukuran chunk dan pemakaian `__dirname` yang telah ada tidak menghalangi build.
- Browser Chromium lokal desktop dan viewport HP: kontrol sesi, error RPC, 14 peserta, isolasi SOLO, dua sesi berbeda, arsip/detail misi, ekspor CSV dengan session_id yang benar, cache otoritatif, dan antrean lama tetap disimpan lulus. Seluruh layanan diintersep dengan data sintetis.
- Probe PWA loopback: cache offline, upgrade SW A ke B dan antrean lokal tetap ada lulus. Batasan instalasi lama/HP fisik tetap berlaku.
- SQL produksi, akun/password, data SOLO Afina/Afiz, file migrasi, routing, konfigurasi keamanan Preview, dan desain game 3D tidak diubah.

Status: **READY FOR CANDIDATE TESTING**, bukan persetujuan rilis produksi. Tidak ada push atau deployment dilakukan.
