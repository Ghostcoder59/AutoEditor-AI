🎬 Automated Video Editor (AI-Powered Highlight Generator)

An advanced Machine Learning project that automatically detects high-energy “cheering” moments from audio and video files and converts them into engaging highlight reels.

By combining audio signal processing with intelligent classification, this system transforms raw media into concise, impactful content — perfect for sports, events, and digital media workflows.

🚀 Features
🎧 Audio-Based Cheer Detection
Extracts features like MFCC, spectral centroid, and zero-crossing rate using Librosa and classifies segments using a Random Forest model.
📊 Waveform Visualization
Displays audio signals with color-coded predictions (cheer vs non-cheer) for intuitive analysis.
🎥 Automated Highlight Generation
Detects key moments in videos and stitches them into a final highlight reel using MoviePy.
⏱️ Segment-Level Precision
Processes audio (1s) and video (2s) chunks to improve detection accuracy.
💾 Model Persistence
Saves trained models using Pickle for reuse and faster execution.
🖥️ Flutter-Based Desktop UI
Responsive Windows interface built with Flutter & Dart.
🛠️ Tech Stack
Languages
Python
Dart
Libraries
Scikit-learn
Librosa
MoviePy
Matplotlib
NumPy
Tools
FFmpeg
Jupyter Notebook
Flutter
📂 Project Structure
Automated-Video-Editor/
│── backend/
│── frontend/
│── data/
│── models/
│── notebooks/
│── README.md
⚙️ Installation
1. Clone the repository
git clone https://github.com/Ghostcoder59/Automated_Video_Editing.git
cd Automated-Video-Editor
2. Install dependencies
pip install -r requirements.txt
3. Install FFmpeg

Make sure FFmpeg is installed and added to your system PATH.

4. Run the project
python main.py
💡 Use Cases
🏏 Sports highlight generation
🎉 Event summarization
🎥 Content creation automation
📈 Audience engagement analysis
🔮 Future Enhancements
🤖 Deep Learning models (CNN/RNN)
⚡ Real-time detection
☁️ Cloud deployment
🌍 Multi-language support
⭐ Support

If you like this project, give it a ⭐ on GitHub!
