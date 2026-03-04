import React, { useState, useRef, useEffect } from 'react';
import { Upload, Button, Typography, Layout, theme, Card, Col, Row, Input, Spin, message, Result, Steps, Tooltip, ConfigProvider, Alert, Modal, Space } from 'antd';
import { InboxOutlined, CheckCircleOutlined, DownloadOutlined, DeleteOutlined, EditOutlined, PictureOutlined, InfoCircleOutlined, MergeCellsOutlined, BgColorsOutlined, ScissorOutlined, ExpandAltOutlined } from '@ant-design/icons';
import 'antd/dist/reset.css'; // Helps with base styling

const { Title, Text, Paragraph } = Typography;
const { Header, Content } = Layout;
const { Dragger } = Upload;

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [transcript, setTranscript] = useState("אבגדהוזחטיכלמנסעפצקרשתץףןםך"); // Default Hebrew Alphabet

  // Eraser Modal State
  const [editingChar, setEditingChar] = useState(null);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Splitter Modal State
  const [splittingChar, setSplittingChar] = useState(null);
  const canvasSplitRef = useRef(null);
  const [splitX, setSplitX] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const handleFileSelected = async (fileData) => {
    setFile(fileData);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', fileData);

    try {
      const resp = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await resp.json();
      if (data.characters) {
        // Transcript Alignment: Match detected crops to the characters in the exact order
        // Ignoring spaces in the transcript 
        const charsWithoutSpaces = transcript.replace(/\s+/g, '');

        const alignedCharacters = data.characters.map((char, index) => {
          return {
            ...char,
            guess: index < charsWithoutSpaces.length ? charsWithoutSpaces[index] : ""
          };
        });

        setCharacters(alignedCharacters);
        setStep(1);
        message.success(`זוהו ${data.characters.length} אותיות ברורות והותאמו לטקסט!`);
      } else {
        message.error("לא הצלחנו לחלץ אותיות. אנא נסה תמונה ברורה יותר.");
      }
    } catch (err) {
      console.error(err);
      message.error("שגיאה בתקשורת מול השרת. אנא וודא שהשרת פועל תקין.");
    } finally {
      setLoading(false);
    }
    return false; // Prevent default upload behavior
  };

  const updateCharacterGuess = (id, newGuess) => {
    setCharacters(prev =>
      prev.map(c => c.id === id ? { ...c, guess: newGuess } : c)
    );
  };

  const deleteCharacter = (id) => {
    setCharacters(prev => prev.filter(c => c.id !== id));
  };

  const mergeWithNext = async (currentIndex) => {
    if (currentIndex >= characters.length - 1) return;

    setLoading(true);
    try {
      const char1 = characters[currentIndex];
      const char2 = characters[currentIndex + 1];

      // Load both images
      const img1 = new Image();
      const img2 = new Image();
      img1.src = char1.image;
      img2.src = char2.image;

      await Promise.all([
        new Promise(resolve => img1.onload = resolve),
        new Promise(resolve => img2.onload = resolve)
      ]);

      // Create a canvas to merge them side-by-side or stacked
      // For Hebrew handwriting (Right to Left), char1 is usually to the right of char2, 
      // or they are part of the same letter (like 'ה' or 'ק').
      // We will place them side-by-side (char1 on the right, char2 on the left)
      const padding = 10;
      const canvas = document.createElement('canvas');
      canvas.width = img1.width + img2.width + padding;
      canvas.height = Math.max(img1.height, img2.height);
      const ctx = canvas.getContext('2d');

      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw char2 on the left, char1 on the right (RTL logic)
      ctx.drawImage(img2, 0, (canvas.height - img2.height) / 2);
      ctx.drawImage(img1, img2.width + padding, (canvas.height - img1.height) / 2);

      const mergedSrc = canvas.toDataURL('image/png');

      setCharacters(prev => {
        const newChars = [...prev];
        // Create the merged item
        newChars[currentIndex] = {
          ...char1,
          image: mergedSrc
        };
        // Remove the next item since it's now merged
        newChars.splice(currentIndex + 1, 1);

        // Re-align the guesses (Transcript Shifting) backwards
        // because we reduced the number of image boxes by 1
        const charsWithoutSpaces = transcript.replace(/\s+/g, '');
        return newChars.map((char, index) => ({
          ...char,
          guess: index < charsWithoutSpaces.length ? charsWithoutSpaces[index] : ""
        }));
      });
      message.success("חלקי האות המפוצלת מוזגו בהצלחה!");
    } catch (err) {
      console.error(err);
      message.error("תקלה במיזוג התמונות.");
    } finally {
      setLoading(false);
    }
  };

  const expandCharacter = async (currentIndex) => {
    const char = characters[currentIndex];
    if (!char.rect) {
      message.warning('מידע המיקום חסר לאות זו. ייתכן שנוצרה ממיזוג או חיתוך ואי אפשר להרחיבה.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/expand`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(char.rect),
      });

      const data = await resp.json();
      if (data.image) {
        setCharacters(prev => {
          const newChars = [...prev];
          newChars[currentIndex] = {
            ...char,
            image: data.image,
            rect: data.rect // Update to the new expanded rect
          };
          return newChars;
        });
        message.success("גבולות האות הורחבו בהצלחה!");
      } else if (data.error) {
        message.error(data.error);
      }
    } catch (err) {
      console.error(err);
      message.error("שגיאה בהרחבת התמונה מול השרת.");
    } finally {
      setLoading(false);
    }
  };

  const openSplitter = (char, index) => {
    setSplittingChar({ ...char, index });
    setSplitPath([]); // Array of {x, y} coordinates for the cut line
  };

  const closeSplitter = () => {
    setSplittingChar(null);
    setSplitPath([]);
  };

  const [splitPath, setSplitPath] = useState([]);
  const [isSplittingDraw, setIsSplittingDraw] = useState(false);

  useEffect(() => {
    if (splittingChar && canvasSplitRef.current) {
      const canvas = canvasSplitRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = splittingChar.image;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Draw the user's freehand cut line
        if (splitPath.length > 0) {
          ctx.beginPath();
          ctx.strokeStyle = '#ff4d4f'; // Red cut line
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2;
          ctx.moveTo(splitPath[0].x, splitPath[0].y);
          for (let i = 1; i < splitPath.length; i++) {
            ctx.lineTo(splitPath[i].x, splitPath[i].y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      };
    }
  }, [splittingChar, splitPath]);

  const startSplitDraw = (e) => {
    const rect = canvasSplitRef.current.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    setIsSplittingDraw(true);
    setSplitPath([{ x, y }]); // Start a new path
  };

  const drawSplitLine = (e) => {
    if (!isSplittingDraw) return;
    const rect = canvasSplitRef.current.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    setSplitPath(prev => [...prev, { x, y }]);
  };

  const stopSplitDraw = () => {
    setIsSplittingDraw(false);
  };

  const saveSplitEvent = async () => {
    if (!splittingChar || splitPath.length < 2) {
      message.warning('אנא צייר קו חיתוך אדום על התמונה בעזרת העכבר לפני שאתה סוגר.');
      return;
    }
    setLoading(true);
    try {
      const currentIndex = splittingChar.index;
      const char = characters[currentIndex];
      const img = new Image();
      img.src = char.image;

      await new Promise(resolve => img.onload = resolve);

      const canvasW = canvasSplitRef.current.width;
      const canvasH = canvasSplitRef.current.height;
      const scaleX = img.width / canvasW;
      const scaleY = img.height / canvasH;

      // Create an offscreen canvas to perform pixel-perfect splitting
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(img, 0, 0);
      const imgData = offCtx.getImageData(0, 0, img.width, img.height);
      const data = imgData.data;

      // Determine 'cut boundary' for each row based on the drawn path
      // map from y -> x coordinate of the cut
      const cutMap = new Map();

      // Interpolate the points so we have a cut X for every Y
      for (let i = 0; i < splitPath.length - 1; i++) {
        const p1 = splitPath[i];
        const p2 = splitPath[i + 1];

        let yStart = Math.min(p1.y, p2.y);
        let yEnd = Math.max(p1.y, p2.y);

        for (let y = Math.round(yStart); y <= Math.round(yEnd); y++) {
          // Linear interpolation for X based on Y
          let t = (y - p1.y) / (p2.y - p1.y || 1);
          let x = p1.x + t * (p2.x - p1.x);
          // Only keep the rightmost cut (or leftmost, just need a boundary)
          cutMap.set(y, x);
        }
      }

      // If cut doesn't reach top/bottom, extend the first/last known X
      let firstY = Math.min(...Array.from(cutMap.keys()));
      let lastY = Math.max(...Array.from(cutMap.keys()));
      let firstX = cutMap.get(firstY);
      let lastX = cutMap.get(lastY);

      for (let y = 0; y < firstY; y++) cutMap.set(y, firstX);
      for (let y = lastY + 1; y < canvasH; y++) cutMap.set(y, lastX);


      // Create Data arrays for Left side (Left of cut) and Right side (Right of cut)
      const leftData = new Uint8ClampedArray(data.length);
      const rightData = new Uint8ClampedArray(data.length);

      // Fill with purely white background (255, 255, 255, 255)
      for (let i = 0; i < data.length; i += 4) {
        leftData[i] = 255; leftData[i + 1] = 255; leftData[i + 2] = 255; leftData[i + 3] = 255;
        rightData[i] = 255; rightData[i + 1] = 255; rightData[i + 2] = 255; rightData[i + 3] = 255;
      }

      // Split pixels based on the geometric cut line
      for (let y = 0; y < img.height; y++) {
        // Map real Y back to canvas Y to find the cut boundary
        let canvasY = Math.round(y / scaleY);
        let cutBoundaryX = cutMap.get(canvasY) * scaleX;

        for (let x = 0; x < img.width; x++) {
          const idx = (y * img.width + x) * 4;

          if (x < cutBoundaryX) {
            // Pixel goes to LEFT canvas
            leftData[idx] = data[idx];
            leftData[idx + 1] = data[idx + 1];
            leftData[idx + 2] = data[idx + 2];
            leftData[idx + 3] = data[idx + 3];
          } else {
            // Pixel goes to RIGHT canvas
            rightData[idx] = data[idx];
            rightData[idx + 1] = data[idx + 1];
            rightData[idx + 2] = data[idx + 2];
            rightData[idx + 3] = data[idx + 3];
          }
        }
      }

      // Right half (First letter in Hebrew RTL) -> the right side of the image
      const canvasRight = document.createElement('canvas');
      canvasRight.width = img.width;
      canvasRight.height = img.height;
      const ctxRight = canvasRight.getContext('2d');
      ctxRight.putImageData(new ImageData(rightData, img.width, img.height), 0, 0);
      const rightSrc = canvasRight.toDataURL('image/png');

      // Left half (Second letter in Hebrew RTL, left side of the image)
      const canvasLeft = document.createElement('canvas');
      canvasLeft.width = img.width;
      canvasLeft.height = img.height;
      const ctxLeft = canvasLeft.getContext('2d');
      ctxLeft.putImageData(new ImageData(leftData, img.width, img.height), 0, 0);
      const leftSrc = canvasLeft.toDataURL('image/png');

      setCharacters(prev => {
        const newChars = [...prev];
        // Replace current with Right branch (First Hebrew char)
        newChars[currentIndex] = { ...char, image: rightSrc };
        // Insert Left branch (Second Hebrew char)
        newChars.splice(currentIndex + 1, 0, {
          id: char.id + '_split_' + Date.now(),
          image: leftSrc,
          guess: ''
        });

        const charsWithoutSpaces = transcript.replace(/\s+/g, '');
        return newChars.map((c, index) => ({
          ...c,
          guess: index < charsWithoutSpaces.length ? charsWithoutSpaces[index] : ""
        }));
      });
      message.success("האותיות פוצלו בהצלחה לפי קו החיתוך שלך!");
      closeSplitter();
    } catch (err) {
      console.error(err);
      message.error("תקלה בפיצול התמונה.");
    } finally {
      setLoading(false);
    }
  };

  const openEraser = (char) => {
    setEditingChar(char);
  };

  const closeEraser = () => {
    setEditingChar(null);
  };

  useEffect(() => {
    if (editingChar && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = editingChar.image;
      img.onload = () => {
        // Clear and draw image matching canvas size
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // We'll scale the image to fit the 300x300 canvas for easy editing
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Setup Brush (Eraser actually just paints white)
        ctx.strokeStyle = '#ffffff';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 15; // Eraser size
      };
    }
  }, [editingChar]);

  const startDrawing = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
  };

  const saveEraserEdits = () => {
    if (!canvasRef.current || !editingChar) return;
    const updatedSrc = canvasRef.current.toDataURL('image/png');
    setCharacters(prev =>
      prev.map(c => c.id === editingChar.id ? { ...c, image: updatedSrc } : c)
    );
    closeEraser();
    message.success("נשמרו השינויים לאות!");
  };

  const generateFont = async () => {
    const validMappings = characters.filter(c => c.guess && c.guess.trim() !== "");

    if (validMappings.length === 0) {
      message.warning("אנא הזן לפחות אות אחת כדי ליצור את הפונט.");
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

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStep(2);
      message.success("הפונט המותאם אישית נוצר בהצלחה!");
    } catch (err) {
      console.error(err);
      message.error("אירעה שגיאה ביצירת הפונט. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider
      direction="rtl"
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#722ed1', borderRadius: 8, fontFamily: `'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` }
      }}
    >
      <Layout style={{ minHeight: '100vh', background: '#000' }}>
        <Header style={{ display: 'flex', alignItems: 'center', background: '#141414', padding: '0 50px', borderBottom: '1px solid #303030' }}>
          <EditOutlined style={{ fontSize: '24px', color: '#722ed1', marginLeft: '12px' }} />
          <Title level={3} style={{ margin: 0, color: '#fff' }}>Handwriter Studio</Title>
        </Header>

        <Content style={{ padding: '40px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

          <Steps
            current={step}
            items={[
              { title: 'העלאת תמונה', description: 'סרוק דף עם האותיות בכתב ידך' },
              { title: 'אימות תווים', description: 'וודא שהאותיות זוהו נכון' },
              { title: 'קבלת הפונט', description: 'הורד את קובץ הפונט (OTF)' },
            ]}
            style={{ marginBottom: '40px' }}
          />

          <Spin spinning={loading} tip="מעבד נתונים מהשרת, אנא המתן..." size="large">
            <div style={{ minHeight: '400px', padding: '32px', background: '#141414', borderRadius: '12px', border: '1px solid #303030', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>

              {/* Step 0: Upload */}
              {step === 0 && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <Title level={4}>העלה את דף כתב היד שלך</Title>
                  <Paragraph type="secondary" style={{ marginBottom: '24px', fontSize: '16px' }}>
                    המערכת שלנו חכמה, אבל היא צריכה את עזרתך כדי לחלץ את האותיות בצורה מושלמת.
                  </Paragraph>

                  <Alert
                    message={<strong>איך לכתוב ולצלם את הדף?</strong>}
                    description={
                      <div style={{ textAlign: 'right', marginTop: '10px' }}>
                        <ul style={{ paddingRight: '20px', margin: 0, lineHeight: '1.8' }}>
                          <li><strong>הדף:</strong> השתמשו אך ורק בדף לבן וחלק (ללא שורות או משבצות).</li>
                          <li><strong>העט:</strong> כתבו בעט שחור או כהה (עדיפות לטוש או עט פיילוט בעובי בינוני).</li>
                          <li><strong>הכתיבה:</strong> השאירו רווח ברור ובולט בין אות לאות ובין שורה לשורה.</li>
                          <li><strong>התוכן:</strong> כתבו את כל האותיות (א-ת), מספרים, וסימני פיסוק שתרצו בפונט.</li>
                          <li><strong>הצילום:</strong> צלמו באור יום וודאו שאין צל של הטלפון שנופל על הדף. צלמו מלמעלה בצורה ישרה ככל האפשר.</li>
                        </ul>
                      </div>
                    }
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined style={{ fontSize: '24px' }} />}
                    style={{ textAlign: 'right', marginBottom: '32px', borderRadius: '8px', border: '1px solid #434343', background: '#1f1f1f', color: '#fff' }}
                  />

                  <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                    <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '8px' }}>מה כתוב בדף שתעלה?</Text>
                    <Input.TextArea
                      rows={3}
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      placeholder="הקלד כאן עם רווחים רגילים: למשל 'שלום עולם'"
                      style={{ fontSize: '18px', background: '#141414', color: '#fff' }}
                    />
                    <Text type="secondary" style={{ fontSize: '13px', marginTop: '4px', display: 'inline-block' }}>
                      אתה יכול וצריך להקליד עם חללים (רווחים / שורות חדשות). המערכת תתעלם מהם ותתאים רק את האותיות לחיתוכים שבתמונה!
                    </Text>
                  </div>

                  <Dragger
                    accept="image/*"
                    showUploadList={false}
                    customRequest={({ file }) => handleFileSelected(file)}
                    style={{ padding: '40px', background: '#1f1f1f', borderColor: '#434343' }}
                  >
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined style={{ color: '#722ed1' }} />
                    </p>
                    <p className="ant-upload-text" style={{ color: '#fff', fontSize: '18px' }}>לחץ כאן או גרור תמונה לאזור זה</p>
                    <p className="ant-upload-hint" style={{ color: '#8c8c8c' }}>
                      המערכת תומכת בקבצי JPG, PNG וכו'. התמונה תעבור ניקוי, חיתוך וזיהוי אוטומטי בשרת.
                    </p>
                  </Dragger>
                </div>
              )}

              {/* Step 1: Editor Grid */}
              {step === 1 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>אמת את האותיות</Title>
                      <Paragraph type="secondary" style={{ margin: 0, marginTop: '8px' }}>
                        הקלד את האות או הסימן הנכון לכל תמונה שמצאנו. מחק רעשים ולכלוכים בעזרת סמל הפח האדום בפינה.
                      </Paragraph>
                    </div>
                    <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={generateFont}>
                      צור פונט עכשיו
                    </Button>
                  </div>

                  {characters.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                      <PictureOutlined style={{ fontSize: '48px', color: '#434343' }} />
                      <Paragraph style={{ marginTop: '16px', fontSize: '16px' }}>לא זוהו אותיות ברורות בתמונה. אנא הוסף תמונה אחרת.</Paragraph>
                      <Button onClick={() => setStep(0)}>חזור להעלאה</Button>
                    </div>
                  ) : (
                    <Row gutter={[16, 16]}>
                      {characters.map(char => (
                        <Col xs={12} sm={8} md={6} lg={4} key={char.id}>
                          <Card
                            hoverable
                            size="small"
                            style={{ borderColor: '#303030', background: '#1f1f1f' }}
                            actions={[
                              <Tooltip title="ערוך ומחק לכלוך">
                                <EditOutlined key="edit" onClick={() => openEraser(char)} style={{ color: '#1890ff' }} />
                              </Tooltip>,
                              <Tooltip title="פצל אותיות שנדבקו בטעות (יחתוך אותן לחצי בחירתך)">
                                <ScissorOutlined key="split" onClick={() => openSplitter(char, characters.indexOf(char))} style={{ color: '#faad14' }} />
                              </Tooltip>,
                              <Tooltip title="הרחב גבולות (אם הקצה של האות נחתך בטעות)">
                                <ExpandAltOutlined key="expand" onClick={() => expandCharacter(characters.indexOf(char))} style={{ color: '#eb2f96' }} />
                              </Tooltip>,
                              characters.indexOf(char) < characters.length - 1 ? (
                                <Tooltip title="מזג עם האות הבאה (טוב לאותיות כמו ה', ק')">
                                  <MergeCellsOutlined key="merge" onClick={() => mergeWithNext(characters.indexOf(char))} style={{ color: '#52c41a' }} />
                                </Tooltip>
                              ) : <span />,
                              <Tooltip title="מחק חתיכה זו לגמרי">
                                <DeleteOutlined key="delete" onClick={() => deleteCharacter(char.id)} style={{ color: '#ff4d4f' }} />
                              </Tooltip>
                            ]}
                          >
                            <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: '4px', marginBottom: '16px', padding: '8px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                              <img src={char.image} alt="crop" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'contrast(1.2)' }} />
                            </div>
                            <Input
                              size="large"
                              placeholder="?"
                              maxLength={1}
                              value={char.guess}
                              onChange={(e) => updateCharacterGuess(char.id, e.target.value)}
                              style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '20px', background: '#141414' }}
                            />
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </div>
              )}

              {/* Step 2: Download */}
              {step === 2 && (
                <Result
                  status="success"
                  title="הפונט הדיגיטלי שלך נוצר ומוכן!"
                  subTitle="כל האותיות שעברו וקטוריזציה נארזו ומוכנות להתקנה במחשב או בטלפון שלך בצורה מקצועית."
                  extra={[
                    <Button type="primary" key="download" size="large" icon={<DownloadOutlined />} href={downloadUrl} download="MyHandwriting.otf">
                      הורדת הפונט (.OTF)
                    </Button>,
                    <Button key="restart" size="large" onClick={() => {
                      setStep(0);
                      setFile(null);
                      setCharacters([]);
                    }}>
                      צור פונט חדש לחלוטין
                    </Button>,
                  ]}
                />
              )}
            </div>
          </Spin>
        </Content>

        {/* Eraser Modal */}
        <Modal
          title="עורך מחיקה ידני"
          open={!!editingChar}
          onCancel={closeEraser}
          footer={[
            <Button key="cancel" onClick={closeEraser}>ביטול</Button>,
            <Button key="save" type="primary" icon={<CheckCircleOutlined />} onClick={saveEraserEdits}>שמור שינויים</Button>
          ]}
          width={400}
          bodyStyle={{ textAlign: 'center', padding: '20px' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
            צייר עם האצבע או העכבר על האזורים השחורים כדי למחוק לכלוכים ושאריות לא רצויות.
          </Paragraph>
          <div style={{ display: 'inline-block', border: '2px solid #303030', borderRadius: '8px', overflow: 'hidden', background: '#333' }}>
            <canvas
              ref={canvasRef}
              width={300}
              height={300}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={(e) => { e.preventDefault(); startDrawing(e.touches[0] ? { nativeEvent: { offsetX: e.touches[0].clientX - e.target.getBoundingClientRect().left, offsetY: e.touches[0].clientY - e.target.getBoundingClientRect().top } } : e); }}
              onTouchMove={(e) => { e.preventDefault(); draw(e.touches[0] ? { nativeEvent: { offsetX: e.touches[0].clientX - e.target.getBoundingClientRect().left, offsetY: e.touches[0].clientY - e.target.getBoundingClientRect().top } } : e); }}
              onTouchEnd={stopDrawing}
              style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
            />
          </div>
        </Modal>

        {/* Split Modal */}
        <Modal
          title="גזור מסגרת דבוקה לשתיים"
          open={!!splittingChar}
          onCancel={closeSplitter}
          footer={[
            <Button key="cancel" onClick={closeSplitter}>ביטול</Button>,
            <Button key="save" type="primary" icon={<ScissorOutlined />} onClick={saveSplitEvent}>חתוך כאן</Button>
          ]}
          width={400}
          bodyStyle={{ textAlign: 'center', padding: '20px' }}
        >
          <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
            לחץ על התמונה במקום בו תרצה להעביר את סכין החיתוך. קו אדום יסמן את הגבול. החלק הימני יהפוך לאות הראשונה והשמאלי לאות הבאה.
          </Paragraph>
          <div style={{ display: 'inline-block', border: '2px solid #303030', borderRadius: '8px', overflow: 'hidden', background: '#333' }}>
            <canvas
              ref={canvasSplitRef}
              width={300}
              height={150}
              onMouseDown={startSplitDraw}
              onMouseMove={drawSplitLine}
              onMouseUp={stopSplitDraw}
              onMouseLeave={stopSplitDraw}
              onTouchStart={(e) => { e.preventDefault(); startSplitDraw(e.touches[0] ? { nativeEvent: { offsetX: e.touches[0].clientX - e.target.getBoundingClientRect().left, offsetY: e.touches[0].clientY - e.target.getBoundingClientRect().top }, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : e); }}
              onTouchMove={(e) => { e.preventDefault(); drawSplitLine(e.touches[0] ? { nativeEvent: { offsetX: e.touches[0].clientX - e.target.getBoundingClientRect().left, offsetY: e.touches[0].clientY - e.target.getBoundingClientRect().top }, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : e); }}
              onTouchEnd={stopSplitDraw}
              style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
            />
          </div>
        </Modal>

      </Layout>
    </ConfigProvider>
  );
}
