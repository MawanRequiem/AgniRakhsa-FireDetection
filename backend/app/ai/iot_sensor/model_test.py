from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.metrics import classification_report

def evaluate_isolation_forest(X_scaled, preds, scores, feature_df, model, random_state=42):
    results = {}

    # =========================
    # 1. SCORE DISTRIBUTION
    # =========================
    print("\n=== 1. Score Distribution ===")
    plt.figure()
    plt.hist(scores, bins=50)
    plt.title("Anomaly Score Distribution")
    plt.xlabel("Score")
    plt.ylabel("Frequency")
    plt.show()

    print("Score stats:")
    print(pd.Series(scores).describe())

    # =========================
    # 2. PCA VISUALIZATION
    # =========================
    print("\n=== 2. PCA Visualization ===")
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)

    plt.figure()
    plt.scatter(X_pca[preds == 1, 0], X_pca[preds == 1, 1], alpha=0.5, label="Normal")
    plt.scatter(X_pca[preds == -1, 0], X_pca[preds == -1, 1], label="Anomaly")
    plt.title("PCA Projection")
    plt.legend()
    plt.show()

    results['pca'] = X_pca

    # =========================
    # 3. CLUSTER CONSISTENCY
    # =========================
    print("\n=== 3. Clustering Consistency ===")
    kmeans = KMeans(n_clusters=3, random_state=random_state)
    clusters = kmeans.fit_predict(X_scaled)

    cluster_anomaly_ratio = {}
    for c in np.unique(clusters):
        mask = clusters == c
        ratio = np.mean(preds[mask] == -1)
        cluster_anomaly_ratio[c] = ratio
        print(f"Cluster {c}: {ratio:.4f} anomalies")

    results['cluster_ratios'] = cluster_anomaly_ratio

    # Plot clusters + anomalies
    plt.figure()
    for c in np.unique(clusters):
        plt.scatter(X_pca[clusters == c, 0], X_pca[clusters == c, 1], alpha=0.3, label=f"Cluster {c}")

    plt.scatter(X_pca[preds == -1, 0], X_pca[preds == -1, 1], label="Anomaly")
    plt.title("Clusters + Anomalies (PCA)")
    plt.legend()
    plt.show()

    # =========================
    # 3B. TRUE CLUSTER DISTANCES (HIGH-D SPACE)
    # =========================
    print("\n=== 3B. True Cluster Distance Analysis ===")

    from scipy.spatial.distance import cdist

    centers = kmeans.cluster_centers_

    # Inter-cluster distances
    dist_matrix = cdist(centers, centers)
    print("Inter-cluster distance matrix:\n", dist_matrix)

    # Intra-cluster distances
    intra_distances = []
    for i in range(len(centers)):
        cluster_points = X_scaled[clusters == i]
        dists = np.linalg.norm(cluster_points - centers[i], axis=1)
        avg_dist = np.mean(dists)
        intra_distances.append(avg_dist)
        print(f"Cluster {i} avg intra-distance: {avg_dist:.4f}")

    results['inter_cluster_dist'] = dist_matrix
    results['intra_cluster_dist'] = intra_distances

    # =========================
    # 3C. SILHOUETTE SCORE
    # =========================
    print("\n=== 3C. Silhouette Score ===")

    from sklearn.metrics import silhouette_score

    sil_score = silhouette_score(X_scaled, clusters)
    print(f"Silhouette Score: {sil_score:.4f}")

    results['silhouette'] = sil_score

    # =========================
    # 3D. ANOMALY DISTANCE ANALYSIS
    # =========================
    print("\n=== 3D. Anomaly Distance to Clusters ===")

    # Distance to nearest cluster center
    dist_all = cdist(X_scaled, centers)
    min_dist_all = dist_all.min(axis=1)

    anomaly_dist = min_dist_all[preds == -1]
    normal_dist = min_dist_all[preds == 1]

    print(f"Avg anomaly distance: {np.mean(anomaly_dist):.4f}")
    print(f"Avg normal distance: {np.mean(normal_dist):.4f}")

    # Optional: visualize
    plt.figure()
    plt.hist(normal_dist, bins=50, alpha=0.5, label="Normal")
    plt.hist(anomaly_dist, bins=50, alpha=0.5, label="Anomaly")
    plt.legend()
    plt.title("Distance to Nearest Cluster Center")
    plt.show()

    results['anomaly_vs_normal_distance'] = {
        'anomaly_mean': float(np.mean(anomaly_dist)),
        'normal_mean': float(np.mean(normal_dist))
    }

    # =========================
    # 4. SYNTHETIC ANOMALY TEST
    # =========================
    print("\n=== 4. Synthetic Anomaly Injection ===")
    n_fake = int(0.1 * len(X_scaled))

    noise = np.random.normal(0, 5, (n_fake, X_scaled.shape[1]))
    X_fake = X_scaled[:n_fake] + noise

    X_test = np.vstack([X_scaled, X_fake])
    y_true = np.hstack([np.ones(len(X_scaled)), -1*np.ones(n_fake)])

    y_pred = model.predict(X_test)

    print(classification_report(y_true, y_pred, digits=4))

    results['synthetic_eval'] = classification_report(y_true, y_pred, output_dict=True)

    # =========================
    # 5. MODEL STABILITY TEST
    # =========================
    print("\n=== 5. Stability Test ===")
    from sklearn.ensemble import IsolationForest

    model2 = IsolationForest(
        n_estimators=100,
        contamination=0.02,
        random_state=random_state + 1
    )
    model2.fit(X_scaled)

    preds2 = model2.predict(X_scaled)

    agreement = np.mean(preds == preds2)
    print(f"Model agreement: {agreement:.4f}")

    results['stability'] = agreement

    # =========================
    # 6. TIME-SERIES OVERLAY
    # =========================
    print("\n=== 6. Time-Series Overlay ===")

    if 'timestamp' in feature_df.columns:
        ts = feature_df['timestamp']
    else:
        ts = feature_df.index

    plt.figure(figsize=(12,4))
    plt.plot(ts, scores, label="Score")
    plt.scatter(
        ts[preds == -1],
        scores[preds == -1],
        label="Anomaly"
    )
    plt.title("Anomaly Scores Over Time")
    plt.legend()
    plt.show()

    return results


# =========================
# RUN EVALUATION
# =========================

evaluation_results = evaluate_isolation_forest(
    X_scaled=X_scaled,
    preds=preds,
    scores=scores,
    feature_df=feature_df,
    model=model
)


# =========================
# 7. THRESHOLD SENSITIVITY
# =========================
print("\n=== 7. Threshold Sensitivity ===")

for p in [0.5, 1, 2, 5]:
    threshold = np.percentile(scores, p)
    pred_custom = np.where(scores < threshold, -1, 1)
    count = np.sum(pred_custom == -1)
    print(f"{p}% threshold → {count} anomalies")

    # =========================
    # SIGNAL VALIDATION
    # =========================

    print("\n=== Signal-Based Validation ===")

    anomalies = feature_df[pred_custom == -1]
    normal = feature_df[pred_custom == 1]

    sensor_cols = ['cng', 'co', 'lpg', 'smoke']

    for col in sensor_cols:
        print(f"\n--- {col.upper()} ---")
        print("Anomaly mean:", anomalies[f"{col}"].mean())
        print("Normal mean :", normal[f"{col}"].mean())

    # =========================
    # TEMPORAL CONSISTENCY
    # =========================

    print("\n=== Temporal Consistency ===")

    anomaly_series = (pred_custom == -1).astype(int)

    runs = []
    count = 0

    for val in anomaly_series:
        if val == 1:
            count += 1
        else:
            if count > 0:
                runs.append(count)
            count = 0

    print("First 20 anomaly run lengths:", runs[:20])
    print("Average run length:", np.mean(runs) if runs else 0)

    # =========================
    # CROSS-SENSOR CORRELATION
    # =========================

    print("\n=== Cross-Sensor Correlation (Anomalies) ===")

    cols = ['cng_mean','co_mean','lpg_mean','smoke_mean']

    if all(c in anomalies.columns for c in cols):
        print(anomalies[cols].corr())
    else:
        print("Some sensor columns missing.")