import React, { useState, useCallback } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Alert, 
  Snackbar,
  useTheme
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ReceiptUploader from '../components/ReceiptUploader';
import ReceiptResults from '../components/ReceiptResults';
import { analyzeReceipt } from '../services/receiptService';
import { ReceiptAnalysisResult } from '../types/receipt';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useTheme as useAppTheme } from '../contexts/ThemeContext';
import { useToast } from '../hooks/useToast';

const ReceiptAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme: appTheme, toggleTheme } = useAppTheme();
  const isDark = appTheme === 'dark';
  const muiTheme = useTheme();
  const { showErrorToast } = useToast();

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ReceiptAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  const handleUpload = async (file: File, ocrModel: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const analysisResult = await analyzeReceipt(file, ocrModel);
      setResult(analysisResult);
      
      if (!analysisResult.success) {
        setError(analysisResult.error || '영수증 분석에 실패했습니다.');
        setSnackbarOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '영수증 분석 중 오류가 발생했습니다');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('로그아웃 중 오류 발생:', error);
      showErrorToast('로그아웃 중 오류가 발생했습니다');
    }
  }, [signOut, navigate, showErrorToast]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: isDark ? 'grey.900' : 'grey.100' }}>
      <Header
        user={user || undefined}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleDarkMode={toggleTheme}
        showLogout={true}
      />
      <Container maxWidth="lg" sx={{ py: 4, flexGrow: 1 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: isDark ? 'white' : 'inherit' }}>
            영수증 분석
          </Typography>
          <Typography variant="body1" sx={{ color: isDark ? 'grey.300' : 'text.secondary' }}>
            영수증 이미지를 업로드하면 OCR 기술을 사용하여 내용을 추출합니다.
            날짜, 시간, 금액, 상점 정보, 구매 품목 등의 정보를 분석합니다.
          </Typography>
        </Box>
        
        <Paper elevation={isDark ? 5 : 1} sx={{ p: 3, mb: 4, bgcolor: isDark ? 'grey.800' : 'background.paper' }}>
          <ReceiptUploader onUpload={handleUpload} isLoading={loading} />
        </Paper>
        
        {result && (
          <Paper elevation={isDark ? 5 : 3} sx={{ p: 3, bgcolor: isDark ? 'grey.800' : 'background.paper' }}>
            <ReceiptResults result={result} />
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
    </Box>
  );
};

export default ReceiptAnalysisPage; 