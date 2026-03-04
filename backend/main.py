from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Handwriting to Font API")

# Allow requests from the frontend (React Native / Web)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Handwriting to Font API"}

from processor import process_image
import base64
import cv2
import numpy as np

# A very simple dictionary cache to hold the last uploaded image in memory.
# In a real production environment, this should be Redis or S3, but for a single-user tool it's fine.
image_cache = {}

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    # This endpoint receives the image, processes it, and returns segmented characters
    try:
        contents = await file.read()
        
        # Save to cache for potential future expansion requests
        # We process it slightly to ensure we have the same resized base image 
        # that the processor used to calculate X,Y bounding boxes
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        max_dim = 1600
        h, w = img.shape[:2]
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        
        # Convert to Grayscale & Adaptive Threshold to match exactly what the user sees
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 61, 25)
        kernel = np.ones((5, 5), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=1)
        cv2.rectangle(thresh, (0, 0), (thresh.shape[1]-1, thresh.shape[0]-1), 0, 10)
        
        image_cache['last_image'] = thresh
        
        characters = process_image(contents)
        return {"filename": file.filename, "status": "Upload successful", "characters": characters}
    except Exception as e:
        return {"error": str(e)}

class ExpandRequest(BaseModel):
    x: int
    y: int
    w: int
    h: int

@app.post("/expand")
async def expand_character(request: ExpandRequest):
    try:
        if 'last_image' not in image_cache:
            return {"error": "No image in memory. Please upload again."}
            
        img = image_cache['last_image']
        
        # Expand by 15 pixels in all directions
        pad = 15
        y_start = max(0, request.y - pad)
        y_end = min(img.shape[0], request.y + request.h + pad)
        x_start = max(0, request.x - pad)
        x_end = min(img.shape[1], request.x + request.w + pad)
        
        roi = img[y_start:y_end, x_start:x_end]
        roi_disp = cv2.bitwise_not(roi)
        
        _, buffer = cv2.imencode('.png', roi_disp)
        base64_img = base64.b64encode(buffer).decode('utf-8')
        
        # Return new image array and the updated rectangle geometry
        return {
            "image": f"data:image/png;base64,{base64_img}",
            "rect": {
                "x": x_start,
                "y": y_start,
                "w": x_end - x_start,
                "h": y_end - y_start
            }
        }
    except Exception as e:
        return {"error": str(e)}

from builder import generate_font_from_mappings
import traceback
from fastapi.responses import FileResponse
from pydantic import BaseModel

class MappingItem(BaseModel):
    id: str
    guess: str
    image: str

class GenerateFontRequest(BaseModel):
    mappings: list[MappingItem]

@app.post("/generate-font")
async def generate_font(request: GenerateFontRequest):
    # This endpoint receives the confirmed character mappings and generates the font
    try:
        mappings_dict = [m.model_dump() for m in request.mappings]
        font_path = generate_font_from_mappings(mappings_dict)
        return FileResponse(font_path, media_type="font/otf", filename="CustomHandwriting.otf")
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
