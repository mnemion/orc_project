import React from 'react';
import { Dialog, DialogContent } from '@mui/material';
import ImageCropper from './ImageCropper';

interface OcrImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImage: string | null;
  onCropComplete: (croppedImg: string) => void;
  isDark?: boolean;
}

/**
 * OCR 이미지 편집 다이얼로그 컴포넌트
 */
const OcrImageEditor: React.FC<OcrImageEditorProps> = ({
  isOpen,
  onClose,
  selectedImage,
  onCropComplete,
  isDark = false
}) => {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: isDark ? 'rgba(25, 25, 25, 0.95)' : 'background.paper',
          borderRadius: 2,
          boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.5)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          backgroundImage: 'none' // Remove default Dialog background pattern in Material UI
        }
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          height: 'calc(100vh - 200px)',
          minHeight: 400,
          maxHeight: 800,
          bgcolor: isDark ? 'rgba(18, 18, 18, 0.95)' : 'background.paper',
          '&:first-of-type': {
            pt: 0
          }
        }}
      >
        {selectedImage && (
          <ImageCropper
            image={selectedImage}
            onCropComplete={onCropComplete}
            onCancel={onClose}
            isDark={isDark}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OcrImageEditor; 