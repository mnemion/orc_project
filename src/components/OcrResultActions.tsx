import React from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  DeleteOutline as DeleteIcon,
  Save as SaveIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon
} from '@mui/icons-material';

interface OcrResultActionsProps {
  hasText: boolean;
  hasExtraction: boolean;
  showFullButtons?: boolean;
  isBookmarked: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onToggleBookmark?: () => void;
  isDark?: boolean;
  isEditMode?: boolean;
}

/**
 * OCR 결과에 대한 액션 버튼 컴포넌트
 */
const OcrResultActions: React.FC<OcrResultActionsProps> = ({
  hasText,
  hasExtraction,
  showFullButtons = false,
  isBookmarked = false,
  onCopy,
  onEdit,
  onShare,
  onDownload,
  onSave,
  onDelete,
  onToggleBookmark,
  isDark = false,
  isEditMode = false
}) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
      {/* 주요 동작 버튼 - 모바일에서는 아이콘만 표시 */}
      <ButtonGroup 
        variant="outlined" 
        size="small"
        sx={{
          '& .MuiButtonGroup-grouped': {
            borderColor: isDark ? 'rgba(255, 255, 255, 0.23)' : undefined,
            '&:hover': {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.4)' : undefined
            }
          }
        }}
      >
        <Tooltip title="텍스트 복사">
          <span>
            <Button
              onClick={onCopy}
              disabled={!hasText}
              startIcon={<CopyIcon />}
              sx={{ 
                display: { xs: 'none', sm: showFullButtons ? 'flex' : 'none' },
                color: isDark && hasText ? 'rgba(255, 255, 255, 0.9)' : undefined,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : undefined
                }
              }}
            >
              복사
            </Button>
            <IconButton
              onClick={onCopy}
              disabled={!hasText}
              size="small"
              sx={{ 
                display: { xs: 'flex', sm: showFullButtons ? 'none' : 'flex' },
                color: isDark && hasText ? 'rgba(255, 255, 255, 0.9)' : undefined
              }}
            >
              <CopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={isEditMode ? "편집 중" : "텍스트 편집"}>
          <span>
            <Button
              onClick={onEdit}
              disabled={!hasText}
              startIcon={<EditIcon />}
              color={isEditMode ? "primary" : "inherit"}
              variant={isEditMode ? "contained" : "outlined"}
              sx={{ 
                display: { xs: 'none', sm: showFullButtons ? 'flex' : 'none' },
                color: isEditMode 
                  ? (isDark ? 'white' : undefined) 
                  : (isDark && hasText ? 'rgba(255, 255, 255, 0.9)' : undefined),
                bgcolor: isEditMode 
                  ? (isDark ? 'rgba(25, 118, 210, 0.8)' : undefined) 
                  : 'transparent',
                '&:hover': {
                  bgcolor: isEditMode 
                    ? (isDark ? 'rgba(25, 118, 210, 0.9)' : undefined) 
                    : (isDark ? 'rgba(255, 255, 255, 0.08)' : undefined)
                }
              }}
            >
              {isEditMode ? "편집 중" : "편집"}
            </Button>
            <IconButton
              onClick={onEdit}
              disabled={!hasText}
              size="small"
              color={isEditMode ? "primary" : "inherit"}
              sx={{ 
                display: { xs: 'flex', sm: showFullButtons ? 'none' : 'flex' },
                color: isEditMode 
                  ? (isDark ? 'rgba(144, 202, 249, 0.9)' : undefined) 
                  : (isDark && hasText ? 'rgba(255, 255, 255, 0.9)' : undefined),
                bgcolor: isEditMode ? (isDark ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.1)') : 'transparent'
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {onShare && (
          <Tooltip title="공유">
            <span>
              <Button
                onClick={onShare}
                disabled={!hasText}
                startIcon={<ShareIcon />}
                sx={{ 
                  display: { xs: 'none', sm: showFullButtons ? 'flex' : 'none' },
                  color: isDark && hasText ? 'rgba(255, 255, 255, 0.9)' : undefined,
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : undefined
                  }
                }}
              >
                공유
              </Button>
              <IconButton
                onClick={onShare}
                disabled={!hasText}
                size="small"
                sx={{ 
                  display: { xs: 'flex', sm: showFullButtons ? 'none' : 'flex' },
                  color: isDark && hasText ? 'rgba(255, 255, 255, 0.9)' : undefined
                }}
              >
                <ShareIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {onDownload && (
          <Tooltip title="다운로드">
            <span>
              <Button
                onClick={onDownload}
                disabled={!hasText}
                startIcon={<DownloadIcon />}
                sx={{ 
                  display: { xs: 'none', sm: showFullButtons ? 'flex' : 'none' },
                  color: isDark && hasText ? 'rgba(255, 255, 255, 0.9)' : undefined,
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : undefined
                  }
                }}
              >
                다운로드
              </Button>
              <IconButton
                onClick={onDownload}
                disabled={!hasText}
                size="small"
                sx={{ 
                  display: { xs: 'flex', sm: showFullButtons ? 'none' : 'flex' },
                  color: isDark && hasText ? 'rgba(255, 255, 255, 0.9)' : undefined
                }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </ButtonGroup>

      {/* 보조 동작 버튼 */}
      <Box>
        {onToggleBookmark && (
          <Tooltip title={isBookmarked ? "북마크 제거" : "북마크"}>
            <IconButton
              onClick={onToggleBookmark}
              disabled={!hasExtraction}
              size="small"
              color="default"
              sx={{
                color: isBookmarked 
                  ? (isDark ? '#FFEB3B' : '#FFC107') 
                  : (isDark && hasExtraction ? 'rgba(255, 255, 255, 0.7)' : undefined)
              }}
            >
              {isBookmarked ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}

        {onSave && (
          <Tooltip title={isEditMode ? "편집 내용 저장" : "저장"}>
            <IconButton
              onClick={onSave}
              disabled={!hasText}
              size="small"
              color={isEditMode ? "primary" : "default"}
              sx={{
                color: isEditMode 
                  ? (isDark ? 'rgba(144, 202, 249, 0.9)' : undefined)
                  : (isDark && hasText ? 'rgba(255, 255, 255, 0.7)' : undefined),
                animation: isEditMode ? 'pulse 1.5s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.4)' },
                  '70%': { boxShadow: '0 0 0 6px rgba(25, 118, 210, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' }
                },
                backgroundColor: isEditMode ? (isDark ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.1)') : 'transparent'
              }}
            >
              <SaveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {onDelete && (
          <Tooltip title="삭제">
            <IconButton
              onClick={onDelete}
              disabled={!hasExtraction}
              size="small"
              color="error"
              sx={{
                color: !hasExtraction 
                  ? 'rgba(255, 82, 82, 0.4)' 
                  : (isDark ? 'rgba(255, 82, 82, 0.9)' : undefined)
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default OcrResultActions; 