import requests
import cv2
import numpy as np

# Create a dummy image with some shapes (representing handwriting)
img = np.ones((400, 800, 3), dtype=np.uint8) * 255
cv2.putText(img, "Abc 123", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 3, (0, 0, 0), 10)
_, encoded_img = cv2.imencode('.png', img)

files = {'file': ('test.png', encoded_img.tobytes(), 'image/png')}
response = requests.post("http://127.0.0.1:8000/upload", files=files)

print("Status Code:", response.status_code)
data = response.json()
print("Response keys:", data.keys())
if "characters" in data:
    print(f"Server extracted {len(data['characters'])} characters.")
