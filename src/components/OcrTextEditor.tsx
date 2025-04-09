import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Paper, 
  TextField, 
  Typography,
  Chip
} from '@mui/material';
import OcrResultActions from './OcrResultActions';

interface OcrTextEditorProps {
  text: string;
  textId: number | null;
  isBookmarked: boolean;
  isProcessing: boolean;
  isBatchMode: boolean;
  batchIndex?: number;
  batchTotal?: number;
  onTextChange: (text: string) => void;
  onCopy: () => void;
  onSave?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onToggleBookmark?: () => void;
  onPrevBatch?: () => void;
  onNextBatch?: () => void;
  isDark?: boolean;
  isEditMode?: boolean;
}

const OcrTextEditor: React.FC<OcrTextEditorProps> = ({
  text,
  textId,
  isBookmarked,
  isProcessing,
  isBatchMode,
  batchIndex = 0,
  batchTotal = 0,
  onTextChange,
  onCopy,
  onSave,
  onEdit,
  onShare,
  onDownload,
  onDelete,
  onToggleBookmark,
  onPrevBatch,
  onNextBatch,
  isDark = false,
  isEditMode = false
}) => {
  const [localText, setLocalText] = useState(text);
  const [charCount, setCharCount] = useState(0);
  
  useEffect(() => {
    setLocalText(text);
    setCharCount(text.length);
  }, [text]);
  
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setLocalText(newText);
    setCharCount(newText.length);
    onTextChange(newText);
  };
  
  return (
    <Paper 
      elevation={1} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: isDark ? 'rgba(30, 30, 30, 0.9)' : 'background.paper',
        color: isDark ? 'text.primary' : 'inherit',
        overflow: 'hidden',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : 'none'
      }}
    >
      <Box sx={{ 
        p: 2, 
        pb: 1,
        borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : 'none'
      }}>
        <OcrResultActions
          hasText={text.trim().length > 0}
          hasExtraction={textId !== null}
          isBookmarked={isBookmarked}
          onCopy={onCopy}
          onEdit={onEdit || (() => {})}
          onShare={onShare}
          onDownload={onDownload}
          onSave={onSave}
          onDelete={onDelete}
          onToggleBookmark={onToggleBookmark}
          isDark={isDark}
          isEditMode={isEditMode}
        />
      </Box>

      {isBatchMode && batchTotal > 1 && (
        <Box sx={{ 
          px: 2, 
          py: 1, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : 'none'
        }}>
          <Chip 
            label={`${batchIndex + 1} / ${batchTotal}`} 
            size="small" 
            color="primary" 
            variant="outlined"
            sx={{
              borderColor: isDark ? 'rgba(144, 202, 249, 0.5)' : undefined,
              color: isDark ? '#90caf9' : undefined
            }}
          />
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label="이전"
              size="small"
              onClick={onPrevBatch}
              disabled={!onPrevBatch || batchIndex <= 0}
              clickable={!!onPrevBatch && batchIndex > 0}
              sx={{
                color: isDark ? (batchIndex > 0 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.3)') : undefined,
                bgcolor: isDark ? 'rgba(50, 50, 50, 0.8)' : undefined,
                '&:hover': {
                  bgcolor: isDark && batchIndex > 0 ? 'rgba(70, 70, 70, 0.9)' : undefined
                }
              }}
            />
            <Chip
              label="다음"
              size="small"
              onClick={onNextBatch}
              disabled={!onNextBatch || batchIndex >= batchTotal - 1}
              clickable={!!onNextBatch && batchIndex < batchTotal - 1}
              color="primary"
              sx={{
                bgcolor: isDark ? (batchIndex < batchTotal - 1 ? 'rgba(25, 118, 210, 0.8)' : 'rgba(25, 118, 210, 0.3)') : undefined,
                '&:hover': {
                  bgcolor: isDark && batchIndex < batchTotal - 1 ? 'rgba(25, 118, 210, 0.9)' : undefined
                }
              }}
            />
          </Box>
        </Box>
      )}

      <Box sx={{ p: 2, pt: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TextField
          multiline
          fullWidth
          variant="outlined"
          placeholder="이미지를 업로드하면 OCR을 통해 텍스트가 추출됩니다..."
          value={localText}
          onChange={handleTextChange}
          disabled={isProcessing}
          InputProps={{
            readOnly: !isEditMode,
            sx: { 
              height: '100%', 
              '& .MuiOutlinedInput-input': { 
                height: '100%', 
                overflowY: 'auto',
                color: isDark ? 'rgba(255, 255, 255, 0.9)' : undefined,
                cursor: !isEditMode ? 'default' : 'text',
                backgroundColor: !isEditMode ? (isDark ? 'rgba(30, 30, 30, 0.5)' : 'rgba(245, 245, 245, 0.5)') : 'transparent'
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: !isEditMode 
                  ? (isDark ? 'rgba(100, 100, 100, 0.3)' : 'rgba(200, 200, 200, 0.5)') 
                  : (isDark ? 'rgba(255, 255, 255, 0.2)' : undefined)
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : undefined
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: isDark ? 'rgba(144, 202, 249, 0.5)' : undefined
              },
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : undefined
            }
          }}
          sx={{ flex: 1 }}
        />
        
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color={isDark ? 'rgba(255, 255, 255, 0.6)' : 'text.secondary'}>
              {charCount}자
            </Typography>
            {!isEditMode && (
              <Typography 
                variant="caption" 
                sx={{ 
                  backgroundColor: isDark ? 'rgba(60, 60, 60, 0.6)' : 'rgba(240, 240, 240, 0.8)', 
                  px: 0.7, 
                  py: 0.3, 
                  borderRadius: 1,
                  fontSize: '0.67rem'
                }}
                color={isDark ? 'rgba(200, 200, 200, 0.9)' : 'text.secondary'}
              >
                읽기 전용
              </Typography>
            )}
          </Box>
          
          {textId && (
            <Typography variant="caption" color={isDark ? 'rgba(255, 255, 255, 0.6)' : 'text.secondary'}>
              ID: {textId}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default OcrTextEditor; 