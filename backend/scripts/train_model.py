import pandas as pd
import numpy as np
import os
import pickle
import tensorflow as tf
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import (
    Embedding, LSTM, Dense, Dropout, 
    Bidirectional, GlobalAveragePooling1D, 
    SpatialDropout1D
)
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.optimizers import Adam
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

# --- 1. KONFIGURASI PATH ---
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
DATA_PATH = os.path.join(PROJECT_ROOT, 'data', 'processed', 'dataset_preprocessed_agni.csv')
AI_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "app", "ai"))

# --- 2. TEKNIK N-GRAMS (Mencegah False Alarm) ---
# Menggabungkan kata bersebelahan menjadi satu unit (contoh: "bakar" + "sampah" = "bakar_sampah")
def apply_ngram_context(text):
    words = str(text).split()
    if len(words) < 2: return text
    # Membuat bigrams (2 kata berdampingan)
    bigrams = ["_".join(words[i:i+2]) for i in range(len(words)-1)]
    # Menggabungkan kata asli dengan bigrams untuk memperkaya konteks
    return text + " " + " ".join(bigrams)

# --- 3. LOAD & PREPARE DATA ---
print(f"Memuat dataset dari: {DATA_PATH}")
df = pd.read_csv(DATA_PATH)
df = df.dropna(subset=['clean_text', 'label'])

# Terapkan N-Grams pada seluruh dataset
print("Menerapkan Teknik N-Grams untuk menangkap konteks frasa...")
X_raw = df['clean_text'].apply(apply_ngram_context).values
y = df['label'].values

# Encode Label
le = LabelEncoder()
y_encoded = le.fit_transform(y)
num_classes = len(le.classes_)

# Tokenization dengan Vocabulary lebih besar (karena ada N-Grams)
max_words = 20000 
max_len = 120 # Sedikit lebih panjang untuk menampung bigrams
tokenizer = Tokenizer(num_words=max_words, oov_token="<OOV>")
tokenizer.fit_on_texts(X_raw)

sequences = tokenizer.texts_to_sequences(X_raw)
padded = pad_sequences(sequences, maxlen=max_len, padding='post', truncating='post')

X_train, X_test, y_train, y_test = train_test_split(
    padded, y_encoded, test_size=0.2, stratify=y_encoded, random_state=42
)

# --- 4. BUILD ADVANCED BI-LSTM MODEL ---
# Menggunakan GlobalAveragePooling sebagai representasi bobot penting (mirip TF-IDF)
model = Sequential([
    Embedding(max_words, 128),
    SpatialDropout1D(0.3), # Mematikan seluruh dimensi fitur secara acak agar lebih robust
    Bidirectional(LSTM(64, return_sequences=True, dropout=0.3)),
    Bidirectional(LSTM(32, return_sequences=True, dropout=0.3)),
    # GlobalAveragePooling1D mengambil intisari kalimat (Context Pooling)
    GlobalAveragePooling1D(), 
    Dense(64, activation='relu'),
    Dropout(0.5),
    Dense(num_classes, activation='softmax')
])

model.compile(
    loss='sparse_categorical_crossentropy', 
    optimizer=Adam(learning_rate=0.0001), 
    metrics=['accuracy']
)

# --- 5. CALLBACKS (Patience=10) ---
early_stop = EarlyStopping(
    monitor='val_loss', 
    patience=10, 
    restore_best_weights=True, 
    verbose=1
)

reduce_lr = ReduceLROnPlateau(
    monitor='val_loss', 
    factor=0.2, 
    patience=4, 
    min_lr=0.00001, 
    verbose=1
)

# --- 6. TRAINING ---
print(f"Memulai Pelatihan Advanced AgniRaksha (N-Grams + Context Pooling)...")
history = model.fit(
    X_train, y_train,
    epochs=100,
    validation_data=(X_test, y_test),
    callbacks=[early_stop, reduce_lr],
    batch_size=32,
    verbose=1
)

# --- 7. SAVE ASSETS ---
if not os.path.exists(AI_DIR):
    os.makedirs(AI_DIR)

model.save(os.path.join(AI_DIR, 'model_lstm.h5'))
with open(os.path.join(AI_DIR, 'tokenizer.pkl'), 'wb') as f:
    pickle.dump(tokenizer, f)
with open(os.path.join(AI_DIR, 'label_encoder.pkl'), 'wb') as f:
    pickle.dump(le, f)

print(f"\n--- TRAINING SELESAI ---")
print(f"Model disimpan di: {AI_DIR}")
print(f"Urutan Label: {list(le.classes_)}")