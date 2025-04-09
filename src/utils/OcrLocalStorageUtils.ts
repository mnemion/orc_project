export class OcrLocalStorageUtils {
  private static KEYS = {
    MODEL: 'ocr_model',
    LANGUAGE: 'ocr_language',
    IMAGE_QUALITY: 'ocr_image_quality',
    IMAGE_ZOOM: 'ocr_image_zoom',
    THEME: 'app_theme'
  };

  static getOcrModel(): string {
    return localStorage.getItem(this.KEYS.MODEL) || 'tesseract';
  }

  static saveOcrModel(model: string): void {
    localStorage.setItem(this.KEYS.MODEL, model);
  }

  static getOcrLanguage(): string {
    return localStorage.getItem(this.KEYS.LANGUAGE) || 'kor';
  }

  static saveOcrLanguage(language: string): void {
    localStorage.setItem(this.KEYS.LANGUAGE, language);
  }

  static getImageQuality(): number {
    const qualityStr = localStorage.getItem(this.KEYS.IMAGE_QUALITY);
    const quality = qualityStr ? parseInt(qualityStr, 10) : 85;
    return isNaN(quality) ? 85 : quality;
  }

  static saveImageQuality(quality: number): void {
    localStorage.setItem(this.KEYS.IMAGE_QUALITY, quality.toString());
  }

  static getImageZoom(): number {
    const zoomStr = localStorage.getItem(this.KEYS.IMAGE_ZOOM);
    const zoom = zoomStr ? parseFloat(zoomStr) : 1.0;
    return isNaN(zoom) ? 1.0 : zoom;
  }

  static saveImageZoom(zoom: number): void {
    localStorage.setItem(this.KEYS.IMAGE_ZOOM, zoom.toString());
  }

  static getTheme(): string {
    return localStorage.getItem(this.KEYS.THEME) || 'light';
  }

  static saveTheme(theme: string): void {
    localStorage.setItem(this.KEYS.THEME, theme);
  }

  static resetAllSettings(): void {
    localStorage.removeItem(this.KEYS.MODEL);
    localStorage.removeItem(this.KEYS.LANGUAGE);
    localStorage.removeItem(this.KEYS.IMAGE_QUALITY);
    localStorage.removeItem(this.KEYS.IMAGE_ZOOM);
  }
}