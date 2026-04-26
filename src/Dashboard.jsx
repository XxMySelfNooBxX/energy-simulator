import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip } from 'recharts';
import confetti from 'canvas-confetti';
import energyData from './energyData.json';
import './App.css'; 

const Dashboard = () => {
  const [mix, setMix] = useState({ solar: 20, wind: 20, biomass: 10, ocean: 0 });
  const [metrics, setMetrics] = useState({ cost: 0, co2: 0, stability: 0 });
  const [toastMsg, setToastMsg] = useState(null); // Native Toast State

  const totalRenewable = mix.solar + mix.wind + mix.biomass + mix.ocean;
  const coalPercent = Math.max(0, 100 - totalRenewable);

  const sourceIcons = {
    solar: "☀️",
    wind: "🌬️",
    biomass: "🌿",
    ocean: "🌊"
  };

  useEffect(() => {
    const currentMix = { ...mix, coal: coalPercent };
    let totalCost = 0, totalCo2 = 0, totalStability = 0;

    Object.keys(currentMix).forEach(source => {
      const weight = currentMix[source] / 100;
      totalCost += energyData.sources[source].costPerMWh * weight;
      totalCo2 += energyData.sources[source].co2PerMWh * weight;
      totalStability += energyData.sources[source].stabilityScore * weight;
    });

    setMetrics({ cost: totalCost, co2: totalCo2, stability: totalStability });
  }, [mix, coalPercent]);

  useEffect(() => {
    if (coalPercent === 0) {
      confetti({
        particleCount: 150, spread: 70, origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b']
      });
    }
  }, [coalPercent]);

  const handleSliderChange = (source, value) => {
    let newVal = parseInt(value, 10);
    const otherRenewables = totalRenewable - mix[source];
    if (newVal + otherRenewables > 100) newVal = 100 - otherRenewables;
    setMix({ ...mix, [source]: newVal });
  };

  const loadPreset = (presetKey, presetName) => {
    if (presetKey === 'current') setMix({ solar: 10, wind: 10, biomass: 5, ocean: 0 });
    if (presetKey === 'balanced') setMix({ solar: 30, wind: 20, biomass: 15, ocean: 5 });
    if (presetKey === 'utopia') setMix({ solar: 40, wind: 35, biomass: 10, ocean: 15 });
    
    // Trigger Toast
    setToastMsg(`✅ Scenario Loaded: ${presetName}`);
    setTimeout(() => setToastMsg(null), 3000); // Hide after 3s
  };

  const getCo2Class = (co2) => {
    if (co2 < 300) return 'co2-low';     
    if (co2 < 700) return 'co2-med';     
    return 'co2-high';                   
  };

  // Data for Pie Chart (Volume)
  const pieData = [
    ...Object.keys(mix).map(k => ({ name: energyData.sources[k].name, value: mix[k], color: energyData.sources[k].color })),
    { name: energyData.sources.coal.name, value: coalPercent, color: energyData.sources.coal.color }
  ].filter(item => item.value > 0);

  // Data for Bar Chart (Cost Breakdown)
  const barData = [
    ...Object.keys(mix).map(k => ({ 
      name: k.charAt(0).toUpperCase() + k.slice(1), 
      Cost: (mix[k] / 100) * energyData.sources[k].costPerMWh, 
      fill: energyData.sources[k].color 
    })),
    { 
      name: 'Coal', 
      Cost: (coalPercent / 100) * energyData.sources.coal.costPerMWh, 
      fill: energyData.sources.coal.color 
    }
  ].filter(item => item.Cost > 0);

  return (
    <div className="dashboard-wrapper">
      <h1 className="title">Clean Energy Grid Simulator</h1>
      <p className="subtitle">Adjust the parameters to see the impact on cost, emissions, and stability.</p>
      
      <div className="grid-container">
        
        {/* Controls Card */}
        <div className="card">
          <h2 className="card-title">Grid Configuration</h2>
          
          <div className="preset-container">
            <button className="preset-btn" onClick={() => loadPreset('current', 'Current Grid')}>Current Grid</button>
            <button className="preset-btn" onClick={() => loadPreset('balanced', 'Balanced Mix')}>Balanced Mix</button>
            <button className="preset-btn green" onClick={() => loadPreset('utopia', '100% Clean')}>100% Clean</button>
          </div>

          {Object.keys(mix).map(source => (
            <div key={source} className="slider-group">
              <div className="slider-header">
                <span>{sourceIcons[source]} {source}</span> 
                <span>{mix[source]}%</span>
              </div>
              <input type="range" min="0" max="100" value={mix[source]} onChange={(e) => handleSliderChange(source, e.target.value)} />
            </div>
          ))}
          
          <div className="fossil-backup">
            <h4>⛏️ Fossil Backup (Coal): {coalPercent}%</h4>
            <p>Automatically scales to cover the remaining grid demand.</p>
          </div>
        </div>

        {/* Visuals & Metrics Card */}
        <div className="card">
          <h2 className="card-title">Live Grid Analysis</h2>

          {/* WARNING BANNER */}
          {metrics.stability < 60 && (
            <div className="warning-banner">
              <span>⚠️</span> Warning: Grid stability critical! Add baseload power (Biomass or Coal) to prevent blackouts.
            </div>
          )}
          
          <div className="charts-row">
            {/* Pie Chart */}
            <div className="chart-box">
              <div className="chart-title">Energy Volume Mix</div>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={pieData} innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={entry.color} /> ))}
                  </Pie>
                  <PieTooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart (Cost) */}
            <div className="chart-box">
              <div className="chart-title">Cost Contribution (₹)</div>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
                  <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} />
                  <YAxis tick={{fontSize: 10}} />
                  <BarTooltip formatter={(value) => `₹${value.toFixed(0)}`} cursor={{fill: '#f1f5f9'}} />
                  <Bar dataKey="Cost" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{marginBottom: '1.5rem'}}>
            <div className="progress-container">
              <div className="progress-fill" style={{width: `${totalRenewable}%`}}>
                {totalRenewable > 10 ? `${totalRenewable}%` : ''}
              </div>
              <div className="progress-target" title="SDG Target: 80%"></div>
            </div>
            <div className="progress-label">
              <span>Clean Energy Share</span>
              <span>Target: 80%</span>
            </div>
          </div>

          {/* Metrics Grid (Now 3 Columns) */}
          <div className="metrics-grid">
            <div className="metric-box cost">
              <div className="metric-label">Avg Cost</div>
              <p className="metric-value">₹{metrics.cost.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
            </div>
            
            <div className={`metric-box ${getCo2Class(metrics.co2)}`}>
              <div className="metric-label">CO2 Output</div>
              <p className="metric-value">{metrics.co2.toFixed(0)} <span style={{fontSize: '1rem'}}>kg</span></p>
            </div>

            {/* STABILITY GAUGE */}
            <div className={`metric-box ${metrics.stability >= 75 ? 'stability-high' : 'stability-low'}`}>
              <div className="metric-label">Grid Stability</div>
              <p className="metric-value">{metrics.stability.toFixed(0)}<span style={{fontSize: '1rem'}}>/100</span></p>
            </div>
          </div>
          
        </div>
      </div>

      {/* TOAST POPUP */}
      {toastMsg && (
        <div className="toast-notification">
          {toastMsg}
        </div>
      )}

    </div>
  );
};

export default Dashboard;