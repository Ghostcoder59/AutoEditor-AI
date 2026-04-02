from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import shutil
import uuid
from process_video import process_video

jobs = {}

def bg_process_video(job_id: str, video_path: str, output_dir: str):
    try:
        output_video_path = process_video(video_path, output_dir)
        
        if not output_video_path or not os.path.exists(output_video_path):
            jobs[job_id] = {"status": "error", "message": "No cheers detected. Video processed but no highlights generated.", "download_url": None}
        else:
            jobs[job_id] = {"status": "success", "message": "Video processed successfully.", "download_url": f"/download/{job_id}/highlight_reel.mp4"}
            
    except Exception as e:
        jobs[job_id] = {"status": "error", "message": str(e), "download_url": None}
    finally:
        # Clean up the original upload
        if os.path.exists(video_path):
            try:
                os.remove(video_path)
            except Exception:
                pass

app = FastAPI(title="Automated Video Editor API", description="API to process videos and extract cheering moments.")

# CORS settings to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "output"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Automated Video Editor API!"}

@app.post("/process")
async def process_video_endpoint(file: UploadFile = File(...), background_tasks: BackgroundTasks = BackgroundTasks()):
    if not file.content_type.startswith("video/"):
         raise HTTPException(status_code=400, detail="Invalid file type. Please upload a video.")
    
    # Create unique filename
    unique_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1]
    video_filename = f"{unique_id}{file_extension}"
    video_path = os.path.join(UPLOAD_FOLDER, video_filename)
    
    # Save the uploaded file
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Process the video in background
    output_dir = os.path.join(OUTPUT_FOLDER, unique_id)
    os.makedirs(output_dir, exist_ok=True)
    
    jobs[unique_id] = {"status": "processing", "message": "Analyzing audio & video...", "download_url": None}
    background_tasks.add_task(bg_process_video, unique_id, video_path, output_dir)
    return {"job_id": unique_id, "status": "processing", "message": "Processing started."}

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.get("/download/{job_id}/{filename}")
async def download_video(job_id: str, filename: str):
    file_path = os.path.join(OUTPUT_FOLDER, job_id, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="video/mp4", filename=filename)
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
