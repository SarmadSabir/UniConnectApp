import math
from typing import List, Optional
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import pandas as pd
import os

# ---------- Request schemas ----------
class Student(BaseModel):
    user_id: str
    age: int
    year_classification: str
    school: str
    program: str
    major: str
    gender: str
    interests: List[str] = []   # up to 5

class Preferences(BaseModel):
    want_same_interests: bool = False
    want_different_major: bool = False
    # Choose the year preference options
    preferred_genders: Optional[List[str]] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None

class MatchRequest(BaseModel):
    event_id: str
    mode: str = Field("auto", pattern="^(auto|preference)$")
    preferences: Optional[Preferences] = None
    users: List[Student]

# ---------- App ----------
app = FastAPI(title="AI Matchmaker (KMeans Triplets)")
TOKEN = os.environ.get("MATCHER_TOKEN", "dev-secret")

CAT_COLS = ["year_classification","school","program","major","gender"]
NUM_COLS = ["age"]

def encode_batch(users: List[Student]):
    df = pd.DataFrame([u.dict() for u in users])
    # numeric (scaled)
    num_X = df[NUM_COLS].to_numpy(dtype=np.float32) if NUM_COLS else np.zeros((len(df),0))
    scaler = StandardScaler()
    num_X = scaler.fit_transform(num_X) if num_X.shape[1] > 0 else num_X
    # categorical (one-hot)
    ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    cat_X = ohe.fit_transform(df[CAT_COLS]) if CAT_COLS else np.zeros((len(df),0))
    # multi-label interests (batch vocab)
    vocab = sorted({v.strip() for arr in df["interests"].tolist() for v in arr if v and str(v).strip()})
    tok_index = {t:i for i,t in enumerate(vocab)}
    ml = np.zeros((len(df), len(vocab)), dtype=np.float32) if vocab else np.zeros((len(df),0), dtype=np.float32)
    for i, arr in enumerate(df["interests"]):
        for t in arr:
            t = str(t).strip()
            if t in tok_index:
                ml[i, tok_index[t]] = 1.0
    # final feature matrix
    X = np.concatenate([num_X, cat_X, ml], axis=1) if (num_X.shape[1]+cat_X.shape[1]+ml.shape[1])>0 else np.zeros((len(df),0))
    return X, df

def apply_preference_filters(users: List[Student], prefs: Preferences) -> List[Student]:
    out = users
    if prefs.min_age is not None:
        out = [u for u in out if u.age >= prefs.min_age]
    if prefs.max_age is not None:
        out = [u for u in out if u.age <= prefs.max_age]
    if prefs.preferred_genders:
        allowed = set([g.strip() for g in prefs.preferred_genders])
        out = [u for u in out if u.gender in allowed]
    return out

def pref_bonus(df, i, j, prefs: Optional[Preferences]):
    bonus = 0.0
    if not prefs:
        return bonus
    if prefs.want_same_interests:
        si = set(df.iloc[i]["interests"]); sj = set(df.iloc[j]["interests"])
        bonus += 0.02 * len(si & sj)   # small bump per shared interest
    if prefs.want_different_major and df.iloc[i]["major"] != df.iloc[j]["major"]:
        bonus += 0.05                  # small bump if majors differ
    return bonus

def make_triplets(X: np.ndarray, user_ids: list, labels: np.ndarray, df_meta: pd.DataFrame, prefs: Optional[Preferences]):
    cos = cosine_similarity(X)
    groups = []
    clusters = {}
    for idx, lbl in enumerate(labels):
        clusters.setdefault(lbl, []).append(idx)

    remainders = []
    for lbl, idxs in clusters.items():
        local = set(idxs)
        while len(local) >= 3:
            li = list(local)
            best_pair, best_sim = None, -1.0
            for a_i in range(len(li)):
                for b_i in range(a_i+1, len(li)):
                    a, b = li[a_i], li[b_i]
                    sim = cos[a, b] + pref_bonus(df_meta, a, b, prefs)
                    if sim > best_sim:
                        best_sim = sim
                        best_pair = (a, b)
            a, b = best_pair
            local.remove(a); local.remove(b)
            best_c, best_avg = None, -1.0
            for c in list(local):
                avg = ((cos[a, c] + pref_bonus(df_meta,a,c,prefs)) + (cos[b, c] + pref_bonus(df_meta,b,c,prefs))) / 2.0
                if avg > best_avg:
                    best_avg = avg
                    best_c = c
            local.remove(best_c)
            score = ( (cos[a,b] + pref_bonus(df_meta,a,b,prefs)) + (cos[a,best_c] + pref_bonus(df_meta,a,best_c,prefs)) + (cos[b,best_c] + pref_bonus(df_meta,b,best_c,prefs)) ) / 3.0
            groups.append((a,b,best_c,float(score)))
        for r in list(local):
            remainders.append(r)

    # cross-cluster fill
    if remainders:
        pool = set(remainders)
        while len(pool) >= 3:
            anchor = max(pool, key=lambda i: float(np.mean(cos[i, list(pool)])))
            pool.remove(anchor)
            second = max(pool, key=lambda j: cos[anchor, j] + pref_bonus(df_meta,anchor,j,prefs))
            pool.remove(second)
            third = max(pool, key=lambda k: ((cos[anchor,k]+pref_bonus(df_meta,anchor,k,prefs)) + (cos[second,k]+pref_bonus(df_meta,second,k,prefs)))/2.0)
            pool.remove(third)
            score = ( (cos[anchor,second] + pref_bonus(df_meta,anchor,second,prefs)) + (cos[anchor,third] + pref_bonus(df_meta,anchor,third,prefs)) + (cos[second,third] + pref_bonus(df_meta,second,third,prefs)) ) / 3.0
            groups.append((anchor, second, third, float(score)))
        unassigned = [user_ids[i] for i in list(pool)]
    else:
        unassigned = []

    out = []
    for a,b,c,s in groups:
        reasons = []
        if prefs and prefs.want_same_interests:
            si = set(df_meta.iloc[a]["interests"]); sj = set(df_meta.iloc[b]["interests"]); sk = set(df_meta.iloc[c]["interests"])
            shared = sorted(list(si & sj & sk)) or sorted(list((si & sj) | (si & sk) | (sj & sk)))[:3]
            if shared:
                reasons.append("shared_interests:" + ",".join(shared))
        if prefs and prefs.want_different_major:
            majors = {df_meta.iloc[a]["major"], df_meta.iloc[b]["major"], df_meta.iloc[c]["major"]}
            if len(majors) >= 2:
                reasons.append("mixed_majors")
        out.append({
            "members": [user_ids[a], user_ids[b], user_ids[c]],
            "score": s,
            "reasons": reasons
        })
    return out, unassigned

@app.post("/match/cluster-triplets")
def match(req: MatchRequest, authorization: str = Header(None)):
    if authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    users = req.users
    if req.mode == "preference" and req.preferences:
        users = apply_preference_filters(users, req.preferences)
    if len(users) < 3:
        return {"groups": [], "unassigned": [u.user_id for u in users], "metrics": {"n": len(users), "k": 0}}

    X, df = encode_batch(users)
    N = X.shape[0]
    k = math.ceil(N / 3)

    km = KMeans(n_clusters=k, random_state=42, n_init="auto")
    labels = km.fit_predict(X)

    prefs = req.preferences if req.mode == "preference" else None
    groups, unassigned = make_triplets(X, [u.user_id for u in users], labels, df, prefs)

    return {"groups": groups, "unassigned": unassigned, "metrics": {"n": N, "k": k}}
