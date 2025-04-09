import React, { useState, useEffect, useCallback } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Button,
  useTheme,
  IconButton,
  Tooltip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import { History as HistoryIcon, UploadFile, PictureAsPdf } from '@mui/icons-material';
import { useTheme as useAppTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useExtractionHistory, ExtractionFromAPI } from '../hooks/useExtractionHistory';
import Header from '../components/Header';
import TextEditor from '../components/TextEditor';
import HistoryPanel from '../components/HistoryPanel';
import { Extraction } from '../types';
import { apiRequest } from '../services/api';

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

const PdfExtractionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme: appTheme, toggleTheme } = useAppTheme();
  const isDark = appTheme === 'dark';
  const theme = useTheme();
  const { showToast, showSuccessToast, showErrorToast, showInfoToast } = useToast();
  const [loading, setLoading] = useState<boolean>(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [currentTextId, setCurrentTextId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('pdf_extract');

  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState<boolean>(false);
  const [pdfHistory, setPdfHistory] = useState<Extraction[]>([]);

  const {
      extractions,
      fetchExtractions,
      deleteExtraction: deleteExtractionFromHistory,
  } = useExtractionHistory(showToast);

  useEffect(() => {
    fetchExtractions(true);
  }, [fetchExtractions]);

  useEffect(() => {
    if (extractions) {
      const filtered = extractions.filter(ext => {
        // PDF 추출 내역 필터링
        return (
          ext.source_type === 'pdf' && 
          ['pdf_extract', 'gemini', 'tesseract'].includes(ext.ocr_model || '')
        );
      });
      const transformedHistory = filtered.map(transformApiExtraction);
      setPdfHistory(transformedHistory);
    }
  }, [extractions]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (fileExtension === 'pdf') {
        setFile(selectedFile);
        setFileName(selectedFile.name);
      } else {
        showErrorToast('PDF 파일만 업로드 가능합니다.');
      }
    }
  };

  const handleModelChange = (event: SelectChangeEvent<string>) => {
    setSelectedModel(event.target.value);
  };

  const handleExtract = async () => {
    if (!file) {
      showErrorToast('PDF 파일을 먼저 업로드해주세요.');
      return;
    }

    setLoading(true);
    setExtractedText('');

    try {
      const formData = new FormData();
      
      const timestamp = Date.now();
      const safeFileName = `document_${timestamp}.pdf`;
      
      const newFile = new File([file], safeFileName, { type: 'application/pdf' });
      formData.append('file', newFile);
      formData.append('original_filename', file.name);
      formData.append('file_type', 'pdf');
      formData.append('source_type', 'pdf');
      formData.append('process_as', 'pdf');
      formData.append('model', selectedModel);
      formData.append('ocr_model', selectedModel);

      const response = await apiRequest('/extract', 'POST', formData);

      if (!response.success) {
        throw new Error(response.error || 'PDF 텍스트 추출 중 오류가 발생했습니다');
      }

      const data = response.data || {};
      const extractedText = data.text || data.extracted_text || '';
      setExtractedText(extractedText || '[추출된 텍스트 없음]');
      setLoading(false);
      
      if (response.success && data.id) {
        let numericId: number;
        if (typeof data.id === 'object') {
          console.warn('ID가 객체로 전달됨', data.id);
          numericId = data.id.id ? Number(data.id.id) : 0;
        } else {
          numericId = Number(data.id);
        }
        
        if (!isNaN(numericId) && numericId > 0) {
          setCurrentTextId(numericId);
          showSuccessToast(`PDF 텍스트 추출 완료! (ID: ${numericId}, 모델: ${selectedModel})`);
        } else {
          setCurrentTextId(null);
          console.error('유효하지 않은 ID:', data.id);
          showSuccessToast('PDF 텍스트 추출 완료! (유효하지 않은 ID)');
        }
      } else {
        setCurrentTextId(null);
        showSuccessToast('PDF 텍스트 추출 완료! (ID 정보 없음)');
      }
      fetchExtractions(true);

    } catch (err) {
      console.error('PDF 추출 오류:', err);
      const errorMessage = err instanceof Error ? err.message : 'PDF 텍스트 추출 중 오류가 발생했습니다';
      showErrorToast(errorMessage);
      setLoading(false);
    }
  };

  const handleOpenHistoryPanel = () => {
    fetchExtractions(true).then(() => {
       setIsHistoryPanelOpen(true);
    });
  };

  const handleCloseHistoryPanel = () => {
    setIsHistoryPanelOpen(false);
  };

  const handleSelectExtraction = useCallback((extraction: Extraction) => {
     setExtractedText(extraction.extracted_text || extraction.text || '');
     setFile(null);
     setFileName('');
     
     const numericId = extraction.id ? (
       typeof extraction.id === 'object' 
         ? (extraction.id as any).id ? Number((extraction.id as any).id) : null
         : Number(extraction.id)
     ) : null;
     
     setCurrentTextId(numericId && !isNaN(numericId) ? numericId : null);
     setIsHistoryPanelOpen(false);
     showInfoToast('이전 PDF 추출 내역을 불러왔습니다.');
  }, [showInfoToast]);

  const handleDeleteExtraction = useCallback(async (id: number): Promise<boolean> => {
     try {
       const success = await deleteExtractionFromHistory(id);
       if (success) {
         showSuccessToast('내역이 삭제되었습니다.');
         await fetchExtractions(true);
         setExtractedText('');
         setFile(null);
         setFileName('');
         if (currentTextId === id) {
             setCurrentTextId(null);
         }
         return true;
       } else {
         showErrorToast('내역 삭제에 실패했습니다.');
         return false;
       }
     } catch (error) {
       console.error('PDF 히스토리 삭제 오류:', error);
       showErrorToast('내역 삭제 중 오류가 발생했습니다.');
       return false;
     }
  }, [deleteExtractionFromHistory, fetchExtractions, showSuccessToast, showErrorToast, currentTextId]);

  const handleLogout = useCallback(async () => {
      try {
        await signOut();
        navigate('/login');
      } catch (error) {
        console.error('로그아웃 중 오류 발생:', error);
        showErrorToast('로그아웃 중 오류가 발생했습니다');
      }
    }, [signOut, navigate, showErrorToast]);

  const handleUpdateFilename = useCallback(async (id: number, newFilename: string): Promise<boolean> => {
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

      // 로컬 상태 업데이트
      setPdfHistory(prev =>
        prev.map(ext =>
          ext.id === id ? { ...ext, filename: newFilename.trim() } : ext
        )
      );

      showSuccessToast('파일명이 변경되었습니다.');
      await fetchExtractions(true);
      return true;
    } catch (error) {
      console.error('파일명 업데이트 오류:', error);
      showErrorToast(error instanceof Error ? error.message : '파일명 업데이트 중 오류 발생');
      return false;
    }
  }, [showErrorToast, showSuccessToast, fetchExtractions]);

  const handleBookmarkToggle = useCallback(async (id: number, isBookmarked: boolean): Promise<boolean> => {
    try {
      const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/extractions/bookmark/${id}`;
      const token = localStorage.getItem('token');
      
      if (!token) {
        showErrorToast("로그인이 필요합니다.");
        return false;
      }
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '서버 오류' }));
        throw new Error(errorData.error || '북마크 상태 변경 실패');
      }
      
      const result = await response.json();
      
      // 로컬 상태 업데이트
      setPdfHistory(prev =>
        prev.map(ext =>
          ext.id === id ? { ...ext, is_bookmarked: result.data?.is_bookmarked } : ext
        )
      );
      
      showSuccessToast(
        result.data?.is_bookmarked 
          ? '북마크에 추가되었습니다.' 
          : '북마크에서 제거되었습니다.'
      );
      
      await fetchExtractions(true);
      return true;
    } catch (error) {
      console.error('북마크 토글 중 오류:', error);
      showErrorToast(error instanceof Error ? error.message : '북마크 기능 처리 중 오류 발생');
      return false;
    }
  }, [showErrorToast, showSuccessToast, fetchExtractions]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: isDark ? 'grey.900' : 'grey.100' }}>
      <Header 
        user={user || undefined}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleDarkMode={toggleTheme}
      />

      <Tooltip title="PDF 추출 내역 보기">
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

      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
        <Grid container spacing={3} sx={{ height: '100%' }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: isDark ? 'rgba(0,0,0,0.2)' : undefined }}>
              <Typography variant="h6" gutterBottom>PDF 파일 업로드</Typography>
              <Button
                variant="contained"
                component="label"
                startIcon={<UploadFile />}
                sx={{ mb: 2 }}
              >
                파일 선택
                <input
                  type="file"
                  hidden
                  accept="application/pdf"
                  onChange={handleFileChange}
                />
              </Button>
              {fileName && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, p:1, borderRadius: 1, bgcolor: isDark? 'rgba(255,255,255,0.1)' : 'grey.100' }}>
                  <PictureAsPdf sx={{ mr: 1, color: 'error.main' }} />
                  <Typography variant="body2" noWrap>{fileName}</Typography>
                </Box>
              )}

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="model-select-label">텍스트 추출 모델</InputLabel>
                <Select
                  labelId="model-select-label"
                  id="model-select"
                  value={selectedModel}
                  onChange={handleModelChange}
                  label="텍스트 추출 모델"
                >
                  <MenuItem value="pdf_extract">기본 PDF 추출</MenuItem>
                  <MenuItem value="tesseract">Tesseract OCR</MenuItem>
                  <MenuItem value="gemini">Gemini AI</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                color="primary"
                onClick={handleExtract}
                disabled={!file || loading}
                fullWidth
                sx={{ mt: 'auto' }}
              >
                {loading ? '추출 중...' : '텍스트 추출 실행'}
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={8} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
             <Paper sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: isDark ? 'rgba(0,0,0,0.2)' : undefined }}>
                <TextEditor
                    initialText={extractedText}
                    textId={currentTextId}
                    readOnly={false}
                    onSaveComplete={(text) => console.log("텍스트 저장 완료", text)}
                />
             </Paper>
          </Grid>
        </Grid>
      </Container>

      <HistoryPanel
        open={isHistoryPanelOpen}
        onClose={handleCloseHistoryPanel}
        extractions={pdfHistory}
        onSelectExtraction={handleSelectExtraction}
        onDeleteExtraction={handleDeleteExtraction}
        onUpdateFilename={handleUpdateFilename}
        onBookmarkToggle={handleBookmarkToggle}
        fetchExtractions={fetchExtractions}
        title="PDF 추출 내역"
        isDark={isDark}
      />
    </Box>
  );
};

export default PdfExtractionPage;