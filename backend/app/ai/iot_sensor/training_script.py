# Sensor Anomaly Detection with Isolation Forest

# --- 1. Imports ---
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib

# --- 2. Load Data ---
# Long format dataset: columns = ['data_type', 'unit', 'data_value', 'time']

df = pd.read_csv(file_path, sep = ';')

# Rename for consistency
_df = df.rename(columns={
    'time': 'timestamp',
    'data_type': 'sensor',
    'data_value': 'value'
})

_df['timestamp'] = pd.to_datetime(_df['timestamp'])

# Pivot to wide format (each sensor becomes a column)
df = _df.pivot_table(index='timestamp', columns='sensor', values='value', aggfunc='mean')

df.columns = df.columns.str.strip().str.lower()

df = df.sort_index()

# --- 3. Resample to fixed interval (5 seconds) ---
df = df.resample('5s').mean()

# --- 4. Handle missing values ---
# Example sensor names (adjust as needed)
cng_cols = [col for col in df.columns if col.lower() == 'cng']
co_cols = [col for col in df.columns if col.lower() == 'co']
flame_cols = [col for col in df.columns if col.lower() == 'flame_presence']
lpg_cols = [col for col in df.columns if col.lower() == 'lpg']
smoke_cols = [col for col in df.columns if col.lower() == 'smoke']

# Interpolate smooth sensors
gas_cols = cng_cols + co_cols + lpg_cols + smoke_cols
for col in gas_cols:
    df[col] = df[col].interpolate(method='time', limit = 3)

# Forward fill flame sensors
for col in flame_cols:
    df[col] = df[col].ffill()

# Drop remaining NaNs
_df = df.dropna()

print(_df.isna().sum())
print(_df.head())
_df[['cng','co','lpg','smoke','flame_presence']].iloc[:200].plot()
plt.show()

# --- 5. Feature Engineering (Sliding Window) ---
window_size = 9  # ~45 seconds (9 * 5s)
step = 1

features = []

for i in range(0, len(_df) - window_size, step):
    window = _df.iloc[i:i+window_size]
    feat = {}

    for col in _df.columns:
        values = window[col].values

        feat[f'{col}_mean'] = np.mean(values)
        feat[f'{col}_std'] = np.std(values)
        feat[f'{col}_max'] = np.max(values)
        feat[f'{col}_min'] = np.min(values)
        feat[f'{col}_range'] = np.max(values) - np.min(values)
        feat[f'{col}_slope'] = (values[-1] - values[0]) / window_size
        feat[f'{col}_last'] = values[-1]
        feat['timestamp'] = window.index[-1]

        # Optional: threshold count for flame
        if col in flame_cols:
            threshold = np.percentile(values, 90)
            feat[f'{col}_threshold_count'] = np.sum(values > threshold)

    features.append(feat)

feature_df = pd.DataFrame(features)

print(feature_df.head())
print(feature_df.describe())

# --- 6. Normalize Features ---
# Keep timestamp separate for plotting later
timestamps = feature_df.pop('timestamp')

scaler = StandardScaler()
X_scaled = scaler.fit_transform(feature_df)

# --- 7. Train Isolation Forest ---
model = IsolationForest(n_estimators=100, contamination=0.02, random_state=42)
model.fit(X_scaled)

preds = model.predict(X_scaled)
scores = model.decision_function(X_scaled)

print("Anomaly count:", np.sum(preds == -1))

feature_df['timestamp'] = timestamps

feature_df['score'] = scores
feature_df['anomaly'] = preds

plt.figure(figsize=(12,5))
plt.plot(scores, label='Anomaly Score')
plt.axhline(y=0, color='r', linestyle='--')
plt.legend()
plt.show()

feature_df.set_index('timestamp', inplace=True)

plt.figure(figsize=(12,5))
plt.plot(feature_df.index, feature_df['score'])
plt.scatter(
    feature_df.index[feature_df['anomaly'] == -1],
    feature_df['score'][feature_df['anomaly'] == -1],
    color='red'
)
plt.show()

# --- 8. Save Model & Scaler ---
folder_path = '/content/drive/MyDrive/isolation_forest_model'

if not os.path.exists(folder_path):
    os.makedirs(folder_path)
    print(f"Created folder: {folder_path}")

model_file = os.path.join(folder_path, 'isolation_forest_model.pkl')
scaler_file = os.path.join(folder_path, 'scaler.pkl')

joblib.dump(model, model_file)
joblib.dump(scaler, scaler_file)

print(f"Model and Scaler successfully saved/overwritten in: {folder_path}")

# --- 9. Inference Function ---
def predict_anomaly(new_df, model, scaler):
    new_df = new_df.resample('5S').mean()

    for col in gas_cols:
      if col in new_df:
          new_df[col] = new_df[col].interpolate(method='time')

    for col in flame_cols:
        if col in new_df:
            new_df[col] = new_df[col].ffill()

    new_df = new_df.dropna()

    feats = []
    for i in range(0, len(new_df) - window_size, step):
        window = new_df.iloc[i:i+window_size]
        feat = {}

        for col in new_df.columns:
            values = window[col].values
            feat[f'{col}_mean'] = np.mean(values)
            feat[f'{col}_std'] = np.std(values)
            feat[f'{col}_max'] = np.max(values)
            feat[f'{col}_min'] = np.min(values)
            feat[f'{col}_range'] = np.max(values) - np.min(values)
            feat[f'{col}_slope'] = (values[-1] - values[0]) / window_size
            feat[f'{col}_last'] = values[-1]

            if col in flame_cols:
                threshold = np.percentile(values, 90)
                feat[f'{col}_threshold_count'] = np.sum(values > threshold)

        feats.append(feat)

    feats_df = pd.DataFrame(feats)
    X = scaler.transform(feats_df)

    preds = model.predict(X)
    scores = model.decision_function(X)

    return preds, scores

print("Training complete. Model saved.")

