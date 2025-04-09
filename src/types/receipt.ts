export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  unit_price: number;
}

export interface StoreInfo {
  name?: string;
  business_number?: string;
  phone?: string;
}

export interface ReceiptAnalysisResult {
  success: boolean;
  full_text: string;
  date?: string;
  time?: string;
  total_amount?: number;
  payment_method?: string;
  store?: StoreInfo;
  items: ReceiptItem[];
  file_url?: string;
  filename?: string;
  error?: string;
}

export interface ReceiptAnalysisRequest {
  file: File;
} 