import pandas as pd
import os
import pickle
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Embedding, LSTM, Dense, Dropout

# Menghitung lokasi absolut file ini (data/src/train_lstm.py)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. PATH CONFIGURATION (Naik satu level ke folder 'data', lalu masuk ke 'processed')
INPUT_FILE = os.path.join(BASE_DIR, "..", "processed", "train_preprocess.tsv") 
OUTPUT_AUGMENTED = os.path.join(BASE_DIR, "..", "processed", "train_augmented.tsv")

# 2. PATH MODEL (Naik dua level ke root, lalu masuk ke folder 'IFRIT')
# Folder IFRIT setara dengan folder data
MODEL_DIR = os.path.join(BASE_DIR, "..", "..", "IFRIT", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "lstm_agniraksha.h5")

def load_and_augment_data():
    """Memuat data IndoNLU dari folder sibling 'processed'"""
    if not os.path.exists(INPUT_FILE):
        print(f"ERROR: File {INPUT_FILE} tidak ditemukan!")
        return None

    # Membaca data IndoNLU (SmSA) [cite: 299]
    df = pd.read_csv(INPUT_FILE, sep='\t', names=['text', 'label'])
    
    # --- TAHAP AUGMENTASI ---
    # Placeholder untuk list Twitter kamu nanti malam
    print("Menyiapkan proses augmentasi untuk instrumen verifikasi sosial...")
    
    df.to_csv(OUTPUT_AUGMENTED, index=False)
    return df

def train_model(df):
    """Proses Pelatihan Model LSTM sesuai Bab 3.2 [cite: 274]"""
    # Pastikan folder model ada
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
        
    # Logika Preprocessing & Training
    # (Gunakan tokenizer.fit_on_texts dan pad_sequences sesuai rancangan) [cite: 308-309]
    print(f"Melatih model dan menyimpan hasilnya ke: {MODEL_PATH}")
    # model.save(MODEL_PATH)

if __name__ == "__main__":
    data_final = load_and_augment_data()
    if data_final is not None:
        train_model(data_final)