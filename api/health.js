export const config = {
  runtime: "edge",
};

export default function handler(req) {
  return new Response(
    JSON.stringify({
      status: "OK",
      message: "API is healthy",
      timestamp: new Date().toISOString(),
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
