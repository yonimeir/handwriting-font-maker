import React, { useState } from 'react';
import { Upload, Button, Typography, Layout, theme, Card, Col, Row, Input, Spin, message, Result, Steps, Tooltip, ConfigProvider, Alert } from 'antd';
import { InboxOutlined, CheckCircleOutlined, DownloadOutlined, DeleteOutlined, EditOutlined, PictureOutlined, InfoCircleOutlined } from '@ant-design/icons';
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
        setCharacters(data.characters);
        setStep(1);
        message.success(`זוהו ${data.characters.length} אותיות ברורות בתמונה!`);
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
                              <Tooltip title="מחק חתיכה זו (לכלוך / טעות חיתוך)">
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
      </Layout>
    </ConfigProvider>
  );
}
