import pandas as pd
import numpy as np
import random
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, pairwise_distances
import joblib
import json
from matcher_service import encode_batch, Student

# -----------------------------
# 1. Load your full dataset
# -----------------------------
df = pd.read_csv("university_students_10k.csv")
print("Dataset loaded:", df.shape)

# -----------------------------
# 2. Prepare sampling function
# -----------------------------
def run_event_eval(sample_size=60):
    sample = df.sample(sample_size, random_state=random.randint(0,999))
    # Create Student objects
    users = [
        Student(
            user_id=str(row["user_id"]),
            age=int(row["age"]),
            year_classification=str(row["year_classification"]),
            school=str(row["school"]),
            program=str(row["program"]),
            major=str(row["program"]), 
            gender=str(row["gender"]),
            interests=eval(row["interests"]) if isinstance(row["interests"], str) else []
        )
        for _, row in sample.iterrows()
    ]
    X, _ = encode_batch(users)
    k = int(np.ceil(sample_size / 3))
    km = KMeans(n_clusters=k, random_state=42, n_init="auto")
    labels = km.fit_predict(X)
    sil = silhouette_score(X, labels)
    avg_dist = np.mean(pairwise_distances(X))
    return {"N": sample_size, "k": k, "silhouette": sil, "avg_pairwise_dist": avg_dist}

# -----------------------------
# 3. Run multiple event sizes
# -----------------------------
results = [run_event_eval(n) for n in [30, 45, 60, 90, 120]]
for r in results:
    print(r)

# -----------------------------
# 4. Train and save encoders (v1)
# -----------------------------
users = [
    Student(
        user_id=str(row["user_id"]),
        age=int(row["age"]),
        year_classification=str(row["year_classification"]),
        school=str(row["school"]),
        program=str(row["program"]),
        major=str(row["program"]),
        gender=str(row["gender"]),
        interests=eval(row["interests"]) if isinstance(row["interests"], str) else []
    )
    for _, row in df.iterrows()
]
X_full, _ = encode_batch(users)

encoders = {"shape": X_full.shape}
joblib.dump(encoders, "models/encoders_v1.joblib")

weights = {"same_interest_bonus": 0.02, "different_major_bonus": 0.05}
json.dump(weights, open("models/weights_v1.json", "w"))
print("v1 model artifacts saved to /models/")
