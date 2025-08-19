const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const authRoutes = require('./routes/auth'); // auth.js 라우터 불러오기

const app = express();
const port = 8080;

// 미들웨어 설정
app.use(bodyParser.json());                            // JSON 데이터 파싱
app.use(express.urlencoded({ extended: true }));       // HTML form 데이터 파싱

// 정적 파일 제공 (HTML, CSS 등)
app.use(express.static(path.join(__dirname, 'public')));

// 인증 라우터 등록 (회원가입, 로그인, 재설정)
app.use('/auth', authRoutes);

// 기본 루트 라우터 (접속 시 index.html 출력)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 서버 실행
app.listen(port, () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
});
