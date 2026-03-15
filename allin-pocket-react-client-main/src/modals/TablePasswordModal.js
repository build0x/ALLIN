import React, { useState, useContext, useEffect, useRef } from 'react';
import styled from 'styled-components';
import contentContext from '@/context/content/contentContext';

const Wrap = styled.div`
  width: min(92vw, 420px);
  padding: 20px 18px 18px;
  border-radius: 22px;
  border: 1px solid rgba(212, 175, 55, 0.22);
  background:
    radial-gradient(circle at top right, rgba(212, 175, 55, 0.12), transparent 34%),
    linear-gradient(160deg, rgba(26, 26, 26, 0.98) 0%, rgba(12, 12, 12, 0.98) 100%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  color: #f5f5f5;
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
`;

const Title = styled.div`
  color: #d4af37;
  font-size: 18px;
  font-weight: 800;
`;

const CloseButton = styled.button`
  border: 0;
  background: transparent;
  color: #bfbfbf;
  font-size: 20px;
  line-height: 1;
`;

const Hint = styled.div`
  color: #bfbfbf;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 14px;
`;

const PasswordInput = styled.input`
  width: 100%;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(212, 175, 55, 0.18);
  background: rgba(17, 17, 17, 0.96);
  color: #ffffff;
  padding: 0 14px;
  outline: none;

  &:focus {
    border-color: rgba(245, 217, 120, 0.55);
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08);
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
`;

const SecondaryButton = styled.button`
  border: 1px solid rgba(212, 175, 55, 0.24);
  background: rgba(255, 255, 255, 0.04);
  color: #f5f5f5;
  border-radius: 12px;
  padding: 10px 16px;
  font-weight: 700;
`;

const PrimaryButton = styled.button`
  border: 0;
  background: linear-gradient(135deg, #f5d978 0%, #d4af37 55%, #8f6b14 100%);
  color: #0d0d0d;
  border-radius: 12px;
  padding: 10px 18px;
  font-weight: 800;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const TablePasswordModal = ({ closeModal, onProceed }) => {
  const { t } = useContext(contentContext);
  const [password, setPassword] = useState('');
  const passwordInputRef = useRef(null);

  useEffect(() => {
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, []);

  const handleProceed = () => {
    onProceed(password);
    closeModal();
  };

  return (
    <Wrap>
      <Header>
        <Title>{t('TABLE_PASSWORD')}</Title>
        <CloseButton type="button" aria-label="Close" onClick={closeModal}>
          ×
        </CloseButton>
      </Header>
      <Hint>该房间已设置密码，输入正确密码后才可以继续进入。</Hint>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleProceed();
        }}
      >
        <PasswordInput
          id="table_password"
          type="text"
          placeholder={t('TABLE_PASSWORD')}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          ref={passwordInputRef}
        />
        <Footer>
          <SecondaryButton type="button" onClick={closeModal}>
            取消
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={!password}>
            {t('CONTINUE')}
          </PrimaryButton>
        </Footer>
      </form>
    </Wrap>
  );
};

export default TablePasswordModal;
