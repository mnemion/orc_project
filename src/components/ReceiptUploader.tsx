import React, { useState, useRef } from 'react';
import { 
  Box, 
  Button, 
  CircularProgress, 
  Typography, 
  Paper, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormHelperText,
  SelectChangeEvent
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface ReceiptUploaderProps {
  onUpload: (file: File, ocrModel: string) => void;
  isLoading: boolean;
}

const ReceiptUploader: React.FC<ReceiptUploaderProps> = ({ onUpload, isLoading }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [ocrModel, setOcrModel] = useState<string>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };

  const handleOcrModelChange = (e: SelectChangeEvent) => {
    setOcrModel(e.target.value);
  };

  const handleFile = (file: File) => {
    // 이미지 미리보기 생성
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // 상위 컴포넌트로 파일 전달
    onUpload(file, ocrModel);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Paper 
      elevation={3}
      sx={{ 
        padding: 3,
        marginBottom: 3,
        textAlign: 'center'
      }}
    >
      <Box
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          border: '2px dashed',
          borderColor: dragActive ? 'primary.main' : 'grey.400',
          borderRadius: 2,
          padding: 3,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: dragActive ? 'action.hover' : 'background.paper',
          transition: 'all 0.3s',
          mb: 2
        }}
        onClick={handleButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        
        {previewUrl ? (
          <Box sx={{ position: 'relative' }}>
            <img 
              src={previewUrl} 
              alt="영수증 미리보기" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '300px',
                opacity: isLoading ? 0.5 : 1
              }} 
            />
            {isLoading && (
              <CircularProgress 
                sx={{ 
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)'
                }} 
              />
            )}
          </Box>
        ) : (
          <>
            <CloudUploadIcon fontSize="large" color="primary" />
            <Typography variant="h6" sx={{ mt: 2 }}>
              영수증 이미지를 끌어다 놓거나 클릭하여 업로드하세요
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              지원 형식: JPG, PNG, JPEG, GIF
            </Typography>
          </>
        )}
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="ocr-model-label">OCR 엔진 선택</InputLabel>
          <Select
            labelId="ocr-model-label"
            value={ocrModel}
            label="OCR 엔진 선택"
            onChange={handleOcrModelChange}
            size="small"
            disabled={isLoading}
          >
            <MenuItem value="auto">자동 (추천)</MenuItem>
            <MenuItem value="gemini">Gemini AI (한국어 인식 향상)</MenuItem>
            <MenuItem value="tesseract">Tesseract OCR</MenuItem>
          </Select>
          <FormHelperText>한국어 텍스트 인식 향상을 위해 Gemini AI 권장</FormHelperText>
        </FormControl>
      </Box>
      
      <Button
        variant="contained"
        onClick={handleButtonClick}
        disabled={isLoading}
        startIcon={isLoading ? <CircularProgress size={24} /> : <CloudUploadIcon />}
      >
        영수증 이미지 선택
      </Button>
    </Paper>
  );
};

export default ReceiptUploader; 