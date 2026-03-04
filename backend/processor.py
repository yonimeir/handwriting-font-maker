import cv2
import numpy as np
import base64
import uuid

def process_image(image_bytes: bytes):
    """
    Process the uploaded image:
    1. Decode
    2. Grayscale, Thresholding, Denoising
    3. Find all Contours (using RETR_LIST to bypass frame constraints)
    4. Filter completely large/enveloping contours (like the page border)
    5. Group into lines & sort RTL
    6. Extract and encode crops as base64
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Invalid image file")

    # Convert to Grayscale and blur
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Otsu's thresholding
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Find ALL contours (RETR_LIST) so we don't get blocked by a dark border around the page
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    bounding_boxes = [cv2.boundingRect(c) for c in contours]
    
    valid_boxes_contours = []
    # Filter out extremely small noise and extremely large page borders
    for box, contour in zip(bounding_boxes, contours):
        x, y, w, h = box
        # Max width/height 90% of image, min 10px
        if w > 10 and h > 10 and w < img.shape[1] * 0.9 and h < img.shape[0] * 0.9:
            valid_boxes_contours.append((box, contour))
            
    if not valid_boxes_contours:
        return []

    # Remove contours that are completely inside other contours (e.g. holes in 'o', 'ס')
    def is_inside(b1, b2):
        # returns True if b1 is completely inside b2
        x1, y1, w1, h1 = b1
        x2, y2, w2, h2 = b2
        return x1 >= x2 and y1 >= y2 and (x1+w1) <= (x2+w2) and (y1+h1) <= (y2+h2)

    final_boxes_contours = []
    for i, (box1, cont1) in enumerate(valid_boxes_contours):
        inside_another = False
        for j, (box2, cont2) in enumerate(valid_boxes_contours):
            if i != j and is_inside(box1, box2):
                inside_another = True
                break
        if not inside_another:
            final_boxes_contours.append((box1, cont1))

    if not final_boxes_contours:
        return []
        
    # Group into lines (Line Segmentation)
    final_boxes_contours.sort(key=lambda b: b[0][1])
    
    lines = []
    current_line = []
    
    for i, (box, contour) in enumerate(final_boxes_contours):
        if not current_line:
            current_line.append((box, contour))
        else:
            first_box_in_line = current_line[0][0]
            # If Y is within ~60% of the first item's height, it belongs to the same line
            if abs(box[1] - first_box_in_line[1]) < max(box[3], first_box_in_line[3]) * 0.6:
                current_line.append((box, contour))
            else:
                lines.append(current_line)
                current_line = [(box, contour)]
    
    if current_line:
        lines.append(current_line)
        
    # Sort each line Right-to-Left (for Hebrew)
    # X coordinate -> 0 is left, so larger X is right
    sorted_contours = []
    for line in lines:
        line.sort(key=lambda b: b[0][0], reverse=True)
        sorted_contours.extend([item[1] for item in line])

    characters = []
    for contour in sorted_contours:
        x, y, w, h = cv2.boundingRect(contour)

        # Crop the character with some padding
        pad = 8
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

        # We will return empty guesses, the frontend will populate them using the transcript
        characters.append({
            "id": str(uuid.uuid4()),
            "guess": "", 
            "image": f"data:image/png;base64,{base64_img}"
        })

    return characters
