import React, { useState } from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';

const SwitchWrapper = styled.label`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  cursor: pointer;
  user-select: none;

  .label-text {
    color: ${(props) => (props.$showToggleText ? 'white' : 'rgba(245, 245, 245, 0.95)')};
    font-size: 13px;
    margin-bottom: 5px;
    font-weight: 500;
  }

  .toggle-container {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 34px;
  }

  .toggle {
    position: absolute;
    inset: 0;
    background-color: rgba(48, 48, 48, 0.95);
    border-radius: 24px;
    border: 1px solid rgba(212, 175, 55, 0.15);
    transition: background-color 0.25s, border-color 0.25s;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.9);
    font-size: 10px;
    font-weight: 600;
  }

  .toggle::before {
    content: '';
    position: absolute;
    width: 30px;
    height: 30px;
    background-color: rgba(255, 255, 255, 0.35);
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: transform 0.25s, background-color 0.25s;
  }

  .toggle-input {
    display: none;
  }

  .toggle-text {
    position: absolute;
    top: 7px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-size: 12px;
    font-weight: bold;
  }

  .toggle-input:checked + .toggle {
    background-color: rgba(212, 175, 55, 0.5);
  }

  .toggle-input:checked + .toggle::before {
    transform: translateX(28px);
    background-color: #d4af37;
  }

  @media (max-width: 480px) {
    .label-text {
      font-size: 11px;
      margin-bottom: 4px;
    }

    .toggle-container {
      width: 52px;
      height: 30px;
    }

    .toggle {
      font-size: 9px;
    }

    .toggle::before {
      width: 26px;
      height: 26px;
    }

    .toggle-text {
      top: 6px;
      font-size: 10px;
    }

    .toggle-input:checked + .toggle::before {
      transform: translateX(22px);
    }
  }
`;

const SwitchButton = ({ id, label, onText, offText, value, onChange, showToggleText = false }) => {
  return (
    <SwitchWrapper htmlFor={id} $showToggleText={showToggleText}>
      <span className="label-text">{label}</span>
      <div className="toggle-container">
        <input
          id={id}
          type="checkbox"
          className="toggle-input"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle" aria-hidden>
          {showToggleText && (value ? <span className="toggle-text">{onText}</span> : <span className="toggle-text">{offText}</span>)}
        </span>
      </div>
    </SwitchWrapper>
  );
};

SwitchButton.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  onText: PropTypes.string,
  offText: PropTypes.string,
  value: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  showToggleText: PropTypes.bool,
};

SwitchButton.defaultProps = {
  onText: 'On',
  offText: 'Off',
};

export default SwitchButton;
