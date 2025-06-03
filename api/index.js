export const config = {
  runtime: "edge",
};

export default function handler(req) {
  return new Response(
    JSON.stringify({
      message: "Stunting Prediction API",
      status: "running",
      endpoints: {
        health: "/api/health",
        predict: "/api/predict",
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
