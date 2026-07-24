import React from 'react';

const NODE_TYPES = [
  'face_swap',
  'voice_convert',
  'background_remove',
  'scene_relight',
  'animate',
  'output',
];

interface Props {
  onDrop: (type: string) => void;
}

export default function NodePalette({ onDrop }: Props) {
  return (
    <div style={{ width: 220, padding: 16, borderRight: '1px solid #ccc', background: '#fafafa' }}>
      <h3 style={{ marginTop: 0 }}>Nodes</h3>
      {NODE_TYPES.map((type) => (
        <div
          key={type}
          onClick={() => onDrop(type)}
          style={{
            padding: '8px 12px',
            marginBottom: 8,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 6,
            cursor: 'grab',
            fontSize: 14,
            textTransform: 'capitalize',
          }}
        >
          {type.replace('_', ' ')}
        </div>
      ))}
    </div>
  );
}