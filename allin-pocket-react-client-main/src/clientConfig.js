const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const localIP = window.location.hostname;
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const socketHost = window.location.host;

const config = {
  isProduction,
  socketURI: isProduction
    ? `${wsProtocol}://${socketHost}/api`
    : isStaging
      ? 'wss://pokerpocket-staging.nitramite.com/api'
      : `ws://${localIP}:5700/api`,
};

export default config;
