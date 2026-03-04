import { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, Type, X, Download } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [characters, setCharacters] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const fileInputRef = useRef(null);
  const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-active');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-active');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-active');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = async (selectedFile) => {
    setFile(selectedFile);
    setLoading(true);

    // Simulate initial scan UI feel, then send to backend
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const resp = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await resp.json();
      if (data.characters) {
        setCharacters(data.characters);
        setStep(2); // Move to grid approval
      } else {
        alert("Could not extract characters. Please try a clearer image.");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to the local Handwriting API.");
    } finally {
      setLoading(false);
    }
  };

  const updateCharacterGuess = (id, newGuess) => {
    setCharacters(prev =>
      prev.map(c => c.id === id ? { ...c, guess: newGuess } : c)
    );
  };

  const deleteCharacter = (id) => {
    setCharacters(prev => prev.filter(c => c.id !== id));
  };

  const generateFont = async () => {
    // Filter out characters without a guess
    const validMappings = characters.filter(c => c.guess.trim() !== "");

    if (validMappings.length === 0) {
      alert("Please map at least one character to a letter.");
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/generate-font`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mappings: validMappings }),
      });

      if (!resp.ok) throw new Error("API Error");

      // Handle the blob download
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStep(3); // Result stage

    } catch (err) {
      console.error(err);
      alert("Failed to generate font. Please check the python server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" dir="rtl">
      <header className="app-header">
        <h1 className="text-gradient" style={{ textAlign: 'center' }}>
          <Type size={40} className="inline-block ml-3 mb-2" />
          יוצר הפונטים שלי
        </h1>
        <p>הפוך את כתב היד היפה שלך לפונט דיגיטלי ברגע.</p>
      </header>

      <main>
        {loading ? (
          <div className="loader-container glass-panel">
            <div className="spinner"></div>
            <h3 className="text-xl font-bold">מעבד...</h3>
            <p className="text-text-muted mt-2">הבינה המלאכותית מנתחת את משיכות המכחול שלך</p>
          </div>
        ) : (
          <>
            {/* Step 1: Upload */}
            {step === 1 && (
              <div
                className="upload-zone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />
                <UploadCloud className="upload-icon" />
                <h2 className="text-2xl font-bold mb-2">העלה את דף כתב היד שלך</h2>
                <p className="text-text-muted mb-6 px-4">
                  צלם תמונה או העלה סריקה. לתוצאות הטובות ביותר, כתוב בבירור על דף חלק (ללא שורות).
                </p>
                <button className="btn btn-primary">בחר תמונה</button>
              </div>
            )}

            {/* Step 2: Grid Editing */}
            {step === 2 && (
              <div className="editor-container glass-panel p-6">
                <div className="editor-header">
                  <div>
                    <h2 className="text-2xl font-bold">אמת את האותיות</h2>
                    <p className="text-text-muted text-sm mt-1">הקלד את האות הנכונה עבור כל חיתוך, או מחק לכלוכים.</p>
                  </div>
                  <button className="btn btn-primary" onClick={generateFont}>
                    <CheckCircle size={20} className="ml-2" />
                    צור פונט
                  </button>
                </div>

                <div className="chars-grid">
                  {characters.map(char => (
                    <div className="char-card" key={char.id}>
                      <button
                        className="delete-btn"
                        title="הסר לכלוך/שגיאה"
                        onClick={() => deleteCharacter(char.id)}
                      >
                        <X size={16} />
                      </button>
                      <div className="char-image-container">
                        <img src={char.image} alt="crop" className="char-image" />
                      </div>
                      <input
                        type="text"
                        maxLength="1"
                        className="char-input"
                        placeholder="?"
                        value={char.guess}
                        onChange={(e) => updateCharacterGuess(char.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Success Download */}
            {step === 3 && (
              <div className="completion-view glass-panel">
                <CheckCircle className="success-icon" />
                <h2 className="text-4xl font-bold mb-4">הפונט נוצר!</h2>
                <p className="text-text-muted mb-8 text-lg">
                  כתב היד המותאם אישית שלך ארוז כעת כקובץ פונט דיגיטלי.
                </p>

                <div className="flex gap-4 justify-center">
                  <a href={downloadUrl} download="MyHandwriting.otf" className="btn btn-primary">
                    <Download size={20} className="ml-2" />
                    הורד קובץ .OTF
                  </a>
                  <button className="btn btn-secondary" onClick={() => {
                    setStep(1);
                    setFile(null);
                    setCharacters([]);
                  }}>
                    הכן פונט נוסף
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
