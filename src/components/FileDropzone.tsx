import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface FileDropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  maxFiles?: number;
  acceptedFileTypes?: string[];
  children?: React.ReactNode;
  disabled?: boolean;
  isProcessing?: boolean;
  isDark?: boolean;
}

/**
 * 드래그 앤 드롭으로 파일 업로드를 지원하는 컴포넌트
 */
const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesAccepted,
  maxFiles = 1,
  acceptedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'],
  children,
  disabled = false,
  isProcessing = false,
  isDark = false
}) => {
  const [isDragActive, setIsDragActive] = useState(false);

  // 드래그 시작 핸들러
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isProcessing) return;
    setIsDragActive(true);
  }, [disabled, isProcessing]);

  // 드래그 진행 중 핸들러
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isProcessing) return;
    setIsDragActive(true);
  }, [disabled, isProcessing]);

  // 드래그 종료 핸들러
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  // 파일 드롭 핸들러
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (disabled || isProcessing) return;
    
    // 드롭된 파일 목록 가져오기
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    // 최대 파일 수 제한
    const files = droppedFiles.slice(0, maxFiles);
    
    // 파일 타입 필터링
    const validFiles = files.filter(file => {
      return acceptedFileTypes.some(type => {
        if (type.includes('*')) {
          const baseType = type.split('/')[0];
          return file.type.startsWith(baseType);
        }
        return file.type === type;
      });
    });
    
    if (validFiles.length > 0) {
      onFilesAccepted(validFiles);
    }
  }, [disabled, isProcessing, maxFiles, acceptedFileTypes, onFilesAccepted]);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || isProcessing || !e.target.files) return;
    
    const files = Array.from(e.target.files).slice(0, maxFiles);
    
    if (files.length > 0) {
      onFilesAccepted(files);
    }
    
    // 파일 입력 필드 초기화 (동일 파일 재선택 가능하도록)
    e.target.value = '';
  }, [disabled, isProcessing, maxFiles, onFilesAccepted]);

  // 키보드 이벤트 핸들러 등록/해제
  useEffect(() => {
    const preventDefaults = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    // 드래그 관련 이벤트 리스너 등록
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    return () => {
      // 컴포넌트 언마운트 시 이벤트 리스너 제거
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.removeEventListener(eventName, preventDefaults, false);
      });
    };
  }, []);

  // 허용되는 파일 타입에 대한 accept 문자열 생성
  const acceptString = acceptedFileTypes.join(',');

  // 활성화된 드래그 상태 색상
  const dragActiveBgColor = isDark 
    ? 'rgba(25, 118, 210, 0.15)' 
    : 'rgba(25, 118, 210, 0.04)';
  
  // 비활성화된 색상
  const disabledColor = isDark 
    ? 'rgba(255, 255, 255, 0.2)' 
    : 'action.disabled';
  
  // 드래그 영역 테두리 색상
  const borderColor = isDragActive 
    ? 'primary.main' 
    : disabled 
      ? disabledColor 
      : isDark 
        ? 'rgba(255, 255, 255, 0.23)' 
        : 'divider';

  return (
    <Paper
      sx={{
        position: 'relative',
        height: '100%',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: borderColor,
        borderRadius: 1,
        bgcolor: isDragActive 
          ? dragActiveBgColor 
          : isDark 
            ? 'rgba(18, 18, 18, 0.8)' 
            : 'background.paper',
        color: isDark ? 'text.primary' : 'inherit',
        cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease-in-out',
        opacity: disabled || isProcessing ? 0.6 : 1,
        overflow: 'hidden'
      }}
      elevation={0}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 커스텀 자식 컴포넌트가 있는 경우 */}
      {children ? (
        children
      ) : (
        // 기본 드롭존 UI
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            p: 3,
            textAlign: 'center'
          }}
        >
          <CloudUploadIcon 
            sx={{ 
              fontSize: 48, 
              color: isDragActive 
                ? 'primary.main' 
                : isDark 
                  ? 'rgba(255, 255, 255, 0.5)' 
                  : 'text.secondary',
              mb: 2
            }} 
          />
          
          <Typography 
            variant="body1" 
            gutterBottom
            sx={{
              color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'inherit'
            }}
          >
            {isDragActive
              ? '여기에 파일을 놓으세요'
              : `클릭하거나 파일을 여기로 끌어오세요 (최대 ${maxFiles}개)`}
          </Typography>
          
          <Typography 
            variant="caption" 
            color={isDark ? 'rgba(255, 255, 255, 0.6)' : 'text.secondary'}
          >
            {acceptedFileTypes.includes('image/*') 
              ? '모든 이미지 파일 지원'
              : `지원 형식: ${acceptedFileTypes.join(', ')}`}
          </Typography>
        </Box>
      )}
      
      {/* 파일 입력 필드 (숨김) */}
      <input
        type="file"
        accept={acceptString}
        onChange={handleFileSelect}
        multiple={maxFiles > 1}
        disabled={disabled || isProcessing}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: disabled || isProcessing ? 'not-allowed' : 'pointer'
        }}
      />
    </Paper>
  );
};

export default FileDropzone; 