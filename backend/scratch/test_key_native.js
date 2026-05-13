const https = require('https');
const apiKey = "AIzaSyBXkGhc2WJFQrxsub9ZbCFUQd2FGgfgvzM";

function testKey() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(data);
    });
  }).on('error', (err) => {
    console.error("Error: " + err.message);
  });
}

testKey();
