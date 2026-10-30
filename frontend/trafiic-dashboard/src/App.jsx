
import './App.css';
import { useState, useRef, useEffect, useCallback } from 'react';

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
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const lastSaveRef = useRef(0);

  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [apiError, setApiError] = useState('');

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const [vehicleCount, setVehicleCount] = useState(0);
  const [detections, setDetections] = useState([]);
  const [detectionStatus, setDetectionStatus] = useState('Waiting for camera');
  const [detectionError, setDetectionError] = useState('');

  const [density, setDensity] = useState(0);
  const [signalStatus, setSignalStatus] = useState('RED');
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [emergency, setEmergency] = useState(false);

  const [trafficHistory, setTrafficHistory] = useState([]);

  const densityFromCount = (count) =>
    Math.min(100, Math.round((count / 20) * 100));

  // Draw bounding boxes over the live video.
  const drawBoxes = useCallback((items) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      return;
    }

    const rect = video.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = Math.round(width * window.devicePixelRatio);
    canvas.height = Math.round(height * window.devicePixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, width, height);

    const scaleX = width / video.videoWidth;
    const scaleY = height / video.videoHeight;

    items.forEach((item) => {
      if (!item.box || item.box.length !== 4) return;

      const [x1, y1, x2, y2] = item.box;
      const left = x1 * scaleX;
      const top = y1 * scaleY;
      const boxWidth = (x2 - x1) * scaleX;
      const boxHeight = (y2 - y1) * scaleY;

      const label = `${item.vehicle} ${Math.round(item.confidence * 100)}%`;

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#22c55e';
      ctx.strokeRect(left, top, boxWidth, boxHeight);

      ctx.font = 'bold 14px Arial';
      const labelWidth = ctx.measureText(label).width + 12;
      const labelTop = Math.max(0, top - 25);

      ctx.fillStyle = '#16a34a';
      ctx.fillRect(left, labelTop, labelWidth, 24);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, left + 6, labelTop + 17);
    });
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/camera-history`);
      if (!response.ok) throw new Error('History request failed');

      const result = await response.json();
      const records = (result.records || []).reverse();

      setHistory(result.records || []);

      setTrafficHistory(
        records.map((record) => ({
          time: new Date(record.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          vehicles: record.vehicle_count,
          density: record.density
        }))
      );
    } catch (error) {
      console.error('History:', error);
    }
  }, [API_URL]);

  const loadAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/camera-analytics`);
      if (!response.ok) throw new Error('Analytics request failed');

      setAnalytics(await response.json());
    } catch (error) {
      console.error('Analytics:', error);
    }
  }, [API_URL]);

  const loadCameraSignal = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/camera-signal`);
      if (!response.ok) return;

      const result = await response.json();
      setSignalStatus(result.signal_status || 'RED');
    } catch (error) {
      console.error('Signal:', error);
    }
  }, [API_URL]);

  // Start webcam.
  const startCamera = async () => {
    setCameraError('');
    setDetectionError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera requires localhost or HTTPS.');
      return;
    }

    setCameraLoading(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);
        setDetectionStatus('Camera connected. Starting YOLO...');
      }
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Allow camera access.');
      } else if (error.name === 'NotFoundError') {
        setCameraError('No webcam found.');
      } else if (error.name === 'NotReadableError') {
        setCameraError('Camera is busy. Close other camera apps.');
      } else {
        setCameraError(error.message || 'Unable to start camera.');
      }
    } finally {
      setCameraLoading(false);
    }
  };

  // Stop webcam and clear overlay.
  const stopCamera = () => {
    if (detectionTimerRef.current) {
      clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) videoRef.current.srcObject = null;

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    setCameraOn(false);
    setVehicleCount(0);
    setDetections([]);
    setDensity(0);
    setSignalStatus('RED');
    setDetectionStatus('Waiting for camera');
    setDetectionError('');
  };

  // Stop camera on page close.
  useEffect(() => {
    return () => {
      if (detectionTimerRef.current) {
        clearInterval(detectionTimerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Backend health.
  useEffect(() => {
    let active = true;

    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_URL}/health`);
        if (!response.ok) throw new Error('Backend request failed');

        const result = await response.json();

        if (active) {
          setBackendStatus(result.status === 'online' ? 'Connected' : 'Unavailable');
          setApiError('');
        }
      } catch (error) {
        if (active) {
          setBackendStatus('Disconnected');
          setApiError(error.message);
        }
      }
    };

    checkBackend();
    const timer = setInterval(checkBackend, 4000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [API_URL]);

  // Initial history and analytics.
  useEffect(() => {
    loadHistory();
    loadAnalytics();
    loadCameraSignal();

    const timer = setInterval(() => {
      loadHistory();
      loadAnalytics();
      loadCameraSignal();
    }, 10000);

    return () => clearInterval(timer);
  }, [loadHistory, loadAnalytics, loadCameraSignal]);

  // Send camera frames to YOLO.
  useEffect(() => {
    if (!cameraOn) return;

    let stopped = false;
    let busy = false;

    const detectVehicles = async () => {
      const video = videoRef.current;

      if (!video || video.readyState < 2 || busy || stopped) return;

      busy = true;

      try {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = video.videoWidth;
        frameCanvas.height = video.videoHeight;

        const frameContext = frameCanvas.getContext('2d');

        if (!frameContext || !frameCanvas.width || !frameCanvas.height) {
          return;
        }

        frameContext.drawImage(
          video,
          0,
          0,
          frameCanvas.width,
          frameCanvas.height
        );

        const blob = await new Promise((resolve) => {
          frameCanvas.toBlob(resolve, 'image/jpeg', 0.8);
        });

        if (!blob || stopped) return;

        const formData = new FormData();
        formData.append('file', blob, 'camera.jpg');

        const response = await fetch(`${API_URL}/detect`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Detection API error: ${response.status}`);
        }

        const result = await response.json();

        if (stopped) return;

        const items = result.detections || [];
        const count = result.vehicle_count ?? items.length;
        const currentDensity = densityFromCount(count);

        setVehicleCount(count);
        setDetections(items);
        setDensity(currentDensity);
        setDetectionStatus('YOLO Detection Active');
        setDetectionError('');

        drawBoxes(items);

        // Save a database reading every 5 seconds.
        const now = Date.now();

        if (now - lastSaveRef.current >= 5000) {
          lastSaveRef.current = now;

          const saveResponse = await fetch(`${API_URL}/camera-traffic`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              vehicle_count: count,
              density: currentDensity,
              detections: items.length
            })
          });

          if (!saveResponse.ok) {
            throw new Error('Could not save traffic reading.');
          }

          const saved = await saveResponse.json();
          setSignalStatus(saved.signal_status || 'RED');

          loadHistory();
          loadAnalytics();
        }
      } catch (error) {
        if (!stopped) {
          setDetectionStatus('Detection Error');
          setDetectionError(error.message);
        }
      } finally {
        busy = false;
      }
    };

    detectVehicles();

    detectionTimerRef.current = setInterval(detectVehicles, 2000);

    return () => {
      stopped = true;

      if (detectionTimerRef.current) {
        clearInterval(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
    };
  }, [cameraOn, API_URL, drawBoxes, loadHistory, loadAnalytics]);

  const totalVehicles = analytics?.total_vehicles_processed ?? 0;
  const averageDensity = analytics?.average_density ?? 0;
  const activeSignals = cameraOn && signalStatus === 'GREEN' ? 1 : 0;

  const formatTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString();
  };

  return (
    <div className="dashboard">

      <h1>AI-Based Green Smart Traffic Management System</h1>
      <h2>Traffic Management Dashboard</h2>

      {/* LIVE CAMERA */}
      <div
        style={{
          background: '#ffffff',
          color: '#1f2937',
          padding: '20px',
          margin: '20px 0',
          borderRadius: '12px',
          border: '1px solid #d1d5db',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '15px'
          }}
        >
          <h2 style={{ margin: 0 }}>📹 Live Traffic Camera</h2>

          <span style={{
            color: cameraOn ? '#15803d' : '#dc2626',
            fontWeight: 'bold'
          }}>
            {cameraOn ? '● CAMERA LIVE' : '● CAMERA OFFLINE'}
          </span>
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: '900px',
            margin: '0 auto',
            aspectRatio: '16 / 9',
            background: '#111827',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              display: cameraOn ? 'block' : 'none'
            }}
          />

          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none'
            }}
          />

          {!cameraOn && (
            <div
              style={{
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
              }}
            >
              <div style={{ fontSize: '48px' }}>📷</div>
              <h3>Camera is currently off</h3>
              <p style={{ color: '#d1d5db' }}>
                Start the camera to view live vehicle detection
              </p>
            </div>
          )}
        </div>

        {cameraError && (
          <p style={{
            color: '#dc2626',
            background: '#fef2f2',
            padding: '10px',
            borderRadius: '6px'
          }}>
            ⚠️ {cameraError}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          {!cameraOn ? (
            <button
              onClick={startCamera}
              disabled={cameraLoading}
              style={{
                background: '#15803d',
                color: '#fff',
                border: 'none',
                padding: '12px 22px',
                borderRadius: '7px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {cameraLoading ? 'Starting Camera...' : '▶ Start Camera'}
            </button>
          ) : (
            <button
              onClick={stopCamera}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                padding: '12px 22px',
                borderRadius: '7px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ■ Stop Camera
            </button>
          )}
        </div>

        <div style={{
          marginTop: '15px',
          padding: '15px',
          background: '#f0fdf4',
          borderRadius: '8px',
          color: '#166534'
        }}>
          <h3>AI Vehicle Detection</h3>
          <p><strong>Status:</strong> {detectionStatus}</p>
          <p><strong>Vehicles detected in latest frame:</strong> {vehicleCount}</p>
          <p><strong>Vehicle details:</strong> {
            detections.length
              ? detections.map((item, index) =>
                  `${index + 1}. ${item.vehicle} (${Math.round(item.confidence * 100)}%)`
                ).join(', ')
              : 'No vehicles detected yet'
          }</p>

          {detectionError && (
            <p style={{ color: '#dc2626' }}>{detectionError}</p>
          )}
        </div>

        <p style={{ fontSize: '13px', color: '#64748b' }}>
          Count is for the latest camera frame, not unique vehicles.
          Density uses the project assumption of 20 vehicles = 100%.
        </p>
      </div>

      {/* DASHBOARD SUMMARY */}
      <div className="summary-container">

        <div className="summary-card">
          <h3>Total Vehicles</h3>
          <p className="summary-number">{vehicleCount}</p>
          <small>Latest camera frame</small>
        </div>

        <div className="summary-card">
          <h3>Average Density</h3>
          <p className="summary-number">{density}%</p>
          <small>Estimated from vehicle count</small>
        </div>

        <div className="summary-card">
          <h3>Active Signals</h3>
          <p className="summary-number">{activeSignals}</p>
          <small>Single monitored road</small>
        </div>

        <div className="summary-card">
          <h3>Emergency Alerts</h3>
          <p className="summary-number">{emergency ? 1 : 0}</p>
        </div>

      </div>

      {/* EMERGENCY */}
      <div className={`alert-box ${emergency ? 'emergency-active' : ''}`}>
        <h3>🚨 Emergency Status</h3>

        {emergency ? (
          <>
            <p>🚑 Manual emergency test activated.</p>
            <p>⚠️ Camera does not identify emergency vehicles automatically.</p>
          </>
        ) : (
          <p>🟢 No manual emergency test active</p>
        )}

        <button
          className="emergency-button"
          onClick={() => setEmergency(!emergency)}
        >
          {emergency ? 'CLEAR EMERGENCY' : 'TEST EMERGENCY'}
        </button>
      </div>

      {/* SYSTEM STATUS */}
      <div className="system-status">
        <h3>⚙️ System Status</h3>

        <p>
          Backend: {backendStatus === 'Connected' ? '🟢' : '🔴'} {backendStatus}
        </p>
        <p>AI Detection: {cameraOn ? detectionStatus : 'Camera Off'}</p>
        <p>ESP32: Not verified</p>
        <p>Database: SQLite camera traffic history</p>

        {apiError && <p role="alert">API Error: {apiError}</p>}
      </div>

      {/* ANALYTICS */}
      <div className="analytics-container">

        <div className="analytics-card">
          <h3>Average Waiting Time</h3>
          <p>{analytics?.average_waiting_time_seconds ?? 0} sec</p>
        </div>

        <div className="analytics-card">
          <h3>Estimated Fuel Saved</h3>
          <p>{analytics?.estimated_fuel_saved_litres ?? 0} L</p>
        </div>

        <div className="analytics-card">
          <h3>Estimated CO₂ Reduced</h3>
          <p>{analytics?.estimated_co2_reduction_kg ?? 0} kg</p>
        </div>

        <div className="analytics-card">
          <h3>Traffic Records</h3>
          <p>{analytics?.total_records ?? 0}</p>
        </div>

      </div>

      {/* LIVE TRAFFIC CHART */}
      <div className="chart-section">
        <h2>📈 Traffic Analysis</h2>

        {trafficHistory.length === 0 ? (
          <p>Start the camera to generate live traffic graph.</p>
        ) : (
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
        )}
      </div>

      {/* SINGLE CAMERA SIGNAL */}
      <div className="traffic-container">
        <div className="traffic-card">
          <h3>📷 Monitored Road</h3>
          <p>🚗 Vehicles: {vehicleCount}</p>
          <p>📊 Density: {density}%</p>

          <div className="density-bar">
            <div
              className="density-fill"
              style={{ width: `${density}%` }}
            />
          </div>

          <div className="signal">
            <span className={`signal-light ${signalStatus.toLowerCase()}`} />
            {signalStatus}
          </div>

          <p>
            {signalStatus === 'GREEN'
              ? 'Traffic density is 40% or higher.'
              : 'Traffic density is below 40%.'}
          </p>
        </div>

        {['North', 'South', 'East', 'West'].map((direction) => (
          <div className="traffic-card" key={direction}>
            <h3>{direction}</h3>
            <p>Vehicles: Not separately monitored</p>
            <p>Density: Not available</p>
            <p>Connect a separate camera to measure this direction.</p>
          </div>
        ))}
      </div>

      {/* TRAFFIC HISTORY */}
      <div className="history-section">
        <h2>📊 Traffic History</h2>

        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Total Vehicles</th>
              <th>Average Density</th>
              <th>Signal</th>
            </tr>
          </thead>

          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan="4">No records yet. Start the camera.</td>
              </tr>
            ) : (
              history.map((record) => (
                <tr key={record.id}>
                  <td>{formatTime(record.timestamp)}</td>
                  <td>{record.vehicle_count}</td>
                  <td>{record.density}%</td>
                  <td>{record.signal_status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PERFORMANCE REPORT */}
      <div className="report-section">
        <h2>📄 Traffic Performance Report</h2>

        <div className="report-buttons">
          <button onClick={() => window.print()}>Daily Report / Print</button>
          <button onClick={() => window.print()}>Weekly Report / Print</button>
        </div>

        <div className="report-summary">
          <p><strong>Report Period:</strong> Current database records</p>
          <p><strong>Total Vehicles Processed:</strong> {totalVehicles}</p>
          <p><strong>Average Density:</strong> {averageDensity}%</p>
          <p><strong>Average Waiting Time (estimated):</strong> {analytics?.average_waiting_time_seconds ?? 0} seconds</p>
          <p><strong>Estimated Fuel Saved:</strong> {analytics?.estimated_fuel_saved_litres ?? 0} Litres</p>
          <p><strong>Estimated CO₂ Reduced:</strong> {analytics?.estimated_co2_reduction_kg ?? 0} kg</p>
          <p><strong>Emergency Test Events:</strong> {emergency ? 1 : 0}</p>
        </div>
      </div>

    </div>
  );
}

export default App;
