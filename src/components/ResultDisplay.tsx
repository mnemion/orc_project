import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Tooltip
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import NavigateBefore from '@mui/icons-material/NavigateBefore';
import NavigateNext from '@mui/icons-material/NavigateNext';

interface ResultDisplayProps {
  originalImage: string | null;
  extractedText: string;
  regions?: Array<[number, number, number, number]>;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  ocrModel?: string;
  onEditClick?: () => void;
  onSave: (text: string) => void;
  showBackButton?: boolean;
  onBackClick?: () => void;
  onNextClick?: () => void;
  onPrevClick?: () => void;
  batchInfo?: {
    current: number;
    total: number;
  };
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({
  originalImage,
  extractedText,
  regions = [],
  isLoading = false,
  error = null,
  className,
  ocrModel = 'tesseract',
  onEditClick,
  onSave,
  showBackButton = false,
  onBackClick,
  onNextClick,
  onPrevClick,
  batchInfo
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const previousImageRef = useRef<string | null>(null);

  useEffect(() => {
    if (originalImage !== previousImageRef.current) {
      setImageLoaded(false);
      setImageError(false);
      if (imageRef.current && !originalImage) {
          imageRef.current.src = '';
      }
    }
    previousImageRef.current = originalImage;
  }, [originalImage]);

  useEffect(() => {
      const currentUrl = previousImageRef.current;
      return () => {
          if (currentUrl && currentUrl.startsWith('blob:')) {
              try {
                  URL.revokeObjectURL(currentUrl);
              } catch (e) {
                  console.warn('Blob URL 해제 오류 (언마운트):', e);
              }
          }
      };
  }, []);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setImageLoaded(false);
    setImageError(true);
  };

  const handleCopyText = () => {
    if (extractedText) {
      navigator.clipboard.writeText(extractedText).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        (err) => {
          console.error('텍스트 복사 오류:', err);
        }
      );
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{
          p: 3, bgcolor: isDark ? 'rgba(220, 38, 38, 0.1)' : 'rgba(254, 226, 226, 0.5)',
          color: isDark ? 'rgb(248, 113, 113)' : 'rgb(220, 38, 38)',
          borderRadius: 1, borderLeft: '4px solid',
          borderColor: isDark ? 'rgb(248, 113, 113)' : 'rgb(220, 38, 38)' }}>
        <Typography variant="subtitle1" fontWeight="bold">오류 발생</Typography>
        <Typography variant="body2">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box
        id="result-display"
        sx={{
            mt: 4,
            p: 3,
            borderRadius: 1,
            boxShadow: 1,
            bgcolor: isDark ? 'rgb(31, 41, 55)' : 'background.paper',
            transition: 'box-shadow 0.3s ease-in-out',
        }}
    >
      <Typography variant="h5" component="h2" gutterBottom>
        추출 결과
      </Typography>

      {batchInfo && batchInfo.total > 1 && (
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2,
          p: 1, backgroundColor: isDark ? 'rgba(31, 41, 55, 0.5)' : 'rgba(243, 244, 246, 0.7)', borderRadius: 1
        }}>
            <Typography variant="body2" sx={{ color: isDark ? 'rgb(209, 213, 219)' : 'rgb(55, 65, 81)' }}>
                 일괄 처리: <strong>{batchInfo.current + 1}</strong> / {batchInfo.total}
            </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
             <Button size="small" variant="outlined" onClick={onPrevClick} disabled={batchInfo.current === 0} sx={{ minWidth: '36px', px: 1 }}><NavigateBefore /></Button>
             <Button size="small" variant="outlined" onClick={onNextClick} disabled={batchInfo.current === batchInfo.total - 1} sx={{ minWidth: '36px', px: 1 }}><NavigateNext /></Button>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mb: 2 }}>
        <Box sx={{
            width: { xs: '100%', md: '40%' },
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-start',
            overflow: 'hidden', position: 'relative'
        }}>
            <Typography variant="subtitle2" sx={{ mb: 1, width: '100%' }}>원본 이미지</Typography>
            <Box sx={{
                width: '100%',
                minHeight: '200px', maxHeight: '450px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px dashed',
                borderColor: imageError ? (isDark ? '#f87171' : '#ef4444') : (isDark ? '#4b5563' : '#d1d5db'),
                borderRadius: 1, overflow: 'hidden', position: 'relative',
                bgcolor: isDark ? '#1f2937' : '#f9fafb',
            }}>
              {!imageLoaded && !imageError && originalImage && (
                 <CircularProgress size={40} sx={{ position: 'absolute', zIndex: 1 }} />
               )}

              {imageError && (
                 <Box sx={{ textAlign: 'center', p: 3, color: isDark ? '#fca5a5' : '#b91c1c' }}>
                   <ErrorOutlineIcon sx={{ fontSize: 40, mb: 1 }}/>
                   <Typography variant="body1" fontWeight="medium">이미지를 불러올 수 없습니다.</Typography>
                   <Typography variant="caption" display="block" sx={{ mt: 1 }}>편집 모드에서 텍스트만 편집 가능합니다.</Typography>
                 </Box>
               )}

               <img
                 ref={imageRef}
                 src={originalImage || ''}
                 alt={imageLoaded && !imageError ? "원본 문서" : ""}
                 onLoad={handleImageLoad}
                 onError={handleImageError}
                 crossOrigin="anonymous"
                 style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain',
                    visibility: imageLoaded && !imageError ? 'visible' : 'hidden',
                     opacity: imageLoaded && !imageError ? 1 : 0,
                     transition: 'opacity 0.3s ease-in-out',
                     zIndex: 0
                }}
              />
                {!originalImage && !isLoading && !error && (
                     <Box sx={{ textAlign: 'center', p: 3 }}>
                        <Typography color="text.secondary">이미지 미리보기가 없습니다.</Typography>
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>텍스트 편집은 가능합니다.</Typography>
                     </Box>
                 )}
             </Box>
         </Box>

        <Box sx={{ width: { xs: '100%', md: '60%' }, flexGrow: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>추출된 텍스트</Typography>
          <Card
            variant="outlined"
            sx={{
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                mb: 3, height: '450px',
                display: 'flex', flexDirection: 'column'
            }}
          >
             <CardContent sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {extractedText ? (
                     <Typography
                         component="pre"
                         sx={{
                             fontFamily: '"Source Code Pro", "Noto Sans KR", monospace',
                             whiteSpace: 'pre-wrap',
                             wordBreak: 'break-word',
                             fontSize: '0.875rem',
                             lineHeight: 1.7,
                            color: isDark ? '#d1d5db' : '#374151',
                         }}
                     >
                       {extractedText}
                     </Typography>
                ) : (
                  <Typography color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 4 }}>
                    추출된 텍스트가 없습니다.
                  </Typography>
                )}
             </CardContent>
           </Card>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <Box>
                 {showBackButton && onBackClick && (
                     <Button variant="outlined" onClick={onBackClick} sx={{ mr: 2 }}>돌아가기</Button>
                 )}
                 {onSave && (
                     <Button variant="contained" onClick={() => onSave(extractedText)} startIcon={<SaveIcon />}>저장</Button>
                 )}
                {onEditClick && (
                    <Button variant="outlined" onClick={onEditClick} startIcon={<EditIcon />} sx={{ ml: 2 }}>편집</Button>
                 )}
             </Box>
             <Tooltip title={copied ? '복사 완료!' : '추출된 텍스트 복사'}>
                 <Button
                    variant="outlined"
                    onClick={handleCopyText}
                    startIcon={<ContentCopyIcon />}
                    color={copied ? "success" : "primary"}
                 >
                    {copied ? '복사됨' : '복사'}
                </Button>
             </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ResultDisplay;