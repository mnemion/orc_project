import React, { useState, useRef, useCallback } from 'react';
import { 
  Box, 
  Button, 
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  SelectChangeEvent
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TableChartIcon from '@mui/icons-material/TableChart';
import DownloadIcon from '@mui/icons-material/Download';
import { useTheme } from '../contexts/ThemeContext';

export interface TableExtractorProps {
  onFileSelect: (file: File) => void;
  onProcessingStart: () => void;
  onProcessingComplete: (data: Array<{ [key: string]: string }>) => void;
  onError: (message: string) => void;
}

const TableExtractor: React.FC<TableExtractorProps> = ({
  onFileSelect,
  onProcessingStart,
  onProcessingComplete,
  onError
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<string>('csv');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // 파일 선택 처리
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      
      // 파일 형식 검증
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!validTypes.includes(selectedFile.type)) {
        onError('지원되는 파일 형식이 아닙니다. 이미지(JPG, PNG) 또는 PDF 파일만 업로드 가능합니다.');
        return;
      }
      
      setFile(selectedFile);
      onFileSelect(selectedFile);
      
      // 이미지 미리보기 URL 생성 (PDF가 아닌 경우만)
      if (selectedFile.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(selectedFile);
        setPreviewUrl(previewUrl);
      } else {
        setPreviewUrl(null);
      }

      // 이전 다운로드 정보 초기화
      setDownloadUrl(null);
      setDownloadFilename('');
    }
  }, [onFileSelect, onError]);

  // 파일 업로드와 테이블 추출 시작
  const handleExtractTable = useCallback(async () => {
    if (!file) {
      onError('표가 포함된 이미지 또는 PDF를 먼저 업로드해주세요.');
      return;
    }

    setIsUploading(true);
    onProcessingStart();
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', outputFormat);
      
      // 실제 API 호출
      const response = await fetch('/api/extract-table', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        // 서버에서 오류 응답이 온 경우
        const errorData = await response.json();
        throw new Error(errorData.error || '표 추출 중 오류가 발생했습니다.');
      }

      // 대체 정보인지 확인 (헤더 체크)
      const isFallback = response.headers.get('X-Is-Fallback') === 'true';
      
      if (isFallback) {
        // 대체 정보 파일이 제공된 경우
        onError("표 추출 중 문제가 발생했습니다. 다운로드된 파일에서 안내 사항을 확인하세요.");
      }
      
      // 파일 다운로드 처리
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'table_data';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1]);
        } else {
          const filenameMatch2 = contentDisposition.match(/filename="?([^";]+)"?/i);
          if (filenameMatch2 && filenameMatch2[1]) {
            filename = filenameMatch2[1];
          }
        }
      }
      
      // 확장자 추가
      if (!filename.includes('.')) {
        filename += outputFormat === 'csv' ? '.csv' : '.xlsx';
      }
      
      // Blob 생성 및 다운로드 URL 설정
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      setDownloadUrl(downloadUrl);
      setDownloadFilename(filename);
      
      // 빈 배열로 완료 콜백 호출 (실제 데이터는 파일로 다운로드되므로)
      onProcessingComplete([]);
      
    } catch (error) {
      console.error('테이블 추출 중 오류:', error);
      onError(error instanceof Error ? error.message : '테이블 추출 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  }, [file, outputFormat, onProcessingStart, onProcessingComplete, onError]);

  // 다운로드 처리
  const handleDownload = useCallback(() => {
    if (downloadUrl && downloadFilename) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [downloadUrl, downloadFilename]);

  // 출력 형식 변경 핸들러
  const handleFormatChange = (event: SelectChangeEvent) => {
    setOutputFormat(event.target.value);
  };

  // 컴포넌트 언마운트 시 URL 정리
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [previewUrl, downloadUrl]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel id="output-format-label">출력 형식</InputLabel>
          <Select
            labelId="output-format-label"
            id="output-format"
            value={outputFormat}
            label="출력 형식"
            onChange={handleFormatChange}
          >
            <MenuItem value="csv">CSV</MenuItem>
            <MenuItem value="excel">Excel</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <input
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          id="table-image-input"
          type="file"
          onChange={handleFileChange}
          ref={fileInputRef}
        />
        <label htmlFor="table-image-input">
          <Button
            variant="contained"
            component="span"
            startIcon={<CloudUploadIcon />}
            sx={{ mb: 2 }}
          >
            이미지/PDF 선택
          </Button>
        </label>
        
        {previewUrl && (
          <Box 
            sx={{ 
              mt: 2, 
              mb: 3, 
              border: '1px solid', 
              borderColor: 'divider',
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
              alt="표 이미지 미리보기" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                objectFit: 'contain' 
              }} 
            />
          </Box>
        )}
        
        {!previewUrl && file && file.type === 'application/pdf' && (
          <Paper 
            elevation={0}
            sx={{ 
              mt: 2, 
              mb: 3, 
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 3,
              bgcolor: isDark ? 'rgba(31, 41, 55, 0.5)' : 'rgba(249, 250, 251, 0.5)'
            }}
          >
            <Typography variant="body1">
              PDF 파일: {file.name} ({Math.round(file.size / 1024)} KB)
            </Typography>
          </Paper>
        )}
        
        <Button 
          variant="contained" 
          color="primary"
          startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <TableChartIcon />}
          onClick={handleExtractTable}
          disabled={isUploading || !file}
          sx={{ mr: downloadUrl ? 2 : 0 }}
        >
          {isUploading ? '추출 중...' : '표 데이터 추출하기'}
        </Button>

        {downloadUrl && (
          <Button
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
          >
            {outputFormat === 'csv' ? 'CSV 다운로드' : 'Excel 다운로드'}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default TableExtractor; 