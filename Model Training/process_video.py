import subprocess
import os
import numpy as np
import pickle
import librosa
from moviepy.editor import VideoFileClip, concatenate_videoclips

# ── Load trained model ────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "cheer_detector_rf.pkl")

with open(MODEL_PATH, "rb") as model_file:
    model = pickle.load(model_file)


# ── Feature extraction (must match training exactly) ─────────────────────────
def extract_features(audio_segment, sr):
    mfcc = librosa.feature.mfcc(y=audio_segment, sr=sr, n_mfcc=13)
    spectral_centroid = librosa.feature.spectral_centroid(y=audio_segment, sr=sr)
    zero_crossing_rate = librosa.feature.zero_crossing_rate(audio_segment)
    features = np.hstack([
        np.mean(mfcc, axis=1),
        np.mean(spectral_centroid),
        np.mean(zero_crossing_rate),
    ])
    return features


# ── Merge nearby cheer segments to avoid tiny clips ──────────────────────────
def merge_segments(segments, min_gap=2.0):
    """
    Merge overlapping or nearby (within min_gap seconds) segments.
    Returns a sorted list of (start, end) tuples.
    """
    if not segments:
        return []

    segments.sort()
    merged = []
    current_start, current_end = segments[0]

    for start, end in segments[1:]:
        if start <= current_end + min_gap:
            current_end = max(current_end, end)
        else:
            merged.append((current_start, current_end))
            current_start, current_end = start, end

    merged.append((current_start, current_end))
    return merged


# ── Cut video around cheer moments and concatenate ───────────────────────────
def cut_and_merge_clips(video_path, cheer_segments, output_dir):
    """
    For each merged cheer segment, extract a 10-second window centred on it.
    Returns the path to the output highlight reel, or None if nothing detected.
    """
    if not cheer_segments:
        print("No cheers detected.")
        return None

    video = VideoFileClip(video_path)
    cheer_clips = []

    merged_segments = merge_segments(cheer_segments)

    for start, end in merged_segments:
        mid_point = (start + end) / 2
        clip_start = max(0, mid_point - 5)
        clip_end = min(video.duration, mid_point + 5)

        # Ensure exactly 10 seconds when possible
        if clip_end - clip_start < 10:
            if clip_start == 0:
                clip_end = min(video.duration, clip_start + 10)
            else:
                clip_start = max(0, clip_end - 10)

        clip = video.subclip(clip_start, clip_end)
        cheer_clips.append(clip)

    if not cheer_clips:
        video.close()
        print("No cheers detected.")
        return None

    final_video = concatenate_videoclips(cheer_clips)
    output_video_path = os.path.join(output_dir, "highlight_reel.mp4")
    final_video.write_videofile(output_video_path, codec="libx264", fps=30)
    final_video.close()
    video.close()

    print(f"Highlight reel saved: {output_video_path}")
    return output_video_path


# ── Main pipeline ─────────────────────────────────────────────────────────────
def process_video(video_path, output_dir, segment_duration=2.0, cheer_threshold=0.6):
    """
    1. Extract audio with ffmpeg
    2. Slide a window over it and classify each segment with the RF model
    3. Cut + merge the detected cheer moments into a highlight reel
    Returns the path to the output video, or None.
    """
    audio_path = os.path.join(output_dir, "extracted_audio.wav")

    # Step 1: extract audio
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", video_path, "-q:a", "0", "-map", "a", audio_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError as e:
        print(f"ffmpeg error: {e}")
        return None

    # Step 2: classify each window
    y, sr = librosa.load(audio_path, sr=16000)
    total_duration = librosa.get_duration(y=y, sr=sr)
    cheer_segments = []

    for start_time in np.arange(0, total_duration, segment_duration):
        end_time = min(start_time + segment_duration, total_duration)
        start_sample = int(start_time * sr)
        end_sample = int(end_time * sr)
        segment = y[start_sample:end_sample]

        if len(segment) == 0:
            continue

        features = extract_features(segment, sr).reshape(1, -1)
        probability = model.predict_proba(features)[0][1]

        if probability >= cheer_threshold:
            cheer_segments.append((start_time, end_time))

    # Clean up temp audio
    try:
        os.remove(audio_path)
    except Exception:
        pass

    # Step 3: build highlight reel
    return cut_and_merge_clips(video_path, cheer_segments, output_dir)


# ── CLI usage: python process_video.py --video myvideo.mp4 ───────────────────
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate a cheer highlight reel.")
    parser.add_argument("--video", required=True, help="Path to input video")
    parser.add_argument("--output", default="output", help="Output directory")
    parser.add_argument("--threshold", type=float, default=0.6, help="Cheer probability threshold (0-1)")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)
    result = process_video(args.video, args.output, cheer_threshold=args.threshold)
    if result:
        print(f"Done: {result}")
    else:
        print("No highlight reel generated.")
