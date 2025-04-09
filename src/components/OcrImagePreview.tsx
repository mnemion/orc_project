import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography
} from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CropIcon from '@mui/icons-material/Crop';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface OcrImagePreviewProps {
  previewUrl: string | null;
  imageZoom: number;
  isEditable: boolean;
  isProcessing: boolean;
  onZoomChange: (zoom: number) => void;
  onImageEdit: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isDark?: boolean;
}

const OcrImagePreview: React.FC<OcrImagePreviewProps> = ({
  previewUrl,
  imageZoom,
  isEditable,
  isProcessing,
  onZoomChange,
  onImageEdit,
  onFileSelect,
  isDark = false
}) => {
  const handleZoomIn = () => {
    if (imageZoom < 2.0) {
      onZoomChange(Math.min(imageZoom + 0.1, 2.0));
    }
  };

  const handleZoomOut = () => {
    if (imageZoom > 0.5) {
      onZoomChange(Math.max(imageZoom - 0.1, 0.5));
    }
  };

  if (!previewUrl) {
    return (
      <Paper 
        elevation={1} 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center',
          p: 3,
          minHeight: 300,
          bgcolor: isDark ? 'rgba(30, 30, 30, 0.9)' : 'background.paper',
          color: isDark ? 'text.primary' : 'inherit',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : 'none'
        }}
      >
        {isProcessing ? (
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress 
              size={40} 
              thickness={4} 
              sx={{ color: isDark ? '#90caf9' : 'primary.main' }}
            />
            <Typography 
              variant="body1" 
              color={isDark ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'} 
              sx={{ mt: 2 }}
            >
              이미지 처리 중...
            </Typography>
          </Box>
        ) : (
          <>
            <CloudUploadIcon 
              sx={{ 
                fontSize: 48, 
                color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'text.secondary', 
                mb: 2 
              }} 
            />
            <Typography 
              variant="body1" 
              gutterBottom 
              sx={{ 
                mb: 2, 
                color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'inherit' 
              }}
            >
              이미지를 업로드하여 텍스트를 추출하세요
            </Typography>
            <Button 
              variant="contained" 
              component="label" 
              startIcon={<CloudUploadIcon />}
              sx={{
                bgcolor: isDark ? 'rgba(25, 118, 210, 0.8)' : undefined,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(25, 118, 210, 1)' : undefined
                }
              }}
            >
              이미지 업로드
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={onFileSelect}
              />
            </Button>
          </>
        )}
      </Paper>
    );
  }

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden',
        bgcolor: isDark ? 'rgba(30, 30, 30, 0.9)' : 'background.paper',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : 'none'
      }}
    >
      <Box 
        sx={{ 
          height: '100%',
          width: '100%',
          minHeight: 300,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: 2,
          bgcolor: isDark ? 'rgba(18, 18, 18, 0.7)' : undefined
        }}
      >
        <img 
          src={previewUrl} 
          alt="OCR 이미지"
          style={{ 
            maxWidth: '100%',
            transform: `scale(${imageZoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-in-out'
          }}
        />
      </Box>

      <Box 
        sx={{ 
          position: 'absolute', 
          bottom: 16, 
          right: 16, 
          zIndex: 2,
          display: 'flex',
          gap: 1,
          bgcolor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)',
          borderRadius: 1,
          p: 0.5
        }}
      >
        <Button
          size="small"
          variant="outlined"
          onClick={handleZoomOut}
          disabled={imageZoom <= 0.5}
          sx={{ 
            minWidth: 'auto', 
            px: 1,
            color: isDark ? 'rgba(255, 255, 255, 0.8)' : undefined,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : undefined,
            '&:hover': {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.8)' : undefined,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : undefined
            }
          }}
        >
          <ZoomOutIcon fontSize="small" />
        </Button>
        
        <Button
          size="small"
          variant="outlined"
          onClick={handleZoomIn}
          disabled={imageZoom >= 2.0}
          sx={{ 
            minWidth: 'auto', 
            px: 1,
            color: isDark ? 'rgba(255, 255, 255, 0.8)' : undefined,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : undefined,
            '&:hover': {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.8)' : undefined,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : undefined
            }
          }}
        >
          <ZoomInIcon fontSize="small" />
        </Button>
        
        {isEditable && (
          <Button
            size="small"
            variant="outlined"
            onClick={onImageEdit}
            sx={{ 
              minWidth: 'auto', 
              px: 1,
              color: isDark ? 'rgba(255, 255, 255, 0.8)' : undefined,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : undefined,
              '&:hover': {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.8)' : undefined,
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : undefined
              }
            }}
          >
            <CropIcon fontSize="small" />
          </Button>
        )}
      </Box>

      {isProcessing && (
        <Box 
          sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3
          }}
        >
          <CircularProgress 
            size={40} 
            thickness={4} 
            sx={{ color: isDark ? '#90caf9' : 'primary.main' }}
          />
          <Typography 
            variant="body1" 
            sx={{ 
              mt: 2,
              color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'inherit'
            }}
          >
            이미지 처리 중...
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default OcrImagePreview; 