const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let alerts = [];
const MAX_ALERTS = 500;
let alarmActive = false;
let lastDismissBy = '';

app.post('/api/alert', (req, res) => {
  const { type, message, rssi, ip, ble, alarm } = req.body;
  const alert = {
    id: Date.now(),
    type: type || 'UNKNOWN',
    message: message || '',
    rssi: rssi || 0,
    ip: ip || '',
    ble: ble || false,
    dismissed: false,
    dismissedBy: '',
    timestamp: new Date().toISOString()
  };
  if (type === 'DISMISS') {
    alarmActive = false;
    alert.dismissed = true;
  } else if (type !== 'BLE') {
    alarmActive = alarm !== undefined ? alarm : true;
  }
  alerts.unshift(alert);
  if (alerts.length > MAX_ALERTS) {
    alerts = alerts.slice(0, MAX_ALERTS);
  }
  console.log(`[${new Date().toLocaleTimeString()}] ${alert.type}: ${alert.message} | alarm=${alarmActive}`);
  res.json({ status: 'ok', id: alert.id, alarm: alarmActive });
});

app.get('/api/alerts', (req, res) => {
  const since = parseInt(req.query.since) || 0;
  if (since > 0) {
    const newAlerts = alerts.filter(a => a.id > since);
    res.json({ alerts: newAlerts, alarm: alarmActive });
  } else {
    res.json({ alerts: alerts.slice(0, 100), alarm: alarmActive });
  }
});

app.post('/api/dismiss', (req, res) => {
  const { alertId, source } = req.body;
  alarmActive = false;
  lastDismissBy = source || 'WEB';
  if (alertId) {
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.dismissed = true;
      alert.dismissedBy = lastDismissBy;
    }
  }
  alerts.unshift({
    id: Date.now(),
    type: 'DISMISS',
    message: `Alarm dismissed by ${lastDismissBy}`,
    rssi: 0, ip: '', ble: false,
    dismissed: true,
    dismissedBy: lastDismissBy,
    timestamp: new Date().toISOString()
  });
  console.log(`[${new Date().toLocaleTimeString()}] DISMISS by ${lastDismissBy}`);
  res.json({ status: 'dismissed', alarm: false });
});

app.post('/api/dismiss-all', (req, res) => {
  alarmActive = false;
  alerts.forEach(a => { a.dismissed = true; a.dismissedBy = 'WEB-ALL'; });
  console.log(`[${new Date().toLocaleTimeString()}] ALL DISMISSED`);
  res.json({ status: 'all_dismissed', alarm: false });
});

app.get('/api/alarm-state', (req, res) => {
  res.json({ alarm: alarmActive });
});

app.delete('/api/alerts', (req, res) => {
  alerts = [];
  alarmActive = false;
  res.json({ status: 'cleared' });
});

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    alarm: alarmActive,
    totalAlerts: alerts.length,
    uptime: Math.floor(process.uptime())
  });
});

app.listen(PORT, () => {
  console.log(`BW16 Alert Server v2 running on port ${PORT}`);
});
