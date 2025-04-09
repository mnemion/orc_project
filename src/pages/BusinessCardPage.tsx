import React, { useState } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Alert, 
  Snackbar, 
  Button,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Link as MuiLink,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import WorkIcon from '@mui/icons-material/Work';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LanguageIcon from '@mui/icons-material/Language';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import FaxIcon from '@mui/icons-material/Fax';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Layout from '../components/Layout';

interface BusinessCardResult {
  success: boolean;
  full_text?: string;
  name?: string;
  position?: string;
  company?: string;
  email?: string[];
  phone?: {
    mobile: string[];
    phone: string[];
    fax: string[];
    international: string[];
  };
  address?: string;
  website?: string[];
  error?: string;
  file_url?: string;
}

const BusinessCardPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<BusinessCardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [ocrModel, setOcrModel] = useState<string>('auto');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      
      // 이미지 파일인지 확인
      if (!selectedFile.type.startsWith('image/')) {
        setError('이미지 파일만 업로드 가능합니다.');
        setSnackbarOpen(true);
        return;
      }
      
      setFile(selectedFile);
      
      // 이미지 미리보기 URL 생성
      const previewUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(previewUrl);
      
      // 이전 결과 초기화
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('명함 이미지를 먼저 업로드해주세요.');
      setSnackbarOpen(true);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      
      // 파일 확장자 추출
      const getFileExtension = (filename: string): string => {
        const parts = filename.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
      };
      
      // 원본 파일 추가
      formData.append('file', file);
      
      // 확장자 명시적으로 추가
      const fileExtension = getFileExtension(file.name);
      formData.append('file_extension', fileExtension);
      
      // OCR 모델 선택 전달
      formData.append('ocr_model', ocrModel);

      // 타임아웃 처리를 위한 Promise.race 사용
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃

      const response = await fetch('/api/parse-business-card', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId); // 응답이 도착하면 타임아웃 취소

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '명함 분석 중 오류가 발생했습니다');
      }

      // 응답 구조 확인 후 결과 설정
      if (data.success) {
        // 응답 구조가 변경되었는지 확인
        const resultData = data.data || data;
        setResult({
          success: true,
          ...resultData
        });
      } else {
        setError(data.error || '명함 분석에 실패했습니다.');
        setSnackbarOpen(true);
      }
    } catch (err) {
      // AbortError는 타임아웃 발생
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('명함 분석 시간이 초과되었습니다. 다시 시도해주세요.');
      } else {
        setError(err instanceof Error ? err.message : '명함 분석 중 오류가 발생했습니다');
      }
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const handleCopyText = () => {
    if (result?.full_text) {
      navigator.clipboard.writeText(result.full_text)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        })
        .catch(err => {
          console.error('텍스트 복사 실패:', err);
          setError('텍스트를 클립보드에 복사하지 못했습니다.');
          setSnackbarOpen(true);
        });
    }
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            명함 인식
          </Typography>
          <Typography variant="body1" color="text.secondary">
            명함 이미지에서 이름, 연락처, 회사 정보 등을 자동으로 추출하는 기능입니다.
            명함을 스캔하여 연락처 정보를 쉽게 디지털화할 수 있습니다.
          </Typography>
        </Box>
        
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="business-card-input"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="business-card-input">
              <Button
                variant="contained"
                component="span"
                startIcon={<ContactMailIcon />}
                sx={{ mb: 2 }}
              >
                명함 이미지 선택
              </Button>
            </label>
            
            {previewUrl && (
              <Box 
                sx={{ 
                  mt: 2, 
                  mb: 3, 
                  border: '1px solid #e0e0e0', 
                  borderRadius: 1,
                  p: 1,
                  maxWidth: '100%',
                  height: '300px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'hidden'
                }}
              >
                <img 
                  src={previewUrl} 
                  alt="명함 이미지 미리보기" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    objectFit: 'contain' 
                  }} 
                />
              </Box>
            )}
            
            <FormControl sx={{ minWidth: 200, mb: 3, mt: 1 }}>
              <InputLabel id="ocr-model-label">OCR 엔진 선택</InputLabel>
              <Select
                labelId="ocr-model-label"
                value={ocrModel}
                label="OCR 엔진 선택"
                onChange={(e) => setOcrModel(e.target.value)}
                size="small"
              >
                <MenuItem value="auto">자동 (추천)</MenuItem>
                <MenuItem value="gemini">Gemini AI (한국어 인식 향상)</MenuItem>
                <MenuItem value="tesseract">Tesseract OCR</MenuItem>
              </Select>
              <FormHelperText>한국어 텍스트 인식 향상을 위해 Gemini AI 권장</FormHelperText>
            </FormControl>
            
            <Button 
              variant="contained" 
              color="primary"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ContactMailIcon />}
              onClick={handleAnalyze}
              disabled={loading || !file}
            >
              {loading ? '분석 중...' : '명함 정보 추출하기'}
            </Button>
          </Box>
        </Paper>
        
        {result && result.success && (
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              명함 분석 결과
            </Typography>
            
            <Grid container spacing={3}>
              {/* 기본 정보 카드 */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary" gutterBottom>
                      기본 정보
                    </Typography>
                    <List>
                      {result.name && (
                        <ListItem>
                          <ListItemIcon>
                            <PersonIcon />
                          </ListItemIcon>
                          <ListItemText 
                            primary="이름"
                            secondary={result.name}
                          />
                        </ListItem>
                      )}
                      {result.position && (
                        <ListItem>
                          <ListItemIcon>
                            <WorkIcon />
                          </ListItemIcon>
                          <ListItemText 
                            primary="직위"
                            secondary={result.position}
                          />
                        </ListItem>
                      )}
                      {result.company && (
                        <ListItem>
                          <ListItemIcon>
                            <BusinessIcon />
                          </ListItemIcon>
                          <ListItemText 
                            primary="회사"
                            secondary={result.company}
                          />
                        </ListItem>
                      )}
                      {result.address && (
                        <ListItem>
                          <ListItemIcon>
                            <LocationOnIcon />
                          </ListItemIcon>
                          <ListItemText 
                            primary="주소"
                            secondary={result.address}
                          />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* 연락처 정보 카드 */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary" gutterBottom>
                      연락처 정보
                    </Typography>
                    <List>
                      {result.phone?.mobile && result.phone.mobile.length > 0 && (
                        <ListItem>
                          <ListItemIcon>
                            <PhoneIphoneIcon />
                          </ListItemIcon>
                          <ListItemText 
                            primary="휴대전화"
                            secondary={result.phone.mobile.join(', ')}
                          />
                        </ListItem>
                      )}
                      {result.phone?.phone && result.phone.phone.length > 0 && (
                        <ListItem>
                          <ListItemIcon>
                            <PhoneIcon />
                          </ListItemIcon>
                          <ListItemText 
                            primary="전화번호"
                            secondary={result.phone.phone.join(', ')}
                          />
                        </ListItem>
                      )}
                      {result.phone?.fax && result.phone.fax.length > 0 && (
                        <ListItem>
                          <ListItemIcon>
                            <FaxIcon />
                          </ListItemIcon>
                          <ListItemText 
                            primary="팩스"
                            secondary={result.phone.fax.join(', ')}
                          />
                        </ListItem>
                      )}
                      {result.email && result.email.length > 0 && (
                        <ListItem>
                          <ListItemIcon>
                            <EmailIcon />
                          </ListItemIcon>
                          <ListItemText 
                            primary="이메일"
                            secondary={
                              <Box>
                                {result.email.map((email, index) => (
                                  <Box key={index}>
                                    <MuiLink href={`mailto:${email}`}>{email}</MuiLink>
                                  </Box>
                                ))}
                              </Box>
                            }
                          />
                        </ListItem>
                      )}
                      {result.website && result.website.length > 0 && (
                        <ListItem>
                          <ListItemIcon>
                            <LanguageIcon />
                          </ListItemIcon>
                          <ListItemText 
                            primary="웹사이트"
                            secondary={
                              <Box>
                                {result.website.map((url, index) => (
                                  <Box key={index}>
                                    <MuiLink href={url.startsWith('http') ? url : `http://${url}`} target="_blank" rel="noopener">
                                      {url}
                                    </MuiLink>
                                  </Box>
                                ))}
                              </Box>
                            }
                          />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            {result.full_text && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1">
                    추출된 전체 텍스트
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyText}
                    color={copySuccess ? "success" : "primary"}
                  >
                    {copySuccess ? "복사됨" : "텍스트 복사"}
                  </Button>
                </Box>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    color: 'text.primary',
                    maxHeight: '200px', 
                    overflow: 'auto',
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'inherit', 
                    margin: 0,
                    color: 'inherit'
                  }}>
                    {result.full_text}
                  </pre>
                </Paper>
              </Box>
            )}
          </Paper>
        )}
        
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      </Container>
    </Layout>
  );
};

export default BusinessCardPage; 