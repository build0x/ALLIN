import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import ModalView from '@/components/modals/ModalView';
import { SettingsForm } from '@/components/game/SettingsBar';

const ModalCardWrap = styled.div`
  width: 100%;
  max-width: 420px;
  margin: 0 16px;
  max-height: 90vh;
  overflow: auto;
`;

const SettingsModal = ({ open, onClose }) => {
  if (!open) return null;

  return ReactDOM.createPortal(
    <ModalView onClose={onClose} zIndex={13002}>
      <ModalCardWrap>
        <SettingsForm />
      </ModalCardWrap>
    </ModalView>,
    document.getElementById('modal')
  );
};

export default SettingsModal;
