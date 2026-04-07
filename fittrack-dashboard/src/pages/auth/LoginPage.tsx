import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, getMyInfo } from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAppContext();

  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  React.useEffect(() => {
    document.title = '핏트랙';
  }, []);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // 1. 데이터 준비 (Form Data 형식)
      const params = new URLSearchParams();
      params.append('username', formData.username);
      params.append('password', formData.password);

      console.log("보내는 데이터:", params.toString()); // 디버깅용 로그

      // 2. 로그인 요청 (헤더 강제 지정)
      // python-multipart가 설치되어 있어야 이 요청을 서버가 이해합니다.
      const loginResponse = await api.post('/api/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token } = loginResponse.data;

      // 3. 토큰 저장
      localStorage.setItem('token', access_token);

      // 4. 내 정보 가져오기
      const userResponse = await getMyInfo();
      const userData = userResponse.data;

      // 5. 로그인 완료 처리
      login(access_token, userData);

      if (userData.must_change_password) {
        toast.success("최초 로그인입니다. 비밀번호를 변경해주세요.");
        navigate('/change-password');
      } else {
        toast.success(`환영합니다, ${userData.name}님!`);
        navigate('/admin/dashboard');
      }

    } catch (err: any) {
      console.error('로그인 에러:', err);
      if (err.response) {
        if (err.response.status === 422) {
          setError('서버가 데이터를 이해하지 못했습니다. (백엔드 터미널에서 pip install python-multipart 를 했는지 확인해주세요!)');
        } else if (err.response.status === 401) {
          setError('전화번호 또는 비밀번호가 틀렸습니다.');
        } else {
          setError(`로그인 실패: ${err.response.data.detail || '오류 발생'}`);
        }
      } else {
        setError('서버에 연결할 수 없습니다.');
      }
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>FitTrack<span style={{ color: '#3182F6' }}>.AI</span></h1>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>전화번호</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="숫자만 입력 (예: 01012345678)"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>비밀번호</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호 입력"
              style={styles.input}
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.button}>
            로그인
          </button>

          {/*
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/guest/entry')}
              style={{
                backgroundColor: '#E8F3FF',
                border: 'none',
                color: '#3182F6',
                fontSize: '14px',
                padding: '10px 18px',
                borderRadius: '10px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              대가 오픈기록 올리기
            </button>
          </div>
          */}
        </form>
      </div>
    </div>
  );
};

// --- Toss Style Definition ---
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#F9FAFB',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px',
    backgroundColor: '#FFFFFF',
    borderRadius: '24px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  title: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#191F28',
    marginBottom: '8px',
    margin: 0,
  },
  subtitle: {
    fontSize: '16px',
    color: '#8B95A1',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333D4B',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    fontSize: '16px',
    boxSizing: 'border-box',
    backgroundColor: '#F9FAFB',
    color: '#191F28',
    outline: 'none',
    transition: 'border-color 0.2s, background-color 0.2s',
  },
  button: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#3182F6',
    color: 'white',
    border: 'none',
    borderRadius: '14px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '16px',
    transition: 'background-color 0.2s',
  },
  error: {
    color: '#EF4444',
    fontSize: '14px',
    textAlign: 'center',
    backgroundColor: '#FEF2F2',
    padding: '12px',
    borderRadius: '8px',
  },
};

export default LoginPage;