import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppContext } from '../../contexts/AppContext';
import { BASE_URL } from '../../services/api';

const API_URL = BASE_URL;

const ChangePasswordPage: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { logout } = useAppContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      // ✨ localStorage에서 토큰 가져오기 (AppContext와 통일)
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_URL}/api/auth/me/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        // Backend schema requires current_password but logic ignores it for forced change
        body: JSON.stringify({
          current_password: "none",
          new_password: newPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '비밀번호 변경에 실패했습니다.');
      }

      toast.success('비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.');

      // logout 함수 사용 (자동으로 sessionStorage 정리 + /login 이동)
      logout();

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('알 수 없는 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.formContainer}>
        <h1 style={{ ...styles.title, color: 'var(--text-primary)' }}>최초 비밀번호 변경</h1>
        <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-tertiary)' }}>
          안전한 계정 사용을 위해 비밀번호를 변경해주세요.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>새 비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          {error && <p style={styles.errorText}>{error}</p>}
          <button type="submit" style={styles.button}>
            비밀번호 변경
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-secondary)' },
  formContainer: { width: '400px', padding: '2rem', backgroundColor: 'var(--bg-card)', borderRadius: '8px', boxShadow: 'var(--shadow)' },
  title: { textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' } as React.CSSProperties,
  inputGroup: { marginBottom: '1rem' },
  label: { display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-secondary)' },
  input: { width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', boxSizing: 'border-box', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' } as React.CSSProperties,
  button: { width: '100%', padding: '0.75rem', border: 'none', borderRadius: '8px', backgroundColor: 'var(--primary)', color: 'white', fontSize: '1rem', cursor: 'pointer' },
  errorText: { color: 'var(--danger)', textAlign: 'center', marginTop: '1rem' } as React.CSSProperties,
};

export default ChangePasswordPage;