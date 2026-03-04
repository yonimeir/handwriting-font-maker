import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from processor import process_image
import cv2
import numpy as np

# Create a dummy white image with a black square (like text on paper)
img = np.ones((200, 200, 3), dtype=np.uint8) * 255
cv2.rectangle(img, (50, 50), (150, 150), (0, 0, 0), -1)
# Add a black border to mimic a photo border
cv2.rectangle(img, (0, 0), (199, 199), (0, 0, 0), 10)

_, encoded = cv2.imencode('.png', img)

try:
    characters = process_image(encoded.tobytes())
    print(f"Success! Found {len(characters)} characters.")
except Exception as e:
    import traceback
    traceback.print_exc()
