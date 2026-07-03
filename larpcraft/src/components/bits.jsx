import React from 'react';

export const ENTITY_COLORS = {
  story: '#5CA8F5', narrative: '#5CA8F5',
  location: '#43BF87',
  enemy: '#E86464',
  objective: '#E0A23C', item: '#E0A23C', artifact: '#E0A23C', gadget: '#3EC6D6', consumable: '#E88F8F',
  mechanic: '#A87BF0',
  sensor: '#3EC6D6',
};

export const AVAILABILITY = {
  ready: { label: 'Ready', cls: 'p-ok' },
  'in-use': { label: 'In use', cls: 'p-info' },
  deployed: { label: 'Deployed', cls: 'p-purple' },
  missing: { label: 'Missing', cls: 'p-bad' },
};

export const BUILD_STEPS = ['concept', 'design', 'build', 'tested', 'packed'];

export function Pill({ availability }) {
  const a = AVAILABILITY[availability] ?? { label: availability, cls: '' };
  return <span className={`pill ${a.cls}`}><i />{a.label}</span>;
}

export function Chip({ color, children, onClick, onRemove, title }) {
  return (
    <span className={`lchip${onClick ? ' clickable' : ''}`} onClick={onClick} title={title}>
      <span className="sq" style={{ background: color }} />
      {children}
      {onRemove && <button className="x" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Remove">×</button>}
    </span>
  );
}

export function SectionLabel({ children }) {
  return <div className="lab">{children}</div>;
}

// Clickable build pipeline: Concept → … → Packed
export function BuildFlow({ value, onChange }) {
  return (
    <div className="flow">
      {BUILD_STEPS.map((step) => {
        const idx = BUILD_STEPS.indexOf(step);
        const cur = BUILD_STEPS.indexOf(value);
        const cls = idx < cur ? 'done' : idx === cur ? 'now' : '';
        return (
          <button key={step} className={cls} onClick={() => onChange?.(step)} title={`Set build status: ${step}`}>
            {step}
          </button>
        );
      })}
    </div>
  );
}

// Placeholder art when an item/location has no uploaded image yet.
export function Placeholder({ type, big }) {
  const color = ENTITY_COLORS[type] || '#8B92A6';
  return (
    <div className={`ph${big ? ' big' : ''}`} style={{ color }}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {type === 'artifact' && <><circle cx="8" cy="8" r="4.5" /><path d="M11.5 11.5L20 20M16.5 16.5l2-2" /></>}
        {type === 'gadget' && <><rect x="6" y="4" width="12" height="16" rx="2.5" /><path d="M9 8h6M9 11h6M10 17h4" /></>}
        {type === 'consumable' && <><rect x="4" y="6" width="16" height="14" rx="2.5" /><path d="M12 10.5v5M9.5 13h5" /></>}
        {type === 'location' && <><path d="M12 21s-6.5-5.4-6.5-10a6.5 6.5 0 0113 0c0 4.6-6.5 10-6.5 10z" /><circle cx="12" cy="10.6" r="2.3" /></>}
        {!['artifact', 'gadget', 'consumable', 'location'].includes(type) && <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 15l4-4 5 5 3-3 4 4" /></>}
      </svg>
    </div>
  );
}

// Renders an uploaded image (photo/SVG data URL) or a 3D-model badge, else placeholder.
export function Thumb({ image, type, big }) {
  if (image?.kind === 'model') {
    return (
      <div className={`ph model${big ? ' big' : ''}`}>
        <svg viewBox="0 0 24 24"><path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" /><path d="M12 2v9m0 0l8-4.5M12 11L4 6.5" /></svg>
        <small>{image.name}</small>
      </div>
    );
  }
  if (image?.dataUrl) return <img className={`thumb-img${big ? ' big' : ''}`} src={image.dataUrl} alt="" />;
  return <Placeholder type={type} big={big} />;
}
