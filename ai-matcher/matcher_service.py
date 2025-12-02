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
class Preferences(BaseModel):
    want_same_interests: bool = False
    want_different_major: bool = False
    want_same_major: bool = False
    want_same_gender: bool = False
    preferred_year_classifications: Optional[List[str]] = None
    preferred_genders: Optional[List[str]] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None

class Student(BaseModel):
    user_id: str
    age: int
    year_classification: str
    school: str
    program: str
    major: str
    gender: str
    interests: List[str] = []   # up to 5
    preferences: Optional[Preferences] = None

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

def to_pref_dict(pref: Optional[Preferences], fallback: Optional[Preferences]):
    source = pref or fallback
    if not source:
        return {}
    data = source.dict()
    def clean_list(values):
        if not values:
            return []
        return [
            str(v).strip()
            for v in values
            if v is not None and str(v).strip()
        ]
    data["preferred_year_classifications"] = clean_list(data.get("preferred_year_classifications"))
    data["preferred_genders"] = clean_list(data.get("preferred_genders"))
    return data

def satisfies_actor_constraints(actor_idx, target_idx, df_meta: pd.DataFrame, prefs_list: List[dict]):
    prefs = prefs_list[actor_idx]
    if not prefs:
        return True
    target_row = df_meta.iloc[target_idx]
    min_age = prefs.get("min_age")
    max_age = prefs.get("max_age")
    allowed_genders = prefs.get("preferred_genders") or []
    allowed_years = prefs.get("preferred_year_classifications") or []
    if min_age is not None and target_row["age"] < min_age:
        return False
    if max_age is not None and target_row["age"] > max_age:
        return False
    if allowed_genders and target_row["gender"] not in allowed_genders:
        return False
    if allowed_years and target_row["year_classification"] not in allowed_years:
        return False
    return True

def pair_respects_constraints(i, j, df_meta: pd.DataFrame, prefs_list: List[dict]):
    return satisfies_actor_constraints(i, j, df_meta, prefs_list) and satisfies_actor_constraints(j, i, df_meta, prefs_list)

def pref_bonus(df, prefs_list, i, j):
    prefs_i = prefs_list[i] or {}
    prefs_j = prefs_list[j] or {}
    si = set(df.iloc[i]["interests"]); sj = set(df.iloc[j]["interests"])
    same_major = df.iloc[i]["major"] == df.iloc[j]["major"]
    majors_differ = not same_major
    same_gender = df.iloc[i]["gender"] == df.iloc[j]["gender"]
    shared_interests = len(si & sj)

    def bonus_for(prefs):
        if not prefs:
            return 0.0
        bonus_val = 0.0
        if prefs.get("want_same_interests"):
            bonus_val += 0.02 * shared_interests
        if prefs.get("want_same_major") and same_major:
            bonus_val += 0.05
        if prefs.get("want_different_major") and majors_differ:
            bonus_val += 0.05
        if prefs.get("want_same_gender") and same_gender:
            bonus_val += 0.04
        return bonus_val

    contributions = []
    val_i = bonus_for(prefs_i)
    if val_i:
        contributions.append(val_i)
    val_j = bonus_for(prefs_j)
    if val_j:
        contributions.append(val_j)

    if contributions:
        return sum(contributions) / len(contributions)
    return 0.0

def make_triplets(X: np.ndarray, users: List[Student], labels: np.ndarray, df_meta: pd.DataFrame, fallback_prefs: Optional[Preferences]):
    cos = cosine_similarity(X)
    groups = []
    clusters = {}
    user_ids = [u.user_id for u in users]
    prefs_list = [to_pref_dict(u.preferences, fallback_prefs) for u in users]
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
                    if not pair_respects_constraints(a, b, df_meta, prefs_list):
                        continue
                    sim = cos[a, b] + pref_bonus(df_meta, prefs_list, a, b)
                    if sim > best_sim:
                        best_sim = sim
                        best_pair = (a, b)
            if not best_pair:
                break
            a, b = best_pair
            local.remove(a); local.remove(b)
            best_c, best_avg = None, -1.0
            for c in list(local):
                if not (pair_respects_constraints(a, c, df_meta, prefs_list) and pair_respects_constraints(b, c, df_meta, prefs_list)):
                    continue
                avg = ((cos[a, c] + pref_bonus(df_meta,prefs_list,a,c)) + (cos[b, c] + pref_bonus(df_meta,prefs_list,b,c))) / 2.0
                if avg > best_avg:
                    best_avg = avg
                    best_c = c
            if best_c is None:
                local.add(a); local.add(b)
                break
            local.remove(best_c)
            score = ( (cos[a,b] + pref_bonus(df_meta,prefs_list,a,b)) + (cos[a,best_c] + pref_bonus(df_meta,prefs_list,a,best_c)) + (cos[b,best_c] + pref_bonus(df_meta,prefs_list,b,best_c)) ) / 3.0
            groups.append((a,b,best_c,float(score)))
        for r in list(local):
            remainders.append(r)

    # cross-cluster fill
    if remainders:
        pool = set(remainders)
        while len(pool) >= 3:
            anchor = max(pool, key=lambda i: float(np.mean(cos[i, list(pool)])))
            pool.remove(anchor)
            second = None
            best_second = -1.0
            for candidate in list(pool):
                if not pair_respects_constraints(anchor, candidate, df_meta, prefs_list):
                    continue
                score = cos[anchor, candidate] + pref_bonus(df_meta, prefs_list, anchor, candidate)
                if score > best_second:
                    best_second = score
                    second = candidate
            if second is None:
                pool.add(anchor)
                break
            pool.remove(second)
            third = None
            best_third = -1.0
            for candidate in list(pool):
                if not (
                    pair_respects_constraints(anchor, candidate, df_meta, prefs_list)
                    and pair_respects_constraints(second, candidate, df_meta, prefs_list)
                ):
                    continue
                avg = ((cos[anchor,candidate]+pref_bonus(df_meta,prefs_list,anchor,candidate)) + (cos[second,candidate]+pref_bonus(df_meta,prefs_list,second,candidate)))/2.0
                if avg > best_third:
                    best_third = avg
                    third = candidate
            if third is None:
                pool.add(anchor)
                pool.add(second)
                break
            pool.remove(third)
            score = ( (cos[anchor,second] + pref_bonus(df_meta,prefs_list,anchor,second)) + (cos[anchor,third] + pref_bonus(df_meta,prefs_list,anchor,third)) + (cos[second,third] + pref_bonus(df_meta,prefs_list,second,third)) ) / 3.0
            groups.append((anchor, second, third, float(score)))
        unassigned = [user_ids[i] for i in list(pool)]
    else:
        unassigned = []

    out = []
    for a,b,c,s in groups:
        reasons = []
        triplet_prefs = [prefs_list[a], prefs_list[b], prefs_list[c]]
        if any(p.get("want_same_interests") for p in triplet_prefs if p):
            si = set(df_meta.iloc[a]["interests"]); sj = set(df_meta.iloc[b]["interests"]); sk = set(df_meta.iloc[c]["interests"])
            shared = sorted(list(si & sj & sk)) or sorted(list((si & sj) | (si & sk) | (sj & sk)))[:3]
            if shared:
                reasons.append("shared_interests:" + ",".join(shared))
        majors = {df_meta.iloc[a]["major"], df_meta.iloc[b]["major"], df_meta.iloc[c]["major"]}
        genders = {df_meta.iloc[a]["gender"], df_meta.iloc[b]["gender"], df_meta.iloc[c]["gender"]}
        years = {
            df_meta.iloc[a]["year_classification"],
            df_meta.iloc[b]["year_classification"],
            df_meta.iloc[c]["year_classification"],
        }
        if majors and len(majors) == 1 and any(p.get("want_same_major") for p in triplet_prefs if p):
            reasons.append("same_major")
        if len(majors) >= 2 and any(p.get("want_different_major") for p in triplet_prefs if p):
            reasons.append("mixed_majors")
        if genders and len(genders) == 1 and any(p.get("want_same_gender") for p in triplet_prefs if p):
            reasons.append("same_gender")
        if years and all(
            (not p.get("preferred_year_classifications")) or years.issubset(set(p.get("preferred_year_classifications")))
            for p in triplet_prefs if p
        ):
            if any(p.get("preferred_year_classifications") for p in triplet_prefs if p):
                reasons.append("preferred_year_match")
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
    if len(users) < 3:
        return {"groups": [], "unassigned": [u.user_id for u in users], "metrics": {"n": len(users), "k": 0}}

    X, df = encode_batch(users)
    N = X.shape[0]
    k = math.ceil(N / 3)

    km = KMeans(n_clusters=k, random_state=42, n_init="auto")
    labels = km.fit_predict(X)

    prefs = req.preferences if req.mode == "preference" else None
    groups, unassigned = make_triplets(X, users, labels, df, prefs)

    return {"groups": groups, "unassigned": unassigned, "metrics": {"n": N, "k": k}}
