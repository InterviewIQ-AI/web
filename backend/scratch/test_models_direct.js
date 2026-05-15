const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  try {
    const result = await model.generateContent("Hi");
    console.log("SUCCESS: gemini-2.0-flash works!");
    console.log(result.response.text());
  } catch (e) {
    console.log("FAILED: gemini-2.0-flash", e.message);
  }
  
  const model2 = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  try {
    const result = await model2.generateContent("Hi");
    console.log("SUCCESS: gemini-1.5-flash works!");
  } catch (e) {
    console.log("FAILED: gemini-1.5-flash", e.message);
  }
}

test();
