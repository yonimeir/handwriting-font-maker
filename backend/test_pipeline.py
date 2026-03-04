import sys
import os
import cv2
import numpy as np

# Ensure backend acts as a module root
sys.path.append(os.path.dirname(__file__))
from processor import process_image

def test(image_path):
    if not os.path.exists(image_path):
        print(f"Error: Could not find image at {image_path}")
        return
        
    print(f"Reading {image_path}...")
    with open(image_path, "rb") as f:
        image_bytes = f.read()
        
    try:
        print("Processing image via pipeline...")
        characters = process_image(image_bytes)
        print(f"Pipeline finished! Extracted {len(characters)} character contours.")
        
        # Create debug output directory
        out_dir = os.path.join(os.path.dirname(image_path), "debug_output")
        os.makedirs(out_dir, exist_ok=True)
        
        # Clear out old files
        for f in os.listdir(out_dir):
            if f.endswith(".png"):
                os.remove(os.path.join(out_dir, f))
                
        import base64
        for i, char in enumerate(characters):
            # Parse base64 header
            b64_data = char['image'].split(',')[1]
            img_data = base64.b64decode(b64_data)
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Save nicely formatted output
            out_file = os.path.join(out_dir, f"char_{i:03d}.png")
            cv2.imwrite(out_file, img)
            
        print(f"Successfully saved all {len(characters)} chopped images to folder: {out_dir}")
        print("Ready for review!")
        
    except Exception as e:
        import traceback
        print("Pipeline Failed!")
        traceback.print_exc()

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "test.jpg"
    test(target)
