import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Divider,
  Grid
} from '@mui/material';
import { formatCurrency } from '../../utils/formatters';
import { ReceiptAnalysisResult } from '../../types/receipt';

interface ReceiptResultProps {
  result: ReceiptAnalysisResult | null;
}

/**
 * 영수증 분석 결과 표시 컴포넌트
 */
const ReceiptResult: React.FC<ReceiptResultProps> = ({ result }) => {
  // 데이터가 없는 경우 처리
  if (!result) {
    return (
      <Box p={3} textAlign="center">
        <Typography color="textSecondary">분석 결과가 없습니다.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* 기본 정보 */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle2" color="textSecondary">날짜</Typography>
          <Typography variant="body1">{result.date || '정보 없음'}</Typography>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle2" color="textSecondary">시간</Typography>
          <Typography variant="body1">{result.time || '정보 없음'}</Typography>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle2" color="textSecondary">결제 수단</Typography>
          <Typography variant="body1">{result.payment_method || '정보 없음'}</Typography>
        </Grid>
      </Grid>

      {/* 매장 정보 */}
      {result.store && (
        <Box mt={3}>
          <Typography variant="h6" gutterBottom>매장 정보</Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="textSecondary">매장명</Typography>
                <Typography variant="body1">{result.store.name || '정보 없음'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="textSecondary">사업자 번호</Typography>
                <Typography variant="body1">{result.store.business_number || '정보 없음'}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="textSecondary">전화번호</Typography>
                <Typography variant="body1">{result.store.phone || '정보 없음'}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}

      {/* 구매 항목 */}
      <Box mt={3}>
        <Typography variant="h6" gutterBottom>구매 항목</Typography>
        {result.items && result.items.length > 0 ? (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>품목명</TableCell>
                  <TableCell align="right">수량</TableCell>
                  <TableCell align="right">단가</TableCell>
                  <TableCell align="right">금액</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                  </TableRow>
                ))}
                {/* 합계 행 */}
                <TableRow>
                  <TableCell colSpan={3} align="right">
                    <Typography variant="subtitle1" fontWeight="bold">합계</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle1" fontWeight="bold">
                      {result.total_amount !== undefined 
                        ? formatCurrency(result.total_amount) 
                        : formatCurrency(0)}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography color="textSecondary" align="center" sx={{ py: 2 }}>
            구매 항목을 추출하지 못했습니다.
          </Typography>
        )}
      </Box>

      {/* 전체 텍스트 */}
      <Box mt={3}>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" gutterBottom>
          추출된 전체 텍스트
        </Typography>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2,
            maxHeight: '200px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            backgroundColor: '#f5f5f5'
          }}
        >
          {result.full_text || '텍스트가 추출되지 않았습니다.'}
        </Paper>
      </Box>
    </Box>
  );
};

export default ReceiptResult; 