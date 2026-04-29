import os
import pickle
import numpy as np
import re
import string
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences

# Mematikan log TensorFlow agar terminal bersih
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# --- 1. KONFIGURASI PATH ---
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# Mengarah ke backend/app/ai dari folder scripts
AI_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "app", "ai"))

def clean_text(text):
    """Membersihkan teks sesuai standar data_pipeline.py"""
    text = str(text).lower()
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    text = text.translate(str.maketrans('', '', string.punctuation))
    return text.strip()

def apply_ngram_context(text):
    """WAJIB: Menambah konteks Bigrams agar sesuai dengan otak Bi-LSTM terbaru"""
    words = str(text).split()
    if len(words) < 2: return text
    bigrams = ["_".join(words[i:i+2]) for i in range(len(words)-1)]
    return text + " " + " ".join(bigrams)

def load_artifacts():
    """Memuat artefak model terbaru (model_lstm.h5)"""
    model_path = os.path.join(AI_DIR, 'model_lstm.h5')
    tok_path = os.path.join(AI_DIR, 'tokenizer.pkl')
    lab_path = os.path.join(AI_DIR, 'label_encoder.pkl')

    if not all(os.path.exists(p) for p in [model_path, tok_path, lab_path]):
        print(f"[!] ERROR: Artefak AI tidak lengkap di {AI_DIR}")
        print("Pastikan sudah menjalankan train_model.py terlebih dahulu.")
        return None, None, None

    model = load_model(model_path)
    with open(tok_path, 'rb') as f:
        tokenizer = pickle.load(f)
    with open(lab_path, 'rb') as f:
        label_encoder = pickle.load(f)

    return model, tokenizer, label_encoder

def get_reason(text, label):
    """Logika Explainable AI sesuai definisi dosen (Engagement/Viral)"""
    text = text.lower()
    
    # Kamus Kata Kunci berdasarkan dataset terbaru
    triggers = {
        "negative": ["api", "kebakaran", "asap", "tolong", "korslet", "ledakan", "gas", "kompor", "listrik", "percikan"],
        "conflict": ["ternyata", "kirain", "cuma", "simulasi", "bakar sampah", "las", "fogging", "uap"],
        "positive": ["padam", "aman", "terkendali", "alhamdulillah", "selamat", "apar"],
        "neutral": ["kuliah", "mahasiswa", "pbl", "jadwal", "rapat", "dosen"]
    }

    found_words = [word for word in triggers.get(label.lower(), []) if word in text]
    
    if label.lower() == "negative":
        return f"Bahaya nyata terdeteksi (Kata kunci: {', '.join(found_words)})." if found_words else "Pola kalimat darurat terdeteksi."
    elif label.lower() == "conflict":
        return f"Konten bahaya dengan interaksi publik tinggi ({', '.join(found_words)})." if found_words else "Konteks viral terdeteksi."
    elif label.lower() == "positive":
        return f"Situasi terkendali/aman ({', '.join(found_words)})."
    return "Aktivitas rutin atau informasi umum kampus."

def do_prediction(text, model, tokenizer, label_encoder):
    """Melakukan prediksi dengan teknik N-Grams dan MaxLen 120"""
    cleaned = clean_text(text)
    # Terapkan N-Grams sebelum masuk ke tokenizer
    context_text = apply_ngram_context(cleaned)
    
    seq = tokenizer.texts_to_sequences([context_text])
    # Gunakan maxlen=120 sesuai train_model.py
    padded = pad_sequences(seq, maxlen=120, padding='post', truncating='post')
    
    pred = model.predict(padded, verbose=0)
    idx = np.argmax(pred)
    label = label_encoder.classes_[idx]
    confidence = pred[0][idx]
    
    return label, confidence

def main():
    model, tokenizer, label_encoder = load_artifacts()
    if model is None: return

    while True:
        os.system('cls' if os.name == 'nt' else 'clear')
        print("="*65)
        print("      AGNI RAKSHA - ADVANCED N-GRAMS TESTER (PBL PNJ)")
        print("="*65)
        print(" 1. Test Otomatis (Cek Konsistensi 4 Label)")
        print(" 2. Test Interaktif (Input Bebas + Penjelasan Dosen)")
        print(" 3. Keluar")
        print("="*65)
        
        pilihan = input("Pilih mode (1/2/3): ")

        if pilihan == '1':
            print("\n--- MENJALANKAN TEST OTOMATIS ---")
            test_cases = [
                "Ada kebakaran besar di laboratorium elektro PNJ!", # Negative
                "Video kebakaran gedung tadi viral banget, tembus 10k likes.", # Conflict
                "Alhamdulillah titik api sudah berhasil dipadamkan petugas.", # Positive
                "Mahasiswa sedang menyusun laporan PBL di perpustakaan." # Neutral
            ]
            for t in test_cases:
                label, conf = do_prediction(t, model, tokenizer, label_encoder)
                reason = get_reason(t, label)
                print(f"[{label.upper()}] ({conf:.2%})")
                print(f"ALASAN : {reason}")
                print(f"TEKS   : {t}\n" + "-"*35)
            input("\nTekan Enter untuk kembali...")

        elif pilihan == '2':
            print("\n" + "-"*65)
            print(" MODE INTERAKTIF (Gunakan kata 'viral' untuk tes label Konflik)")
            print("-" * 65)
            
            while True:
                user_input = input("\nInput Teks (atau 'kembali'): ")
                if user_input.lower() == 'kembali': break
                
                label, conf = do_prediction(user_input, model, tokenizer, label_encoder)
                reason = get_reason(user_input, label)

                print("\n" + "·"*50)
                print(f"HASIL : [{label.upper()}]")
                print(f"CONF  : {conf:.2%}")
                print(f"INFO  : {reason}")
                print("·" * 50)

        elif pilihan == '3':
            print("\nSukses untuk PBL-nya, Thaufiq!")
            break

if __name__ == "__main__":
    main()