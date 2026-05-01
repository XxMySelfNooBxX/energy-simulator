import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import energyData from './energyData.json';
import './App.css';

const CITY_DATABASE = {
  chennai: { id: 'chennai', name: 'Chennai', sizeGw: 1.5, baselineMt: 7.2, targetMt: 1.5 },
  mumbai: { id: 'mumbai', name: 'Mumbai', sizeGw: 3.2, baselineMt: 15.5, targetMt: 3.2 },
  delhi: { id: 'delhi', name: 'New Delhi', sizeGw: 4.0, baselineMt: 19.8, targetMt: 4.0 },
  bangalore: { id: 'bangalore', name: 'Bangalore', sizeGw: 2.0, baselineMt: 8.5, targetMt: 2.0 },
};

const useAnimatedNumber = (endValue, duration = 250) => {
  const [value, setValue] = useState(endValue);
  const prevEndValue = useRef(endValue);
  useEffect(() => {
    const startValue = prevEndValue.current;
    prevEndValue.current = endValue;
    const change = endValue - startValue;
    if (change === 0) return;
    let startTime = null;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(startValue + change * ease);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [endValue, duration]);
  return value;
};

const Co2BudgetPanel = ({ co2PerMWh, activeCity, setActiveCity }) => {
  const CITY_GWH_PER_YEAR = 8760 * activeCity.sizeGw; 
  const annualCo2Mt = (co2PerMWh * CITY_GWH_PER_YEAR * 1000) / 1_000_000_000; 
  const pct = Math.min((annualCo2Mt / activeCity.baselineMt) * 100, 100);
  const targetPct = (activeCity.targetMt / activeCity.baselineMt) * 100;
  const isUnderTarget = annualCo2Mt <= activeCity.targetMt;
  const barColor = isUnderTarget ? '#10b981' : annualCo2Mt < (activeCity.targetMt * 2.5) ? '#f59e0b' : '#ef4444';
  const label = isUnderTarget ? '✅ Under Net-Zero Target' : annualCo2Mt < (activeCity.targetMt * 2.5) ? '⚡ Progress — keep going' : '🔴 Above safe level';

  return (
    <div className="cyber-card" style={{ marginTop: '1.5rem', borderColor: isUnderTarget ? '#10b981' : '#f59e0b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div className="cyber-label" style={{ color: isUnderTarget ? '#10b981' : '#f59e0b' }}>🌍 Annual CO₂ Budget</div>
          <select value={activeCity.id} onChange={(e) => setActiveCity(CITY_DATABASE[e.target.value])} className="cyber-select">
            {Object.values(CITY_DATABASE).map(city => (<option key={city.id} value={city.id}>{city.name} Region</option>))}
          </select>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="cyber-value" style={{ color: barColor }}>{annualCo2Mt.toFixed(2)}</div>
          <div className="cyber-subtext">Mt CO₂/yr</div>
        </div>
      </div>
      <div className="cyber-progress-track">
        <div className="cyber-progress-fill" style={{ width: `${pct}%`, background: barColor }} />
        <div className="cyber-progress-target" style={{ left: `${targetPct}%` }}><span>Target</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '1rem' }}>
        <span>{label}</span><span>Base: {activeCity.baselineMt} Mt · Tgt: {activeCity.targetMt} Mt</span>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [mix, setMix] = useState({ solar: 20, wind: 20, biomass: 10, ocean: 0 });
  const [metrics, setMetrics] = useState({ cost: 0, co2: 0, stability: 0 });
  const [toastMsg, setToastMsg] = useState(null);
  const [baselineMetrics, setBaselineMetrics] = useState(null);
  const [activeWeather, setActiveWeather] = useState('clear');
  const [carbonTaxEnabled, setCarbonTaxEnabled] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);
  const [batteryCapacity, setBatteryCapacity] = useState(0); 
  const [activeTab, setActiveTab] = useState('environment'); 
  const [activeCity, setActiveCity] = useState(CITY_DATABASE.chennai);
  const [tourStep, setTourStep] = useState(-1);
  
  const tourContent = [
    "👋 Welcome! Click 'Next' to tour the simulator.",
    "▶️ Try clicking 'Play'! Watch Solar die at night.",
    "🌦️ Click a Weather Event! See Heatwaves spike demand.",
    "⚖️ Flip Carbon Tax! Watch the economics flip.",
    "🌍 Change City to see different grid sizes!",
    "📄 Export PDF for a professional report."
  ];

  useEffect(() => {
    let interval;
    if (isPlaying) interval = setInterval(() => setTimeOfDay(prev => prev >= 24 ? 0 : prev + 0.5), 400);
    return () => clearInterval(interval);
  }, [isPlaying]);

  let solarEfficiency = timeOfDay > 6 && timeOfDay < 18 ? Math.sin(((timeOfDay - 6) / 12) * Math.PI) : 0;
  let windEfficiency = 0.4 + 0.6 * ((Math.cos((timeOfDay / 24) * Math.PI * 2) + 1) / 2);
  let oceanEfficiency = 0.5 + 0.5 * ((Math.sin((timeOfDay / 12) * Math.PI * 2) + 1) / 2);
  let biomassEfficiency = 1.0;
  let gridDemand = 100;
  let stabilityPenalty = 0;

  if (activeWeather === 'cloudy') solarEfficiency *= 0.2;
  else if (activeWeather === 'windy') { windEfficiency = 1.0; stabilityPenalty = 20; }
  else if (activeWeather === 'heatwave') gridDemand = 130;

  const actualSolar = mix.solar * solarEfficiency;
  const actualWind = mix.wind * windEfficiency;
  const actualOcean = mix.ocean * oceanEfficiency;
  const actualBiomass = mix.biomass * biomassEfficiency;

  const rawRenewable = actualSolar + actualWind + actualBiomass + actualOcean;
  const batteryBuffer = Math.min(batteryCapacity * 0.5, Math.max(0, gridDemand - rawRenewable));
  const totalRenewable = rawRenewable + batteryBuffer;
  const coalPercent = Math.max(0, gridDemand - totalRenewable);
  
  const batteryStabilityBonus = batteryCapacity * 0.15;
  const BATTERY_COST_PER_MWH = 1200; 
  const taxMultiplier = 3;
  const activeCoalCost = energyData.sources.coal.costPerMWh * (carbonTaxEnabled ? taxMultiplier : 1);

  useEffect(() => {
    const currentMix = { solar: actualSolar, wind: actualWind, biomass: actualBiomass, ocean: actualOcean, coal: coalPercent };
    let totalCost = 0, totalCo2 = 0, totalStability = 0;
    Object.keys(currentMix).forEach(source => {
      const weight = currentMix[source] / 100;
      const sourceCost = source === 'coal' ? activeCoalCost : energyData.sources[source].costPerMWh;
      totalCost += sourceCost * weight;
      totalCo2 += energyData.sources[source].co2PerMWh * weight;
      const stabilityWeight = (['solar', 'wind', 'ocean', 'biomass'].includes(source) ? mix[source] : currentMix[source]) / 100;
      totalStability += energyData.sources[source].stabilityScore * stabilityWeight;
    });
    totalCost += (BATTERY_COST_PER_MWH * (batteryBuffer / 100));
    totalStability = Math.max(0, Math.min(100, totalStability - stabilityPenalty + batteryStabilityBonus));
    setMetrics({ cost: totalCost, co2: totalCo2, stability: totalStability });
  }, [mix, coalPercent, actualSolar, actualWind, actualOcean, actualBiomass, stabilityPenalty, activeCoalCost, batteryBuffer]);

  const handleSliderChange = (source, value) => {
    let newVal = parseInt(value, 10);
    const otherRenewables = (mix.solar + mix.wind + mix.biomass + mix.ocean) - mix[source];
    if (newVal + otherRenewables > 100) newVal = 100 - otherRenewables;
    setMix({ ...mix, [source]: newVal });
  };

  const loadPreset = (presetKey, presetName) => {
    if (presetKey === 'current') setMix({ solar: 10, wind: 10, biomass: 5, ocean: 0 });
    if (presetKey === 'balanced') setMix({ solar: 30, wind: 20, biomass: 15, ocean: 5 });
    if (presetKey === 'utopia') setMix({ solar: 40, wind: 35, biomass: 10, ocean: 15 });
    setToastMsg(`✅ Loaded: ${presetName}`);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const toggleCarbonTax = () => {
    const newState = !carbonTaxEnabled;
    setCarbonTaxEnabled(newState);
    if (baselineMetrics) setBaselineMetrics(null);
    setToastMsg(newState ? '⚖️ Carbon Tax Enacted!' : '⚖️ Carbon Tax Revoked.');
    setTimeout(() => setToastMsg(null), 2000);
  };

  const exportToPDF = () => window.print();

  const animatedCost = useAnimatedNumber(metrics.cost);
  const animatedCo2 = useAnimatedNumber(metrics.co2);
  const animatedStability = useAnimatedNumber(metrics.stability);

  const formatDelta = (current, baseline, type) => {
    if (!baseline) return null;
    const diff = current - baseline;
    if (Math.abs(diff) < 0.5) return null;
    let color = '#94a3b8';
    const prefix = diff > 0 ? '+' : '';
    if (type === 'cost' || type === 'co2') color = diff > 0 ? '#ef4444' : '#10b981';
    else if (type === 'stability') color = diff > 0 ? '#10b981' : '#ef4444';
    return <span style={{ fontSize: '0.9rem', color, marginLeft: '8px', fontWeight: '800' }}>{prefix}{type === 'cost' ? '₹' : ''}{diff.toFixed(0)}</span>;
  };

  const getCo2Class = (co2) => co2 < 300 ? 'co2-low' : co2 < 700 ? 'co2-med' : 'co2-high';
  const formatTime = (time) => { const hours = Math.floor(time).toString().padStart(2, '0'); const minutes = time % 1 === 0.5 ? '30' : '00'; return `${hours}:${minutes}`; };

  const pieData = [
    { name: 'Solar', value: actualSolar, color: energyData.sources.solar.color },
    { name: 'Wind', value: actualWind, color: energyData.sources.wind.color },
    { name: 'Biomass', value: actualBiomass, color: energyData.sources.biomass.color },
    { name: 'Ocean', value: actualOcean, color: energyData.sources.ocean.color },
    { name: 'Coal', value: coalPercent, color: energyData.sources.coal.color },
    ...(batteryBuffer > 0 ? [{ name: 'Battery', value: batteryBuffer, color: '#8b5cf6' }] : []),
  ].filter(item => item.value > 0);

  const barData = [
    { name: 'Solar', Cost: (actualSolar / 100) * energyData.sources.solar.costPerMWh, fill: energyData.sources.solar.color },
    { name: 'Wind', Cost: (actualWind / 100) * energyData.sources.wind.costPerMWh, fill: energyData.sources.wind.color },
    { name: 'Biomass', Cost: (actualBiomass / 100) * energyData.sources.biomass.costPerMWh, fill: energyData.sources.biomass.color },
    { name: 'Ocean', Cost: (actualOcean / 100) * energyData.sources.ocean.costPerMWh, fill: energyData.sources.ocean.color },
    { name: 'Coal', Cost: (coalPercent / 100) * activeCoalCost, fill: energyData.sources.coal.color },
    ...(batteryBuffer > 0 ? [{ name: 'Battery', Cost: (batteryBuffer / 100) * BATTERY_COST_PER_MWH, fill: '#8b5cf6' }] : []),
  ].filter(item => item.Cost > 0);

 const tabVariants = {
  hidden: { opacity: 0, y: 15, filter: 'blur(4px)', position: 'absolute', width: '100%' },
  visible: { 
    opacity: 1, y: 0, filter: 'blur(0px)', position: 'relative', 
    transition: { type: 'spring', stiffness: 300, damping: 30, staggerChildren: 0.08 } 
  },
  exit: { opacity: 0, y: -15, filter: 'blur(4px)', position: 'absolute', width: '100%', transition: { duration: 0.15 } }
};

  const pdfAnnualCo2Mt = ((metrics.co2 * (8760 * activeCity.sizeGw) * 1000) / 1_000_000_000).toFixed(2);
  const pdfRenewableShare = ((totalRenewable / gridDemand) * 100).toFixed(1);
const innerItemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
};
  // Shared tooltip styles to force white text
  const tooltipStyle = { 
    background: 'rgba(15, 23, 42, 0.95)', 
    border: '1px solid #334155', 
    borderRadius: '8px', 
    color: '#ffffff',
    backdropFilter: 'blur(4px)'
  };
  const tooltipItemStyle = { color: '#ffffff' };

  return (
    <div className="dashboard-wrapper no-print">
      {tourStep >= 0 && (
        <div className="tour-modal">
          <h3 className="tour-title">Guided Tour ({tourStep + 1}/{tourContent.length})</h3>
          <p className="tour-text">{tourContent[tourStep]}</p>
          <div className="tour-actions">
            <button onClick={() => setTourStep(-1)} className="tour-skip">Skip</button>
            <button onClick={() => { if(tourStep < tourContent.length - 1) setTourStep(tourStep + 1); else setTourStep(-1); }} className="tour-next">
              {tourStep < tourContent.length - 1 ? 'Next ➡️' : 'Finish ✅'}
            </button>
          </div>
        </div>
      )}

      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="header-container">
        <div>
          <h1 className="main-title">Clean Energy Grid Simulator</h1>
          <p className="main-subtitle">Interactive analysis of cost, emissions, and stability.</p>
        </div>
        <div className="header-buttons">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={exportToPDF} className="btn-primary">📄 Export PDF</motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setTourStep(0)} className="btn-secondary">🎓 Tour</motion.button>
        </div>
      </motion.div>

      <div className="grid-container">
        {/* LEFT COLUMN */}
        <motion.div className="card cyber-card" whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
          <h2 className="card-title">Grid Configuration</h2>

                    <div className="tabs-container">
            {['environment', 'generation', 'storage'].map((tab) => (
              <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab === 'environment' ? '🌍 Environment' : tab === 'generation' ? '⚡ Generation' : '🔋 Storage & Policy'}
              </button>
            ))}
          </div>

          <div className="tab-content-wrapper">
            <AnimatePresence mode="popLayout">
              {activeTab === 'environment' && (
                <motion.div key="env" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
                  <div className="cyber-inner-card">
                    <div className="slider-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className="cyber-label">🕒 Time of Day</span>
                        <motion.button whileTap={{ scale: 0.9 }} className={`play-toggle-btn ${isPlaying ? 'playing' : ''}`} onClick={() => setIsPlaying(!isPlaying)}>
                          {isPlaying ? '⏸' : '▶'}
                        </motion.button>
                      </div>
                      <span className="time-badge">{formatTime(timeOfDay)}</span>
                    </div>
                    <input type="range" min="0" max="24" step="0.5" value={timeOfDay} onChange={(e) => { setTimeOfDay(parseFloat(e.target.value)); setIsPlaying(false); }} className="cyber-slider" />
                  </div>

                  <div className="preset-container">
                    <motion.button whileTap={{ scale: 0.95 }} className="preset-btn" onClick={() => loadPreset('current', 'Current Grid')}>Current</motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} className="preset-btn" onClick={() => loadPreset('balanced', 'Balanced Mix')}>Balanced</motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} className="preset-btn green" onClick={() => loadPreset('utopia', '100% Clean')}>100% Clean</motion.button>
                  </div>

                  <div className="weather-grid">
                    {[
                      { key: 'clear', icon: '☀️', label: 'Normal' },
                      { key: 'cloudy', icon: '☁️', label: 'Clouds' },
                      { key: 'windy', icon: '🌪️', label: 'Gale' },
                      { key: 'heatwave', icon: '🌡️', label: 'Heatwave' },
                    ].map(w => (
                      <motion.button key={w.key} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => { setActiveWeather(w.key); setToastMsg(`${w.icon} Weather: ${w.label}`); setTimeout(() => setToastMsg(null), 2000); }} 
                        className={`weather-btn ${activeWeather === w.key ? 'active' : ''}`}>
                        <span>{w.icon}</span> {w.label}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

                            {activeTab === 'generation' && (
                <motion.div key="gen" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
                  {[
                    { key: 'solar', label: '☀️ Solar', actual: actualSolar, color: '#FDB813' },
                    { key: 'wind', label: '🌬️ Wind', actual: actualWind, color: '#00A4E4' },
                    { key: 'biomass', label: '🌿 Biomass', actual: actualBiomass, color: '#8A9A5B' },
                    { key: 'ocean', label: '🌊 Ocean', actual: actualOcean, color: '#0077BE' },
                  ].map(s => (
                    <motion.div key={s.key} variants={innerItemVariants} className="cyber-inner-card" style={{ marginBottom: '0.75rem' }}>
                      <div className="slider-header">
                        <span className="cyber-label">{s.label}</span>
                        <span className="gen-stats">
                          <strong>{s.actual.toFixed(1)}%</strong>
                          <span className="gen-cap">/ {mix[s.key]}%</span>
                        </span>
                      </div>
                      <input type="range" min="0" max="100" value={mix[s.key]} onChange={(e) => handleSliderChange(s.key, e.target.value)} className="cyber-slider" />
                      
                      {/* NEW: Active Generation Visual Bar */}
                      {mix[s.key] > 0 && (
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginTop: '6px' }}>
                          <div 
                            className="active-gen-bar" 
                            style={{ 
                              width: `${(s.actual / mix[s.key]) * 100}%`, 
                              background: s.color,
                              boxShadow: `0 0 8px ${s.color}` 
                            }} 
                          />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'storage' && (
                <motion.div key="store" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
                  <div className={`cyber-inner-card ${carbonTaxEnabled ? 'tax-active' : ''}`}>
                    <div>
                      <div className="cyber-label" style={{ color: carbonTaxEnabled ? '#ef4444' : '#60a5fa' }}>⚖️ Carbon Tax Policy</div>
                      <div className="cyber-subtext" style={{ marginTop: '4px' }}>Applies a 3x penalty to fossil fuels.</div>
                    </div>
                    <button onClick={toggleCarbonTax} className="toggle-switch">
                      <motion.div layout className="toggle-knob" style={{ left: carbonTaxEnabled ? '26px' : '2px' }} />
                    </button>
                  </div>

                  <div className={`cyber-inner-card ${batteryCapacity > 0 ? 'battery-active' : ''}`}>
                    <div className="slider-header" style={{ marginBottom: '0.75rem' }}>
                      <div>
                        <span className="cyber-label" style={{ color: batteryCapacity > 0 ? '#8b5cf6' : '#94a3b8' }}>🔋 Battery Storage</span>
                        <div className="cyber-subtext">Buffers intermittency · ₹{BATTERY_COST_PER_MWH}/MWh</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong className="cyber-value" style={{ color: batteryCapacity > 0 ? '#8b5cf6' : '#94a3b8' }}>{batteryCapacity}%</strong>
                        {batteryBuffer > 0 && <div className="cyber-subtext" style={{ color: '#8b5cf6' }}>+{batteryBuffer.toFixed(1)}% buf</div>}
                      </div>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={batteryCapacity} onChange={(e) => setBatteryCapacity(parseInt(e.target.value, 10))} className="cyber-slider purple" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="fossil-backup" style={{ borderLeftColor: coalPercent > 0 ? '#ef4444' : '#10b981' }}>
            <h4>⛏️ Fossil Backup: {coalPercent.toFixed(1)}%</h4>
            <p>{coalPercent === 0 ? '✅ Grid is 100% Clean!' : 'Auto-scales to cover demand deficit.'}</p>
          </div>
        </motion.div>

        {/* RIGHT COLUMN */}
        <motion.div className="card cyber-card" whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
          <h2 className="card-title">Live Grid Analysis</h2>
          {metrics.stability < 60 && <div className="warning-banner"><span>⚠️</span> Grid stability critical!</div>}

          <div className="charts-row">
            <div className="chart-box glass-box">
              <div className="chart-title">Energy Volume Mix</div>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={pieData} innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value" isAnimationActive={false} stroke="none">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                                    <PieTooltip 
                    contentStyle={tooltipStyle} 
                    itemStyle={tooltipItemStyle} 
                    formatter={(value, name, entry) => [`${value.toFixed(1)}%`, entry.payload.name]} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-box glass-box">
              <div className="chart-title">Cost Contribution (₹)</div>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={barData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={0} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <BarTooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                    contentStyle={tooltipStyle} 
                    itemStyle={tooltipItemStyle} 
                    formatter={(value) => [`₹${value.toFixed(0)}`, "Cost"]} 
                  />
                  <Bar dataKey="Cost" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="kpi-header">
            <span className="cyber-label">Key Performance Indicators</span>
            {baselineMetrics ? (
              <button onClick={() => setBaselineMetrics(null)} className="kpi-btn baseline-clear">✖ Clear Base</button>
            ) : (
              <button onClick={() => setBaselineMetrics({ ...metrics })} className="kpi-btn baseline-lock">🔒 Lock Baseline</button>
            )}
          </div>

          <div className="metrics-grid">
            <div className="metric-box">
              <div className="metric-label">Avg Cost</div>
              <p className="metric-value">₹{animatedCost.toFixed(0)}</p>
              {baselineMetrics && <div>{formatDelta(metrics.cost, baselineMetrics.cost, 'cost')}</div>}
            </div>
            <div className={`metric-box ${getCo2Class(metrics.co2)}`}>
              <div className="metric-label">CO₂ Output</div>
              <p className="metric-value">{animatedCo2.toFixed(0)} <span className="metric-unit">kg</span></p>
              {baselineMetrics && <div>{formatDelta(metrics.co2, baselineMetrics.co2, 'co2')}</div>}
            </div>
            <div className={`metric-box ${metrics.stability >= 75 ? 'stability-high' : 'stability-low'}`}>
              <div className="metric-label">Stability</div>
              <p className="metric-value">{animatedStability.toFixed(0)}<span className="metric-unit">/100</span></p>
              {baselineMetrics && <div>{formatDelta(metrics.stability, baselineMetrics.stability, 'stability')}</div>}
            </div>
          </div>

          <Co2BudgetPanel co2PerMWh={metrics.co2} activeCity={activeCity} setActiveCity={setActiveCity} />
        </motion.div>
      </div>

      {toastMsg && <div className="toast-notification">{toastMsg}</div>}

      {/* PDF REPORT HIDDEN SECTION */}
      <div className="print-only-report">
        <div style={{ fontFamily: 'sans-serif', color: '#0f172a', padding: '40px' }}>
          <h1 style={{ borderBottom: '3px solid #1e293b', paddingBottom: '10px', color: '#0f172a', marginBottom: '5px' }}>Executive Grid Analysis Report</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '0', marginBottom: '30px' }}>Generated by Clean Energy Simulator</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
            <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
            <div><strong>Time:</strong> {formatTime(timeOfDay)}</div>
            <div><strong>Weather:</strong> <span style={{textTransform: 'capitalize'}}>{activeWeather}</span></div>
            <div><strong>Carbon Tax:</strong> {carbonTaxEnabled ? 'Active' : 'Inactive'}</div>
          </div>
          <h2 style={{ fontSize: '18px', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>1. Generation Mix Breakdown</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '14px' }}>
            <thead><tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}><th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Source</th><th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Installed</th><th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Active</th><th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Cost</th></tr></thead>
            <tbody>
              <tr><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>☀️ Solar</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{mix.solar}%</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{actualSolar.toFixed(1)}%</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>₹{((actualSolar/100) * energyData.sources.solar.costPerMWh).toFixed(0)}</td></tr>
              <tr><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>🌬️ Wind</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{mix.wind}%</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{actualWind.toFixed(1)}%</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>₹{((actualWind/100) * energyData.sources.wind.costPerMWh).toFixed(0)}</td></tr>
              <tr><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>🌿 Biomass</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{mix.biomass}%</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{actualBiomass.toFixed(1)}%</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>₹{((actualBiomass/100) * energyData.sources.biomass.costPerMWh).toFixed(0)}</td></tr>
              <tr><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>🌊 Ocean</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{mix.ocean}%</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{actualOcean.toFixed(1)}%</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>₹{((actualOcean/100) * energyData.sources.ocean.costPerMWh).toFixed(0)}</td></tr>
              <tr style={{ fontWeight: 'bold', background: '#fef2f2' }}><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>⛏️ Coal</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>--</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', color: '#dc2626' }}>{coalPercent.toFixed(1)}%</td><td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>₹{((coalPercent/100) * activeCoalCost).toFixed(0)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;