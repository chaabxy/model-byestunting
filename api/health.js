export const config = {
  runtime: "edge",
};

export default function handler(req) {
  return new Response(
    JSON.stringify({
      status: "OK",
      message: "Stunting Prediction API is healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      runtime: "edge",
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
