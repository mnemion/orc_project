import React, { useState, useRef, useCallback } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  LinearProgress, 
  IconButton, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  Chip,
  Paper
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import { useTheme } from '../contexts/ThemeContext';
import { uploadMultipleImages } from '../services/api';

// 파일 유형 정의
interface FileWithStatus {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress: number;
  result?: {
    id: number;
    text: string;
  };
  error?: string;
}

interface BatchUploaderProps {
  onBatchComplete?: (results: { id: number; text: string; filename: string }[]) => void;
  language?: string;
  modelName?: string;
}

const BatchUploader: React.FC<BatchUploaderProps> = ({
  onBatchComplete,
  language = 'kor',
  modelName = 'gemini-2.0-flash-exp-image-generation'
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [totalProgress, setTotalProgress] = useState(0);
  
  // 파일 유효성 검사
  const validateFile = (file: File): string | null => {
    // 파일 크기 검증 (10MB 이하)
    if (file.size > 10 * 1024 * 1024) {
      return '파일 크기는 10MB 이하여야 합니다.';
    }

    // 파일 형식 검증 (MIME 타입)
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    
    // 파일 확장자 검증 (추가)
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!validTypes.includes(file.type) || !hasValidExtension) {
      return '이미지 파일만 업로드 가능합니다. (JPG, JPEG, PNG)';
    }
    
    return null;
  };
  
  // 파일 선택 처리
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const selectedFiles = Array.from(event.target.files);
    const newFiles: FileWithStatus[] = [];
    const invalidFiles: string[] = [];
    
    selectedFiles.forEach(file => {
      const validationError = validateFile(file);
      
      if (!validationError) {
        // 동일한 파일이 이미 있는지 확인
        const isDuplicate = files.some(
          existingFile => existingFile.file.name === file.name && 
                         existingFile.file.size === file.size
        );
        
        if (!isDuplicate) {
          newFiles.push({
            file,
            status: 'pending',
            progress: 0
          });
        }
      } else {
        // 유효하지 않은 파일 추적
        invalidFiles.push(file.name);
      }
    });
    
    // 유효하지 않은 파일이 있을 경우 해당 파일을 파일 목록에 추가하여 오류 메시지 표시
    if (invalidFiles.length > 0) {
      // 유효하지 않은 파일들을 UI에 추가하여 오류 메시지 표시
      invalidFiles.forEach(fileName => {
        setFiles(prev => [
          ...prev,
          {
            file: new File([], fileName), // 빈 파일
            status: 'error',
            progress: 0,
            error: '이미지 파일만 업로드 가능합니다. (JPG, JPEG, PNG)'
          }
        ]);
      });
    }
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // 파일 입력 필드 초기화 (같은 파일을 다시 선택할 수 있도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [files]);
  
  // 파일 목록에서 제거
  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  // 모든 파일 제거
  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);
  
  // 파일 업로드 시작
  const handleUpload = useCallback(async () => {
    if (files.length === 0 || isUploading) return;
    
    setIsUploading(true);
    setTotalProgress(0);
    
    // 상태 업데이트 함수
    const updateFileStatus = (index: number, status: FileWithStatus['status'], progress: number, result?: any, error?: string) => {
      setFiles(prev => {
        const newFiles = [...prev];
        newFiles[index] = {
          ...newFiles[index],
          status,
          progress,
          ...(result && { result }),
          ...(error && { error })
        };
        return newFiles;
      });
    };
    
    // 진행 상황 콜백
    const progressCallback = (status: string, progress: number, current: number, total: number) => {
      // 현재 처리 중인 파일 상태 업데이트
      updateFileStatus(current - 1, 'processing', progress);
      
      // 전체 진행률 계산
      const overallProgress = ((current - 1) / total * 100) + (progress / total);
      setTotalProgress(overallProgress);
    };
    
    try {
      // 업로드할 파일 목록 생성 (안전한 파일명으로 변환)
      const filesToUpload = files.map(f => {
        // 파일 확장자 추출
        const fileExt = f.file.name.split('.').pop() || '';
        
        // 타임스탬프를 이용해 고유한 파일명 생성
        const timestamp = new Date().getTime();
        const randomStr = Math.random().toString(36).substring(2, 8);
        
        // 안전한 파일명 생성 (영문자, 숫자만 사용)
        const safeFileName = `image_${timestamp}_${randomStr}.${fileExt}`;
        
        // 새 파일 객체 생성 (원본 파일 내용은 유지하고 이름만 변경)
        return new File([f.file], safeFileName, { type: f.file.type });
      });
      
      // 다중 파일 업로드 API 호출
      const results = await uploadMultipleImages(
        filesToUpload,
        modelName,
        language,
        progressCallback
      );
      
      // 각 파일의 결과 업데이트
      results.forEach((result, i) => {
        // 서버 응답이 성공인 경우
        if (result.success) {
          // API 응답 구조 확인 및 데이터 추출
          let responseText = '';
          let responseId = 0;
          
          // 응답 데이터 확인 (data 내부 또는 최상위)
          if (result.data) {
            responseText = result.data.text || result.data.extracted_text || '';
            responseId = result.data.id || 0;
          }
          
          // 최상위에 데이터가 있는 경우
          if (!responseText && result.extracted_text) {
            responseText = result.extracted_text;
            
            // id가 객체인지 숫자인지 확인 후 처리
            if (typeof result.id === 'object' && result.id !== null && 'id' in result.id) {
              responseId = result.id.id;
            } else if (typeof result.id === 'number') {
              responseId = result.id;
            }
          }
          
          // 디버그 로깅
          console.log(`파일 ${i+1} 응답 데이터 구조:`, { 
            hasText: responseText.length > 0,
            resultText: responseText ? responseText.substring(0, 50) + '...' : '(없음)',
            textLength: responseText.length,
            id: responseId
          });
          
          // 텍스트가 없어도 서버 응답이 성공이면 상태를 success로 설정
          updateFileStatus(i, 'success', 100, {
            id: responseId,
            text: responseText
          });
        } else {
          // 서버 응답이 실패인 경우
          let errorMessage = result.error || '처리 중 오류가 발생했습니다.';
          
          // PDF 관련 오류 메시지 수정
          if (errorMessage === '지원되지 않는 파일 형식입니다. 이미지 또는 PDF 파일을 업로드하세요.') {
            errorMessage = '이미지 파일만 업로드 가능합니다. (JPG, JPEG, PNG)';
          }
          
          updateFileStatus(i, 'error', 0, undefined, errorMessage);
        }
      });
      
      // 파일 상태를 직접 확인하고 로그
      console.log("모든 파일의 처리 상태:", files.map(f => ({
        name: f.file.name,
        status: f.status,
        hasResult: !!f.result,
        resultId: f.result?.id || 0
      })));
      
      setTotalProgress(100);
      
      // 성공적으로 처리된 결과만 필터링하여 반환
      if (onBatchComplete) {
        // 상태가 success이고 result.id가 있는 파일만 필터링
        const successResults: { id: number; text: string; filename: string }[] = files
          .filter(file => file.status === 'success' && file.result && file.result.id > 0)
          .map(file => ({
            id: file.result?.id || 0,
            text: file.result?.text || '',
            filename: file.file.name
          }));
        
        console.log('일괄 업로드 성공 결과 (files 배열에서):', successResults);
        
        // ID가 있는 결과가 있으면 반환
        if (successResults.length > 0) {
          onBatchComplete(successResults);
        } else {
          // 마지막 시도: 직접 API 응답에서 결과 추출
          console.log('파일 상태를 다시 확인합니다.');
          
          // API 응답에서 직접 결과 추출
          const apiResults = results
            .filter(result => result.success && (
              (result.data && result.data.id > 0) || 
              (typeof result.id === 'number' && result.id > 0)
            ))
            .map(result => {
              // 텍스트 추출
              let text = '';
              let id = 0;
              
              if (result.data) {
                text = result.data.text || result.data.extracted_text || '';
                id = result.data.id || 0;
              } else if ((result as any).text || (result as any).extracted_text) {
                text = (result as any).text || (result as any).extracted_text || '';
                id = typeof result.id === 'number' ? result.id : 0;
              }
              
              // 원본 파일명 가져오기
              const index = results.indexOf(result);
              const filename = index >= 0 && index < files.length ? files[index].file.name : `file_${id}`;
              
              return { id, text, filename };
            })
            .filter(item => item.id > 0); // ID가 유효한 항목만 포함
          
          console.log('API 응답에서 직접 추출한 결과:', apiResults);
          
          if (apiResults.length > 0) {
            onBatchComplete(apiResults);
            return;
          }
          
          // 최후의 시도: 모든 파일 확인
          const updatedFiles = files.map(f => ({ 
            ...f, 
            success: f.status === 'success' || (f.result && f.result.id > 0) 
          }));
          
          // 성공으로 간주할 수 있는 모든 파일 검사
          const finalResults = updatedFiles
            .filter(f => f.success && f.result?.id)
            .map(f => ({
              id: f.result?.id || 0,
              text: f.result?.text || '',
              filename: f.file.name
            }));
          
          console.log('최종 시도 성공 결과:', finalResults);
          
          if (finalResults.length > 0) {
            onBatchComplete(finalResults);
          } else {
            // 마지막 시도: IDs만 있으면 그것도 반환
            const resultsWithIdsOnly = files
              .filter(f => f.result && f.result.id > 0)
              .map(f => ({
                id: f.result?.id || 0,
                text: f.result?.text || '',
                filename: f.file.name
              }));
            
            if (resultsWithIdsOnly.length > 0) {
              console.log('ID만 있는 결과:', resultsWithIdsOnly);
              onBatchComplete(resultsWithIdsOnly);
            } else {
              console.error('유효한 추출 결과가 없습니다. 파일 상태:', 
                files.map(f => ({ name: f.file.name, status: f.status, hasResult: !!f.result })));
            }
          }
        }
      }
    } catch (error) {
      console.error('배치 업로드 중 오류:', error);
      
      // 모든 대기 중인 파일을 오류 상태로 변경
      setFiles(prev => prev.map(file => 
        file.status === 'pending' || file.status === 'processing'
          ? { ...file, status: 'error', progress: 0, error: '업로드 중 오류가 발생했습니다.' }
          : file
      ));
    } finally {
      setIsUploading(false);
    }
  }, [files, isUploading, language, modelName, onBatchComplete]);
  
  // 파일 드래그 & 드롭 처리
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const newFiles: FileWithStatus[] = [];
      const invalidFiles: string[] = [];
      
      droppedFiles.forEach(file => {
        const validationError = validateFile(file);
        
        if (!validationError) {
          // 동일한 파일이 이미 있는지 확인
          const isDuplicate = files.some(
            existingFile => existingFile.file.name === file.name && 
                           existingFile.file.size === file.size
          );
          
          if (!isDuplicate) {
            newFiles.push({
              file,
              status: 'pending',
              progress: 0
            });
          }
        } else {
          // 유효하지 않은 파일 추적
          invalidFiles.push(file.name);
        }
      });
      
      // 유효하지 않은 파일이 있을 경우 해당 파일을 파일 목록에 추가하여 오류 메시지 표시
      if (invalidFiles.length > 0) {
        // 유효하지 않은 파일들을 UI에 추가하여 오류 메시지 표시
        invalidFiles.forEach(fileName => {
          setFiles(prev => [
            ...prev,
            {
              file: new File([], fileName), // 빈 파일
              status: 'error',
              progress: 0,
              error: '이미지 파일만 업로드 가능합니다. (JPG, JPEG, PNG)'
            }
          ]);
        });
      }
      
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, [files]);
  
  // 파일 선택 대화상자 열기
  const openFileSelector = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);
  
  // 상태에 따른 아이콘 렌더링
  const renderStatusIcon = (status: FileWithStatus['status'], progress: number) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="text-green-500" />;
      case 'error':
        return <ErrorIcon className="text-red-500" />;
      case 'processing':
        return (
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ width: 24, height: 24, borderRadius: '50%' }}
            />
            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="caption" component="div" color="text.secondary">
                {`${Math.round(progress)}%`}
              </Typography>
            </Box>
          </Box>
        );
      default:
        return <PendingIcon className={isDark ? 'text-gray-400' : 'text-gray-500'} />;
    }
  };
  
  return (
    <Paper 
      elevation={isDark ? 3 : 1} 
      sx={{ 
        p: 4, 
        bgcolor: isDark ? 'rgb(31, 41, 55)' : 'background.paper'
      }}
    >
      <Typography 
        variant="h6" 
        sx={{ 
          mb: 3, 
          color: isDark ? 'rgb(229, 231, 235)' : 'text.primary'
        }}
      >
        일괄 이미지 업로드
      </Typography>
      
      <Box 
        sx={{
          border: '2px dashed',
          borderColor: isDark ? 'rgb(55, 65, 81)' : 'rgb(229, 231, 235)',
          borderRadius: 1,
          p: 6,
          textAlign: 'center',
          cursor: 'pointer',
          mb: 4,
          bgcolor: isDark ? 'rgb(17, 24, 39)' : 'rgb(249, 250, 251)',
          transition: 'border-color 0.2s',
          '&:hover': {
            borderColor: isDark ? 'rgb(75, 85, 99)' : 'rgb(156, 163, 175)'
          }
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileSelector}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="image/jpeg,image/png,image/jpg"
          style={{ display: 'none' }}
        />
        
        <CloudUploadIcon 
          sx={{ 
            fontSize: '3rem', 
            mb: 2, 
            color: isDark ? 'rgb(107, 114, 128)' : 'rgb(156, 163, 175)'
          }} 
        />
        
        <Typography sx={{ color: isDark ? 'rgb(209, 213, 219)' : 'rgb(55, 65, 81)' }}>
          클릭하여 이미지 선택 또는 여기로 파일을 끌어다 놓으세요
        </Typography>
        
        <Typography 
          variant="body2" 
          sx={{ color: 'rgb(107, 114, 128)' }}
        >
          여러 파일을 동시에 선택할 수 있습니다 (최대 10MB/파일)
        </Typography>
      </Box>
      
      {files.length > 0 && (
        <>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography 
              variant="subtitle2" 
              sx={{ color: isDark ? 'rgb(209, 213, 219)' : 'rgb(55, 65, 81)' }}
            >
              선택된 파일 ({files.length})
            </Typography>
            
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={clearFiles}
              disabled={isUploading}
            >
              모두 제거
            </Button>
          </Box>
          
          <List sx={{ maxHeight: '300px', overflow: 'auto', mb: 3 }}>
            {files.map((file, index) => (
              <ListItem
                key={`${file.file.name}-${index}`}
                secondaryAction={
                  <IconButton 
                    edge="end" 
                    aria-label="delete" 
                    onClick={() => removeFile(index)}
                    disabled={isUploading || file.status === 'processing'}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
                sx={{
                  bgcolor: isDark ? 'rgba(31, 41, 55, 0.5)' : 'rgba(249, 250, 251, 0.5)',
                  mb: 1,
                  borderRadius: 1,
                }}
              >
                <ListItemIcon>
                  {renderStatusIcon(file.status, file.progress)}
                </ListItemIcon>
                
                <ListItemText
                  primary={file.file.name}
                  secondary={
                    file.status === 'error' 
                      ? <span style={{ color: 'rgb(239, 68, 68)' }}>{file.error}</span>
                      : `${(file.file.size / 1024).toFixed(1)} KB`
                  }
                  primaryTypographyProps={{
                    sx: { 
                      color: isDark ? 'rgb(229, 231, 235)' : 'rgb(31, 41, 55)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    },
                    title: file.file.name
                  }}
                  secondaryTypographyProps={{
                    sx: file.status !== 'error' 
                      ? { color: isDark ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)' }
                      : {}
                  }}
                />
                
                {file.status === 'success' && (
                  <Chip 
                    label="완료" 
                    size="small" 
                    color="success" 
                    variant="outlined" 
                    sx={{ mr: 2 }}
                  />
                )}
              </ListItem>
            ))}
          </List>
          
          {/* 전체 진행률 */}
          {isUploading && (
            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="body2" 
                sx={{ color: isDark ? 'rgb(156, 163, 175)' : 'rgb(75, 85, 99)' }}
                gutterBottom
              >
                전체 진행률: {Math.round(totalProgress)}%
              </Typography>
              <LinearProgress variant="determinate" value={totalProgress} />
            </Box>
          )}
          
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
            startIcon={<CloudUploadIcon />}
          >
            {isUploading ? '처리 중...' : '모두 추출하기'}
          </Button>
        </>
      )}
    </Paper>
  );
};

export default BatchUploader; 