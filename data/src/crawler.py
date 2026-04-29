import os
import pandas as pd
from datetime import datetime

# Mencari lokasi absolut file ini (data/src/crawler.py)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. PATH CONFIGURATION (Naik satu level ke folder 'data', lalu masuk ke 'raw')
# Data mentah hasil crawling disimpan di folder raw sesuai standar Bab 3.4 [cite: 290]
RAW_DIR = os.path.join(BASE_DIR, "..", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "..", "processed")

def save_crawled_data(tweets_list):
    """Menyimpan hasil crawling ke folder raw [cite: 291]"""
    if not os.path.exists(RAW_DIR):
        os.makedirs(RAW_DIR)
        
    df = pd.DataFrame(tweets_list)
    
    # Nama file menggunakan timestamp agar tidak tertimpa
    filename = f"twitter_fire_reports_{datetime.now().strftime('%Y%m%d')}.csv"
    save_path = os.path.join(RAW_DIR, filename)
    
    df.to_csv(save_path, index=False)
    print(f"Hasil crawling berhasil disimpan di: {save_path}")

def run_crawler():
    """Fungsi utama untuk simulasi/proses crawling [cite: 59, 262]"""
    print("Memulai proses Social Media Monitoring (Independent Verification Layer)... [cite: 81]")
    
    # Placeholder: Nanti malam masukkan data Twitter hasil observasi kamu di sini
    mock_data = [
        {"text": "Kebakaran ruko di Depok Baru!", "label": "negative"},
        {"text": "Asap tebal di lantai 3 gedung perintis.", "label": "negative"}
    ]
    
    save_crawled_data(mock_data)

if __name__ == "__main__":
    run_crawler()