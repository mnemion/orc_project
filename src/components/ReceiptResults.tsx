import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Grid,
  Divider,
  Card,
  CardContent,
  Button
} from '@mui/material';
import { ReceiptAnalysisResult } from '../types/receipt';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface ReceiptResultsProps {
  result: ReceiptAnalysisResult;
}

const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined) return '-';
  return amount.toLocaleString('ko-KR') + '원';
};

const paymentMethodMap: Record<string, string> = {
  'card': '카드',
  'cash': '현금',
  'bank': '계좌이체',
  'mobile': '모바일결제'
};

const ReceiptResults: React.FC<ReceiptResultsProps> = ({ result }) => {
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  if (!result.success) {
    return (
      <Paper sx={{ p: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
        <Typography variant="h6">영수증 분석 실패</Typography>
        <Typography>{result.error || '알 수 없는 오류가 발생했습니다.'}</Typography>
      </Paper>
    );
  }

  const handleCopyText = () => {
    if (result.full_text) {
      navigator.clipboard.writeText(result.full_text)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        })
        .catch(err => {
          console.error('텍스트 복사 실패:', err);
        });
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <ReceiptLongIcon sx={{ mr: 1 }} />
        영수증 분석 결과
      </Typography>
      
      <Grid container spacing={3}>
        {/* 기본 정보 카드 */}
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>기본 정보</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {result.date && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CalendarTodayIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="body1">날짜: {result.date}</Typography>
                  </Box>
                )}
                
                {result.time && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AccessTimeIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="body1">시간: {result.time}</Typography>
                  </Box>
                )}
                
                {result.payment_method && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CreditCardIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="body1">
                      결제 수단: {paymentMethodMap[result.payment_method] || result.payment_method}
                    </Typography>
                  </Box>
                )}
                
                {result.total_amount !== undefined && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h5" color="primary.main" sx={{ fontWeight: 'bold' }}>
                      합계: {formatCurrency(result.total_amount)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* 상점 정보 카드 */}
        {result.store && Object.keys(result.store).length > 0 && (
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <StorefrontIcon sx={{ mr: 1 }} />
                  상점 정보
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {result.store.name && (
                    <Typography variant="body1">상호: {result.store.name}</Typography>
                  )}
                  {result.store.business_number && (
                    <Typography variant="body1">사업자번호: {result.store.business_number}</Typography>
                  )}
                  {result.store.phone && (
                    <Typography variant="body1">전화번호: {result.store.phone}</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
      
      {/* 품목 테이블 */}
      {result.items && result.items.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>구매 품목</Typography>
          <TableContainer component={Paper} elevation={2}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.light' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>품목</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>수량</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>단가</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>금액</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.items.map((item, index) => (
                  <TableRow key={index} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row">{item.name}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                  </TableRow>
                ))}
                {result.total_amount !== undefined && (
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>합계</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(result.total_amount)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
      
      {/* 전체 텍스트 */}
      <Box sx={{ mt: 3 }}>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1">추출된 전체 텍스트</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyText}
            color={copySuccess ? "success" : "primary"}
          >
            {copySuccess ? "복사됨" : "텍스트 복사"}
          </Button>
        </Box>
        <Paper 
          elevation={1} 
          sx={{ 
            p: 2, 
            bgcolor: 'background.paper', 
            color: 'text.primary',
            maxHeight: '200px', 
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography 
            variant="body2" 
            component="pre" 
            sx={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              color: 'inherit'
            }}
          >
            {result.full_text}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default ReceiptResults; 