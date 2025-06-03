export const config = {
  runtime: "edge",
};

export default function handler(req) {
  const baseUrl = new URL(req.url).origin;

  return new Response(
    JSON.stringify({
      message: "Stunting Prediction API",
      status: "running",
      version: "1.0.0",
      runtime: "edge",
      endpoints: {
        health: `${baseUrl}/api/health`,
        predict: `${baseUrl}/api/predict`,
      },
      usage: {
        predict: {
          method: "POST",
          url: `${baseUrl}/api/predict`,
          body: {
            data: [24, 10.5, 85.2, 1],
          },
          description:
            "Array of [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin(1=laki-laki, 0=perempuan)]",
        },
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
