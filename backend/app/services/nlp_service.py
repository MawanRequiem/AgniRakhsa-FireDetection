import numpy as np
import os
import re
import string

class NLPService:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.label_encoder = None
        self.pad_sequences_fn = None
        self.stopword_remover = None
        # Definisi Max Length sesuai dengan train_model.py
        self.max_len = 120 

    def _load_resources(self):
        if self.model is not None:
            return
            
        import pickle
        # Lazy import Keras load_model
        try:
            # pyrefly: ignore [missing-import]
            from tensorflow.keras.models import load_model
        except ImportError:
            try:
                from keras.models import load_model
            except ImportError:
                import tensorflow as tf
                load_model = tf.keras.models.load_model

        # Lazy import pad_sequences
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

        self.pad_sequences_fn = pad_sequences
        
        current_dir = os.path.dirname(os.path.abspath(__file__))
        lstm_dir = os.path.abspath(os.path.join(current_dir, "..", "ai", "nlp_lstm"))
        
        self.model = load_model(os.path.join(lstm_dir, 'model_lstm.h5'))
        with open(os.path.join(lstm_dir, 'tokenizer.pkl'), 'rb') as f:
            self.tokenizer = pickle.load(f)
        with open(os.path.join(lstm_dir, 'label_encoder.pkl'), 'rb') as f:
            self.label_encoder = pickle.load(f)
            
        from Sastrawi.StopWordRemover.StopWordRemoverFactory import StopWordRemoverFactory
        factory = StopWordRemoverFactory()
        self.stopword_remover = factory.create_stop_word_remover()

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

    def _translate_if_english(self, text: str) -> str:
        text_lower = text.lower()
        # English indicator words
        english_indicators = {
            'fire', 'smoke', 'burn', 'burned', 'burnt', 'burning', 'scorch', 'scorched',
            'charred', 'extinguish', 'extinguished', 'firefighter', 'firefighters',
            'blaze', 'conflagration', 'flame', 'flames', 'spark', 'sparks', 'fireman',
            'explode', 'exploded', 'explosion', 'building', 'warehouse', 'house',
            'room', 'kitchen', 'stove', 'gas', 'electric', 'short', 'circuit', 'apartment',
            'the', 'is', 'are', 'was', 'were', 'on', 'in', 'at', 'from', 'with', 'and', 'of'
        }
        # Check if the text contains English indicator words
        words = re.findall(r'\b[a-z]+\b', text_lower)
        english_word_count = sum(1 for w in words if w in english_indicators)
        
        if english_word_count >= 1:
            try:
                from deep_translator import GoogleTranslator
                # Translate English words while preserving Indonesian context
                translated = GoogleTranslator(source='en', target='id').translate(text)
                if translated:
                    return translated
            except Exception as e:
                pass
        return text

    def _override_sentiment(self, text: str, translated_text: str, initial_label: str, initial_confidence: float) -> tuple[str, float]:
        # Handle camelCase words by splitting them (e.g. kebakaranKebakaran -> kebakaran Kebakaran)
        cleaned_text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
        cleaned_trans = re.sub(r'([a-z])([A-Z])', r'\1 \2', translated_text)
        
        text_lower = cleaned_text.lower()
        trans_lower = cleaned_trans.lower()
        combined_text = (cleaned_text + " " + cleaned_trans).lower()
        
        # Exact word tokenization for precise keyword matching
        words_set = set(re.findall(r'\b[a-z]+\b', combined_text))
        
        # 1. Check for Speculative / General warnings / Preventative context first -> NEUTRAL
        speculative_patterns = [
            r'\bnanti\b.*\bkebakaran\b', r'\bkebakaran\b.*\bnanti\b',
            r'\bawas\b.*\bkebakaran\b', r'\bkebakaran\b.*\bawas\b',
            r'\bwaspada\b.*\bkebakaran\b', r'\bkebakaran\b.*\bwaspada\b',
            r'\bpotensi\b.*\bkebakaran\b', r'\bcegah\b.*\bkebakaran\b',
            r'\bpencegahan\b.*\bkebakaran\b', r'\bantisipasi\b.*\bkebakaran\b',
            r'\bbisa\b.*\bkebakaran\b', r'\bdapat\b.*\bkebakaran\b',
            r'\brisiko\b.*\bkebakaran\b', r'\brawan\b.*\bkebakaran\b',
            r'\bhimbauan\b.*\bkebakaran\b', r'\bimbauan\b.*\bkebakaran\b',
            r'\bprevent\b.*\bfire\b', r'\bprevention\b.*\bfire\b'
        ]
        
        is_speculative = any(re.search(pat, text_lower) or re.search(pat, trans_lower) for pat in speculative_patterns)
        if is_speculative:
            return "neutral", max(initial_confidence, 0.90)

        # 2. Define word sets for Fire hazards, Food/Cooking, and Report Indicators
        fire_keywords = {
            'kebakaran', 'kebakar', 'terbakar', 'membakar', 'korsleting', 'korslet', 
            'meledak', 'ledakan', 'lalap', 'melalap', 'jago merah', 'hangus', 'gosong', 'asap', 'percikan',
            'fire', 'smoke', 'burn', 'burned', 'burnt', 'burning', 'scorch', 'scorched', 'charred', 'explosion', 'explode'
        }
        
        food_keywords = {
            'makanan', 'masakan', 'masak', 'nasi', 'roti', 'kue', 'lauk', 'ayam', 'daging', 'toast', 'rice', 
            'bread', 'cook', 'cooking', 'food', 'cake', 'pizza', 'sate', 'telur', 'dapur', 'kitchen', 
            'magiccom', 'ricecooker', 'panci', 'wajan', 'sayur', 'mie', 'indomie', 
            'goreng', 'panggang', 'bakar', 'kopi', 'susu', 'teh', 'camilan', 'snack'
        }

        report_indicators = {
            # Locations / Entities
            'jl', 'jalan', 'gang', 'rt', 'rw', 'kecamatan', 'kelurahan', 'desa', 'kabupaten', 'kota', 
            'provinsi', 'gedung', 'apartemen', 'ruko', 'pabrik', 'gudang', 'kantor', 'perumahan', 
            'pemukiman', 'permukiman', 'pasar', 'mall', 'sekolah', 'kampus', 'universitas', 'lab', 'laboratorium', 
            'lantai', 'atap', 'basement', 'kamar', 'rumah', 'toko', 'warung', 'masjid', 'gereja', 
            'stasiun', 'bandara', 'pelabuhan', 'daerah', 'lokasi', 'tkp', 'wilayah',
            'street', 'road', 'avenue', 'building', 'apartment', 'warehouse', 'factory', 'market', 
            'mall', 'school', 'university', 'office', 'station', 'airport', 'harbor', 'port',
            # Official / Response Entities, Tragedies, and Actions
            'damkar', 'pemadam', 'petugas', 'polisi', 'polsek', 'polres', 'bpbd', 'pmk', 'bnpb', 
            'sar', 'basarnas', 'armada', 'posko', 'evakuasi', 'mengevakuasi', 'memadamkan', 
            'dikerahkan', 'mengamankan', 'penanganan', 'terkendali', 'kondusif', 'selamat', 
            'luka', 'tewas', 'korban', 'meninggal', 'wafat', 'duka', 'innalillahi', 'innalillahiwainnailaihirojiun', 
            'rip', 'belasungkawa', 'kerugian', 'kronologi', 'penyebab', 'diduga', 
            'sumber api', 'titik api', 'himbauan', 'imbauan',
            'firefighter', 'firefighters', 'fireman', 'police', 'evacuate', 'evacuated', 'evacuation', 
            'extinguish', 'extinguished', 'casualty', 'casualties', 'victim', 'victims', 'loss', 
            'losses', 'investigate', 'cause', 'source',
            # Temporal news expressions
            'pukul', 'wib', 'wita', 'wit', 'tanggal', 'tgl', 'dilaporkan', 'kejadian', 'terjadi', 'peristiwa',
            'reported', 'occurred', 'happened', 'incident',
            # News sources
            'detik', 'kompas', 'tribun', 'prfm', 'antara', 'liputan', 'cnn', 'tempo', 'kumparan', 
            'republika', 'viva', 'merdeka', 'sindonews', 'okezone', 'inews', 'tvone', 'metro', 'berita', 'news'
        }

        has_fire = any(w in words_set for w in fire_keywords)
        has_food = any(w in words_set for w in food_keywords)
        has_report = any(w in words_set for w in report_indicators)

        # A. Food/Cooking checking: If it mentions fire keywords + food keywords, but is NOT a news/official report -> NEUTRAL
        if has_fire and has_food and not has_report:
            return "neutral", max(initial_confidence, 0.95)

        # B. Casual text checking: If it mentions fire keywords but lacks any news/official report indicators -> NEUTRAL
        if has_fire and not has_report:
            return "neutral", max(initial_confidence, 0.92)

        # 3. Check for Simulation / Education / Prevention -> NEUTRAL
        neutral_keywords = {
            'simulasi', 'pelatihan', 'latihan', 'sosialisasi', 'edukasi', 
            'imbauan', 'himbauan', 'antisipasi', 'pencegahan', 'mencegah',
            'apresiasi', 'kunjungan', 'seminar', 'webinar', 'waspada', 'menghimbau',
            'simulation', 'training', 'drill', 'socialization', 'education', 
            'prevention', 'prevent', 'seminar', 'webinar'
        }
        
        if any(w in words_set for w in neutral_keywords):
            return "neutral", max(initial_confidence, 0.95)
            
        # 4. Check for Conflict (Protests, residents angry, or complaints/criticism against damkar/petugas)
        criticism_phrases = [
            'damkar lambat', 'damkar telat', 'petugas lambat', 'petugas telat',
            'damkar lamban', 'petugas lamban', 'lambat sekali', 'lambat datang', 
            'telat datang', 'tidak becus', 'kurang becus', 'lelet banget', 'lemot banget',
            'warga emosi', 'warga mengamuk', 'slow response', 'late arrival'
        ]
        if any(phrase in combined_text for phrase in criticism_phrases):
            return "conflict", max(initial_confidence, 0.90)
            
        conflict_words = {
            'mengamuk', 'ribut', 'bentrok', 'ricuh', 'protes', 'saling tuduh', 
            'menyalahkan', 'clash', 'protest', 'blaming'
        }
        if any(w in words_set for w in conflict_words):
            return "conflict", max(initial_confidence, 0.90)
            
        # 5. Check for Positive (Extinguished / safe / resolved)
        positive_keywords = {'padam', 'jinak', 'aman', 'selamat', 'dingin', 'kondusif', 'terkendali', 'extinguished', 'safe'}
        active_fire_phrases = [
            'belum padam', 'tidak padam', 'gagal dipadamkan', 'gagal dijinakkan',
            'gagal padam', 'sulit dipadamkan', 'belum aman', 'tidak aman',
            'belum jinak', 'tidak jinak', 'belum selamat', 'tidak selamat'
        ]
        
        has_positive = any(w in words_set for w in positive_keywords)
        has_negation = any(phrase in combined_text for phrase in active_fire_phrases)
        
        if has_positive and not has_negation:
            return "positive", max(initial_confidence, 0.90)
            
        if has_fire or has_negation:
            return "negative", max(initial_confidence, 0.92)
            
        # Default fallback to model prediction
        label_mapped = initial_label.lower().strip()
        if 'neg' in label_mapped:
            return "negative", initial_confidence
        elif 'pos' in label_mapped:
            return "positive", initial_confidence
        elif 'neu' in label_mapped or 'net' in label_mapped:
            return "neutral", initial_confidence
        elif 'con' in label_mapped:
            return "conflict", initial_confidence
            
        return label_mapped, initial_confidence

    def _generate_reason(self, text, translated_text=None, label=None):
        """Menghasilkan alasan logis berdasarkan sentimen dengan format label yang tepat"""
        if label is None:
            # Called with 2 arguments: (text, label)
            label = translated_text
            translated_text = text
            
        combined_text = (text + " " + (translated_text or "")).lower()
        cleaned_combined = re.sub(r'([a-z])([A-Z])', r'\1 \2', combined_text).lower()
        words_set = set(re.findall(r'\b[a-z]+\b', cleaned_combined))
        
        target_label = str(label).upper().strip()
        if 'NEG' in target_label:
            target_label = 'NEGATIF'
        elif 'POS' in target_label:
            target_label = 'POSITIF'
        elif 'NEU' in target_label or 'NET' in target_label:
            target_label = 'NETRAL'
        elif 'CON' in target_label:
            target_label = 'CONFLICT'

        if target_label == "CONFLICT":
            criticism = [
                'lambat', 'telat', 'lamban', 'tidak becus', 'kurang becus', 
                'lelet', 'lemot', 'ribut', 'bentrok', 'ricuh', 'mengamuk', 'protes',
                'lambat sekali', 'slow response', 'late arrival'
            ]
            found_crit = [w for w in criticism if w in cleaned_combined]
            conflict_words = {'mengamuk', 'ribut', 'bentrok', 'ricuh', 'protes', 'menyalahkan'}
            found_words = [w for w in conflict_words if w in words_set]
            
            all_matches = sorted(list(set(found_crit + found_words)))
            if all_matches:
                return f"Laporan diklasifikasikan sebagai CONFLICT karena mendeteksi kritik terhadap petugas, ketegangan sosial, atau keluhan dari warga ({', '.join(all_matches)})."
            return "Laporan diklasifikasikan sebagai CONFLICT karena mendeteksi indikasi ketegangan sosial, protes warga, atau keluhan terhadap pelayanan pemadaman di lapangan."
            
        elif target_label == "NEGATIF":
            indoor_triggers = [
                'korslet', 'listrik', 'gas', 'kompor', 'percikan', 'tabung',
                'gedung', 'apartemen', 'mall', 'ruko', 'kantor', 'basement',
                'lantai', 'asap indoor', 'panel'
            ] 
            active_fire = [
                'kebakaran', 'kebakar', 'terbakar', 'membakar', 'gosong', 'hangus', 'jago merah',
                'meledak', 'ledakan', 'asap', 'percikan', 'lalap', 'melalap'
            ]
            
            found_indoor = [w for w in indoor_triggers if w in cleaned_combined]
            found_fire = [w for w in active_fire if w in cleaned_combined or w in words_set]
            
            fire_terms = sorted(list(set(found_fire)))
            if fire_terms:
                desc = f"mendeteksi ancaman/bahaya kebakaran aktif ({', '.join(fire_terms)})"
                if found_indoor:
                    desc += f" pada area bangunan/indoor ({', '.join(sorted(list(set(found_indoor))))})"
                return f"Laporan diklasifikasikan sebagai NEGATIF karena {desc}."
            return "Laporan diklasifikasikan sebagai NEGATIF karena mendeteksi indikasi bahaya kebakaran aktif berdasarkan pola kalimat darurat."
            
        elif target_label == "POSITIF":
            safe_triggers = ['pemadam', 'damkar', 'petugas', 'jinak', 'padam', 'aman', 'kondusif', 'selamat']
            found = [w for w in safe_triggers if w in cleaned_combined or w in words_set]
            
            safe_terms = sorted(list(set(found)))
            if safe_terms:
                return f"Laporan diklasifikasikan sebagai POSITIF karena mendeteksi indikasi penanganan kebakaran berhasil, api berhasil dipadamkan, atau kondisi yang telah aman ({', '.join(safe_terms)})."
            return "Laporan diklasifikasikan sebagai POSITIF karena mengindikasikan keberhasilan pemadaman atau situasi yang telah berhasil dikendalikan."
            
        return "Laporan diklasifikasikan sebagai NETRAL karena tidak mengandung indikasi ancaman kebakaran aktif maupun konflik, melainkan sekadar informasi umum, candaan, simulasi, atau imbauan edukatif."

    def predict_sentiment(self, text: str):
        self._load_resources()
        translated_text = self._translate_if_english(text)
        cleaned = self._clean_text(translated_text)
        context_text = self.apply_ngram_context(cleaned)
        seq = self.tokenizer.texts_to_sequences([context_text])
        padded = self.pad_sequences_fn(seq, maxlen=self.max_len, padding='post', truncating='post')
        
        pred_tensor = self.model(padded, training=False)
        pred = pred_tensor.numpy()
        
        result_idx = np.argmax(pred)
        initial_label = self.label_encoder.inverse_transform([result_idx])[0]
        initial_confidence = float(np.max(pred))
        
        label, confidence = self._override_sentiment(text, translated_text, initial_label, initial_confidence)
        
        return {
            "text": text,
            "label": label.upper(),
            "confidence": round(confidence * 100, 2),
            "reason": self._generate_reason(text, translated_text, label.upper())
        }

    def predict_sentiment_batch(self, texts: list[str]):
        """Menganalisis daftar teks secara sekaligus (batch) untuk performa optimal di TensorFlow CPU."""
        if not texts:
            return []
            
        self._load_resources()
        translated_texts = [self._translate_if_english(t) for t in texts]
        cleaned_texts = [self._clean_text(ct) for ct in translated_texts]
        context_texts = [self.apply_ngram_context(ct) for ct in cleaned_texts]
        
        seqs = self.tokenizer.texts_to_sequences(context_texts)
        padded = self.pad_sequences_fn(seqs, maxlen=self.max_len, padding='post', truncating='post')
        
        pred_tensor = self.model(padded, training=False)
        preds = pred_tensor.numpy()
        
        results = []
        for i, pred in enumerate(preds):
            result_idx = np.argmax(pred)
            initial_label = self.label_encoder.inverse_transform([result_idx])[0]
            initial_confidence = float(np.max(pred))
            
            orig_text = texts[i]
            translated_text = translated_texts[i]
            
            label, confidence = self._override_sentiment(orig_text, translated_text, initial_label, initial_confidence)
            
            results.append({
                "text": orig_text,
                "label": label.upper(),
                "confidence": round(confidence * 100, 2),
                "reason": self._generate_reason(orig_text, translated_text, label.upper())
            })
        return results