import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip } from 'recharts';
import energyData from './energyData.json';
import './App.css';

// ==========================================
// CUSTOM HOOK: Smooth Number Rolling Animation
// ==========================================
const useAnimatedNumber = (endValue, duration = 800) => {
  const [value, setValue] = useState(endValue);

  useEffect(() => {
    let startTime = null;
    const startValue = value;
    const change = endValue - startValue;

    if (change === 0) return;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // easeOutExpo for a snappy but smooth finish
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setValue(startValue + change * ease);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [endValue, duration]);

  return value;
};

const Dashboard = () => {
  const [mix, setMix] = useState({ solar: 20, wind: 20, biomass: 10, ocean: 0 });
  const [metrics, setMetrics] = useState({ cost: 0, co2: 0, stability: 0 });
  const [toastMsg, setToastMsg] = useState(null);
  const [baselineMetrics, setBaselineMetrics] = useState(null);
  const [activeWeather, setActiveWeather] = useState('clear');
  const [carbonTaxEnabled, setCarbonTaxEnabled] = useState(false);

  const [tourStep, setTourStep] = useState(-1);
  const tourContent = [
    "👋 Welcome to the Clean Energy Simulator! Click 'Next' to take a quick tour.",
    "▶️ Try clicking the 'Play' button! Watch how Solar dies at night, Wind picks up, and Tides roll in.",
    "🌦️ Try clicking a Weather Event! See how Heatwaves spike demand or Clouds kill solar output.",
    "⚖️ Flip the Carbon Tax toggle! Watch the economics flip, making dirty energy massively expensive.",
    "🎛️ Use the Sliders to adjust your base installed capacity.",
    "🔒 Try clicking 'Lock Baseline' above the metrics, then change the weather or tax policy to see the financial impact!"
  ];

  const [timeOfDay, setTimeOfDay] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimeOfDay((prevTime) => (prevTime >= 24 ? 0 : prevTime + 0.5));
      }, 400); 
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const sourceIcons = { solar: "☀️", wind: "🌬️", biomass: "🌿", ocean: "🌊" };

  // ==========================================
  // THE MATH: Physics, Weather & Economics
  // ==========================================
  let solarEfficiency = timeOfDay > 6 && timeOfDay < 18 ? Math.sin(((timeOfDay - 6) / 12) * Math.PI) : 0;
  let windEfficiency = 0.4 + 0.6 * ((Math.cos((timeOfDay / 24) * Math.PI * 2) + 1) / 2);
  let oceanEfficiency = 0.5 + 0.5 * ((Math.sin((timeOfDay / 12) * Math.PI * 2) + 1) / 2);
  let biomassEfficiency = 1.0;
  
  let gridDemand = 100;
  let stabilityPenalty = 0;

  if (activeWeather === 'cloudy') {
    solarEfficiency *= 0.2; 
  } else if (activeWeather === 'windy') {
    windEfficiency = 1.0; 
    stabilityPenalty = 20; 
  } else if (activeWeather === 'heatwave') {
    gridDemand = 130; 
  }

  const actualSolar = mix.solar * solarEfficiency;
  const actualWind = mix.wind * windEfficiency;
  const actualOcean = mix.ocean * oceanEfficiency;
  const actualBiomass = mix.biomass * biomassEfficiency;

  const totalRenewable = actualSolar + actualWind + actualBiomass + actualOcean;
  const coalPercent = Math.max(0, gridDemand - totalRenewable);

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
      const stabilityWeight = (source === 'solar' || source === 'wind' || source === 'ocean' || source === 'biomass' ? mix[source] : currentMix[source]) / 100;
      totalStability += energyData.sources[source].stabilityScore * stabilityWeight;
    });
    
    totalStability = Math.max(0, totalStability - stabilityPenalty);
    setMetrics({ cost: totalCost, co2: totalCo2, stability: totalStability });
  }, [mix, coalPercent, actualSolar, actualWind, actualOcean, actualBiomass, stabilityPenalty, activeCoalCost]);

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

  const handleSetBaseline = () => {
    setBaselineMetrics({ ...metrics });
    setToastMsg('🔒 Baseline locked! Adjust settings to see the impact.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const triggerWeather = (weatherType, msg) => {
    setActiveWeather(weatherType);
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const toggleCarbonTax = () => {
    const newState = !carbonTaxEnabled;
    setCarbonTaxEnabled(newState);
    setToastMsg(newState ? '⚖️ Carbon Tax Enacted! Fossil fuel costs multiplied.' : '⚖️ Carbon Tax Revoked.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Setup animated values for the UI
  const animatedCost = useAnimatedNumber(metrics.cost);
  const animatedCo2 = useAnimatedNumber(metrics.co2);
  const animatedStability = useAnimatedNumber(metrics.stability);

  const formatDelta = (current, baseline, type) => {
    if (!baseline) return null;
    const diff = current - baseline;
    if (Math.abs(diff) < 0.5) return null;

    let color = '#64748b';
    let prefix = diff > 0 ? '+' : '';

    if (type === 'cost' || type === 'co2') {
      color = diff > 0 ? '#ef4444' : '#10b981';
    } else if (type === 'stability') {
      color = diff > 0 ? '#10b981' : '#ef4444';
    }

    return (
      <span style={{ fontSize: '1.1rem', color: color, marginLeft: '8px', fontWeight: '800', transition: 'all 0.3s ease' }}>
        {prefix}{type === 'cost' ? '₹' : ''}{diff.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
      </span>
    );
  };

  const getCo2Class = (co2) => { if (co2 < 300) return 'co2-low'; if (co2 < 700) return 'co2-med'; return 'co2-high'; };
  const formatTime = (time) => {
    const hours = Math.floor(time).toString().padStart(2, '0');
    const minutes = (time % 1 === 0.5) ? '30' : '00';
    return `${hours}:${minutes}`;
  };

  const pieData = [
    { name: energyData.sources.solar.name, value: actualSolar, color: energyData.sources.solar.color },
    { name: energyData.sources.wind.name, value: actualWind, color: energyData.sources.wind.color },
    { name: energyData.sources.biomass.name, value: actualBiomass, color: energyData.sources.biomass.color },
    { name: energyData.sources.ocean.name, value: actualOcean, color: energyData.sources.ocean.color },
    { name: energyData.sources.coal.name, value: coalPercent, color: energyData.sources.coal.color }
  ].filter(item => item.value > 0);

  const barData = [
    { name: 'Solar', Cost: (actualSolar / 100) * energyData.sources.solar.costPerMWh, fill: energyData.sources.solar.color },
    { name: 'Wind', Cost: (actualWind / 100) * energyData.sources.wind.costPerMWh, fill: energyData.sources.wind.color },
    { name: 'Biomass', Cost: (actualBiomass / 100) * energyData.sources.biomass.costPerMWh, fill: energyData.sources.biomass.color },
    { name: 'Ocean', Cost: (actualOcean / 100) * energyData.sources.ocean.costPerMWh, fill: energyData.sources.ocean.color },
    { name: 'Coal', Cost: (coalPercent / 100) * activeCoalCost, fill: energyData.sources.coal.color }
  ].filter(item => item.Cost > 0);

  return (
    <div className="dashboard-wrapper">
      
      {tourStep >= 0 && (
        <div className="no-print" style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#1e293b', color: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', width: '90%', maxWidth: '500px', border: '2px solid #3b82f6', transition: 'all 0.4s ease-out' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#60a5fa' }}>Guided Tour ({tourStep + 1}/{tourContent.length})</h3>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', lineHeight: '1.5' }}>{tourContent[tourStep]}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setTourStep(-1)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}>Skip Tour</button>
            <button onClick={() => { if(tourStep < tourContent.length - 1) setTourStep(tourStep + 1); else setTourStep(-1); }} style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '0.5rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}>
              {tourStep < tourContent.length - 1 ? 'Next ➡️' : 'Finish ✅'}
            </button>
          </div>
        </div>
      )}

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2rem 0', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title" style={{ textAlign: 'left', margin: '0' }}>Clean Energy Grid Simulator</h1>
          <p className="subtitle" style={{ textAlign: 'left', margin: '0' }}>Interactive analysis of cost, emissions, and stability.</p>
        </div>
        <button onClick={() => setTourStep(0)} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'transform 0.2s' }}>
          🎓 Start Tour
        </button>
      </div>
      
      <div className="grid-container" style={{ padding: '0.5rem', background: 'transparent' }}>
        
        <div className="card">
          <h2 className="card-title">Grid Configuration</h2>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: carbonTaxEnabled ? '#fef2f2' : '#f8fafc', borderRadius: '12px', border: `1px solid ${carbonTaxEnabled ? '#ef4444' : '#e2e8f0'}`, marginBottom: '1.5rem', transition: 'all 0.5s ease' }}>
            <div>
              <div style={{ fontWeight: '800', color: carbonTaxEnabled ? '#ef4444' : '#3b82f6', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'color 0.5s ease' }}>
                ⚖️ Carbon Tax Policy
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Applies a 3x financial penalty to fossil fuels.</div>
            </div>
            <button 
               onClick={toggleCarbonTax}
               style={{ width: '52px', height: '28px', background: carbonTaxEnabled ? '#ef4444' : '#cbd5e1', borderRadius: '14px', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
               <div style={{ position: 'absolute', top: '2px', left: carbonTaxEnabled ? '26px' : '2px', width: '24px', height: '24px', background: 'white', borderRadius: '50%', transition: 'left 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
          
          <div className="slider-group" style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
            <div className="slider-header" style={{ color: '#3b82f6', fontWeight: '800', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span>🕒 Time of Day</span>
                <button className={`play-toggle-btn ${isPlaying ? 'playing' : ''}`} onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
              </div>
              <span style={{ fontSize: '1.25rem', letterSpacing: '1px', background: '#e0f2fe', padding: '0.2rem 0.5rem', borderRadius: '6px', transition: 'all 0.2s' }}>{formatTime(timeOfDay)}</span>
            </div>
            <input type="range" min="0" max="24" step="0.5" value={timeOfDay} onChange={(e) => { setTimeOfDay(parseFloat(e.target.value)); setIsPlaying(false); }} />
          </div>

          <div className="preset-container">
            <button className="preset-btn" onClick={() => loadPreset('current', 'Current Grid')}>Current</button>
            <button className="preset-btn" onClick={() => loadPreset('balanced', 'Balanced Mix')}>Balanced</button>
            <button className="preset-btn green" onClick={() => loadPreset('utopia', '100% Clean')}>100% Clean</button>
          </div>

          <div style={{ marginBottom: '2rem', padding: '1rem', background: activeWeather === 'clear' ? 'rgba(241, 245, 249, 0.5)' : 'rgba(254, 243, 199, 0.4)', borderRadius: '12px', border: '1px dashed #cbd5e1', transition: 'all 0.5s ease' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Live Weather Events</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => triggerWeather('clear', '☀️ Skies cleared. Weather modifiers removed.')} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: activeWeather === 'clear' ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: activeWeather === 'clear' ? '#eff6ff' : 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.3s' }}>☀️ Normal</button>
              <button onClick={() => triggerWeather('cloudy', '☁️ Heavy clouds! Solar efficiency dropped by 80%.')} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: activeWeather === 'cloudy' ? '2px solid #64748b' : '1px solid #e2e8f0', background: activeWeather === 'cloudy' ? '#f1f5f9' : 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.3s' }}>☁️ Clouds</button>
              <button onClick={() => triggerWeather('windy', '🌪️ Gale winds! Wind at max capacity, but grid stability damaged.')} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: activeWeather === 'windy' ? '2px solid #8b5cf6' : '1px solid #e2e8f0', background: activeWeather === 'windy' ? '#f5f3ff' : 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.3s' }}>🌪️ Gale</button>
              <button onClick={() => triggerWeather('heatwave', '🌡️ Heatwave! City power demand spiked by 30%.')} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: activeWeather === 'heatwave' ? '2px solid #ef4444' : '1px solid #e2e8f0', background: activeWeather === 'heatwave' ? '#fef2f2' : 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.3s' }}>🌡️ Heat</button>
            </div>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>☀️ Solar Generation</span>
              <span style={{ color: actualSolar < mix.solar ? '#ef4444' : 'inherit', transition: 'color 0.4s' }}><strong style={{fontSize: '1.1rem'}}>{actualSolar.toFixed(1)}%</strong><span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '6px' }}>(Cap: {mix.solar}%)</span></span>
            </div>
            <input type="range" min="0" max="100" value={mix.solar} onChange={(e) => handleSliderChange('solar', e.target.value)} />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>🌬️ Wind Generation</span>
              <span style={{ color: activeWeather === 'windy' ? '#8b5cf6' : (actualWind < mix.wind ? '#ef4444' : '#10b981'), transition: 'color 0.4s' }}><strong style={{fontSize: '1.1rem'}}>{actualWind.toFixed(1)}%</strong><span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '6px' }}>(Cap: {mix.wind}%)</span></span>
            </div>
            <input type="range" min="0" max="100" value={mix.wind} onChange={(e) => handleSliderChange('wind', e.target.value)} />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>🌿 Biomass Generation</span>
              <span><strong style={{fontSize: '1.1rem'}}>{actualBiomass.toFixed(1)}%</strong><span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '6px' }}>(Cap: {mix.biomass}%)</span></span>
            </div>
            <input type="range" min="0" max="100" value={mix.biomass} onChange={(e) => handleSliderChange('biomass', e.target.value)} />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>🌊 Ocean Generation</span>
              <span style={{ color: actualOcean < mix.ocean ? '#f59e0b' : '#10b981', transition: 'color 0.4s' }}><strong style={{fontSize: '1.1rem'}}>{actualOcean.toFixed(1)}%</strong><span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '6px' }}>(Cap: {mix.ocean}%)</span></span>
            </div>
            <input type="range" min="0" max="100" value={mix.ocean} onChange={(e) => handleSliderChange('ocean', e.target.value)} />
          </div>

          <div className="fossil-backup" style={{ borderLeftColor: activeWeather === 'heatwave' ? '#ef4444' : (carbonTaxEnabled ? '#ef4444' : '#64748b'), background: carbonTaxEnabled ? 'rgba(254, 242, 242, 0.5)' : undefined, transition: 'all 0.5s ease' }}>
            <h4>⛏️ Fossil Backup (Coal): {coalPercent.toFixed(1)}%</h4>
            <p>{activeWeather === 'heatwave' ? 'WARNING: Demand has spiked to 130%! Coal usage surging.' : (carbonTaxEnabled ? 'TAX ACTIVE: Fossil fuels are incurring heavy penalties.' : 'Automatically scales to cover the remaining grid demand.')}</p>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Live Grid Analysis</h2>
          {metrics.stability < 60 && (<div className="warning-banner" style={{ transition: 'opacity 0.4s ease' }}><span>⚠️</span> Warning: Grid stability critical! Add baseload power.</div>)}
          
          <div className="charts-row">
            <div className="chart-box">
              <div className="chart-title">Energy Volume Mix</div>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={pieData} innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value" animationDuration={800} animationEasing="ease-out">
                    {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={entry.color} /> ))}
                  </Pie>
                  <PieTooltip formatter={(value) => `${value.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-box">
              <div className="chart-title">Cost Contribution (₹)</div>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
                  <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} />
                  <YAxis tick={{fontSize: 10}} />
                  <BarTooltip formatter={(value) => `₹${value.toFixed(0)}`} cursor={{fill: '#f1f5f9'}} />
                  <Bar dataKey="Cost" radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{marginBottom: '1.5rem'}}>
            <div className="progress-container">
              <div className="progress-fill" style={{width: `${(totalRenewable / gridDemand) * 100}%`}}>{totalRenewable > 10 ? `${((totalRenewable / gridDemand) * 100).toFixed(0)}%` : ''}</div>
              <div className="progress-target" title="SDG Target: 80%"></div>
            </div>
            <div className="progress-label"><span>Clean Energy Share (vs Total Demand)</span><span>Target: 80%</span></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderTop: '2px solid #f1f5f9', paddingTop: '1.5rem' }}>
            <span style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase' }}>Key Performance Indicators</span>
            {baselineMetrics ? (
               <button onClick={() => setBaselineMetrics(null)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)', transition: 'all 0.2s' }}>✖ Clear Baseline</button>
            ) : (
               <button onClick={handleSetBaseline} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s' }}>🔒 Lock Baseline</button>
            )}
          </div>

          <div className="metrics-grid" style={{ marginTop: '0' }}>
            <div className="metric-box cost" style={{ background: carbonTaxEnabled ? 'rgba(254, 242, 242, 0.95)' : undefined, borderColor: carbonTaxEnabled ? '#fca5a5' : undefined, transition: 'all 0.5s ease' }}>
              <div className="metric-label" style={{ color: carbonTaxEnabled ? '#dc2626' : undefined, transition: 'color 0.5s' }}>Avg Cost</div>
              <p className="metric-value">₹{animatedCost.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
              {baselineMetrics && (<div>{formatDelta(metrics.cost, baselineMetrics.cost, 'cost')}</div>)}
            </div>
            
            <div className={`metric-box ${getCo2Class(metrics.co2)}`} style={{ transition: 'all 0.5s ease' }}>
              <div className="metric-label">CO2 Output</div>
              <p className="metric-value">{animatedCo2.toFixed(0)} <span style={{fontSize: '1rem'}}>kg</span></p>
              {baselineMetrics && (<div>{formatDelta(metrics.co2, baselineMetrics.co2, 'co2')}</div>)}
            </div>
            
            <div className={`metric-box ${metrics.stability >= 75 ? 'stability-high' : 'stability-low'}`} style={{ transition: 'all 0.5s ease' }}>
              <div className="metric-label">Grid Stability</div>
              <p className="metric-value">{animatedStability.toFixed(0)}<span style={{fontSize: '1rem'}}>/100</span></p>
              {baselineMetrics && (<div>{formatDelta(metrics.stability, baselineMetrics.stability, 'stability')}</div>)}
            </div>
          </div>
        </div>
      </div>
      
      {toastMsg && <div className="toast-notification">{toastMsg}</div>}
    </div>
  );
};

export default Dashboard;