import React from 'react';
import {
  Box,
  CircularProgress,
  Paper,
  Typography,
  LinearProgress,
  Button,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface BatchUploadProgressProps {
  isUploading: boolean;
  progress: number;
  fileCount: number;
  onCancel: () => void;
  isDark?: boolean;
}

/**
 * 일괄 업로드 진행 상태 표시 컴포넌트
 */
const BatchUploadProgress: React.FC<BatchUploadProgressProps> = ({
  isUploading,
  progress,
  fileCount,
  onCancel,
  isDark = false
}) => {
  if (!isUploading) return null;

  const isComplete = progress >= 100;
  
  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1300,
        width: { xs: 'calc(100% - 32px)', sm: 360 },
        p: 2,
        borderRadius: 2,
        bgcolor: isDark ? 'rgba(25, 25, 25, 0.95)' : 'background.paper',
        color: isDark ? 'text.primary' : 'inherit',
        boxShadow: isDark 
          ? '0 4px 20px rgba(0, 0, 0, 0.5)' 
          : '0 4px 20px rgba(0, 0, 0, 0.15)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
        transition: 'all 0.3s ease-in-out'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography 
          variant="subtitle1" 
          sx={{ 
            fontWeight: 'medium',
            color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'inherit'
          }}
        >
          {isComplete ? '업로드 완료' : '파일 처리 중...'}
        </Typography>
        <IconButton 
          size="small" 
          onClick={onCancel} 
          disabled={isComplete}
          sx={{
            color: isDark 
              ? isComplete 
                ? 'rgba(255, 255, 255, 0.3)' 
                : 'rgba(255, 255, 255, 0.7)'
              : undefined
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      
      <Typography 
        variant="body2" 
        color={isDark ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'} 
        sx={{ mb: 1 }}
      >
        {isComplete 
          ? `${fileCount}개 파일이 처리되었습니다.` 
          : `${fileCount}개 파일 처리 중 (${progress}%)`}
      </Typography>
      
      <Box sx={{ position: 'relative', pt: 0.5 }}>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            height: 6, 
            borderRadius: 3,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'grey.100',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              backgroundColor: isComplete 
                ? (isDark ? 'rgba(76, 175, 80, 0.9)' : 'success.main')
                : (isDark ? 'rgba(144, 202, 249, 0.9)' : 'primary.main'),
            },
          }} 
        />
        {!isComplete && (
          <Box
            sx={{
              position: 'absolute',
              left: `calc(${progress}% - 12px)`,
              top: -6,
              transition: 'left 0.3s ease',
            }}
          >
            <CircularProgress 
              size={20} 
              thickness={6} 
              sx={{
                color: isDark ? '#90caf9' : 'primary.main'
              }}
            />
          </Box>
        )}
      </Box>
      
      {isComplete && (
        <Box sx={{ mt: 2, textAlign: 'right' }}>
          <Button 
            size="small" 
            onClick={onCancel} 
            variant="text"
            sx={{
              color: isDark ? 'rgba(144, 202, 249, 0.9)' : undefined,
              '&:hover': {
                bgcolor: isDark ? 'rgba(144, 202, 249, 0.08)' : undefined
              }
            }}
          >
            닫기
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default BatchUploadProgress; 