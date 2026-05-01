import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import Dashboard from './Dashboard';

// Spread out 3D wireframes across the whole background
const ScatteredGrid = () => {
  const shapes = useMemo(() => 
    Array.from({ length: 25 }, () => ({
      position: [
        (Math.random() - 0.5) * 40, // Spread widely on X axis
        (Math.random() - 0.5) * 25, // Spread widely on Y axis
        -Math.random() * 25 - 5     // Push backwards into the distance
      ],
      scale: Math.random() * 1 + 0.2,
      speed: Math.random() * 0.5 + 0.2,
      geo: Math.random() > 0.5 ? 'icosa' : 'octa'
    }))
  , []);

  return (
    <>
      {shapes.map((shape, i) => (
        <Float key={i} speed={shape.speed} rotationIntensity={0.5} floatIntensity={1.5}>
          <mesh position={shape.position} scale={shape.scale}>
            {shape.geo === 'icosa' 
              ? <icosahedronGeometry args={[1, 0]} /> 
              : <octahedronGeometry args={[1, 0]} />}
            <meshStandardMaterial 
              color="#3b82f6" 
              emissive="#22c55e" 
              emissiveIntensity={0.15} 
              wireframe 
              transparent 
              opacity={0.12} 
            />
          </mesh>
        </Float>
      ))}
    </>
  );
};

const Scene = () => {
  return (
    <>
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 15, 45]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.6} color="#60a5fa" />
      
      <ScatteredGrid />
      
      {/* Dense stars to fill the rest of the space */}
      <Stars radius={100} depth={80} count={8000} factor={6} saturation={0} fade speed={1.5} />
    </>
  );
};

function App() {
  return (
    // Changed inline styles to className="app-container"
    <div className="app-container">
      {/* Added className="no-print" here to hide background when printing */}
      <div className="no-print" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <Canvas camera={{ position: [0, 0, 6], fov: 60 }}>
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      <div style={{ position: 'relative', zIndex: 10, height: '100%', overflowY: 'auto', padding: '0 2rem 2rem 2rem' }}>
        <Dashboard />
      </div>
    </div>
  );
}

export default App;