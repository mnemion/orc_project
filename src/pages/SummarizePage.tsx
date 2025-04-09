import React, { useState } from 'react';
import { 
  Container, 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  SelectChangeEvent,
  Slider,
  CircularProgress
} from '@mui/material';
import Layout from '../components/Layout';
import SummarizeIcon from '@mui/icons-material/Summarize';
import SettingsIcon from '@mui/icons-material/Settings';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { summarizeText } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';

const SummarizePage: React.FC = () => {
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { showToast } = useToast();
  const [summaryLength, setSummaryLength] = useState<number>(300);
  const [showSettings, setShowSettings] = useState(false);
  const [summaryStyle, setSummaryStyle] = useState('concise');

  // 텍스트 요약 처리
  const handleSummarize = async () => {
    if (!text.trim()) {
      showToast('요약할 텍스트를 입력해주세요.', 'warning');
      return;
    }

    setIsProcessing(true);
    setSummary('');

    try {
      const response = await summarizeText(text, summaryLength, summaryStyle);
      
      if (response && response.success && response.data) {
        setSummary(response.data.summary);
        showToast('요약이 완료되었습니다.', 'success');
      } else {
        showToast(response?.error || '요약 처리 중 오류가 발생했습니다.', 'error');
      }
    } catch (error) {
      console.error('요약 처리 중 오류:', error);
      showToast('요약을 처리하는 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStyleChange = (event: SelectChangeEvent) => {
    setSummaryStyle(event.target.value as string);
  };

  const handleLengthChange = (event: Event, newValue: number | number[]) => {
    setSummaryLength(newValue as number);
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            텍스트 요약
          </Typography>
          <Typography variant="body1" color="text.secondary">
            긴 텍스트를 AI를 통해 간결하게 요약해 드립니다. 문서, 기사, 보고서 등 다양한 텍스트를 빠르게 이해할 수 있도록 핵심만 추출합니다.
          </Typography>
        </Box>

        {/* 요약 설정 */}
        <Button 
          startIcon={<SettingsIcon />} 
          variant="outlined" 
          onClick={() => setShowSettings(!showSettings)}
          sx={{ mb: 2 }}
        >
          요약 설정
        </Button>

        {showSettings && (
          <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              요약 설정
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="summary-style-label">요약 스타일</InputLabel>
                <Select
                  labelId="summary-style-label"
                  id="summary-style"
                  value={summaryStyle}
                  label="요약 스타일"
                  onChange={handleStyleChange}
                >
                  <MenuItem value="concise">간결하게</MenuItem>
                  <MenuItem value="detailed">자세하게</MenuItem>
                  <MenuItem value="bullet">요점만</MenuItem>
                  <MenuItem value="academic">학술적으로</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ mb: 1 }}>
              <Typography id="summary-length-slider" gutterBottom>
                요약 길이 (최대 글자 수): {summaryLength}
              </Typography>
              <Slider
                value={summaryLength}
                onChange={handleLengthChange}
                aria-labelledby="summary-length-slider"
                valueLabelDisplay="auto"
                step={50}
                marks
                min={100}
                max={500}
              />
            </Box>
          </Paper>
        )}

        <Paper 
          elevation={isDark ? 3 : 1} 
          sx={{ 
            p: 3, 
            mb: 4,
            bgcolor: isDark ? 'rgb(31, 41, 55)' : 'background.paper'
          }}
        >
          <Typography variant="subtitle1" gutterBottom>
            요약할 텍스트
          </Typography>
          <TextField
            multiline
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="요약할 텍스트를 입력하세요..."
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
            inputProps={{
              maxLength: 30000,
              style: { 
                whiteSpace: 'pre-wrap', 
                overflowWrap: 'break-word' 
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {text.length} 자 입력됨
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSummarize}
              disabled={isProcessing || !text.trim()}
              startIcon={isProcessing ? <CircularProgress size={20} /> : <SummarizeIcon />}
            >
              {isProcessing ? '요약 중...' : '요약하기'}
            </Button>
          </Box>
        </Paper>

        {summary && (
          <Paper 
            elevation={isDark ? 3 : 1} 
            sx={{ 
              p: 3,
              bgcolor: isDark ? 'rgb(31, 41, 55)' : 'background.paper'
            }}
          >
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <FormatQuoteIcon sx={{ mr: 1 }} />
              요약 결과
            </Typography>
            <Box 
              sx={{ 
                p: 2, 
                borderLeft: 3, 
                borderColor: 'primary.main',
                bgcolor: isDark ? 'rgba(17, 24, 39, 0.3)' : 'rgba(232, 243, 255, 0.4)',
                borderRadius: 1
              }}
            >
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                {summary}
              </Typography>
            </Box>
          </Paper>
        )}
      </Container>
    </Layout>
  );
};

export default SummarizePage; 