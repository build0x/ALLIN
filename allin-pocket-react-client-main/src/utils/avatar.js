const createSvgDataUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const jokerAvatarSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#e9e3f7"/>
  <path d="M18 22c4 0 6-7 12-10 0 6 1 9 2 12-6 2-9 2-14-2z" fill="#f0c84f"/>
  <path d="M46 22c-4 0-6-7-12-10 0 6-1 9-2 12 6 2 9 2 14-2z" fill="#57c7ff"/>
  <path d="M32 14c2 3 5 7 5 13H27c0-6 3-10 5-13z" fill="#ff6f7d"/>
  <circle cx="18" cy="22" r="3" fill="#f0c84f"/>
  <circle cx="46" cy="22" r="3" fill="#57c7ff"/>
  <circle cx="32" cy="14" r="3" fill="#ff6f7d"/>
  <ellipse cx="32" cy="35" rx="13" ry="14" fill="#ffb2bc"/>
  <circle cx="27" cy="34" r="2.2" fill="#4d2f54"/>
  <circle cx="37" cy="34" r="2.2" fill="#4d2f54"/>
  <path d="M26 41c3.5 3 8.5 3 12 0" fill="none" stroke="#4d2f54" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M22 47c7 5 13 5 20 0" fill="#8f66cc"/>
  <path d="M24 49c5 2 11 2 16 0" fill="none" stroke="#6e48a8" stroke-width="2" stroke-linecap="round"/>
</svg>
`.trim();

export const DEFAULT_AVATAR_ID = 'joker';
export const DEFAULT_AVATAR_THEME_ID = 'gold';
export const LEGACY_AVATAR_IDS = ['♠', '♥', '♦', '♣', '🂡', '👑', '🦈', '🐉'];
const AVATAR_VALUE_SEPARATOR = '::';

export const AVATAR_OPTIONS = [
  {
    id: DEFAULT_AVATAR_ID,
    label: '默认头像',
    type: 'image',
    src: createSvgDataUri(jokerAvatarSvg),
  },
  { id: 'emoji-heart', label: '红心', type: 'emoji', text: '♥' },
  { id: 'emoji-diamond', label: '方块', type: 'emoji', text: '♦' },
  { id: 'emoji-club', label: '梅花', type: 'emoji', text: '♣' },
  { id: 'emoji-ace', label: '黑桃A', type: 'emoji', text: '🂡' },
  { id: 'emoji-crown', label: '皇冠', type: 'emoji', text: '👑' },
  { id: 'emoji-shark', label: '鲨鱼', type: 'emoji', text: '🦈' },
  { id: 'emoji-dragon', label: '龙', type: 'emoji', text: '🐉' },
  { id: 'emoji-spade', label: '黑桃', type: 'emoji', text: '♠' },
  { id: 'emoji-star', label: '星星', type: 'emoji', text: '⭐' },
  { id: 'emoji-fire', label: '火焰', type: 'emoji', text: '🔥' },
  { id: 'emoji-rocket', label: '火箭', type: 'emoji', text: '🚀' },
  { id: 'emoji-gem', label: '宝石', type: 'emoji', text: '💎' },
  { id: 'emoji-clover', label: '幸运草', type: 'emoji', text: '🍀' },
  { id: 'emoji-coin', label: '金币', type: 'emoji', text: '🪙' },
  { id: 'emoji-bull', label: '公牛', type: 'emoji', text: '🐂' },
  { id: 'emoji-tiger', label: '老虎', type: 'emoji', text: '🐯' },
  { id: 'emoji-fox', label: '狐狸', type: 'emoji', text: '🦊' },
  { id: 'emoji-wolf', label: '狼', type: 'emoji', text: '🐺' },
  { id: 'emoji-robot', label: '机器人', type: 'emoji', text: '🤖' },
];

export const AVATAR_THEMES = [
  {
    id: DEFAULT_AVATAR_THEME_ID,
    label: '鎏金',
    background: 'linear-gradient(135deg, #f8e39a 0%, #d4af37 50%, #8f6b14 100%)',
    color: '#201402',
    ring: 'rgba(245, 217, 120, 0.4)',
  },
  {
    id: 'sunset',
    label: '晚霞',
    background: 'linear-gradient(135deg, #ffb36b 0%, #ff7a59 52%, #b93f66 100%)',
    color: '#fff8f3',
    ring: 'rgba(255, 151, 111, 0.42)',
  },
  {
    id: 'ocean',
    label: '海蓝',
    background: 'linear-gradient(135deg, #83d0ff 0%, #3f8cff 54%, #1f4ab8 100%)',
    color: '#f4fbff',
    ring: 'rgba(93, 159, 255, 0.4)',
  },
  {
    id: 'jade',
    label: '翡翠',
    background: 'linear-gradient(135deg, #78f2c4 0%, #25b98d 55%, #13795b 100%)',
    color: '#f4fff9',
    ring: 'rgba(63, 215, 156, 0.38)',
  },
  {
    id: 'violet',
    label: '紫晶',
    background: 'linear-gradient(135deg, #d0b3ff 0%, #9b6dff 55%, #5d37b8 100%)',
    color: '#faf7ff',
    ring: 'rgba(165, 118, 255, 0.4)',
  },
  {
    id: 'rose',
    label: '玫瑰',
    background: 'linear-gradient(135deg, #ffc0cf 0%, #ff6b93 52%, #bf2d67 100%)',
    color: '#fff8fb',
    ring: 'rgba(255, 119, 165, 0.38)',
  },
  {
    id: 'obsidian',
    label: '曜黑',
    background: 'linear-gradient(135deg, #4b5563 0%, #1f2937 55%, #0b1120 100%)',
    color: '#f8fafc',
    ring: 'rgba(148, 163, 184, 0.34)',
  },
  {
    id: 'mint',
    label: '薄荷',
    background: 'linear-gradient(135deg, #d7fff2 0%, #67e8c7 50%, #13b889 100%)',
    color: '#083225',
    ring: 'rgba(70, 224, 180, 0.38)',
  },
];

const getSafeAvatarId = (avatarId) => {
  const normalizedAvatarId = String(avatarId || '').trim();
  return AVATAR_OPTIONS.some((item) => item.id === normalizedAvatarId)
    ? normalizedAvatarId
    : DEFAULT_AVATAR_ID;
};

const getSafeAvatarThemeId = (themeId) => {
  const normalizedThemeId = String(themeId || '').trim();
  return AVATAR_THEMES.some((item) => item.id === normalizedThemeId)
    ? normalizedThemeId
    : DEFAULT_AVATAR_THEME_ID;
};

export const serializeAvatarSelection = (avatarId, themeId = DEFAULT_AVATAR_THEME_ID) =>
  `${getSafeAvatarId(avatarId)}${AVATAR_VALUE_SEPARATOR}${getSafeAvatarThemeId(themeId)}`;

export const parseAvatarSelection = (avatarIcon) => {
  const rawAvatarValue = String(avatarIcon || '').trim();

  if (!rawAvatarValue || LEGACY_AVATAR_IDS.includes(rawAvatarValue)) {
    return {
      avatarId: DEFAULT_AVATAR_ID,
      themeId: DEFAULT_AVATAR_THEME_ID,
      value: serializeAvatarSelection(DEFAULT_AVATAR_ID, DEFAULT_AVATAR_THEME_ID),
    };
  }

  const [rawAvatarId, rawThemeId] = rawAvatarValue.split(AVATAR_VALUE_SEPARATOR);
  const avatarId = getSafeAvatarId(rawAvatarId);
  const themeId = getSafeAvatarThemeId(rawThemeId);

  return {
    avatarId,
    themeId,
    value: serializeAvatarSelection(avatarId, themeId),
  };
};

export const normalizeAvatarId = (avatarIcon) => {
  return parseAvatarSelection(avatarIcon).avatarId;
};

export const getAvatarOption = (avatarIcon) => {
  const { avatarId, themeId, value } = parseAvatarSelection(avatarIcon);
  const option = AVATAR_OPTIONS.find((item) => item.id === avatarId) || AVATAR_OPTIONS[0];
  const theme = AVATAR_THEMES.find((item) => item.id === themeId) || AVATAR_THEMES[0];

  return {
    ...option,
    avatarId,
    theme,
    themeId,
    value,
  };
};
