// Vector SVG Icons for CyberOutbreak Dashboard & Canvas Device Nodes
const DeviceIcons = {
  desktop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  laptop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/><path d="M7 16h10"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><circle cx="12" cy="18" r="1"/></svg>`,
  server: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="6" rx="2"/><rect x="2" y="9" width="20" height="6" rx="2"/><rect x="2" y="16" width="20" height="6" rx="2"/><circle cx="6" cy="5" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="6" cy="19" r="1"/></svg>`,
  iot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/><circle cx="8.5" cy="12" r="2.5"/></svg>`,
  router: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="14" width="20" height="7" rx="2"/><path d="M6 14V6"/><path d="M18 14V6"/><circle cx="6" cy="5" r="1"/><circle cx="18" cy="5" r="1"/><path d="M10 18h4"/></svg>`,
  scada: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="5"/></svg>`,
  medical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 12h10"/><path d="M12 7v10"/></svg>`,
  skull: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="10" r="2"/><circle cx="15" cy="10" r="2"/><path d="M10 22h4m-5-4h6m3-6a8 8 0 1 0-16 0c0 3.2 1.8 5.6 4 6.8v3.2h8v-3.2c2.2-1.2 4-3.6 4-6.8z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
  bug: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="7" width="8" height="13" rx="4"/><path d="M12 7V4"/><path d="M6 10l-4-1"/><path d="M6 14l-4 1"/><path d="M6 18l-4 3"/><path d="M18 10l4-1"/><path d="M18 14l4 1"/><path d="M18 18l4 3"/></svg>`,
  activity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
};

// Canvas drawing helper for device glyphs
function drawDeviceGlyph(ctx, type, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size / 24;
  ctx.scale(s, s);
  ctx.translate(-12, -12);

  switch (type) {
    case 'desktop':
      ctx.strokeRect(3, 3, 18, 12);
      ctx.beginPath();
      ctx.moveTo(8, 20); ctx.lineTo(16, 20);
      ctx.moveTo(12, 15); ctx.lineTo(12, 20);
      ctx.stroke();
      break;

    case 'laptop':
      ctx.strokeRect(4, 4, 16, 11);
      ctx.beginPath();
      ctx.moveTo(2, 19); ctx.lineTo(22, 19);
      ctx.moveTo(8, 15); ctx.lineTo(16, 15);
      ctx.stroke();
      break;

    case 'phone':
      ctx.strokeRect(6, 2, 12, 20);
      ctx.beginPath();
      ctx.arc(12, 18, 1.2, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'server':
      ctx.strokeRect(3, 3, 18, 5);
      ctx.strokeRect(3, 9.5, 18, 5);
      ctx.strokeRect(3, 16, 18, 5);
      ctx.beginPath();
      ctx.arc(6, 5.5, 1, 0, Math.PI*2);
      ctx.arc(6, 12, 1, 0, Math.PI*2);
      ctx.arc(6, 18.5, 1, 0, Math.PI*2);
      ctx.fill();
      break;

    case 'iot':
      ctx.strokeRect(2, 6, 14, 12);
      ctx.beginPath();
      ctx.moveTo(16, 9); ctx.lineTo(22, 6); ctx.lineTo(22, 18); ctx.lineTo(16, 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(8, 12, 2.5, 0, Math.PI*2);
      ctx.stroke();
      break;

    case 'router':
      ctx.strokeRect(3, 13, 18, 7);
      ctx.beginPath();
      ctx.moveTo(7, 13); ctx.lineTo(7, 5);
      ctx.moveTo(17, 13); ctx.lineTo(17, 5);
      ctx.moveTo(10, 16.5); ctx.lineTo(14, 16.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(7, 5, 1.2, 0, Math.PI*2);
      ctx.arc(17, 5, 1.2, 0, Math.PI*2);
      ctx.fill();
      break;

    case 'scada':
      ctx.beginPath();
      ctx.arc(12, 12, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12, 2); ctx.lineTo(12, 6);
      ctx.moveTo(12, 18); ctx.lineTo(12, 22);
      ctx.moveTo(2, 12); ctx.lineTo(6, 12);
      ctx.moveTo(18, 12); ctx.lineTo(22, 12);
      ctx.stroke();
      break;

    case 'medical':
      ctx.strokeRect(3, 4, 18, 16);
      ctx.beginPath();
      ctx.moveTo(7, 12); ctx.lineTo(17, 12);
      ctx.moveTo(12, 7); ctx.lineTo(12, 17);
      ctx.stroke();
      break;

    default:
      ctx.strokeRect(4, 4, 16, 16);
      break;
  }

  ctx.restore();
}

window.DeviceIcons = DeviceIcons;
window.drawDeviceGlyph = drawDeviceGlyph;
