import React, { useMemo, useState, useCallback, useEffect, memo } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  ListItemSecondaryAction,
  useTheme,
  TextField,
  InputAdornment,
  Alert,
} from '@mui/material';
import {
  Close,
  Restore,
  DeleteOutline,
  Bookmark,
  BookmarkBorder,
  Edit as EditIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { Extraction } from '../types';
import { format, isToday, isYesterday } from 'date-fns';

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  extractions: Extraction[];
  onSelectExtraction: (extraction: Extraction) => void;
  onDeleteExtraction?: (id: number) => Promise<boolean>;
  onUpdateFilename?: (id: number, newFilename: string) => Promise<boolean>;
  onBookmarkToggle?: (id: number, isBookmarked: boolean) => Promise<boolean>;
  fetchExtractions?: (ignoreCache?: boolean) => void;
  title?: string;
  isDark?: boolean;
}

interface GroupedExtractions {
  [dateKey: string]: Extraction[];
}

interface HistoryItemProps {
  extraction: Extraction;
  isEditing: boolean;
  isDark: boolean;
  onSelect: (extraction: Extraction) => void;
  onDelete?: (id: number) => void;
  onEditStart: (extraction: Extraction) => void;
  onEditCancel: () => void;
  onFilenameSave: (newFilename: string) => Promise<void>;
  onBookmarkToggle?: (id: number, isBookmarked: boolean) => Promise<boolean>;
  onBookmarkUpdate?: (id: number, isBookmarked: boolean) => void;
}

const HistoryItem: React.FC<HistoryItemProps> = memo(({
  extraction,
  isEditing,
  isDark,
  onSelect,
  onDelete,
  onEditStart,
  onEditCancel,
  onFilenameSave,
  onBookmarkToggle,
  onBookmarkUpdate
}) => {
  const theme = useTheme();
  const [localFilename, setLocalFilename] = useState(extraction.filename || `추출 ${extraction.id}`);
  const [isBookmarked, setIsBookmarked] = useState(!!extraction.is_bookmarked);

  useEffect(() => {
    // extraction이 변경될 때마다 로컬 상태 동기화
    setLocalFilename(extraction.filename || `추출 ${extraction.id}`);
    setIsBookmarked(!!extraction.is_bookmarked);
  }, [extraction]);

  const handleSelectClick = useCallback(() => {
    if (onSelect) onSelect(extraction);
  }, [onSelect, extraction]);

  const handleDeleteClick = useCallback(() => {
    if (onDelete && extraction.id !== undefined) onDelete(extraction.id);
  }, [onDelete, extraction.id]);

  const handleEditStartClick = useCallback(() => {
    if (onEditStart) onEditStart(extraction);
  }, [onEditStart, extraction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
     if (e.key === 'Enter') onFilenameSave(localFilename);
     if (e.key === 'Escape') onEditCancel();
  }, [onFilenameSave, onEditCancel, localFilename]);

  const handleLocalSave = useCallback(async () => {
    await onFilenameSave(localFilename);
  }, [onFilenameSave, localFilename]);

  const handleBookmarkToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBookmarkToggle && extraction.id !== undefined) {
      try {
        const success = await onBookmarkToggle(extraction.id, isBookmarked);
        if (success) {
          const newBookmarkState = !isBookmarked;
          setIsBookmarked(newBookmarkState);
          // 북마크 변경 시 부모 컴포넌트에 알림
          if (onBookmarkUpdate) {
            onBookmarkUpdate(extraction.id, newBookmarkState);
          }
        }
      } catch (error) {
        console.error("북마크 토글 중 오류:", error);
      }
    }
  }, [onBookmarkToggle, extraction.id, isBookmarked, onBookmarkUpdate]);

  return (
    <ListItem
      sx={{
        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : theme.palette.divider}`,
        '&:hover': { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : theme.palette.action.hover },
        pt: 1.5, pb: 1.5, pl: 2,
        pr: isEditing ? 2 : 10
      }}
    >
      {isEditing ? (
        <TextField
          variant="standard"
          value={localFilename}
          onChange={(e) => setLocalFilename(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          fullWidth
          sx={{ mt: -0.5, mb: -0.5 }}
          InputProps={{
            sx: { fontSize: 'inherit', fontWeight: 500 },
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleLocalSave} size="small" sx={{ color: theme.palette.success.light }}>
                  <CheckIcon fontSize="inherit" />
                </IconButton>
                <IconButton onClick={onEditCancel} size="small" sx={{ color: theme.palette.error.light }}>
                  <CancelIcon fontSize="inherit" />
                </IconButton>
              </InputAdornment>
            )
          }}
        />
      ) : (
        <ListItemText
          primary={extraction.filename || `추출 ${extraction.id}`}
          secondary={`${format(new Date(extraction.created_at || new Date().toISOString()), 'HH:mm')} (${extraction.ocr_model || extraction.source_type || 'N/A'})`}
          primaryTypographyProps={{ noWrap: true, sx: { fontWeight: 500, color: isDark ? theme.palette.text.primary : 'inherit' } }}
          secondaryTypographyProps={{ noWrap: true, sx: { color: isDark ? theme.palette.text.secondary : 'inherit', fontSize: '0.8rem' } }}
        />
      )}
      {!isEditing && (
        <ListItemSecondaryAction sx={{ right: 8, display: 'flex', alignItems: 'center' }}>
          <Tooltip title={isBookmarked ? "북마크 제거" : "북마크 추가"}>
            <IconButton 
              edge="end" 
              aria-label={isBookmarked ? "bookmarked" : "bookmark"} 
              onClick={handleBookmarkToggle}
              sx={{ color: isDark ? theme.palette.warning.light : theme.palette.warning.main, mr: 0.5 }} 
              size="small"
            >
              {isBookmarked ? <Bookmark fontSize="small" /> : <BookmarkBorder fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="파일명 수정">
            <IconButton edge="end" aria-label="edit" onClick={handleEditStartClick} sx={{ color: isDark ? theme.palette.grey[400] : theme.palette.grey[600], mr: 0.5 }} size="small">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="불러오기">
            <IconButton edge="end" aria-label="load" onClick={handleSelectClick} sx={{ color: isDark ? theme.palette.info.light : theme.palette.info.main, mr: 0.5 }} size="small">
              <Restore fontSize="small" />
            </IconButton>
          </Tooltip>
          {onDelete && (
            <Tooltip title="삭제">
               <IconButton edge="end" aria-label="delete" onClick={handleDeleteClick} sx={{ color: isDark ? theme.palette.error.light : theme.palette.error.main }} size="small">
                 <DeleteOutline fontSize="small" />
               </IconButton>
            </Tooltip>
          )}
        </ListItemSecondaryAction>
      )}
    </ListItem>
  );
});

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  open,
  onClose,
  extractions,
  onSelectExtraction,
  onDeleteExtraction,
  onUpdateFilename,
  onBookmarkToggle,
  fetchExtractions,
  title = '추출 내역',
  isDark = false,
}) => {
  const theme = useTheme();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  // 로컬에서 사용할 추출 데이터 상태 추가
  const [localExtractions, setLocalExtractions] = useState<Extraction[]>([]);
  
  // extractions가 변경될 때마다 localExtractions 업데이트
  useEffect(() => {
    setLocalExtractions(extractions);
  }, [extractions]);
  
  // 패널이 열릴 때마다 데이터 최신화
  const refreshData = useCallback(() => {
    if (fetchExtractions) {
      try {
        fetchExtractions(true); // 캐시 무시하고 가져오기
      } catch (error) {
        console.error('새로고침 중 오류:', error);
      }
    }
  }, [fetchExtractions]);
  
  useEffect(() => {
    if (open) {
      refreshData();
    }
  }, [open, refreshData]);

  const handleSelect = useCallback((extraction: Extraction) => {
     onSelectExtraction(extraction);
     onClose();
  }, [onSelectExtraction, onClose]);

  const handleDelete = useCallback(async (id: number) => {
    if (onDeleteExtraction) {
      try {
        await onDeleteExtraction(id);
        if (editingId === id) {
            setEditingId(null);
        }
      } catch (error) {
        console.error("히스토리 항목 삭제 오류:", error);
      }
    }
  }, [onDeleteExtraction, editingId]);

  const handleEditStart = useCallback((extraction: Extraction) => {
    setEditingId(extraction.id);
    setUpdateError(null);
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setUpdateError(null);
  }, []);

  const handleFilenameSave = useCallback(async (newFilenameToSave: string) => {
    if (editingId !== null && newFilenameToSave.trim() && onUpdateFilename) {
      try {
        setUpdateError(null);
        const success = await onUpdateFilename(editingId, newFilenameToSave.trim());
        if (success) {
          // 서버 응답 전에 로컬 상태 먼저 업데이트
          setLocalExtractions(prev => 
            prev.map(item => 
              item.id === editingId ? { ...item, filename: newFilenameToSave.trim() } : item
            )
          );
          
          setEditingId(null);
          
          // 서버 동기화는 유지하되, 로컬 상태를 덮어쓰지 않도록 함
          if (fetchExtractions) {
            try {
              // 백그라운드에서 조용히 동기화
              const currentExtractions = [...localExtractions];
              // fetchExtractions 실행 - Promise 반환하지 않음
              fetchExtractions(true);
              // extractions가 업데이트되면 useEffect에서 localExtractions를 업데이트하므로
              // 다음 렌더링 사이클에서 currentExtractions 값으로 다시 설정
              setTimeout(() => {
                setLocalExtractions(prev => {
                  const updatedItem = prev.find(item => item.id === editingId);
                  // 이미 서버에서 업데이트된 값이 있다면 유지, 없으면 로컬 값 사용
                  return currentExtractions.map(item => 
                    item.id === editingId && updatedItem 
                      ? { ...item, filename: updatedItem.filename || newFilenameToSave.trim() }
                      : item
                  );
                });
              }, 100); // 짧은 딜레이 후 로컬 상태 복원
            } catch (refreshError) {
              console.error("서버 동기화 중 오류:", refreshError);
            }
          }
        } else {
          setUpdateError("파일명 업데이트에 실패했습니다. 다시 시도해 주세요.");
          console.error("파일명 업데이트 실패 (API), 수정 모드 유지");
        }
      } catch (error) {
        setUpdateError("파일명 업데이트 중 오류가 발생했습니다.");
        console.error("파일명 업데이트 중 오류 발생:", error);
      }
    } else if (editingId !== null && !newFilenameToSave.trim()) {
       setUpdateError("파일명은 비워둘 수 없습니다.");
       console.warn("파일명은 비워둘 수 없습니다.");
    } else {
       handleEditCancel();
    }
  }, [editingId, onUpdateFilename, handleEditCancel, fetchExtractions, localExtractions]);

  // 북마크 업데이트 핸들러 추가
  const handleBookmarkUpdate = useCallback((id: number, isBookmarked: boolean) => {
    // 로컬 상태 업데이트
    setLocalExtractions(prev => 
      prev.map(item => 
        item.id === id ? { ...item, is_bookmarked: isBookmarked } : item
      )
    );
  }, []);

  const groupedExtractions = useMemo(() => {
    const groups: GroupedExtractions = {};
    const sorted = [...localExtractions].sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    sorted.forEach((extraction) => {
      try {
        // 날짜 객체를 생성하고 로컬 날짜로 변환
        const date = new Date(extraction.created_at || new Date().toISOString());
        const dateKey = format(date, 'yyyy-MM-dd');
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(extraction);
      } catch (e) {
        console.error("날짜 파싱 오류:", e, extraction.created_at);
        if (!groups['unknown']) groups['unknown'] = [];
        groups['unknown'].push(extraction);
      }
    });
    return groups;
  }, [localExtractions]);

  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedExtractions).sort((a, b) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedExtractions]);

  const formatGroupDate = (dateKey: string): string => {
    if (dateKey === 'unknown') return '날짜 알 수 없음';
    try {
      const date = new Date(dateKey);
      if (isToday(date)) return '오늘';
      if (isYesterday(date)) return '어제';
      return format(date, 'yyyy년 M월 d일 (eee)');
    } catch (e) {
      console.error("그룹 날짜 포맷 오류:", e);
      return dateKey;
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400 },
          backgroundColor: isDark ? theme.palette.background.default : theme.palette.background.paper,
          borderLeft: isDark ? `1px solid ${theme.palette.divider}` : undefined
        }
      }}
    >
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="div" sx={{ color: isDark ? theme.palette.text.primary : 'inherit' }}>
          {title}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: isDark ? theme.palette.text.primary : 'inherit' }}>
          <Close />
        </IconButton>
      </Box>
      <Divider sx={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : undefined }}/>
      
      {updateError && (
        <Alert severity="error" sx={{ m: 2 }} onClose={() => setUpdateError(null)}>
          {updateError}
        </Alert>
      )}
      
      <List sx={{ overflowY: 'auto', flexGrow: 1, p: 0 }}>
        {localExtractions.length === 0 ? (
          <ListItem>
            <ListItemText primary="내역이 없습니다." sx={{ textAlign: 'center', color: theme.palette.text.secondary }} />
          </ListItem>
        ) : (
          sortedDateKeys.map(dateKey => (
            <React.Fragment key={dateKey}>
              <ListItem sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.palette.grey[100], py: 0.5, position: 'sticky', top: 0, zIndex: 1 }}>
                <ListItemText primary={formatGroupDate(dateKey)} primaryTypographyProps={{ variant: 'caption', sx: { fontWeight: 'bold', color: isDark ? theme.palette.text.secondary : theme.palette.text.primary }}}/>
              </ListItem>
              {groupedExtractions[dateKey].map((extraction) => (
                <HistoryItem
                  key={extraction.id}
                  extraction={extraction}
                  isEditing={editingId === extraction.id}
                  isDark={isDark}
                  onSelect={handleSelect}
                  onDelete={onDeleteExtraction ? handleDelete : undefined}
                  onEditStart={handleEditStart}
                  onEditCancel={handleEditCancel}
                  onFilenameSave={handleFilenameSave}
                  onBookmarkToggle={onBookmarkToggle}
                  onBookmarkUpdate={handleBookmarkUpdate}
                />
              ))}
            </React.Fragment>
          ))
        )}
      </List>
    </Drawer>
  );
};

export default HistoryPanel;