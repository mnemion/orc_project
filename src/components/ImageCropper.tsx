import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Box, Slider, Button, Typography, Paper, IconButton } from '@mui/material';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import CropIcon from '@mui/icons-material/Crop';
import CloseIcon from '@mui/icons-material/Close';
import { useTheme } from '../contexts/ThemeContext';

// 영역 타입 정의
interface Area {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ImageCropperProps {
    image: string;
    onCropComplete: (croppedImage: string) => void;
    onCancel: () => void;
    aspectRatio?: number;
    isDark?: boolean;
}

// 이미지에서 크롭 영역을 추출하여 Data URL로 반환
const createImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.src = url;
    });
};

/**
 * 이미지 크롭 및 회전 처리
 */
async function getCroppedImg(
    imageSrc: string, 
    pixelCrop: Area, 
    rotation = 0
): Promise<string> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Canvas 2D context is not available');
    }

    // 회전을 위한 캔버스 설정
    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    // 캔버스 크기 설정
    canvas.width = safeArea;
    canvas.height = safeArea;

    // 캔버스 중앙으로 이동
    ctx.translate(safeArea / 2, safeArea / 2);
    // 회전 적용
    ctx.rotate((rotation * Math.PI) / 180);
    // 이미지 그리기
    ctx.translate(-safeArea / 2, -safeArea / 2);
    ctx.drawImage(
        image,
        safeArea / 2 - image.width * 0.5,
        safeArea / 2 - image.height * 0.5
    );

    // 크롭 영역 좌표 계산
    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    // 결과 캔버스 설정
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // 크롭된 이미지 그리기
    ctx.putImageData(
        data,
        Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
        Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
    );

    // 결과 이미지 Data URL로 반환
    return canvas.toDataURL('image/jpeg', 0.9);
}

// 이미지 크롭 컴포넌트
const ImageCropper: React.FC<ImageCropperProps> = ({
    image,
    onCropComplete,
    onCancel,
    aspectRatio = 1,
    isDark
}) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    
    // 컨텍스트에서 테마 가져오기 (props로 전달된 isDark가 없을 경우)
    const { theme } = useTheme();
    const darkMode = isDark !== undefined ? isDark : theme === 'dark';

    // 크롭 영역 업데이트
    const onCropChange = useCallback((location: { x: number; y: number }) => {
        setCrop(location);
    }, []);

    // 확대/축소 업데이트
    const onZoomChange = useCallback((zoomValue: number) => {
        setZoom(zoomValue);
    }, []);

    // 크롭 완료 시 크롭 영역 저장
    const onCropCompleteCallback = useCallback((_: Area, croppedAreaPixelsValue: Area) => {
        setCroppedAreaPixels(croppedAreaPixelsValue);
    }, []);

    // 이미지 회전 (왼쪽)
    const rotateLeft = useCallback(() => {
        setRotation((prevRotation) => (prevRotation - 90) % 360);
    }, []);

    // 이미지 회전 (오른쪽)
    const rotateRight = useCallback(() => {
        setRotation((prevRotation) => (prevRotation + 90) % 360);
    }, []);

    // 크롭 적용
    const applyCrop = useCallback(async () => {
        if (!croppedAreaPixels) return;

        try {
            const croppedImageUrl = await getCroppedImg(image, croppedAreaPixels, rotation);
            onCropComplete(croppedImageUrl);
        } catch (e) {
            console.error('Error cropping image:', e);
        }
    }, [croppedAreaPixels, rotation, image, onCropComplete]);

    return (
        <Paper 
            elevation={0} 
            sx={{ 
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                bgcolor: darkMode ? 'rgba(18, 18, 18, 0.95)' : 'background.paper',
                color: darkMode ? 'text.primary' : 'inherit',
                border: 'none'
            }}
        >
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: 2,
                p: 2,
                borderBottom: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)'
            }}>
                <Typography 
                    variant="h6" 
                    sx={{ 
                        color: darkMode ? 'rgba(255, 255, 255, 0.9)' : 'text.primary',
                        fontWeight: 500
                    }}
                >
                    이미지 편집
                </Typography>
                <IconButton 
                    onClick={onCancel}
                    sx={{
                        color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                        '&:hover': {
                            bgcolor: darkMode ? 'rgba(255, 255, 255, 0.08)' : undefined
                        }
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>
            
            <Box sx={{ 
                position: 'relative', 
                height: 'calc(100% - 200px)', 
                minHeight: '300px', 
                mb: 2,
                bgcolor: darkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.02)'
            }}>
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={aspectRatio}
                    onCropChange={onCropChange}
                    onCropComplete={onCropCompleteCallback}
                    onZoomChange={onZoomChange}
                    objectFit="contain"
                />
            </Box>
            
            <Box sx={{ mb: 2, px: 3 }}>
                <Typography 
                    gutterBottom
                    sx={{
                        color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'
                    }}
                >
                    확대/축소
                </Typography>
                <Slider
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="zoom-slider"
                    onChange={(_, value) => onZoomChange(value as number)}
                    sx={{
                        color: darkMode ? 'rgba(144, 202, 249, 0.7)' : 'primary.main',
                        '& .MuiSlider-thumb': {
                            bgcolor: darkMode ? 'rgba(144, 202, 249, 0.9)' : undefined
                        },
                        '& .MuiSlider-track': {
                            bgcolor: darkMode ? 'rgba(144, 202, 249, 0.7)' : undefined
                        },
                        '& .MuiSlider-rail': {
                            bgcolor: darkMode ? 'rgba(255, 255, 255, 0.2)' : undefined
                        }
                    }}
                />
            </Box>
            
            <Box sx={{ mb: 3, px: 3 }}>
                <Typography 
                    gutterBottom
                    sx={{
                        color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary'
                    }}
                >
                    회전
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <IconButton 
                        onClick={rotateLeft}
                        sx={{
                            color: darkMode ? 'rgba(144, 202, 249, 0.9)' : 'primary.main',
                            '&:hover': {
                                bgcolor: darkMode ? 'rgba(144, 202, 249, 0.08)' : undefined
                            }
                        }}
                    >
                        <RotateLeftIcon />
                    </IconButton>
                    
                    <Typography sx={{ color: darkMode ? 'rgba(255, 255, 255, 0.9)' : 'text.primary' }}>
                        {rotation}°
                    </Typography>
                    
                    <IconButton 
                        onClick={rotateRight}
                        sx={{
                            color: darkMode ? 'rgba(144, 202, 249, 0.9)' : 'primary.main',
                            '&:hover': {
                                bgcolor: darkMode ? 'rgba(144, 202, 249, 0.08)' : undefined
                            }
                        }}
                    >
                        <RotateRightIcon />
                    </IconButton>
                </Box>
            </Box>
            
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: 2, 
                p: 2,
                borderTop: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)'
            }}>
                <Button 
                    variant="outlined" 
                    onClick={onCancel}
                    sx={{
                        color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'text.secondary',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.3)' : undefined,
                        '&:hover': {
                            borderColor: darkMode ? 'rgba(255, 255, 255, 0.5)' : undefined,
                            bgcolor: darkMode ? 'rgba(255, 255, 255, 0.08)' : undefined
                        }
                    }}
                >
                    취소
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={applyCrop}
                    startIcon={<CropIcon />}
                    sx={{
                        bgcolor: darkMode ? 'rgba(25, 118, 210, 0.8)' : undefined,
                        '&:hover': {
                            bgcolor: darkMode ? 'rgba(25, 118, 210, 1)' : undefined
                        }
                    }}
                >
                    적용하기
                </Button>
            </Box>
        </Paper>
    );
};

export default ImageCropper;