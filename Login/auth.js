// routes/auth.js

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db');
const rateLimit = require('express-rate-limit');
require('dotenv').config(); // 환경 변수 불러오기

const router = express.Router();

// 이메일 인증 코드 저장소 (실제 서비스에서는 Redis DB 추천)
let resetCodes = {};

/* ---------------------------
     Rate Limit 설정
   - 이메일 관련 요청 (아이디 찾기, 비번 재설정 요청)에 적용
---------------------------- */
const emailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분 기준
  max: 3,              // 1분 동안 최대 3회 요청 허용
  message: { message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
});

/* ---------------------------
   회원가입
---------------------------- */
router.post('/register', async (req, res) => {
  const { name, username, password, email } = req.body;

  if (!name || !username || !password || !email) {
    return res.status(400).json({ message: '모든 필드를 입력하세요' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = 'INSERT INTO users (name, username, password, email) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, username, hashedPassword, email], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ message: '이미 존재하는 아이디 또는 이메일입니다.' });
        }
        return res.status(500).json({ message: '회원가입 실패', error: err });
      }
      res.status(201).json({ message: '회원가입 성공' });
    });
  } catch (err) {
    res.status(500).json({ message: '서버 오류', error: err });
  }
});

/* ---------------------------
   로그인
---------------------------- */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const sql = 'SELECT * FROM users WHERE username = ?';
  db.query(sql, [username], async (err, results) => {
    if (err) return res.status(500).json({ message: 'DB 오류', error: err });

    if (results.length === 0) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    }

    res.status(200).json({
      message: '로그인 성공',
      user: { id: user.id, name: user.name, username: user.username, email: user.email }
    });
  });
});

/* ---------------------------
   아이디 찾기 (이메일로 발송)
   - rate limit 적용
---------------------------- */
router.post('/find-id', emailLimiter, (req, res) => {
  const { email } = req.body;

  const sql = 'SELECT username FROM users WHERE email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'DB 오류', error: err });

    if (results.length === 0) {
      return res.status(404).json({ message: '해당 이메일로 가입된 계정이 없습니다.' });
    }

    const username = results[0].username;

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '아이디 찾기 결과',
      text: `안녕하세요, 요청하신 아이디는 [${username}] 입니다.`
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        return res.status(500).json({ message: '이메일 발송 실패', error: err });
      }
      res.json({ message: '가입된 아이디가 이메일로 발송되었습니다.' });
    });
  });
});

/* ---------------------------
   비밀번호 재설정 요청 (인증코드 발송)
   - rate limit 적용
---------------------------- */
router.post('/reset-request', emailLimiter, (req, res) => {
  const { email } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'DB 오류', error: err });

    if (results.length === 0) {
      return res.status(404).json({ message: '해당 이메일 사용자 없음' });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    resetCodes[email] = code;

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '비밀번호 재설정 인증 코드',
      text: `안녕하세요, 요청하신 비밀번호 재설정 인증 코드는 [${code}] 입니다.`
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) return res.status(500).json({ message: '이메일 발송 실패', error: err });

      res.json({ message: '인증 코드가 이메일로 전송되었습니다.' });
    });
  });
});

/* ---------------------------
   비밀번호 재설정 실행
---------------------------- */
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!resetCodes[email] || resetCodes[email] !== code) {
    return res.status(400).json({ message: '잘못된 인증 코드입니다.' });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    const sql = 'UPDATE users SET password = ? WHERE email = ?';

    db.query(sql, [hashed, email], (err, result) => {
      if (err) return res.status(500).json({ message: 'DB 오류', error: err });

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: '존재하지 않는 사용자입니다.' });
      }

      delete resetCodes[email];
      res.json({ message: '비밀번호 재설정 완료' });
    });
  } catch (err) {
    res.status(500).json({ message: '서버 오류', error: err });
  }
});

module.exports = router;
