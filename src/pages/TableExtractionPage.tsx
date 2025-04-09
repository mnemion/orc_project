import React, { useState } from 'react';
import { 
  Container, 
  Typography, 
  Box,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import TableExtractor from '../components/TableExtractor';

interface TableData {
  [key: string]: string;
}

const TableExtractionPage: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { showToast } = useToast();
  
  // 파일 선택 처리
  const handleFileSelect = (file: File) => {
    if (file) {
      // 이미지 미리보기 URL 생성
      const fileUrl = URL.createObjectURL(file);
      setPreviewUrl(fileUrl);
      setIsSuccess(false);
    }
  };
  
  // 컴포넌트 언마운트 시 파일 URL 정리
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            테이블 추출
          </Typography>
          <Typography variant="body1" color="text.secondary">
            이미지 속 표(테이블)를 인식하여 데이터로 변환해 주는 기능입니다.
            스프레드시트, 엑셀 등으로 내보내기가 가능합니다.
          </Typography>
        </Box>
        
        <Paper 
          elevation={isDark ? 3 : 1} 
          sx={{ 
            p: 3, 
            mb: 4,
            bgcolor: isDark ? 'rgb(31, 41, 55)' : 'background.paper'
          }}
        >
          <TableExtractor 
            onFileSelect={handleFileSelect}
            onProcessingStart={() => {
              setIsProcessing(true);
              setIsSuccess(false);
            }} 
            onProcessingComplete={(data: TableData[]) => {
              setIsProcessing(false);
              setIsSuccess(true);
              showToast('테이블이 성공적으로 추출되었습니다.', 'success');
            }}
            onError={(message: string) => {
              setIsProcessing(false);
              setIsSuccess(false);
              showToast(message, 'error');
            }}
          />
        </Paper>
        
        {isProcessing && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>테이블 추출 중...</Typography>
          </Box>
        )}

        {isSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            테이블 추출이 완료되었습니다. 위의 다운로드 버튼을 클릭하여 파일을 저장하세요.
          </Alert>
        )}
      </Container>
    </Layout>
  );
};

export default TableExtractionPage;