import React, { useRef, useState } from 'react';
import { useDispatch } from '../state/store.jsx';
import { Thumb } from './bits.jsx';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
const MODEL_EXT = /\.(glb|gltf|obj|fbx|stl)$/i;
const MAX_BYTES = 8 * 1024 * 1024; // keep IndexedDB happy

function classify(file) {
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) return 'svg';
  if (IMAGE_TYPES.includes(file.type)) return 'photo';
  if (MODEL_EXT.test(file.name)) return 'model';
  return null;
}

// Drag-and-drop uploader for the details panel. Accepts prop/location photos,
// SVG diagrams and 3D render exports. On upload the file immediately becomes
// the entity's primary thumbnail (gallery card / location reference image) —
// pure state update, no refresh. Pass dispatchOverride to target the library
// store instead of the active project.
export default function ImageUploader({ coll, entity, dispatchOverride }) {
  const projDispatch = useDispatch();
  const dispatch = dispatchOverride ?? projDispatch;
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState(null);

  function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    const kind = classify(file);
    if (!kind) { setError(`"${file.name}" isn't a supported format. Use PNG/JPG/WebP, SVG, or a 3D export (.glb .gltf .obj .stl).`); return; }
    if (file.size > MAX_BYTES) { setError(`"${file.name}" is over 8 MB. Export a smaller render for the thumbnail.`); return; }
    setError(null);

    if (kind === 'model') {
      // Store metadata + badge; full model preview is a later feature.
      dispatch({ type: 'SET_IMAGE', coll, id: entity.id, image: { kind, name: file.name, size: file.size } });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => dispatch({ type: 'SET_IMAGE', coll, id: entity.id, image: { kind, name: file.name, dataUrl: reader.result } });
    reader.onerror = () => setError(`Couldn't read "${file.name}". Try again.`);
    reader.readAsDataURL(file);
  }

  return (
    <div className="uploader-wrap">
      <div
        className={`uploader${drag ? ' drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      >
        <div className="upreview"><Thumb image={entity.image} type={entity.type || 'location'} big /></div>
        <div className="uphint">
          <b>{entity.image ? 'Replace image' : 'Add image'}</b>
          <span>Drop a photo, SVG or 3D export here — or click to browse</span>
        </div>
        <input
          ref={inputRef} type="file" hidden
          accept="image/*,.svg,.glb,.gltf,.obj,.fbx,.stl"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
      {entity.image && (
        <div className="upmeta">
          <span className="mono">{entity.image.name}</span>
          <button className="linkbtn" onClick={() => dispatch({ type: 'SET_IMAGE', coll, id: entity.id, image: null })}>Remove</button>
        </div>
      )}
      {error && <div className="uperror">{error}</div>}
    </div>
  );
}
