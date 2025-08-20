import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Download, Globe, Moon, Settings, BarChart3, Eye, EyeOff } from 'lucide-react';
import Modal from './Modal';

interface SimulationData {
  time: number;
  height: number;
  velocity: number;
  acceleration: number;
  displacement: number;
  mass: number;
}

interface SimulationState {
  isRunning: boolean;
  time: number;
  currentHeight: number;
  currentVelocity: number;
  displacement: number;
  ballY: number;
}

const PLANETS = {
  earth: { name: 'Dünya', gravity: 9.81, icon: Globe },
  moon: { name: 'Ay', gravity: 1.62, icon: Moon },
  mars: { name: 'Mars', gravity: 3.71, icon: Settings },
  custom: { name: 'Özel', gravity: 9.81, icon: Settings }
};

function FreeFallSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | null>(null);
  
  // Modal and table visibility state
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isDataTableVisible, setIsDataTableVisible] = useState(false);
  
  // Pagination state for main table
  const [mainTableCurrentPage, setMainTableCurrentPage] = useState(1);
  
  // Pagination state for modal
  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Simulation parameters
  const [initialVelocity, setInitialVelocity] = useState(0);
  const [initialHeight, setInitialHeight] = useState(50);
  const [mass, setMass] = useState(1);
  const [planet, setPlanet] = useState<keyof typeof PLANETS>('earth');
  const [customGravity, setCustomGravity] = useState(9.81);
  
  // Simulation state
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isRunning: false,
    time: 0,
    currentHeight: 50,
    currentVelocity: 0,
    displacement: 0,
    ballY: 0
  });
  
  const [dataHistory, setDataHistory] = useState<SimulationData[]>([]);
  const [trail, setTrail] = useState<number[]>([]);
  
  const SCALE = 4;
  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 480;
  
  const gravity = planet === 'custom' ? customGravity : PLANETS[planet].gravity;
  const ballRadius = Math.min(20, 8 + mass * 2);
  
  // Pagination calculations for main table
  const mainTotalPages = Math.ceil(dataHistory.length / itemsPerPage);
  const mainStartIndex = (mainTableCurrentPage - 1) * itemsPerPage;
  const mainEndIndex = mainStartIndex + itemsPerPage;
  const mainCurrentData = dataHistory.slice(mainStartIndex, mainEndIndex);
  
  // Pagination calculations for modal
  const modalTotalPages = Math.ceil(dataHistory.length / itemsPerPage);
  const modalStartIndex = (modalCurrentPage - 1) * itemsPerPage;
  const modalEndIndex = modalStartIndex + itemsPerPage;
  const modalCurrentData = dataHistory.slice(modalStartIndex, modalEndIndex);
  
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.1)';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 0; i <= CANVAS_HEIGHT; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_WIDTH, i);
      ctx.stroke();
    }
    
    // Vertical grid lines
    for (let i = 0; i <= CANVAS_WIDTH; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }
  }, []);
  
  const drawBall = useCallback((ctx: CanvasRenderingContext2D, yPos: number) => {
    // Ball shadow
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2 + 2, yPos + 2, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    
    // Main ball
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, yPos, ballRadius, 0, Math.PI * 2);
    
    // Gradient ball
    const gradient = ctx.createRadialGradient(
      CANVAS_WIDTH / 2 - ballRadius / 3,
      yPos - ballRadius / 3,
      0,
      CANVAS_WIDTH / 2,
      yPos,
      ballRadius
    );
    gradient.addColorStop(0, '#00F5FF');
    gradient.addColorStop(1, '#0077AA');
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Ball outline
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [ballRadius]);
  
  const drawTrail = useCallback((ctx: CanvasRenderingContext2D, trail: number[]) => {
    trail.forEach((yPos, index) => {
      const opacity = index / trail.length;
      const radius = (index / trail.length) * 4 + 1;
      
      ctx.beginPath();
      ctx.arc(CANVAS_WIDTH / 2, yPos, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 245, 255, ${opacity * 0.6})`;
      ctx.fill();
    });
  }, []);
  
  const drawGround = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#444';
    ctx.fillRect(0, CANVAS_HEIGHT - 4, CANVAS_WIDTH, 4);
    
    // Ground glow effect
    ctx.fillStyle = 'rgba(0, 245, 255, 0.2)';
    ctx.fillRect(0, CANVAS_HEIGHT - 6, CANVAS_WIDTH, 2);
  }, []);
  
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas with dark background
    ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    drawGrid(ctx);
    drawGround(ctx);
    drawTrail(ctx, trail);
    drawBall(ctx, simulationState.ballY);
  }, [simulationState.ballY, trail, drawGrid, drawGround, drawTrail, drawBall]);
  
  const calculateInitialBallY = useCallback(() => {
    const y = CANVAS_HEIGHT - ballRadius - 4 - (initialHeight * SCALE);
    return Math.max(ballRadius, y);
  }, [initialHeight, ballRadius]);
  
  const startSimulation = useCallback(() => {
    if (simulationState.isRunning) return;
    
    const initialBallY = calculateInitialBallY();
    
    setSimulationState({
      isRunning: true,
      time: 0,
      currentHeight: initialHeight,
      currentVelocity: initialVelocity,
      displacement: 0,
      ballY: initialBallY
    });
    
    setDataHistory([]);
    setTrail([]);
    setMainTableCurrentPage(1); // Reset main table pagination
    setModalCurrentPage(1); // Reset modal pagination
    
    let time = 0;
    
    intervalRef.current = window.setInterval(() => {
      time += 0.1;
      
      const velocity = initialVelocity + gravity * time;
      const displacement = initialVelocity * time + 0.5 * gravity * time * time;
      const currentHeight = Math.max(0, initialHeight - displacement);
      const ballY = initialBallY + displacement * SCALE;
      const actualBallY = Math.min(ballY, CANVAS_HEIGHT - ballRadius - 4);
      
      setSimulationState(prev => ({
        ...prev,
        time,
        currentHeight,
        currentVelocity: velocity,
        displacement,
        ballY: actualBallY
      }));
      
      setTrail(prev => {
        const newTrail = [...prev, actualBallY];
        return newTrail.length > 30 ? newTrail.slice(-30) : newTrail;
      });
      
      const newData: SimulationData = {
        time: parseFloat(time.toFixed(2)),
        height: parseFloat(currentHeight.toFixed(2)),
        velocity: parseFloat(velocity.toFixed(2)),
        acceleration: parseFloat(gravity.toFixed(2)),
        displacement: parseFloat(displacement.toFixed(2)),
        mass: parseFloat(mass.toFixed(1))
      };
      
      setDataHistory(prev => [...prev, newData]);
      
      // Stop when ball reaches ground
      if (currentHeight <= 0.001) {
        stopSimulation();
        bounceEffect();
      }
    }, 100);
  }, [
    simulationState.isRunning,
    initialVelocity,
    initialHeight,
    mass,
    gravity,
    ballRadius,
    calculateInitialBallY
  ]);
  
  const stopSimulation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setSimulationState(prev => ({
      ...prev,
      isRunning: false
    }));
  }, []);
  
  const restartSimulation = useCallback(() => {
    stopSimulation();
    
    setSimulationState({
      isRunning: false,
      time: 0,
      currentHeight: initialHeight,
      currentVelocity: initialVelocity,
      displacement: 0,
      ballY: calculateInitialBallY()
    });
    
    setDataHistory([]);
    setTrail([]);
    setMainTableCurrentPage(1);
    setModalCurrentPage(1);
  }, [stopSimulation, initialHeight, initialVelocity, calculateInitialBallY]);
  
  const bounceEffect = useCallback(() => {
    let bounceCount = 0;
    const bounceInterval = setInterval(() => {
      setSimulationState(prev => ({
        ...prev,
        ballY: bounceCount % 2 === 0 
          ? CANVAS_HEIGHT - ballRadius - 4 - 10
          : CANVAS_HEIGHT - ballRadius - 4
      }));
      
      bounceCount++;
      if (bounceCount >= 6) {
        clearInterval(bounceInterval);
        setSimulationState(prev => ({
          ...prev,
          ballY: CANVAS_HEIGHT - ballRadius - 4
        }));
      }
    }, 150);
  }, [ballRadius]);
  
  const downloadCSV = useCallback(() => {
    if (dataHistory.length === 0) return;
    
    const headers = ['Zaman (s)', 'Yükseklik (m)', 'Hız (m/s)', 'İvme (m/s²)', 'Yer Değiştirme (m)', 'Kütle (kg)'];
    const csvContent = [
      headers.join(';'),
      ...dataHistory.map(row => [
        row.time.toString().replace('.', ','),
        row.height.toString().replace('.', ','),
        row.velocity.toString().replace('.', ','),
        row.acceleration.toString().replace('.', ','),
        row.displacement.toString().replace('.', ','),
        row.mass.toString().replace('.', ',')
      ].join(';'))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'serbest_dusme_verileri.csv';
    link.click();
  }, [dataHistory]);
  
  const toggleDataTable = useCallback(() => {
    setIsDataTableVisible(!isDataTableVisible);
  }, [isDataTableVisible]);
  
  const handleMainTablePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= mainTotalPages) {
      setMainTableCurrentPage(page);
    }
  }, [mainTotalPages]);
  
  const handleModalPageChange = useCallback((page: number) => {
    if (page >= 1 && page <= modalTotalPages) {
      setModalCurrentPage(page);
    }
  }, [modalTotalPages]);
  
  const renderMainTablePagination = () => {
    if (mainTotalPages <= 1) return null;
    
    const pages = [];
    const maxVisiblePages = 7;
    let startPage = Math.max(1, mainTableCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(mainTotalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    return (
      <div className="pagination">
        <button
          className="pagination-button"
          disabled={mainTableCurrentPage === 1}
          onClick={() => handleMainTablePageChange(mainTableCurrentPage - 1)}
        >
          ‹
        </button>
        
        {startPage > 1 && (
          <>
            <button
              className="pagination-button"
              onClick={() => handleMainTablePageChange(1)}
            >
              1
            </button>
            {startPage > 2 && <span className="pagination-info">...</span>}
          </>
        )}
        
        {Array.from({ length: endPage - startPage + 1 }, (_, i) => {
          const page = startPage + i;
          return (
            <button
              key={page}
              className={`pagination-button ${mainTableCurrentPage === page ? 'active' : ''}`}
              onClick={() => handleMainTablePageChange(page)}
            >
              {page}
            </button>
          );
        })}
        
        {endPage < mainTotalPages && (
          <>
            {endPage < mainTotalPages - 1 && <span className="pagination-info">...</span>}
            <button
              className="pagination-button"
              onClick={() => handleMainTablePageChange(mainTotalPages)}
            >
              {mainTotalPages}
            </button>
          </>
        )}
        
        <button
          className="pagination-button"
          disabled={mainTableCurrentPage === mainTotalPages}
          onClick={() => handleMainTablePageChange(mainTableCurrentPage + 1)}
        >
          ›
        </button>
        
        <span className="pagination-info">
          {mainStartIndex + 1}-{Math.min(mainEndIndex, dataHistory.length)} / {dataHistory.length}
        </span>
      </div>
    );
  };
  
  const renderModalPagination = () => {
    if (modalTotalPages <= 1) return null;
    
    const pages = [];
    const maxVisiblePages = 7;
    let startPage = Math.max(1, modalCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(modalTotalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    return (
      <div className="pagination">
        <button
          className="pagination-button"
          disabled={modalCurrentPage === 1}
          onClick={() => handleModalPageChange(modalCurrentPage - 1)}
        >
          ‹
        </button>
        
        {startPage > 1 && (
          <>
            <button
              className="pagination-button"
              onClick={() => handleModalPageChange(1)}
            >
              1
            </button>
            {startPage > 2 && <span className="pagination-info">...</span>}
          </>
        )}
        
        {Array.from({ length: endPage - startPage + 1 }, (_, i) => {
          const page = startPage + i;
          return (
            <button
              key={page}
              className={`pagination-button ${modalCurrentPage === page ? 'active' : ''}`}
              onClick={() => handleModalPageChange(page)}
            >
              {page}
            </button>
          );
        })}
        
        {endPage < modalTotalPages && (
          <>
            {endPage < modalTotalPages - 1 && <span className="pagination-info">...</span>}
            <button
              className="pagination-button"
              onClick={() => handleModalPageChange(modalTotalPages)}
            >
              {modalTotalPages}
            </button>
          </>
        )}
        
        <button
          className="pagination-button"
          disabled={modalCurrentPage === modalTotalPages}
          onClick={() => handleModalPageChange(modalCurrentPage + 1)}
        >
          ›
        </button>
        
        <span className="pagination-info">
          {modalStartIndex + 1}-{Math.min(modalEndIndex, dataHistory.length)} / {dataHistory.length}
        </span>
      </div>
    );
  };
  
  // Initialize simulation on component mount
  useEffect(() => {
    restartSimulation();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  // Re-render canvas when state changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);
  
  const PlanetIcon = PLANETS[planet].icon;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D1117] to-[#18122B] p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--near-white)] mb-2">
            Modern Serbest Düşme Simülasyonu
          </h1>
          <p className="text-[var(--light-gray)] text-lg">
            Fizik yasalarını modern arayüzle keşfedin
          </p>
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1">
            <div className="glass-card">
              <h2 className="text-xl font-semibold text-[var(--neon-cyan)] mb-6 flex items-center gap-2">
                <Settings size={20} />
                Kontrol Paneli
              </h2>
              
              {/* Parameters */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--light-gray)] mb-2">
                    İlk Hız (m/s)
                  </label>
                  <input
                    type="number"
                    value={initialVelocity}
                    onChange={(e) => setInitialVelocity(parseFloat(e.target.value) || 0)}
                    step="0.1"
                    className="modern-input w-full"
                    disabled={simulationState.isRunning}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--light-gray)] mb-2">
                    Yükseklik (m)
                  </label>
                  <input
                    type="number"
                    value={initialHeight}
                    onChange={(e) => setInitialHeight(Math.max(1, parseFloat(e.target.value) || 1))}
                    step="1"
                    min="1"
                    className="modern-input w-full"
                    disabled={simulationState.isRunning}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--light-gray)] mb-2">
                    Kütle (kg)
                  </label>
                  <input
                    type="number"
                    value={mass}
                    onChange={(e) => setMass(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                    step="0.1"
                    min="0.1"
                    className="modern-input w-full"
                    disabled={simulationState.isRunning}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--light-gray)] mb-2">
                    Gezegen
                  </label>
                  <select
                    value={planet}
                    onChange={(e) => setPlanet(e.target.value as keyof typeof PLANETS)}
                    className="modern-select w-full"
                    disabled={simulationState.isRunning}
                  >
                    {Object.entries(PLANETS).map(([key, { name }]) => (
                      <option key={key} value={key} className="bg-[var(--deep-space-blue)]">
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {planet === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--light-gray)] mb-2">
                      Yer Çekimi (m/s²)
                    </label>
                    <input
                      type="number"
                      value={customGravity}
                      onChange={(e) => setCustomGravity(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                      step="0.01"
                      min="0.1"
                      className="modern-input w-full"
                      disabled={simulationState.isRunning}
                    />
                  </div>
                )}
              </div>
              
              {/* Control Buttons */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={simulationState.isRunning ? stopSimulation : startSimulation}
                  className="modern-button modern-button-primary w-full flex items-center justify-center gap-2"
                >
                  {simulationState.isRunning ? (
                    <>
                      <Pause size={18} />
                      Durdur
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Başlat
                    </>
                  )}
                </button>
                
                <button
                  onClick={restartSimulation}
                  className="modern-button modern-button-secondary w-full flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} />
                  Tekrar Başlat
                </button>
                
                <button
                  onClick={toggleDataTable}
                  className="modern-button modern-button-success w-full flex items-center justify-center gap-2"
                >
                  {isDataTableVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  Veri Tablosunu {isDataTableVisible ? 'Gizle' : 'Göster'}
                </button>
                
                <button
                  onClick={() => setIsDataModalOpen(true)}
                  disabled={dataHistory.length === 0}
                  className="modern-button modern-button-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BarChart3 size={18} />
                  Detaylı Tablo
                </button>
                
                <button
                  onClick={downloadCSV}
                  disabled={dataHistory.length === 0}
                  className="modern-button modern-button-secondary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={18} />
                  İndir
                </button>
              </div>
              
              {/* Current Planet Info */}
              <div className="planet-info">
                <PlanetIcon size={16} className="text-[var(--neon-cyan)]" />
                <span className="planet-info-text">
                  {PLANETS[planet].name}: {gravity.toFixed(2)} m/s²
                </span>
              </div>
            </div>
          </div>
          
          {/* Simulation Canvas */}
          <div className="lg:col-span-3">
            <div className="glass-card">
              <h2 className="text-xl font-semibold text-[var(--neon-cyan)] mb-4">
                Simülasyon Alanı
              </h2>
              
              <div className="flex justify-center mb-6">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="border border-[var(--card-border)] rounded-lg max-w-full h-auto"
                  style={{ background: 'rgba(13, 17, 23, 0.9)' }}
                />
              </div>
              
              {/* Current Values */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="info-card">
                  <div className="info-card-label">Zaman</div>
                  <div className="info-card-value">
                    {simulationState.time.toFixed(2)} s
                  </div>
                </div>
                
                <div className="info-card">
                  <div className="info-card-label">Yükseklik</div>
                  <div className="info-card-value">
                    {simulationState.currentHeight.toFixed(2)} m
                  </div>
                </div>
                
                <div className="info-card">
                  <div className="info-card-label">Hız</div>
                  <div className="info-card-value">
                    {simulationState.currentVelocity.toFixed(2)} m/s
                  </div>
                </div>
                
                <div className="info-card">
                  <div className="info-card-label">İvme</div>
                  <div className="info-card-value">
                    {gravity.toFixed(2)} m/s²
                  </div>
                </div>
              </div>
              
              {/* Toggle Data Table */}
              <div className={`data-table-container ${isDataTableVisible ? 'open' : ''}`}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Zaman (s)</th>
                      <th>Yükseklik (m)</th>
                      <th>Hız (m/s)</th>
                      <th>İvme (m/s²)</th>
                      <th>Yer Değiştirme (m)</th>
                      <th>Kütle (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mainCurrentData.map((row, index) => (
                      <tr key={mainStartIndex + index}>
                        <td>{row.time.toFixed(2)}</td>
                        <td>{row.height.toFixed(2)}</td>
                        <td>{row.velocity.toFixed(2)}</td>
                        <td>{row.acceleration.toFixed(2)}</td>
                        <td>{row.displacement.toFixed(2)}</td>
                        <td>{row.mass.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {renderMainTablePagination()}
                
                {dataHistory.length === 0 && (
                  <p className="text-center py-8 text-[var(--light-gray)]">
                    Henüz veri bulunmuyor. Simülasyonu çalıştırarak veri toplayın.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced Data Modal */}
      <Modal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        title={`📊 Simülasyon Veri Tablosu (${dataHistory.length} kayıt)`}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-[var(--light-gray)]">
              Sayfa {modalCurrentPage} / {modalTotalPages} - Toplam {dataHistory.length} kayıt
            </div>
            <button
              onClick={downloadCSV}
              disabled={dataHistory.length === 0}
              className="modern-button modern-button-primary flex items-center gap-2"
            >
              <Download size={16} />
              İndir
            </button>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zaman (s)</th>
                  <th>Yükseklik (m)</th>
                  <th>Hız (m/s)</th>
                  <th>İvme (m/s²)</th>
                  <th>Yer Değiştirme (m)</th>
                  <th>Kütle (kg)</th>
                </tr>
              </thead>
              <tbody>
                {modalCurrentData.map((row, index) => (
                  <tr key={modalStartIndex + index}>
                    <td>{row.time.toFixed(2)}</td>
                    <td>{row.height.toFixed(2)}</td>
                    <td>{row.velocity.toFixed(2)}</td>
                    <td>{row.acceleration.toFixed(2)}</td>
                    <td>{row.displacement.toFixed(2)}</td>
                    <td>{row.mass.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {renderModalPagination()}
          
          {dataHistory.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[var(--light-gray)]">
                Henüz veri bulunmuyor. Simülasyonu çalıştırarak veri toplayın.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default FreeFallSimulation;