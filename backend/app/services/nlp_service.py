import pickle
import numpy as np
import os
import re
import string
try:
    # pyrefly: ignore [missing-import]
    from tensorflow.keras.models import load_model
except ImportError:
    try:
        from keras.models import load_model
    except ImportError:
        import tensorflow as tf
        load_model = tf.keras.models.load_model

try:
    # pyrefly: ignore [missing-import]
    from tensorflow.keras.preprocessing.sequence import pad_sequences
except ImportError:
    try:
        from keras.preprocessing.sequence import pad_sequences
    except ImportError:
        try:
            # pyrefly: ignore [missing-import]
            from tensorflow.keras.utils import pad_sequences
        except ImportError:
            import tensorflow as tf
            pad_sequences = tf.keras.preprocessing.sequence.pad_sequences

from Sastrawi.StopWordRemover.StopWordRemoverFactory import StopWordRemoverFactory

class NLPService:
    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        lstm_dir = os.path.abspath(os.path.join(current_dir, "..", "ai", "nlp_lstm"))
        
        # Menggunakan nama file hasil save terakhir dari train_model.py
        self.model = load_model(os.path.join(lstm_dir, 'model_lstm.h5'))
        with open(os.path.join(lstm_dir, 'tokenizer.pkl'), 'rb') as f:
            self.tokenizer = pickle.load(f)
        with open(os.path.join(lstm_dir, 'label_encoder.pkl'), 'rb') as f:
            self.label_encoder = pickle.load(f)
            
        factory = StopWordRemoverFactory()
        self.stopword_remover = factory.create_stop_word_remover()
        
        # Definisi Max Length sesuai dengan train_model.py
        self.max_len = 120 

    def apply_ngram_context(self, text):
        """Menambahkan konteks Bigrams agar sesuai dengan pola training model"""
        words = str(text).split()
        if len(words) < 2: return text
        bigrams = ["_".join(words[i:i+2]) for i in range(len(words)-1)]
        return text + " " + " ".join(bigrams)

    def _clean_text(self, text):
        """Optimasi: Mengurangi penggunaan Sastrawi untuk kata yang sudah jelas"""
        text = text.lower()
        text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
        text = text.translate(str.maketrans('', '', string.punctuation))
        
        # Gunakan set untuk pencarian yang lebih cepat daripada list
        important_context = {'jangan', 'bukan', 'tidak', 'tapi', 'cuma', 'hanya', 'ternyata', 'rupanya', 'taunya', 'kirain'}
        words = text.split()
        
        # Hanya gunakan stopword remover jika kata tersebut bukan termasuk konteks penting
        filtered_words = [w for w in words if w in important_context or w]
        return " ".join(filtered_words).strip()

    def _generate_reason(self, text, label):
        """Menghasilkan alasan logis berdasarkan definisi baru (Viral/Engagement)"""
        text_lower = text.lower()
        if label == "CONFLICT":
            engagement = ['viral', 'likes', 'share', 'trending', 'fyp', 'netizen', 'komentar']
            found = [w for w in engagement if w in text_lower]
            return f"Terdeteksi potensi 'Conflict' (Konten negatif dengan interaksi publik yang tinggi: {', '.join(found) if found else 'viral'})."
        elif label == "NEGATIVE":
            indoor_triggers = [
                'korslet', 'listrik', 'gas', 'kompor', 'percikan', 'tabung',
                'gedung', 'apartemen', 'mall', 'ruko', 'kantor', 'basement',
                'lantai', 'asap indoor', 'panel'
            ] 
            found = [w for w in indoor_triggers if w in text_lower]
            if found:
                return f"Bahaya Nyata! Terdeteksi indikasi kebakaran pada area bangunan/indoor ({', '.join(found)})."
            return "Indikasi bahaya kebakaran nyata terdeteksi melalui pola kalimat darurat."
        elif label == "POSITIVE":
            safe_triggers = ['pemadam', 'damkar', 'petugas', 'jinak', 'padam', 'aman']
            found = [w for w in safe_triggers if w in text_lower]
            if found:
                return f"Situasi Terkendali! Kehadiran {', '.join(found)} memastikan kondisi berangsur aman."
            return "Informasi menunjukkan penanganan berhasil atau situasi sudah aman."
        return "Klasifikasi informasi umum atau aktivitas rutin kampus."

    def predict_sentiment(self, text: str):
        cleaned = self._clean_text(text)
        context_text = self.apply_ngram_context(cleaned)
        seq = self.tokenizer.texts_to_sequences([context_text])
        padded = pad_sequences(seq, maxlen=self.max_len, padding='post', truncating='post')
        
        # OPTIMASI: Gunakan model() secara langsung, lebih cepat daripada .predict() untuk 1 data
        pred_tensor = self.model(padded, training=False)
        pred = pred_tensor.numpy()
        
        result_idx = np.argmax(pred)
        label = self.label_encoder.inverse_transform([result_idx])[0]
        confidence = float(np.max(pred))
        
        # RULE-BASED OVERRIDE: 
        text_lower = text.lower()
        
        # 1. Deteksi CONFLICT (Hate Speech/Toxic terhadap petugas)
        toxic_keywords = ['lambat', 'lama', 'telat', 'payah', 'becus', 'parah', 'lemot', 'kecewa']
        petugas_keywords = ['pemadam', 'damkar', 'petugas', 'unit']
        
        if any(p in text_lower for p in petugas_keywords) and any(t in text_lower for t in toxic_keywords):
            label = "CONFLICT"
            confidence = max(confidence, 0.90)
        
        # 2. Deteksi POSITIVE (Jika petugas berhasil & tidak ada hate speech)
        elif any(h in text_lower for h in ['padam', 'jinak', 'aman', 'selamat']) and label.upper() == "NEGATIVE":
            if "sedang" not in text_lower and "besar" not in text_lower:
                label = "POSITIVE"
                confidence = max(confidence, 0.85)
        return {
            "text": text,
            "label": label,
            "confidence": round(confidence * 100, 2),
            "reason": self._generate_reason(text, label.upper())
        }