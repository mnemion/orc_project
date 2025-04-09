import React, { useState, useRef, useEffect } from 'react';
import { formatTime } from '../utils/helpers';
import { updateExtractionFilename, toggleExtractionBookmark } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { Extraction } from '../types';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { Box, Paper, Typography, IconButton, InputBase, Menu, MenuItem, ListItemIcon, ListItemText, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

interface ExtractionItemProps {
  extraction: Extraction;
  isSelected: boolean;
  onSelect: (extraction: Extraction) => void;
  onEditClick: (extraction: Extraction) => void;
  onDeleteClick: (id: number) => void;
  onFilenameChange: (newName: string) => void;
  onBookmarkToggle?: (id: number, isBookmarked: boolean) => void;
}

const ExtractionItem = ({ 
  extraction, 
  onSelect, 
  onEditClick, 
  onDeleteClick,
  isSelected, 
  onFilenameChange,
  onBookmarkToggle
}: ExtractionItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newFilename, setNewFilename] = useState(extraction.filename);
  const [isBookmarked, setIsBookmarked] = useState(extraction.is_bookmarked);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAnchorEl(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleStartEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsEditing(true);
    setNewFilename(extraction.filename);
    setAnchorEl(null);
  };

  const handleCancelEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsEditing(false);
    setNewFilename(extraction.filename);
  };

  const handleSaveFilename = async (event: React.MouseEvent | React.FocusEvent | React.FormEvent) => {
    event.stopPropagation();
    
    if (!newFilename?.trim()) {
      showToast('파일명을 입력해주세요', 'warning');
      return;
    }
    
    if (newFilename === extraction.filename) {
      setIsEditing(false);
      return;
    }
    
    try {
      const result = await updateExtractionFilename(extraction.id, newFilename || '');
      
      if (result && result.success === true) {
        extraction.filename = newFilename;
        setIsEditing(false);
        onFilenameChange && onFilenameChange(newFilename || '');
      } else {
        setNewFilename(extraction.filename);
        showToast(result?.error || '파일명 변경 중 오류가 발생했습니다', 'error');
      }
    } catch (error) {
      setNewFilename(extraction.filename);
      showToast('파일명 변경 중 오류가 발생했습니다', 'error');
    }
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onDeleteClick) onDeleteClick(extraction.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveFilename(event as unknown as React.MouseEvent);
    } else if (event.key === 'Escape') {
      handleCancelEdit(event as unknown as React.MouseEvent);
    }
  };

  const handleBookmarkToggle = async (event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      const response = await toggleExtractionBookmark(extraction.id, isBookmarked);
      
      if (response && response.success) {
        const newBookmarkState = !isBookmarked;
        setIsBookmarked(newBookmarkState);
        
        if (onBookmarkToggle) {
          onBookmarkToggle(extraction.id, newBookmarkState);
        }
        
        showToast(
          newBookmarkState ? '북마크에 추가되었습니다.' : '북마크에서 제거되었습니다.',
          'success'
        );
      } else {
        showToast(
          response?.error || '북마크 상태 변경 중 오류가 발생했습니다.',
          'error'
        );
      }
    } catch (error) {
      console.error('북마크 토글 중 오류:', error);
      showToast('북마크 변경 중 오류가 발생했습니다.', 'error');
    }
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = (event: React.MouseEvent) => {
    event.stopPropagation();
    setAnchorEl(null);
  };

  return (
    <Paper
      data-extraction-id={extraction.id}
      sx={{
        p: 0,
        cursor: 'pointer',
        transition: 'background-color 0.15s',
        position: 'relative',
        bgcolor: isSelected
          ? isDark 
            ? 'rgb(30, 58, 138)' 
            : 'rgb(239, 246, 255)'
          : 'transparent',
        borderLeft: '4px solid',
        borderLeftColor: isSelected
          ? isDark 
            ? 'rgb(37, 99, 235)' 
            : 'rgb(59, 130, 246)'
          : 'transparent',
        '&:hover': {
          bgcolor: isSelected 
            ? (isDark ? 'rgb(30, 58, 138)' : 'rgb(239, 246, 255)')
            : (isDark ? 'rgb(55, 65, 81)' : 'rgb(249, 250, 251)')
        },
        mb: 1,
        boxShadow: 0
      }}
      onClick={() => {
        onSelect(extraction);
      }}
      elevation={0}
    >
      <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <IconButton 
            onClick={handleBookmarkToggle}
            size="small"
            sx={{ 
              p: 0.5, 
              mr: 0.5,
              color: isDark ? 'rgb(234, 179, 8)' : 'rgb(202, 138, 4)'
            }}
          >
            {isBookmarked ? (
              <BookmarkIcon fontSize="small" />
            ) : (
              <BookmarkBorderIcon fontSize="small" />
            )}
          </IconButton>
          
          {isEditing ? (
            <Box
              component="form"
              onSubmit={handleSaveFilename}
              onClick={(e) => e.stopPropagation()}
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <InputBase
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveFilename}
                autoFocus
                fullWidth
                sx={{ 
                  fontSize: '0.875rem', 
                  fontWeight: 500,
                  width: '100%'
                }}
              />
              <IconButton size="small" onClick={handleSaveFilename} sx={{ ml: 0.5 }}>
                <CheckIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={handleCancelEdit} sx={{ ml: 0.5 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box>
              <Typography
                variant="subtitle1"
                component="div"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  mb: 0.5,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-all'
                }}
              >
                {extraction.filename}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ 
                    fontSize: '0.75rem',
                    color: isDark ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)',
                    mr: 1.5
                  }}
                >
                  {extraction.created_at ? formatTime(extraction.created_at) : '날짜 없음'}
                </Typography>
                
                <Chip
                  label={extraction.ocr_model === 'tesseract' ? 'Tesseract' : 'Google Vision'}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    borderRadius: '4px',
                    '& .MuiChip-label': {
                      px: 1,
                      py: 0
                    },
                    bgcolor: extraction.ocr_model === 'tesseract'
                      ? (isDark ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.1)')
                      : (isDark ? 'rgba(232, 121, 249, 0.2)' : 'rgba(232, 121, 249, 0.1)'),
                    color: extraction.ocr_model === 'tesseract'
                      ? (isDark ? 'rgb(56, 189, 248)' : 'rgb(14, 165, 233)')
                      : (isDark ? 'rgb(240, 171, 252)' : 'rgb(192, 38, 211)')
                  }}
                />
                
                {extraction.source_type && (
                  <Chip
                    label={extraction.source_type}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 500,
                      borderRadius: '4px',
                      ml: 0.5,
                      '& .MuiChip-label': {
                        px: 1,
                        py: 0
                      },
                      bgcolor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                      color: isDark ? 'rgb(129, 140, 248)' : 'rgb(79, 70, 229)'
                    }}
                  />
                )}
              </Box>
            </Box>
          )}
        </Box>
        
        <Box ref={dropdownRef}>
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            sx={{ 
              fontSize: '1rem',
              color: isDark ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)',
              padding: '2px'
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleMenuClose}
            elevation={1}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            sx={{
              '& .MuiPaper-root': {
                borderRadius: 1,
                minWidth: 180,
                boxShadow: isDark
                  ? '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)'
                  : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                bgcolor: isDark ? 'rgb(31, 41, 55)' : 'background.paper',
              },
            }}
          >
            <MenuItem onClick={(e) => {
              e.stopPropagation();
              handleStartEdit(e);
            }}>
              <ListItemIcon>
                <EditIcon fontSize="small" sx={{ color: isDark ? 'rgb(156, 163, 175)' : 'rgb(75, 85, 99)' }} />
              </ListItemIcon>
              <ListItemText 
                primary="이름 변경" 
                primaryTypographyProps={{ 
                  variant: 'body2',
                  fontSize: '0.8125rem'
                }}
              />
            </MenuItem>
            
            <MenuItem onClick={(e) => {
              e.stopPropagation();
              onEditClick(extraction);
            }}>
              <ListItemIcon>
                <EditIcon fontSize="small" sx={{ color: isDark ? 'rgb(156, 163, 175)' : 'rgb(75, 85, 99)' }} />
              </ListItemIcon>
              <ListItemText 
                primary="내용 편집" 
                primaryTypographyProps={{ 
                  variant: 'body2',
                  fontSize: '0.8125rem'
                }}
              />
            </MenuItem>
            
            <MenuItem onClick={handleDelete}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" sx={{ color: isDark ? 'rgb(248, 113, 113)' : 'rgb(239, 68, 68)' }} />
              </ListItemIcon>
              <ListItemText 
                primary="삭제" 
                primaryTypographyProps={{ 
                  variant: 'body2',
                  fontSize: '0.8125rem',
                  color: isDark ? 'rgb(248, 113, 113)' : 'rgb(239, 68, 68)'
                }}
              />
            </MenuItem>
          </Menu>
        </Box>
      </Box>
      
      <Box sx={{ 
        px: 2,
        pb: 1,
        pt: 0
      }}>
        <Typography
          variant="body2"
          sx={{
            fontSize: '0.7rem',
            color: isDark ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)',
            mt: 0.5,
            lineHeight: 1.3,
            height: '2.4rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-all',
            whiteSpace: 'pre-line'
          }}
        >
          {extraction.extracted_text && extraction.extracted_text.length > 100 
            ? `${extraction.extracted_text.substring(0, 100).replace(/\n/g, ' ')}...` 
            : extraction.extracted_text ? extraction.extracted_text.replace(/\n/g, ' ') : '내용 없음'}
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center', 
          mt: 0.5,
          fontSize: '0.65rem',
          color: isDark ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box component="svg" 
              sx={{ width: '0.75rem', height: '0.75rem', mr: 0.5 }}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </Box>
            <Box component="span">
              {extraction.extracted_text ? extraction.extracted_text.length : 0}자
            </Box>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default ExtractionItem;