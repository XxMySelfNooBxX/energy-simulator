import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import energyData from './energyData.json';
import './App.css'; 

const Dashboard = () => {
  const [mix, setMix] = useState({ solar: 20, wind: 20, biomass: 10, ocean: 0 });
  const [metrics, setMetrics] = useState({ cost: 0, co2: 0, stability: 0 });

  const totalRenewable = mix.solar + mix.wind + mix.biomass + mix.ocean;
  const coalPercent = Math.max(0, 100 - totalRenewable);

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

  const handleSliderChange = (source, value) => {
    let newVal = parseInt(value, 10);
    const otherRenewables = totalRenewable - mix[source];
    if (newVal + otherRenewables > 100) newVal = 100 - otherRenewables;
    setMix({ ...mix, [source]: newVal });
  };

  // 1. Dynamic Background Helper Function
  const getCo2Class = (co2) => {
    if (co2 < 300) return 'co2-low';     // Green
    if (co2 < 700) return 'co2-med';     // Yellow
    return 'co2-high';                   // Red
  };

  // 2. The Tree Metric Calculation
  // Baseline is 100% Coal (950kg). 1 mature tree absorbs ~20kg of CO2 per year.
  const baselineCo2 = 950;
  const co2Saved = Math.max(0, baselineCo2 - metrics.co2);
  const treesEquivalent = (co2Saved / 20).toFixed(0);

  const chartData = [
    ...Object.keys(mix).map(k => ({ name: energyData.sources[k].name, value: mix[k], color: energyData.sources[k].color })),
    { name: energyData.sources.coal.name, value: coalPercent, color: energyData.sources.coal.color }
  ].filter(item => item.value > 0);

  return (
    <div className="dashboard-wrapper">
      <h1 className="title">Clean Energy Grid Simulator</h1>
      <p className="subtitle">Adjust the parameters to see the impact on cost and CO2 emissions.</p>
      
      <div className="grid-container">
        
        {/* Controls Card */}
        <div className="card">
          <h2 className="card-title">Grid Configuration</h2>
          {Object.keys(mix).map(source => (
            <div key={source} className="slider-group">
              <div className="slider-header">
                <span>{source}</span> 
                <span>{mix[source]}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" 
                value={mix[source]} 
                onChange={(e) => handleSliderChange(source, e.target.value)}
              />
            </div>
          ))}
          
          <div className="fossil-backup">
            <h4>Fossil Backup (Coal): {coalPercent}%</h4>
            <p>Automatically scales to cover the remaining grid demand.</p>
          </div>
        </div>

        {/* Visuals & Metrics Card */}
        <div className="card">
          <h2 className="card-title">Live Grid Analysis</h2>
          
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={chartData} 
                  innerRadius={70} 
                  outerRadius={100} 
                  paddingAngle={4} 
                  dataKey="value"
                >
                  {chartData.map((entry, index) => ( 
                    <Cell key={`cell-${index}`} fill={entry.color} /> 
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="metrics-grid">
            <div className="metric-box cost">
              <div className="metric-label">Avg Cost</div>
              <p className="metric-value">₹{metrics.cost.toFixed(0)} <span style={{fontSize: '1rem', fontWeight: 'normal', color: '#64748b'}}>/MWh</span></p>
            </div>
            
            {/* 3. Applied Dynamic Class and Tree Badge */}
            <div className={`metric-box ${getCo2Class(metrics.co2)}`}>
              <div className="metric-label">CO2 Output</div>
              <p className="metric-value">{metrics.co2.toFixed(0)} <span style={{fontSize: '1rem', fontWeight: 'normal', color: '#64748b'}}>kg</span></p>
              <div className="tree-badge">
                🌱 ~{treesEquivalent} trees saved/yr
              </div>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
};

export default Dashboard;