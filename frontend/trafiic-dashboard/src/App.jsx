
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import './App.css';
import { useState, useRef, useEffect } from 'react';

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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraLoading, setCameraLoading] = useState(false);

  const [aiModel, setAiModel] = useState(null);
  const [aiStatus, setAiStatus] = useState('Loading AI model...');
  const [carCount, setCarCount] = useState(0);

  // Calculate live density from detected cars.
  // This is an illustrative threshold, not a calibrated road-density measure.
  const densityPercent = Math.min(carCount * 10, 100);

  const densityLabel =
    carCount <= 2 ? 'LOW' :
    carCount <= 5 ? 'MEDIUM' : 'HIGH';

  const densityColor =
    carCount <= 2 ? '#15803d' :
    carCount <= 5 ? '#b45309' : '#dc2626';

  // Load AI model
  useEffect(() => {
    let active = true;

    async function loadAI() {
      try {
        const model = await cocoSsd.load();

        if (active) {
          setAiModel(model);
          setAiStatus('AI Ready');
        }
      } catch (error) {
        console.error('AI model loading failed:', error);
        if (active) setAiStatus('AI model failed to load');
      }
    }

    loadAI();

    return () => {
      active = false;
    };
  }, []);

  // Start camera
  const startCamera = async () => {
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is unavailable. Open this app using localhost or HTTPS.');
      return;
    }

    setCameraLoading(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);
      } else {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Allow camera access in your browser.');
      } else if (error.name === 'NotFoundError') {
        setCameraError('No camera found. Check your webcam.');
      } else if (error.name === 'NotReadableError') {
        setCameraError('Camera is busy. Close other apps using the camera.');
      } else {
        setCameraError(error.message || 'Unable to start camera.');
      }
    } finally {
      setCameraLoading(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) videoRef.current.srcObject = null;

    if (canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    setCameraOn(false);
    setCameraError('');
    setCarCount(0);
  };

  // Detect cars in the live camera
  useEffect(() => {
    if (!cameraOn || !aiModel) return;

    let active = true;
    let animationId;
    let detecting = false;

    const detectFrame = async () => {
      if (!active || detecting) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
        animationId = requestAnimationFrame(detectFrame);
        return;
      }

      detecting = true;

      try {
        const predictions = await aiModel.detect(video);
        if (!active) return;

        const cars = predictions.filter(
          item => item.class === 'car' && item.score >= 0.50
        );

        setCarCount(cars.length);

        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.lineWidth = Math.max(2, canvas.width / 400);
        context.font = `${Math.max(14, canvas.width / 45)}px Arial`;

        cars.forEach(car => {
          const [x, y, width, height] = car.bbox;

          context.strokeStyle = '#22c55e';
          context.fillStyle = '#22c55e';
          context.strokeRect(x, y, width, height);

          const label = `Car ${Math.round(car.score * 100)}%`;
          const labelY = Math.max(0, y - 26);
          const labelWidth = context.measureText(label).width + 12;

          context.fillRect(x, labelY, labelWidth, 25);
          context.fillStyle = '#ffffff';
          context.fillText(label, x + 6, labelY + 18);
        });
      } catch (error) {
        console.error('AI detection error:', error);
        setAiStatus('Detection error');
      } finally {
        detecting = false;
        if (active) animationId = requestAnimationFrame(detectFrame);
      }
    };

    setAiStatus('AI detecting cars...');
    animationId = requestAnimationFrame(detectFrame);

    return () => {
      active = false;
      cancelAnimationFrame(animationId);
    };
  }, [cameraOn, aiModel]);

  // Stop camera tracks when component closes
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const trafficHistory = [
    { time: '10 AM', vehicles: 15, density: 35 },
    { time: '12 PM', vehicles: 22, density: 52 },
    { time: '2 PM', vehicles: 18, density: 44 },
    { time: '4 PM', vehicles: 25, density: 60 },
    { time: '6 PM', vehicles: 31, density: 78 },
    { time: '8 PM', vehicles: 24, density: 55 },
    ...(cameraOn ? [{
      time: 'LIVE',
      vehicles: carCount,
      density: densityPercent
    }] : [])
  ];

  return (
    <div className="dashboard">
      <h1>AI-Based Green Smart Traffic Management System</h1>
      <h2>Traffic Management Dashboard</h2>

      {/* LIVE CAMERA */}
      <div style={{
        background: '#ffffff',
        color: '#1f2937',
        padding: '20px',
        margin: '20px 0',
        borderRadius: '12px',
        border: '1px solid #d1d5db',
        boxSizing: 'border-box'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '15px'
        }}>
          <h2 style={{ margin: 0 }}>📹 Live Traffic Camera + AI</h2>
          <span style={{
            color: cameraOn ? '#15803d' : '#dc2626',
            fontWeight: 'bold'
          }}>
            {cameraOn ? '● CAMERA LIVE' : '● CAMERA OFFLINE'}
          </span>
        </div>

        <div style={{
          width: '100%',
          maxWidth: '900px',
          margin: '0 auto',
          aspectRatio: '16 / 9',
          background: '#111827',
          borderRadius: '10px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: cameraOn ? 'block' : 'none'
            }}
          />

          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              display: cameraOn ? 'block' : 'none'
            }}
          />

          {!cameraOn && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#ffffff',
              textAlign: 'center',
              padding: '15px',
              boxSizing: 'border-box'
            }}>
              <div style={{ fontSize: '48px' }}>📷</div>
              <h3>Camera is currently off</h3>
              <p style={{ color: '#d1d5db' }}>Start the camera to detect cars</p>
            </div>
          )}
        </div>

        {cameraError && (
          <p role="alert" style={{
            color: '#dc2626',
            background: '#fef2f2',
            padding: '10px',
            borderRadius: '6px',
            marginTop: '12px'
          }}>
            ⚠️ {cameraError}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
          {!cameraOn ? (
            <button onClick={startCamera} disabled={cameraLoading}>
              {cameraLoading ? 'Starting Camera...' : '▶ Start Camera'}
            </button>
          ) : (
            <button onClick={stopCamera}>■ Stop Camera</button>
          )}
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '25px',
          marginTop: '16px',
          padding: '15px',
          background: '#f1f5f9',
          borderRadius: '8px'
        }}>
          <div>
            <strong>🚗 Cars detected now</strong>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#15803d' }}>
              {carCount}
            </div>
          </div>

          <div>
            <strong>Traffic Density</strong>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: densityColor }}>
              {cameraOn ? densityLabel : 'WAITING'}
            </div>
            <div>{cameraOn ? `${densityPercent}% (estimated)` : 'Start camera to calculate'}</div>
          </div>

          <div>
            <strong>AI Status</strong>
            <p style={{ margin: '8px 0', color: aiModel ? '#15803d' : '#b45309' }}>
              {aiStatus}
            </p>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#64748b' }}>
          The count represents cars detected in the current camera frame, not unique
          cars that have passed. Density is a simple estimate based on the detected
          count. It is not calibrated road occupancy.
        </p>
      </div>

      {/* LIVE DASHBOARD SUMMARY */}
      <div className="summary-container">
        <div className="summary-card">
          <h3>Cars Detected Now</h3>
          <p className="summary-number">{cameraOn ? carCount : 0}</p>
        </div>

        <div className="summary-card">
          <h3>Estimated Density</h3>
          <p className="summary-number">
            {cameraOn ? `${densityPercent}%` : '—'}
          </p>
          <p>{cameraOn ? densityLabel : 'Camera off'}</p>
        </div>

        <div className="summary-card">
          <h3>Active Signals</h3>
          <p className="summary-number">
            {[northSignal, southSignal, eastSignal, westSignal].filter(
              signal => signal === 'GREEN'
            ).length}
          </p>
        </div>

        <div className="summary-card">
          <h3>Emergency Alerts</h3>
          <p className="summary-number">{emergency ? 1 : 0}</p>
        </div>
      </div>

      {/* EMERGENCY STATUS */}
      <div className={`alert-box ${emergency ? 'emergency-active' : ''}`}>
        <h3>🚨 Emergency Status</h3>
        {emergency ? (
          <>
            <p>🚑 Emergency test alert is active.</p>
            <p>📍 Test direction: North</p>
            <p>⚠️ This is a manual test, not automatic emergency detection.</p>
          </>
        ) : (
          <p>🟢 No active test alert</p>
        )}
        <button className="emergency-button" onClick={() => setEmergency(!emergency)}>
          {emergency ? 'CLEAR EMERGENCY' : 'TEST EMERGENCY'}
        </button>
      </div>

      {/* SYSTEM STATUS */}
      <div className="system-status">
        <h3>⚙️ System Status</h3>
        <p>{aiModel ? '🟢 AI Model: Ready' : '🟡 AI Model: Loading'}</p>
        <p>{cameraOn ? '🟢 Camera: Live' : '⚪ Camera: Off'}</p>
        <p>ℹ️ ESP32: Existing integration status; not controlled by this code</p>
        <p>ℹ️ Database: Existing integration status; not verified here</p>
      </div>

      {/* ANALYTICS - existing demo metrics */}
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

      {/* TRAFFIC ANALYSIS CHART */}
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

      {/* TRAFFIC SIGNALS: manual controls retained */}
      <div className="traffic-container">
        {[
          { name: 'North', signal: northSignal, setSignal: setNorthSignal },
          { name: 'South', signal: southSignal, setSignal: setSouthSignal },
          { name: 'East', signal: eastSignal, setSignal: setEastSignal },
          { name: 'West', signal: westSignal, setSignal: setWestSignal }
        ].map(direction => (
          <div className="traffic-card" key={direction.name}>
            <h3>{direction.name}</h3>
            <p>🚗 Live camera count: {cameraOn ? carCount : '—'}</p>
            <p>📊 Estimated density: {cameraOn ? `${densityPercent}%` : '—'}</p>
            <div className="density-bar">
              <div
                className="density-fill"
                style={{ width: `${cameraOn ? densityPercent : 0}%` }}
              />
            </div>
            <div className="signal">
              <span className={`signal-light ${direction.signal.toLowerCase()}`} />
              {direction.signal}
            </div>
            <button onClick={() => direction.setSignal('GREEN')}>GREEN</button>
            <button onClick={() => direction.setSignal('RED')}>RED</button>
          </div>
        ))}
      </div>

      {/* TRAFFIC HISTORY - sample historical data */}
      <div className="history-section">
        <h2>📊 Traffic History (Sample Data)</h2>
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
            <tr><td>10:00 AM</td><td>15</td><td>35%</td><td>28 sec</td></tr>
            <tr><td>12:00 PM</td><td>22</td><td>52%</td><td>41 sec</td></tr>
            <tr><td>02:00 PM</td><td>18</td><td>44%</td><td>36 sec</td></tr>
            <tr><td>06:00 PM</td><td>31</td><td>78%</td><td>65 sec</td></tr>
          </tbody>
        </table>
      </div>

      {/* PERFORMANCE REPORT - existing sample metrics */}
      <div className="report-section">
        <h2>📄 Traffic Performance Report (Sample Data)</h2>
        <div className="report-buttons">
          <button>Daily Report</button>
          <button>Weekly Report</button>
        </div>
        <div className="report-summary">
          <p><strong>Report Period:</strong> Today (sample report)</p>
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
