// Extracted from NetClaw Canvas; see LICENSE for the adapted workflow.


const C = {
  canvas: "var(--canvas)", ink: "var(--ink)", muted: "var(--muted)", card: "var(--card)",
  cardAlt: "var(--cardAlt)", hairline: "var(--hairline)", userBubble: "var(--userBubble)",
  trunk: "var(--trunk)", codeBg: "var(--codeBg)", relBg: "var(--relBg)", relBorder: "var(--relBorder)", relText: "var(--relText)",
};

const LIGHT = { "--canvas": "#FBFAF6", "--ink": "#1C2433", "--muted": "#6B7280", "--card": "#FFFFFF", "--cardAlt": "#F6F2E7", "--hairline": "#E3DECF", "--userBubble": "#EEF1F6", "--trunk": "#1B2A4A", "--codeBg": "#F4F1E8", "--relBg": "#F4F1FB", "--relBorder": "#D9CFF0", "--relText": "#5B4B9E", "--ring": "rgba(28,36,51,0.13)", "--shadow": "rgba(0,0,0,0.12)",
  "--codeText": "#1F2937", "--codeKw": "#6F42C1", "--codeStr": "#0A6E20", "--codeFn": "#005CC5", "--codeNum": "#B5651D", "--codeCmt": "#7A8290" };

const DARK = { "--canvas": "#0F1216", "--ink": "#E7EAF0", "--muted": "#8B93A4", "--card": "#181C22", "--cardAlt": "#1F242C", "--hairline": "#2A2F39", "--userBubble": "#232A36", "--trunk": "#6098F0", "--codeBg": "#1B2028", "--relBg": "#221E30", "--relBorder": "#3A3350", "--relText": "#BBA9EC", "--ring": "rgba(255,255,255,0.16)", "--shadow": "rgba(0,0,0,0.5)",
  "--codeText": "#CFD2D8", "--codeKw": "#C678DD", "--codeStr": "#98C379", "--codeFn": "#61AFEF", "--codeNum": "#E5C07B", "--codeCmt": "#6A7380" };

const COLLAPSED_H = 48;

export { C, LIGHT, DARK, COLLAPSED_H };
