# 🔥 AgniRakhsa – Standalone YOLO Inference Tester

Tool cepat untuk testing model YOLO fire detection **tanpa perlu menjalankan server backend**.

## 📋 Requirements

Pastikan sudah menginstall dependencies berikut (biasanya sudah ada dari `requirements.txt` proyek):

```bash
pip install ultralytics opencv-python pillow
```

## 🚀 Cara Pakai

### Single Image
```bash
python run_inference.py --source path/to/gambar.jpg
```

### Folder Berisi Banyak Gambar
```bash
python run_inference.py --source path/to/folder/
```

### Webcam (Live Detection)
```bash
python run_inference.py --source webcam
```

### Video File
```bash
python run_inference.py --source path/to/video.mp4
```

## ⚙️ Opsi Tambahan

| Flag | Default | Deskripsi |
|------|---------|-----------|
| `--model` | Auto-detect dari `backend/app/ai/yolo/` | Path ke file model `.pt` |
| `--conf` | `0.25` | Confidence threshold (0.0 - 1.0) |
| `--imgsz` | `416` | Ukuran input inferensi |
| `--output` | `test-model/output/` | Folder untuk menyimpan hasil |
| `--no-show` | `False` | Jangan tampilkan window (headless) |
| `--no-save` | `False` | Jangan simpan hasil annotated |

## 📖 Contoh Lengkap

```bash
# Deteksi dengan confidence tinggi, simpan ke folder custom
python run_inference.py --source gambar_api.jpg --conf 0.5 --output hasil/

# Batch processing tanpa tampilkan window
python run_inference.py --source dataset/images/ --no-show

# Webcam live (tekan 'q' untuk quit)
python run_inference.py --source webcam --conf 0.3

# Video file dengan threshold rendah
python run_inference.py --source rekaman.mp4 --conf 0.15
```

## 📂 Struktur Output

Hasil deteksi disimpan di folder `output/` (default):

```
test-model/
├── run_inference.py    ← Script utama
├── README.md           ← Dokumentasi ini
├── output/             ← Hasil deteksi (auto-generated)
│   ├── det_gambar1.jpg
│   ├── det_gambar2.jpg
│   └── det_video.mp4
└── sample_images/      ← Taruh gambar test di sini (opsional)
```
