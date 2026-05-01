import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import energyData from './energyData.json';
import './App.css';

// ==========================================
// MOCK DATABASE: Indian Metros
// ==========================================
const CITY_DATABASE = {
  chennai: { id: 'chennai', name: 'Chennai', sizeGw: 1.5, baselineMt: 7.2, targetMt: 1.5 },
  mumbai: { id: 'mumbai', name: 'Mumbai', sizeGw: 3.2, baselineMt: 15.5, targetMt: 3.2 },
  delhi: { id: 'delhi', name: 'New Delhi', sizeGw: 4.0, baselineMt: 19.8, targetMt: 4.0 },
  bangalore: { id: 'bangalore', name: 'Bangalore', sizeGw: 2.0, baselineMt: 8.5, targetMt: 2.0 },
};

// ==========================================
// CUSTOM HOOK: Smooth Number Rolling
// ==========================================
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

// ==========================================
// CO2 BUDGET PANEL COMPONENT
// ==========================================
const Co2BudgetPanel = ({ co2PerMWh, activeCity, setActiveCity }) => {
  const CITY_GWH_PER_YEAR = 8760 * activeCity.sizeGw; 
  const annualCo2Mt = (co2PerMWh * CITY_GWH_PER_YEAR * 1000) / 1_000_000_000; 

  const pct = Math.min((annualCo2Mt / activeCity.baselineMt) * 100, 100);
  const targetPct = (activeCity.targetMt / activeCity.baselineMt) * 100;
  const isUnderTarget = annualCo2Mt <= activeCity.targetMt;

  const barColor = isUnderTarget ? '#10b981' : annualCo2Mt < (activeCity.targetMt * 2.5) ? '#f59e0b' : '#ef4444';
  const label = isUnderTarget ? '✅ Under Net-Zero Target' : annualCo2Mt < (activeCity.targetMt * 2.5) ? '⚡ Progress — keep going' : '🔴 Above safe level';

  return (
    <div style={{
      marginTop: '1.5rem', padding: '1.25rem', borderRadius: '14px',
      background: isUnderTarget ? 'linear-gradient(135deg, rgba(240,253,244,0.95) 0%, rgba(220,252,231,0.7) 100%)' : 'linear-gradient(135deg, rgba(254,252,232,0.95) 0%, rgba(254,240,138,0.4) 100%)',
      border: `1px solid ${isUnderTarget ? '#86efac' : '#fde68a'}`,
      transition: 'all 0.3s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🌍 Annual CO₂ Budget
          </div>
          <div style={{ marginTop: '6px' }}>
            <select 
              value={activeCity.id} 
              onChange={(e) => setActiveCity(CITY_DATABASE[e.target.value])}
              style={{ 
                padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', 
                background: 'white', fontSize: '0.8rem', fontWeight: '600', color: '#0f172a',
                cursor: 'pointer', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              {Object.values(CITY_DATABASE).map(city => (
                <option key={city.id} value={city.id}>{city.name} Region</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: barColor, lineHeight: 1, transition: 'color 0.3s ease' }}>{annualCo2Mt.toFixed(2)}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Mt CO₂/yr</div>
        </div>
      </div>

      <div style={{ position: 'relative', height: '10px', background: 'rgba(0,0,0,0.08)', borderRadius: '999px', overflow: 'visible', marginBottom: '0.5rem' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '999px', transition: 'width 0.3s ease-out, background 0.3s ease' }} />
        <div style={{ position: 'absolute', top: '-4px', left: `${targetPct}%`, width: '2px', height: '18px', background: '#1e293b', borderRadius: '1px' }}>
          <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap' }}>Target</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginTop: '1.25rem' }}>
        <span>{label}</span><span>Baseline: {activeCity.baselineMt} Mt · Target: {activeCity.targetMt} Mt</span>
      </div>
    </div>
  );
};

// ==========================================
// MAIN DASHBOARD
// ==========================================
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
    "👋 Welcome to the Clean Energy Simulator! Click 'Next' to take a quick tour.",
    "▶️ Try clicking the 'Play' button! Watch how Solar dies at night.",
    "🌦️ Try clicking a Weather Event! See how Heatwaves spike demand.",
    "⚖️ Flip the Carbon Tax toggle! Watch the economics flip.",
    "🌍 Change your City to see how different grid sizes affect carbon targets!",
    "📄 Click 'Export PDF' to generate a professional Executive Report of your current configuration."
  ];

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimeOfDay(prev => prev >= 24 ? 0 : prev + 0.5);
      }, 400);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Physics Engine
  let solarEfficiency = timeOfDay > 6 && timeOfDay < 18 ? Math.sin(((timeOfDay - 6) / 12) * Math.PI) : 0;
  let windEfficiency = 0.4 + 0.6 * ((Math.cos((timeOfDay / 24) * Math.PI * 2) + 1) / 2);
  let oceanEfficiency = 0.5 + 0.5 * ((Math.sin((timeOfDay / 12) * Math.PI * 2) + 1) / 2);
  let biomassEfficiency = 1.0;
  let gridDemand = 100;
  let stabilityPenalty = 0;

  if (activeWeather === 'cloudy') { solarEfficiency *= 0.2; }
  else if (activeWeather === 'windy') { windEfficiency = 1.0; stabilityPenalty = 20; }
  else if (activeWeather === 'heatwave') { gridDemand = 130; }

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

  // Metrics Calc
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

    const batteryWeight = (batteryBuffer / 100);
    totalCost += BATTERY_COST_PER_MWH * batteryWeight;
    totalStability = Math.max(0, Math.min(100, totalStability - stabilityPenalty + batteryStabilityBonus));

    setMetrics({ cost: totalCost, co2: totalCo2, stability: totalStability });
  }, [mix, coalPercent, actualSolar, actualWind, actualOcean, actualBiomass, stabilityPenalty, activeCoalCost, batteryBuffer, batteryStabilityBonus]);

  // Handlers
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
    setToastMsg(`✅ Scenario Loaded: ${presetName}`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const toggleCarbonTax = () => {
    const newState = !carbonTaxEnabled;
    setCarbonTaxEnabled(newState);
    setToastMsg(newState ? '⚖️ Carbon Tax Enacted!' : '⚖️ Carbon Tax Revoked.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  // NATIVE BROWSER PRINT FUNCTION
  const exportToPDF = () => {
    window.print();
  };

  const animatedCost = useAnimatedNumber(metrics.cost);
  const animatedCo2 = useAnimatedNumber(metrics.co2);
  const animatedStability = useAnimatedNumber(metrics.stability);

  const formatDelta = (current, baseline, type) => {
    if (!baseline) return null;
    const diff = current - baseline;
    if (Math.abs(diff) < 0.5) return null;
    let color = '#64748b';
    const prefix = diff > 0 ? '+' : '';
    if (type === 'cost' || type === 'co2') color = diff > 0 ? '#ef4444' : '#10b981';
    else if (type === 'stability') color = diff > 0 ? '#10b981' : '#ef4444';
    return <span style={{ fontSize: '1.1rem', color, marginLeft: '8px', fontWeight: '800' }}>{prefix}{type === 'cost' ? '₹' : ''}{diff.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span>;
  };

  const getCo2Class = (co2) => co2 < 300 ? 'co2-low' : co2 < 700 ? 'co2-med' : 'co2-high';
  const formatTime = (time) => { const hours = Math.floor(time).toString().padStart(2, '0'); const minutes = time % 1 === 0.5 ? '30' : '00'; return `${hours}:${minutes}`; };

  // Chart Data
  const pieData = [
    { name: energyData.sources.solar.name, value: actualSolar, color: energyData.sources.solar.color },
    { name: energyData.sources.wind.name, value: actualWind, color: energyData.sources.wind.color },
    { name: energyData.sources.biomass.name, value: actualBiomass, color: energyData.sources.biomass.color },
    { name: energyData.sources.ocean.name, value: actualOcean, color: energyData.sources.ocean.color },
    { name: energyData.sources.coal.name, value: coalPercent, color: energyData.sources.coal.color },
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
    hidden: { opacity: 0, x: -15, position: 'absolute', width: '100%' },
    visible: { opacity: 1, x: 0, position: 'relative', transition: { type: 'spring', stiffness: 300, damping: 30 } },
    exit: { opacity: 0, x: 15, position: 'absolute', width: '100%', transition: { duration: 0.2 } }
  };

  // Pre-calculate values for the PDF Report
  const pdfAnnualCo2Mt = ((metrics.co2 * (8760 * activeCity.sizeGw) * 1000) / 1_000_000_000).toFixed(2);
  const pdfRenewableShare = ((totalRenewable / gridDemand) * 100).toFixed(1);

  return (
    <div className="dashboard-wrapper">
      {tourStep >= 0 && (
        <div className="no-print" style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#1e293b', color: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', width: '90%', maxWidth: '500px', border: '2px solid #3b82f6' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#60a5fa' }}>Guided Tour ({tourStep + 1}/{tourContent.length})</h3>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', lineHeight: '1.5' }}>{tourContent[tourStep]}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setTourStep(-1)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}>Skip Tour</button>
            <button onClick={() => { if(tourStep < tourContent.length - 1) setTourStep(tourStep + 1); else setTourStep(-1); }} style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '0.5rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              {tourStep < tourContent.length - 1 ? 'Next ➡️' : 'Finish ✅'}
            </button>
          </div>
        </div>
      )}

      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, type: 'spring' }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2rem 0', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title" style={{ textAlign: 'left', margin: '0' }}>Clean Energy Grid Simulator</h1>
          <p className="subtitle" style={{ textAlign: 'left', margin: '0' }}>Interactive analysis of cost, emissions, and stability.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} 
            onClick={exportToPDF}
            style={{ padding: '0.6rem 1.25rem', borderRadius: '20px', border: '1px solid #cbd5e1', background: '#0f172a', cursor: 'pointer', fontWeight: '700', color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          >
            📄 Export PDF
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setTourStep(0)} 
            style={{ padding: '0.6rem 1.25rem', borderRadius: '20px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: '700', color: '#475569', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
          >
            🎓 Start Tour
          </motion.button>
        </div>
      </motion.div>

      <div className="grid-container" style={{ padding: '0.5rem', background: 'transparent' }}>
        <motion.div className="card" whileHover={{ y: -2, boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.1)" }} transition={{ type: 'spring', stiffness: 300 }}>
          <h2 className="card-title">Grid Configuration</h2>

          <div className="tabs-container">
            {['environment', 'generation', 'storage'].map((tab) => (
              <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                <span className="tab-label">{tab === 'environment' ? '🌍 Environment' : tab === 'generation' ? '⚡ Generation' : '🔋 Storage & Policy'}</span>
                {activeTab === tab && <motion.div layoutId="activeTab" className="tab-active-bg" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              </button>
            ))}
          </div>

          <div className="tab-content-wrapper">
            <AnimatePresence mode="popLayout">
              {activeTab === 'environment' && (
                <motion.div key="env" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
                  <div className="slider-group" style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                    <div className="slider-header" style={{ color: '#3b82f6', fontWeight: '800', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span>🕒 Time of Day</span>
                        <motion.button whileTap={{ scale: 0.9 }} className={`play-toggle-btn ${isPlaying ? 'playing' : ''}`} onClick={() => setIsPlaying(!isPlaying)}>
                          {isPlaying ? '⏸ Pause' : '▶ Play'}
                        </motion.button>
                      </div>
                      <span style={{ fontSize: '1.25rem', letterSpacing: '1px', background: '#e0f2fe', padding: '0.2rem 0.5rem', borderRadius: '8px' }}>{formatTime(timeOfDay)}</span>
                    </div>
                    <input type="range" min="0" max="24" step="0.5" value={timeOfDay} onChange={(e) => { setTimeOfDay(parseFloat(e.target.value)); setIsPlaying(false); }} />
                  </div>

                  <div className="preset-container">
                    <motion.button whileTap={{ scale: 0.95 }} className="preset-btn" onClick={() => loadPreset('current', 'Current Grid')}>Current</motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} className="preset-btn" onClick={() => loadPreset('balanced', 'Balanced Mix')}>Balanced</motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} className="preset-btn green" onClick={() => loadPreset('utopia', '100% Clean')}>100% Clean</motion.button>
                  </div>

                  <div style={{ padding: '1.25rem', background: activeWeather === 'clear' ? 'rgba(241,245,249,0.5)' : 'rgba(254,243,199,0.4)', borderRadius: '14px', border: '1px dashed #cbd5e1', transition: 'all 0.4s ease' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>Live Weather Events</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {[
                        { key: 'clear', icon: '☀️', label: 'Normal', activeBorder: '#3b82f6', activeBg: '#eff6ff', activeText: '#1d4ed8' },
                        { key: 'cloudy', icon: '☁️', label: 'Clouds', activeBorder: '#64748b', activeBg: '#f1f5f9', activeText: '#334155' },
                        { key: 'windy', icon: '🌪️', label: 'Gale', activeBorder: '#8b5cf6', activeBg: '#f5f3ff', activeText: '#6d28d9' },
                        { key: 'heatwave', icon: '🌡️', label: 'Heatwave', activeBorder: '#ef4444', activeBg: '#fef2f2', activeText: '#b91c1c' },
                      ].map(w => {
                        const isActive = activeWeather === w.key;
                        return (
                          <motion.button 
                            key={w.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => { setActiveWeather(w.key); setToastMsg(`${w.icon} Weather updated to ${w.label}`); setTimeout(() => setToastMsg(null), 3000); }} 
                            style={{ 
                              padding: '0.75rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                              border: isActive ? `2px solid ${w.activeBorder}` : '1px solid #e2e8f0', 
                              background: isActive ? w.activeBg : 'white', 
                              color: isActive ? w.activeText : '#475569',
                              boxShadow: isActive ? `0 4px 12px ${w.activeBorder}33` : '0 2px 4px rgba(0,0,0,0.02)',
                              cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', transition: 'all 0.2s ease' 
                            }}>
                            <span style={{ fontSize: '1.1rem' }}>{w.icon}</span> {w.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'generation' && (
                <motion.div key="gen" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
                  {[
                    { key: 'solar', label: '☀️ Solar Generation', actual: actualSolar, color: actualSolar < mix.solar ? '#ef4444' : 'inherit' },
                    { key: 'wind', label: '🌬️ Wind Generation', actual: actualWind, color: activeWeather === 'windy' ? '#8b5cf6' : (actualWind < mix.wind ? '#ef4444' : '#10b981') },
                    { key: 'biomass', label: '🌿 Biomass Generation', actual: actualBiomass, color: 'inherit' },
                    { key: 'ocean', label: '🌊 Ocean Generation', actual: actualOcean, color: actualOcean < mix.ocean ? '#f59e0b' : '#10b981' },
                  ].map(s => (
                    <motion.div layout key={s.key} className="slider-group">
                      <div className="slider-header">
                        <span>{s.label}</span>
                        <span style={{ color: s.color, transition: 'color 0.4s' }}>
                          <strong style={{ fontSize: '1.1rem' }}>{s.actual.toFixed(1)}%</strong>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '6px' }}>(Cap: {mix[s.key]}%)</span>
                        </span>
                      </div>
                      <input type="range" min="0" max="100" value={mix[s.key]} onChange={(e) => handleSliderChange(s.key, e.target.value)} />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'storage' && (
                <motion.div key="store" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: carbonTaxEnabled ? '#fef2f2' : '#f8fafc', borderRadius: '14px', border: `1px solid ${carbonTaxEnabled ? '#ef4444' : '#e2e8f0'}`, marginBottom: '1.5rem', transition: 'all 0.5s ease' }}>
                    <div>
                      <div style={{ fontWeight: '800', color: carbonTaxEnabled ? '#ef4444' : '#3b82f6', fontSize: '1rem' }}>⚖️ Carbon Tax Policy</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Applies a 3x financial penalty to fossil fuels.</div>
                    </div>
                    <button onClick={toggleCarbonTax} style={{ width: '52px', height: '28px', background: carbonTaxEnabled ? '#ef4444' : '#cbd5e1', borderRadius: '14px', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.4s' }}>
                      <motion.div layout style={{ position: 'absolute', top: '2px', left: carbonTaxEnabled ? '26px' : '2px', width: '24px', height: '24px', background: 'white', borderRadius: '50%', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} />
                    </button>
                  </div>

                  <div style={{ padding: '1.25rem', borderRadius: '14px', background: batteryCapacity > 0 ? 'linear-gradient(135deg, rgba(237,233,254,0.95) 0%, rgba(221,214,254,0.6) 100%)' : '#f8fafc', border: `1px solid ${batteryCapacity > 0 ? '#c4b5fd' : '#e2e8f0'}` }}>
                    <div className="slider-header" style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: batteryCapacity > 0 ? '#7c3aed' : '#475569', fontWeight: '800' }}>🔋 Battery Storage</span>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Buffers intermittency · ₹{BATTERY_COST_PER_MWH}/MWh</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1.1rem', color: batteryCapacity > 0 ? '#7c3aed' : '#475569' }}>{batteryCapacity}%</strong>
                        {batteryBuffer > 0 && (<div style={{ fontSize: '0.72rem', color: '#7c3aed' }}>+{batteryBuffer.toFixed(1)}% buffered</div>)}
                      </div>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={batteryCapacity} onChange={(e) => setBatteryCapacity(parseInt(e.target.value, 10))} style={{ accentColor: '#7c3aed' }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div layout className="fossil-backup" style={{ marginTop: '1.5rem', borderLeftColor: activeWeather === 'heatwave' ? '#ef4444' : (carbonTaxEnabled ? '#ef4444' : '#64748b'), background: carbonTaxEnabled ? 'rgba(254,242,242,0.5)' : undefined }}>
            <h4>⛏️ Fossil Backup (Coal): {coalPercent.toFixed(1)}%</h4>
            <p>{coalPercent === 0 ? '✅ Grid is 100% powered by Clean Energy!' : 'Automatically scales to cover the remaining grid demand.'}</p>
          </motion.div>
        </motion.div>

        <motion.div className="card" whileHover={{ y: -2, boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.1)" }} transition={{ type: 'spring', stiffness: 300 }}>
          <h2 className="card-title">Live Grid Analysis</h2>
          {metrics.stability < 60 && (<div className="warning-banner"><span>⚠️</span> Warning: Grid stability critical!</div>)}

          <div className="charts-row">
            <div className="chart-box">
              <div className="chart-title">Energy Volume Mix</div>
              <motion.div style={{ width: '100%', height: '90%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value" isAnimationActive={false}>
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <PieTooltip formatter={(value) => `${value.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>
            </div>
            <div className="chart-box">
              <div className="chart-title">Cost Contribution (₹)</div>
              <motion.div style={{ width: '100%', height: '90%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <BarTooltip formatter={(value) => `₹${value.toFixed(0)}`} cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="Cost" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderTop: '2px solid #f1f5f9', paddingTop: '1.5rem' }}>
            <span style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase' }}>Key Performance Indicators</span>
            {baselineMetrics ? (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setBaselineMetrics(null)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>✖ Clear Baseline</motion.button>
            ) : (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setBaselineMetrics({ ...metrics })} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>🔒 Lock Baseline</motion.button>
            )}
          </div>

          <div className="metrics-grid" style={{ marginTop: '0' }}>
            <motion.div layout className="metric-box cost" style={{ background: carbonTaxEnabled ? 'rgba(254,242,242,0.95)' : undefined, borderColor: carbonTaxEnabled ? '#fca5a5' : undefined }}>
              <div className="metric-label" style={{ color: carbonTaxEnabled ? '#dc2626' : undefined }}>Avg Cost</div>
              <p className="metric-value">₹{animatedCost.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
              {baselineMetrics && <div>{formatDelta(metrics.cost, baselineMetrics.cost, 'cost')}</div>}
            </motion.div>

            <motion.div layout className={`metric-box ${getCo2Class(metrics.co2)}`}>
              <div className="metric-label">CO₂ Output</div>
              <p className="metric-value">{animatedCo2.toFixed(0)} <span style={{ fontSize: '1rem' }}>kg</span></p>
              {baselineMetrics && <div>{formatDelta(metrics.co2, baselineMetrics.co2, 'co2')}</div>}
            </motion.div>

            <motion.div layout className={`metric-box ${metrics.stability >= 75 ? 'stability-high' : 'stability-low'}`}>
              <div className="metric-label">Grid Stability</div>
              <p className="metric-value">{animatedStability.toFixed(0)}<span style={{ fontSize: '1rem' }}>/100</span></p>
              {baselineMetrics && <div>{formatDelta(metrics.stability, baselineMetrics.stability, 'stability')}</div>}
            </motion.div>
          </div>

          <Co2BudgetPanel co2PerMWh={metrics.co2} activeCity={activeCity} setActiveCity={setActiveCity} />
        </motion.div>
      </div>

      {toastMsg && <div className="toast-notification">{toastMsg}</div>}

      {/* ── NATIVE HTML PRINT REPORT CONTAINER ── */}
      <div className="print-only-report">
        <div style={{ fontFamily: 'sans-serif', color: '#0f172a' }}>
          
          <h1 style={{ borderBottom: '3px solid #1e293b', paddingBottom: '10px', color: '#0f172a', marginBottom: '5px', fontWeight: 'bold' }}>
            Executive Grid Analysis Report
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '0', marginBottom: '30px' }}>
            Generated by Clean Energy Simulator
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div><strong style={{color: '#475569', marginRight: '6px'}}>Date:</strong> {new Date().toLocaleDateString()}</div>
            <div><strong style={{color: '#475569', marginRight: '6px'}}>Time of Day:</strong> {formatTime(timeOfDay)}</div>
            <div><strong style={{color: '#475569', marginRight: '6px'}}>Weather:</strong> <span style={{textTransform: 'capitalize'}}>{activeWeather}</span></div>
            <div><strong style={{color: '#475569', marginRight: '6px'}}>Carbon Tax:</strong> {carbonTaxEnabled ? 'Active' : 'Inactive'}</div>
          </div>

          <h2 style={{ fontSize: '18px', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', fontWeight: 'bold' }}>
            1. Key Performance Indicators
          </h2>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
            <div style={{ flex: 1, background: '#eff6ff', padding: '20px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2563eb', textTransform: 'uppercase' }}>Avg Cost (MWh)</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e3a8a', marginTop: '5px' }}>₹{metrics.cost.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</div>
            </div>
            <div style={{ flex: 1, background: '#fef2f2', padding: '20px', borderRadius: '8px', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#dc2626', textTransform: 'uppercase' }}>CO₂ Output</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7f1d1d', marginTop: '5px' }}>{metrics.co2.toFixed(0)} <span style={{marginLeft: '2px'}}>kg</span></div>
            </div>
            <div style={{ flex: 1, background: '#ecfdf5', padding: '20px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#059669', textTransform: 'uppercase' }}>Grid Stability</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#064e3b', marginTop: '5px' }}>{metrics.stability.toFixed(0)} / 100</div>
            </div>
          </div>

          <h2 style={{ fontSize: '18px', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', fontWeight: 'bold' }}>
            2. Generation Mix Breakdown
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Energy Source</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Installed Cap.</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Active Gen.</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Cost Impact</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}><span style={{marginRight: '6px'}}>☀️</span>Solar</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{mix.solar}%</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{actualSolar.toFixed(1)}%</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>₹{((actualSolar/100) * energyData.sources.solar.costPerMWh).toFixed(0)}</td>
              </tr>
              <tr>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}><span style={{marginRight: '6px'}}>🌬️</span>Wind</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{mix.wind}%</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{actualWind.toFixed(1)}%</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>₹{((actualWind/100) * energyData.sources.wind.costPerMWh).toFixed(0)}</td>
              </tr>
              <tr>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}><span style={{marginRight: '6px'}}>🌿</span>Biomass</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{mix.biomass}%</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>{actualBiomass.toFixed(1)}%</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>₹{((actualBiomass/100) * energyData.sources.biomass.costPerMWh).toFixed(0)}</td>
              </tr>
              <tr style={{ fontWeight: 'bold', background: '#fef2f2' }}>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}><span style={{marginRight: '6px'}}>⛏️</span>Coal (Backup)</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>--</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', color: '#dc2626' }}>{coalPercent.toFixed(1)}%</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>₹{((coalPercent/100) * activeCoalCost).toFixed(0)}</td>
              </tr>
            </tbody>
          </table>

          <h2 style={{ fontSize: '18px', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', fontWeight: 'bold' }}>
            3. Environmental Impact & Policy
          </h2>
          <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}><strong>Analyzed Region:</strong></span>
              <span style={{ fontWeight: 'bold' }}>{activeCity.name} <span style={{marginLeft: '4px'}}>({activeCity.sizeGw} GW Grid)</span></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}><strong>Clean Energy Share:</strong></span>
              <span style={{ fontWeight: 'bold', color: pdfRenewableShare >= 80 ? '#10b981' : '#dc2626' }}>{pdfRenewableShare}% <span style={{color: '#64748b', fontWeight: 'normal'}}>(Target: 80%)</span></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}><strong>Annual CO₂ Projection:</strong></span>
              <span style={{ fontWeight: 'bold', color: pdfAnnualCo2Mt <= activeCity.targetMt ? '#10b981' : '#dc2626' }}>
                {pdfAnnualCo2Mt} <span style={{marginLeft: '4px'}}>Mt / year</span>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}><strong>Regional Net-Zero Target:</strong></span>
              <span style={{ fontWeight: 'bold' }}>{activeCity.targetMt} <span style={{marginLeft: '4px'}}>Mt / year</span></span>
            </div>
          </div>

          <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
            This document was generated automatically by the Clean Energy Simulator.<br />
            Analysis is based on configured variables and historical regional baseline estimates.
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default Dashboard;