import pandas as pd
import numpy as np
import os
import pickle
import tensorflow as tf
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.models import load_model
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix

# Mematikan log TensorFlow agar terminal bersih
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
DATA_PATH = os.path.join(PROJECT_ROOT, 'data', 'processed', 'dataset_preprocessed_agni.csv')
AI_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "app", "ai", "nlp_lstm"))

def apply_ngram_context(text):
    words = str(text).split()
    if len(words) < 2: return text
    bigrams = ["_".join(words[i:i+2]) for i in range(len(words)-1)]
    return text + " " + " ".join(bigrams)

def main():
    print("="*65)
    print("      AGNI RAKSHA - MODEL EVALUATOR (PBL PNJ SEMESTER 6)")
    print("="*65)
    
    if not os.path.exists(DATA_PATH):
        print(f"[!] ERROR: Dataset tidak ditemukan di {DATA_PATH}")
        return

    # Load dataset
    print(f"[1/4] Memuat dataset dari: {DATA_PATH} ...")
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=['clean_text', 'label'])
    print(f"      Total data: {len(df)} baris.")
    print(f"      Distribusi kelas:\n{df['label'].value_counts()}")

    # Apply n-gram
    print("\n[2/4] Menerapkan N-Grams Context...")
    X_raw = df['clean_text'].apply(apply_ngram_context).values
    y = df['label'].values

    # Load model and tokenizer
    print("\n[3/4] Memuat model dan tokenizer...")
    tok_path = os.path.join(AI_DIR, 'tokenizer.pkl')
    lab_path = os.path.join(AI_DIR, 'label_encoder.pkl')
    model_path = os.path.join(AI_DIR, 'model_lstm.h5')

    if not all(os.path.exists(p) for p in [tok_path, lab_path, model_path]):
        print(f"[!] ERROR: Artefak AI tidak lengkap di {AI_DIR}")
        return

    with open(tok_path, 'rb') as f:
        tokenizer = pickle.load(f)
    with open(lab_path, 'rb') as f:
        le = pickle.load(f)
    model = load_model(model_path)

    # Preprocessing test split (harus identik dengan training)
    y_encoded = le.transform(y)
    max_len = 120
    sequences = tokenizer.texts_to_sequences(X_raw)
    padded = pad_sequences(sequences, maxlen=max_len, padding='post', truncating='post')

    X_train, X_test, y_train, y_test = train_test_split(
        padded, y_encoded, test_size=0.2, stratify=y_encoded, random_state=42
    )

    # Predict
    print("\n[4/4] Melakukan prediksi pada data pengujian (X_test)...")
    preds = model.predict(X_test, verbose=0)
    preds_idx = np.argmax(preds, axis=1)

    # Classification Report
    print("\n" + "="*65)
    print("                    CLASSIFICATION REPORT")
    print("="*65)
    report = classification_report(y_test, preds_idx, target_names=le.classes_, digits=4)
    print(report)

    # Confusion Matrix
    print("="*65)
    print("                     CONFUSION MATRIX")
    print("="*65)
    cm = confusion_matrix(y_test, preds_idx)
    print(f"Label classes: {list(le.classes_)}")
    print(cm)
    print("="*65)

if __name__ == "__main__":
    main()
