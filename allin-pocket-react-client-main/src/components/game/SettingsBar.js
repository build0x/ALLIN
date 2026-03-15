import React, { useState, useContext } from 'react';
import styled from 'styled-components';
import globalContext from '@/context/global/globalContext';
import contentContext from '@/context/content/contentContext';
import tableContext from '@/context/table/tableContext';
import SwitchButton from '@/components/buttons/SwitchButton';
import { parserCardStyle } from '@/utils/CardRes';
import { LS_ENABLE_SOUNDS_STATE } from '@/components/navigation/Navbar';

const SettingsWrap = styled.div`
  position: relative;
  width: 100%;
  min-height: 116px;
  padding: 12px 0 52px;

  @media (max-width: 480px) {
    min-height: 0;
    padding: 12px 0 58px;
  }
`;

const SettingsCard = styled.div`
  background: linear-gradient(160deg, rgba(42, 42, 42, 0.48) 0%, rgba(28, 28, 28, 0.45) 100%);
  border: 1px solid rgba(212, 175, 55, 0.22);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(10px);

  @media (max-width: 480px) {
    padding: 12px 14px;
    border-radius: 12px;
  }
`;

const SettingsTitle = styled.div`
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(212, 175, 55, 0.9);
  margin-bottom: 12px;
  font-weight: 600;

  @media (max-width: 480px) {
    margin-bottom: 10px;
    font-size: 10px;
  }
`;

const SwitchGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px 16px;
  width: 100%;
  align-items: start;

  @media (max-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 10px 12px;
  }

  @media (max-width: 380px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const StyledItem = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const FooterInfo = styled.div`
  margin-top: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.45;
  text-align: center;
  font-size: 12px;

  @media (max-width: 480px) {
    font-size: 11px;
    margin-top: 12px;
  }
`;

export const LS_USE_PURPLE_TABLE = 'LS_USE_PURPLE_TABLE';
export const LS_USE_BLACK_CARDS = 'LS_USE_BLACK_CARDS';
export const LS_AUTO_CHECK_ENABLED = 'LS_AUTO_CHECK_ENABLED';
export const LS_AUTO_PLAY_ENABLED = 'LS_AUTO_PLAY_ENABLED';

// Sleep promise
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const purpleBgVal = () => {
  const purpleBgVal = localStorage.getItem(LS_USE_PURPLE_TABLE);
  if (purpleBgVal === null || purpleBgVal === 'undefined') {
    return false;
  }
  return purpleBgVal === 'true';
};

const blackCardVal = () => {
  const blackCardVal = localStorage.getItem(LS_USE_BLACK_CARDS);
  if (blackCardVal === null || blackCardVal === 'undefined') {
    return false;
  }
  return blackCardVal === 'true';
};

const autoCheckEnabledVal = () => {
  const autoCheckEnabled = localStorage.getItem(LS_AUTO_CHECK_ENABLED);
  if (autoCheckEnabled === null || autoCheckEnabled === 'undefined') {
    return false;
  }
  return autoCheckEnabled === 'true';
};

const autoPlayEnabledVal = () => {
  const autoPlayEnabled = localStorage.getItem(LS_AUTO_PLAY_ENABLED);
  if (autoPlayEnabled === null || autoPlayEnabled === 'undefined') {
    return false;
  }
  return autoPlayEnabled === 'true';
};

const SettingsFormContent = () => {
  const { setCardStyle } = useContext(globalContext);
  const { t } = useContext(contentContext);
  const { enableSounds, setEnableSounds, autoCheck, setAutoCheck, autoPlay, setAutoPlay } =
    useContext(tableContext);

  const [tablePurpleBg, setTablePurpleBg] = useState(purpleBgVal());
  const [blackCards, setBlackCards] = useState(blackCardVal());

  const changeEnableSounds = (state) => {
    setEnableSounds(state);
    localStorage.setItem(LS_ENABLE_SOUNDS_STATE, String(state));
  };

  // Handlers for each toggle
  const changeTableColor = (state) => {
    setTablePurpleBg(state);
    localStorage.setItem(LS_USE_PURPLE_TABLE, JSON.stringify(state));
    applyTableColor(state);
  };

  const applyTableColor = (state) => {
    const pokerTable = document.getElementById('pokerTable');
    if (!pokerTable) {
      return;
    }

    if (window.innerWidth <= 768) {
      pokerTable.style.backgroundImage = 'none';
      return;
    }

    pokerTable.style.backgroundImage = state
      ? "url('./assets/images/poker_table_purple.png')"
      : "url('./assets/images/poker_table_green.png')";
  };

  const changeBlackCards = (state) => {
    setBlackCards(state);
    const cardsStyle = JSON.stringify(state);
    setCardStyle(parserCardStyle(cardsStyle));
    localStorage.setItem(LS_USE_BLACK_CARDS, cardsStyle);
  };

  const changeAutoCheck = (state) => {
    setAutoCheck(state);
    localStorage.setItem(LS_AUTO_CHECK_ENABLED, String(state));
  };

  const changeAutoPlay = (state) => {
    setAutoPlay(state);
    localStorage.setItem(LS_AUTO_PLAY_ENABLED, String(state));
  };

  const getCurrentYear = () => new Date().getFullYear();

  return (
    <SettingsCard>
      <SettingsTitle>设置</SettingsTitle>
      <SwitchGroup>
        <StyledItem>
          <SwitchButton
            id="tableColor"
            label={t('PURPLE_TABLE')}
            onText={t('ON')}
            offText={t('OFF')}
            value={tablePurpleBg}
            onChange={changeTableColor}
            showToggleText={false}
          />
        </StyledItem>
        <StyledItem>
          <SwitchButton
            id="blackCards"
            label={t('BLACK_CARDS')}
            onText={t('ON')}
            offText={t('OFF')}
            value={blackCards}
            onChange={changeBlackCards}
            showToggleText={false}
          />
        </StyledItem>
        <StyledItem>
          <SwitchButton
            id="enableSounds"
            label="音效"
            onText={t('ON')}
            offText={t('OFF')}
            value={enableSounds}
            onChange={changeEnableSounds}
            showToggleText={false}
          />
        </StyledItem>
        <StyledItem>
          <SwitchButton
            id="autoCheck"
            label={t('AUTO_CHECK')}
            onText={t('ON')}
            offText={t('OFF')}
            value={autoCheck}
            onChange={changeAutoCheck}
            showToggleText={false}
          />
        </StyledItem>
        <StyledItem>
          <SwitchButton
            id="autoPlay"
            label={t('AUTO_PLAY')}
            onText={t('ON')}
            offText={t('OFF')}
            value={autoPlay}
            onChange={changeAutoPlay}
            showToggleText={false}
          />
        </StyledItem>
      </SwitchGroup>
      <FooterInfo className="footer">
        <div>♠️ ♥️ ♦️ ♣️</div>
        <div>&copy; ALLIN {getCurrentYear()}</div>
      </FooterInfo>
    </SettingsCard>
  );
};

export const SettingsForm = SettingsFormContent;

const SettingsBar = () => (
  <SettingsWrap id="game-settings">
    <SettingsFormContent />
  </SettingsWrap>
);

export default SettingsBar;
