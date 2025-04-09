export interface User {
    id: string;
    email: string;
    name?: string;
    username?: string;
    profileImage?: string;
    role?: string;
    user_metadata?: {
        name?: string;
        username?: string;
        [key: string]: any;
    };
}

export interface ExtractionFromAPI {
    id: number;
    user_id?: string;
    filename?: string;
    extracted_text?: string;
    created_at?: string;
    updated_at?: string;
    is_bookmarked?: number | boolean;
    source_type?: string;
    ocr_model?: string;
    language?: string;
    text?: string;
}

export interface Extraction {
    id: number;
    user_id?: string;
    filename?: string;
    extracted_text?: string;
    text?: string; 
    created_at?: string;
    updated_at?: string;
    is_bookmarked?: boolean;
    isBookmarked?: boolean;
    source_type?: string;
    ocr_model?: string;
    language?: string;
    batch_upload?: boolean;
    timestamp?: number;
    imageUrl?: string;
}

export interface ApiResponse<T = any> {
    success: boolean;
    error?: string;
    data?: T;
    message?: string;
    token?: string;
    extracted_text?: string;
    id?: number | {id: number};
    image_url?: string;
    model?: string;
    tesseract_installed?: boolean;
    language_installed?: boolean;
}

export interface ExtractData {
    id: number;
    text: string;
    extracted_text?: string;
    filename?: string;
    characterCount?: number;
    timestamp?: string;
    model?: string;
    language?: string;
    saved?: boolean;
    image_url?: string;
    file_type?: string;
    regions?: Array<[number, number, number, number]>;
    tesseract_installed?: boolean;
    language_installed?: boolean;
    record?: {
        id: number;
        [key: string]: any;
    };
    message?: string;
}

export interface ExtractResponse extends ApiResponse<ExtractData> {}

export interface UpdateFilenameResponse extends ApiResponse {
    message?: string;
}

export interface DeleteExtractionResponse extends ApiResponse {
    message?: string;
}

export interface GetExtractionsResponse extends ApiResponse<ExtractionFromAPI[]> {}

export interface UpdateTextResponse extends ApiResponse {
    text?: string;
    id?: number;
}

export interface TextRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ImageProcessingOptions {
    language?: string;
    method?: 'tesseract' | 'gemini' | 'neural_ocr';
    preprocessingLevel?: 'none' | 'low' | 'medium' | 'high';
}

export interface OcrProgressInfo {
    status: string;
    progress: number;
    elapsedTime?: number;
}

export interface OcrResult {
  id: number | null;
  text: string;
  filename: string;
  success: boolean;
  error?: string;
  language?: string;
  model?: string;
}