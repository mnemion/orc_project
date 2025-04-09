import { API_BASE_URL } from '../config';
import axios from 'axios';

/**
 * 영수증 이미지를 분석하는 API 호출
 * 
 * @param {FormData} formData - 파일을 포함한 FormData 객체
 * @returns {Promise<Object>} - 분석 결과 객체
 */
export const parseReceipt = async (formData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/parse-receipt`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('영수증 분석 API 오류:', error);
    
    // 서버 오류 메시지가 있으면 사용, 없으면 기본 메시지 반환
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    } else {
      throw new Error('영수증 분석 중 오류가 발생했습니다.');
    }
  }
};

/**
 * 분석된 영수증 데이터 저장 API 호출 (아직 백엔드 API가 구현되지 않음)
 * 
 * @param {Object} receiptData - 저장할 영수증 데이터
 * @returns {Promise<Object>} - 저장 결과 객체
 */
export const saveReceiptData = async (receiptData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/receipts`, receiptData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('영수증 데이터 저장 API 오류:', error);
    
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    } else {
      throw new Error('영수증 데이터 저장 중 오류가 발생했습니다.');
    }
  }
}; 