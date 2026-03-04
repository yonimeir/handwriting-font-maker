import cv2
import numpy as np
import base64
import uuid

def process_image(image_bytes: bytes):
    """
    Process the uploaded image:
    1. Decode
    2. Grayscale, Thresholding, Denoising
    3. Find Contours (Characters)
    4. Extract and encode crops as base64
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Invalid image file")

    # Convert to Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Blur slightly to remove noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Otsu's thresholding
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    characters = []
    
    # Sort contours from top to bottom, left to right (rough heuristic for Hebrew)
    # We will do a basic left-to-right sort for now for demonstration
    bounding_boxes = [cv2.boundingRect(c) for c in contours]
    
    if not bounding_boxes:
        return []
        
    (contours, bounding_boxes) = zip(*sorted(zip(contours, bounding_boxes),
                                             key=lambda b: b[1][0], reverse=True))

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)

        # Filter out noise (dots, very small smudges)
        if w > 10 and h > 10:
            # Crop the character with some padding
            pad = 5
            y_start = max(0, y - pad)
            y_end = min(img.shape[0], y + h + pad)
            x_start = max(0, x - pad)
            x_end = min(img.shape[1], x + w + pad)
            
            roi = thresh[y_start:y_end, x_start:x_end]

            # Invert back (black text on white background) for the user to see clearly
            roi_disp = cv2.bitwise_not(roi)

            # Encode as base64 png
            _, buffer = cv2.imencode('.png', roi_disp)
            base64_img = base64.b64encode(buffer).decode('utf-8')

            # We would integrate Tesseract OCR here. 
            # For now, we will return empty guesses for the user to map manually.
            characters.append({
                "id": str(uuid.uuid4()),
                "guess": "", 
                "image": f"data:image/png;base64,{base64_img}"
            })

    return characters
