import React, { useState } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  TextField, 
  Button, 
  Alert, 
  Snackbar, 
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  SelectChangeEvent,
  Tab,
  Tabs
} from '@mui/material';
import Layout from '../components/Layout';
import TranslateIcon from '@mui/icons-material/Translate';
import LanguageIcon from '@mui/icons-material/Language';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const LANGUAGES = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: '영어' },
  { code: 'ja', name: '일본어' },
  { code: 'zh-CN', name: '중국어 (간체)' },
  { code: 'zh-TW', name: '중국어 (번체)' },
  { code: 'vi', name: '베트남어' },
  { code: 'th', name: '태국어' },
  { code: 'id', name: '인도네시아어' },
  { code: 'fr', name: '프랑스어' },
  { code: 'de', name: '독일어' },
  { code: 'es', name: '스페인어' },
  { code: 'ru', name: '러시아어' },
  { code: 'it', name: '이탈리아어' },
  { code: 'ar', name: '아랍어' }
];

const TranslationPage: React.FC = () => {
  const [tabValue, setTabValue] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [detectedLanguageName, setDetectedLanguageName] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [sourceLanguage, setSourceLanguage] = useState<string>('');

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    // 탭 변경 시 결과 초기화
    if (newValue === 0) {
      setDetectedLanguage('');
      setDetectedLanguageName('');
    } else {
      setTranslatedText('');
      setSourceLanguage('');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
  };

  const handleTargetLanguageChange = (event: SelectChangeEvent) => {
    setTargetLanguage(event.target.value);
  };

  const handleDetectLanguage = async () => {
    if (!inputText.trim()) {
      setError('언어를 감지할 텍스트를 입력해주세요.');
      setSnackbarOpen(true);
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/detect-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '언어 감지 중 오류가 발생했습니다');
      }

      setDetectedLanguage(data.data.language);
      setDetectedLanguageName(data.data.language_name || '');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '언어 감지 중 오류가 발생했습니다');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      setError('번역할 텍스트를 입력해주세요.');
      setSnackbarOpen(true);
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          target_lang: targetLanguage
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '번역 중 오류가 발생했습니다');
      }

      if (data.data?.translated_text) {
        setTranslatedText(data.data.translated_text);
        
        // 감지된 소스 언어가 응답에 포함되어 있으면 설정
        if (data.data.source_language) {
          setSourceLanguage(data.data.source_language);
        }
      } else {
        setTranslatedText('');
        throw new Error('번역된 텍스트를 찾을 수 없습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '번역 중 오류가 발생했습니다');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            언어 감지 및 번역
          </Typography>
          <Typography variant="body1" color="text.secondary">
            텍스트의 언어를 감지하고 다양한 언어로 번역할 수 있는 기능입니다.
          </Typography>
        </Box>
        
        <Paper elevation={3} sx={{ mb: 4 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              aria-label="translation tabs"
              centered
            >
              <Tab 
                label="언어 감지" 
                icon={<LanguageIcon />} 
                iconPosition="start"
              />
              <Tab 
                label="텍스트 번역" 
                icon={<TranslateIcon />} 
                iconPosition="start"
              />
            </Tabs>
          </Box>
          
          <TabPanel value={tabValue} index={0}>
            <TextField
              label="언어를 감지할 텍스트"
              multiline
              rows={5}
              value={inputText}
              onChange={handleInputChange}
              fullWidth
              variant="outlined"
              placeholder="여기에 언어를 감지할 텍스트를 입력하세요..."
              sx={{ mb: 3 }}
            />
            
            <Box sx={{ mb: 3, textAlign: 'right' }}>
              <Button 
                variant="contained" 
                onClick={handleDetectLanguage}
                disabled={loading || !inputText.trim()}
                startIcon={loading ? <CircularProgress size={20} /> : <LanguageIcon />}
              >
                {loading ? '감지 중...' : '언어 감지하기'}
              </Button>
            </Box>
            
            {detectedLanguage && (
              <Box sx={{ mt: 3, p: 3, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <LanguageIcon sx={{ mr: 1 }} /> 언어 감지 결과
                </Typography>
                
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1" sx={{ mr: 1, fontWeight: 'medium' }}>
                      감지된 언어:
                    </Typography>
                    <Chip 
                      label={detectedLanguageName || LANGUAGES.find(lang => lang.code === detectedLanguage)?.name || detectedLanguage} 
                      color="primary" 
                      icon={<LanguageIcon />}
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1" sx={{ mr: 1, fontWeight: 'medium' }}>
                      언어 코드:
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {detectedLanguage}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      감지된 언어로 번역하시려면 번역 탭으로 이동하세요.
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small"
                      sx={{ mt: 1 }}
                      onClick={() => setTabValue(1)}
                    >
                      번역 탭으로 이동
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="번역할 텍스트"
                  multiline
                  rows={5}
                  value={inputText}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  placeholder="여기에 번역할 텍스트를 입력하세요..."
                />
                
                {sourceLanguage && (
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                      감지된 언어:
                    </Typography>
                    <Chip
                      size="small"
                      label={LANGUAGES.find(lang => lang.code === sourceLanguage)?.name || sourceLanguage}
                      color="primary"
                      variant="outlined"
                      icon={<LanguageIcon fontSize="small" />}
                    />
                  </Box>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="번역 결과"
                  multiline
                  rows={5}
                  value={translatedText}
                  fullWidth
                  variant="outlined"
                  InputProps={{
                    readOnly: true,
                  }}
                />
                
                {targetLanguage && (
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                      번역 언어:
                    </Typography>
                    <Chip
                      size="small"
                      label={LANGUAGES.find(lang => lang.code === targetLanguage)?.name || targetLanguage}
                      color="secondary"
                      variant="outlined"
                      icon={<TranslateIcon fontSize="small" />}
                    />
                  </Box>
                )}
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                  <FormControl sx={{ width: 200 }}>
                    <InputLabel id="target-language-label">번역할 언어</InputLabel>
                    <Select
                      labelId="target-language-label"
                      id="target-language-select"
                      value={targetLanguage}
                      label="번역할 언어"
                      onChange={handleTargetLanguageChange}
                    >
                      {LANGUAGES.map((lang) => (
                        <MenuItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <Button 
                    variant="contained" 
                    onClick={handleTranslate}
                    disabled={loading || !inputText.trim()}
                    startIcon={loading ? <CircularProgress size={20} /> : <TranslateIcon />}
                  >
                    {loading ? '번역 중...' : '번역하기'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </TabPanel>
        </Paper>
        
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

export default TranslationPage; 