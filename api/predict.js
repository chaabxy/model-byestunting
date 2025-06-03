import * as tf from "@tensorflow/tfjs-node";
import { join } from "path";

let model = null;

async function loadModel() {
  if (!model) {
    try {
      const modelPath = join(process.cwd(), "tfjs_model", "model.json");
      model = await tf.loadLayersModel(`file://${modelPath}`);
      console.log("Model loaded successfully");
    } catch (error) {
      console.error("Error loading model:", error);
      throw error;
    }
  }
  return model;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        error: 'Invalid input. Expected array of numbers in "data" field',
      });
    }

    // Load model
    const loadedModel = await loadModel();

    // Convert input to tensor
    const inputTensor = tf.tensor2d([data]);

    // Make prediction
    const prediction = loadedModel.predict(inputTensor);
    const result = await prediction.data();

    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();

    // Return prediction result
    res.status(200).json({
      success: true,
      prediction: Array.from(result),
      input: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
