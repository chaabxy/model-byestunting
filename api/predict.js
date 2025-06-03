export const config = {
  runtime: "edge",
};

export default async function handler(req) {
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
    const body = await req.json();
    const { data } = body;

    if (!data || !Array.isArray(data) || data.length !== 4) {
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          message:
            'Expected "data" field with array of 4 numbers [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin]',
          example: { data: [24, 10.5, 85.2, 1] },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Simple rule-based prediction as fallback
    // This is a simplified version - you can enhance this logic
    const [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin] = data;

    // Calculate Z-score approximation for height-for-age
    // This is a simplified calculation - in production you'd use WHO growth standards
    const expectedHeight =
      jenis_kelamin === 1
        ? umur_bulan * 0.5 + 65
        : // Male approximation
          umur_bulan * 0.48 + 63; // Female approximation

    const heightZScore =
      (tinggi_badan - expectedHeight) / (expectedHeight * 0.1);

    let prediction, confidence;

    if (heightZScore >= -1) {
      prediction = "normal";
      confidence = 0.85;
    } else if (heightZScore >= -2) {
      prediction = "stunted";
      confidence = 0.8;
    } else {
      prediction = "severely stunted";
      confidence = 0.9;
    }

    // Calculate probabilities based on z-score
    const normalProb =
      heightZScore >= -1 ? 0.85 : Math.max(0.05, 0.85 + heightZScore * 0.3);
    const stuntedProb = Math.abs(heightZScore + 1.5) < 0.5 ? 0.8 : 0.1;
    const severelyStuntedProb = 1 - normalProb - stuntedProb;

    return new Response(
      JSON.stringify({
        success: true,
        prediction: prediction,
        confidence: confidence.toFixed(4),
        probabilities: {
          normal: normalProb.toFixed(4),
          stunted: stuntedProb.toFixed(4),
          "severely stunted": severelyStuntedProb.toFixed(4),
        },
        input: {
          umur_bulan,
          berat_badan,
          tinggi_badan,
          jenis_kelamin: jenis_kelamin === 1 ? "Laki-laki" : "Perempuan",
        },
        z_score: heightZScore.toFixed(2),
        note: "Prediksi berdasarkan rule-based system. Untuk akurasi lebih tinggi, gunakan model ML yang telah dilatih.",
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
