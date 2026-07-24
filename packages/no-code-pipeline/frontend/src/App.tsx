import React, { useState, useCallback } from 'react';
import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import PipelineCanvas from './components/PipelineCanvas';
import NodePalette from './components/NodePalette';

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const onDrop = useCallback((nodeType: string) => {
    const id = `${nodeType}-${Date.now()}`;
    const newNode = {
      id,
      type: 'default',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: nodeType.replace('_', ' ') },
    };
    setNodes((nds) => [...nds, newNode as any]);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <NodePalette onDrop={onDrop} />
      <div style={{ flex: 1 }}>
        <ReactFlowProvider>
          <PipelineCanvas nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}