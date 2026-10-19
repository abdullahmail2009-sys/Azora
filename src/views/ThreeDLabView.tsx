import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  Sparkles,
  RotateCw,
  Box,
  Atom,
  Dna,
  Zap,
  Layers,
  Search,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  FlaskConical,
} from 'lucide-react';
import { searchPubChemCompound, fetchAlphaFoldProtein, ChemicalCompoundInfo, AlphaFoldProteinInfo } from '../utils/scienceEngine.ts';

type SceneMode = 'physics_dipole' | 'chemistry_molecule' | 'biology_dna_protein';

export const ThreeDLabView: React.FC = () => {
  const canvasMountRef = useRef<HTMLDivElement>(null);

  // Active 3D Scene Controls
  const [sceneMode, setSceneMode] = useState<SceneMode>('physics_dipole');
  const [autoRotate, setAutoRotate] = useState(true);
  const [explodedView, setExplodedView] = useState(0); // 0 to 1
  const [activeFinish, setActiveFinish] = useState<'standard' | 'metallic_gold' | 'crystal_glass'>('standard');
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [webglContextLost, setWebglContextLost] = useState(false);

  // Science Lookup State
  const [chemQuery, setChemQuery] = useState('Glucose');
  const [chemResult, setChemResult] = useState<ChemicalCompoundInfo | null>(null);
  const [chemLoading, setChemLoading] = useState(false);

  const [alphaFoldQuery, setAlphaFoldQuery] = useState('P04637'); // TP53
  const [proteinResult, setProteinResult] = useState<AlphaFoldProteinInfo | null>(null);
  const [proteinLoading, setProteinLoading] = useState(false);

  // Ref holders for Three.js instances to avoid GC & re-mounting
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const autoRotateRef = useRef<boolean>(autoRotate);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Scratch vectors to prevent GC
  const _scratchVec3 = useRef(new THREE.Vector3());

  // 1. Initial PubChem & AlphaFold Lookups
  useEffect(() => {
    handleSearchPubChem('Glucose');
    handleSearchAlphaFold('P04637');
  }, []);

  const handleSearchPubChem = async (name: string) => {
    if (!name.trim()) return;
    setChemLoading(true);
    const res = await searchPubChemCompound(name);
    setChemResult(res);
    setChemLoading(false);
  };

  const handleSearchAlphaFold = async (uniprotId: string) => {
    if (!uniprotId.trim()) return;
    setProteinLoading(true);
    const res = await fetchAlphaFoldProtein(uniprotId);
    setProteinResult(res);
    setProteinLoading(false);
  };

  // 2. Setup Three.js WebGL Canvas Lifecycle
  useEffect(() => {
    const mountElem = canvasMountRef.current;
    if (!mountElem) return;

    const width = mountElem.clientWidth || window.innerWidth;
    const height = mountElem.clientHeight || 520;

    // Renderer with modern color pipeline & safe WebGL fallback
    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !isHeadless, powerPreference: 'high-performance' });
    } catch (e) {
      console.warn('WebGL is not available in this environment:', e);
      setWebglContextLost(true);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountElem.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0F172A'); // Bounded dark viewport for structural 3D contrast
    scene.fog = new THREE.FogExp2('#0F172A', 0.035);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 3.5, 7.5);

    // Orbit Controls with exponential damping
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;
    controls.minDistance = 2;
    controls.maxDistance = 20;
    controlsRef.current = controls;

    // Studio Environment Map via PMREMGenerator & RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // Studio Lighting Rig
    const keyLight = new THREE.DirectionalLight('#FFF5EA', 2.2);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    const d = 5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight('#65CBF3', '#1F2937', 1.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#75D9B4', 1.2);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    // Ground Grid & Contact Shadow Plane
    const grid = new THREE.GridHelper(12, 24, '#334155', '#1E293B');
    grid.position.y = -0.01;
    scene.add(grid);

    const shadowGeo = new THREE.PlaneGeometry(6, 6);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0;
    scene.add(shadowPlane);

    // Main 3D Model Group Container
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Pre-warm shaders
    renderer.compile(scene, camera);

    // Ensure no duplicate animation loop is active
    if (frameIdRef.current !== null) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }

    // Animation Loop
    let lastTime = performance.now();
    const animate = (now: number) => {
      frameIdRef.current = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (autoRotateRef.current && modelGroupRef.current) {
        modelGroupRef.current.rotation.y += dt * 0.4;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    // Android WebView / GPU WebGL Context Loss & Restoration Handlers
    const canvasEl = renderer.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      setWebglContextLost(true);
    };

    const handleContextRestored = () => {
      setWebglContextLost(false);
      lastTime = performance.now();
      if (frameIdRef.current === null) {
        frameIdRef.current = requestAnimationFrame(animate);
      }
    };

    canvasEl.addEventListener('webglcontextlost', handleContextLost, false);
    canvasEl.addEventListener('webglcontextrestored', handleContextRestored, false);

    // Handle Resize
    const handleResize = () => {
      if (!mountElem || !rendererRef.current) return;
      const w = mountElem.clientWidth || window.innerWidth;
      const h = mountElem.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvasEl.removeEventListener('webglcontextlost', handleContextLost, false);
      canvasEl.removeEventListener('webglcontextrestored', handleContextRestored, false);
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      controls.dispose();
      envTexture.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      renderer.dispose();
      if (mountElem.contains(canvasEl)) {
        mountElem.removeChild(canvasEl);
      }
    };
  }, []);

  // 3. Rebuild 3D Model Group when SceneMode, Finish or ExplodedView changes
  useEffect(() => {
    const modelGroup = modelGroupRef.current;
    if (!modelGroup) return;

    // Clear previous children and dispose geometries/materials
    while (modelGroup.children.length > 0) {
      const child = modelGroup.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
      modelGroup.remove(child);
    }

    // Material Finish Generator
    const getMaterial = (baseColor: string | number, roughness = 0.25, metalness = 0.1) => {
      if (activeFinish === 'metallic_gold') {
        return new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          roughness: 0.15,
          metalness: 0.95,
        });
      }
      if (activeFinish === 'crystal_glass') {
        return new THREE.MeshPhysicalMaterial({
          color: baseColor,
          roughness: 0.1,
          transmission: 0.9,
          ior: 1.5,
          thickness: 1.2,
          transparent: true,
          opacity: 0.85,
        });
      }
      return new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness,
        metalness,
      });
    };

    if (sceneMode === 'physics_dipole') {
      // Composite 3–12 Part Model: Electric Dipole & Field Lines
      const exp = explodedView * 1.2;

      // 1. Positive Charge Sphere (+q)
      const posGeo = new THREE.SphereGeometry(0.5, 32, 32);
      const posMat = getMaterial('#DC2626', 0.2, 0.1);
      const posMesh = new THREE.Mesh(posGeo, posMat);
      posMesh.position.set(-1.8 - exp, 1.2, 0);
      posMesh.castShadow = true;
      modelGroup.add(posMesh);

      // Accent ring for +q
      const ringGeo = new THREE.TorusGeometry(0.65, 0.04, 16, 32);
      const ringMat = getMaterial('#EF4444', 0.1, 0.8);
      const ringMesh1 = new THREE.Mesh(ringGeo, ringMat);
      ringMesh1.position.copy(posMesh.position);
      modelGroup.add(ringMesh1);

      // 2. Negative Charge Sphere (-q)
      const negGeo = new THREE.SphereGeometry(0.5, 32, 32);
      const negMat = getMaterial('#2563EB', 0.2, 0.1);
      const negMesh = new THREE.Mesh(negGeo, negMat);
      negMesh.position.set(1.8 + exp, 1.2, 0);
      negMesh.castShadow = true;
      modelGroup.add(negMesh);

      const ringMesh2 = new THREE.Mesh(ringGeo, getMaterial('#3B82F6', 0.1, 0.8));
      ringMesh2.position.copy(negMesh.position);
      modelGroup.add(ringMesh2);

      // 3. Dipole Axis Rod
      const axisLen = 3.6 + exp * 2;
      const axisGeo = new THREE.CylinderGeometry(0.06, 0.06, axisLen, 16);
      const axisMat = getMaterial('#94A3B8', 0.3, 0.7);
      const axisMesh = new THREE.Mesh(axisGeo, axisMat);
      axisMesh.rotation.z = Math.PI / 2;
      axisMesh.position.set(0, 1.2, 0);
      modelGroup.add(axisMesh);

      // 4. Dipole Vector Arrow (\vec{p} points -q to +q)
      const arrowGeo = new THREE.ConeGeometry(0.18, 0.4, 16);
      const arrowMat = getMaterial('#10B981', 0.2, 0.9);
      const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
      arrowMesh.rotation.z = Math.PI / 2;
      arrowMesh.position.set(-0.8, 1.2, 0);
      modelGroup.add(arrowMesh);

      // 5. Electric Field Lines (TubeGeometries)
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const curve = new THREE.CubicBezierCurve3(
          posMesh.position,
          new THREE.Vector3(-0.9 - exp, 1.2 + Math.sin(angle) * 1.8, Math.cos(angle) * 1.8),
          new THREE.Vector3(0.9 + exp, 1.2 + Math.sin(angle) * 1.8, Math.cos(angle) * 1.8),
          negMesh.position
        );
        const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.03, 8, false);
        const tubeMat = getMaterial('#75D9B4', 0.3, 0.1);
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        modelGroup.add(tubeMesh);
      }

      // 6. Equipotential Surface Shell
      const shellGeo = new THREE.SphereGeometry(1.2 + exp * 0.3, 32, 16);
      const shellMat = new THREE.MeshPhysicalMaterial({
        color: 0x42bdae,
        transparent: true,
        opacity: 0.18,
        wireframe: true,
      });
      const shellMesh = new THREE.Mesh(shellGeo, shellMat);
      shellMesh.position.set(0, 1.2, 0);
      modelGroup.add(shellMesh);
    } else if (sceneMode === 'chemistry_molecule') {
      // 3D Organic Molecule (Glucose / Benzene Ring Simulation)
      const exp = explodedView * 1.5;

      // Carbon Ring Skeleton (6 Carbon atoms)
      const carbonPositions = [
        [0, 1.8 + exp, 0],
        [1.2 + exp, 1.2 + exp, 0],
        [1.2 + exp, -0.2, 0],
        [0, -0.8 - exp, 0],
        [-1.2 - exp, -0.2, 0],
        [-1.2 - exp, 1.2 + exp, 0],
      ];

      // CPK Colors: C=#333333, H=#FFFFFF, O=#DC2626
      const cGeo = new THREE.SphereGeometry(0.38, 24, 24);
      const cMat = getMaterial('#334155', 0.3, 0.2);

      const oGeo = new THREE.SphereGeometry(0.32, 24, 24);
      const oMat = getMaterial('#DC2626', 0.2, 0.1);

      const hGeo = new THREE.SphereGeometry(0.22, 20, 20);
      const hMat = getMaterial('#F8FAFC', 0.1, 0.0);

      carbonPositions.forEach((pos, idx) => {
        const cMesh = new THREE.Mesh(cGeo, cMat);
        cMesh.position.set(pos[0], pos[1] + 1.2, pos[2]);
        cMesh.castShadow = true;
        modelGroup.add(cMesh);

        // Oxygen branch
        if (idx % 2 === 0) {
          const oMesh = new THREE.Mesh(oGeo, oMat);
          oMesh.position.set(pos[0] * 1.6, pos[1] * 1.6 + 1.2, pos[2] + 0.4);
          oMesh.castShadow = true;
          modelGroup.add(oMesh);

          // Bond cylinder
          const bondGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 12);
          const bondMesh = new THREE.Mesh(bondGeo, getMaterial('#CBD5E1', 0.4, 0.1));
          bondMesh.position.lerpVectors(cMesh.position, oMesh.position, 0.5);
          bondMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            oMesh.position.clone().sub(cMesh.position).normalize()
          );
          modelGroup.add(bondMesh);
        }

        // Connect adjacent carbons
        const nextPos = carbonPositions[(idx + 1) % carbonPositions.length];
        const p1 = new THREE.Vector3(pos[0], pos[1] + 1.2, pos[2]);
        const p2 = new THREE.Vector3(nextPos[0], nextPos[1] + 1.2, nextPos[2]);
        const dist = p1.distanceTo(p2);

        const ringBondGeo = new THREE.CylinderGeometry(0.08, 0.08, dist, 12);
        const ringBondMesh = new THREE.Mesh(ringBondGeo, getMaterial('#94A3B8', 0.3, 0.3));
        ringBondMesh.position.lerpVectors(p1, p2, 0.5);
        ringBondMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          p2.clone().sub(p1).normalize()
        );
        modelGroup.add(ringBondMesh);
      });
    } else if (sceneMode === 'biology_dna_protein') {
      // 3D DNA Double Helix & AlphaFold pLDDT Ribbon Simulation
      const exp = explodedView * 1.2;
      const turns = 18;

      for (let i = 0; i < turns; i++) {
        const t = (i / turns) * Math.PI * 4;
        const y = (i / turns) * 4.2 - 0.9;

        // Strand 1
        const x1 = Math.cos(t) * (1.2 + exp);
        const z1 = Math.sin(t) * (1.2 + exp);

        // Strand 2 (180 deg out of phase)
        const x2 = Math.cos(t + Math.PI) * (1.2 + exp);
        const z2 = Math.sin(t + Math.PI) * (1.2 + exp);

        // AlphaFold pLDDT Confidence Color Scale
        // >90: #0053D6 (Very High), 70-90: #65CBF3 (Confident), 50-70: #FFDB13 (Low), <50: #FF7D45 (Very Low)
        let pLDDTColor = '#0053D6';
        if (i % 4 === 1) pLDDTColor = '#65CBF3';
        if (i % 4 === 2) pLDDTColor = '#FFDB13';
        if (i % 4 === 3) pLDDTColor = '#FF7D45';

        const sGeo = new THREE.SphereGeometry(0.24, 16, 16);
        const sMat = getMaterial(pLDDTColor, 0.25, 0.2);

        const m1 = new THREE.Mesh(sGeo, sMat);
        m1.position.set(x1, y + 1.2, z1);
        modelGroup.add(m1);

        const m2 = new THREE.Mesh(sGeo, sMat);
        m2.position.set(x2, y + 1.2, z2);
        modelGroup.add(m2);

        // Base pair hydrogen bond rod
        const p1 = new THREE.Vector3(x1, y + 1.2, z1);
        const p2 = new THREE.Vector3(x2, y + 1.2, z2);
        const dist = p1.distanceTo(p2);

        const rodGeo = new THREE.CylinderGeometry(0.04, 0.04, dist, 12);
        const rodMat = getMaterial('#E2E8F0', 0.2, 0.8);
        const rodMesh = new THREE.Mesh(rodGeo, rodMat);
        rodMesh.position.lerpVectors(p1, p2, 0.5);
        rodMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          p2.clone().sub(p1).normalize()
        );
        modelGroup.add(rodMesh);
      }
    }
  }, [sceneMode, activeFinish, explodedView]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E5DEC9] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#1B4D48] text-white flex items-center justify-center shadow-xs">
            <Atom className="w-6 h-6 text-[#75D9B4]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1B4D48]">
              AZORA 3D Science & Learning Workbench
            </h1>
            <p className="text-xs sm:text-sm text-[#4A6B66]">
              Interactive Three.js WebGL Simulations · Physics Electrostatics, Chemistry & AlphaFold Biology
            </p>
          </div>
        </div>

        {/* Scene Selector Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F5EFE2] rounded-2xl border border-[#E5DEC9]">
          <button
            onClick={() => setSceneMode('physics_dipole')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              sceneMode === 'physics_dipole'
                ? 'bg-[#1B4D48] text-white shadow-xs'
                : 'text-[#4A6B66] hover:text-[#1B4D48]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Physics Field</span>
          </button>
          <button
            onClick={() => setSceneMode('chemistry_molecule')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              sceneMode === 'chemistry_molecule'
                ? 'bg-[#1B4D48] text-white shadow-xs'
                : 'text-[#4A6B66] hover:text-[#1B4D48]'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Chemistry 3D</span>
          </button>
          <button
            onClick={() => setSceneMode('biology_dna_protein')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              sceneMode === 'biology_dna_protein'
                ? 'bg-[#1B4D48] text-white shadow-xs'
                : 'text-[#4A6B66] hover:text-[#1B4D48]'
            }`}
          >
            <Dna className="w-3.5 h-3.5" />
            <span>AlphaFold 3D</span>
          </button>
        </div>
      </div>

      {/* Main 3D Viewport Container */}
      <div className="relative w-full h-[520px] rounded-3xl overflow-hidden border border-slate-800 shadow-lg bg-slate-950">
        {/* Isolated WebGL Canvas Container */}
        <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Top Floating Badge */}
        <div className="absolute top-4 left-4 z-10 bg-slate-900/90 text-white px-3.5 py-1.5 rounded-2xl border border-slate-700/80 text-xs font-medium flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#75D9B4]" />
          <span>
            {sceneMode === 'physics_dipole' && '3D Electrostatics & Electric Dipole Field Simulation'}
            {sceneMode === 'chemistry_molecule' && '3D Organic Chemistry Molecule & Crystal Lattice'}
            {sceneMode === 'biology_dna_protein' && '3D DNA Double Helix & AlphaFold pLDDT Structure'}
          </span>
        </div>

        {/* WebGL Context Lost Recovery Banner */}
        {webglContextLost && (
          <div className="absolute top-14 left-4 z-20 bg-amber-950/95 text-amber-200 px-3.5 py-2 rounded-2xl border border-amber-500/50 text-xs font-medium">
            3D graphics context paused by system — restoring automatically on foreground return...
          </div>
        )}

        {/* Collapsible Viewport Bottom Control Dock (Zero Viewport Occlusion) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-3xl">
          <div className="bg-slate-900/95 text-slate-100 p-3 sm:p-4 rounded-2xl border border-slate-700/90 shadow-2xl space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-bold text-[#75D9B4] flex items-center gap-1.5">
                <Box className="w-4 h-4" />
                <span>3D Simulation Controls</span>
              </span>
              <button
                onClick={() => setIsDockCollapsed(!isDockCollapsed)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                {isDockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{isDockCollapsed ? 'Expand Dock' : 'Collapse Dock'}</span>
              </button>
            </div>

            {!isDockCollapsed && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1 border-t border-slate-800">
                {/* Auto Rotate Toggle */}
                <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-xl">
                  <span className="text-slate-300 font-medium">Rotation</span>
                  <button
                    onClick={() => setAutoRotate(!autoRotate)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition ${
                      autoRotate ? 'bg-[#42BDAE] text-slate-950' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {autoRotate ? 'Rotating' : 'Paused'}
                  </button>
                </div>

                {/* Exploded View Slider */}
                <div className="flex flex-col gap-1 bg-slate-800/80 p-2 rounded-xl">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Explode Expansion</span>
                    <span className="font-mono text-[#75D9B4]">{Math.round(explodedView * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={explodedView}
                    onChange={(e) => setExplodedView(parseFloat(e.target.value))}
                    className="accent-[#42BDAE] h-1.5 cursor-pointer"
                  />
                </div>

                {/* Material Finish Swatches */}
                <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-xl">
                  <span className="text-slate-300 font-medium">Material</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveFinish('standard')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        activeFinish === 'standard' ? 'bg-[#75D9B4] text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      PBR
                    </button>
                    <button
                      onClick={() => setActiveFinish('metallic_gold')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        activeFinish === 'metallic_gold' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Gold
                    </button>
                    <button
                      onClick={() => setActiveFinish('crystal_glass')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        activeFinish === 'crystal_glass' ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Glass
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Science Intelligence Inspectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* PubChem Chemical Compound Inspector */}
        <div className="p-5 rounded-3xl bg-white border border-[#E5DEC9] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#1B4D48] flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-[#42BDAE]" />
              <span>PubChem 3D Chemical Compound Inspector</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              NCBI PubChem API
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchPubChem(chemQuery);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={chemQuery}
              onChange={(e) => setChemQuery(e.target.value)}
              placeholder="e.g. Glucose, Aspirin, Benzene"
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#F5EFE2] border border-[#E5DEC9] text-xs font-medium text-[#1B4D48] focus:outline-none"
            />
            <button
              type="submit"
              disabled={chemLoading}
              className="px-4 py-2 rounded-xl bg-[#1B4D48] text-white text-xs font-bold hover:bg-[#143B37] transition cursor-pointer"
            >
              {chemLoading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {chemResult && (
            <div className="p-3.5 rounded-2xl bg-[#FBF7EF] border border-[#E5DEC9] space-y-2 text-xs text-[#1B4D48]">
              <div className="flex items-center justify-between font-bold">
                <span>{chemResult.name} (CID: {chemResult.cid})</span>
                <span className="font-mono text-[#42BDAE]">{chemResult.molecularFormula}</span>
              </div>
              <p className="text-[11px] text-[#4A6B66]">IUPAC: {chemResult.iupacName || 'Available on PubChem'}</p>
              <div className="flex items-center justify-between text-[11px]">
                <span>Molecular Weight: {chemResult.molecularWeight ? `${chemResult.molecularWeight} g/mol` : 'N/A'}</span>
                <a
                  href={`https://pubchem.ncbi.nlm.nih.gov/compound/${chemResult.cid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#42BDAE] hover:underline flex items-center gap-1 font-bold"
                >
                  <span>PubChem Record</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* AlphaFold DB Protein Structure Inspector */}
        <div className="p-5 rounded-3xl bg-white border border-[#E5DEC9] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#1B4D48] flex items-center gap-2">
              <Dna className="w-5 h-5 text-[#B8A4EF]" />
              <span>AlphaFold DB Protein Structure Inspector</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              AlphaFold DB API
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchAlphaFold(alphaFoldQuery);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={alphaFoldQuery}
              onChange={(e) => setAlphaFoldQuery(e.target.value)}
              placeholder="e.g. UniProt ID: P04637, P01308"
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#F5EFE2] border border-[#E5DEC9] text-xs font-medium text-[#1B4D48] focus:outline-none"
            />
            <button
              type="submit"
              disabled={proteinLoading}
              className="px-4 py-2 rounded-xl bg-[#1B4D48] text-white text-xs font-bold hover:bg-[#143B37] transition cursor-pointer"
            >
              {proteinLoading ? 'Fetching...' : 'Fetch'}
            </button>
          </form>

          {proteinResult && (
            <div className="p-3.5 rounded-2xl bg-[#FBF7EF] border border-[#E5DEC9] space-y-2 text-xs text-[#1B4D48]">
              <div className="flex items-center justify-between font-bold">
                <span>{proteinResult.geneName} ({proteinResult.uniprotAccession})</span>
                <span className="text-emerald-700">{proteinResult.organism}</span>
              </div>
              <p className="text-[11px] text-[#4A6B66]">{proteinResult.entryTitle}</p>
              
              {/* Canonical 4-tier pLDDT confidence scale */}
              <div className="space-y-1 pt-1 border-t border-[#E5DEC9]">
                <span className="text-[10px] font-bold text-[#4A6B66] uppercase tracking-wider">
                  AlphaFold pLDDT Confidence Score Bands:
                </span>
                <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-bold">
                  <div className="p-1 rounded bg-[#0053D6] text-white">&gt;90 Very High</div>
                  <div className="p-1 rounded bg-[#65CBF3] text-slate-900">70-90 Confident</div>
                  <div className="p-1 rounded bg-[#FFDB13] text-slate-900">50-70 Low</div>
                  <div className="p-1 rounded bg-[#FF7D45] text-white">&lt;50 Very Low</div>
                </div>
              </div>

              {proteinResult.cifUrl && (
                <div className="pt-1 flex justify-end">
                  <a
                    href={`https://alphafold.ebi.ac.uk/entry/${proteinResult.uniprotAccession}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#B8A4EF] hover:underline flex items-center gap-1 font-bold text-[11px]"
                  >
                    <span>View AlphaFold Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
