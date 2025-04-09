import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Container, 
  Grid, 
  Paper, 
  Tab, 
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
  IconButton,
  Tooltip
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { History as HistoryIcon } from '@mui/icons-material';

import { useImageManager } from '../hooks/useImageManager';
import { useBatchProcessing } from '../hooks/useBatchProcessing';
import { useOcrMethods } from '../hooks/useOcrMethods';
import { useToast } from '../hooks/useToast';
import { ToastTypeParam } from '../hooks/useToast';
import { useExtractionHistory, ExtractionFromAPI } from '../hooks/useExtractionHistory';
import { useTheme as useAppTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

import Header from '../components/Header';
import TabPanel from '../components/TabPanel';
import OcrImagePreview from '../components/OcrImagePreview';
import OcrTextEditor from '../components/OcrTextEditor';
import OcrSettingsPanel from '../components/OcrSettingsPanel';
import OcrImageEditor from '../components/OcrImageEditor';
import BatchUploadProgress from '../components/BatchUploadProgress';
import FileDropzone from '../components/FileDropzone';
import HistoryPanel from '../components/HistoryPanel';

import { OcrLocalStorageUtils } from '../utils/OcrLocalStorageUtils';
import { DEFAULT_OCR_MODEL, DEFAULT_LANGUAGE } from '../constants/ocr';
import { Extraction } from '../types';
import { 
  updateExtractionFilename,
  toggleExtractionBookmark,
  updateExtractedText 
} from '../services/api';

const transformApiExtraction = (apiItem: ExtractionFromAPI): Extraction => {
  return {
    ...apiItem,
    filename: apiItem.filename === null ? undefined : apiItem.filename,
    extracted_text: apiItem.extracted_text === null ? undefined : apiItem.extracted_text,
    text: apiItem.text === null ? undefined : apiItem.text,
    user_id: apiItem.user_id !== undefined && apiItem.user_id !== null
             ? String(apiItem.user_id)
             : undefined,
    is_bookmarked: typeof apiItem.is_bookmarked === 'number' ? apiItem.is_bookmarked === 1 : !!apiItem.is_bookmarked,
    language: apiItem.language === null ? undefined : apiItem.language,
  };
};

const OcrPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { theme: appTheme, toggleTheme } = useAppTheme();
  const isDark = appTheme === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { id } = useParams<{ id: string }>();

  const { user, signOut } = useAuth();
  const { 
    showToast, 
    showSuccessToast, 
    showErrorToast, 
    showInfoToast 
  } = useToast();

  const [tabValue, setTabValue] = useState<number>(0);
  const [extractedText, setExtractedText] = useState<string>('');
  const [textId, setTextId] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>(OcrLocalStorageUtils.getOcrModel() || DEFAULT_OCR_MODEL);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(OcrLocalStorageUtils.getOcrLanguage() || DEFAULT_LANGUAGE);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [uploadFileCount, setUploadFileCount] = useState<number>(0);
  const [isExtractionBookmarked, setIsExtractionBookmarked] = useState<boolean>(false);
  const [selectedExtraction, setSelectedExtraction] = useState<Extraction | null>(null);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState<boolean>(false);
  const [ocrHistory, setOcrHistory] = useState<Extraction[]>([]);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  const wrappedShowToast = useCallback((message: string, type: ToastTypeParam, duration?: number) => {
    showToast(message, type, duration);
  }, [showToast]);

  const handleExtractComplete = useCallback((
    text: string, 
    id: number, 
    model: string
  ) => {
    setExtractedText(text);
    setTextId(id);
    setShowEditor(true);
    setIsEditMode(false);
    setIsExtractionBookmarked(false);
    setSelectedModel(model);
  }, []);

  const {
    previewUrls, 
    imageQuality,
    imageZoom,
    isEditorOpen, 
    setIsEditorOpen, 
    handleFileSelect, 
    changeImageQuality,
    changeImageZoom,
    handleCropComplete 
  } = useImageManager(
    wrappedShowToast,
    setIsProcessing, 
    handleExtractComplete, 
    selectedExtraction,
    selectedLanguage,
    setExtractedText,
    setShowEditor,
    setTextId
  );

  const {
    fetchExtractions,
    deleteExtraction,
    extractions,
  } = useExtractionHistory(wrappedShowToast);

  const {
    performOcr,
    performBatchOcr
  } = useOcrMethods(wrappedShowToast);

  const {
    batchResults,
    currentBatchIndex,
    moveToNextBatchItem,
    moveToPrevBatchItem,
    handleBatchComplete
  } = useBatchProcessing(
    setExtractedText,
    setTextId,
    setShowEditor,
    async (data: Partial<ExtractionFromAPI>) => {
      console.warn('임시 addExtraction 호출됨:', data);
      return { success: true, id: Date.now() };
    },
    fetchExtractions,
    wrappedShowToast,
    selectedLanguage,
    setIsEditMode
  );

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleTextChange = (newText: string) => {
    setExtractedText(newText);
  };

  const handleToggleBookmark = useCallback(async () => {
    if (!textId) return;
    
    try {
      const response = await toggleExtractionBookmark(textId, isExtractionBookmarked);
      
      if (response && response.success) {
        setIsExtractionBookmarked(response.data?.is_bookmarked || false);
        showSuccessToast(
          response.data?.is_bookmarked 
            ? '북마크에 추가되었습니다.' 
            : '북마크에서 제거되었습니다.'
        );
        
        // 목록 갱신
        fetchExtractions(true);
      } else {
        showErrorToast(response?.error || '북마크 상태 변경 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('북마크 토글 중 오류:', error);
      showErrorToast('북마크 기능 처리 중 오류가 발생했습니다.');
    }
  }, [textId, isExtractionBookmarked, showSuccessToast, showErrorToast, fetchExtractions]);

  const handleCopyText = useCallback(() => {
    if (!extractedText) return;
    
    navigator.clipboard.writeText(extractedText)
      .then(() => {
        showSuccessToast('텍스트가 클립보드에 복사되었습니다.');
      })
      .catch((error) => {
        console.error('클립보드 복사 오류:', error);
        showErrorToast('텍스트 복사 중 오류가 발생했습니다.');
      });
  }, [extractedText, showSuccessToast, showErrorToast]);

  const handleEditText = useCallback(() => {
    setShowEditor(true);
    setIsEditMode(true);
  }, []);

  const handleImageUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    setIsEditMode(false);
    
    try {
      const result = await performOcr(file, selectedModel, selectedLanguage);
      
      if (!result || result.success === false || !result.text) {
        throw new Error(result?.error || '텍스트 추출에 실패했습니다.');
      }
      
      setExtractedText(result.text);
      if (result.id !== undefined && result.id !== null) {
        if (typeof result.id === 'object' && result.id !== null && 'id' in result.id) {
          setTextId((result.id as {id: number}).id);
        } else {
          setTextId(typeof result.id === 'string' ? parseInt(result.id, 10) : result.id);
        }
      }
      setShowEditor(true);
      setIsExtractionBookmarked(false);
      
      showSuccessToast('텍스트 추출이 완료되었습니다.');
      
      fetchExtractions(true);
    } catch (error) {
      console.error('이미지 처리 오류:', error);
      showErrorToast(error instanceof Error ? error.message : '이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  }, [performOcr, selectedModel, selectedLanguage, showSuccessToast, showErrorToast, fetchExtractions]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileSelect(e);
      handleImageUpload(file);
    }
  }, [handleFileSelect, handleImageUpload]);

  const handleBatchUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    setUploadingFiles(true);
    setUploadFileCount(files.length);
    setUploadProgress(0);
    
    try {
      const results = await performBatchOcr(
        files,
        selectedModel,
        selectedLanguage,
        (progress) => setUploadProgress(progress)
      );
      
      await handleBatchComplete(results.map(result => ({
        id: typeof result.id === 'string' ? parseInt(result.id) : (result.id || 0),
        text: result.text || '',
        filename: result.filename
      })));
    } catch (error) {
      console.error('일괄 업로드 오류:', error);
      showErrorToast(error instanceof Error ? error.message : '일괄 처리 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => {
        setUploadingFiles(false);
      }, 1000);
    }
  }, [performBatchOcr, selectedModel, selectedLanguage, handleBatchComplete, showErrorToast]);

  const handleBatchUploadCancel = useCallback(() => {
    setUploadingFiles(false);
    setUploadProgress(0);
  }, []);

  const handleLanguageChange = useCallback((language: string) => {
    setSelectedLanguage(language);
    OcrLocalStorageUtils.saveOcrLanguage(language);
  }, []);

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    OcrLocalStorageUtils.saveOcrModel(model);
  }, []);

  useEffect(() => {
    if (id) {
      const loadExtractionById = async () => {
        showErrorToast('ID로 내역 로드 기능이 현재 비활성화 상태입니다.');
      };
      loadExtractionById();
    }
  }, [id, showErrorToast]);

  const handleSaveText = useCallback(async () => {
    if (!textId) return;
    
    try {
      // 서버에 텍스트 저장
      const response = await updateExtractedText(textId, extractedText);
      
      if (response && response.success) {
        // 저장 후 편집 모드 종료
        setIsEditMode(false);
        showSuccessToast('텍스트가 저장되었습니다.');
        
        // 목록 갱신
        fetchExtractions(true);
      } else {
        showErrorToast(response?.error || '텍스트 저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('텍스트 저장 오류:', error);
      showErrorToast('텍스트 저장 중 오류가 발생했습니다.');
    }
  }, [textId, extractedText, updateExtractedText, showSuccessToast, showErrorToast, fetchExtractions]);

  const handleDeleteText = useCallback(async () => {
    if (!textId) return;
    
    try {
      const success = await deleteExtraction(textId);
      
      if (success) {
        setExtractedText('');
        setTextId(null);
        setShowEditor(false);
        
        showSuccessToast('텍스트가 삭제되었습니다.');
        
        setTimeout(() => fetchExtractions(true), 500);
        
        navigate('/ocr');
      } else {
        showErrorToast('텍스트 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('텍스트 삭제 오류:', error);
      showErrorToast('텍스트 삭제 중 오류가 발생했습니다.');
    }
  }, [textId, deleteExtraction, fetchExtractions, navigate, showSuccessToast, showErrorToast]);

  const handleImageQualityChange = useCallback((newQuality: number) => {
    changeImageQuality(newQuality, textId?.toString());
  }, [changeImageQuality, textId]);

  const handleLogout = () => {
    if (signOut) {
      signOut();
      navigate('/login');
    }
  };

  const renderSettingsPanel = () => (
    <OcrSettingsPanel
      selectedModel={selectedModel}
      selectedLanguage={selectedLanguage}
      imageQuality={imageQuality}
      imageZoom={imageZoom}
      onModelChange={handleModelChange}
      onLanguageChange={handleLanguageChange}
      onImageQualityChange={handleImageQualityChange}
      onImageZoomChange={changeImageZoom}
      isDark={isDark}
    />
  );

  useEffect(() => {
    fetchExtractions(true);
  }, [fetchExtractions]);

  useEffect(() => {
    // OCR 히스토리 업데이트
    if (extractions && extractions.length > 0) {
      const filteredAndTransformed = extractions
        .filter(ext => {
          // 이미지 OCR 내역 필터링
          return (
            ext.source_type === 'image' || 
            (ext.source_type !== 'pdf' && ['tesseract', 'gemini'].includes(ext.ocr_model || ''))
          );
        })
        .map(transformApiExtraction);

      setOcrHistory(filteredAndTransformed);
    } else {
      setOcrHistory([]);
    }
  }, [extractions]);

  const handleOpenHistoryPanel = () => {
    fetchExtractions(true).then(() => {
        setIsHistoryPanelOpen(true);
    }).catch(error => {
        console.error("Failed to fetch extractions before opening panel:", error);
        showErrorToast("내역을 불러오는 중 오류가 발생했습니다.");
    });
  };

  const handleCloseHistoryPanel = () => {
    setIsHistoryPanelOpen(false);
  };

  const handleSelectExtraction = useCallback((extraction: Extraction) => {
    // console.log("Loading extraction from history:", extraction);
    setExtractedText(extraction.extracted_text || extraction.text || '');
    setTextId(extraction.id);
    setShowEditor(true);
    setIsEditMode(false);
    setIsExtractionBookmarked(extraction.is_bookmarked || false);
    setSelectedExtraction(extraction);
    setTabValue(0);
    setIsHistoryPanelOpen(false);
    showInfoToast('이전 추출 내역을 불러왔습니다.');
  }, [showInfoToast]);

  const handleDeleteExtractionFromHistory = async (id: number): Promise<boolean> => {
     try {
       const success = await deleteExtraction(id);
       if (success) {
         showSuccessToast('내역이 삭제되었습니다.');
         fetchExtractions(true);
         if (textId === id) {
             setExtractedText('');
             setTextId(null);
             setShowEditor(false);
             setSelectedExtraction(null);
         }
         return true;
       } else {
         showErrorToast('내역 삭제에 실패했습니다.');
         return false;
       }
     } catch (error) {
       console.error('히스토리 삭제 오류:', error);
       showErrorToast('내역 삭제 중 오류가 발생했습니다.');
       return false;
     }
  };

  const handleUpdateFilename = async (id: number, newFilename: string): Promise<boolean> => {
    if (!newFilename.trim()) {
      showErrorToast("파일명을 비워둘 수 없습니다.");
      return false;
    }
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showErrorToast("로그인이 필요합니다.");
        return false;
      }

      const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/extractions/${id}/filename`;
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ filename: newFilename.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '서버 오류' }));
        throw new Error(errorData.error || '파일명 업데이트 실패');
      }

      setOcrHistory(prev =>
        prev.map(ext =>
          ext.id === id ? { ...ext, filename: newFilename.trim() } : ext
        )
      );

      if (selectedExtraction && selectedExtraction.id === id) {
          setSelectedExtraction(prev => prev ? { ...prev, filename: newFilename.trim() } : null);
      }

      showSuccessToast('파일명이 변경되었습니다.');
      return true;
    } catch (error) {
      console.error('파일명 업데이트 오류:', error);
      showErrorToast(error instanceof Error ? error.message : '파일명 업데이트 중 오류 발생');
      return false;
    }
  };

  const handleBookmarkToggleFromHistory = useCallback(async (id: number, isBookmarked: boolean): Promise<boolean> => {
    try {
      const response = await toggleExtractionBookmark(id, isBookmarked);
      
      if (response && response.success) {
        // 현재 선택된 항목이 변경된 북마크라면 상태 업데이트
        if (textId === id) {
          setIsExtractionBookmarked(response.data?.is_bookmarked || false);
        }
        
        // 목록 갱신
        fetchExtractions(true);
        
        showSuccessToast(
          response.data?.is_bookmarked 
            ? '북마크에 추가되었습니다.' 
            : '북마크에서 제거되었습니다.'
        );
        
        return true;
      } else {
        showErrorToast(response?.error || '북마크 상태 변경 중 오류가 발생했습니다.');
        return false;
      }
    } catch (error) {
      console.error('북마크 토글 중 오류:', error);
      showErrorToast('북마크 기능 처리 중 오류가 발생했습니다.');
      return false;
    }
  }, [textId, fetchExtractions, showSuccessToast, showErrorToast]);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        bgcolor: isDark ? 'rgba(18, 18, 18, 1)' : 'background.default'
      }}
    >
      <Header 
        showLogout={true} 
        isDark={isDark} 
        user={user || undefined} 
        onLogout={handleLogout}
        onToggleDarkMode={toggleTheme}
      />
      
      <Container 
        maxWidth={false} 
        sx={{ 
          display: 'flex', 
          flexGrow: 1, 
          p: 2,
          bgcolor: isDark ? 'rgba(18, 18, 18, 1)' : 'background.default'
        }}
      >
        <Paper 
          elevation={2} 
          sx={{
            p: { xs: 2, sm: 3 }, 
            borderRadius: 2,
            bgcolor: isDark ? 'background.paper' : 'background.paper',
            color: isDark ? 'text.primary' : 'inherit',
            boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.3)' : undefined
          }}
        >
          <Typography variant="h5" component="h1" gutterBottom>
            OCR 이미지 텍스트 추출
          </Typography>

          <Box sx={{ 
            borderBottom: 1, 
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'divider', 
            mb: 2 
          }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              aria-label="OCR 탭"
              variant={isMobile ? "fullWidth" : "standard"}
              sx={{ 
                '& .MuiTab-root': {
                  color: isDark ? 'rgba(255, 255, 255, 0.7)' : undefined,
                  '&.Mui-selected': {
                    color: isDark ? '#90caf9' : undefined,
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: isDark ? '#90caf9' : undefined,
                }
              }}
            >
              <Tab label="단일 이미지" />
              <Tab label="일괄 처리" />
            </Tabs>
          </Box>
          
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <OcrImagePreview 
                  previewUrl={previewUrls[0]}
                  imageZoom={imageZoom}
                  isEditable={true}
                  isProcessing={isProcessing}
                  onZoomChange={changeImageZoom}
                  onImageEdit={() => setIsEditorOpen(true)}
                  onFileSelect={handleFileChange}
                  isDark={isDark}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                {showEditor ? (
                  <OcrTextEditor
                    text={extractedText}
                    textId={textId}
                    isBookmarked={isExtractionBookmarked}
                    isProcessing={isProcessing}
                    isBatchMode={false}
                    onTextChange={handleTextChange}
                    onCopy={handleCopyText}
                    onSave={handleSaveText}
                    onEdit={handleEditText}
                    onDelete={handleDeleteText}
                    onToggleBookmark={handleToggleBookmark}
                    isDark={isDark}
                    isEditMode={isEditMode}
                  />
                ) : (
                  <Paper 
                    elevation={1} 
                    sx={{ 
                      height: '100%', 
                      minHeight: 300, 
                      bgcolor: isDark ? 'rgba(45, 45, 45, 0.8)' : 'background.paper', 
                      color: isDark ? 'text.primary' : 'inherit',
                      p: 3 
                    }}
                  >
                    <Typography variant="body1" color={isDark ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'} align="center">
                      이미지를 선택하면 추출된 텍스트가 여기에 표시됩니다.
                    </Typography>
                  </Paper>
                )}
              </Grid>
            </Grid>
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ height: 300 }}>
                  <FileDropzone
                    onFilesAccepted={handleBatchUpload}
                    maxFiles={10}
                    disabled={isProcessing || uploadingFiles}
                    isProcessing={isProcessing || uploadingFiles}
                    isDark={isDark}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                {showEditor ? (
                  <OcrTextEditor
                    text={extractedText}
                    textId={textId}
                    isBookmarked={isExtractionBookmarked}
                    isProcessing={isProcessing}
                    isBatchMode={batchResults.length > 1}
                    batchIndex={currentBatchIndex}
                    batchTotal={batchResults.length}
                    onTextChange={handleTextChange}
                    onCopy={handleCopyText}
                    onSave={handleSaveText}
                    onEdit={handleEditText}
                    onDelete={handleDeleteText}
                    onToggleBookmark={handleToggleBookmark}
                    onPrevBatch={moveToPrevBatchItem}
                    onNextBatch={moveToNextBatchItem}
                    isDark={isDark}
                    isEditMode={isEditMode}
                  />
                ) : (
                  <Paper 
                    elevation={1} 
                    sx={{ 
                      height: '100%', 
                      minHeight: 300, 
                      bgcolor: isDark ? 'rgba(45, 45, 45, 0.8)' : 'background.paper', 
                      color: isDark ? 'text.primary' : 'inherit',
                      p: 3 
                    }}
                  >
                    <Typography variant="body1" color={isDark ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'} align="center">
                      여러 이미지를 한 번에 업로드할 수 있습니다. 
                      파일을 끌어다 놓거나 클릭하여 선택하세요.
                    </Typography>
                  </Paper>
                )}
              </Grid>
            </Grid>
          </TabPanel>

          <Box sx={{ mt: 3 }}>
            {renderSettingsPanel()}
          </Box>
        </Paper>

        <OcrImageEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          selectedImage={previewUrls[0]}
          onCropComplete={handleCropComplete}
          isDark={isDark}
        />

        <BatchUploadProgress
          isUploading={uploadingFiles}
          progress={uploadProgress}
          fileCount={uploadFileCount}
          onCancel={handleBatchUploadCancel}
          isDark={isDark}
        />

        <Tooltip title="추출 내역 보기">
           <IconButton
             onClick={handleOpenHistoryPanel}
             sx={{
               position: 'absolute',
               top: theme.spacing(9),
               right: theme.spacing(2),
               zIndex: 1100,
               color: isDark ? theme.palette.grey[400] : theme.palette.grey[600],
               bgcolor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
               '&:hover': {
                  bgcolor: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.9)',
               }
             }}
           >
             <HistoryIcon />
           </IconButton>
        </Tooltip>

        <HistoryPanel
          open={isHistoryPanelOpen}
          onClose={handleCloseHistoryPanel}
          extractions={(extractions || []).map(transformApiExtraction)}
          onSelectExtraction={handleSelectExtraction}
          onDeleteExtraction={handleDeleteExtractionFromHistory}
          onUpdateFilename={handleUpdateFilename}
          onBookmarkToggle={handleBookmarkToggleFromHistory}
          fetchExtractions={fetchExtractions}
          isDark={isDark}
        />
      </Container>
    </Box>
  );
};

export default OcrPage;