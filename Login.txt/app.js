const express = require('express');
const session = require('express-session');
const path = require('path');
const authRouter = require('./routes/auth');

const app = express();

app.use(express.json());  // JSON 요청 본문 파싱 미들웨어 - 반드시 라우터 등록 전에!
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}));

app.use('/auth', authRouter);

app.use(express.static(path.join(__dirname, 'views')));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(8080, () => {
  console.log('Server started on http://localhost:8080');
});
