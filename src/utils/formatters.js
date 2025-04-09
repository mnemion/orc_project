export const formatCurrency = (amount, currency = '₩') => {
  if (amount === null || amount === undefined) {
    return '정보 없음';
  }
  
  const numAmount = typeof amount === 'string' ? parseInt(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '정보 없음';
  }
  
  return `${currency} ${numAmount.toLocaleString('ko-KR')}`;
};

export const formatDate = (dateString, format = 'YYYY년 MM월 DD일') => {
  if (!dateString) {
    return '정보 없음';
  }
  
  try {
    const [year, month, day] = dateString.split('-').map(part => parseInt(part));
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return dateString;
    }
    
    return format
      .replace('YYYY', year)
      .replace('MM', month.toString().padStart(2, '0'))
      .replace('DD', day.toString().padStart(2, '0'));
  } catch (error) {
    console.error('날짜 형식 변환 오류:', error);
    return dateString;
  }
};

export const formatTime = (timeString, includeSeconds = false) => {
  if (!timeString) {
    return '정보 없음';
  }
  
  try {
    const parts = timeString.split(':');
    
    if (parts.length < 2) {
      return timeString;
    }
    
    const hour = parseInt(parts[0]);
    const minute = parseInt(parts[1]);
    const second = parts.length > 2 ? parseInt(parts[2]) : 0;
    
    if (isNaN(hour) || isNaN(minute) || isNaN(second)) {
      return timeString;
    }
    
    return includeSeconds 
      ? `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
      : `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('시간 형식 변환 오류:', error);
    return timeString;
  }
};