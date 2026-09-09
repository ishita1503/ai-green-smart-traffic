import './App.css';
import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

function App() {

  const [northSignal, setNorthSignal] = useState('GREEN');
  const [southSignal, setSouthSignal] = useState('RED');
  const [eastSignal, setEastSignal] = useState('GREEN');
  const [westSignal, setWestSignal] = useState('RED');

  const [emergency, setEmergency] = useState(false);

  const trafficHistory = [
    { time: '10 AM', vehicles: 15, density: 35 },
    { time: '12 PM', vehicles: 22, density: 52 },
    { time: '2 PM', vehicles: 18, density: 44 },
    { time: '4 PM', vehicles: 25, density: 60 },
    { time: '6 PM', vehicles: 31, density: 78 },
    { time: '8 PM', vehicles: 24, density: 55 }
  ];

  return (
    <div className="dashboard">

      <h1>AI-Based Green Smart Traffic Management System</h1>
      <h2>Traffic Management Dashboard</h2>

      <div className="summary-container">

        <div className="summary-card">
          <h3>Total Vehicles</h3>
          <p className="summary-number">19</p>
        </div>

        <div className="summary-card">
          <h3>Average Density</h3>
          <p className="summary-number">45%</p>
        </div>

        <div className="summary-card">
          <h3>Active Signals</h3>
          <p className="summary-number">2</p>
        </div>

        <div className="summary-card">
          <h3>Emergency Alerts</h3>
          <p className="summary-number">{emergency ? 1 : 0}</p>
        </div>

      </div>

      <div className={`alert-box ${emergency ? 'emergency-active' : ''}`}>

        <h3>🚨 Emergency Status</h3>

        {emergency ? (
          <>
            <p>🚑 Emergency vehicle detected!</p>
            <p>📍 Direction: North</p>
            <p>⚡ Priority signal activated</p>
          </>
        ) : (
          <p>🟢 No emergency vehicle detected</p>
        )}

        <button
          className="emergency-button"
          onClick={() => setEmergency(!emergency)}
        >
          {emergency ? 'CLEAR EMERGENCY' : 'TEST EMERGENCY'}
        </button>

      </div>

      <div className="system-status">
        <h3>⚙️ System Status</h3>
        <p>🟢 AI Detection: Active</p>
        <p>🟢 Backend: Connected</p>
        <p>🟢 ESP32: Connected</p>
        <p>🟢 Database: Connected</p>
      </div>

      <div className="analytics-container">

        <div className="analytics-card">
          <h3>Average Waiting Time</h3>
          <p>42 sec</p>
        </div>

        <div className="analytics-card">
          <h3>Fuel Saved</h3>
          <p>18.5 L</p>
        </div>

        <div className="analytics-card">
          <h3>CO₂ Reduced</h3>
          <p>42.3 kg</p>
        </div>

        <div className="analytics-card">
          <h3>Peak Traffic</h3>
          <p>6:00 PM - 8:00 PM</p>
        </div>

      </div>

      <div className="chart-section">

        <h2>📈 Traffic Analysis</h2>

        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={trafficHistory}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="time" />

            <YAxis />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="vehicles"
              stroke="#2563eb"
              strokeWidth={3}
              name="Vehicles"
            />

            <Line
              type="monotone"
              dataKey="density"
              stroke="#f59e0b"
              strokeWidth={3}
              name="Density %"
            />

          </LineChart>
        </ResponsiveContainer>

      </div>

      <div className="traffic-container">

        <div className="traffic-card">
          <h3>North</h3>
          <p>🚗 Vehicles: 5</p>
          <p>📊 Density: 40%</p>

          <div className="density-bar">
            <div className="density-fill" style={{ width: '40%' }}></div>
          </div>

          <div className="signal">
            <span className={`signal-light ${northSignal.toLowerCase()}`}></span>
            {northSignal}
          </div>

          <button onClick={() => setNorthSignal('GREEN')}>GREEN</button>
          <button onClick={() => setNorthSignal('RED')}>RED</button>
        </div>

        <div className="traffic-card">
          <h3>South</h3>
          <p>🚗 Vehicles: 2</p>
          <p>📊 Density: 20%</p>

          <div className="density-bar">
            <div className="density-fill" style={{ width: '20%' }}></div>
          </div>

          <div className="signal">
            <span className={`signal-light ${southSignal.toLowerCase()}`}></span>
            {southSignal}
          </div>

          <button onClick={() => setSouthSignal('GREEN')}>GREEN</button>
          <button onClick={() => setSouthSignal('RED')}>RED</button>
        </div>

        <div className="traffic-card">
          <h3>East</h3>
          <p>🚗 Vehicles: 8</p>
          <p>📊 Density: 80%</p>

          <div className="density-bar">
            <div className="density-fill" style={{ width: '80%' }}></div>
          </div>

          <div className="signal">
            <span className={`signal-light ${eastSignal.toLowerCase()}`}></span>
            {eastSignal}
          </div>

          <button onClick={() => setEastSignal('GREEN')}>GREEN</button>
          <button onClick={() => setEastSignal('RED')}>RED</button>
        </div>

        <div className="traffic-card">
          <h3>West</h3>
          <p>🚗 Vehicles: 4</p>
          <p>📊 Density: 40%</p>

          <div className="density-bar">
            <div className="density-fill" style={{ width: '40%' }}></div>
          </div>

          <div className="signal">
            <span className={`signal-light ${westSignal.toLowerCase()}`}></span>
            {westSignal}
          </div>

          <button onClick={() => setWestSignal('GREEN')}>GREEN</button>
          <button onClick={() => setWestSignal('RED')}>RED</button>
        </div>

      </div>

      <div className="history-section">

        <h2>📊 Traffic History</h2>

        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Total Vehicles</th>
              <th>Average Density</th>
              <th>Average Waiting</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>10:00 AM</td>
              <td>15</td>
              <td>35%</td>
              <td>28 sec</td>
            </tr>

            <tr>
              <td>12:00 PM</td>
              <td>22</td>
              <td>52%</td>
              <td>41 sec</td>
            </tr>

            <tr>
              <td>02:00 PM</td>
              <td>18</td>
              <td>44%</td>
              <td>36 sec</td>
            </tr>

            <tr>
              <td>06:00 PM</td>
              <td>31</td>
              <td>78%</td>
              <td>65 sec</td>
            </tr>
          </tbody>
        </table>

      </div>

      <div className="report-section">

        <h2>📄 Traffic Performance Report</h2>

        <div className="report-buttons">
          <button>Daily Report</button>
          <button>Weekly Report</button>
        </div>

        <div className="report-summary">

          <p><strong>Report Period:</strong> Today</p>
          <p><strong>Total Vehicles Managed:</strong> 1,248</p>
          <p><strong>Average Waiting Time:</strong> 38 seconds</p>
          <p><strong>Fuel Saved:</strong> 86.4 Litres</p>
          <p><strong>CO₂ Reduced:</strong> 197.2 kg</p>
          <p><strong>Emergency Events:</strong> 3</p>

        </div>

      </div>

    </div>
  );
}

export default App;