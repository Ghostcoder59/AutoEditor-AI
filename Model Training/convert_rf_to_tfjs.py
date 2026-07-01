"""
Train a small Keras model on the existing cheer/no_cheer audio dataset and export
it in a format suitable for conversion to TF.js. This script does NOT modify the
project code; it creates a TF Keras model under Model Training/output_tfjs/.

Usage (from repository root):
  python "Model Training/convert_rf_to_tfjs.py"

Requirements (install in your Python environment):
  pip install numpy scipy librosa scikit-learn tensorflow

Optional (to produce TF.js directly):
  pip install tensorflowjs

If `tensorflowjs` is not installed the script will write a Keras H5 model and
print the `tensorflowjs_converter` command to run locally.

This script trains a tiny MLP (small, CPU-friendly) on per-second features
(MFCC(13) mean, spectral centroid mean, zero-crossing rate mean) extracted
from audio files placed in "Model Training/cheer" and "Model Training/no_cheer".

"""

import os
import sys
import math
import json
import numpy as np
from glob import glob

def extract_features_per_second(file_path, segment_length=1.0):
    import librosa
    y, sr = librosa.load(file_path, sr=None)
    features_list = []
    segment_samples = int(segment_length * sr)
    for start in range(0, len(y), segment_samples):
        end = start + segment_samples
        segment = y[start:end]
        if len(segment) < segment_samples:
            segment = np.pad(segment, (0, segment_samples - len(segment)))
        mfcc = librosa.feature.mfcc(y=segment, sr=sr, n_mfcc=13)
        spectral_centroid = librosa.feature.spectral_centroid(y=segment, sr=sr)
        zero_crossing_rate = librosa.feature.zero_crossing_rate(segment)
        feat = np.hstack([np.mean(mfcc, axis=1), np.mean(spectral_centroid), np.mean(zero_crossing_rate)])
        features_list.append(feat)
    return np.array(features_list)


def build_dataset(cheer_dir, no_cheer_dir, max_files=None):
    X = []
    y = []
    cheer_files = glob(os.path.join(cheer_dir, "*.wav"))
    no_files = glob(os.path.join(no_cheer_dir, "*.wav"))
    def process_list(files, label):
        count = 0
        for fp in files:
            try:
                feats = extract_features_per_second(fp)
                # Use per-second segments as training samples
                for row in feats:
                    X.append(row)
                    y.append(label)
            except Exception as e:
                print(f"Warning: failed to process {fp}: {e}")
            count += 1
            if max_files and count >= max_files:
                break

    process_list(cheer_files, 1)
    process_list(no_files, 0)
    X = np.array(X)
    y = np.array(y)
    return X, y


def train_model(X, y, output_dir, epochs=30):
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    import tensorflow as tf
    os.makedirs(output_dir, exist_ok=True)

    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    X_train, X_val, y_train, y_val = train_test_split(Xs, y, test_size=0.2, random_state=42, stratify=y)

    inp_shape = X_train.shape[1]
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(inp_shape,)),
        tf.keras.layers.Dense(64, activation='relu'),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(32, activation='relu'),
        tf.keras.layers.Dense(1, activation='sigmoid'),
    ])

    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

    callbacks = [tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)]

    history = model.fit(X_train, y_train, validation_data=(X_val, y_val), epochs=epochs, batch_size=32, callbacks=callbacks)

    # Evaluate
    loss, acc = model.evaluate(X_val, y_val, verbose=0)
    print(f"Validation loss={loss:.4f}, acc={acc:.4f}")

    # Save scaler and model
    import joblib
    joblib.dump(scaler, os.path.join(output_dir, 'scaler.joblib'))
    model_path_h5 = os.path.join(output_dir, 'model.h5')
    model.save(model_path_h5)
    print(f"Saved Keras model to {model_path_h5}")

    # Try to convert to TF.js using python API if available
    try:
        import tensorflowjs as tfjs
        out_dir = os.path.join(output_dir, 'tfjs_model')
        tfjs.converters.save_keras_model(model, out_dir)
        print(f"Saved TF.js model to {out_dir}")
    except Exception as e:
        print("tensorflowjs not available or conversion failed. To convert manually run:")
        print(f"  pip install tensorflowjs")
        print(f"  tensorflowjs_converter --input_format=keras {model_path_h5} {os.path.join(output_dir,'tfjs_model')} ")

    # Save a small metadata file
    # Save scaler params (mean and scale) so browser-side code can apply same normalization
    scaler_mean = scaler.mean_.tolist() if hasattr(scaler, 'mean_') else None
    scaler_scale = scaler.scale_.tolist() if hasattr(scaler, 'scale_') else None

    meta = {
        'input_shape': inp_shape,
        'scaler': 'scaler.joblib',
        'keras_h5': 'model.h5',
        'scaler_mean': scaler_mean,
        'scaler_scale': scaler_scale,
    }
    with open(os.path.join(output_dir, 'metadata.json'), 'w') as f:
        json.dump(meta, f)

    return model, scaler, history


def main():
    base = os.path.dirname(__file__)
    cheer_dir = os.path.join(base, 'cheer')
    no_cheer_dir = os.path.join(base, 'no_cheer')
    if not os.path.isdir(cheer_dir) or not os.path.isdir(no_cheer_dir):
        print("Dataset folders not found under 'Model Training/cheer' and 'Model Training/no_cheer'. Aborting.")
        sys.exit(1)

    print("Building dataset from audio files (this may take a few minutes)...")
    X, y = build_dataset(cheer_dir, no_cheer_dir)
    print(f"Collected {len(X)} samples ({np.sum(y)} positive)")
    if len(X) < 10:
        print("Not enough samples to train reliably. Aborting.")
        sys.exit(1)

    out_dir = os.path.join(base, 'output_tfjs')
    model, scaler, history = train_model(X, y, out_dir)
    print("Training complete. Artifacts written to:")
    print(f"  {out_dir}")


if __name__ == '__main__':
    main()
