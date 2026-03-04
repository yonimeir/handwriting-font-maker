import requests

mappings = [
    {
        "id": "char_1",
        "guess": "A",
        "image": "base64..."
    },
    {
        "id": "char_2",
        "guess": "b",
        "image": "base64..."
    }
]

response = requests.post("http://127.0.0.1:8000/generate-font", json={"mappings": mappings})

print("Status Code:", response.status_code)
if response.status_code == 200:
    with open("test_download.otf", "wb") as f:
        f.write(response.content)
    print("Downloaded font successfully to test_download.otf")
else:
    print("Response:", response.text)
