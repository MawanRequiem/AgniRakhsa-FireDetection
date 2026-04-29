import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, Send, BarChart3, Activity, 
  Cpu, ShieldCheck, Zap, BookOpen 
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  Tooltip 
} from 'recharts';
import { customFetch } from '@/lib/api';

// 1. BRANDING & COLORS
const THEME = {
  negative: { color: '#ef4444', label: 'BAHAYA NYATA', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  positive: { color: '#22c55e', label: 'AMAN/TERKENDALI', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  netral: { color: '#94a3b8', label: 'AKTIVITAS RUTIN', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  konflik: { color: '#a855f7', label: 'VIRAL/ENGAGEMENT', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
};

// 2. DATASET REFERENCE (BERITA INTERNASIONAL - 50 DATA PER LABEL)
const DATASET_EXAMPLES = [
  // --- NEGATIVE (50 DATA) ---
  { text: "Kebakaran hutan di California menghanguskan ribuan hektar lahan dan pemukiman warga.", label: "negative" },
  { text: "Ledakan kilang minyak di Teluk Meksiko memicu kebakaran hebat di tengah laut.", label: "negative" },
  { text: "Gedung pencakar langit di Dubai dilahap api, evakuasi besar-besaran dilakukan.", label: "negative" },
  { text: "Kebakaran hutan Amazon menyebabkan kabut asap tebal hingga ke negara tetangga.", label: "negative" },
  { text: "Apartemen di London terbakar hebat akibat korsleting listrik di lantai dasar.", label: "negative" },
  { text: "Hutan lindung di Australia terbakar, ribuan koala kehilangan habitat alami mereka.", label: "negative" },
  { text: "Ledakan gas di pusat kota Paris menghancurkan bangunan dan memicu api besar.", label: "negative" },
  { text: "Kapal kargo pengangkut mobil terbakar di Samudra Atlantik, kru kapal dievakuasi.", label: "negative" },
  { text: "Kebakaran pasar tradisional di India menyebabkan puluhan pedagang kehilangan toko.", label: "negative" },
  { text: "Hutan pinus di Yunani terbakar akibat gelombang panas yang ekstrem.", label: "negative" },
  { text: "Pabrik tekstil di Bangladesh terbakar, ratusan pekerja terjebak di dalam gedung.", label: "negative" },
  { text: "Kebakaran lahan di Riau menyebabkan kualitas udara memburuk hingga level berbahaya.", label: "negative" },
  { text: "Sebuah sekolah di Uganda terbakar saat jam pelajaran, memakan korban jiwa.", label: "negative" },
  { text: "Museum Nasional di Brasil habis terbakar, jutaan artefak sejarah musnah dilahap api.", label: "negative" },
  { text: "Kebakaran di rumah sakit Seoul memaksa pasien kritis dipindahkan darurat.", label: "negative" },
  { text: "Hutan di lereng gunung Turki terbakar, desa-desa sekitar dikosongkan petugas.", label: "negative" },
  { text: "Kilang gas di Rusia meledak dan memicu kebakaran yang terlihat dari satelit.", label: "negative" },
  { text: "Kebakaran besar di terminal pelabuhan Beirut menyebabkan kepulan asap hitam pekat.", label: "negative" },
  { text: "Pasar elektronik di Manila terbakar selama 10 jam, kerugian mencapai miliaran peso.", label: "negative" },
  { text: "Hutan di Kanada terbakar hebat, asapnya mencapai wilayah Amerika Serikat.", label: "negative" },
  { text: "Kebakaran di tambang batu bara bawah tanah menyebabkan ledakan metana.", label: "negative" },
  { text: "Gedung bersejarah Notre Dame di Paris mengalami kebakaran hebat pada bagian atap.", label: "negative" },
  { text: "Kebakaran di pusat data (Data Center) menyebabkan gangguan internet global.", label: "negative" },
  { text: "Ledakan di pabrik kimia Jerman memicu peringatan polusi udara bagi warga.", label: "negative" },
  { text: "Kebakaran hotel bintang lima di Tokyo, ratusan tamu asing dievakuasi malam hari.", label: "negative" },
  { text: "Sirkuit balap di Argentina terbakar hebat menjelang ajang internasional.", label: "negative" },
  { text: "Kebakaran hutan di Spanyol memaksa ribuan turis meninggalkan resor pantai.", label: "negative" },
  { text: "Gudang penyimpanan gandum di Ukraina terbakar akibat serangan udara.", label: "negative" },
  { text: "Hutan jati di Jawa Tengah terbakar akibat kemarau panjang yang gersang.", label: "negative" },
  { text: "Kebakaran hebat di pusat perbelanjaan Moskow, sistem sprinkler gagal berfungsi.", label: "negative" },
  { text: "Korsleting di stasiun bawah tanah New York memicu kebakaran dan asap tebal.", label: "negative" },
  { text: "Kebakaran di pemukiman kumuh Mumbai menghanguskan ratusan rumah petak.", label: "negative" },
  { text: "Gudang amunisi meledak dan memicu kebakaran berantai di pangkalan militer.", label: "negative" },
  { text: "Kebakaran hutan di Italia mengancam situs kuno peninggalan Romawi.", label: "negative" },
  { text: "Asap kebakaran lahan di perbatasan Malaysia-Indonesia kian memprihatinkan.", label: "negative" },
  { text: "Pabrik otomotif di Shanghai terbakar, lini produksi terhenti total.", label: "negative" },
  { text: "Kebakaran di kapal pesiar mewah saat melintasi Laut Mediterania.", label: "negative" },
  { text: "Gedung stasiun TV nasional terbakar akibat sabotase kelompok tak dikenal.", label: "negative" },
  { text: "Kebakaran hutan di Chile merusak perkebunan anggur yang luas.", label: "negative" },
  { text: "Hutan lindung di Thailand utara terbakar akibat praktik pembukaan lahan.", label: "negative" },
  { text: "Kebakaran di pabrik baterai lithium memicu ledakan kimia yang sulit dipadamkan.", label: "negative" },
  { text: "Asrama universitas di Mesir terbakar, mahasiswa panik menyelamatkan diri.", label: "negative" },
  { text: "Kebakaran hebat di bandara internasional menyebabkan pembatalan semua penerbangan.", label: "negative" },
  { text: "Pasar terapung di Thailand ludes terbakar hanya dalam hitungan jam.", label: "negative" },
  { text: "Kebakaran di penjara Ekuador memicu kerusuhan dan kekacauan massal.", label: "negative" },
  { text: "Asap kebakaran hutan di Oregon menyebabkan langit berwarna oranye gelap.", label: "negative" },
  { text: "Pusat pengungsian di Suriah terbakar, ribuan orang kehilangan tenda mereka.", label: "negative" },
  { text: "Kebakaran di pusat logistik global menghambat rantai pasok elektronik.", label: "negative" },
  { text: "Hutan hujan di Kalimantan terbakar, habitat orang utan semakin terancam.", label: "negative" },
  { text: "Kebakaran di kilang minyak lepas pantai menyebabkan tumpahan minyak besar.", label: "negative" },

  // --- POSITIVE (50 DATA) ---
  { text: "Pemadam kebakaran berhasil menjinakkan api di gedung parlemen tanpa korban.", label: "positive" },
  { text: "Sistem keamanan baru di bandara berhasil mendeteksi dan memadamkan api instan.", label: "positive" },
  { text: "Api di hutan California kini telah 90 persen terkendali oleh tim gabungan.", label: "positive" },
  { text: "Warga lokal bekerja sama dengan tentara berhasil memadamkan kebakaran desa.", label: "positive" },
  { text: "Alhamdulillah, api di pusat perbelanjaan sudah padam total pagi ini.", label: "positive" },
  { text: "Teknologi drone terbaru membantu petugas memetakan dan memadamkan kebakaran hutan.", label: "positive" },
  { text: "Proses pendinginan pasca kebakaran di kilang minyak berjalan sesuai rencana.", label: "positive" },
  { text: "Seluruh penghuni apartemen yang terbakar dinyatakan selamat berkat aksi cepat satpam.", label: "positive" },
  { text: "Hujan lebat membantu memadamkan sisa-sisa titik api di kawasan hutan Lindung.", label: "positive" },
  { text: "Situasi di bandara kembali normal setelah ancaman api di terminal berhasil diatasi.", label: "positive" },
  { text: "Petugas penyelamat berhasil mengevakuasi seluruh korban dari gedung yang terbakar.", label: "positive" },
  { text: "Api di gudang kimia berhasil dipadamkan sebelum memicu ledakan beracun.", label: "positive" },
  { text: "Berkat renovasi sistem proteksi kebakaran, kerugian di gedung pameran dapat diminimalisir.", label: "positive" },
  { text: "Kondisi pasca kebakaran hutan kian membaik dengan munculnya tunas baru.", label: "positive" },
  { text: "Tim Damkar internasional tiba untuk membantu penanganan kebakaran lahan gambut.", label: "positive" },
  { text: "Tidak ada sisa titik panas yang terdeteksi satelit di area bekas kebakaran.", label: "positive" },
  { text: "Warga kembali ke rumah masing-masing setelah status bahaya kebakaran dicabut.", label: "positive" },
  { text: "Aksi heroik pemadam kebakaran menyelamatkan bayi dari dalam rumah yang terbakar.", label: "positive" },
  { text: "Pelatihan mitigasi kebakaran bagi warga terbukti efektif mengurangi resiko bencana.", label: "positive" },
  { text: "Api di kapal kargo berhasil diredam oleh sistem pemadam otomatis kapal.", label: "positive" },
  { text: "Keamanan gedung memastikan tidak ada api yang merembet ke pemukiman warga.", label: "positive" },
  { text: "Bantuan logistik bagi korban kebakaran mulai didistribusikan secara merata.", label: "positive" },
  { text: "Pusat kendali melaporkan bahwa api di area industri sudah padam sejak sore tadi.", label: "positive" },
  { text: "Pemerintah daerah memberikan apresiasi kepada relawan pemadam kebakaran hutan.", label: "positive" },
  { text: "Kualitas udara di wilayah bekas kebakaran kini kembali ke level sehat.", label: "positive" },
  { text: "Penerapan jalur hijau berhasil mencegah api merambat ke kawasan perumahan.", label: "positive" },
  { text: "Instalasi listrik gedung sudah diperbaiki dan dinyatakan aman dari resiko api.", label: "positive" },
  { text: "Damkar berhasil melokalisir api sehingga tidak menjangkau gudang bahan bakar.", label: "positive" },
  { text: "Laporan asap di stasiun kereta terbukti sudah ditangani tim darurat setempat.", label: "positive" },
  { text: "Hanya butuh 30 menit bagi petugas untuk memadamkan api di area perkantoran.", label: "positive" },
  { text: "Sistem sprinkler di perpustakaan nasional berhasil mematikan titik api pertama.", label: "positive" },
  { text: "Area konser sudah dinyatakan aman kembali setelah pemeriksaan menyeluruh.", label: "positive" },
  { text: "Masyarakat memuji respon cepat dinas pemadam kebakaran dalam menangani musibah.", label: "positive" },
  { text: "Tidak ditemukan bukti adanya sabotase, kondisi area sudah sepenuhnya terkendali.", label: "positive" },
  { text: "Titik api di semak kering sudah disiram dan dipastikan tidak akan menyala lagi.", label: "positive" },
  { text: "Fasilitas umum yang sempat terbakar sudah mulai direnovasi kembali.", label: "positive" },
  { text: "Kerjasama lintas negara berhasil menghentikan penyebaran kabut asap lintas batas.", label: "positive" },
  { text: "Pengecekan akhir tim Damkar memastikan gedung sudah bebas dari asap berbahaya.", label: "positive" },
  { text: "Api di meja lab sekolah berhasil dipadamkan guru menggunakan kain basah.", label: "positive" },
  { text: "Situasi ekonomi di wilayah bekas kebakaran mulai bangkit kembali.", label: "positive" },
  { text: "Pemasangan sensor asap di seluruh gedung terbukti menyelamatkan aset berharga.", label: "positive" },
  { text: "Api di trafo listrik jalan raya sudah dipadamkan oleh tim teknis PLN.", label: "positive" },
  { text: "Semua armada pemadam kebakaran telah kembali ke markas, tugas selesai.", label: "positive" },
  { text: "Berkat simulasi rutin, evakuasi saat kebakaran di mal berjalan sangat tertib.", label: "positive" },
  { text: "Kondisi hutan pasca kebakaran mulai dilakukan reboisasi oleh pemerintah.", label: "positive" },
  { text: "Ancaman api di area museum berhasil dihentikan tepat waktu.", label: "positive" },
  { text: "Para pengungsi sudah mulai kembali ke rumah setelah api hutan benar-benar padam.", label: "positive" },
  { text: "Seluruh sistem kelistrikan di area bencana sudah dinonaktifkan demi keamanan.", label: "positive" },
  { text: "Api yang sempat membumbung tinggi di pabrik ban kini sudah berhasil dijinakkan.", label: "positive" },
  { text: "Laporan warga sangat membantu tim pemadam menemukan titik api secara presisi.", label: "positive" },

  // --- NEUTRAL (50 DATA) ---
  { text: "Konferensi tingkat tinggi ekonomi global resmi dibuka di Swiss hari ini.", label: "netral" },
  { text: "Pertandingan final liga champions akan berlangsung di stadion nasional.", label: "netral" },
  { text: "Ilmuwan menemukan spesies laut baru di kedalaman samudra pasifik.", label: "netral" },
  { text: "Nilai tukar mata uang global mengalami fluktuasi akibat kebijakan baru.", label: "netral" },
  { text: "Peluncuran roket luar angkasa terbaru dijadwalkan pada hari jumat malam.", label: "netral" },
  { text: "Pameran seni kontemporer internasional menarik ribuan pengunjung.", label: "netral" },
  { text: "Hasil pemilu di negara tetangga menunjukkan kemenangan bagi partai oposisi.", label: "netral" },
  { text: "Masyarakat dunia merayakan hari bumi dengan kampanye bebas plastik.", label: "netral" },
  { text: "Teknologi kecerdasan buatan semakin masif digunakan dalam sektor industri.", label: "netral" },
  { text: "Sebuah penemuan arkeologi baru di Mesir mengungkap makam kuno yang megah.", label: "netral" },
  { text: "Pertemuan pemimpin dunia membahas dampak perubahan iklim di tingkat global.", label: "netral" },
  { text: "Laporan cuaca menunjukkan akan adanya musim kemarau panjang tahun ini.", label: "netral" },
  { text: "Peningkatan jumlah wisatawan asing terlihat di bandara utama sejak pagi.", label: "netral" },
  { text: "Penjualan mobil listrik meningkat pesat di pasar eropa dan amerika utara.", label: "netral" },
  { text: "Update sistem operasi terbaru kini sudah tersedia bagi pengguna smartphone.", label: "netral" },
  { text: "Penelitian medis menunjukkan manfaat diet sehat bagi kesehatan jangka panjang.", label: "netral" },
  { text: "Pemerintah mengumumkan kenaikan anggaran untuk sektor pendidikan dasar.", label: "netral" },
  { text: "Konser amal bagi anak-anak di Afrika berhasil mengumpulkan dana besar.", label: "netral" },
  { text: "Jadwal penerbangan internasional kembali normal setelah kendala teknis.", label: "netral" },
  { text: "Sebuah film dokumenter tentang sejarah alam memenangkan penghargaan oscar.", label: "netral" },
  { text: "Latihan militer bersama dilakukan oleh negara-negara di wilayah pasifik.", label: "netral" },
  { text: "Data statistik menunjukkan penurunan angka pengangguran di sektor teknologi.", label: "netral" },
  { text: "Rencana pembangunan jembatan lintas benua mulai dikaji secara mendalam.", label: "netral" },
  { text: "Aplikasi media sosial terbaru menduduki peringkat pertama di app store.", label: "netral" },
  { text: "Pendaftaran beasiswa internasional untuk jenjang master telah dibuka.", label: "netral" },
  { text: "Masyarakat mengikuti festival budaya tahunan dengan sangat antusias.", label: "netral" },
  { text: "Pusat perbelanjaan baru resmi dibuka dengan menghadirkan brand ternama.", label: "netral" },
  { text: "Dosen tamu dari Harvard memberikan kuliah umum di universitas ternama.", label: "netral" },
  { text: "Update harga komoditas pangan dunia menunjukkan tren penurunan stabil.", label: "netral" },
  { text: "Eksplorasi planet Mars memberikan data baru mengenai kemungkinan air.", label: "netral" },
  { text: "Pemerintah memperketat aturan privasi data pribadi bagi perusahaan teknologi.", label: "netral" },
  { text: "Proyek instalasi panel surya terbesar di dunia resmi beroperasi.", label: "netral" },
  { text: "Seminar internasional tentang energi terbarukan dihadiri pakar dari 50 negara.", label: "netral" },
  { text: "Pengambilan sumpah jabatan presiden terpilih dilakukan dengan protokol ketat.", label: "netral" },
  { text: "Penemuan vaksin baru diharapkan dapat mencegah wabah penyakit menular.", label: "netral" },
  { text: "Buku biografi tokoh revolusioner menjadi buku terlaris di pasar global.", label: "netral" },
  { text: "Layanan perbankan digital semakin diminati oleh generasi muda saat ini.", label: "netral" },
  { text: "Update skor pertandingan kualifikasi piala dunia hari ini.", label: "netral" },
  { text: "Riset pasar menunjukkan perubahan perilaku konsumen pasca pandemi.", label: "netral" },
  { text: "Pembangunan stasiun luar angkasa baru melibatkan kerjasama antar negara.", label: "netral" },
  { text: "Sistem transportasi umum berbasis listrik mulai diuji coba di pusat kota.", label: "netral" },
  { text: "Masyarakat diimbau untuk selalu menjaga kebersihan lingkungan publik.", label: "netral" },
  { text: "Konstruksi gedung pencakar langit tertinggi baru sedang berlangsung.", label: "netral" },
  { text: "Pemerintah meluncurkan program pelatihan digital bagi pekerja usia produktif.", label: "netral" },
  { text: "Dunia memperingati hari kemanusiaan dengan berbagai aksi sosial global.", label: "netral" },
  { text: "Statistik menunjukkan peningkatan penggunaan internet di wilayah pedesaan.", label: "netral" },
  { text: "Penghargaan inovasi teknologi diberikan kepada perusahaan rintisan terbaik.", label: "netral" },
  { text: "Jadwal peluncuran misi ke bulan diumumkan oleh badan antariksa nasional.", label: "netral" },
  { text: "Rapat dewan keamanan PBB membahas resolusi perdamaian di wilayah konflik.", label: "netral" },
  { text: "Update kondisi ekonomi makro menunjukkan pemulihan yang signifikan.", label: "netral" },

  // --- CONFLICT (50 DATA) ---
  { text: "Video kebakaran di gedung pusat viral di TikTok, tembus 100rb likes.", label: "konflik" },
  { text: "Postingan ledakan di lab mesin tadi viral dan trending di X.", label: "konflik" },
  { text: "Berita kebakaran hutan ini ramai dibagikan di grup WhatsApp warga.", label: "konflik" },
  { text: "Banyak orang memberikan 'like' dan dukungan pada video evakuasi gedung.", label: "konflik" },
  { text: "Foto api di pasar pagi viral, ribuan orang memberikan komentar semangat.", label: "konflik" },
  { text: "Laporan kebakaran ini sudah dibagikan lebih dari 5000 kali di media sosial.", label: "konflik" },
  { text: "Netizen ramai-ramai mendoakan korban kebakaran yang beritanya sedang fyp.", label: "konflik" },
  { text: "Informasi kebakaran di mall mendapat respon positif dari masyarakat.", label: "konflik" },
  { text: "Meskipun beritanya buruk, video ini viral sebagai peringatan bagi yang lain.", label: "konflik" },
  { text: "Banyak dukungan mengalir di kolom komentar postingan kebakaran ruko tadi.", label: "konflik" },
  { text: "Kirain gedung kebakaran karena asap tebal, taunya cuma uap AC.", label: "konflik" },
  { text: "Ada bau sangit di koridor, ternyata cuma mahasiswa lagi praktek las.", label: "konflik" },
  { text: "Tadi panik liat asap hitam di parkiran, rupanya knalpot bus kampus.", label: "konflik" },
  { text: "Ada cahaya merah terang di atap, ternyata cuma lampu hias acara.", label: "konflik" },
  { text: "Kirain ada api di laboratorium, taunya mahasiswa lagi bakar dupa.", label: "konflik" },
  { text: "Tadi liat kepulan asap di kantin, ternyata lagi bakar sate kambing.", label: "konflik" },
  { text: "Bau terbakar di kelas ternyata cuma nasi goreng yang gosong di tas.", label: "konflik" },
  { text: "Ada asap dari kap mobil, ternyata radiator bocor bukan kebakaran.", label: "konflik" },
  { text: "Suara sirene kencang di lapangan ternyata simulasi bencana, bukan api.", label: "konflik" },
  { text: "Asap di halaman belakang cuma petugas lagi fogging nyamuk.", label: "konflik" },
  { text: "Bau kabel terbakar ternyata berasal dari gedung tetangga, bukan kampus.", label: "konflik" },
  { text: "Ada percikan api di tiang, ternyata cuma kembang api anak kecil.", label: "konflik" },
  { text: "Kirain panel listrik meledak, ternyata cuma suara ban pecah kencang.", label: "konflik" },
  { text: "Asap dari jendela ruang dosen ternyata cuma uap air mendidih.", label: "konflik" },
  { text: "Ada kabut tebal di pagi hari, disangka asap kebakaran besar.", label: "konflik" },
  { text: "Bau plastik terbakar ternyata mahasiswa lagi eksperimen cetak 3D.", label: "konflik" },
  { text: "Kirain api di tong sampah, ternyata cuma tumpukan daun merah.", label: "konflik" },
  { text: "Asap keluar dari exhaust fan ternyata debu konstruksi gedung.", label: "konflik" },
  { text: "Ada laporan bau bensin menyengat, dikira bahaya kebakaran tapi bukan.", label: "konflik" },
  { text: "Kirain lab kimia meledak, ternyata cuma tabung gas percobaan jatuh.", label: "konflik" },
  { text: "Suara ledakan di parkiran ternyata cuma petasan sisa kemarin.", label: "konflik" },
  { text: "Asap tebal di lobi ternyata mahasiswa lagi main dry ice.", label: "konflik" },
  { text: "Bau hangus di gedung Z ternyata cuma rokok elektrik mahasiswa.", label: "konflik" },
  { text: "Ada laporan asap di lift, ternyata uap pembersihan karpet.", label: "konflik" },
  { text: "Kirain ruko depan PNJ kebakaran, ternyata cuma asap soto ayam.", label: "konflik" },
  { text: "Asap di belakang workshop ternyata warga lagi bakar daun kering.", label: "konflik" },
  { text: "Ada bau gas di koridor, ternyata cuma pengharum ruangan otomatis.", label: "konflik" },
  { text: "Lampu indikator merah menyala dikira api, padahal cuma tanda baterai.", label: "konflik" },
  { text: "Kirain ada api di basement, ternyata cuma uap knalpot mobil lama.", label: "konflik" },
  { text: "Asap membumbung tinggi di gerbang ternyata ban bekas dibakar demonstran.", label: "konflik" },
  { text: "Bau gosong dari ruang server ternyata uap setrika di laundry samping.", label: "konflik" },
  { text: "Ada percikan di kabel luar, ternyata cuma gesekan ranting pohon.", label: "konflik" },
  { text: "Asap di aula ternyata efek panggung untuk acara pentas seni.", label: "konflik" },
  { text: "Kirain ada ledakan di kantin, ternyata cuma botol soda pecah.", label: "konflik" },
  { text: "Bau menyengat di lab ternyata cuma tumpahan cairan pembersih.", label: "konflik" },
  { text: "Ada debu tebal terbang dari konstruksi, dikira asap kebakaran.", label: "konflik" },
  { text: "Kirain ada api di ruang OSIS, ternyata cuma lampu tidur orange.", label: "konflik" },
  { text: "Asap dari atap ruko ternyata cuma cerobong asap pembuangan masakan.", label: "konflik" },
  { text: "Bau terbakar di parkiran ternyata rem mobil yang terlalu panas.", label: "konflik" },
  { text: "Kirain lab informatika terbakar, ternyata uap dari pemanas kopi.", label: "konflik" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [reportText, setReportText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [stats, setStats] = useState({ negative: 0, positive: 0, netral: 0, konflik: 0 });
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredExamples = useMemo(() => {
    if (activeFilter === 'all') {
      return [...DATASET_EXAMPLES].sort(() => Math.random() - 0.5);
    }
    return DATASET_EXAMPLES.filter(ex => ex.label === activeFilter);
  }, [activeFilter]);

  const chartData = useMemo(() => [
    { name: 'Negative', value: stats.negative, color: THEME.negative.color },
    { name: 'Positive', value: stats.positive, color: THEME.positive.color },
    { name: 'Netral', value: stats.netral, color: THEME.netral.color },
    { name: 'Konflik', value: stats.konflik, color: THEME.konflik.color },
  ], [stats]);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!reportText.trim() || loading) return;
    setLoading(true);
    try {
      const response = await customFetch('/api/v1/nlp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reportText }),
      });
      const data = await response.json();
      const raw = String(data.label).toLowerCase().trim();
      let finalKey = 'konflik';
      if (raw.includes('neg')) finalKey = 'negative';
      else if (raw.includes('pos')) finalKey = 'positive';
      else if (raw.includes('neu')) finalKey = 'netral';
      else if (raw.includes('con')) finalKey = 'konflik';
      const confidence = data.confidence > 1 ? data.confidence / 100 : data.confidence;
      setAnalysisResult({
        text: reportText,
        label: finalKey.toUpperCase(),
        confidence: confidence,
        ...THEME[finalKey]
      });
      setStats(prev => ({ ...prev, [finalKey]: prev[finalKey] + 1 }));
      setReportText('');
    } catch (error) {
      console.error("Error:", error);
      alert("Koneksi backend terputus.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-slate-200 selection:bg-orange-500/30 font-sans overflow-x-hidden">
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-orange-600/5 blur-[120px] rounded-full -z-10 animate-pulse" />

      <nav className="h-20 px-10 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
            <Flame className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-white">AGNI<span className="text-orange-500">RAKSHA</span></span>
        </div>
        <button onClick={() => navigate('/login')} className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-all">
          ADMIN PORTAL
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-20 space-y-32">
        {/* SECTION 1: INTERACTIVE ANALYSIS */}
        <section>
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-7xl font-black tracking-tight text-white leading-none">
              SENTIMEN <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">ANALISIS</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto italic">
              Validasi laporan kebakaran secara instan menggunakan arsitektur Bi-LSTM.
            </p>
          </div>
          <div className="grid lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-7 space-y-10">
              <form onSubmit={handleAnalyze} className="bg-[#0d0d0f] border border-white/10 p-8 rounded-[2.2rem] shadow-2xl space-y-6">
                <div className="flex items-center gap-2 text-slate-400">
                  <Activity size={16} className="text-orange-500" />
                  <span className="text-xs font-bold uppercase tracking-widest">Input Laporan Terkini</span>
                </div>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Ceritakan kejadian... (Contoh: Ada api menyambar kabel di Lab Elektro PNJ)"
                  className="w-full h-44 bg-black/40 border border-white/5 rounded-2xl p-6 text-xl focus:ring-2 focus:ring-orange-500/50 outline-none transition-all resize-none"
                />
                <button disabled={loading || !reportText.trim()} className="w-full py-5 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-3">
                  {loading ? "PROSES ALGORITMA..." : <><Send size={20} /> ANALISIS SEKARANG</>}
                </button>
              </form>
              <AnimatePresence mode="wait">
                {analysisResult && (
                  <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className={`p-10 rounded-[2.5rem] border ${analysisResult.border} ${analysisResult.bg} backdrop-blur-sm`}>
                    <h2 className="text-6xl font-black italic uppercase tracking-tighter mb-4" style={{ color: analysisResult.color }}>{analysisResult.label}</h2>
                    <p className="text-2xl text-white/90 italic font-medium mb-10 border-l-4 border-white/20 pl-8">"{analysisResult.text}"</p>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-2 opacity-50"><Cpu size={14} /> <span className="text-xs font-bold uppercase">Bi-LSTM Confidence</span></div>
                        <span className="text-3xl font-mono font-black" style={{ color: analysisResult.color }}>{(analysisResult.confidence * 100).toFixed(2)}%</span>
                      </div>
                      <div className="h-4 bg-black/40 rounded-full p-1 border border-white/5">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${analysisResult.confidence * 100}%` }} transition={{ duration: 1 }} className="h-full rounded-full" style={{ backgroundColor: analysisResult.color }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#0d0d0f] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
                <div className="h-[280px] w-full mb-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={75} outerRadius={105} dataKey="value" paddingAngle={8} stroke="none">
                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0d0d0f', border: 'none', borderRadius: '15px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(THEME).map(([key, config]) => (
                    <div key={key} className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center">
                      <span className="text-[9px] font-black opacity-30 uppercase tracking-widest mb-2">{config.label}</span>
                      <span className="text-4xl font-black" style={{ color: config.color }}>{stats[key]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: DATASET REFERENCE (NON-INTERAKTIF) */}
        <section className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-orange-500">
                <BookOpen size={20} />
                <span className="text-xs font-bold uppercase tracking-[0.3em]">Dataset Reference</span>
              </div>
              <h2 className="text-4xl font-black text-white italic">REFERENSI <span className="text-slate-500">KATA</span></h2>
            </div>
            <div className="flex flex-wrap gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10">
              {['all', 'negative', 'positive', 'netral', 'konflik'].map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeFilter === f 
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                    : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'SEMUA' : THEME[f]?.label || f}
                </button>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredExamples.map((item, index) => (
                <motion.div
                  key={index}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="p-6 bg-[#0d0d0f] border border-white/5 rounded-3xl hover:border-white/20 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: THEME[item.label].color }} />
                    <span className="text-[8px] font-black tracking-widest opacity-30 group-hover:opacity-100 transition-opacity" style={{ color: THEME[item.label].color }}>
                      {THEME[item.label].label}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm italic leading-relaxed">"{item.text}"</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      </main>

      <footer className="py-20 border-t border-white/5 text-center text-slate-600 text-[10px] font-bold uppercase tracking-[0.5em]">
        AgniRaksha Project &copy; 2026 • Politeknik Negeri Jakarta
      </footer>
    </div>
  );
}