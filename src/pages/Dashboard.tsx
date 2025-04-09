import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Grid, 
  Card, 
  CardContent, 
  CardActions, 
  Button, 
  Typography, 
  Box 
} from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import TableChartIcon from '@mui/icons-material/TableChart';
import TranslateIcon from '@mui/icons-material/Translate';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Layout from '../components/Layout';

const featureCards = [
  {
    title: 'OCR 텍스트 추출',
    description: '이미지에서 텍스트를 추출합니다',
    icon: <InsertDriveFileIcon fontSize="large" />,
    path: '/ocr',
    color: '#3f51b5'
  },
  {
    title: 'PDF 텍스트 추출',
    description: 'PDF 파일에서 텍스트를 추출합니다',
    icon: <PictureAsPdfIcon fontSize="large" />,
    path: '/pdf-extraction',
    color: '#f44336'
  },
  {
    title: '텍스트 요약',
    description: '긴 텍스트를 요약합니다',
    icon: <LibraryBooksIcon fontSize="large" />,
    path: '/summarize',
    color: '#009688'
  },
  {
    title: '언어 감지 및 번역',
    description: '텍스트의 언어를 감지하고 번역합니다',
    icon: <TranslateIcon fontSize="large" />,
    path: '/translation',
    color: '#ff9800'
  },
  {
    title: '표 데이터 추출',
    description: '이미지에서 표 데이터를 추출합니다',
    icon: <TableChartIcon fontSize="large" />,
    path: '/table-extraction',
    color: '#673ab7'
  },
  {
    title: '명함 인식',
    description: '명함 이미지에서 정보를 추출합니다',
    icon: <ContactMailIcon fontSize="large" />,
    path: '/business-card',
    color: '#4caf50'
  },
  {
    title: '영수증 분석',
    description: '영수증 이미지에서 정보를 추출합니다',
    icon: <ReceiptLongIcon fontSize="large" />,
    path: '/receipt-analysis',
    color: '#2196f3'
  }
];

const Dashboard: React.FC = () => {
    return (
        <Layout>
            <div className="container mx-auto px-4 py-6">
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        OCR 기능 모음
                    </Typography>
                    <Typography variant="body1" color="text.secondary" paragraph>
                        다양한 OCR 기능을 사용하여 이미지, PDF 및 문서에서 정보를 추출하고 처리하세요.
                    </Typography>
                    
                    <Grid container spacing={3} sx={{ mt: 2 }}>
                        {featureCards.map((card, index) => (
                            <Grid item xs={12} sm={6} md={4} key={index}>
                                <Card 
                                    sx={{ 
                                        height: '100%', 
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        transition: 'transform 0.3s, box-shadow 0.3s',
                                        '&:hover': {
                                            transform: 'translateY(-5px)',
                                            boxShadow: 6
                                        }
                                    }}
                                >
                                    <Box 
                                        sx={{ 
                                            p: 2,
                                            backgroundColor: card.color,
                                            color: 'white',
                                            display: 'flex',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {card.icon}
                                    </Box>
                                    <CardContent sx={{ flexGrow: 1 }}>
                                        <Typography variant="h6" component="h2" gutterBottom>
                                            {card.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {card.description}
                                        </Typography>
                                    </CardContent>
                                    <CardActions>
                                        <Button 
                                            component={Link} 
                                            to={card.path} 
                                            variant="contained" 
                                            fullWidth
                                            sx={{ backgroundColor: card.color }}
                                        >
                                            사용하기
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </div>
        </Layout>
    );
};

export default Dashboard;