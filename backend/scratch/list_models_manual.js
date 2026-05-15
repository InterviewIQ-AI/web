const dotenv = require("dotenv");
dotenv.config();

async function listAll() {
  const apiKey = process.env.GEMINI_API_KEY;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.models) {
      console.log("AVAILABLE MODELS:", data.models.map(m => m.name.replace('models/', '')));
    } else {
      console.log("NO MODELS FOUND:", data);
    }
  } catch (e) {
    console.log("ERROR LISTING:", e.message);
  }
}

listAll();
