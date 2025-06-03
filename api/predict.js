export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Import TensorFlow.js for browser/edge runtime
    const tf = await import("@tensorflow/tfjs");

    const body = await req.json();
    const { data } = body;

    if (!data || !Array.isArray(data) || data.length !== 4) {
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          message: 'Expected "data" field with array of 4 numbers',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Load model from URL (you'll need to host the model files)
    const modelUrl = `${new URL(req.url).origin}/tfjs_model/model.json`;
    const model = await tf.loadLayersModel(modelUrl);

    // Make prediction
    const inputTensor = tf.tensor2d([data]);
    const prediction = model.predict(inputTensor);
    const result = await prediction.data();

    // Cleanup
    inputTensor.dispose();
    prediction.dispose();
    model.dispose();

    // Convert prediction to class labels
    const classes = ["normal", "severely stunted", "stunted"];
    const predictedClass = classes[result.indexOf(Math.max(...result))];
    const confidence = Math.max(...result);

    return new Response(
      JSON.stringify({
        success: true,
        prediction: predictedClass,
        confidence: confidence.toFixed(4),
        probabilities: {
          normal: result[0].toFixed(4),
          "severely stunted": result[1].toFixed(4),
          stunted: result[2].toFixed(4),
        },
        input: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Prediction error:", error);
    return new Response(
      JSON.stringify({
        error: "Server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
