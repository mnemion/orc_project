import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Grid,
  SelectChangeEvent,
  Paper
} from '@mui/material';
import { SUPPORTED_LANGUAGES, DEFAULT_IMAGE_QUALITY, DEFAULT_IMAGE_ZOOM } from '../constants/ocr';

interface OcrSettingsPanelProps {
  selectedModel: string;
  selectedLanguage: string;
  imageQuality: number;
  imageZoom: number;
  onModelChange: (model: string) => void;
  onLanguageChange: (language: string) => void;
  onImageQualityChange: (quality: number) => void;
  onImageZoomChange: (zoom: number) => void;
  isDark?: boolean;
}

/**
 * OCR 설정 패널 컴포넌트
 */
const OcrSettingsPanel: React.FC<OcrSettingsPanelProps> = ({
  selectedModel,
  selectedLanguage,
  imageQuality = DEFAULT_IMAGE_QUALITY,
  imageZoom = DEFAULT_IMAGE_ZOOM,
  onModelChange,
  onLanguageChange,
  onImageQualityChange,
  onImageZoomChange,
  isDark = false
}) => {
  // 모델 변경 핸들러
  const handleModelChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    onModelChange(value);
  };

  // 언어 변경 핸들러
  const handleLanguageChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    onLanguageChange(value);
  };

  // 이미지 품질 변경 핸들러
  const handleImageQualityChange = (_: Event, newValue: number | number[]) => {
    onImageQualityChange(newValue as number);
  };

  // 이미지 확대/축소 변경 핸들러
  const handleImageZoomChange = (_: Event, newValue: number | number[]) => {
    onImageZoomChange(newValue as number);
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2, 
        borderRadius: 1,
        bgcolor: isDark ? 'rgba(18, 18, 18, 0.7)' : 'rgba(0, 0, 0, 0.02)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
        color: isDark ? 'text.primary' : 'inherit'
      }}
    >
      <Typography 
        variant="subtitle2" 
        component="h3" 
        gutterBottom
        sx={{
          color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'inherit',
          mb: 2
        }}
      >
        OCR 설정
      </Typography>

      <Grid container spacing={3}>
        {/* OCR 모델 선택 */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl 
            fullWidth 
            size="small"
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.23)' : undefined
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.4)' : undefined
              }
            }}
          >
            <InputLabel 
              id="ocr-model-label"
              sx={{
                color: isDark ? 'rgba(255, 255, 255, 0.7)' : undefined,
                '&.Mui-focused': {
                  color: isDark ? 'rgba(144, 202, 249, 0.9)' : undefined
                }
              }}
            >
              OCR 모델
            </InputLabel>
            <Select
              labelId="ocr-model-label"
              id="ocr-model"
              value={selectedModel}
              label="OCR 모델"
              onChange={handleModelChange}
              sx={{
                color: isDark ? 'rgba(255, 255, 255, 0.9)' : undefined,
                '& .MuiSvgIcon-root': {
                  color: isDark ? 'rgba(255, 255, 255, 0.7)' : undefined
                }
              }}
            >
              <MenuItem value="tesseract">Tesseract OCR</MenuItem>
              <MenuItem value="google">Google Vision AI</MenuItem>
              <MenuItem value="azure">Microsoft Azure OCR</MenuItem>
              <MenuItem value="gemini">Gemini 2.0</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* 언어 선택 */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl 
            fullWidth 
            size="small"
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.23)' : undefined
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.4)' : undefined
              }
            }}
          >
            <InputLabel 
              id="ocr-language-label"
              sx={{
                color: isDark ? 'rgba(255, 255, 255, 0.7)' : undefined,
                '&.Mui-focused': {
                  color: isDark ? 'rgba(144, 202, 249, 0.9)' : undefined
                }
              }}
            >
              언어
            </InputLabel>
            <Select
              labelId="ocr-language-label"
              id="ocr-language"
              value={selectedLanguage}
              label="언어"
              onChange={handleLanguageChange}
              sx={{
                color: isDark ? 'rgba(255, 255, 255, 0.9)' : undefined,
                '& .MuiSvgIcon-root': {
                  color: isDark ? 'rgba(255, 255, 255, 0.7)' : undefined
                }
              }}
            >
              {SUPPORTED_LANGUAGES.map((language) => (
                <MenuItem key={language.code} value={language.code}>
                  {language.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* 이미지 품질 슬라이더 */}
        <Grid item xs={12} sm={6} md={3}>
          <Box>
            <Typography 
              variant="caption" 
              id="image-quality-slider"
              sx={{
                color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                mb: 1,
                display: 'block'
              }}
            >
              이미지 품질
            </Typography>
            <Slider
              size="small"
              value={imageQuality}
              min={10}
              max={100}
              step={5}
              aria-labelledby="image-quality-slider"
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              onChange={handleImageQualityChange}
              sx={{
                color: isDark ? 'rgba(144, 202, 249, 0.7)' : undefined,
                '& .MuiSlider-thumb': {
                  bgcolor: isDark ? 'rgba(144, 202, 249, 0.9)' : undefined
                },
                '& .MuiSlider-track': {
                  bgcolor: isDark ? 'rgba(144, 202, 249, 0.7)' : undefined
                },
                '& .MuiSlider-rail': {
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.2)' : undefined
                }
              }}
            />
          </Box>
        </Grid>

        {/* 이미지 확대/축소 슬라이더 */}
        <Grid item xs={12} sm={6} md={3}>
          <Box>
            <Typography 
              variant="caption" 
              id="image-zoom-slider"
              sx={{
                color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                mb: 1,
                display: 'block'
              }}
            >
              이미지 확대/축소
            </Typography>
            <Slider
              size="small"
              value={imageZoom}
              min={0.5}
              max={2.0}
              step={0.1}
              aria-labelledby="image-zoom-slider"
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}x`}
              onChange={handleImageZoomChange}
              sx={{
                color: isDark ? 'rgba(144, 202, 249, 0.7)' : undefined,
                '& .MuiSlider-thumb': {
                  bgcolor: isDark ? 'rgba(144, 202, 249, 0.9)' : undefined
                },
                '& .MuiSlider-track': {
                  bgcolor: isDark ? 'rgba(144, 202, 249, 0.7)' : undefined
                },
                '& .MuiSlider-rail': {
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.2)' : undefined
                }
              }}
            />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default OcrSettingsPanel; 