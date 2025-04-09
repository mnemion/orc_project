// API 프록시 설정
module.exports = function(app) {
  // API 요청을 백엔드로 프록시
  const { createProxyMiddleware } = require('http-proxy-middleware');
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      // 타임아웃 설정 추가 (밀리초 단위, 5분)
      timeout: 300000,
      // 프록시 오류 처리
      onError: (err, req, res) => {
        console.error('프록시 오류:', err);
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ 
          success: false, 
          error: '서버 연결 실패',
          message: '백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.'
        }));
      }
    })
  );
};