const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const apiKey = "AIzaSyBXkGhc2WJFQrxsub9ZbCFUQd2FGgfgvzM";

async function testKey() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

testKey();
