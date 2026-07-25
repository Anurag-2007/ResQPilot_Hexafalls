import numpy as np
import pandas as pd
import torch
from gliner import GLiNER
from model_class import AmbSelModel

# -------------------------------------------------------------------
# 1. Setup & Initialization
# -------------------------------------------------------------------
model = AmbSelModel.AmbSelModel()
model.load_state_dict(
    torch.load("pretrained/AmbSelectorModel.pth", weights_only=True)
)
model.eval()  # Ensure model is set to evaluation mode

transformer = GLiNER.from_pretrained(
    "finetuned_medical_labelling_fp8", local_files_only=True, load_tokenizer=True
)

# -------------------------------------------------------------------
# 2. Schema Setup
# -------------------------------------------------------------------
labels = [
    "age",
    "heart_rate",
    "systolic_blood_pressure",
    "oxygen_saturation",
    "body_temperature",
    "pain_level",
    "chronic_disease_count",
    "previous_er_visits",
    "arrival_mode",
    "heart issue",
]

# Baseline fallback values
mean_values = default_values = {
    "age": 44.68,
    "heart_rate": 83.19,
    "systolic_blood_pressure": 128.21,
    "oxygen_saturation": 96.07,
    "body_temperature": 37.24,
    "pain_level": 3.41,
    "chronic_disease_count": 1.077,
    "previous_er_visits": 1.292,
    "arrival_mode": "walk_in",
}

std = {
    "age": 19.10,
    "heart_rate": 16.96,
    "systolic_blood_pressure": 18.81,
    "oxygen_saturation": 3.33,
    "body_temperature": 0.914
}
arrival_mode_valid_choice = ["walk_in", "ambulance", "wheelchair"]
ambulances = [
    "PERSONAL TRANSPORT",
    "BASIC LIFE SUPPORT",
    "ADVANCED LIFE SUPPORT",
    "MOBILE ICU",
]

# One-hot encoding options
OnehotCol = {
    "pain_level": list(range(1, 11)),
    "arrival_mode": arrival_mode_valid_choice,
    "chronic_disease_count": list(range(11)),
    "previous_er_visits": list(range(12)),
}

# -------------------------------------------------------------------
# 3. Fast Vectorized Encoder Preparation (Pre-computed)
# -------------------------------------------------------------------
# Pre-build lookup maps for target array offsets to skip Pandas overhead
continuous_labels = [
    "age",
    "heart_rate",
    "systolic_blood_pressure",
    "oxygen_saturation",
    "body_temperature",
]
total_features = len(continuous_labels) + sum(
    len(cats) for cats in OnehotCol.values()
)

# Offset mapping for one-hot categories
onehot_offsets = {}
curr_offset = len(continuous_labels)

for col, categories in OnehotCol.items():
    onehot_offsets[col] = {cat: curr_offset + i for i, cat in enumerate(categories)}
    curr_offset += len(categories)


def text_to_features(text_input: str) -> torch.Tensor:
    """Extracts entities and builds the feature vector fast without Pandas."""
    # Copy defaults
    kv = default_values.copy()

    # GLiNER entity extraction
    entities = transformer.predict_entities(text_input, labels)
    print(entities)

    for entity in entities:
        lbl = entity["label"]
        txt = entity["text"].strip().lower()

        if lbl == "arrival_mode":
            if txt in arrival_mode_valid_choice:
                kv[lbl] = txt
        else:
            try:
                kv[lbl] = float(txt)
            except ValueError:
                pass  # Keep fallback mean if parsing fails

    # Construct vector
    feature_vector = np.zeros(total_features, dtype=np.float32)

    # Fill continuous features (Normalized)
    for idx, col in enumerate(continuous_labels):
        raw_val = kv[col]
        feature_vector[idx] = (raw_val - mean_values[col]) / std[col]

    # Fill one-hot features
    for col, value_map in onehot_offsets.items():
        val = kv[col]
        # Round numerical categories if float extracted from GLiNER
        if isinstance(val, float) and col != "arrival_mode":
            val = int(round(val))

        if val in value_map:
            feature_vector[value_map[val]] = 1.0

    return torch.tensor(feature_vector, dtype=torch.float32).unsqueeze(0)


# -------------------------------------------------------------------
# 4. Inference
# -------------------------------------------------------------------
text_to_test = "Patient is 42 years old, pain level 10. Vitals: heart rate 120, systolic BP 160. Arrival mode: ambulance."

input_tensor = text_to_features(text_to_test)

with torch.inference_mode():
    res = model(input_tensor)
    probs = torch.softmax(res, dim=1)
    predicted_idx = torch.argmax(probs, dim=1).item()

print(f"Recommended Transport: {ambulances[predicted_idx]}")