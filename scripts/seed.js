fetch('http://localhost:3000/api/seed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ force: true })
}).then(res => res.json()).then(console.log).catch(console.error);
