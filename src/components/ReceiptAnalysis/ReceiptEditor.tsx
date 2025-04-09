import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  IconButton,
  Grid
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { ReceiptAnalysisResult, ReceiptItem, StoreInfo } from '../../types/receipt';

interface ReceiptEditorProps {
  receipt: ReceiptAnalysisResult | null;
  onSave: (data: ReceiptAnalysisResult) => void;
  onCancel: () => void;
}

interface ReceiptFormData {
  date: string | undefined;
  time: string;
  total_amount: string | number;
  payment_method: string;
  items: ReceiptItem[];
  store: StoreInfo;
  full_text: string;
  success: boolean;
}

/**
 * 영수증 편집 컴포넌트
 */
const ReceiptEditor: React.FC<ReceiptEditorProps> = ({ receipt, onSave, onCancel }) => {
  // 영수증 데이터 상태
  const [receiptData, setReceiptData] = useState<ReceiptFormData>({
    date: receipt?.date || undefined,
    time: receipt?.time || '',
    total_amount: receipt?.total_amount || '',
    payment_method: receipt?.payment_method || '',
    items: receipt?.items || [],
    store: receipt?.store || { name: '', business_number: '', phone: '' },
    full_text: receipt?.full_text || '',
    success: receipt?.success !== undefined ? receipt.success : true
  });

  // 폼 초기화
  useEffect(() => {
    if (receipt) {
      setReceiptData({
        date: receipt.date || undefined,
        time: receipt.time || '',
        total_amount: receipt.total_amount || '',
        payment_method: receipt.payment_method || '',
        items: receipt.items || [],
        store: receipt.store || { name: '', business_number: '', phone: '' },
        full_text: receipt.full_text || '',
        success: receipt.success !== undefined ? receipt.success : true
      });
    }
  }, [receipt]);

  // 날짜 변경 핸들러
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptData({ 
      ...receiptData, 
      date: event.target.value || undefined
    });
  };

  // 기본 필드 변경 핸들러
  const handleInputChange = (field: keyof ReceiptFormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptData({ ...receiptData, [field]: event.target.value });
  };

  // 매장 정보 변경 핸들러
  const handleStoreChange = (field: keyof StoreInfo) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptData({
      ...receiptData,
      store: { ...receiptData.store, [field]: event.target.value }
    });
  };

  // 항목 변경 핸들러
  const handleItemChange = (index: number, field: keyof ReceiptItem, value: string) => {
    const newItems = [...receiptData.items];
    if (field === 'name') {
      newItems[index][field] = value;
    } else if (field === 'quantity' || field === 'unit_price' || field === 'price') {
      newItems[index][field] = parseInt(value) || 0;
    }
    setReceiptData({ ...receiptData, items: newItems });
  };

  // 항목 삭제 핸들러
  const handleDeleteItem = (index: number) => {
    const newItems = receiptData.items.filter((_, i) => i !== index);
    setReceiptData({ ...receiptData, items: newItems });
  };

  // 항목 추가 핸들러
  const handleAddItem = () => {
    setReceiptData({
      ...receiptData,
      items: [
        ...receiptData.items,
        { name: '', quantity: 1, unit_price: 0, price: 0 }
      ]
    });
  };

  // 저장 핸들러
  const handleSave = () => {
    // 가격 및 수량 데이터 정수형으로 변환
    const processedData: ReceiptAnalysisResult = {
      success: receiptData.success,
      full_text: receiptData.full_text,
      date: receiptData.date,
      time: receiptData.time || undefined,
      total_amount: typeof receiptData.total_amount === 'string' 
        ? parseInt(receiptData.total_amount) || 0 
        : receiptData.total_amount,
      payment_method: receiptData.payment_method || undefined,
      store: receiptData.store,
      items: receiptData.items.map(item => ({
        ...item,
        quantity: typeof item.quantity === 'string' ? parseInt(item.quantity as unknown as string) || 1 : item.quantity,
        unit_price: typeof item.unit_price === 'string' ? parseInt(item.unit_price as unknown as string) || 0 : item.unit_price,
        price: typeof item.price === 'string' ? parseInt(item.price as unknown as string) || 0 : item.price
      }))
    };
    
    onSave(processedData);
  };

  return (
    <Box component={Paper} p={3} mt={2} elevation={3}>
      <Typography variant="h5" component="h2" gutterBottom>
        영수증 데이터 편집
      </Typography>

      <Grid container spacing={3}>
        {/* 기본 정보 */}
        <Grid item xs={12} md={4}>
          <TextField
            label="날짜"
            value={receiptData.date || ''}
            onChange={handleDateChange}
            fullWidth
            margin="normal"
            placeholder="YYYY-MM-DD"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="시간"
            value={receiptData.time || ''}
            onChange={handleInputChange('time')}
            fullWidth
            margin="normal"
            placeholder="HH:MM:SS"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="합계 금액"
            value={receiptData.total_amount || ''}
            onChange={handleInputChange('total_amount')}
            fullWidth
            margin="normal"
            type="number"
          />
        </Grid>

        {/* 매장 정보 */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            매장 정보
          </Typography>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="매장명"
            value={receiptData.store?.name || ''}
            onChange={handleStoreChange('name')}
            fullWidth
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="사업자 번호"
            value={receiptData.store?.business_number || ''}
            onChange={handleStoreChange('business_number')}
            fullWidth
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label="전화번호"
            value={receiptData.store?.phone || ''}
            onChange={handleStoreChange('phone')}
            fullWidth
            margin="normal"
          />
        </Grid>

        {/* 결제 수단 */}
        <Grid item xs={12} md={4}>
          <TextField
            label="결제 수단"
            value={receiptData.payment_method || ''}
            onChange={handleInputChange('payment_method')}
            fullWidth
            margin="normal"
          />
        </Grid>
      </Grid>

      {/* 구매 항목 테이블 */}
      <Box mt={4}>
        <Typography variant="h6" gutterBottom>
          구매 항목
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>품목명</TableCell>
                <TableCell align="right">수량</TableCell>
                <TableCell align="right">단가</TableCell>
                <TableCell align="right">금액</TableCell>
                <TableCell align="center">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receiptData.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <TextField
                      fullWidth
                      variant="standard"
                      value={item.name || ''}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      type="number"
                      variant="standard"
                      value={item.quantity || ''}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      inputProps={{ min: 1, style: { textAlign: 'right' } }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      type="number"
                      variant="standard"
                      value={item.unit_price || ''}
                      onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                      inputProps={{ min: 0, style: { textAlign: 'right' } }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      type="number"
                      variant="standard"
                      value={item.price || ''}
                      onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                      inputProps={{ min: 0, style: { textAlign: 'right' } }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton onClick={() => handleDeleteItem(index)} color="error" size="small">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box mt={2} display="flex" justifyContent="flex-start">
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            항목 추가
          </Button>
        </Box>
      </Box>

      {/* 버튼 */}
      <Box mt={4} display="flex" justifyContent="flex-end">
        <Button onClick={onCancel} color="inherit" sx={{ mr: 1 }}>
          취소
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
        >
          저장하기
        </Button>
      </Box>
    </Box>
  );
};

export default ReceiptEditor; 