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

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    # This endpoint receives the image, processes it, and returns segmented characters
    try:
        contents = await file.read()
        characters = process_image(contents)
        return {"filename": file.filename, "status": "Upload successful", "characters": characters}
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
